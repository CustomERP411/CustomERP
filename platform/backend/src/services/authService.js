const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;
const SUPPORTED_LANGUAGES = ['en', 'tr'];
const DEFAULT_LANGUAGE = 'en';

function normalizeLanguage(value) {
  if (typeof value !== 'string') return DEFAULT_LANGUAGE;
  const lower = value.trim().toLowerCase();
  if (!lower) return DEFAULT_LANGUAGE;
  if (SUPPORTED_LANGUAGES.includes(lower)) return lower;
  // Accept locale tags like "tr-TR" by using the language part.
  const prefix = lower.split('-')[0];
  if (SUPPORTED_LANGUAGES.includes(prefix)) return prefix;
  return DEFAULT_LANGUAGE;
}

/**
 * Authentication Service
 * Handles user registration, login, and token management
 */
class AuthService {
  buildRegisterResponse(user) {
    const preferredLanguage = normalizeLanguage(user.preferred_language);
    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      name: user.name,
      isAdmin: !!user.is_admin,
      preferredLanguage,
    });
    return {
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        is_admin: !!user.is_admin,
        preferred_language: preferredLanguage,
        created_at: user.created_at,
      },
    };
  }

  /**
   * Register a new user
   * @param {Object} userData - { name, email, password, preferred_language }
   * @returns {Promise<{token: string, user: Object}>}
   */
  async register({ name, email, password, preferred_language }) {
    const normalized = email.toLowerCase().trim();
    const existingUser = await this.findByEmail(normalized);
    if (existingUser && !existingUser.deleted_at) {
      const error = new Error('An account with this email address already exists.');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const lang = normalizeLanguage(preferred_language);
    const trimmedName = name.trim();

    if (existingUser && existingUser.deleted_at) {
      const reactivated = await query(
        `UPDATE users SET
          deleted_at = NULL,
          password_hash = $1,
          name = $2,
          preferred_language = $3,
          updated_at = CURRENT_TIMESTAMP,
          blocked_at = NULL,
          block_reason = NULL
         WHERE user_id = $4 AND deleted_at IS NOT NULL
         RETURNING user_id, name, email, is_admin, preferred_language, created_at`,
        [passwordHash, trimmedName, lang, existingUser.user_id]
      );
      if (!reactivated.rows[0]) {
        const err = new Error('Could not reactivate account. Please try again.');
        err.statusCode = 409;
        throw err;
      }
      const user = reactivated.rows[0];
      logger.info(`User re-registered (reactivated): ${user.email} (lang=${user.preferred_language})`);
      return this.buildRegisterResponse(user);
    }

    const userId = uuidv4();

    const insertQuery = `
      INSERT INTO users (user_id, name, email, password_hash, preferred_language, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING user_id, name, email, is_admin, preferred_language, created_at
    `;

    const result = await query(insertQuery, [
      userId,
      trimmedName,
      normalized,
      passwordHash,
      lang,
    ]);

    const user = result.rows[0];
    logger.info(`User registered: ${user.email} (lang=${user.preferred_language})`);

    return this.buildRegisterResponse(user);
  }

  async login({ email, password }) {
    const user = await this.findByEmail(email);
    if (!user) {
      const error = new Error('The email address or password you entered is incorrect. Please try again.');
      error.statusCode = 401;
      throw error;
    }

    if (user.deleted_at) {
      const error = new Error(
        'This account was deleted. You can create a new account with the same email on the sign-up page.',
      );
      error.statusCode = 401;
      error.code = 'ACCOUNT_DELETED';
      throw error;
    }

    if (user.blocked_at) {
      const contactEmail = process.env.CONTACT_EMAIL || 'support@example.com';
      const reason = user.block_reason || 'suspicious activity';
      const error = new Error(`Your account has been suspended due to ${reason}. Contact ${contactEmail} for assistance.`);
      error.statusCode = 403;
      error.code = 'ACCOUNT_BLOCKED';
      throw error;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      logger.warn(`Failed login attempt for: ${email}`);
      const error = new Error('The email address or password you entered is incorrect. Please try again.');
      error.statusCode = 401;
      throw error;
    }

    logger.info(`User logged in: ${email}`);

    const preferredLanguage = normalizeLanguage(user.preferred_language);

    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      name: user.name,
      isAdmin: !!user.is_admin,
      preferredLanguage,
    });

    return {
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        is_admin: !!user.is_admin,
        preferred_language: preferredLanguage,
        created_at: user.created_at,
      },
    };
  }

  /**
   * Get user by ID
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async findById(userId) {
    const result = await query(
      'SELECT user_id, name, email, is_admin, preferred_language, created_at, updated_at FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (!result.rows[0]) return null;

    const user = result.rows[0];
    return {
      id: user.user_id,
      name: user.name,
      email: user.email,
      is_admin: !!user.is_admin,
      preferred_language: normalizeLanguage(user.preferred_language),
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * Get user by email
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const result = await query(
      'SELECT user_id, name, email, password_hash, is_admin, preferred_language, deleted_at, blocked_at, block_reason, created_at, updated_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  async getCurrentUser(tokenPayload) {
    const user = await this.findById(tokenPayload.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }

  async updateProfile(userId, { name, email, preferred_language }) {
    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name.trim());
    }
    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await this.findByEmail(normalizedEmail);
      if (existing && existing.user_id !== userId && !existing.deleted_at) {
        const error = new Error('This email is already in use by another account.');
        error.statusCode = 409;
        throw error;
      }
      updates.push(`email = $${paramIdx++}`);
      values.push(normalizedEmail);
    }
    if (preferred_language !== undefined) {
      updates.push(`preferred_language = $${paramIdx++}`);
      values.push(normalizeLanguage(preferred_language));
    }

    if (!updates.length) {
      return this.findById(userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIdx} AND deleted_at IS NULL RETURNING user_id, name, email, preferred_language, created_at, updated_at`;
    const result = await query(sql, values);
    if (!result.rows[0]) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    const row = result.rows[0];
    logger.info(`Profile updated: ${userId}`);
    return {
      id: row.user_id,
      name: row.name,
      email: row.email,
      preferred_language: normalizeLanguage(row.preferred_language),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const result = await query(
      'SELECT user_id, password_hash FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    if (!result.rows[0]) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      const error = new Error('Current password is incorrect.');
      error.statusCode = 400;
      throw error;
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [hash, userId]
    );
    logger.info(`Password changed: ${userId}`);
    return true;
  }

  async deleteAccount(userId) {
    const result = await query(
      'UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND deleted_at IS NULL RETURNING user_id',
      [userId]
    );
    if (!result.rowCount) {
      const error = new Error('Account not found');
      error.statusCode = 404;
      throw error;
    }
    logger.info(`Account soft-deleted: ${userId}`);
    return true;
  }
}

module.exports = new AuthService();
module.exports.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
module.exports.DEFAULT_LANGUAGE = DEFAULT_LANGUAGE;
module.exports.normalizeLanguage = normalizeLanguage;
