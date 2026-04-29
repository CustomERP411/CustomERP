// Plan E C2 — _resolveColumnLabel & _resolveFieldLabelForForm fallbacks.
//
// SUT: platform/assembler/generators/frontend/fieldUtils.js
//
// Coverage:
//   1. customer_id w/ no label resolves to "Customer" via target entity.label
//   2. customer_id w/ no label and no target → "Customer" (auto, _id stripped)
//   3. explicit field.label always wins over reference fallback
//   4. _id-suffixed field that ISN'T a reference still gets `_id` stripped
//   5. Missing/empty allEntities falls through cleanly

const fieldUtils = require(
  '../../../../platform/assembler/generators/frontend/fieldUtils'
);

function makeHost() {
  // Bind the methods to a stub host so `this._formatLabel`, `this._language`,
  // and `this._escapeJsString` resolve. Mirrors how FrontendGenerator mixes
  // these methods in.
  const host = {
    _language: 'en',
    _formatLabel: fieldUtils._formatLabel,
    _capitalize: fieldUtils._capitalize,
    _escapeJsString: fieldUtils._escapeJsString,
    _resolveReferenceTargetLabel: fieldUtils._resolveReferenceTargetLabel,
    _resolveColumnLabel: fieldUtils._resolveColumnLabel,
    _resolveFieldLabelForForm: fieldUtils._resolveFieldLabelForForm,
  };
  return host;
}

describe('Plan E C2 — reference label fallback', () => {
  test('1. customer_id (no label) resolves via target entity.label', () => {
    const host = makeHost();
    const allEntities = [
      { slug: 'customers', label: 'Customer', display_name: 'Customer' },
    ];
    const field = { name: 'customer_id', type: 'reference', reference_entity: 'customers' };
    const out = host._resolveColumnLabel('customer_id', field, allEntities);
    expect(out).toBe('Customer');
  });

  test('2. customer_id with no target available falls through to auto-formatted (without _id)', () => {
    const host = makeHost();
    const field = { name: 'customer_id', type: 'reference', reference_entity: 'customers' };
    const out = host._resolveColumnLabel('customer_id', field, []);
    // Plan E policy: never render "Customer Id"; strip the _id suffix.
    expect(out).toBe('Customer');
  });

  test('3. explicit field.label always wins over reference fallback', () => {
    const host = makeHost();
    const allEntities = [{ slug: 'customers', label: 'Customer' }];
    const field = { name: 'customer_id', type: 'reference', reference_entity: 'customers', label: 'Bill-to Party' };
    const out = host._resolveColumnLabel('customer_id', field, allEntities);
    expect(out).toBe('Bill-to Party');
  });

  test('4. _id-suffixed field that is NOT a reference still gets _id stripped in fallback', () => {
    const host = makeHost();
    // No `reference_entity`, name doesn't suggest reference shape via target lookup.
    const field = { name: 'order_id', type: 'string' };
    const out = host._resolveColumnLabel('order_id', field, []);
    // "Order Id" would be wrong; plan policy strips the suffix everywhere.
    expect(out).toBe('Order');
  });

  test('5. _resolveFieldLabelForForm uses the same reference fallback', () => {
    const host = makeHost();
    const allEntities = [
      { slug: 'departments', label: 'Department' },
    ];
    const field = { name: 'department_id', type: 'reference', reference_entity: 'departments' };
    const out = host._resolveFieldLabelForForm(field, allEntities);
    expect(out).toBe('Department');
  });

  test('6. actor field (approved_by → __erp_users) without label resolves to "Users" auto when no target ent label', () => {
    const host = makeHost();
    // No __erp_users entity in allEntities — fallback to auto formatting.
    const field = { name: 'approved_by', type: 'reference', reference_entity: '__erp_users' };
    const out = host._resolveColumnLabel('approved_by', field, []);
    // Auto formatting: "Approved By" (capitalized words). Note this is the
    // edge case the actorMigration label fix solves at the SDF level —
    // here the renderer's safety net just title-cases without an awkward
    // " Id" suffix.
    expect(out).toBe('Approved By');
  });

  test('7. plural target slug resolves via prefix match when name is singular', () => {
    const host = makeHost();
    const allEntities = [{ slug: 'customers', label: 'Customer' }];
    // reference_entity says 'customer' (singular) but target slug is plural.
    const field = { name: 'customer_id', type: 'reference', reference_entity: 'customer' };
    const out = host._resolveColumnLabel('customer_id', field, allEntities);
    expect(out).toBe('Customer');
  });
});
