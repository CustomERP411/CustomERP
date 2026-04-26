const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const SDF = require('../models/SDF');
const Approval = require('../models/Approval');
const { buildReviewSummary } = require('../services/reviewService');
const { validateGeneratorSdf } = require('./projectHelpers');
const featureRequestService = require('../services/featureRequestService');

const REVIEWABLE_STATUSES = new Set(['Ready', 'Generated', 'Approved']);

/** Maps sdfs.change_kind to ReviewHistoryItem-style action (matches frontend). */
function sdfChangeKindToHistoryAction(kind, version) {
  if (!kind) {
    return version === 1 ? 'generated' : 'ai_revision';
  }
  switch (kind) {
    case 'initial':
      return 'generated';
    case 'clarify':
      return 'clarified';
    case 'manual':
      return 'manual_save';
    case 'ai_edit':
    case 'regenerate':
    case 'review_edit':
      return 'ai_revision';
    default:
      return version === 1 ? 'generated' : 'ai_revision';
  }
}

function toIso(created) {
  if (!created) return new Date().toISOString();
  if (typeof created === 'string') return new Date(created).toISOString();
  if (typeof created === 'object' && created.getTime) return created.toISOString();
  return new Date(created).toISOString();
}

function normalizeAcknowledgedFeatures(body) {
  const raw = body?.acknowledged_unsupported_features || body?.acknowledgedUnsupportedFeatures || [];
  return Array.isArray(raw)
    ? raw.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
    : [];
}

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
    const acknowledgedUnsupportedFeatures = normalizeAcknowledgedFeatures(req.body);

    if (!currentSdf || typeof currentSdf !== 'object') {
      return res.status(400).json({ error: 'No current SDF found for this project.' });
    }

    const sdf = await aiGatewayClient.editSdf({
      businessDescription: project.description || '',
      currentSdf,
      instructions: instructions.trim(),
      language: project.language,
      acknowledgedUnsupportedFeatures,
    });

    if (sdf?.status === 'change_review_required') {
      return res.json({
        status: 'change_review_required',
        project,
        answer_review: sdf.answer_review,
      });
    }

    const validation = validateGeneratorSdf(sdf);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error || 'AI revision returned an invalid SDF' });
    }

    const approval = await Approval.create({
      projectId: project.id,
      decidedByUserId: userId,
      decision: 'revision_requested',
      comments,
      sdfVersion: latest.version,
      revisionInstructions: instructions.trim(),
    });

    const saved = await SDF.create(project.id, sdf, { changeKind: 'review_edit' });

    await Approval.updateResultingSdfVersion(approval.id, saved.version);

    if (acknowledgedUnsupportedFeatures.length > 0) {
      featureRequestService.recordFeatures({
        userId,
        projectId,
        source: 'sdf_revision_request',
        features: acknowledgedUnsupportedFeatures,
        userPrompt: instructions.trim(),
      }).catch((e) => logger.warn('Failed to record acknowledged revision features:', e.message));
    }

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
    const sdfRows = await SDF.findAllByProjectChronological(projectId);

    const fromApprovals = approvals.map((a) => ({
      id: String(a.id),
      action: a.decision,
      version: a.sdf_version,
      resultingVersion: a.resulting_sdf_version,
      status: null,
      note: a.revision_instructions || a.comments || '',
      createdAt: toIso(a.decided_at),
    }));

    const fromSdfs = sdfRows.map((row) => {
      const v = Number(row.version) || 1;
      return {
        id: `sdf-version-${row.sdf_id || row.version}`,
        action: sdfChangeKindToHistoryAction(row.change_kind, v),
        version: v,
        resultingVersion: null,
        status: null,
        note: '',
        createdAt: toIso(row.created_at),
      };
    });

    const history = [...fromApprovals, ...fromSdfs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

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
