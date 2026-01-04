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
        list: 'GET /api/projects (protected)',
        create: 'POST /api/projects (protected)',
        get: 'GET /api/projects/:id (protected)',
        update: 'PUT /api/projects/:id (protected)',
        delete: 'DELETE /api/projects/:id (protected)',
        analyze: 'POST /api/projects/:id/analyze (protected)',
        clarify: 'POST /api/projects/:id/clarify (protected)',
        sdf_latest: 'GET /api/projects/:id/sdf/latest (protected)',
        sdf_save: 'POST /api/projects/:id/sdf/save (protected)',
        sdf_ai_edit: 'POST /api/projects/:id/sdf/ai-edit (protected)',
        generate_zip: 'POST /api/projects/:id/generate (protected, returns zip)',
      }
    }
  });
});

module.exports = router;
