const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const aiGatewayClient = require('../services/aiGatewayClient');
const clarificationService = require('../services/clarificationService');
const moduleQuestionnaireService = require('../services/moduleQuestionnaireService');
const prefilledSdfService = require('../services/prefilledSdfService');
const featureRequestService = require('../services/featureRequestService');
const descriptionValidationService = require('../services/descriptionValidationService');
const SDF = require('../models/SDF');
const ProjectConversation = require('../models/ProjectConversation');
const { parseModulesInput } = require('./projectHelpers');

function shouldHaltForAnswerReview(sdf) {
  const review = sdf && typeof sdf === 'object' ? sdf.answer_review : null;
  if (!review || typeof review !== 'object') return false;
  if (sdf.halted_reason === 'answer_review') return true;

  const issues = Array.isArray(review.issues) ? review.issues : [];
  const hasBlocking = issues.some((issue) => issue && issue.severity === 'block');
  const hasUnacknowledgedUnsupported = issues.some(
    (issue) => issue && issue.kind === 'unsupported_feature' && issue.severity === 'acknowledgeable'
  );

  return review.is_clear_to_proceed === false || hasBlocking || hasUnacknowledgedUnsupported;
}

function normalizeAcknowledgedFeatures(body) {
  const raw = body?.acknowledged_unsupported_features || body?.acknowledgedUnsupportedFeatures || [];
  return Array.isArray(raw)
    ? raw.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
    : [];
}

