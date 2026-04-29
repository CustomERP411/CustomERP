// Plan D follow-up #7: generated backend validation copy tests.
//
// validationCodegen now emits localized validation messages per
// project language. We exercise both 'en' (English fallback) and 'tr'
// (Turkish) and assert the emitted JS source contains the expected
// localized error strings.

const ValidationCodegen = require(
  '../../../../platform/assembler/generators/backend/validationCodegen'
);

// Build a minimal stand-in object with the same `this`-bound helpers the
// real BackendGenerator exposes so the codegen functions execute.
function makeHarness(language) {
  const harness = {
    _language: language,
    _escapeJsString(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
    },
  };
  Object.assign(harness, ValidationCodegen);
  return harness;
}

function buildSnippet(language, entity) {
  const harness = makeHarness(language);
  return harness._buildCreateValidationSnippet(entity, [entity]);
}

const REQUIRED_NAME_ENTITY = {
  slug: 'leaves',
  display_name: 'Leaves',
  fields: [
    { name: 'name', type: 'string', label: 'Name', required: true, max_length: 80, min_length: 2 },
    { name: 'priority', type: 'string', label: 'Priority', options: ['Low', 'High'] },
    { name: 'amount', type: 'number', label: 'Amount' },
    { name: 'code', type: 'string', label: 'Code', unique: true },
  ],
};

describe('UC-7.5 / generatedValidationCopy', () => {
  // TC-UC7.5-VAL-001
  test('TC-UC7.5-VAL-001 — English project keeps the existing English copy', () => {
    const code = buildSnippet('en', REQUIRED_NAME_ENTITY);
    expect(code).toContain("fieldErrors['name'] = 'Name is required'");
    expect(code).toContain("fieldErrors['name'] = 'Name must be at least 2 characters'");
    expect(code).toContain("fieldErrors['name'] = 'Name must be at most 80 characters'");
    expect(code).toContain("fieldErrors['priority'] = 'Priority must be one of: Low, High'");
    expect(code).toContain("fieldErrors['amount'] = 'Amount must be a number'");
    expect(code).toContain("fieldErrors['code'] = 'Code must be unique'");
  });

  // TC-UC7.5-VAL-002
  test('TC-UC7.5-VAL-002 — Turkish project emits Turkish copy from validation.* keys', () => {
    const code = buildSnippet('tr', REQUIRED_NAME_ENTITY);
    expect(code).toContain("fieldErrors['name'] = 'Name zorunludur'");
    expect(code).toContain('Name en az 2 karakter olmalıdır');
    expect(code).toContain('Name en çok 80 karakter olmalıdır');
    expect(code).toContain('Priority şunlardan biri olmalıdır: Low, High');
    expect(code).toContain('Amount bir sayı olmalıdır');
    expect(code).toContain('Code benzersiz olmalıdır');
  });

  // TC-UC7.5-VAL-003
  test('TC-UC7.5-VAL-003 — labels with apostrophes are JS-escaped safely', () => {
    const entity = {
      slug: 'people',
      display_name: 'People',
      fields: [
        { name: 'name', type: 'string', label: "John's Name", required: true },
      ],
    };
    const code = buildSnippet('en', entity);
    expect(code).toContain("fieldErrors['name'] = 'John\\'s Name is required'");
  });
});
