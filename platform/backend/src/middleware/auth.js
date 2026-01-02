const { verifyToken, generateToken } = require('../utils/jwt');
const logger = require('../utils/logger');

/**
 * Middleware to authenticate JWT token
 * Sets req.user with decoded token payload
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('Invalid token attempt:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if valid token present, continues regardless
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch (error) {
      // Token invalid but route allows unauthenticated access
      req.user = null;
    }
  } else {
    req.user = null;
  }
  
  next();
}

/**
 * Middleware to check if user has specific role
 * Must be used after authenticateToken
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  generateToken, // Re-export for convenience
};
