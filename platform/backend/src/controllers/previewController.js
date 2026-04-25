const logger = require('../utils/logger');
const previewManager = require('../services/previewManager');
const projectService = require('../services/projectService');
const SDF = require('../models/SDF');
const { signIframeToken } = require('../utils/previewToken');

const { ERROR_CODES } = previewManager;
const PREVIEWABLE_STATUSES = new Set(['Ready', 'Generated', 'Approved']);

function respondError(res, statusCode, code, message) {
  return res.status(statusCode).json({ error: message, code });
}

async function requireOwnership(req, res) {
  try {
    await projectService.getProject(req.params.id, req.user.userId);
    return true;
  } catch (_err) {
    respondError(res, 404, ERROR_CODES.NOT_FOUND, 'Project not found');
    return false;
  }
}

async function startPreview(req, res) {
  try {
    if (!(await requireOwnership(req, res))) return;

    const projectId = req.params.id;

    const project = await projectService.getProject(projectId, req.user.userId);
    if (!PREVIEWABLE_STATUSES.has(project.status)) {
      return respondError(
        res,
        409,
        ERROR_CODES.NO_SDF,
        'Generate the ERP before opening the preview.',
      );
    }

    const sdfRow = await SDF.findLatestByProject(projectId);
    if (!sdfRow) {
      return respondError(
        res,
        400,
        ERROR_CODES.NO_SDF,
        'No SDF found for this project. Generate one first.',
      );
    }

    const sdf = typeof sdfRow.sdf_json === 'string' ? JSON.parse(sdfRow.sdf_json) : sdfRow.sdf_json;

    const result = await previewManager.startPreview(projectId, sdf, {
      language: project?.language,
    });
    res.json({ previewId: result.previewId, status: result.status });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const code = err.code || ERROR_CODES.BUILD_FAILED;
    logger.error(`[previewController] startPreview error (${code}): ${err.message}`);
    respondError(res, statusCode, code, err.message || 'Failed to start preview');
  }
}

async function getPreviewStatus(req, res) {
  try {
    if (!(await requireOwnership(req, res))) return;

    const projectId = req.params.id;
    const preview = previewManager.getPreviewForProject(projectId);
    if (!preview) {
      return res.json({ status: 'none' });
    }

    const response = {
      previewId: preview.previewId,
      status: preview.status,
      phase: preview.phase || preview.status,
    };

    if (preview.status === 'queued') {
      response.queuePosition = previewManager.getQueuePosition(preview.previewId);
    }

    if (preview.status === 'error') {
      response.errorCode = preview.errorCode || ERROR_CODES.BUILD_FAILED;
      response.error = preview.errorMessage || 'Preview failed';
    }

    if (preview.status === 'running') {
      response.iframeToken = signIframeToken({
        userId: req.user.userId,
        previewId: preview.previewId,
      });
    }

    res.json(response);
  } catch (err) {
    logger.error(`[previewController] getPreviewStatus error: ${err.message}`);
    respondError(res, 500, ERROR_CODES.BUILD_FAILED, err.message);
  }
}

async function stopPreview(req, res) {
  try {
    if (!(await requireOwnership(req, res))) return;

    const projectId = req.params.id;
    await previewManager.stopAllForProject(projectId);
    res.json({ status: 'stopped' });
  } catch (err) {
    logger.error(`[previewController] stopPreview error: ${err.message}`);
    respondError(res, 500, ERROR_CODES.BUILD_FAILED, err.message);
  }
}

async function heartbeat(req, res) {
  try {
    if (!(await requireOwnership(req, res))) return;

    const projectId = req.params.id;
    const ok = previewManager.touchHeartbeatForProject(projectId);
    if (!ok) {
      return respondError(res, 404, ERROR_CODES.NOT_FOUND, 'No active preview');
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[previewController] heartbeat error: ${err.message}`);
    respondError(res, 500, ERROR_CODES.BUILD_FAILED, err.message);
  }
}

module.exports = { startPreview, getPreviewStatus, stopPreview, heartbeat };
