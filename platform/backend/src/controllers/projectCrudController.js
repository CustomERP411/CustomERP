const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const moduleQuestionnaireService = require('../services/moduleQuestionnaireService');
const prefilledSdfService = require('../services/prefilledSdfService');
const { parseModulesInput } = require('./projectHelpers');

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
      language: project.language,
    });

    const prefill = prefilledSdfService.buildPrefilledFromQuestionnaireState({
      projectName: project.name,
      questionnaireState: state,
    });

    // Plan C — wizard wiring. `state.dependency_graph` is shipped down so the
    // frontend can mirror coercion + render hints/badges; `coerced` only
    // populated for the save endpoint.
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
      language: project.language,
    });

    const prefill = prefilledSdfService.buildPrefilledFromQuestionnaireState({
      projectName: project.name,
      questionnaireState: state,
    });

    // The questionnaire prefill is an input to generation, not a generated ERP.
    // Persisting it in the SDF table makes the project look "ready" on reload
    // before the user answers the open-ended business questions or presses
    // Generate. Return it to the frontend, but do not create an SDF version.
    const prefilledSdfVersion = null;
    const updatedProject = project.status === 'Draft'
      ? project
      : await projectService.updateProject(projectId, userId, { status: 'Draft' });

    res.json({
      ...state,
      project: updatedProject,
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
      language: project.language,
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
