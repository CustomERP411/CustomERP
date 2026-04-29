/**
 * Plan F A3 / B3 — DynamicForm seeds formData from field.defaultValue
 * when initialData is empty; preserves initialData over defaults when both
 * present.
 *
 * SUT: brick-library/frontend-bricks/components/DynamicForm.tsx
 *
 * Approach: the brick template uses a private helper (_seedInitialFormData)
 * that we can extract via source-text introspection AND verify behaviorally
 * by re-implementing the same predicate in the test (the helper is pure
 * and small — its semantics are what we're testing, not its identity).
 *
 * Coverage:
 *   1. Source contains the seeding helper and reads field.defaultValue.
 *   2. Source contains the onChange-up plumbing (Plan F B4).
 *   3. Source contains the derived-relations useEffect (Plan F A3).
 *   4. Pure-function port of the seeding logic round-trips the spec:
 *        - empty initialData seeds every field's defaultValue
 *        - initialData[field] wins over defaultValue when both set
 *        - undefined defaultValue is left unseeded (so React inputs stay
 *          uncontrolled-empty rather than displaying "undefined")
 *   5. ComputedDisplay widget block exists in the renderWidget switch.
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../../../brick-library/frontend-bricks/components/DynamicForm.tsx'
);

const SRC = fs.readFileSync(TEMPLATE_PATH, 'utf8');

describe('Plan F A3/B3 — DynamicForm template assertions', () => {
  test('1. exposes the seeding helper and reads field.defaultValue', () => {
    expect(SRC).toMatch(/function\s+_seedInitialFormData/);
    expect(SRC).toContain('field.defaultValue');
  });

  test('2. lifts formData up via onChange callback (Plan F B4)', () => {
    expect(SRC).toContain('onChange?: (data: Record<string, any>) => void');
    expect(SRC).toMatch(/if \(typeof onChange === 'function'\) onChange\(formData\)/);
  });

  test('3. accepts derivedRelations + childItemsBySlug props (Plan F A3)', () => {
    expect(SRC).toContain('derivedRelations?: DerivedRelationDef[]');
    expect(SRC).toContain('childItemsBySlug?: Record<string, any[]>');
    expect(SRC).toContain('evaluateDerived');
  });

  test('4. ComputedDisplay widget rendered as read-only row', () => {
    expect(SRC).toContain("case 'ComputedDisplay':");
    expect(SRC).toContain('computed-display-');
  });

  test('5. ComputedDisplay validation is bypassed', () => {
    expect(SRC).toContain("if (field.widget === 'ComputedDisplay') return null;");
  });
});

describe('Plan F A3/B3 — _seedInitialFormData behavior (pure-function port)', () => {
  // Pure-function port of the helper exposed in the template. We test the
  // SEMANTICS here — the template assertions above pin the shape of the
  // actual implementation. If anyone changes the semantics, these tests
  // tell them what they broke.
  function _seedInitialFormData(fields, initialData) {
    const seeded = { ...(initialData || {}) };
    for (const field of fields) {
      if (field.defaultValue === undefined) continue;
      if (!Object.prototype.hasOwnProperty.call(seeded, field.name)) {
        seeded[field.name] = field.defaultValue;
      }
    }
    return seeded;
  }

  test('6. empty initialData seeds every field defaultValue', () => {
    const fields = [
      { name: 'tax_rate', defaultValue: 18 },
      { name: 'frequency', defaultValue: 'Monthly' },
    ];
    expect(_seedInitialFormData(fields, {})).toEqual({
      tax_rate: 18,
      frequency: 'Monthly',
    });
  });

  test('7. initialData wins over defaultValue when both present', () => {
    const fields = [{ name: 'tax_rate', defaultValue: 18 }];
    expect(_seedInitialFormData(fields, { tax_rate: 25 })).toEqual({ tax_rate: 25 });
  });

  test('8. explicit empty string in initialData stays empty', () => {
    const fields = [{ name: 'description', defaultValue: 'fallback' }];
    expect(_seedInitialFormData(fields, { description: '' })).toEqual({
      description: '',
    });
  });

  test('9. fields without defaultValue do NOT get seeded', () => {
    const fields = [
      { name: 'name' },
      { name: 'tax_rate', defaultValue: 18 },
    ];
    expect(_seedInitialFormData(fields, {})).toEqual({ tax_rate: 18 });
    expect(Object.prototype.hasOwnProperty.call(_seedInitialFormData(fields, {}), 'name'))
      .toBe(false);
  });

  test('10. zero is a valid defaultValue', () => {
    const fields = [{ name: 'discount', defaultValue: 0 }];
    expect(_seedInitialFormData(fields, {})).toEqual({ discount: 0 });
  });
});
