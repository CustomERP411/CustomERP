// Plan E G3 — visibility_when wiring through the field-definition emitter.
//
// SUT:
//   platform/assembler/generators/frontend/fieldUtils.js (_generateFieldDefinitions)
//   brick-library/frontend-bricks/components/DynamicForm.tsx (template assertion)
//
// Coverage:
//   1. _generateFieldDefinitions emits `visibilityWhen: { field, equals }`
//      when the SDF field carries `visibility_when`.
//   2. Fields without `visibility_when` do NOT emit the prop.
//   3. `help` text is threaded too (Plan E G2 salary help case).
//   4. Verifies the brick template's isFieldVisible/handleSubmit logic
//      respects the predicate (string assertion against the source).

const fs = require('fs');
const path = require('path');
const fieldUtils = require(
  '../../../../platform/assembler/generators/frontend/fieldUtils'
);

function makeHost(language = 'en') {
  return {
    _language: language,
    _formatLabel: fieldUtils._formatLabel,
    _capitalize: fieldUtils._capitalize,
    _escapeJsString: fieldUtils._escapeJsString,
    _resolveReferenceTargetLabel: fieldUtils._resolveReferenceTargetLabel,
    _resolveColumnLabel: fieldUtils._resolveColumnLabel,
    _resolveFieldLabelForForm: fieldUtils._resolveFieldLabelForForm,
    _getWidgetForType: fieldUtils._getWidgetForType,
    _generateFieldDefinitions: fieldUtils._generateFieldDefinitions,
  };
}

describe('Plan E G3 — visibility_when emitter', () => {
  test('1. emits visibilityWhen prop when SDF field carries visibility_when', () => {
    const host = makeHost();
    const fields = [
      { name: 'status', type: 'string', options: ['Active', 'Terminated'] },
      { name: 'termination_date', type: 'date',
        visibility_when: { field: 'status', equals: 'Terminated' } },
    ];
    const out = host._generateFieldDefinitions(fields, {}, []);
    expect(out).toContain("name: 'termination_date'");
    // Plan G D3 — emitter now serializes the predicate via JSON.stringify
    // so all six operators round-trip cleanly (including arrays for `in`).
    expect(out).toContain('visibilityWhen: {"field":"status","equals":"Terminated"}');
  });

  test('2. fields without visibility_when do NOT emit visibilityWhen', () => {
    const host = makeHost();
    const fields = [
      { name: 'first_name', type: 'string' },
    ];
    const out = host._generateFieldDefinitions(fields, {}, []);
    expect(out).toContain("name: 'first_name'");
    expect(out).not.toContain('visibilityWhen');
  });

  test('3. help text threads through to the emitter', () => {
    const host = makeHost();
    const fields = [
      { name: 'salary', type: 'decimal', help: 'Current rate; the ledger is authoritative for history.' },
    ];
    const out = host._generateFieldDefinitions(fields, {}, []);
    expect(out).toContain("help: 'Current rate; the ledger is authoritative for history.'");
  });

  test('4. malformed visibility_when (missing equals) is ignored', () => {
    const host = makeHost();
    const fields = [
      { name: 'termination_date', type: 'date',
        visibility_when: { field: 'status' } },
    ];
    const out = host._generateFieldDefinitions(fields, {}, []);
    expect(out).not.toContain('visibilityWhen');
  });

  test('5. malformed visibility_when (missing field) is ignored', () => {
    const host = makeHost();
    const fields = [
      { name: 'termination_date', type: 'date',
        visibility_when: { equals: 'Terminated' } },
    ];
    const out = host._generateFieldDefinitions(fields, {}, []);
    expect(out).not.toContain('visibilityWhen');
  });

  test('6. visibility_when escaping handles single quotes in the equals value', () => {
    const host = makeHost();
    const fields = [
      { name: 'reason', type: 'string',
        visibility_when: { field: 'status', equals: "Doesn't apply" } },
    ];
    const out = host._generateFieldDefinitions(fields, {}, []);
    // Plan G D3 — JSON.stringify wraps strings in double quotes so an
    // embedded apostrophe doesn't need escaping. The emitted line stays
    // valid JS regardless of the value's quote characters.
    expect(out).toContain('visibilityWhen: {"field":"status","equals":"Doesn\'t apply"}');
  });
});

describe('Plan E G3 — DynamicForm template honors visibility_when', () => {
  const TEMPLATE_PATH = path.resolve(
    __dirname,
    '../../../../brick-library/frontend-bricks/components/DynamicForm.tsx'
  );
  const templateSrc = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  test('1. template defines isFieldVisible helper', () => {
    expect(templateSrc).toMatch(/isFieldVisible\s*=\s*\(/);
  });

  test('2. template guards rendering with isFieldVisible', () => {
    // The render loop wraps each field in `if (!isFieldVisible(...)) return null;`
    expect(templateSrc).toContain('if (!isFieldVisible(field, formData)) return null;');
  });

  test('3. template skips validation for hidden fields', () => {
    expect(templateSrc).toMatch(/if \(!isFieldVisible\(field, formData\)\) continue/);
  });

  test('4. template strips hidden fields from submit payload', () => {
    expect(templateSrc).toMatch(/delete submitPayload\[field\.name\]/);
  });

  test('5. template declares visibilityWhen on FieldDefinition (Plan G operator union)', () => {
    // Plan G D4 — widened from `{ field, equals }` to a discriminated union
    // covering all six operators.
    expect(templateSrc).toContain('visibilityWhen?: { field: string }');
    expect(templateSrc).toContain('| { equals: any }');
    expect(templateSrc).toContain('| { in: any[] }');
    expect(templateSrc).toContain('| { is_set: boolean }');
  });
});
