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
    // Find user by email
    const user = await this.findByEmail(email);
    if (!user) {
      const error = new Error('The email address or password you entered is incorrect. Please try again.');
      error.statusCode = 401;
      throw error;
    }

    // Verify password
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
      'SELECT user_id, name, email, created_at, updated_at FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (!result.rows[0]) return null;
    
    // Map user_id to id for consistency
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
      'SELECT user_id, name, email, password_hash, created_at, updated_at FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    return result.rows[0] || null;
  }

  /**
   * Verify and get current user from token payload
   * @param {Object} tokenPayload - Decoded JWT payload
   * @returns {Promise<Object>}
   */
  async getCurrentUser(tokenPayload) {
    const user = await this.findById(tokenPayload.userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }
}

module.exports = new AuthService();
