/**
 * Plan G — visibility predicate parity (client ↔ server).
 *
 * Plan G's contract is that `DynamicForm.isFieldVisible` and the server-side
 * `_relUtil_evalVisibilityPredicate` interpret the same predicate identically
 * for every input. This test runs a parity table through both and asserts
 * matching truthiness; if the implementations drift, the user sees one
 * value while typing and a different one after save.
 *
 * SUTs:
 *  - brick-library/frontend-bricks/components/DynamicForm.tsx
 *      (we re-implement isFieldVisible inline using the SAME spec —
 *       the dynamicFormVisibility template assertions pin the production
 *       implementation to the same shape; this file pins the SHARED
 *       SEMANTICS used by both sides)
 *  - brick-library/backend-bricks/mixins/relationRuleLibrary.js
 *      (LIBRARY_PROTO._relUtil_evalVisibilityPredicate)
 */

const path = require('path');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const { LIBRARY_PROTO } = require(
  path.join(REPO_ROOT, 'brick-library/backend-bricks/mixins/relationRuleLibrary.js')
);

// Pinned spec — pasted from DynamicForm.tsx isFieldVisible body, normalized
// to a plain JS function. The dynamicFormVisibility unit test asserts the
// production code matches this shape; this file asserts the server mirror
// produces identical truthiness for the same inputs.
function clientIsFieldVisible(predicate, data) {
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

function serverEval(predicate, record) {
  return LIBRARY_PROTO._relUtil_evalVisibilityPredicate.call(
    { _relUtil_evalVisibilityPredicate: LIBRARY_PROTO._relUtil_evalVisibilityPredicate },
    predicate,
    record,
  );
}

// Parity table — wide coverage across operators, value types, missing data.
const PARITY_CASES = [
  { label: 'no predicate -> visible', predicate: null, record: {} },
  { label: 'predicate without field -> visible', predicate: { equals: 'x' }, record: {} },
  // equals
  { label: 'equals: matching string', predicate: { field: 's', equals: 'X' }, record: { s: 'X' } },
  { label: 'equals: non-matching string', predicate: { field: 's', equals: 'X' }, record: { s: 'Y' } },
  { label: 'equals: number coerced', predicate: { field: 's', equals: 1 }, record: { s: '1' } },
  { label: 'equals: missing -> false', predicate: { field: 's', equals: 'X' }, record: {} },
  { label: 'equals: null -> empty stringification', predicate: { field: 's', equals: '' }, record: { s: null } },
  // not_equals
  { label: 'not_equals: matching -> false', predicate: { field: 's', not_equals: 'X' }, record: { s: 'X' } },
  { label: 'not_equals: non-matching -> true', predicate: { field: 's', not_equals: 'X' }, record: { s: 'Y' } },
  { label: 'not_equals: missing -> true', predicate: { field: 's', not_equals: 'X' }, record: {} },
  // in
  { label: 'in: member -> true', predicate: { field: 's', in: ['A', 'B'] }, record: { s: 'A' } },
  { label: 'in: member B -> true', predicate: { field: 's', in: ['A', 'B'] }, record: { s: 'B' } },
  { label: 'in: outside -> false', predicate: { field: 's', in: ['A', 'B'] }, record: { s: 'C' } },
  { label: 'in: missing -> false', predicate: { field: 's', in: ['A', 'B'] }, record: {} },
  // not_in
  { label: 'not_in: outside -> true', predicate: { field: 's', not_in: ['A', 'B'] }, record: { s: 'C' } },
  { label: 'not_in: member -> false', predicate: { field: 's', not_in: ['A', 'B'] }, record: { s: 'A' } },
  { label: 'not_in: missing -> true', predicate: { field: 's', not_in: ['A', 'B'] }, record: {} },
  // is_set
  { label: 'is_set true: empty -> false', predicate: { field: 's', is_set: true }, record: { s: '' } },
  { label: 'is_set true: whitespace -> false', predicate: { field: 's', is_set: true }, record: { s: '   ' } },
  { label: 'is_set true: value -> true', predicate: { field: 's', is_set: true }, record: { s: 'x' } },
  { label: 'is_set false: empty -> true', predicate: { field: 's', is_set: false }, record: { s: '' } },
  { label: 'is_set false: value -> false', predicate: { field: 's', is_set: false }, record: { s: 'x' } },
  // is_unset
  { label: 'is_unset true: empty -> true', predicate: { field: 's', is_unset: true }, record: {} },
  { label: 'is_unset true: value -> false', predicate: { field: 's', is_unset: true }, record: { s: 'x' } },
  { label: 'is_unset false: empty -> false', predicate: { field: 's', is_unset: false }, record: {} },
  { label: 'is_unset false: value -> true', predicate: { field: 's', is_unset: false }, record: { s: 'x' } },
  // forward-compat: unknown comparator -> true on both sides
  { label: 'unknown comparator -> true', predicate: { field: 's', matches: 'X' }, record: { s: 'X' } },
  { label: 'unknown comparator missing source -> true', predicate: { field: 's', matches: 'X' }, record: {} },
];

describe('Plan G — visibility predicate client/server parity', () => {
  test.each(PARITY_CASES)('parity: $label', ({ predicate, record }) => {
    const c = clientIsFieldVisible(predicate, record);
    const s = serverEval(predicate, record);
    expect(s).toBe(c);
  });

  test('parity: every operator boolean is exercised', () => {
    const seen = new Set();
    for (const c of PARITY_CASES) {
      if (!c.predicate) continue;
      for (const k of Object.keys(c.predicate)) if (k !== 'field') seen.add(k);
    }
    // The set MUST include every supported operator + the unknown-comparator
    // forward-compat case.
    expect(seen).toEqual(new Set(['equals', 'not_equals', 'in', 'not_in', 'is_set', 'is_unset', 'matches']));
  });
});
