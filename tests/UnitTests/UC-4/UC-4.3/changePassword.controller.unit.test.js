/**
 * UC-4.3 Change Password — controller-layer unit tests
 *
 * Covers TC-UC4.3-003, TC-UC4.3-004.
 * SUT: platform/backend/src/controllers/authController.js (changePassword)
 */

jest.mock('../../../../platform/backend/src/services/authService', () => {
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

const authService = require(
  '../../../../platform/backend/src/services/authService',
);
const authController = require(
  '../../../../platform/backend/src/controllers/authController',
);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-4.3 / authController.changePassword', () => {
  // TC-UC4.3-003
  test('TC-UC4.3-003 — returns 400 when currentPassword is missing', async () => {
    const req = {
      body: { newPassword: 'Abcd1234' },
      user: { userId: 'u-1' },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Current password is required' });
    expect(authService.changePassword).not.toHaveBeenCalled();
  });

  // TC-UC4.3-004
  test('TC-UC4.3-004 — returns 400 when newPassword is shorter than 8 characters', async () => {
    const req = {
      body: { currentPassword: 'x', newPassword: 'short' },
      user: { userId: 'u-1' },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.changePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/at least 8/);
    expect(authService.changePassword).not.toHaveBeenCalled();
  });
});
