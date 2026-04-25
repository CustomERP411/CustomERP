/**
 * UC-12.1 Review Training Sessions — save/sync unit tests
 *
 * Covers TC-UC12.1-004 through TC-UC12.1-009.
 * SUT: platform/backend/src/services/trainingService.js
 *
 * saveReview / saveStepReview upsert into their respective review
 * tables. saveStepReview additionally triggers syncSessionReview,
 * whose aggregation rule is:
 *    any 'bad' step          → session = 'bad'
 *    any 'needs_edit' step   → session = 'needs_edit'
 *    all 'good'              → session = 'good'
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../../platform/backend/src/config/database');
const training = require(
  '../../../../platform/backend/src/services/trainingService',
);

beforeEach(() => {
  db.query.mockReset();
});

describe('UC-12.1 / trainingService.saveReview', () => {
  // TC-UC12.1-004
  test('upserts into training_reviews via ON CONFLICT DO UPDATE', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ session_id: 's-1', quality: 'good' }],
    });

    await training.saveReview('s-1', { quality: 'good', notes: 'nice' });

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/INSERT\s+INTO\s+training_reviews/i);
    expect(sql).toMatch(/ON CONFLICT\s*\(\s*session_id\s*\)\s+DO UPDATE/i);
    // Positional parameters: sessionId, quality, notes, correctiveInstruction (null),
    // editedOutput serialized (null when not provided).
    expect(params).toEqual(['s-1', 'good', 'nice', null, null]);
  });

  // TC-UC12.1-005
  test('serializes editedOutput to a JSON string before persistence', async () => {
    db.query.mockResolvedValueOnce({ rows: [{}] });

    await training.saveReview('s-1', {
      quality: 'needs_edit',
      editedOutput: { project_name: 'X' },
    });

    const [, params] = db.query.mock.calls[0];
    // 5th positional parameter is the serialized edited output.
    expect(params[4]).toBe('{"project_name":"X"}');
  });
});

describe('UC-12.1 / trainingService.saveStepReview + syncSessionReview', () => {
  function primeSteps(qualities) {
    // Sequence of DB calls inside saveStepReview:
    //   1. INSERT INTO training_step_reviews ... RETURNING *
    //   2. SELECT quality FROM training_step_reviews  (syncSessionReview)
    //   3. UPSERT INTO training_reviews
    db.query
      .mockResolvedValueOnce({ rows: [{ session_id: 's-1', agent: 'hr_generator' }] })
      .mockResolvedValueOnce({ rows: qualities.map((q) => ({ quality: q })) })
      .mockResolvedValueOnce({ rows: [] });
  }

  // TC-UC12.1-006
  test('saveStepReview triggers a syncSessionReview aggregation write', async () => {
    primeSteps(['good']);

    await training.saveStepReview('s-1', 'hr_generator', { quality: 'good' });

    expect(db.query).toHaveBeenCalledTimes(3);

    const [sql1] = db.query.mock.calls[0];
    expect(sql1).toMatch(/INSERT\s+INTO\s+training_step_reviews/i);

    const [sql2, params2] = db.query.mock.calls[1];
    expect(sql2).toMatch(/SELECT\s+quality\s+FROM\s+training_step_reviews/i);
    expect(params2).toEqual(['s-1']);

    const [sql3] = db.query.mock.calls[2];
    expect(sql3).toMatch(/INSERT\s+INTO\s+training_reviews/i);
    expect(sql3).toMatch(/ON CONFLICT\s*\(\s*session_id\s*\)/i);
  });

  // TC-UC12.1-007
  test("aggregate rule: any 'bad' step → session quality is 'bad'", async () => {
    primeSteps(['good', 'good', 'bad', 'good']);

    await training.saveStepReview('s-1', 'hr_generator', { quality: 'bad' });

    const [, params3] = db.query.mock.calls[2];
    expect(params3).toEqual(['s-1', 'bad']);
  });

  // TC-UC12.1-008
  test("aggregate rule: no bad + any 'needs_edit' → 'needs_edit'", async () => {
    primeSteps(['good', 'needs_edit', 'good']);

    await training.saveStepReview('s-1', 'hr_generator', { quality: 'needs_edit' });

    const [, params3] = db.query.mock.calls[2];
    expect(params3).toEqual(['s-1', 'needs_edit']);
  });

  // TC-UC12.1-009
  test("aggregate rule: all 'good' → 'good'", async () => {
    primeSteps(['good', 'good', 'good']);

    await training.saveStepReview('s-1', 'hr_generator', { quality: 'good' });

    const [, params3] = db.query.mock.calls[2];
    expect(params3).toEqual(['s-1', 'good']);
  });
});
