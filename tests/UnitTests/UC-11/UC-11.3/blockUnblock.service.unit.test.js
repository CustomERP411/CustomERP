/**
 * UC-11.3 Block / Unblock User — service-layer unit tests
 *
 * Covers TC-UC11.3-004, TC-UC11.3-005, TC-UC11.3-006, TC-UC11.3-007.
 * SUT: platform/backend/src/services/adminService.js (blockUser, unblockUser)
 *
 * Both operations are scoped by (user_id AND deleted_at IS NULL) so a
 * soft-deleted account can never be blocked / unblocked through the
 * admin UI.
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

describe('UC-11.3 / adminService.blockUser', () => {
  // TC-UC11.3-004
  test('sets blocked_at = CURRENT_TIMESTAMP and records the reason', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'u-1',
          name: 'A',
          email: 'a@x',
          is_admin: false,
          created_at: '2026',
          updated_at: '2026',
          blocked_at: '2026-04-01',
          block_reason: 'abuse',
        },
      ],
    });

    const out = await adminService.blockUser('u-1', 'abuse');

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/UPDATE\s+users\s+SET/i);
    expect(sql).toMatch(/blocked_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(sql).toMatch(/block_reason\s*=\s*\$2/i);
    expect(sql).toMatch(
      /WHERE\s+user_id\s*=\s*\$1\s+AND\s+deleted_at\s+IS\s+NULL/i,
    );
    expect(params).toEqual(['u-1', 'abuse']);
    expect(out).toMatchObject({
      id: 'u-1',
      blocked: true,
      block_reason: 'abuse',
      deleted: false,
    });
  });

  // TC-UC11.3-005
  test('throws 404 when the user is missing or soft-deleted', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await expect(adminService.blockUser('ghost', null)).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    });
  });
});

describe('UC-11.3 / adminService.unblockUser', () => {
  // TC-UC11.3-006
  test('clears blocked_at and block_reason to NULL', async () => {
    db.query.mockResolvedValueOnce({
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

    await adminService.unblockUser('u-1');

    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/blocked_at\s*=\s*NULL/i);
    expect(sql).toMatch(/block_reason\s*=\s*NULL/i);
    expect(sql).toMatch(
      /WHERE\s+user_id\s*=\s*\$1\s+AND\s+deleted_at\s+IS\s+NULL/i,
    );
  });

  // TC-UC11.3-007
  test('returns the shaped user with blocked:false, block_reason:null', async () => {
    db.query.mockResolvedValueOnce({
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

    const out = await adminService.unblockUser('u-1');

    expect(out).toMatchObject({
      id: 'u-1',
      blocked: false,
      block_reason: null,
      deleted: false,
    });
  });
});
