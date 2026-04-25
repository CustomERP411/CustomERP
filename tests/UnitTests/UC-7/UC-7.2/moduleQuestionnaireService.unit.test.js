/**
 * UC-7.2 Answer Module Questionnaire — unit tests
 *
 * Covers TC-UC7.2-003 through TC-UC7.2-008.
 *
 * SUT: platform/backend/src/services/moduleQuestionnaireService.js
 *
 * Scope:
 *   - Conditional visibility (`op: 'all'` vs `'any'`).
 *   - Answer serialization rules per question type:
 *       * multi_choice → JSON array string
 *       * boolean → 'yes' / 'no'
 *   - `completion.is_complete` logic — whitespace-only answers count
 *     as unanswered.
 *
 * Mocking strategy:
 *   - moduleQuestionRegistry : we control the template payload.
 *   - Question (model)       : returns a fixed row set; `createMany` is
 *                              inert (no-op) since we pre-seed the
 *                              "existing" rows.
 *   - Answer (model)         : `findLatestByProjectAndQuestionIds` is
 *                              controlled, `createMany` is a spy.
 *   - uuid                   : already stubbed globally via
 *                              jest.config moduleNameMapper.
 */

jest.mock(
  '../../../../platform/backend/src/services/moduleQuestionRegistry',
  () => ({
    getQuestionTemplatePayload: jest.fn(),
  }),
);
jest.mock('../../../../platform/backend/src/models/Question', () => ({
  findDefaultByProjectAndModules: jest.fn(),
  createMany: jest.fn(),
}));
jest.mock('../../../../platform/backend/src/models/Answer', () => ({
  findLatestByProjectAndQuestionIds: jest.fn(),
  createMany: jest.fn(),
}));

const moduleRegistry = require(
  '../../../../platform/backend/src/services/moduleQuestionRegistry',
);
const Question = require('../../../../platform/backend/src/models/Question');
const Answer = require('../../../../platform/backend/src/models/Answer');
const svc = require(
  '../../../../platform/backend/src/services/moduleQuestionnaireService',
);

/**
 * Helper that produces the row shape returned by `Question.findDefaultByProjectAndModules`.
 * Rows store `options` that includes the template metadata (source, module, version, key, ...).
 */
function row({
  id,
  key,
  module = 'inventory',
  version = 'v1',
  type = 'text',
  required = true,
  condition = null,
  section = 'General',
  order = 0,
  prompt = `Prompt for ${key}`,
  choices = [],
}) {
  return {
    id,
    question: prompt,
    type,
    order_index: order,
    options: {
      source: 'default_module_question',
      module,
      version,
      key,
      type,
      required,
      allow_custom: false,
      choices,
      condition,
      section,
      sdf_mapping: null,
      template_id: `${module}::${version}::${key}`,
    },
  };
}

function templatePayload(questions, { language = 'en' } = {}) {
  const versionsByModule = {};
  for (const q of questions) {
    versionsByModule[q.options.module] = { version: q.options.version };
  }
  return {
    language,
    template_versions: versionsByModule,
    questions: questions.map((q) => ({
      id: q.options.template_id,
      module: q.options.module,
      version: q.options.version,
      key: q.options.key,
      prompt: q.question,
      type: q.type,
      required: q.options.required,
      allow_custom: q.options.allow_custom,
      options: q.options.choices,
      condition: q.options.condition,
      section: q.options.section,
      sdf_mapping: q.options.sdf_mapping,
      order_index: q.order_index,
    })),
  };
}

beforeEach(() => {
  moduleRegistry.getQuestionTemplatePayload.mockReset();
  Question.findDefaultByProjectAndModules.mockReset();
  Question.createMany.mockReset().mockResolvedValue([]);
  Answer.findLatestByProjectAndQuestionIds.mockReset();
  Answer.createMany.mockReset().mockResolvedValue(undefined);
});

describe('UC-7.2 / moduleQuestionnaireService.getQuestionnaireState — visibility', () => {
  // TC-UC7.2-003
  test("TC-UC7.2-003 — condition op 'all' requires every rule to match", async () => {
    const r1 = row({
      id: 'q-pick-batch',
      key: 'inv_batch_tracking',
      type: 'single_choice',
      required: true,
      choices: ['yes', 'no'],
    });
    const r2 = row({
      id: 'q-pick-loc',
      key: 'inv_multi_location',
      type: 'single_choice',
      required: true,
      choices: ['yes', 'no'],
    });
    const rGated = row({
      id: 'q-gated',
      key: 'inv_batch_location_extra',
      type: 'text',
      required: true,
      condition: {
        op: 'all',
        rules: [
          { question_key: 'inv_batch_tracking', equals: 'yes' },
          { question_key: 'inv_multi_location', equals: 'yes' },
        ],
      },
    });

    moduleRegistry.getQuestionTemplatePayload.mockReturnValue(
      templatePayload([r1, r2, rGated]),
    );
    Question.findDefaultByProjectAndModules.mockResolvedValue([r1, r2, rGated]);

    // Case A: only one rule matches.
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValueOnce([
      { question_id: 'q-pick-batch', answer: 'yes' },
      { question_id: 'q-pick-loc', answer: 'no' },
    ]);
    const a = await svc.getQuestionnaireState({
      projectId: 'p-1',
      modules: ['inventory'],
    });
    expect(a.questions.find((q) => q.id === 'q-gated').visible).toBe(false);

    // Case B: both rules match.
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValueOnce([
      { question_id: 'q-pick-batch', answer: 'yes' },
      { question_id: 'q-pick-loc', answer: 'yes' },
    ]);
    const b = await svc.getQuestionnaireState({
      projectId: 'p-1',
      modules: ['inventory'],
    });
    expect(b.questions.find((q) => q.id === 'q-gated').visible).toBe(true);
  });

  // TC-UC7.2-004
  test("TC-UC7.2-004 — condition op 'any' is satisfied when a single rule matches", async () => {
    const r1 = row({ id: 'q-A', key: 'feat_A', type: 'single_choice', required: true, choices: ['yes', 'no'] });
    const r2 = row({ id: 'q-B', key: 'feat_B', type: 'single_choice', required: true, choices: ['yes', 'no'] });
    const rGated = row({
      id: 'q-gated',
      key: 'needs_either',
      type: 'text',
      required: true,
      condition: {
        op: 'any',
        rules: [
          { question_key: 'feat_A', equals: 'yes' },
          { question_key: 'feat_B', equals: 'yes' },
        ],
      },
    });
    moduleRegistry.getQuestionTemplatePayload.mockReturnValue(
      templatePayload([r1, r2, rGated]),
    );
    Question.findDefaultByProjectAndModules.mockResolvedValue([r1, r2, rGated]);
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValueOnce([
      { question_id: 'q-A', answer: 'no' },
      { question_id: 'q-B', answer: 'yes' },
    ]);

    const state = await svc.getQuestionnaireState({
      projectId: 'p-1',
      modules: ['inventory'],
    });
    expect(state.questions.find((q) => q.id === 'q-gated').visible).toBe(true);
  });
});

