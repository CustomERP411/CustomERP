const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const trainingController = require('../controllers/trainingController');

router.use(authenticateToken, requireAdmin);

router.get('/', trainingController.listSessions);
router.get('/stats', trainingController.getStats);
router.get('/:sessionId', trainingController.getSession);
router.put('/:sessionId/review', trainingController.saveReview);
router.put('/:sessionId/steps/:agent/review', trainingController.saveStepReview);
router.post('/export', trainingController.exportAzure);

module.exports = router;
