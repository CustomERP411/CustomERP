/**
 * UC-3 Logout — authController.logout unit tests
 *
 * Covers TC-UC3-004.
 * SUT: platform/backend/src/controllers/authController.js
 *
 * Logout is intentionally stateless on the server (JWT is not
 * blacklisted). The handler's only job is to return a stable success
 * response so the client can safely clear its local session.
 */

// Mock the service module to prevent the real pg pool from being
// instantiated when authController is required (the controller pulls
// authService → database at import time).
jest.mock('../../../platform/backend/src/services/authService', () => {
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
  fns.normalizeLanguage = (v) => (typeof v === 'string' && v.toLowerCase().startsWith('tr') ? 'tr' : 'en');
  return fns;
});

const authController = require(
  '../../../platform/backend/src/controllers/authController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-3 / authController.logout', () => {
  // TC-UC3-004
  test('TC-UC3-004 — returns 200 with the success message and does not throw', async () => {
    const req = { body: {}, user: { userId: 'u-1' } };
    const res = mockRes();

    await expect(
      Promise.resolve(authController.logout(req, res)),
    ).resolves.not.toThrow();

    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    // No explicit status() call is required because Express defaults to 200.
  });

  test('does not depend on request body contents', () => {
    const res1 = mockRes();
    const res2 = mockRes();

    authController.logout({}, res1);
    authController.logout({ body: { anything: 'ignored' }, user: null }, res2);

    expect(res1.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
    expect(res2.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
  });
});