exports.analyzeProject = async (req, res) => {
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const description = req.body?.description || req.body?.business_description || req.body?.businessDescription;
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Ensure project belongs to user
    const project = await projectService.getProject(projectId, userId);

    // UC-7.3: gate the heavy generator behind an AI "is this description
    // usable?" check. The service fails open on infra errors, so we only
    // reject here when the AI explicitly says the text is not good enough.
    const descriptionVerdict = await descriptionValidationService.validate(
      description.trim(),
      { language: project.language },
    );
    if (descriptionVerdict && descriptionVerdict.valid === false) {
      return res.status(400).json({
        error: 'description rejected',
        reason: descriptionVerdict.reason,
      });
    }

    const requestedModules = parseModulesInput(req.body?.modules);
    const prefilledModuleKeys = parseModulesInput(Object.keys(req.body?.prefilled_sdf?.modules || {}));
    const modulesForQuestionnaire = requestedModules.length ? requestedModules : prefilledModuleKeys;
    const questionnaireState = await moduleQuestionnaireService.getQuestionnaireState({
      projectId: project.id,
      modules: modulesForQuestionnaire,
      language: project.language,
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
    const acknowledgedUnsupportedFeatures = Array.isArray(
      req.body?.acknowledged_unsupported_features
    )
      ? req.body.acknowledged_unsupported_features.filter(
          (f) => typeof f === 'string' && f.trim()
        ).map((f) => f.trim())
      : [];
    const conversation = await ProjectConversation.create({
      projectId: project.id,
      sdfVersion: null,
      mode: req.body?.mode || 'build',
      businessAnswers: convContext?.business_answers || null,
      selectedModules: requestedModules,
      accessRequirements: convContext?.access_requirements || null,
      descriptionSnapshot: description.trim(),
      defaultQuestionAnswers: mandatoryAnswers,
      acknowledgedUnsupportedFeatures,
    }).catch((err) => { logger.error('Failed to persist pre-build conversation context:', err); return null; });

    // Save description + status
    await projectService.updateProject(projectId, userId, { description: description.trim(), status: 'Analyzing' });

    let sdf = await aiGatewayClient.analyzeDescription(description.trim(), null, {
      defaultQuestionAnswers: mandatoryAnswers,
      prefilledSdf,
      projectId,
      language: project.language,
      selectedModules: requestedModules,
      businessAnswers: convContext?.business_answers || null,
      acknowledgedUnsupportedFeatures,
    });

    // Pre-distributor answer review halted the pipeline. Do NOT save an SDF
    // version, do NOT persist clarifications, do NOT record feature requests
    // for issues the user hasn't acknowledged yet. Just return the review so
    // the frontend can surface feedback.
    if (shouldHaltForAnswerReview(sdf)) {
      if (conversation?.id) {
        await ProjectConversation.updateAnswerReview(conversation.id, sdf.answer_review)
          .catch((err) => logger.error('Failed to persist answer_review on conversation:', err));
      }
      const updatedProject = await projectService.updateProject(projectId, userId, { status: 'Reviewing' });
      return res.json({
        status: 'answer_review_required',
        project: updatedProject,
        answer_review: sdf.answer_review,
        token_usage: sdf?.token_usage || null,
        default_question_answers: mandatoryAnswers,
        prefilled_sdf: prefilledSdf,
      });
    }

    // User just acknowledged unsupported features and resubmitted — record
    // them as feature requests now so they end up in the backlog even though
    // the SDF will be generated without them.
    if (acknowledgedUnsupportedFeatures.length) {
      featureRequestService.recordFeatures({
        userId, projectId, source: 'sdf_generation',
        features: acknowledgedUnsupportedFeatures,
        userPrompt: description.trim(),
      }).catch((e) => logger.warn('Failed to record acknowledged unsupported feature requests:', e.message));
    }

    const rawQuestions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const persistedQuestions = await clarificationService.persistQuestions({
      projectId: project.id,
      questions: rawQuestions,
      cycle: 1,
    });
    if (persistedQuestions.length) {
      sdf = { ...sdf, clarifications_needed: persistedQuestions };
    }
    const saved = await SDF.create(project.id, sdf, { changeKind: 'initial' });

    // Link the pre-build conversation snapshot to the generated SDF version
    if (conversation?.id && saved?.version) {
      await ProjectConversation.updateSdfVersion(conversation.id, saved.version)
        .catch((err) => logger.error('Failed to update conversation sdf_version:', err));
    }

    if (Array.isArray(sdf?.unsupported_features) && sdf.unsupported_features.length > 0) {
      featureRequestService.recordFeatures({
        userId, projectId, source: 'sdf_generation',
        features: sdf.unsupported_features,
        userPrompt: description.trim(),
      }).catch((e) => logger.warn('Failed to record SDF unsupported feature requests:', e.message));
    }

    if (Array.isArray(sdf?.warnings) && sdf.warnings.length > 0) {
      featureRequestService.recordWarnings({ userId, projectId, warnings: sdf.warnings, userPrompt: description.trim() })
        .catch((e) => logger.warn('Failed to record SDF feature requests:', e.message));
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
      language: project.language,
    });
    const mandatoryAnswers = questionnaireState.mandatory_answers || {};

    let sdf = await aiGatewayClient.clarifySdf({
      businessDescription: (typeof description === 'string' && description.trim()) ? description.trim() : (project.description || ''),
      partialSdf,
      answers,
      defaultQuestionAnswers: mandatoryAnswers,
      language: project.language,
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
    const saved = await SDF.create(project.id, sdf, { changeKind: 'clarify' });

    const clarifyPrompt = (typeof description === 'string' && description.trim()) ? description.trim() : (project.description || '');

    if (Array.isArray(sdf?.unsupported_features) && sdf.unsupported_features.length > 0) {
      featureRequestService.recordFeatures({
        userId, projectId, source: 'sdf_generation',
        features: sdf.unsupported_features,
        userPrompt: clarifyPrompt,
      }).catch((e) => logger.warn('Failed to record SDF unsupported feature requests:', e.message));
    }

    if (Array.isArray(sdf?.warnings) && sdf.warnings.length > 0) {
      featureRequestService.recordWarnings({ userId, projectId, warnings: sdf.warnings, userPrompt: clarifyPrompt })
        .catch((e) => logger.warn('Failed to record SDF feature requests:', e.message));
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
      language: project.language,
    });

    if (Array.isArray(chatResponse.unsupported_features) && chatResponse.unsupported_features.length > 0) {
      featureRequestService.recordFeatures({
        userId, projectId, source: 'chatbot',
        features: chatResponse.unsupported_features,
        userPrompt: message.trim(),
      }).catch((e) => logger.warn('Failed to record chatbot feature requests:', e.message));
    }

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

exports.regenerateProject = async (req, res) => {
  let statusBeforeRegenerate = null;
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const changeInstructions = req.body?.change_instructions;
    if (!changeInstructions || typeof changeInstructions !== 'string' || changeInstructions.trim().length < 3) {
      return res.status(400).json({ error: 'change_instructions is required (min 3 chars)' });
    }

    const project = await projectService.getProject(projectId, userId);
    statusBeforeRegenerate = project.status || null;
    const latestSdfRow = await SDF.findLatestByProject(project.id);
    if (!latestSdfRow?.sdf_json) {
      return res.status(400).json({ error: 'No existing SDF found for this project. Generate one first.' });
    }
    const existingSdf = typeof latestSdfRow.sdf_json === 'string' ? JSON.parse(latestSdfRow.sdf_json) : latestSdfRow.sdf_json;
    const acknowledgedUnsupportedFeatures = normalizeAcknowledgedFeatures(req.body);

    const changeReview = await aiGatewayClient.editSdf({
      businessDescription: project.description || '',
      currentSdf: existingSdf,
      instructions: changeInstructions.trim(),
      language: project.language,
      acknowledgedUnsupportedFeatures,
      reviewOnly: true,
    });
    if (changeReview?.status === 'change_review_required') {
      return res.json({
        status: 'change_review_required',
        project,
        answer_review: changeReview.answer_review,
      });
    }

    const requestedModules = parseModulesInput(Object.keys(existingSdf?.modules || {}));
    const questionnaireState = await moduleQuestionnaireService.getQuestionnaireState({
      projectId: project.id,
      modules: requestedModules,
      language: project.language,
    });
    const mandatoryAnswers = questionnaireState.mandatory_answers || {};

    const combinedDescription = (project.description || '').trim() +
      '\n\n--- CHANGE REQUEST ---\n' + changeInstructions.trim();

    await projectService.updateProject(projectId, userId, { status: 'Analyzing' });

    let sdf = await aiGatewayClient.analyzeDescription(combinedDescription, null, {
      defaultQuestionAnswers: mandatoryAnswers,
      prefilledSdf: existingSdf,
      projectId,
      language: project.language,
      selectedModules: requestedModules,
    });

    const rawQuestions = Array.isArray(sdf?.clarifications_needed) ? sdf.clarifications_needed : [];
    const priorCycleCount = await clarificationService.getCycleCount(project.id);
    const currentCycle = priorCycleCount + 1;
    const persistedQuestions = await clarificationService.persistQuestions({
      projectId: project.id,
      questions: rawQuestions,
      cycle: currentCycle,
    });
    if (persistedQuestions.length) {
      sdf = { ...sdf, clarifications_needed: persistedQuestions };
    }
    const saved = await SDF.create(project.id, sdf, { changeKind: 'regenerate' });

    if (Array.isArray(sdf?.unsupported_features) && sdf.unsupported_features.length > 0) {
      featureRequestService.recordFeatures({
        userId, projectId, source: 'sdf_regeneration',
        features: sdf.unsupported_features,
        userPrompt: changeInstructions.trim(),
      }).catch((e) => logger.warn('Failed to record regeneration unsupported features:', e.message));
    }
    if (acknowledgedUnsupportedFeatures.length > 0) {
      featureRequestService.recordFeatures({
        userId, projectId, source: 'sdf_regeneration_request',
        features: acknowledgedUnsupportedFeatures,
        userPrompt: changeInstructions.trim(),
      }).catch((e) => logger.warn('Failed to record acknowledged regeneration features:', e.message));
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
      cycle: currentCycle,
    });
  } catch (err) {
    if (statusBeforeRegenerate && req.params?.id && req.user?.userId) {
      projectService.updateProject(req.params.id, req.user.userId, { status: statusBeforeRegenerate })
        .catch((e) => logger.warn('Failed to restore project status after regeneration error:', e.message));
    }
    logger.error('Regenerate project error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.getGenerationProgress = async (req, res) => {
  try {
    const projectId = req.params.id;
    const progress = await aiGatewayClient.getGenerationProgress(projectId);
    res.json(progress);
  } catch (err) {
    logger.error('Get generation progress error:', err);
    res.json({ step: 'idle', pct: 0 });
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
