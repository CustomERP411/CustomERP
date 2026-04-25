/**
 * UC-4.4 Delete Account — unit tests
 *
 * Covers TC-UC4.4-003, TC-UC4.4-004, TC-UC4.4-005, TC-UC4.4-006.
 *
 * SUTs:
 *   - platform/backend/src/services/authService.js       (deleteAccount)
 *   - platform/backend/src/controllers/authController.js (deleteAccount)
 *
 * Business rules:
 *   - Delete is SOFT: the service sets `deleted_at = CURRENT_TIMESTAMP`
 *     via UPDATE, it does NOT issue a DELETE. The row remains so the
 *     email stays reserved and FK-owned rows (projects, chats, ...)
 *     are preserved.
 *   - The UPDATE is idempotent: `AND deleted_at IS NULL` guards against
 *     deleting the same account twice.
 *   - Missing / already-deleted accounts yield HTTP 404.
 *   - Controller must respond HTTP 204 (no content) on success.
 */

describe('UC-4.4 / authService.deleteAccount', () => {
  let authService;
  let query;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../../platform/backend/src/config/database', () => ({
      query: jest.fn(),
      pool: { connect: jest.fn(), on: jest.fn() },
    }));
    ({ query } = require('../../../../platform/backend/src/config/database'));
    authService = require('../../../../platform/backend/src/services/authService');
  });

  // TC-UC4.4-003
  test('soft-deletes by updating deleted_at (no DELETE issued)', async () => {
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 'u-1' }],
    });

    const ok = await authService.deleteAccount('u-1');

    expect(ok).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/UPDATE\s+users/i);
    expect(sql).toMatch(/deleted_at\s*=\s*CURRENT_TIMESTAMP/i);
    expect(sql).toMatch(/WHERE\s+user_id\s*=\s*\$1/i);
    // Idempotency guard so re-calling doesn't rewrite deleted_at.
    expect(sql).toMatch(/deleted_at\s+IS\s+NULL/i);
    // Must NOT be a hard delete.
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM/i);

    expect(params).toEqual(['u-1']);
  });

  // TC-UC4.4-004
  test('rejects with 404 when no row was updated (already deleted or missing)', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(authService.deleteAccount('u-missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Account not found',
    });
  });
});

describe('UC-4.4 / authController.deleteAccount', () => {
  let authController;
  let authService;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../../../../platform/backend/src/services/authService', () => {
      const fns = {
        register: jest.fn(),
        login: jest.fn(),
        getCurrentUser: jest.fn(),
        updateProfile: jest.fn(),
        changePassword: jest.fn(),
        deleteAccount: jest.fn(),
      };
      fns.SUPPORTED_LANGUAGES = ['en', 'tr'];
      fns.DEFAULT_LANGUAGE = 'en';
      fns.normalizeLanguage = () => 'en';
      return fns;
    });
    authService = require('../../../../platform/backend/src/services/authService');
    authController = require('../../../../platform/backend/src/controllers/authController');
  });

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
  }

  // TC-UC4.4-005
  test('returns HTTP 204 on a successful delete', async () => {
    authService.deleteAccount.mockResolvedValueOnce(true);

    const req = { user: { userId: 'u-1' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.deleteAccount(req, res, next);

    expect(authService.deleteAccount).toHaveBeenCalledWith('u-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledTimes(1);
    // 204 must carry no body.
    const sendArg = res.send.mock.calls[0][0];
    expect(sendArg === undefined || sendArg === null || sendArg === '').toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  // TC-UC4.4-006
  test('forwards a 404 service error as a 404 JSON response', async () => {
    const err = new Error('Account not found');
    err.statusCode = 404;
    authService.deleteAccount.mockRejectedValueOnce(err);

    const req = { user: { userId: 'u-gone' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.deleteAccount(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Account not found' });
    expect(next).not.toHaveBeenCalled();
  });
});
