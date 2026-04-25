/**
 * UC-2 Login — authController.login unit tests
 *
 * Covers TC-UC2-006 through TC-UC2-010.
 * SUT: platform/backend/src/controllers/authController.js
 *
 * The controller's responsibilities on the login path are:
 *   1. Reject missing/malformed email with HTTP 400 before hitting the DB.
 *   2. Reject missing password with HTTP 400.
 *   3. Lowercase + trim the email before forwarding to the service.
 *   4. Propagate any `statusCode` and `code` attached to service errors
 *      (especially `ACCOUNT_BLOCKED` for suspended accounts).
 *
 * We stub the entire authService module so the controller's branching
 * is exercised in isolation. Validator functions are the real ones
 * since they're pure and fast.
 */

jest.mock('../../../platform/backend/src/services/authService', () => {
  const fns = {
    register: jest.fn(),
    login: jest.fn(),
    getCurrentUser: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    deleteAccount: jest.fn(),
  };
  // Preserve the named exports the controller destructures at import time.
  fns.SUPPORTED_LANGUAGES = ['en', 'tr'];
  fns.DEFAULT_LANGUAGE = 'en';
  fns.normalizeLanguage = (v) => (typeof v === 'string' && v.toLowerCase().startsWith('tr') ? 'tr' : 'en');
  return fns;
});

const authService = require(
  '../../../platform/backend/src/services/authService',
);
const authController = require(
  '../../../platform/backend/src/controllers/authController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-2 / authController.login', () => {
  // TC-UC2-006
  test('returns 400 when email is missing', async () => {
    const req = { body: { password: 'Passw0rd!' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Valid email is required' });
    expect(authService.login).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  // TC-UC2-007
  test('returns 400 when email is malformed', async () => {
    const req = { body: { email: 'not-an-email', password: 'Passw0rd!' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Valid email is required' });
    expect(authService.login).not.toHaveBeenCalled();
  });

  // TC-UC2-008
  test('returns 400 when password is missing', async () => {
    const req = { body: { email: 'ok@test.com' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Password is required' });
    expect(authService.login).not.toHaveBeenCalled();
  });

  // TC-UC2-009
  test('forwards service error statusCode and code (ACCOUNT_BLOCKED) to the response', async () => {
    const err = new Error('Your account has been suspended due to spam. Contact x@y.z for assistance.');
    err.statusCode = 403;
    err.code = 'ACCOUNT_BLOCKED';
    authService.login.mockRejectedValueOnce(err);

    const req = { body: { email: 'blocked@test.com', password: 'Passw0rd!' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({
      error: 'Your account has been suspended due to spam. Contact x@y.z for assistance.',
      code: 'ACCOUNT_BLOCKED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('forwards 401 errors without attaching a code when the service omits one', async () => {
    const err = new Error('The email address or password you entered is incorrect. Please try again.');
    err.statusCode = 401;
    authService.login.mockRejectedValueOnce(err);

    const req = { body: { email: 'ok@test.com', password: 'WrongPass1' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/email address or password/);
    expect(body).not.toHaveProperty('code');
  });

  // TC-UC2-010
  test('lowercases the email before calling the service', async () => {
    // Note: the controller validates email format with isValidEmail()
    // BEFORE trimming — the regex rejects any leading/trailing \s, so
    // surrounding whitespace is a 400 case (covered elsewhere). Here we
    // verify that a correctly-shaped mixed-case email is lower-cased.
    authService.login.mockResolvedValueOnce({
      token: 't',
      user: { id: 'u', name: 'U', email: 'user@test.com', preferred_language: 'en' },
    });

    const req = { body: { email: 'User@Test.COM', password: 'Passw0rd!' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.login(req, res, next);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'Passw0rd!',
    });
    expect(res.json).toHaveBeenCalled();
  });
});
