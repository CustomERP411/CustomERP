const router = require('express').Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const featureRequestController = require('../controllers/featureRequestController');

router.get('/my/feature-requests', authenticateToken, featureRequestController.listMine);
router.get('/my/feature-requests/:id', authenticateToken, featureRequestController.getMyDetail);
router.post('/my/feature-requests/:id/messages', authenticateToken, featureRequestController.addMessage);

router.get('/admin/feature-requests', authenticateToken, requireAdmin, featureRequestController.listAll);
router.get('/admin/feature-requests/stats', authenticateToken, requireAdmin, featureRequestController.getStats);
router.get('/admin/feature-requests/:id', authenticateToken, requireAdmin, featureRequestController.getDetail);
router.put('/admin/feature-requests/:id', authenticateToken, requireAdmin, featureRequestController.updateStatus);
router.post('/admin/feature-requests/:id/messages', authenticateToken, requireAdmin, featureRequestController.addMessage);

module.exports = router;
