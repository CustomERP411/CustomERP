const authService = require('../services/authService');
const { SUPPORTED_LANGUAGES, normalizeLanguage } = require('../services/authService');
const { isValidEmail, validatePassword, validateName, sanitize } = require('../utils/validators');
const logger = require('../utils/logger');

function validateLanguage(value) {
  if (value === undefined || value === null) return { valid: true, value: undefined };
  if (typeof value !== 'string' || !SUPPORTED_LANGUAGES.includes(value.trim().toLowerCase().split('-')[0])) {
    return { valid: false, message: `preferred_language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}` };
  }
  return { valid: true, value: normalizeLanguage(value) };
}

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
    const { name, email, password, preferred_language } = req.body;

    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return res.status(400).json({ error: nameValidation.message });
    }

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    const langValidation = validateLanguage(preferred_language);
    if (!langValidation.valid) {
      return res.status(400).json({ error: langValidation.message });
    }

    const result = await authService.register({
      name: sanitize(name),
      email: email.toLowerCase().trim(),
      password,
      preferred_language: langValidation.value,
    });

    res.status(201).json(result);
  } catch (error) {
    logger.error('Registration error:', error.message);
    
    if (error.statusCode) {
      const body = { error: error.message };
      if (error.code) body.code = error.code;
      return res.status(error.statusCode).json(body);
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
      const body = { error: error.message };
      if (error.code) body.code = error.code;
      return res.status(error.statusCode).json(body);
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

/**
 * DELETE /api/auth/account
 * Soft-delete the authenticated user's account
 */
async function deleteAccount(req, res, next) {
  try {
    const userId = req.user.userId ?? req.user.id;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    await authService.deleteAccount(userId);
    res.status(204).send();
  } catch (error) {
    logger.error('Delete account error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, email, preferred_language } = req.body;

    if (name !== undefined) {
      const nameValidation = validateName(name);
      if (!nameValidation.valid) {
        return res.status(400).json({ error: nameValidation.message });
      }
    }
    if (email !== undefined && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    const langValidation = validateLanguage(preferred_language);
    if (!langValidation.valid) {
      return res.status(400).json({ error: langValidation.message });
    }

    const user = await authService.updateProfile(req.user.userId, {
      name: name !== undefined ? sanitize(name) : undefined,
      email: email !== undefined ? email.toLowerCase().trim() : undefined,
      preferred_language: langValidation.value,
    });

    res.json({ user });
  } catch (error) {
    logger.error('Update profile error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    await authService.changePassword(req.user.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    next(error);
  }
}

module.exports = {
  register,
  login,
  me,
  logout,
  deleteAccount,
  updateProfile,
  changePassword,
};

