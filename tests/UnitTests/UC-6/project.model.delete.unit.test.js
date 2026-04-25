/**
 * UC-6 Delete Project — model-layer unit tests
 *
 * Covers TC-UC6-008, TC-UC6-009.
 * SUT: platform/backend/src/models/Project.js (delete)
 *
 * Critical guarantees:
 *   - SOFT delete: the SQL is an UPDATE that sets deleted_at, NOT a
 *     DELETE FROM. This preserves FK targets (chats, SDFs, runs, ...).
 *   - Caller scoping: WHERE also clamps by owner_user_id so a user
 *     cannot delete someone else's project even if they guess its id.
 *   - Idempotency: `deleted_at IS NULL` prevents clobbering the
 *     timestamp if the call runs twice.
 *   - Returns boolean based on rowCount (true if ≥1 row updated).
 */

jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

const db = require('../../../platform/backend/src/config/database');
const Project = require('../../../platform/backend/src/models/Project');

describe('UC-6 / Project.delete', () => {
  // TC-UC6-008
  test('TC-UC6-008 — issues a soft-delete UPDATE scoped by owner and not-yet-deleted', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ project_id: 'p-1' }],
    });

    const ok = await Project.delete('p-1', 'u-1');

    expect(ok).toBe(true);
    expect(db.query).toHaveBeenCalledTimes(1);

    const [sql, params] = db.query.mock.calls[0];

    expect(sql).toMatch(/UPDATE\s+projects\s+SET\s+deleted_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(sql).toMatch(/WHERE\s+project_id\s*=\s*\$1/i);
    expect(sql).toMatch(/AND\s+owner_user_id\s*=\s*\$2/i);
    expect(sql).toMatch(/AND\s+deleted_at\s+IS\s+NULL/i);
    expect(sql).toMatch(/RETURNING\s+project_id/i);
    // Guardrail: we must never HARD-delete here.
    expect(sql).not.toMatch(/DELETE\s+FROM\s+projects/i);

    expect(params).toEqual(['p-1', 'u-1']);
  });

  // TC-UC6-009
  test('TC-UC6-009 — returns false when no row was updated (missing or already deleted)', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const ok = await Project.delete('p-missing', 'u-1');

    expect(ok).toBe(false);
  });
});
