const { v4: uuidv4 } = require('uuid');

const Answer = require('../models/Answer');
const Question = require('../models/Question');

const VALID_QUESTION_TYPES = new Set(['yes_no', 'choice', 'text']);

function normalizeQuestionType(type) {
  return VALID_QUESTION_TYPES.has(type) ? type : 'text';
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return null;
  const cleaned = options
    .map(option => String(option).trim())
    .filter(option => option.length > 0);
  return cleaned.length ? cleaned : null;
}

function normalizeQuestion(question, index, projectId) {
  const questionText = typeof question?.question === 'string' ? question.question.trim() : '';
  const questionType = normalizeQuestionType(question?.type);
  const options = normalizeOptions(question?.options);
  const questionId = uuidv4();

  return {
    dbRow: {
      questionId,
      projectId,
      questionText,
      questionType,
      options,
      orderIndex: index,
    },
    apiQuestion: {
      id: questionId,
      question: questionText,
      type: questionType,
      ...(options ? { options } : {}),
    },
  };
}

function normalizeAnswer(answer, projectId) {
  const questionId = typeof answer?.question_id === 'string'
    ? answer.question_id
    : (typeof answer?.questionId === 'string' ? answer.questionId : '');
  const answerText = typeof answer?.answer === 'string'
    ? answer.answer.trim()
    : (typeof answer?.answer_text === 'string' ? answer.answer_text.trim() : '');

  if (!questionId || !answerText) return null;

  return {
    projectId,
    questionId,
    answerText,
  };
}

async function persistQuestions({ projectId, questions }) {
  const list = Array.isArray(questions) ? questions : [];
  if (!projectId) throw new Error('projectId is required');
  if (list.length === 0) return [];

  const normalized = list.map((question, index) => normalizeQuestion(question, index, projectId));
  await Question.createMany(normalized.map(entry => entry.dbRow));

  return normalized.map(entry => entry.apiQuestion);
}

async function persistAnswers({ projectId, answers }) {
  const list = Array.isArray(answers) ? answers : [];
  if (!projectId) throw new Error('projectId is required');
  if (list.length === 0) return [];

  const normalized = list
    .map(answer => normalizeAnswer(answer, projectId))
    .filter(Boolean);

  if (normalized.length === 0) return [];

  return Answer.createMany(normalized);
}

module.exports = {
  persistQuestions,
  persistAnswers,
};