describe('UC-7.2 / moduleQuestionnaireService.saveQuestionnaireAnswers — serialization', () => {
  // TC-UC7.2-005
  test('TC-UC7.2-005 — multi_choice answers are persisted as a JSON array string', async () => {
    const r = row({
      id: 'q-mc',
      key: 'inv_channels',
      type: 'multi_choice',
      required: true,
      choices: ['A', 'B', 'C'],
    });
    moduleRegistry.getQuestionTemplatePayload.mockReturnValue(templatePayload([r]));
    Question.findDefaultByProjectAndModules.mockResolvedValue([r]);
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValue([]);

    await svc.saveQuestionnaireAnswers({
      projectId: 'p-1',
      modules: ['inventory'],
      answers: [{ question_id: 'q-mc', answer: ['A', 'B'] }],
    });

    expect(Answer.createMany).toHaveBeenCalledTimes(1);
    const persisted = Answer.createMany.mock.calls[0][0];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].answerText).toBe('["A","B"]');
  });

  // TC-UC7.2-006
  test("TC-UC7.2-006 — boolean true/false values are serialized as 'yes' / 'no'", async () => {
    const r = row({
      id: 'q-bool',
      key: 'inv_has_cost_tracking',
      type: 'single_choice',
      required: true,
      choices: ['yes', 'no'],
    });
    moduleRegistry.getQuestionTemplatePayload.mockReturnValue(templatePayload([r]));
    Question.findDefaultByProjectAndModules.mockResolvedValue([r]);
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValue([]);

    await svc.saveQuestionnaireAnswers({
      projectId: 'p-1',
      modules: ['inventory'],
      answers: [{ question_id: 'q-bool', answer: true }],
    });
    expect(Answer.createMany.mock.calls[0][0][0].answerText).toBe('yes');

    Answer.createMany.mockClear();
    await svc.saveQuestionnaireAnswers({
      projectId: 'p-1',
      modules: ['inventory'],
      answers: [{ question_id: 'q-bool', answer: false }],
    });
    expect(Answer.createMany.mock.calls[0][0][0].answerText).toBe('no');
  });
});

describe('UC-7.2 / moduleQuestionnaireService.getQuestionnaireState — completion', () => {
  // TC-UC7.2-007
  test('TC-UC7.2-007 — is_complete is false when a required visible question has no answer', async () => {
    const r1 = row({ id: 'q-1', key: 'k1', required: true });
    const r2 = row({ id: 'q-2', key: 'k2', required: true });
    moduleRegistry.getQuestionTemplatePayload.mockReturnValue(templatePayload([r1, r2]));
    Question.findDefaultByProjectAndModules.mockResolvedValue([r1, r2]);
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValue([
      { question_id: 'q-1', answer: 'filled in' },
    ]);

    const state = await svc.getQuestionnaireState({
      projectId: 'p-1',
      modules: ['inventory'],
    });

    expect(state.completion.is_complete).toBe(false);
    expect(state.completion.missing_required_question_ids).toEqual(['q-2']);
    expect(state.completion.missing_required_question_keys).toEqual(['k2']);
  });

  // TC-UC7.2-008
  test("TC-UC7.2-008 — whitespace-only answers count as unanswered", async () => {
    const r = row({ id: 'q-1', key: 'k1', required: true, type: 'text' });
    moduleRegistry.getQuestionTemplatePayload.mockReturnValue(templatePayload([r]));
    Question.findDefaultByProjectAndModules.mockResolvedValue([r]);
    Answer.findLatestByProjectAndQuestionIds.mockResolvedValue([
      { question_id: 'q-1', answer: '   ' },
    ]);

    const state = await svc.getQuestionnaireState({
      projectId: 'p-1',
      modules: ['inventory'],
    });

    const q = state.questions.find((x) => x.id === 'q-1');
    expect(q.answered).toBe(false);
    expect(state.completion.is_complete).toBe(false);
  });
});
