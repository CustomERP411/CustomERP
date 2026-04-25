const logger = require('../utils/logger');
const { normalizeLanguage, DEFAULT_LANGUAGE } = require('./authService');

const DEFAULT_BASE_URL = 'http://localhost:8000';
const BASE_URL = (process.env.AI_GATEWAY_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

function resolveLanguage(options) {
  // Accept either `options.language` or `options.projectLanguage`.
  const raw = options && (options.language || options.projectLanguage);
  return normalizeLanguage(raw || DEFAULT_LANGUAGE);
}

async function postJson(path, body) {
  const url = `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = typeof data === 'object' && data ? (data.detail || data.error || JSON.stringify(data)) : String(data || '');
    const err = new Error(detail || `AI Gateway error (${res.status})`);
    err.statusCode = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

async function analyzeDescription(description, priorContext = null, options = {}) {
  if (!description || typeof description !== 'string') throw new Error('description must be a string');
  const selectedModules = Array.isArray(options.selectedModules)
    ? options.selectedModules.filter((m) => typeof m === 'string' && m.trim()).map((m) => m.trim())
    : [];
  const acknowledgedUnsupportedFeatures = Array.isArray(options.acknowledgedUnsupportedFeatures)
    ? options.acknowledgedUnsupportedFeatures
        .filter((f) => typeof f === 'string' && f.trim())
        .map((f) => f.trim())
    : [];
  return await postJson('/ai/analyze', {
    description,
    prior_context: priorContext,
    language: resolveLanguage(options),
    ...(options.defaultQuestionAnswers && typeof options.defaultQuestionAnswers === 'object'
      ? { default_question_answers: options.defaultQuestionAnswers }
      : {}),
    ...(options.prefilledSdf && typeof options.prefilledSdf === 'object'
      ? { prefilled_sdf: options.prefilledSdf }
      : {}),
    ...(options.projectId ? { project_id: options.projectId } : {}),
    ...(selectedModules.length ? { selected_modules: selectedModules } : {}),
    ...(options.businessAnswers && typeof options.businessAnswers === 'object'
      ? { business_answers: options.businessAnswers }
      : {}),
    ...(acknowledgedUnsupportedFeatures.length
      ? { acknowledged_unsupported_features: acknowledgedUnsupportedFeatures }
      : {}),
  });
}

async function getGenerationProgress(projectId) {
  const url = `${BASE_URL}/ai/progress/${encodeURIComponent(projectId)}`;
  const res = await fetch(url);
  const text = await res.text();
  try { return text ? JSON.parse(text) : { step: 'idle', pct: 0 }; }
  catch { return { step: 'idle', pct: 0 }; }
}

async function clarifySdf({ businessDescription, partialSdf, answers, defaultQuestionAnswers, language }) {
  return await postJson('/ai/clarify', {
    business_description: businessDescription,
    partial_sdf: partialSdf,
    answers: Array.isArray(answers) ? answers : [],
    language: resolveLanguage({ language }),
    ...(defaultQuestionAnswers && typeof defaultQuestionAnswers === 'object'
      ? { default_question_answers: defaultQuestionAnswers }
      : {}),
  });
}

async function finalizeSdf(sdf, options = {}) {
  const payload = sdf && typeof sdf === 'object' ? { ...sdf } : {};
  payload.language = resolveLanguage(options);
  return await postJson('/ai/finalize', payload);
}

async function editSdf({ businessDescription, currentSdf, instructions, language }) {
  if (!instructions || typeof instructions !== 'string') throw new Error('instructions must be a string');
  if (!currentSdf || typeof currentSdf !== 'object') throw new Error('currentSdf must be an object');
  return await postJson('/ai/edit', {
    business_description: businessDescription,
    current_sdf: currentSdf,
    instructions,
    language: resolveLanguage({ language }),
  });
}

async function chat({ businessDescription, message, conversationHistory, selectedModules, businessAnswers, currentStep, sdfStatus, language }) {
  if (!message || typeof message !== 'string') throw new Error('message must be a string');
  return await postJson('/ai/chat', {
    business_description: businessDescription || '',
    message,
    conversation_history: Array.isArray(conversationHistory) ? conversationHistory : [],
    selected_modules: Array.isArray(selectedModules) ? selectedModules : [],
    business_answers: businessAnswers && typeof businessAnswers === 'object' ? businessAnswers : null,
    current_step: currentStep || null,
    sdf_status: sdfStatus || null,
    language: resolveLanguage({ language }),
  });
}

module.exports = {
  analyzeDescription,
  clarifySdf,
  finalizeSdf,
  editSdf,
  chat,
  getGenerationProgress,
  BASE_URL,
};
