const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

/**
 * Authentication Routes
 * 
 * POST /api/auth/register - Register new user
 * POST /api/auth/login    - Login user
 * GET  /api/auth/me       - Get current user (protected)
 * POST /api/auth/logout   - Logout user (protected)
 */

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes
router.get('/me', authenticateToken, authController.me);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;

