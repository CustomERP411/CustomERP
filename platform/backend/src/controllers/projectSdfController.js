const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const SDF = require('../models/SDF');
const { validateGeneratorSdf } = require('./projectHelpers');

exports.getLatestSdf = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const project = await projectService.getProject(projectId, userId);

    // A raw SDF row may be an internal prefill from module questions. Only
    // expose SDFs once the project has actually generated or is clarifying a
    // generated draft.
    if (!['Ready', 'Generated', 'Approved', 'Clarifying'].includes(project.status)) {
      return res.json({ sdf: null, sdf_version: null });
    }

    const latest = await SDF.findLatestByProject(projectId);
    res.json({ sdf: latest?.sdf_json || null, sdf_version: latest?.version || null });
  } catch (err) {
    logger.error('Get latest SDF error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.saveSdf = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const project = await projectService.getProject(projectId, userId);
    const sdf = req.body?.sdf && typeof req.body.sdf === 'object' ? req.body.sdf : req.body;

    const validation = validateGeneratorSdf(sdf);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const saved = await SDF.create(project.id, sdf);

    const questions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const nextStatus = questions.length ? 'Clarifying' : 'Ready';
    const updatedProject = await projectService.updateProject(projectId, userId, { status: nextStatus });

    res.json({
      project: updatedProject,
      sdf_version: saved?.version,
      sdf,
      questions,
    });
  } catch (err) {
    logger.error('Save SDF error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.aiEditSdf = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const instructions = req.body?.instructions || req.body?.prompt || req.body?.change_request || req.body?.changeRequest;
    if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
      return res.status(400).json({ error: 'instructions is required' });
    }

    const project = await projectService.getProject(projectId, userId);
    const latest = await SDF.findLatestByProject(project.id);
    const currentSdf = req.body?.current_sdf || req.body?.currentSdf || latest?.sdf_json;

    if (!currentSdf || typeof currentSdf !== 'object') {
      return res.status(400).json({ error: 'No current SDF found for this project' });
    }

    await projectService.updateProject(projectId, userId, { status: 'Clarifying' });

    const sdf = await aiGatewayClient.editSdf({
      businessDescription: project.description || '',
      currentSdf,
      instructions: instructions.trim(),
      language: project.language,
    });
    const saved = await SDF.create(project.id, sdf);

    const questions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const nextStatus = questions.length ? 'Clarifying' : 'Ready';
    const updatedProject = await projectService.updateProject(projectId, userId, { status: nextStatus });

    res.json({
      project: updatedProject,
      sdf_version: saved?.version,
      sdf,
      questions,
    });
  } catch (err) {
    logger.error('AI edit SDF error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};
