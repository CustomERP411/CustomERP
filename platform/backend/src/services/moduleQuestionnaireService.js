const { v4: uuidv4 } = require('uuid');

const Answer = require('../models/Answer');
const Question = require('../models/Question');
const moduleQuestionRegistry = require('./moduleQuestionRegistry');

const DEFAULT_QUESTION_SOURCE = 'default_module_question';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEmptyAnswer(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value === null || value === undefined) return true;
  return String(value).trim().length === 0;
}

function normalizeComparable(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

function serializeAnswer(value, questionType) {
  if (questionType === 'multi_choice') {
    const list = Array.isArray(value)
      ? value
      : String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    return JSON.stringify(list);
  }

  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function parseAnswer(answerText, questionType) {
  if (questionType === 'multi_choice') {
    try {
      const parsed = JSON.parse(answerText);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return String(answerText || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [];
  }
  return String(answerText || '');
}

function evaluateCondition(condition, answersByKey) {
  if (!isPlainObject(condition) || !Array.isArray(condition.rules) || !condition.rules.length) {
    return true;
  }

  const checks = condition.rules.map((rule) => {
    const actual = answersByKey[rule.question_key];
    const expected = normalizeComparable(rule.equals);
    if (Array.isArray(actual)) {
      return actual.map((item) => normalizeComparable(item)).includes(expected);
    }
    return normalizeComparable(actual) === expected;
  });

  if (condition.op === 'any') {
    return checks.some(Boolean);
  }
  return checks.every(Boolean);
}

function normalizeIncomingAnswers(rawAnswers) {
  if (Array.isArray(rawAnswers)) {
    return rawAnswers
      .map((entry) => {
        const questionId = entry?.question_id || entry?.questionId || null;
        const questionKey = entry?.question_key || entry?.questionKey || null;
        const answer = entry?.answer ?? entry?.value ?? entry?.answer_text;
        return {
          question_id: questionId ? String(questionId).trim() : '',
          question_key: questionKey ? String(questionKey).trim() : '',
          answer,
        };
      })
      .filter((entry) => entry.question_id || entry.question_key);
  }

  if (isPlainObject(rawAnswers)) {
    return Object.entries(rawAnswers).map(([key, value]) => ({
      question_id: String(key).trim(),
      question_key: '',
      answer: value,
    }));
  }

  return [];
}

function extractQuestionMetadata(row) {
  const raw = row?.options;
  if (!isPlainObject(raw)) return null;
  if (raw.source !== DEFAULT_QUESTION_SOURCE) return null;
  if (!raw.module || !raw.version || !raw.key) return null;
  return raw;
}

function toApiQuestion(row, metadata) {
  const options = Array.isArray(metadata.choices) ? metadata.choices : [];
  return {
    id: row.id,
    key: metadata.key,
    module: metadata.module,
    version: metadata.version,
    question: row.question,
    type: row.type || metadata.type || 'text',
    required: metadata.required !== false,
    allow_custom: metadata.allow_custom === true,
    options,
    condition: metadata.condition || null,
    section: metadata.section || 'General',
    order_index: typeof row.order_index === 'number' ? row.order_index : 0,
    sdf_mapping: metadata.sdf_mapping || null,
  };
}

async function ensureDefaultQuestionsForProject({ projectId, modules }) {
  if (!projectId) throw new Error('projectId is required');

  const templatePayload = moduleQuestionRegistry.getQuestionTemplatePayload(modules);
  const requestedModules = Object.keys(templatePayload.template_versions || {});

  const existingRows = await Question.findDefaultByProjectAndModules(projectId, requestedModules);
  const existingByComposite = new Map();
  for (const row of existingRows) {
    const metadata = extractQuestionMetadata(row);
    if (!metadata) continue;
    const key = `${metadata.module}::${metadata.version}::${metadata.key}`;
    if (!existingByComposite.has(key)) {
      existingByComposite.set(key, row);
    }
  }

  const toCreate = [];
  for (const templateQuestion of templatePayload.questions) {
    const composite = `${templateQuestion.module}::${templateQuestion.version}::${templateQuestion.key}`;
    if (existingByComposite.has(composite)) continue;

    toCreate.push({
      questionId: uuidv4(),
      projectId,
      questionText: templateQuestion.prompt,
      questionType: templateQuestion.type,
      options: {
        source: DEFAULT_QUESTION_SOURCE,
        module: templateQuestion.module,
        version: templateQuestion.version,
        key: templateQuestion.key,
        type: templateQuestion.type,
        required: templateQuestion.required !== false,
        allow_custom: templateQuestion.allow_custom === true,
        choices: Array.isArray(templateQuestion.options) ? templateQuestion.options : [],
        condition: templateQuestion.condition || null,
        section: templateQuestion.section || 'General',
        sdf_mapping: templateQuestion.sdf_mapping || null,
        template_id: templateQuestion.id,
      },
      orderIndex: templateQuestion.order_index,
    });
  }

  if (toCreate.length) {
    await Question.createMany(toCreate);
  }

  const refreshedRows = await Question.findDefaultByProjectAndModules(projectId, requestedModules);
  const activeVersionByModule = Object.fromEntries(
    Object.entries(templatePayload.template_versions || {}).map(([moduleKey, meta]) => [moduleKey, meta.version])
  );

  const normalizedQuestions = refreshedRows
    .map((row) => {
      const metadata = extractQuestionMetadata(row);
      if (!metadata) return null;
      if (activeVersionByModule[metadata.module] !== metadata.version) return null;
      return toApiQuestion(row, metadata);
    })
    .filter(Boolean)
    .sort((a, b) => a.order_index - b.order_index);

  return {
    modules: requestedModules,
    template_versions: templatePayload.template_versions,
    questions: normalizedQuestions,
  };
}

async function getQuestionnaireState({ projectId, modules }) {
  const ensured = await ensureDefaultQuestionsForProject({ projectId, modules });
  const questionIds = ensured.questions.map((question) => question.id);
  const latestAnswers = await Answer.findLatestByProjectAndQuestionIds(projectId, questionIds);
  const latestAnswerByQuestionId = Object.fromEntries(
    latestAnswers.map((answerRow) => [answerRow.question_id, answerRow.answer])
  );

  const answersByKey = {};
  const questions = ensured.questions.map((question) => {
    const storedAnswer = latestAnswerByQuestionId[question.id];
    const parsedAnswer = parseAnswer(storedAnswer, question.type);
    answersByKey[question.key] = parsedAnswer;
    return {
      ...question,
      answer: parsedAnswer,
    };
  });

  const withVisibility = questions.map((question) => {
    const visible = evaluateCondition(question.condition, answersByKey);
    const answered = !isEmptyAnswer(question.answer);
    return {
      ...question,
      visible,
      answered,
      required_missing: visible && question.required && !answered,
    };
  });

  const requiredVisible = withVisibility.filter((question) => question.visible && question.required);
  const answeredRequiredVisible = requiredVisible.filter((question) => question.answered);

  return {
    modules: ensured.modules,
    template_versions: ensured.template_versions,
    questions: withVisibility,
    completion: {
      total_required_visible: requiredVisible.length,
      answered_required_visible: answeredRequiredVisible.length,
      is_complete: requiredVisible.length === answeredRequiredVisible.length,
      missing_required_question_ids: requiredVisible
        .filter((question) => !question.answered)
        .map((question) => question.id),
      missing_required_question_keys: requiredVisible
        .filter((question) => !question.answered)
        .map((question) => question.key),
    },
    mandatory_answers: Object.fromEntries(
      withVisibility
        .filter((question) => question.visible && !isEmptyAnswer(question.answer))
        .map((question) => [question.key, question.answer])
    ),
  };
}

async function saveQuestionnaireAnswers({ projectId, modules, answers }) {
  if (!projectId) throw new Error('projectId is required');
  const state = await getQuestionnaireState({ projectId, modules });
  const questionsById = Object.fromEntries(state.questions.map((question) => [question.id, question]));
  const questionsByKey = Object.fromEntries(state.questions.map((question) => [question.key, question]));
  const normalized = normalizeIncomingAnswers(answers);

  const rowsToInsert = [];
  for (const entry of normalized) {
    const question = entry.question_id
      ? questionsById[entry.question_id]
      : questionsByKey[entry.question_key];

    if (!question) continue;
    if (isEmptyAnswer(entry.answer)) continue;
    const serialized = serializeAnswer(entry.answer, question.type);
    if (!serialized) continue;

    rowsToInsert.push({
      projectId,
      questionId: question.id,
      answerText: serialized,
    });
  }

  if (rowsToInsert.length) {
    await Answer.createMany(rowsToInsert);
  }

  return getQuestionnaireState({ projectId, modules: state.modules });
}

module.exports = {
  ensureDefaultQuestionsForProject,
  getQuestionnaireState,
  saveQuestionnaireAnswers,
};
