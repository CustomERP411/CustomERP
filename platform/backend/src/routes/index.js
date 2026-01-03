const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./authRoutes');
const projectRoutes = require('./projectRoutes'); // Task B3

// Route mounting
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes); // Task B3

// API info endpoint
router.get('/', (req, res) => {
  res.json({ 
    message: 'CustomERP API v1.0',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me (protected)',
        logout: 'POST /api/auth/logout (protected)',
      },
      projects: {
        list: 'GET /api/projects (coming in Task B3)',
        create: 'POST /api/projects (coming in Task B3)',
      }
    }
  });
});

module.exports = router;
