/**
 * UC-4.2 Edit Email — controller-layer unit tests
 *
 * Covers TC-UC4.2-002, TC-UC4.2-003.
 * SUT: platform/backend/src/controllers/authController.js (updateProfile)
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
  fns.normalizeLanguage = (v) =>
    typeof v === 'string' && v.toLowerCase().startsWith('tr') ? 'tr' : 'en';
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

describe('UC-4.2 / authController.updateProfile — email path', () => {
  // TC-UC4.2-002
  test('TC-UC4.2-002 — returns 400 for a malformed email without invoking the service', async () => {
    const req = { body: { email: 'no-at-sign' }, user: { userId: 'u-1' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.updateProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Valid email is required' });
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  // TC-UC4.2-003
  test('TC-UC4.2-003 — lowercases the email before calling the service', async () => {
    authService.updateProfile.mockResolvedValueOnce({
      id: 'u-1', name: 'U', email: 'ayse@test.com', preferred_language: 'en',
    });

    const req = { body: { email: 'Ayse@Test.COM' }, user: { userId: 'u-1' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.updateProfile(req, res, next);

    expect(authService.updateProfile).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ email: 'ayse@test.com' }),
    );
  });
});
