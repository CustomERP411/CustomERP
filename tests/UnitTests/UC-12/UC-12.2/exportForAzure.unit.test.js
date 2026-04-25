/**
 * UC-12.2 Export Training Data — unit tests
 *
 * Covers TC-UC12.2-002 through TC-UC12.2-004.
 * SUT: platform/backend/src/services/trainingService.js (exportForAzure)
 *
 * exportForAzure is the most stateful operation in the training
 * service. Call flow:
 *   1. GET /ai/training/sessions?limit=10000  (gateway, via fetch)
 *   2. SELECT ... FROM training_reviews WHERE quality = ANY($1)
 *   3. SELECT ... FROM training_step_reviews WHERE quality = ANY($1)
 *   4. GET /ai/training/sessions/:id           (per eligible session)
 *   5. UPDATE training_reviews SET is_exported = TRUE WHERE session_id = ANY($1)
 *
 * The filter tests here assert we pass the correct ANY($1) array
 * depending on the `qualityFilter` flag. The "mark exported" test
 * ensures the final UPDATE is issued with the session IDs we fetched.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../../platform/backend/src/config/database');
const training = require(
  '../../../../platform/backend/src/services/trainingService',
);

/**
 * Installs a stub for `global.fetch` that returns queued JSON
 * responses in order. Each call MUST be fulfilled to avoid dangling
 * promises.
 */
function queueFetchResponses(responses) {
  global.fetch = jest.fn().mockImplementation(async () => {
    if (!responses.length) throw new Error('Unexpected extra fetch call');
    const body = responses.shift();
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(body),
    };
  });
}

beforeEach(() => {
  db.query.mockReset();
  jest.restoreAllMocks();
});

describe('UC-12.2 / trainingService.exportForAzure — quality filter', () => {
  // TC-UC12.2-002
  test("TC-UC12.2-002 — default qualityFilter ('good') passes [['good']] into ANY($1)", async () => {
    queueFetchResponses([{ sessions: [] }]);
    db.query
      .mockResolvedValueOnce({ rows: [] }) // reviews
      .mockResolvedValueOnce({ rows: [] }); // step_reviews

    await training.exportForAzure({ agentTypes: [] });

    // Call 1 = training_reviews; call 2 = training_step_reviews.
    const [sql1, params1] = db.query.mock.calls[0];
    expect(sql1).toMatch(/FROM\s+training_reviews/i);
    expect(sql1).toMatch(/quality\s*=\s*ANY\(\$1\)/i);
    expect(params1).toEqual([['good']]);

    const [, params2] = db.query.mock.calls[1];
    expect(params2).toEqual([['good']]);
  });

  // TC-UC12.2-003
  test("TC-UC12.2-003 — qualityFilter='all' widens ANY($1) to ['good','needs_edit']", async () => {
    queueFetchResponses([{ sessions: [] }]);
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await training.exportForAzure({ agentTypes: [], qualityFilter: 'all' });

    const [, params1] = db.query.mock.calls[0];
    expect(params1).toEqual([['good', 'needs_edit']]);

    const [, params2] = db.query.mock.calls[1];
    expect(params2).toEqual([['good', 'needs_edit']]);
  });
});

describe('UC-12.2 / trainingService.exportForAzure — post-export bookkeeping', () => {
  // TC-UC12.2-004
  test('TC-UC12.2-004 — marks exported sessions via UPDATE training_reviews SET is_exported = TRUE', async () => {
    // Two fetch responses: one for /ai/training/sessions (list) and one
    // for /ai/training/sessions/s-1 (full record fetch).
    queueFetchResponses([
      {
        sessions: [
          { session_id: 's-1', endpoint: '/ai/chat', input: { message: 'hi' }, output: 'ok' },
        ],
      },
      // Full session: no step_logs so the "endpoint === /ai/chat" branch fires.
      {
        session_id: 's-1',
        endpoint: '/ai/chat',
        input: { message: 'hi' },
        output: 'ok',
        step_logs: [],
      },
    ]);

    db.query
      // training_reviews filter → one eligible row.
      .mockResolvedValueOnce({
        rows: [{ session_id: 's-1', quality: 'good', edited_output: null }],
      })
      // training_step_reviews filter → none.
      .mockResolvedValueOnce({ rows: [] })
      // final UPDATE is_exported.
      .mockResolvedValueOnce({ rows: [] });

    await training.exportForAzure({ agentTypes: ['chatbot'] });

    // The third query call is the final UPDATE.
    const updateCall = db.query.mock.calls.find(([sql]) =>
      /UPDATE\s+training_reviews\s+SET\s+is_exported\s*=\s*TRUE/i.test(sql),
    );
    expect(updateCall).toBeDefined();

    const [sql, params] = updateCall;
    expect(sql).toMatch(/WHERE\s+session_id\s*=\s*ANY\(\$1\)/i);
    expect(params).toEqual([['s-1']]);
  });
});
