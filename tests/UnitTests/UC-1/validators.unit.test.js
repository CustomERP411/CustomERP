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
  test('TC-UC1-006 — rejects an empty string with a descriptive message', () => {
    const input = '';
    const expected = { valid: false, message: 'Name is required' };
    const got = validateName(input);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-006', { input, expected, got });
  });

  // TC-UC1-007
  test('TC-UC1-007 — rejects a single-character name as too short', () => {
    const input = 'A';
    const expected = { valid: false, message: 'Name must be at least 2 characters' };
    const got = validateName(input);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-007', { input, expected, got });
  });

  // TC-UC1-008
  test('TC-UC1-008 — accepts a 2-character name after trimming surrounding whitespace', () => {
    const input = '  Ab  ';
    const expected = { valid: true };
    const got = validateName(input);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-008', { input, expected, got });
  });

  // TC-UC1-009
  test('TC-UC1-009 — rejects a 101-character name as too long', () => {
    const longName = 'a'.repeat(101);
    const expected = { valid: false, message: 'Name must be less than 100 characters' };
    const got = validateName(longName);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-009', { input: `"a".repeat(101) (length=${longName.length})`, expected, got });
  });

  // TC-UC1-010 — localization-specific
  test('TC-UC1-010 — accepts a name containing Turkish characters (ğ, ş, ç, ö, İ)', () => {
    const inputs = ['Gülşen İçöz', 'Çağrı Öztürk', 'İbrahim'];
    const got = inputs.map(validateName);
    got.forEach((r) => expect(r).toEqual({ valid: true }));
    tcLog('TC-UC1-010', { input: inputs, expected: '{valid:true} for each', got });
  });

  // TC-UC1-011
  test('TC-UC1-011 — rejects non-string inputs (number, null, undefined)', () => {
    const expected = { valid: false, message: 'Name is required' };
    const inputs = [12345, null, undefined];
    const got = inputs.map(validateName);
    got.forEach((r) => expect(r).toEqual(expected));
    tcLog('TC-UC1-011', { input: ['12345', 'null', 'undefined'], expected, got });
  });
});

describe('UC-1 / validators / isValidEmail', () => {
  // TC-UC1-012
  test('TC-UC1-012 — accepts a standard email address', () => {
    const inputs = ['user@example.com', 'ayse.yilmaz@sirket.com.tr'];
    const got = inputs.map(isValidEmail);
    got.forEach((r) => expect(r).toBe(true));
    tcLog('TC-UC1-012', { input: inputs, expected: 'true for each', got });
  });

  // TC-UC1-013
  test('TC-UC1-013 — rejects a string with no @ sign', () => {
    const input = 'user.example.com';
    const got = isValidEmail(input);
    expect(got).toBe(false);
    tcLog('TC-UC1-013', { input, expected: false, got });
  });

  // TC-UC1-014
  test('TC-UC1-014 — rejects addresses missing the domain portion', () => {
    const inputs = ['user@', 'user@example', '@example.com'];
    const got = inputs.map(isValidEmail);
    got.forEach((r) => expect(r).toBe(false));
    tcLog('TC-UC1-014', { input: inputs, expected: 'false for each', got });
  });
});

describe('UC-1 / validators / validatePassword', () => {
  // TC-UC1-015
  test('TC-UC1-015 — rejects a password that is 7 characters long', () => {
    const input = 'Abc1234';
    const expected = { valid: false, message: 'Password must be at least 8 characters' };
    const got = validatePassword(input);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-015', { input, expected, got });
  });

  // TC-UC1-016
  test('TC-UC1-016 — accepts a password that is exactly 8 characters long', () => {
    const input = 'Abcd1234';
    const expected = { valid: true };
    const got = validatePassword(input);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-016', { input, expected, got });
  });

  // TC-UC1-017
  test('TC-UC1-017 — rejects a password that is 129 characters long', () => {
    const tooLong = 'a'.repeat(129);
    const expected = { valid: false, message: 'Password must be less than 128 characters' };
    const got = validatePassword(tooLong);
    expect(got).toEqual(expected);
    tcLog('TC-UC1-017', { input: `"a".repeat(129) (length=${tooLong.length})`, expected, got });
  });

  test('TC-UC1-017b — rejects an empty/missing password', () => {
    const expected = { valid: false, message: 'Password is required' };
    const inputs = ['', undefined];
    const got = inputs.map(validatePassword);
    got.forEach((r) => expect(r).toEqual(expected));
    tcLog('TC-UC1-017b', { input: ['""', 'undefined'], expected, got });
  });
});

describe('UC-1 / validators / sanitize', () => {
  // TC-UC1-018
  test('TC-UC1-018 — escapes HTML-sensitive characters so raw <, >, ", \' are not persisted', () => {
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

    tcLog('TC-UC1-018', {
      input,
      expected: 'escaped &lt; &gt; &quot; &#x27; and no raw <, >, ", \'',
      got: out,
    });
  });

  test('TC-UC1-018b — preserves Turkish characters while escaping HTML characters', () => {
    const input = '  Gülşen <b>İçöz</b>  ';
    const out = sanitize(input);
    expect(out).toContain('Gülşen');
    expect(out).toContain('İçöz');
    expect(out).toContain('&lt;b&gt;');
    expect(out.startsWith(' ')).toBe(false);
    expect(out.endsWith(' ')).toBe(false);
    tcLog('TC-UC1-018b', {
      input,
      expected: 'trimmed + TR letters intact + <b> -> &lt;b&gt;',
      got: out,
    });
  });
});
