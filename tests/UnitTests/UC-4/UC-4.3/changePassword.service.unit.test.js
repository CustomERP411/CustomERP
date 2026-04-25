/**
 * UC-4.3 Change Password — service-layer unit tests
 *
 * Covers TC-UC4.3-005 through TC-UC4.3-008.
 * SUT: platform/backend/src/services/authService.js (changePassword)
 *
 * Mocks:
 *   - database.query (controls DB lookups/updates)
 *   - bcryptjs       (controls hash/compare outcomes)
 *
 * Security-critical assertions:
 *   - The new plaintext password NEVER appears in a SQL parameter.
 *   - Wrong current password → 400, no UPDATE, no hash of new pwd.
 *   - Missing user → 404, bcrypt untouched.
 */

jest.mock('../../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

const { query } = require('../../../../platform/backend/src/config/database');
const bcrypt = require('bcryptjs');
const authService = require(
  '../../../../platform/backend/src/services/authService',
);

describe('UC-4.3 / authService.changePassword', () => {
  // TC-UC4.3-005
  test('rejects with 400 when currentPassword does not match the stored hash', async () => {
    query.mockResolvedValueOnce({
      rows: [{ user_id: 'u-1', password_hash: '$2a$10$stored-hash' }],
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(
      authService.changePassword('u-1', 'WrongPass', 'NewPass12'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Current password is incorrect.',
    });

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  // TC-UC4.3-006
  test('hashes the new password and UPDATEs the password_hash column', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u-1', password_hash: '$2a$10$old-hash' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    bcrypt.compare.mockResolvedValueOnce(true);
    bcrypt.hash.mockResolvedValueOnce('NEW_HASH');

    const ok = await authService.changePassword('u-1', 'OldPass12', 'NewPass12');

    expect(ok).toBe(true);
    expect(bcrypt.hash).toHaveBeenCalledWith('NewPass12', 10);

    const [updateSql, updateParams] = query.mock.calls[1];
    expect(updateSql).toMatch(/UPDATE\s+users/i);
    expect(updateSql).toMatch(/password_hash\s*=\s*\$1/i);
    expect(updateSql).toMatch(/updated_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(updateSql).toMatch(/WHERE\s+user_id\s*=\s*\$2/i);
    expect(updateParams).toEqual(['NEW_HASH', 'u-1']);
  });

  // TC-UC4.3-007
  test('rejects with 404 when the user does not exist (or was soft-deleted)', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      authService.changePassword('u-gone', 'any', 'NewPass12'),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  // TC-UC4.3-008
  test('the plaintext new password never appears as a SQL parameter', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ user_id: 'u-1', password_hash: '$2a$10$old' }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    bcrypt.compare.mockResolvedValueOnce(true);
    bcrypt.hash.mockResolvedValueOnce('HASHED_OUTPUT');

    await authService.changePassword('u-1', 'OldPass12', 'SuperSecret9');

    for (const call of query.mock.calls) {
      const params = call[1] || [];
      for (const p of params) {
        expect(typeof p === 'string' && p.includes('SuperSecret9')).toBe(false);
      }
    }
    expect(query.mock.calls[1][1]).toContain('HASHED_OUTPUT');
  });
});
