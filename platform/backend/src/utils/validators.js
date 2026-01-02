/**
 * Input validation utilities
 */

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password 
 * @returns {{valid: boolean, message?: string}}
 */
function validatePassword(password) {
  if (!password) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  if (password.length > 128) {
    return { valid: false, message: 'Password must be less than 128 characters' };
  }
  return { valid: true };
}

/**
 * Validate name
 * @param {string} name 
 * @returns {{valid: boolean, message?: string}}
 */
function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, message: 'Name must be at least 2 characters' };
  }
  if (trimmed.length > 100) {
    return { valid: false, message: 'Name must be less than 100 characters' };
  }
  return { valid: true };
}

/**
 * Sanitize user input (basic XSS prevention)
 * @param {string} input 
 * @returns {string}
 */
function sanitize(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

module.exports = {
  isValidEmail,
  validatePassword,
  validateName,
  sanitize,
};

