/**
 * UC-11.2 Toggle Admin Status — service-layer unit tests
 *
 * Covers TC-UC11.2-005, TC-UC11.2-006, TC-UC11.2-007.
 * SUT: platform/backend/src/services/adminService.js (setAdminStatus)
 *
 * The service must:
 *   - UPDATE the is_admin column scoped by (user_id AND deleted_at IS NULL),
 *     so a soft-deleted account cannot be silently re-promoted.
 *   - Coerce the incoming flag into a real boolean via `!!isAdmin`.
 *   - Throw a 404-shaped error when no row matches.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
}));

const db = require('../../../../platform/backend/src/config/database');
const adminService = require(
  '../../../../platform/backend/src/services/adminService',
);

beforeEach(() => {
  db.query.mockReset();
});

describe('UC-11.2 / adminService.setAdminStatus', () => {
  // TC-UC11.2-005
  test('TC-UC11.2-005 — UPDATE is scoped by `user_id = $2 AND deleted_at IS NULL`', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'u-1',
          name: 'A',
          email: 'a@x',
          is_admin: true,
          created_at: '2026-01-01',
          updated_at: '2026-02-01',
          blocked_at: null,
          block_reason: null,
        },
      ],
    });

    const out = await adminService.setAdminStatus('u-1', true);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE\s+users\s+SET\s+is_admin\s*=\s*\$1/i);
    expect(sql).toMatch(/updated_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(sql).toMatch(
      /WHERE\s+user_id\s*=\s*\$2\s+AND\s+deleted_at\s+IS\s+NULL/i,
    );
    expect(params).toEqual([true, 'u-1']);
    expect(out.is_admin).toBe(true);
    expect(out.id).toBe('u-1');
  });

  // TC-UC11.2-006
  test('TC-UC11.2-006 — throws { statusCode: 404 } when no row matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(adminService.setAdminStatus('missing', true)).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    });
  });

  // TC-UC11.2-007
  test('TC-UC11.2-007 — coerces truthy / falsy values to real booleans before persistence', async () => {
    db.query.mockResolvedValue({
      rows: [
        {
          user_id: 'u-1',
          name: 'A',
          email: 'a@x',
          is_admin: false,
          created_at: '2026',
          updated_at: '2026',
          blocked_at: null,
          block_reason: null,
        },
      ],
    });

    await adminService.setAdminStatus('u-1', 'yes');
    expect(db.query.mock.calls[0][1]).toEqual([true, 'u-1']);

    db.query.mockClear();
    await adminService.setAdminStatus('u-1', 0);
    expect(db.query.mock.calls[0][1]).toEqual([false, 'u-1']);
  });
});
