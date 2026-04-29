/**
 * UC-7.5 / Plan C — moduleQuestionnaireService coercion tests.
 *
 * SUT: platform/backend/src/services/moduleQuestionnaireService.js
 *
 * Cases:
 *   1. saveQuestionnaireAnswers returns coerced[] populated with question_id when the
 *      dependency graph promotes upstream (forward auto-enable).
 *   2. saveQuestionnaireAnswers cascades downstream off when upstream is explicit no.
 *   3. getQuestionnaireState returns dependency_graph with the expected shape.
 *   4. evaluateCondition (indirectly) recognises the INVOICE_MODULE / INVENTORY_MODULE
 *      pseudo-rule and hides invoice_stock_link unless both modules are present.
 *
 * Models are mocked with an in-memory fake so the test runs without a DB.
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SVC_PATH = path.join(REPO_ROOT, 'platform/backend/src/services/moduleQuestionnaireService.js');

// In-memory tables. Exposed on globalThis so the jest.mock factories (hoisted
// to the top of the file by jest) can read/write them without referencing
// not-yet-initialised consts.
globalThis.__planC_state = { questions: [], answers: [] };
const _state = globalThis.__planC_state;

jest.mock('../../../../platform/backend/src/models/Question.js', () => ({
  async findDefaultByProjectAndModules(projectId, moduleKeys) {
    const s = globalThis.__planC_state;
    return s.questions
      .filter((q) => q.project_id === projectId && moduleKeys.includes(q.options?.module))
      .map((q) => ({ ...q }));
  },
  async createMany(rows) {
    const s = globalThis.__planC_state;
    for (const row of rows) {
      s.questions.push({
        id: row.questionId,
        project_id: row.projectId,
        question: row.questionText,
        type: row.questionType,
        options: row.options,
        order_index: row.orderIndex || 0,
      });
    }
  },
}));

jest.mock('../../../../platform/backend/src/models/Answer.js', () => ({
  async findLatestByProjectAndQuestionIds(projectId, questionIds) {
    const s = globalThis.__planC_state;
    const byQid = new Map();
    for (const a of s.answers) {
      if (a.project_id !== projectId) continue;
      if (!questionIds.includes(a.question_id)) continue;
      const prev = byQid.get(a.question_id);
      if (!prev || a._seq > prev._seq) byQid.set(a.question_id, a);
    }
    return [...byQid.values()].map((a) => ({ ...a }));
  },
  async createMany(rows) {
    const s = globalThis.__planC_state;
    for (const row of rows) {
      s.answers.push({
        id: `a-${s.answers.length + 1}`,
        project_id: row.projectId,
        question_id: row.questionId,
        answer: row.answerText,
        _seq: s.answers.length + 1,
      });
    }
  },
}));

const svc = require(SVC_PATH);

describe('Plan C — moduleQuestionnaireService coercion', () => {
  beforeEach(() => {
    _state.questions.length = 0;
    _state.answers.length = 0;
  });

  test('1. forward auto-enable: turning approvals on flips leave_engine on; coerced[] populated', async () => {
    const state = await svc.getQuestionnaireState({
      projectId: 'p1',
      modules: ['hr'],
      language: 'en',
    });
    const approvals = state.questions.find((q) => q.key === 'hr_enable_leave_approvals');
    const engine = state.questions.find((q) => q.key === 'hr_enable_leave_engine');
    expect(approvals).toBeTruthy();
    expect(engine).toBeTruthy();

    const after = await svc.saveQuestionnaireAnswers({
      projectId: 'p1',
      modules: ['hr'],
      answers: [{ question_id: approvals.id, answer: 'yes' }],
      language: 'en',
    });

    expect(after.coerced).toBeDefined();
    expect(after.coerced.length).toBeGreaterThan(0);
    const event = after.coerced.find((c) => c.key === 'hr_enable_leave_engine' && c.direction === 'auto_enable');
    expect(event).toBeTruthy();
    expect(event.question_id).toBe(engine.id);

    // The state's stored answer for leave_engine should now be 'yes'.
    const refreshed = await svc.getQuestionnaireState({ projectId: 'p1', modules: ['hr'], language: 'en' });
    const engineAfter = refreshed.questions.find((q) => q.key === 'hr_enable_leave_engine');
    expect(engineAfter.answer).toBe('yes');
  });

  test('2. cascade-off: upstream no flips downstream off when downstream was yes', async () => {
    const state = await svc.getQuestionnaireState({ projectId: 'p2', modules: ['hr'], language: 'en' });
    const engine = state.questions.find((q) => q.key === 'hr_enable_leave_engine');
    const approvals = state.questions.find((q) => q.key === 'hr_enable_leave_approvals');

    // First, set both yes (with auto-enable on engine).
    await svc.saveQuestionnaireAnswers({
      projectId: 'p2',
      modules: ['hr'],
      answers: [{ question_id: approvals.id, answer: 'yes' }],
      language: 'en',
    });

    // Now toggle leave_engine to 'no' explicitly.
    const after = await svc.saveQuestionnaireAnswers({
      projectId: 'p2',
      modules: ['hr'],
      answers: [{ question_id: engine.id, answer: 'no' }],
      language: 'en',
    });

    const event = after.coerced.find((c) => c.key === 'hr_enable_leave_approvals' && c.direction === 'cascade_off');
    expect(event).toBeTruthy();
    const approvalsAfter = after.questions.find((q) => q.key === 'hr_enable_leave_approvals');
    expect(approvalsAfter.answer).toBe('no');
  });

  test('3. getQuestionnaireState returns a well-shaped dependency_graph', async () => {
    const state = await svc.getQuestionnaireState({ projectId: 'p3', modules: ['hr'], language: 'en' });
    expect(state.dependency_graph).toBeDefined();
    expect(Array.isArray(state.dependency_graph.hard_requires)).toBe(true);
    expect(Array.isArray(state.dependency_graph.link_toggles)).toBe(true);
    expect(state.dependency_graph.module_presence_keys).toEqual(
      expect.objectContaining({ HR_MODULE: 'hr', INVOICE_MODULE: 'invoice', INVENTORY_MODULE: 'inventory' }),
    );
  });

  test('4. invoice_stock_link is hidden unless both invoice + inventory modules are selected', async () => {
    const onlyInvoice = await svc.getQuestionnaireState({ projectId: 'p4a', modules: ['invoice'], language: 'en' });
    const stockLink = onlyInvoice.questions.find((q) => q.key === 'invoice_stock_link');
    expect(stockLink).toBeTruthy();
    expect(stockLink.visible).toBe(false);

    const both = await svc.getQuestionnaireState({ projectId: 'p4b', modules: ['invoice', 'inventory'], language: 'en' });
    const stockLinkBoth = both.questions.find((q) => q.key === 'invoice_stock_link');
    expect(stockLinkBoth).toBeTruthy();
    expect(stockLinkBoth.visible).toBe(true);
  });
});
