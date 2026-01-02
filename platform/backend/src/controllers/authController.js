const authService = require('../services/authService');
const { isValidEmail, validatePassword, validateName, sanitize } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles HTTP requests for auth endpoints
 */

/**
 * POST /api/auth/register
 * Register a new user
 */
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // Validate name
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ error: nameValidation.message });
    }

    // Validate email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // Register user
    const result = await authService.register({
      name: sanitize(name),
      email: email.toLowerCase().trim(),
      password,
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error('Registration error:', error.message);
    
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    
    next(error);
  }
}

/**
 * POST /api/auth/login
 * Login a user
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate email
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Validate password presence
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Attempt login
    const result = await authService.login({
      email: email.toLowerCase().trim(),
      password,
    });

    res.json(result);
  } catch (error) {
    logger.error('Login error:', error.message);
    
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    
    next(error);
  }
}

/**
 * GET /api/auth/me
 * Get current user from token
 */
async function me(req, res, next) {
  try {
    // req.user is set by authenticateToken middleware
    const user = await authService.getCurrentUser(req.user);
    
    res.json({ user });
  } catch (error) {
    logger.error('Get current user error:', error.message);
    
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    
    next(error);
  }
}

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, server-side is stateless)
 */
async function logout(req, res) {
  // JWT is stateless, logout is handled client-side
  // This endpoint exists for API completeness and future token blacklisting
  res.json({ message: 'Logged out successfully' });
}

module.exports = {
  register,
  login,
  me,
  logout,
};

