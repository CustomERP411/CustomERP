/**
 * UC-12.1 Review Training Sessions — listSessions unit tests
 *
 * Covers TC-UC12.1-002, TC-UC12.1-003.
 * SUT: platform/backend/src/services/trainingService.js (listSessions)
 *
 * listSessions:
 *   1) fetches ALL sessions from the AI gateway (via global `fetch`);
 *   2) joins them in-memory with `training_reviews`;
 *   3) applies `quality` / `reviewed` filters;
 *   4) paginates via slice(offset, offset+limit).
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../../platform/backend/src/config/database');
const training = require(
  '../../../../platform/backend/src/services/trainingService',
);

/**
 * Stub `global.fetch` so the service's `gatewayGet` helper resolves
 * against the in-memory response we control. The service only uses
 * `.ok`, `.status`, and `.text()`.
 */
function mockFetchOnce(body) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  });
}

beforeEach(() => {
  db.query.mockReset();
  jest.restoreAllMocks();
});

describe('UC-12.1 / trainingService.listSessions', () => {
  // TC-UC12.1-002
  test("applies the `quality` filter after merging review rows", async () => {
    mockFetchOnce({
      sessions: [
        { session_id: 's-1', endpoint: '/ai/analyze' },
        { session_id: 's-2', endpoint: '/ai/analyze' },
        { session_id: 's-3', endpoint: '/ai/analyze' },
      ],
    });
    db.query.mockResolvedValueOnce({
      rows: [
        { session_id: 's-1', quality: 'good', reviewed_at: '2026-01-01', is_exported: false },
        { session_id: 's-2', quality: 'bad', reviewed_at: '2026-01-02', is_exported: false },
        // s-3 has no review row.
      ],
    });

    const out = await training.listSessions({ quality: 'bad' });

    expect(out.sessions).toHaveLength(1);
    expect(out.sessions[0].session_id).toBe('s-2');
    expect(out.sessions[0].quality).toBe('bad');
    expect(out.sessions[0].reviewed).toBe(true);
  });

  // TC-UC12.1-003
  test('paginates via offset + limit in-memory', async () => {
    mockFetchOnce({
      sessions: [
        { session_id: 's-1' },
        { session_id: 's-2' },
        { session_id: 's-3' },
        { session_id: 's-4' },
        { session_id: 's-5' },
      ],
    });
    // No reviews → quality null / reviewed false for all.
    db.query.mockResolvedValueOnce({ rows: [] });

    const out = await training.listSessions({ offset: 2, limit: 2 });

    expect(out.total).toBe(5);
    expect(out.offset).toBe(2);
    expect(out.limit).toBe(2);
    expect(out.sessions.map((s) => s.session_id)).toEqual(['s-3', 's-4']);
  });
});
