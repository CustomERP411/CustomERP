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
  test('TC-UC1-019a — exposes the exact list of supported languages (en, tr)', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'tr']);
    expect(DEFAULT_LANGUAGE).toBe('en');
    tcLog('TC-UC1-019a', {
      expected: "SUPPORTED=['en','tr'], DEFAULT='en'",
      got: { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE },
    });
  });

  // TC-UC1-019
  test('TC-UC1-019 — missing, null, or empty input defaults to English', () => {
    const inputs = [undefined, null, '', '   '];
    const got = inputs.map(normalizeLanguage);
    got.forEach((r) => expect(r).toBe('en'));
    tcLog('TC-UC1-019', {
      input: ['undefined', 'null', '""', '"   "'],
      expected: "'en' for each",
      got,
    });
  });

  // TC-UC1-020
  test('TC-UC1-020 — locale tags and mixed case are normalized to the language prefix', () => {
    const cases = [
      ['tr-TR', 'tr'],
      ['TR', 'tr'],
      [' tr ', 'tr'],
      ['en-US', 'en'],
      ['EN', 'en'],
    ];
    const got = cases.map(([inp]) => normalizeLanguage(inp));
    cases.forEach(([, exp], i) => expect(got[i]).toBe(exp));
    tcLog('TC-UC1-020', {
      input: cases.map((c) => c[0]),
      expected: cases.map((c) => c[1]),
      got,
    });
  });

  // TC-UC1-021
  test('TC-UC1-021 — unsupported languages fall back to English so the DB constraint is never violated', () => {
    const inputs = ['fr', 'de-DE', 'zh', 42, {}];
    const got = inputs.map(normalizeLanguage);
    got.forEach((r) => expect(r).toBe('en'));
    tcLog('TC-UC1-021', {
      input: ['"fr"', '"de-DE"', '"zh"', '42', '{}'],
      expected: "'en' for each",
      got,
    });
  });
});
