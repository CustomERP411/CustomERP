/**
 * UC-1 Register Account — Validators unit tests
 *
 * Covers TC-UC1-006 through TC-UC1-018.
 * SUT: platform/backend/src/utils/validators.js
 *
 * These tests pin down the input-validation rules exercised by
 * POST /api/auth/register: name length/type, email format, password
 * length bounds, and basic XSS sanitization. Turkish characters are
 * exercised explicitly because the platform now ships TR localization
 * and names can contain letters like ğ, ş, ç, ö, İ.
 */

const {
  isValidEmail,
  validatePassword,
  validateName,
  sanitize,
} = require('../../../platform/backend/src/utils/validators');

describe('UC-1 / validators / validateName', () => {
  // TC-UC1-006
  test('rejects an empty string with a descriptive message', () => {
    expect(validateName('')).toEqual({
      valid: false,
      message: 'Name is required',
    });
  });

  // TC-UC1-007
  test('rejects a single-character name as too short', () => {
    expect(validateName('A')).toEqual({
      valid: false,
      message: 'Name must be at least 2 characters',
    });
  });

  // TC-UC1-008
  test('accepts a 2-character name after trimming surrounding whitespace', () => {
    expect(validateName('  Ab  ')).toEqual({ valid: true });
  });

  // TC-UC1-009
  test('rejects a 101-character name as too long', () => {
    const longName = 'a'.repeat(101);
    expect(validateName(longName)).toEqual({
      valid: false,
      message: 'Name must be less than 100 characters',
    });
  });

  // TC-UC1-010 — localization-specific
  test('accepts a name containing Turkish characters (ğ, ş, ç, ö, İ)', () => {
    expect(validateName('Gülşen İçöz')).toEqual({ valid: true });
    expect(validateName('Çağrı Öztürk')).toEqual({ valid: true });
    expect(validateName('İbrahim')).toEqual({ valid: true });
  });

  // TC-UC1-011
  test('rejects non-string inputs (number, null, undefined)', () => {
    const expected = { valid: false, message: 'Name is required' };
    expect(validateName(12345)).toEqual(expected);
    expect(validateName(null)).toEqual(expected);
    expect(validateName(undefined)).toEqual(expected);
  });
});

describe('UC-1 / validators / isValidEmail', () => {
  // TC-UC1-012
  test('accepts a standard email address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('ayse.yilmaz@sirket.com.tr')).toBe(true);
  });

  // TC-UC1-013
  test('rejects a string with no @ sign', () => {
    expect(isValidEmail('user.example.com')).toBe(false);
  });

  // TC-UC1-014
  test('rejects addresses missing the domain portion', () => {
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@example')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
  });
});

describe('UC-1 / validators / validatePassword', () => {
  // TC-UC1-015
  test('rejects a password that is 7 characters long', () => {
    expect(validatePassword('Abc1234')).toEqual({
      valid: false,
      message: 'Password must be at least 8 characters',
    });
  });

  // TC-UC1-016
  test('accepts a password that is exactly 8 characters long', () => {
    expect(validatePassword('Abcd1234')).toEqual({ valid: true });
  });

  // TC-UC1-017
  test('rejects a password that is 129 characters long', () => {
    const tooLong = 'a'.repeat(129);
    expect(validatePassword(tooLong)).toEqual({
      valid: false,
      message: 'Password must be less than 128 characters',
    });
  });

  test('rejects an empty/missing password', () => {
    expect(validatePassword('')).toEqual({
      valid: false,
      message: 'Password is required',
    });
    expect(validatePassword(undefined)).toEqual({
      valid: false,
      message: 'Password is required',
    });
  });
});

describe('UC-1 / validators / sanitize', () => {
  // TC-UC1-018
  test('escapes HTML-sensitive characters so raw <, >, ", \' are not persisted', () => {
    const input = `<script>alert("x")</script> O'Brien`;
    const out = sanitize(input);

    expect(out).not.toMatch(/</);
    expect(out).not.toMatch(/>/);
    expect(out).not.toMatch(/"/);
    expect(out).not.toMatch(/'/);

    expect(out).toContain('&lt;');
    expect(out).toContain('&gt;');
    expect(out).toContain('&quot;');
    expect(out).toContain('&#x27;');
  });

  test('preserves Turkish characters while escaping HTML characters', () => {
    // Names with Turkish letters are a primary reason this sanitizer must
    // only touch the specific HTML-unsafe characters.
    const out = sanitize('  Gülşen <b>İçöz</b>  ');
    expect(out).toContain('Gülşen');
    expect(out).toContain('İçöz');
    expect(out).toContain('&lt;b&gt;');
    expect(out.startsWith(' ')).toBe(false);
    expect(out.endsWith(' ')).toBe(false);
  });
});
