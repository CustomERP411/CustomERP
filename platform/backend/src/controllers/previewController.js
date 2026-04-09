const logger = require('../utils/logger');
const previewManager = require('../services/previewManager');
const SDF = require('../models/SDF');

async function startPreview(req, res) {
  try {
    const projectId = req.params.id;

    const sdfRow = await SDF.getLatest(projectId);
    if (!sdfRow) {
      return res.status(400).json({ error: 'No SDF found for this project. Generate one first.' });
    }

    const sdf = typeof sdfRow.sdf_data === 'string' ? JSON.parse(sdfRow.sdf_data) : sdfRow.sdf_data;

    const result = await previewManager.startPreview(projectId, sdf);
    res.json({ previewId: result.previewId, status: result.status });
  } catch (err) {
    logger.error(`[previewController] startPreview error: ${err.message}`);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Failed to start preview' });
  }
}

async function getPreviewStatus(req, res) {
  try {
    const projectId = req.params.id;
    const preview = previewManager.getPreviewForProject(projectId);
    if (!preview) {
      return res.json({ status: 'none' });
    }
    res.json({ previewId: preview.previewId, status: preview.status });
  } catch (err) {
    logger.error(`[previewController] getPreviewStatus error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

async function stopPreview(req, res) {
  try {
    const projectId = req.params.id;
    await previewManager.stopAllForProject(projectId);
    res.json({ status: 'stopped' });
  } catch (err) {
    logger.error(`[previewController] stopPreview error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { startPreview, getPreviewStatus, stopPreview };
