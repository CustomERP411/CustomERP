const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);
router.get('/:id', projectController.getProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// AI workflow (Task B4 integration - used to test ai-gateway)
router.post('/:id/analyze', projectController.analyzeProject);
router.post('/:id/clarify', projectController.clarifyProject);
router.get('/:id/sdf/latest', projectController.getLatestSdf);
router.post('/:id/sdf/save', projectController.saveSdf);
router.post('/:id/sdf/ai-edit', projectController.aiEditSdf);

// Generator: produce downloadable zip
router.post('/:id/generate', projectController.generateErpZip);

module.exports = router;

