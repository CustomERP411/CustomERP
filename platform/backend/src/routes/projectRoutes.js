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

// Mandatory module questions + prefill flow
router.get('/:id/default-questions', projectController.getDefaultModuleQuestions);
router.post('/:id/default-questions/answers', projectController.saveDefaultModuleAnswers);
router.get('/:id/default-questions/prefill', projectController.getDefaultModulePrefill);

// Chat mode (feature discussion before build)
router.post('/:id/chat', projectController.chatWithProject);

// AI workflow (Task B4 integration - used to test ai-gateway)
router.post('/:id/analyze', projectController.analyzeProject);
router.post('/:id/regenerate', projectController.regenerateProject);
router.get('/:id/analyze/progress', projectController.getGenerationProgress);
router.post('/:id/clarify', projectController.clarifyProject);
// Plan D follow-up #8: advisory module precheck (read-only, never mutates state)
router.post('/:id/ai/precheck-modules', projectController.precheckModules);
router.get('/:id/sdf/latest', projectController.getLatestSdf);
router.post('/:id/sdf/save', projectController.saveSdf);
router.post('/:id/sdf/ai-edit', projectController.aiEditSdf);

// Review & Approval workflow
router.get('/:id/review/summary', projectController.getReviewSummary);
router.post('/:id/review/approve', projectController.approveReview);
router.post('/:id/review/reject', projectController.rejectReview);
router.post('/:id/review/revise', projectController.requestRevision);
router.get('/:id/review/history', projectController.getReviewHistory);

// Pre-build conversation history
router.get('/:id/conversations', projectController.getConversations);

// Generator: produce downloadable zip
router.post('/:id/generate', projectController.generateErpZip);
router.post('/:id/generate/standalone', projectController.generateStandaloneErpZip);

module.exports = router;

