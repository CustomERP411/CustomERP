const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const SDF = require('../models/SDF');
const Approval = require('../models/Approval');
const { buildReviewSummary } = require('../services/reviewService');

const REVIEWABLE_STATUSES = new Set(['Ready', 'Generated', 'Approved']);

exports.getReviewSummary = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const project = await projectService.getProject(projectId, userId);

    const latest = await SDF.findLatestByProject(project.id);
    if (!latest?.sdf_json) {
      return res.status(400).json({ error: 'No SDF found for this project.' });
    }

    const summary = buildReviewSummary(latest.sdf_json);
    res.json({
      ...summary,
      sdfVersion: latest.version,
      projectStatus: project.status,
    });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get review summary error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.approveReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const comments = req.body?.comments || null;

    const project = await projectService.getProject(projectId, userId);
    if (!REVIEWABLE_STATUSES.has(project.status)) {
      return res.status(409).json({
        error: `Cannot approve a project in "${project.status}" status. Project must be in Ready or Generated status.`,
      });
    }

    const latest = await SDF.findLatestByProject(project.id);
    if (!latest?.sdf_json) {
      return res.status(400).json({ error: 'No SDF found to approve.' });
    }

    const approval = await Approval.create({
      projectId: project.id,
      decidedByUserId: userId,
      decision: 'approved',
      comments,
      sdfVersion: latest.version,
    });

    const updatedProject = await projectService.updateProject(projectId, userId, { status: 'Approved' });

    res.json({ project: updatedProject, approval });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Approve review error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.rejectReview = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const comments = req.body?.comments || null;

    const project = await projectService.getProject(projectId, userId);

    const latest = await SDF.findLatestByProject(project.id);

    const approval = await Approval.create({
      projectId: project.id,
      decidedByUserId: userId,
      decision: 'rejected',
      comments,
      sdfVersion: latest?.version ?? null,
    });

    const updatedProject = await projectService.updateProject(projectId, userId, { status: 'Draft' });

    res.json({ project: updatedProject, approval });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Reject review error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.requestRevision = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const instructions = req.body?.instructions;
    const comments = req.body?.comments || null;

    if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
      return res.status(400).json({ error: 'instructions is required' });
    }

    const project = await projectService.getProject(projectId, userId);
    const latest = await SDF.findLatestByProject(project.id);
    const currentSdf = latest?.sdf_json;

    if (!currentSdf || typeof currentSdf !== 'object') {
      return res.status(400).json({ error: 'No current SDF found for this project.' });
    }

    const approval = await Approval.create({
      projectId: project.id,
      decidedByUserId: userId,
      decision: 'revision_requested',
      comments,
      sdfVersion: latest.version,
      revisionInstructions: instructions.trim(),
    });

    await projectService.updateProject(projectId, userId, { status: 'Clarifying' });

    const sdf = await aiGatewayClient.editSdf({
      businessDescription: project.description || '',
      currentSdf,
      instructions: instructions.trim(),
    });
    const saved = await SDF.create(project.id, sdf);

    await Approval.updateResultingSdfVersion(approval.id, saved.version);

    const questions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const nextStatus = questions.length ? 'Clarifying' : 'Ready';
    const updatedProject = await projectService.updateProject(projectId, userId, { status: nextStatus });

    res.json({
      project: updatedProject,
      approval: { ...approval, resulting_sdf_version: saved.version },
      sdf,
      sdf_version: saved.version,
      questions,
    });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Request revision error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.getReviewHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    await projectService.getProject(projectId, userId);

    const approvals = await Approval.findByProject(projectId);

    const history = approvals.map((a) => ({
      id: a.id,
      action: a.decision,
      version: a.sdf_version,
      resultingVersion: a.resulting_sdf_version,
      status: null,
      note: a.revision_instructions || a.comments || '',
      createdAt: a.decided_at,
    }));

    res.json({ history });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get review history error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};
