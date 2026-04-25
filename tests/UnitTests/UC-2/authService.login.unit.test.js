/**
 * UC-2 Login — authService.login unit tests
 *
 * Covers TC-UC2-011 through TC-UC2-019.
 * SUT: platform/backend/src/services/authService.js
 *
 * Branches exercised:
 *   - Unknown email        → 401 (generic message, no enumeration)
 *   - deleted_at set        → 401 "deactivated"
 *   - blocked_at set        → 403 with `code: 'ACCOUNT_BLOCKED'`
 *                             + message that includes the block reason
 *                             and CONTACT_EMAIL env var (or default)
 *   - Password mismatch     → 401 (same generic message)
 *   - Happy path            → token + user with preferred_language
 *                             normalized via normalizeLanguage()
 *
 * Turkish localization coverage:
 *   - DB row stores 'tr-TR' (legacy/locale tag) → must surface as 'tr'
 *     in both the user payload and the JWT's `preferredLanguage` field.
 *   - DB row stores an unsupported value ('fr') → must defensively
 *     normalize to 'en' to protect downstream i18n consumers.
 */

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

const { query } = require('../../../platform/backend/src/config/database');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../../../platform/backend/src/utils/jwt');
const authService = require('../../../platform/backend/src/services/authService');

/**
 * Produces a DB row matching the SELECT in authService.findByEmail.
 */
function userRow(overrides = {}) {
  return {
    user_id: '00000000-0000-0000-0000-000000000001',
    name: 'User',
    email: 'user@test.com',
    password_hash: '$2a$10$fakehashvalue',
    is_admin: false,
    preferred_language: 'en',
    deleted_at: null,
    blocked_at: null,
    block_reason: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('UC-2 / authService.login', () => {
  beforeEach(() => {
    generateToken.mockReturnValue('signed.jwt.token');
    // Clean env between tests so TC-UC2-013 and TC-UC2-014 stay independent.
    delete process.env.CONTACT_EMAIL;
  });

  // TC-UC2-011
  test('TC-UC2-011 — rejects with generic 401 when the email is not in the database', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      authService.login({ email: 'missing@test.com', password: 'Passw0rd!' }),
    ).rejects.toMatchObject({
      message: 'The email address or password you entered is incorrect. Please try again.',
      statusCode: 401,
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(generateToken).not.toHaveBeenCalled();
  });

  // TC-UC2-012
  test('TC-UC2-012 — rejects soft-deleted accounts with a "deactivated" 401 message', async () => {
    query.mockResolvedValueOnce({
      rows: [userRow({ deleted_at: new Date('2026-02-01T00:00:00Z') })],
    });

    await expect(
      authService.login({ email: 'gone@test.com', password: 'Passw0rd!' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'Account has been deactivated. Please contact support.',
    });

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  // TC-UC2-013
  test('TC-UC2-013 — blocked account returns 403 with ACCOUNT_BLOCKED code, reason, and CONTACT_EMAIL', async () => {
    process.env.CONTACT_EMAIL = 'help@customerp.io';
    query.mockResolvedValueOnce({
      rows: [
        userRow({
          blocked_at: new Date('2026-03-01T00:00:00Z'),
          block_reason: 'suspicious login activity',
        }),
      ],
    });

    let caught;
    try {
      await authService.login({ email: 'blocked@test.com', password: 'Passw0rd!' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(403);
    expect(caught.code).toBe('ACCOUNT_BLOCKED');
    expect(caught.message).toContain('suspicious login activity');
    expect(caught.message).toContain('help@customerp.io');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  // TC-UC2-014
  test('TC-UC2-014 — blocked account with no reason uses "suspicious activity" + default support email', async () => {
    query.mockResolvedValueOnce({
      rows: [
        userRow({
          blocked_at: new Date('2026-03-01T00:00:00Z'),
          block_reason: null,
        }),
      ],
    });

    let caught;
    try {
      await authService.login({ email: 'blocked@test.com', password: 'Passw0rd!' });
    } catch (e) {
      caught = e;
    }

    expect(caught.statusCode).toBe(403);
    expect(caught.code).toBe('ACCOUNT_BLOCKED');
    expect(caught.message).toContain('suspicious activity');
    expect(caught.message).toContain('support@example.com');
  });

  // TC-UC2-015
  test('TC-UC2-015 — wrong password returns the SAME generic 401 as unknown email', async () => {
    query.mockResolvedValueOnce({ rows: [userRow()] });
    bcrypt.compare.mockResolvedValueOnce(false);

    await expect(
      authService.login({ email: 'user@test.com', password: 'WrongPass1' }),
    ).rejects.toMatchObject({
      statusCode: 401,
      message: 'The email address or password you entered is incorrect. Please try again.',
    });

    expect(generateToken).not.toHaveBeenCalled();
  });

  // TC-UC2-016
  test('TC-UC2-016 — happy path returns token + user with preferred_language="en" and correct JWT payload', async () => {
    query.mockResolvedValueOnce({
      rows: [userRow({ preferred_language: 'en' })],
    });
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await authService.login({
      email: 'user@test.com',
      password: 'Passw0rd!',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('Passw0rd!', '$2a$10$fakehashvalue');
    expect(result).toMatchObject({
      token: 'signed.jwt.token',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'user@test.com',
        is_admin: false,
        preferred_language: 'en',
      },
    });

    expect(generateToken).toHaveBeenCalledTimes(1);
    const payload = generateToken.mock.calls[0][0];
    expect(payload).toMatchObject({
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'user@test.com',
      isAdmin: false,
      preferredLanguage: 'en',
    });
  });

  // TC-UC2-017 — localization-specific
  test('TC-UC2-017 — normalizes stored preferred_language "tr-TR" to "tr" in both response and JWT', async () => {
    query.mockResolvedValueOnce({
      rows: [userRow({ name: 'Ayşe', preferred_language: 'tr-TR' })],
    });
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await authService.login({
      email: 'ayse@test.com',
      password: 'Passw0rd!',
    });

    expect(result.user.preferred_language).toBe('tr');
    expect(result.user.name).toBe('Ayşe');
    expect(generateToken.mock.calls[0][0].preferredLanguage).toBe('tr');
  });

  // TC-UC2-018 — defensive for legacy rows written before migration 014
  test('TC-UC2-018 — defensively normalizes an unsupported stored language to "en"', async () => {
    query.mockResolvedValueOnce({
      rows: [userRow({ preferred_language: 'fr' })],
    });
    bcrypt.compare.mockResolvedValueOnce(true);

    const result = await authService.login({
      email: 'legacy@test.com',
      password: 'Passw0rd!',
    });

    expect(result.user.preferred_language).toBe('en');
    expect(generateToken.mock.calls[0][0].preferredLanguage).toBe('en');
  });

  // TC-UC2-019
  test('TC-UC2-019 — findByEmail is called with a trimmed, lowercased email', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      authService.login({ email: '  Ayse@Test.COM  ', password: 'Passw0rd!' }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/SELECT[\s\S]+FROM users/i);
    expect(params).toEqual(['ayse@test.com']);
  });
});
