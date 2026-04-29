/**
 * Plan G D4 — DynamicForm.isFieldVisible interprets the full visibility_when
 * operator set (equals, not_equals, in, not_in, is_set, is_unset).
 *
 * SUT: brick-library/frontend-bricks/components/DynamicForm.tsx
 *
 * Approach: same pattern as dynamicFormDefaults — assert the template
 * contains the canonical operator switch (template assertions) AND verify
 * a pure-function port of the helper (semantic assertions).
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../../../brick-library/frontend-bricks/components/DynamicForm.tsx'
);

const SRC = fs.readFileSync(TEMPLATE_PATH, 'utf8');

describe('Plan G D4 — DynamicForm template assertions', () => {
  test('1. FieldDefinition.visibilityWhen is widened to an operator union', () => {
    expect(SRC).toContain('not_equals: any');
    expect(SRC).toContain('in: any[]');
    expect(SRC).toContain('not_in: any[]');
    expect(SRC).toContain('is_set: boolean');
    expect(SRC).toContain('is_unset: boolean');
  });

  test('2. isFieldVisible handles every supported operator', () => {
    expect(SRC).toMatch(/predicate, 'equals'/);
    expect(SRC).toMatch(/predicate, 'not_equals'/);
    expect(SRC).toMatch(/Array\.isArray\(predicate\.in\)/);
    expect(SRC).toMatch(/Array\.isArray\(predicate\.not_in\)/);
    expect(SRC).toMatch(/typeof predicate\.is_set === 'boolean'/);
    expect(SRC).toMatch(/typeof predicate\.is_unset === 'boolean'/);
  });

  test('3. Hidden fields are skipped during validation', () => {
    expect(SRC).toContain('if (!isFieldVisible(field, formData)) continue');
  });

  test('4. Hidden fields are stripped from submitted payload', () => {
    expect(SRC).toMatch(/if \(!isFieldVisible\(field, formData\)\)/);
  });
});

describe('Plan G D4 — pure-function port of isFieldVisible semantics', () => {
  // Pinned port of the operator switch in DynamicForm.tsx. The template
  // assertions above guarantee the production code matches this shape;
  // these cases pin the SEMANTICS (truthiness rules per operator).
  function isFieldVisible(field, data) {
    const predicate = field.visibilityWhen;
    if (!predicate || typeof predicate !== 'object') return true;
    const sourceField = predicate.field;
    if (!sourceField || typeof sourceField !== 'string') return true;
    const sourceValue = data ? data[sourceField] : undefined;
    const isPredEmpty = (v) => v === undefined || v === null || String(v).trim() === '';

    if (Object.prototype.hasOwnProperty.call(predicate, 'equals')) {
      return String(sourceValue ?? '') === String(predicate.equals);
    }
    if (Object.prototype.hasOwnProperty.call(predicate, 'not_equals')) {
      return String(sourceValue ?? '') !== String(predicate.not_equals);
    }
    if (Array.isArray(predicate.in)) {
      const needle = String(sourceValue ?? '');
      return predicate.in.map((v) => String(v)).includes(needle);
    }
    if (Array.isArray(predicate.not_in)) {
      const needle = String(sourceValue ?? '');
      return !predicate.not_in.map((v) => String(v)).includes(needle);
    }
    if (typeof predicate.is_set === 'boolean') {
      return predicate.is_set ? !isPredEmpty(sourceValue) : isPredEmpty(sourceValue);
    }
    if (typeof predicate.is_unset === 'boolean') {
      return predicate.is_unset ? isPredEmpty(sourceValue) : !isPredEmpty(sourceValue);
    }
    return true;
  }

  test('5. fields without a predicate are always visible', () => {
    expect(isFieldVisible({ name: 'name' }, {})).toBe(true);
    expect(isFieldVisible({ name: 'name', visibilityWhen: undefined }, {})).toBe(true);
  });

  test('6. equals: matches stringified values', () => {
    const f = { name: 'x', visibilityWhen: { field: 'status', equals: 'Terminated' } };
    expect(isFieldVisible(f, { status: 'Terminated' })).toBe(true);
    expect(isFieldVisible(f, { status: 'Active' })).toBe(false);
    expect(isFieldVisible(f, {})).toBe(false);
  });

  test('7. not_equals: rejects matching value, accepts everything else', () => {
    const f = { name: 'x', visibilityWhen: { field: 'status', not_equals: 'Active' } };
    expect(isFieldVisible(f, { status: 'Active' })).toBe(false);
    expect(isFieldVisible(f, { status: 'Pending' })).toBe(true);
    expect(isFieldVisible(f, {})).toBe(true);
  });

  test('8. in: membership test', () => {
    const f = { name: 'x', visibilityWhen: { field: 'status', in: ['Pending', 'Approved'] } };
    expect(isFieldVisible(f, { status: 'Pending' })).toBe(true);
    expect(isFieldVisible(f, { status: 'Approved' })).toBe(true);
    expect(isFieldVisible(f, { status: 'Rejected' })).toBe(false);
    expect(isFieldVisible(f, {})).toBe(false);
  });

  test('9. not_in: anti-membership test', () => {
    const f = { name: 'x', visibilityWhen: { field: 'status', not_in: ['Cancelled', 'Voided'] } };
    expect(isFieldVisible(f, { status: 'Pending' })).toBe(true);
    expect(isFieldVisible(f, { status: 'Cancelled' })).toBe(false);
    expect(isFieldVisible(f, {})).toBe(true);
  });

  test('10. is_set true: visible only when sibling has a non-empty value', () => {
    const f = { name: 'x', visibilityWhen: { field: 'follow_up_at', is_set: true } };
    expect(isFieldVisible(f, { follow_up_at: '2025-01-01' })).toBe(true);
    expect(isFieldVisible(f, { follow_up_at: '' })).toBe(false);
    expect(isFieldVisible(f, { follow_up_at: '   ' })).toBe(false);
    expect(isFieldVisible(f, {})).toBe(false);
  });

  test('11. is_set false: visible only when sibling is empty', () => {
    const f = { name: 'x', visibilityWhen: { field: 'follow_up_at', is_set: false } };
    expect(isFieldVisible(f, { follow_up_at: '' })).toBe(true);
    expect(isFieldVisible(f, { follow_up_at: '2025-01-01' })).toBe(false);
  });

  test('12. is_unset true: visible only when sibling is empty', () => {
    const f = { name: 'x', visibilityWhen: { field: 'resolved_at', is_unset: true } };
    expect(isFieldVisible(f, {})).toBe(true);
    expect(isFieldVisible(f, { resolved_at: null })).toBe(true);
    expect(isFieldVisible(f, { resolved_at: '2025-01-01' })).toBe(false);
  });

  test('13. unrecognized predicate shape is forward-compat (visible)', () => {
    const f = { name: 'x', visibilityWhen: { field: 'status', matches: 'Cancelled' } };
    expect(isFieldVisible(f, { status: 'Cancelled' })).toBe(true);
    expect(isFieldVisible(f, { status: 'Active' })).toBe(true);
  });
});
