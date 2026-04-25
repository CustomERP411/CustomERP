/**
 * UC-1 Register Account — authService.register unit tests
 *
 * Covers TC-UC1-022 through TC-UC1-025.
 * SUT: platform/backend/src/services/authService.js
 *
 * We mock:
 *   - ../config/database (query) — to assert SQL parameter shape
 *     without touching PostgreSQL
 *   - bcryptjs — to confirm the plaintext password is hashed and the
 *     hash (not the plaintext) is the value written to the DB
 *   - ../utils/jwt — to confirm a JWT is generated with the normalized
 *     preferred_language in the payload
 *
 * Turkish localization coverage:
 *   - A register call with `preferred_language: 'tr-TR'` must be
 *     normalized to 'tr' before insertion.
 *   - A Turkish name (containing ğ, ş, ç, ö, İ) must reach the DB byte
 *     for byte — we explicitly assert no mangling happens in sanitize
 *     or hashing.
 */

// NOTE: jest.mock() calls are hoisted above `require`s by the Jest
// transformer, so their first argument must be a string literal.
jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../../../platform/backend/src/utils/jwt', () => ({
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
}));

// `uuid` is redirected to a local CJS stub via moduleNameMapper in
// jest.config.js. The stub's `v4()` returns predictable strings, which
// keeps the generated user_id stable for these assertions.

const { query } = require('../../../platform/backend/src/config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../../../platform/backend/src/utils/jwt');
const authService = require('../../../platform/backend/src/services/authService');

/**
 * Matches the shape authService expects back from `SELECT ... FROM users WHERE email = $1`.
 */
function dbRowForNewUser({
  user_id = '11111111-1111-1111-1111-111111111111',
  name,
  email,
  preferred_language,
}) {
  return {
    user_id,
    name,
    email,
    is_admin: false,
    preferred_language,
    created_at: new Date('2026-01-01T00:00:00Z'),
  };
}

describe('UC-1 / authService.register', () => {
  beforeEach(() => {
    bcrypt.hash.mockResolvedValue('HASHED_PASSWORD');
    generateToken.mockReturnValue('signed.jwt.token');
  });

  // TC-UC1-022
  test('hashes the password, inserts the hash, and returns a token (happy path, EN)', async () => {
    // First call = findByEmail (no existing user). Second call = INSERT RETURNING.
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          dbRowForNewUser({
            name: 'Alice',
            email: 'alice@test.com',
            preferred_language: 'en',
          }),
        ],
      });

    const result = await authService.register({
      name: 'Alice',
      email: 'alice@test.com',
      password: 'Passw0rd!',
      preferred_language: 'en',
    });

    expect(bcrypt.hash).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).toHaveBeenCalledWith('Passw0rd!', 10);

    // The INSERT must be the second query call and must receive the hash,
    // never the raw password.
    const insertCall = query.mock.calls[1];
    const [insertSql, insertParams] = insertCall;
    expect(insertSql).toMatch(/INSERT INTO users/i);
    expect(insertParams[0]).toEqual(expect.any(String)); // uuid
    expect(insertParams[1]).toBe('Alice');
    expect(insertParams[2]).toBe('alice@test.com');
    expect(insertParams[3]).toBe('HASHED_PASSWORD');
    expect(insertParams[3]).not.toBe('Passw0rd!');
    expect(insertParams[4]).toBe('en');

    expect(result).toMatchObject({
      token: 'signed.jwt.token',
      user: {
        id: expect.any(String),
        name: 'Alice',
        email: 'alice@test.com',
        is_admin: false,
        preferred_language: 'en',
      },
    });

    expect(generateToken).toHaveBeenCalledTimes(1);
    expect(generateToken.mock.calls[0][0]).toMatchObject({
      email: 'alice@test.com',
      preferredLanguage: 'en',
    });
  });

  // TC-UC1-023 — localization-specific
  test('normalizes preferred_language "tr-TR" to "tr" before inserting', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          dbRowForNewUser({
            name: 'Ayşe',
            email: 'ayse@test.com',
            preferred_language: 'tr',
          }),
        ],
      });

    const result = await authService.register({
      name: 'Ayşe',
      email: 'ayse@test.com',
      password: 'Passw0rd!',
      preferred_language: 'tr-TR',
    });

    const insertParams = query.mock.calls[1][1];
    expect(insertParams[4]).toBe('tr');

    expect(result.user.preferred_language).toBe('tr');
    expect(generateToken.mock.calls[0][0].preferredLanguage).toBe('tr');
  });

  // TC-UC1-024 — localization-specific
  test('stores a Turkish name with ğ, ş, ç, ö, İ characters unchanged', async () => {
    const turkishName = 'Gülşen İçöz';
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          dbRowForNewUser({
            name: turkishName,
            email: 'gulsen@test.com',
            preferred_language: 'tr',
          }),
        ],
      });

    const result = await authService.register({
      name: turkishName,
      email: 'gulsen@test.com',
      password: 'Passw0rd!',
      preferred_language: 'tr',
    });

    const insertParams = query.mock.calls[1][1];
    expect(insertParams[1]).toBe(turkishName);
    expect(result.user.name).toBe(turkishName);
    // Codepoint-level sanity check: ensure no UTF-8 corruption occurred.
    expect(insertParams[1]).toMatch(/[ğşçöİı]/);
  });

  // TC-UC1-025
  test('rejects with 400 when the email already belongs to an existing account', async () => {
    query.mockResolvedValueOnce({
      rows: [
        dbRowForNewUser({
          name: 'Taken',
          email: 'taken@test.com',
          preferred_language: 'en',
        }),
      ],
    });

    await expect(
      authService.register({
        name: 'New User',
        email: 'taken@test.com',
        password: 'Passw0rd!',
        preferred_language: 'en',
      }),
    ).rejects.toMatchObject({
      message: 'An account with this email address already exists.',
      statusCode: 400,
    });

    // Only the lookup ran; no INSERT and no hashing wasted.
    expect(query).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(generateToken).not.toHaveBeenCalled();
  });
});
