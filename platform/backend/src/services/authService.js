const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

const SALT_ROUNDS = 10;

/**
 * Authentication Service
 * Handles user registration, login, and token management
 */
class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - { name, email, password }
   * @returns {Promise<{token: string, user: Object}>}
   */
  async register({ name, email, password }) {
    // Check if email already exists
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      const error = new Error('An account with this email address already exists.');
      error.statusCode = 400;
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = uuidv4();

    // Insert user into database
    const insertQuery = `
      INSERT INTO users (user_id, name, email, password_hash, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING user_id, name, email, created_at
    `;
    
    const result = await query(insertQuery, [
      userId,
      name.trim(),
      email.toLowerCase().trim(),
      passwordHash,
    ]);

    const user = result.rows[0];
    logger.info(`User registered: ${user.email}`);

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        created_at: user.created_at,
      },
    };
  }

  /**
   * Login a user
   * @param {Object} credentials - { email, password }
   * @returns {Promise<{token: string, user: Object}>}
   */
  async login({ email, password }) {
    const user = await this.findByEmail(email);
    if (!user) {
      const error = new Error('The email address or password you entered is incorrect. Please try again.');
      error.statusCode = 401;
      throw error;
    }

    if (user.deleted_at) {
      const error = new Error('Account has been deactivated. Please contact support.');
      error.statusCode = 401;
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

    // Generate JWT token
    const token = generateToken({
      userId: user.user_id,
      email: user.email,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
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
      'SELECT user_id, name, email, created_at, updated_at FROM users WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );
    
    if (!result.rows[0]) return null;
    
    const user = result.rows[0];
    return {
      id: user.user_id,
      name: user.name,
      email: user.email,
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
      'SELECT user_id, name, email, password_hash, deleted_at, created_at, updated_at FROM users WHERE email = $1',
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

  async updateProfile(userId, { name, email }) {
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
      if (existing && existing.user_id !== userId) {
        const error = new Error('This email is already in use by another account.');
        error.statusCode = 409;
        throw error;
      }
      updates.push(`email = $${paramIdx++}`);
      values.push(normalizedEmail);
    }

    if (!updates.length) {
      return this.findById(userId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIdx} AND deleted_at IS NULL RETURNING user_id, name, email, created_at, updated_at`;
    const result = await query(sql, values);
    if (!result.rows[0]) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    const row = result.rows[0];
    logger.info(`Profile updated: ${userId}`);
    return { id: row.user_id, name: row.name, email: row.email, created_at: row.created_at, updated_at: row.updated_at };
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
