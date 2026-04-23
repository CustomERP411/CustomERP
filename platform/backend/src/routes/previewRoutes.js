const express = require('express');
const router = express.Router();
const previewController = require('../controllers/previewController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/:id/preview/start', previewController.startPreview);
router.get('/:id/preview/status', previewController.getPreviewStatus);
router.post('/:id/preview/heartbeat', previewController.heartbeat);
router.delete('/:id/preview/stop', previewController.stopPreview);

module.exports = router;
