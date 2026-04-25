/**
 * UC-11.1 View All Users — service-layer unit tests
 *
 * Covers TC-UC11.1-002, TC-UC11.1-003.
 * SUT: platform/backend/src/services/adminService.js (listUsers)
 *
 * The admin list intentionally INCLUDES soft-deleted users so the
 * admin can see the full account audit trail. The service maps raw
 * rows into the public admin-user shape (no raw timestamps leaked).
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

describe('UC-11.1 / adminService.listUsers', () => {
  // TC-UC11.1-002
  test('selects from users with ORDER BY created_at DESC and NO deleted_at filter', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    await adminService.listUsers();

    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/FROM\s+users/i);
    expect(sql).toMatch(/ORDER BY\s+created_at\s+DESC/i);
    // Admins see deleted accounts too.
    expect(sql).not.toMatch(/WHERE\s+deleted_at\s+IS\s+NULL/i);
  });

  // TC-UC11.1-003
  test('converts deleted_at / blocked_at to booleans and renames user_id to id', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          user_id: 'u-del',
          name: 'Deleted Person',
          email: 'del@example.com',
          is_admin: false,
          created_at: '2026-01-01',
          updated_at: '2026-02-01',
          deleted_at: '2026-03-01',
          blocked_at: null,
          block_reason: null,
        },
        {
          user_id: 'u-blk',
          name: 'Blocked Person',
          email: 'blk@example.com',
          is_admin: false,
          created_at: '2026-01-02',
          updated_at: '2026-02-02',
          deleted_at: null,
          blocked_at: '2026-04-01',
          block_reason: 'abuse',
        },
      ],
    });

    const users = await adminService.listUsers();

    expect(users).toEqual([
      {
        id: 'u-del',
        name: 'Deleted Person',
        email: 'del@example.com',
        is_admin: false,
        created_at: '2026-01-01',
        updated_at: '2026-02-01',
        deleted: true,
        blocked: false,
        block_reason: null,
      },
      {
        id: 'u-blk',
        name: 'Blocked Person',
        email: 'blk@example.com',
        is_admin: false,
        created_at: '2026-01-02',
        updated_at: '2026-02-02',
        deleted: false,
        blocked: true,
        block_reason: 'abuse',
      },
    ]);

    // Raw timestamp columns must NOT leak on the response objects.
    for (const u of users) {
      expect(u).not.toHaveProperty('deleted_at');
      expect(u).not.toHaveProperty('blocked_at');
    }
  });
});
