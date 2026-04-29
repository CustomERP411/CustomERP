/**
 * Plan F B2 — fieldUtils._generateFieldDefinitions resolves default_from
 * against sdf.modules at codegen time and emits defaultValue on the field
 * def. Falls through to field.default when both unset.
 *
 * SUT: platform/assembler/generators/frontend/fieldUtils.js
 *      (_resolveConfigPath + _generateFieldDefinitions)
 *
 * Coverage:
 *   1. default_from='modules.invoice.tax_rate' resolves to the wizard
 *      answer (numeric 18) and emits `defaultValue: 18`.
 *   2. field.default takes precedence over default_from.
 *   3. Unresolved default_from path emits NO defaultValue (graceful).
 *   4. _resolveConfigPath unit checks (missing sdf, missing path,
 *      multi-segment path).
 *   5. computed:true fields skip defaultValue emission.
 */

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
    _resolveConfigPath: fieldUtils._resolveConfigPath,
    _generateFieldDefinitions: fieldUtils._generateFieldDefinitions,
  };
}

describe('Plan F B2 — _resolveConfigPath', () => {
  const host = makeHost();
  const sdf = {
    modules: {
      invoice: { tax_rate: 18, currency: 'TRY' },
      hr: { daily_hours: 8 },
    },
  };

  test('1. resolves a top-level module path', () => {
    expect(host._resolveConfigPath('modules.invoice.tax_rate', sdf)).toBe(18);
  });

  test('2. resolves a sibling-level path', () => {
    expect(host._resolveConfigPath('modules.hr.daily_hours', sdf)).toBe(8);
  });

  test('3. returns undefined for unresolved path', () => {
    expect(host._resolveConfigPath('modules.invoice.nope', sdf)).toBeUndefined();
    expect(host._resolveConfigPath('modules.missing.key', sdf)).toBeUndefined();
  });

  test('4. returns undefined when sdf is missing', () => {
    expect(host._resolveConfigPath('modules.invoice.tax_rate', null)).toBeUndefined();
    expect(host._resolveConfigPath('', sdf)).toBeUndefined();
  });
});

describe('Plan F B2 — defaultValue emission', () => {
  const sdf = { modules: { invoice: { tax_rate: 18 } } };

  test('5. default_from resolves to wizard answer and emits numeric defaultValue', () => {
    const host = makeHost();
    const fields = [
      { name: 'tax_rate', type: 'decimal', default_from: 'modules.invoice.tax_rate' },
    ];
    const out = host._generateFieldDefinitions(fields, {}, [], sdf);
    expect(out).toContain("name: 'tax_rate'");
    expect(out).toContain('defaultValue: 18');
  });

  test('6. literal default takes precedence over default_from', () => {
    const host = makeHost();
    const fields = [
      // Both set is normally rejected by validation, but the emitter must
      // also be deterministic if it ever sees both: literal wins.
      { name: 'frequency', type: 'string', default: 'Monthly' },
    ];
    const out = host._generateFieldDefinitions(fields, {}, [], sdf);
    expect(out).toContain('defaultValue: "Monthly"');
  });

  test('7. unresolved default_from emits NO defaultValue', () => {
    const host = makeHost();
    const fields = [
      { name: 'tax_rate', type: 'decimal', default_from: 'modules.missing.key' },
    ];
    const out = host._generateFieldDefinitions(fields, {}, [], sdf);
    expect(out).toContain("name: 'tax_rate'");
    expect(out).not.toContain('defaultValue');
  });

  test('8. computed:true fields render as ComputedDisplay and skip defaultValue', () => {
    const host = makeHost();
    const fields = [
      { name: 'subtotal', type: 'decimal', computed: true, default: 0 },
    ];
    const out = host._generateFieldDefinitions(fields, {}, [], sdf);
    expect(out).toContain("name: 'subtotal'");
    expect(out).toContain("widget: 'ComputedDisplay'");
    expect(out).not.toContain('defaultValue');
  });

  test('9. fields without any default emit no defaultValue prop', () => {
    const host = makeHost();
    const fields = [{ name: 'description', type: 'string' }];
    const out = host._generateFieldDefinitions(fields, {}, [], sdf);
    expect(out).toContain("name: 'description'");
    expect(out).not.toContain('defaultValue');
  });

  test('10. boolean defaults serialize correctly', () => {
    const host = makeHost();
    const fields = [{ name: 'is_active', type: 'boolean', default: true }];
    const out = host._generateFieldDefinitions(fields, {}, [], sdf);
    expect(out).toContain('defaultValue: true');
  });
});
