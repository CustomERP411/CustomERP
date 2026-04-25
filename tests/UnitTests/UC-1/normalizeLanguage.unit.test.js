/**
 * UC-1 Register Account — normalizeLanguage unit tests
 *
 * Covers TC-UC1-019 through TC-UC1-021.
 * SUT: platform/backend/src/services/authService.js (exported helper).
 *
 * normalizeLanguage is the single choke point that guarantees the value
 * written into users.preferred_language satisfies the DB CHECK
 * constraint (IN ('en', 'tr')) added by migration 014_user_language.sql.
 * These tests exercise the happy, locale-tag, and fallback paths that
 * are relied on by the register flow and by the JWT payload.
 */

// The authService module constructs nothing at import time that hits
// the database, but it does require('../config/database') which creates
// a pg Pool. We mock that module to avoid real network/DNS in unit tests.
jest.mock('../../../platform/backend/src/config/database', () => ({
  query: jest.fn(),
  pool: { connect: jest.fn(), on: jest.fn() },
}));

// `uuid` is redirected to a local CJS stub via moduleNameMapper in
// jest.config.js (see note there), so no per-file mock is needed.

const { normalizeLanguage, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } = require(
  '../../../platform/backend/src/services/authService',
);

describe('UC-1 / normalizeLanguage', () => {
  test('exposes the exact list of supported languages (en, tr)', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'tr']);
    expect(DEFAULT_LANGUAGE).toBe('en');
  });

  // TC-UC1-019
  test('missing, null, or empty input defaults to English', () => {
    expect(normalizeLanguage(undefined)).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
    expect(normalizeLanguage('')).toBe('en');
    expect(normalizeLanguage('   ')).toBe('en');
  });

  // TC-UC1-020
  test('locale tags and mixed case are normalized to the language prefix', () => {
    expect(normalizeLanguage('tr-TR')).toBe('tr');
    expect(normalizeLanguage('TR')).toBe('tr');
    expect(normalizeLanguage(' tr ')).toBe('tr');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('EN')).toBe('en');
  });

  // TC-UC1-021
  test('unsupported languages fall back to English so the DB constraint is never violated', () => {
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage('de-DE')).toBe('en');
    expect(normalizeLanguage('zh')).toBe('en');
    // Non-string input is also handled gracefully.
    expect(normalizeLanguage(42)).toBe('en');
    expect(normalizeLanguage({})).toBe('en');
  });
});
