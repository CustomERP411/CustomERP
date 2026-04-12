const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const clarificationService = require('../services/clarificationService');
const moduleQuestionnaireService = require('../services/moduleQuestionnaireService');
const prefilledSdfService = require('../services/prefilledSdfService');
const SDF = require('../models/SDF');
const ProjectConversation = require('../models/ProjectConversation');
const { parseModulesInput } = require('./projectHelpers');

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

    // Persist pre-build conversation snapshot BEFORE calling the AI
    const convContext = req.body?.conversation_context;
    const conversation = await ProjectConversation.create({
      projectId: project.id,
      sdfVersion: null,
      mode: req.body?.mode || 'build',
      businessAnswers: convContext?.business_answers || null,
      selectedModules: requestedModules,
      accessRequirements: convContext?.access_requirements || null,
      descriptionSnapshot: description.trim(),
      defaultQuestionAnswers: mandatoryAnswers,
    }).catch((err) => { logger.error('Failed to persist pre-build conversation context:', err); return null; });

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

    // Link the pre-build conversation snapshot to the generated SDF version
    if (conversation?.id && saved?.version) {
      await ProjectConversation.updateSdfVersion(conversation.id, saved.version)
        .catch((err) => logger.error('Failed to update conversation sdf_version:', err));
    }

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

exports.chatWithProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const message = req.body?.message;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const project = await projectService.getProject(projectId, userId);

    const chatResponse = await aiGatewayClient.chat({
      businessDescription: project.description || '',
      message: message.trim(),
      conversationHistory: Array.isArray(req.body?.conversation_history) ? req.body.conversation_history : [],
      selectedModules: Array.isArray(req.body?.selected_modules) ? req.body.selected_modules : [],
      businessAnswers: req.body?.business_answers || null,
      currentStep: req.body?.current_step || null,
      sdfStatus: req.body?.sdf_status || null,
    });

    res.json(chatResponse);
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Chat with project error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    await projectService.getProject(projectId, userId);

    const conversations = await ProjectConversation.findByProject(projectId);
    res.json({ conversations });
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get conversations error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};
