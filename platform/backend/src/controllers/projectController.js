const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const SDF = require('../models/SDF');
const erpGenerationService = require('../services/erpGenerationService');

function validateGeneratorSdf(sdf) {
  if (!sdf || typeof sdf !== 'object') return { valid: false, error: 'SDF must be a JSON object' };
  const projectName = sdf.project_name || sdf.projectName;
  if (!projectName || typeof projectName !== 'string') return { valid: false, error: 'SDF.project_name is required' };
  if (!Array.isArray(sdf.entities) || sdf.entities.length === 0) return { valid: false, error: 'SDF.entities must be a non-empty array' };

  for (const e of sdf.entities) {
    if (!e || typeof e !== 'object') return { valid: false, error: 'Each entity must be an object' };
    if (!e.slug || typeof e.slug !== 'string') return { valid: false, error: 'Each entity.slug is required' };
    if (!Array.isArray(e.fields)) return { valid: false, error: `Entity ${e.slug}: fields must be an array` };
  }

  return { valid: true };
}

exports.listProjects = async (req, res) => {
  try {
    const projects = await projectService.getUserProjects(req.user.userId);
    res.json({ projects });
  } catch (err) {
    logger.error('List projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createProject = async (req, res) => {
  try {
    const project = await projectService.createProject(req.user.userId, req.body);
    res.status(201).json(project);
  } catch (err) {
    logger.error('Create project error:', err);
    if (err.message === 'Project name is required') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProject = async (req, res) => {
  try {
    const project = await projectService.getProject(req.params.id, req.user.userId);
    res.json(project);
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.user.userId, req.body);
    res.json(project);
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Update project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    await projectService.deleteProject(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Delete project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.analyzeProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const description = req.body?.description || req.body?.business_description || req.body?.businessDescription;
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Ensure project belongs to user
    const project = await projectService.getProject(projectId, userId);

    // Save description + status
    await projectService.updateProject(projectId, userId, { description: description.trim(), status: 'Analyzing' });

    const sdf = await aiGatewayClient.analyzeDescription(description.trim(), null);
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
    logger.error('Analyze project error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.clarifyProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const partialSdf = req.body?.partial_sdf || req.body?.partialSdf;
    const answers = req.body?.answers;
    const description = req.body?.description || req.body?.business_description || req.body?.businessDescription;

    if (!partialSdf || typeof partialSdf !== 'object') {
      return res.status(400).json({ error: 'partial_sdf is required' });
    }
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array' });
    }

    const project = await projectService.getProject(projectId, userId);

    // If a description is provided here, store it too
    if (description && typeof description === 'string' && description.trim()) {
      await projectService.updateProject(projectId, userId, { description: description.trim(), status: 'Clarifying' });
    } else {
      await projectService.updateProject(projectId, userId, { status: 'Clarifying' });
    }

    const sdf = await aiGatewayClient.clarifySdf({
      businessDescription: (typeof description === 'string' && description.trim()) ? description.trim() : (project.description || ''),
      partialSdf,
      answers,
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
    logger.error('Clarify project error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.getLatestSdf = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    await projectService.getProject(projectId, userId);

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

exports.generateErpZip = async (req, res) => {
  let outputDir = null;
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const project = await projectService.getProject(projectId, userId);
    const latest = await SDF.findLatestByProject(project.id);
    if (!latest?.sdf_json) {
      return res.status(400).json({ error: 'No SDF found. Analyze and save an SDF first.' });
    }

    const sdf = latest.sdf_json;
    const validation = validateGeneratorSdf(sdf);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Latest SDF is invalid: ' + validation.error });
    }

    const result = await erpGenerationService.generateProjectDir({
      projectId: project.name || project.id,
      sdf,
    });
    outputDir = result.outputDir;

    await projectService.updateProject(projectId, userId, { status: 'Generated' });

    await erpGenerationService.streamZipFromDir(res, {
      outputDir,
      zipName: sdf.project_name || project.name || 'custom-erp',
    });
  } catch (err) {
    logger.error('Generate ERP zip error:', err);
    if (!res.headersSent) {
      const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
      res.status(status).json({ error: err.message || 'Internal server error' });
    }
  } finally {
    if (outputDir) {
      await erpGenerationService.rmDirRecursive(outputDir);
    }
  }
};

