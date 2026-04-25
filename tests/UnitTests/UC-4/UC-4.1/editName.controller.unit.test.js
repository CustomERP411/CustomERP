/**
 * UC-4.1 Edit Name — controller-layer unit tests
 *
 * Covers TC-UC4.1-003, TC-UC4.1-004.
 * SUT: platform/backend/src/controllers/authController.js (updateProfile)
 *
 * The entire authService module is stubbed so we can observe exactly
 * what the controller forwards to it after validation/sanitization.
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

describe('UC-4.1 / authController.updateProfile — name path', () => {
  // TC-UC4.1-003
  test('returns 400 when the new name is shorter than 2 characters', async () => {
    const req = { body: { name: 'A' }, user: { userId: 'u-1' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.updateProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/at least 2/);
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  // TC-UC4.1-004
  test('sanitizes (HTML-escapes) and trims the name before calling the service', async () => {
    authService.updateProfile.mockResolvedValueOnce({
      id: 'u-1', name: 'Ayşe', email: 'x@y.com', preferred_language: 'tr',
    });

    const req = {
      body: { name: '  <b>Ayşe</b>  ' },
      user: { userId: 'u-1' },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.updateProfile(req, res, next);

    expect(authService.updateProfile).toHaveBeenCalledTimes(1);
    const forwardedName = authService.updateProfile.mock.calls[0][1].name;

    expect(forwardedName.startsWith(' ')).toBe(false);
    expect(forwardedName.endsWith(' ')).toBe(false);
    expect(forwardedName).not.toMatch(/</);
    expect(forwardedName).not.toMatch(/>/);
    expect(forwardedName).toContain('&lt;b&gt;');
    expect(forwardedName).toContain('Ayşe');
  });
});
