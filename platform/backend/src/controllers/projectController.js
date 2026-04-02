const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const clarificationService = require('../services/clarificationService');
const moduleQuestionnaireService = require('../services/moduleQuestionnaireService');
const prefilledSdfService = require('../services/prefilledSdfService');
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

function parseModulesInput(rawModules) {
  const allowed = new Set(['inventory', 'invoice', 'hr']);

  const list = Array.isArray(rawModules)
    ? rawModules
    : (typeof rawModules === 'string' ? rawModules.split(',') : []);

  const normalized = list
    .map((moduleKey) => String(moduleKey || '').trim().toLowerCase())
    .filter((moduleKey) => allowed.has(moduleKey));

  const unique = [];
  const seen = new Set();
  for (const moduleKey of normalized) {
    if (seen.has(moduleKey)) continue;
    seen.add(moduleKey);
    unique.push(moduleKey);
  }

  return unique;
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
    if (err.code === '23503' || err.constraint === 'projects_owner_user_id_fkey') {
      return res.status(401).json({ error: 'Invalid session user. Please log out and log in again.' });
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

exports.getDefaultModuleQuestions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const modules = parseModulesInput(req.query?.modules);
    const project = await projectService.getProject(projectId, userId);

    const state = await moduleQuestionnaireService.getQuestionnaireState({
      projectId: project.id,
      modules,
    });

    const prefill = prefilledSdfService.buildPrefilledFromQuestionnaireState({
      projectName: project.name,
      questionnaireState: state,
    });

    res.json({
      ...state,
      prefilled_sdf: prefill.prefilled_sdf,
      prefill_validation: prefill.validation,
    });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get default module questions error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.saveDefaultModuleAnswers = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const modules = parseModulesInput(req.body?.modules);
    const answers = req.body?.answers;

    if (!answers || (Array.isArray(answers) && answers.length === 0)) {
      return res.status(400).json({ error: 'answers is required' });
    }

    const project = await projectService.getProject(projectId, userId);
    const state = await moduleQuestionnaireService.saveQuestionnaireAnswers({
      projectId: project.id,
      modules,
      answers,
    });

    const prefill = prefilledSdfService.buildPrefilledFromQuestionnaireState({
      projectName: project.name,
      questionnaireState: state,
    });

    let prefilledSdfVersion = null;
    if (prefill.prefilled_sdf && typeof prefill.prefilled_sdf === 'object') {
      const saved = await SDF.create(project.id, prefill.prefilled_sdf);
      prefilledSdfVersion = saved?.version || null;
    }

    res.json({
      ...state,
      prefilled_sdf: prefill.prefilled_sdf,
      prefilled_sdf_version: prefilledSdfVersion,
      prefill_validation: prefill.validation,
    });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Save default module answers error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.getDefaultModulePrefill = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const modules = parseModulesInput(req.query?.modules);
    const project = await projectService.getProject(projectId, userId);

    const state = await moduleQuestionnaireService.getQuestionnaireState({
      projectId: project.id,
      modules,
    });

    const prefill = prefilledSdfService.buildPrefilledFromQuestionnaireState({
      projectName: project.name,
      questionnaireState: state,
    });

    res.json({
      modules: state.modules,
      template_versions: state.template_versions,
      mandatory_answers: state.mandatory_answers,
      completion: state.completion,
      prefilled_sdf: prefill.prefilled_sdf,
      prefill_validation: prefill.validation,
    });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get default module prefill error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
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
    const requestedModules = parseModulesInput(req.body?.modules);
    const prefilledModuleKeys = parseModulesInput(Object.keys(req.body?.prefilled_sdf?.modules || {}));
    const modulesForQuestionnaire = requestedModules.length ? requestedModules : prefilledModuleKeys;
    const questionnaireState = await moduleQuestionnaireService.getQuestionnaireState({
      projectId: project.id,
      modules: modulesForQuestionnaire,
    });

    if (!questionnaireState.completion.is_complete) {
      return res.status(400).json({
        error: 'Mandatory module questions are incomplete',
        missing_required_question_ids: questionnaireState.completion.missing_required_question_ids,
        missing_required_question_keys: questionnaireState.completion.missing_required_question_keys,
      });
    }

    const mandatoryAnswers =
      req.body?.default_question_answers && typeof req.body.default_question_answers === 'object'
        ? req.body.default_question_answers
        : questionnaireState.mandatory_answers;

    const generatedPrefill = prefilledSdfService.buildPrefilledFromQuestionnaireState({
      projectName: project.name,
      questionnaireState,
    });
    const prefilledSdf =
      req.body?.prefilled_sdf && typeof req.body.prefilled_sdf === 'object'
        ? req.body.prefilled_sdf
        : generatedPrefill.prefilled_sdf;

    // Save description + status
    await projectService.updateProject(projectId, userId, { description: description.trim(), status: 'Analyzing' });

    let sdf = await aiGatewayClient.analyzeDescription(description.trim(), null, {
      defaultQuestionAnswers: mandatoryAnswers,
      prefilledSdf,
    });
    const rawQuestions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const persistedQuestions = await clarificationService.persistQuestions({
      projectId: project.id,
      questions: rawQuestions,
      cycle: 1,
    });
    if (persistedQuestions.length) {
      sdf = { ...sdf, clarifications_needed: persistedQuestions };
    }
    const saved = await SDF.create(project.id, sdf);

    const nextStatus = persistedQuestions.length ? 'Clarifying' : 'Ready';
    const updatedProject = await projectService.updateProject(projectId, userId, { status: nextStatus });

    res.json({
      project: updatedProject,
      sdf_version: saved?.version,
      sdf,
      questions: persistedQuestions,
      sdf_complete: sdf?.sdf_complete || false,
      token_usage: sdf?.token_usage || null,
      cycle: 1,
      default_question_answers: mandatoryAnswers,
      prefilled_sdf: prefilledSdf,
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

    const priorCycleCount = await clarificationService.getCycleCount(project.id);
    const currentCycle = priorCycleCount + 1;

    await clarificationService.persistAnswers({
      projectId: project.id,
      answers,
      cycle: currentCycle,
    });

    const requestedModules = parseModulesInput(Object.keys(partialSdf?.modules || {}));
    const questionnaireState = await moduleQuestionnaireService.getQuestionnaireState({
      projectId: project.id,
      modules: requestedModules,
    });
    const mandatoryAnswers = questionnaireState.mandatory_answers || {};

    let sdf = await aiGatewayClient.clarifySdf({
      businessDescription: (typeof description === 'string' && description.trim()) ? description.trim() : (project.description || ''),
      partialSdf,
      answers,
      defaultQuestionAnswers: mandatoryAnswers,
    });
    const rawQuestions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const persistedQuestions = await clarificationService.persistQuestions({
      projectId: project.id,
      questions: rawQuestions,
      cycle: currentCycle,
    });
    if (persistedQuestions.length) {
      sdf = { ...sdf, clarifications_needed: persistedQuestions };
    }
    const saved = await SDF.create(project.id, sdf);

    const nextStatus = persistedQuestions.length ? 'Clarifying' : 'Ready';
    const updatedProject = await projectService.updateProject(projectId, userId, { status: nextStatus });

    res.json({
      project: updatedProject,
      sdf_version: saved?.version,
      sdf,
      questions: persistedQuestions,
      sdf_complete: sdf?.sdf_complete || false,
      token_usage: sdf?.token_usage || null,
      cycle: currentCycle,
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

exports.generateStandaloneErpZip = async (req, res) => {
  let outputDir = null;
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const platform = String(req.query.platform || '').trim();

    if (!platform) {
      return res.status(400).json({
        error: 'Missing required query parameter: platform',
        supported: ['macos-arm64', 'macos-x64', 'linux-x64', 'windows-x64'],
      });
    }

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

    const result = await erpGenerationService.generateStandaloneDir({
      projectId: project.name || project.id,
      sdf,
      platform,
    });
    outputDir = result.outputDir;

    await projectService.updateProject(projectId, userId, { status: 'Generated' });

    const zipName = `${sdf.project_name || project.name || 'custom-erp'}-${platform}`;
    await erpGenerationService.streamZipFromDir(res, { outputDir, zipName });
  } catch (err) {
    logger.error('Generate standalone ERP zip error:', err);
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

