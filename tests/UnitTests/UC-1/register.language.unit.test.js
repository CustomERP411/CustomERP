/**
 * UC-1 Register Account — language-preference extension tests
 *
 * Budget reallocated from the cancelled "UC-13 Select Language" use case.
 * Covers TC-UC1-LANG-001, TC-UC1-LANG-002.
 *
 * Scope:
 *   - Controller layer: the validateLanguage guard rejects unsupported
 *     codes BEFORE the authService.register call fires.
 *   - Service layer: authService.register persists the NORMALIZED
 *     language in the INSERT parameters (so 'TR-tr' → 'tr').
 */

// ---- Controller mock bootstrap ----
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
  fns.normalizeLanguage = (v) =>
    typeof v === 'string' && v.toLowerCase().startsWith('tr') ? 'tr' : 'en';
  return fns;
});

const authServiceMock = require(
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

describe('UC-1 (LANG) / authController.register — language validation', () => {
  beforeEach(() => {
    authServiceMock.register.mockReset();
  });

  // TC-UC1-LANG-001
  test("TC-UC1-LANG-001 — rejects preferred_language='fr' with 400 and does NOT call the service", async () => {
    const req = {
      body: {
        name: 'Ayse',
        email: 'a@b.com',
        password: 'SecurePass1!',
        preferred_language: 'fr',
      },
    };
    const res = mockRes();
    const next = jest.fn();

    await authController.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toMatch(/preferred_language must be one of/i);
    expect(authServiceMock.register).not.toHaveBeenCalled();

    tcLog('TC-UC1-LANG-001', {
      input: { preferred_language: 'fr' },
      expected: "HTTP 400 + error matches /preferred_language must be one of/i, service NOT called",
      got: { status: 400, body, serviceCalls: authServiceMock.register.mock.calls.length },
    });
  });
});

// ---- Service layer: fresh module isolation so we can un-mock authService ----
describe('UC-1 (LANG) / authService.register — language persistence', () => {
  let authService;
  let query;
  let bcrypt;

  beforeAll(() => {
    jest.resetModules();
    // Un-mock authService so the real implementation runs; mock
    // everything it depends on.
    jest.unmock('../../../platform/backend/src/services/authService');
    jest.doMock('../../../platform/backend/src/config/database', () => ({
      query: jest.fn(),
      pool: { connect: jest.fn(), on: jest.fn() },
    }));
    jest.doMock('bcryptjs', () => ({
      hash: jest.fn(),
      compare: jest.fn(),
    }));
    jest.doMock('../../../platform/backend/src/utils/jwt', () => ({
      generateToken: jest.fn(),
      verifyToken: jest.fn(),
      decodeToken: jest.fn(),
    }));

    authService = require('../../../platform/backend/src/services/authService');
    ({ query } = require('../../../platform/backend/src/config/database'));
    bcrypt = require('bcryptjs');
    const jwt = require('../../../platform/backend/src/utils/jwt');
    bcrypt.hash.mockResolvedValue('HASHED');
    jwt.generateToken.mockReturnValue('jwt.token');
  });

  beforeEach(() => {
    query.mockReset();
    bcrypt.hash.mockResolvedValue('HASHED');
  });

  // TC-UC1-LANG-002
  test("TC-UC1-LANG-002 — persists the normalized language ('TR-tr' → 'tr') in INSERT params", async () => {
    query
      // findByEmail → nobody exists
      .mockResolvedValueOnce({ rows: [] })
      // INSERT ... RETURNING
      .mockResolvedValueOnce({
        rows: [{
          user_id: 'u-1',
          name: 'Ayşe',
          email: 'ayse@test.com',
          is_admin: false,
          preferred_language: 'tr',
          created_at: new Date(),
        }],
      });

    await authService.register({
      name: 'Ayşe',
      email: 'ayse@test.com',
      password: 'SecurePass1!',
      preferred_language: 'TR-tr',
    });

    // Second call is the INSERT. Its params are
    // [user_id, name, email, password_hash, preferred_language].
    const [sql, params] = query.mock.calls[1];
    expect(sql).toMatch(/INSERT\s+INTO\s+users/i);
    expect(sql).toMatch(/preferred_language/);
    expect(params[4]).toBe('tr');

    tcLog('TC-UC1-LANG-002', {
      input: { preferred_language: 'TR-tr' },
      expected: "INSERT SQL matches /INSERT INTO users/ and param[4]='tr'",
      got: { sqlPreview: sql.replace(/\s+/g, ' ').slice(0, 60) + '...', langParam: params[4] },
    });
  });
});
