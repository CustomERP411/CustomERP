const express = require('express');
const router = express.Router();

// Import route modules (will be added in subsequent tasks)
// const authRoutes = require('./authRoutes');
// const projectRoutes = require('./projectRoutes');

// Route mounting
// router.use('/auth', authRoutes);
// router.use('/projects', projectRoutes);

// Placeholder route for testing
router.get('/', (req, res) => {
  res.json({ 
    message: 'CustomERP API v1.0',
    endpoints: {
      health: 'GET /health',
      auth: {
        register: 'POST /api/auth/register (coming in Task B2)',
        login: 'POST /api/auth/login (coming in Task B2)',
      },
      projects: {
        list: 'GET /api/projects (coming in Task B3)',
        create: 'POST /api/projects (coming in Task B3)',
      }
    }
  });
});

module.exports = router;

