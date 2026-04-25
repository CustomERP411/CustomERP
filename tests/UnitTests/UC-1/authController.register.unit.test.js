/**
 * UC-1 Register Account — authController.register unit tests
 *
 * Covers TC-UC1-026.
 * SUT: platform/backend/src/controllers/authController.js
 *
 * The controller owns two validation responsibilities that are specific
 * to the new Turkish localization work:
 *   1. It calls validateLanguage() on the incoming preferred_language
 *      field and returns HTTP 400 with a helpful message if the value
 *      is not in SUPPORTED_LANGUAGES.
 *   2. It NEVER reaches authService.register when validation fails, so
 *      no bcrypt/DB work is wasted on invalid input.
 *
 * We stub the whole authService so the controller's branching logic is
 * exercised in isolation.
 */

// NOTE: jest.mock() is hoisted by the Jest transformer to run before
// the `require` calls above it, so its first argument must be a literal
// string (referencing a `const` would fail with a ReferenceError).
jest.mock('../../../platform/backend/src/services/authService', () => {
  const register = jest.fn();
  const login = jest.fn();
  const getCurrentUser = jest.fn();
  const updateProfile = jest.fn();
  const changePassword = jest.fn();
  const deleteAccount = jest.fn();

  const authServiceMock = {
    register,
    login,
    getCurrentUser,
    updateProfile,
    changePassword,
    deleteAccount,
  };

  // The controller also imports { SUPPORTED_LANGUAGES, normalizeLanguage }
  // from authService, so we must preserve those named exports.
  authServiceMock.SUPPORTED_LANGUAGES = ['en', 'tr'];
  authServiceMock.DEFAULT_LANGUAGE = 'en';
  authServiceMock.normalizeLanguage = (value) => {
    if (typeof value !== 'string') return 'en';
    const lower = value.trim().toLowerCase();
    if (['en', 'tr'].includes(lower)) return lower;
    const prefix = lower.split('-')[0];
    if (['en', 'tr'].includes(prefix)) return prefix;
    return 'en';
  };
  return authServiceMock;
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
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('UC-1 / authController.register', () => {
  // TC-UC1-026
  test('returns 400 when preferred_language is unsupported (e.g. "fr")', async () => {
    const req = {
      body: {
        name: 'Valid Name',
        email: 'ok@test.com',
        password: 'Passw0rd!',
        preferred_language: 'fr',
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('error');
    // The message must name the supported languages so the client can fix it.
    expect(body.error).toMatch(/preferred_language/);
    expect(body.error).toMatch(/en/);
    expect(body.error).toMatch(/tr/);

    expect(authService.register).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 400 on invalid email without invoking the service', async () => {
    const req = {
      body: {
        name: 'Valid Name',
        email: 'not-an-email',
        password: 'Passw0rd!',
        preferred_language: 'en',
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toEqual({
      error: 'Valid email is required',
    });
    expect(authService.register).not.toHaveBeenCalled();
  });

  test('on happy path, forwards normalized inputs to authService and returns 201', async () => {
    authService.register.mockResolvedValue({
      token: 'signed.jwt.token',
      user: {
        id: 'abc',
        name: 'Ayşe',
        email: 'ayse@test.com',
        is_admin: false,
        preferred_language: 'tr',
      },
    });

    const req = {
      body: {
        // Whitespace around name + mixed-case email must be normalized
        // by the controller (trim + sanitize + toLowerCase) before being
        // forwarded to the service. The email itself has no leading or
        // trailing spaces because `isValidEmail` rejects those upfront.
        name: '  Ayşe  ',
        email: 'Ayse@Test.COM',
        password: 'Passw0rd!',
        preferred_language: 'tr-TR',
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(authService.register).toHaveBeenCalledTimes(1);
    const forwarded = authService.register.mock.calls[0][0];
    expect(forwarded.email).toBe('ayse@test.com');
    expect(forwarded.preferred_language).toBe('tr');
    // Sanitize/trim should have happened on the name.
    expect(forwarded.name).toBe('Ayşe');
    expect(next).not.toHaveBeenCalled();
  });
});
