/**
 * Plan G D3 — fieldUtils._generateFieldDefinitions emits a JSON-serialized
 * predicate covering every supported visibility_when operator.
 *
 * SUT: platform/assembler/generators/frontend/fieldUtils.js
 *      (the visibility_when block inside _generateFieldDefinitions)
 *
 * Coverage:
 *  - Every operator round-trips into the field def via JSON.stringify so
 *    arrays for `in`/`not_in` and booleans for `is_set`/`is_unset`
 *    survive the boundary intact.
 *  - Predicates without a recognized comparator are dropped (forward-compat
 *    safety so an SDF authored against a future operator doesn't crash
 *    the codegen layer).
 */

const fieldUtils = require(
  '../../../../platform/assembler/generators/frontend/fieldUtils',
);

function makeHost() {
  return {
    _language: 'en',
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

function emit(field) {
  const host = makeHost();
  return host._generateFieldDefinitions([field], {}, [], {});
}

describe('Plan G D3 — visibilityWhen codegen serialization', () => {
  test('1. equals predicate emits canonical JSON', () => {
    const out = emit({
      name: 'termination_date',
      type: 'date',
      visibility_when: { field: 'status', equals: 'Terminated' },
    });
    expect(out).toContain('visibilityWhen: {"field":"status","equals":"Terminated"}');
  });

  test('2. not_equals predicate emits canonical JSON', () => {
    const out = emit({
      name: 'reactivation_date',
      type: 'date',
      visibility_when: { field: 'status', not_equals: 'Active' },
    });
    expect(out).toContain('visibilityWhen: {"field":"status","not_equals":"Active"}');
  });

  test('3. in predicate emits an array (verbatim list values)', () => {
    const out = emit({
      name: 'cancel_reason',
      type: 'text',
      visibility_when: { field: 'status', in: ['Cancelled', 'Voided'] },
    });
    expect(out).toContain('visibilityWhen: {"field":"status","in":["Cancelled","Voided"]}');
  });

  test('4. not_in predicate emits an array', () => {
    const out = emit({
      name: 'reschedule_date',
      type: 'date',
      visibility_when: { field: 'status', not_in: ['Done', 'Closed'] },
    });
    expect(out).toContain('visibilityWhen: {"field":"status","not_in":["Done","Closed"]}');
  });

  test('5. is_set predicate emits a boolean', () => {
    const out = emit({
      name: 'follow_up_note',
      type: 'text',
      visibility_when: { field: 'follow_up_at', is_set: true },
    });
    expect(out).toContain('visibilityWhen: {"field":"follow_up_at","is_set":true}');
  });

  test('6. is_unset predicate emits a boolean', () => {
    const out = emit({
      name: 'pending_note',
      type: 'text',
      visibility_when: { field: 'resolved_at', is_unset: true },
    });
    expect(out).toContain('visibilityWhen: {"field":"resolved_at","is_unset":true}');
  });

  test('7. predicate without a known comparator is dropped silently', () => {
    const out = emit({
      name: 'cancel_reason',
      type: 'text',
      visibility_when: { field: 'status', matches: 'Cancelled' },
    });
    expect(out).not.toContain('visibilityWhen');
  });

  test('8. predicate with empty `field` key is dropped silently', () => {
    const out = emit({
      name: 'cancel_reason',
      type: 'text',
      visibility_when: { field: '', equals: 'Cancelled' },
    });
    expect(out).not.toContain('visibilityWhen');
  });

  test('9. only the first recognized comparator is emitted (forward-compat)', () => {
    // The validator rejects multiple comparators, but the emitter is
    // defensive — pick a deterministic single comparator from the
    // recognized set (the operator order is the canonical list).
    const out = emit({
      name: 'cancel_reason',
      type: 'text',
      visibility_when: { field: 'status', equals: 'Cancelled', not_equals: 'Active' },
    });
    expect(out).toContain('visibilityWhen: {"field":"status","equals":"Cancelled"}');
    expect(out).not.toContain('not_equals');
  });
});
