/**
 * UC-4.5 Change Language Preference — controller-layer unit tests
 *
 * Budget reallocated from the cancelled "UC-13 Select Language" use case.
 * Covers TC-UC4-LANG-002 through TC-UC4-LANG-005.
 * SUT: platform/backend/src/controllers/authController.js (updateProfile + validateLanguage)
 *
 * NOTE: These tests originally used the TC-UC4.4-* prefix which
 * collided with UC-4.4 Delete Account. They have been re-keyed to
 * TC-UC4-LANG-* so the language-preference sub-use-case has its own
 * test-ID namespace.
 *
 * The controller's `validateLanguage(value)` helper:
 *   - passes through `undefined` / `null` (→ `{ valid: true, value: undefined }`)
 *     so an omitted key does NOT overwrite the stored language;
 *   - rejects non-string or unsupported codes with a 400 that lists the allowed values;
 *   - normalizes locale tags like "tr-TR" down to the base language ("tr").
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

beforeEach(() => {
  authService.updateProfile.mockReset();
});

describe('UC-4.5 / authController.updateProfile — preferred_language', () => {
  // TC-UC4-LANG-002
  test("TC-UC4-LANG-002 — rejects an unsupported language with 400 listing 'en, tr'", async () => {
    const req = { body: { preferred_language: 'fr' }, user: { userId: 'u-1' } };
    const res = mockRes();
    const next = jest.fn();

    await authController.updateProfile(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/preferred_language must be one of/i);
    expect(body.error).toMatch(/en/);
    expect(body.error).toMatch(/tr/);
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  // TC-UC4-LANG-003
  test('TC-UC4-LANG-003 — rejects non-string language with 400', async () => {
    const req = { body: { preferred_language: 123 }, user: { userId: 'u-1' } };
    const res = mockRes();

    await authController.updateProfile(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(authService.updateProfile).not.toHaveBeenCalled();
  });

  // TC-UC4-LANG-004
  test("TC-UC4-LANG-004 — locale-tagged 'tr-TR' is accepted and normalized to 'tr' before the service call", async () => {
    authService.updateProfile.mockResolvedValueOnce({
      id: 'u-1', name: 'Ayşe', email: 'a@b.com', preferred_language: 'tr',
    });

    const req = { body: { preferred_language: 'tr-TR' }, user: { userId: 'u-1' } };
    const res = mockRes();

    await authController.updateProfile(req, res, jest.fn());

    expect(authService.updateProfile).toHaveBeenCalledTimes(1);
    const [, payload] = authService.updateProfile.mock.calls[0];
    expect(payload.preferred_language).toBe('tr');
  });

  // TC-UC4-LANG-005
  test('TC-UC4-LANG-005 — omitted preferred_language does NOT overwrite the stored value', async () => {
    authService.updateProfile.mockResolvedValueOnce({
      id: 'u-1', name: 'Ayse', email: 'a@b.com', preferred_language: 'en',
    });

    // Only `name` is being updated. `preferred_language` is absent.
    const req = { body: { name: 'Ayse' }, user: { userId: 'u-1' } };
    const res = mockRes();

    await authController.updateProfile(req, res, jest.fn());

    expect(authService.updateProfile).toHaveBeenCalledTimes(1);
    const [, payload] = authService.updateProfile.mock.calls[0];
    // Undefined signals "do not touch this column" in the service.
    expect(payload.preferred_language).toBeUndefined();
  });
});
