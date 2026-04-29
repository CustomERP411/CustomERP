/**
 * UC-7.5 / SDF coherence-layer validation — unit tests for Plan A.
 *
 * SUT: platform/assembler/assembler/sdfValidation.js
 *      (_validateRelations, plus computed-field constraints inside _validateSdf)
 *
 * Covers the 12 cases listed in `plan_a_sdf_schema_extension`:
 *   1.  Valid SDF with each of five relation kinds — passes.
 *   2.  Unknown `kind` — throws.
 *   3.  reference_contract to non-existent field on this entity — throws.
 *   4.  reference_contract to non-existent target entity — throws.
 *   5.  reference_contract to `__erp_users` even without access control — passes.
 *   6.  status_propagation.effect.target_entity non-existent — throws.
 *   7.  derived_field.computed_field not marked computed: true — throws.
 *   8.  invariant.severity invalid value — throws.
 *   9.  permission_scope.scope invalid value — throws.
 *   10. Field with computed: true AND required: true — throws.
 *   11. Field with computed: true AND unique: true — passes but pushes warning.
 *   12. Malformed `when` clause — throws.
 */

const sdfValidation = require(
  '../../../../platform/assembler/assembler/sdfValidation',
);

// `_validateSdf` depends on a few sibling assembler helpers via `this`. Build a
// minimal harness that supplies the needed methods so we can validate SDFs
// without dragging in the full ProjectAssembler. We deliberately leave all
// ERP modules disabled — Plan A's additions are about relations + computed-
// field rules, not module gating, so we use `module-less` entities (treated
// as 'shared') and no inter-entity references in the fixture.
function buildAssemblerHarness() {
  // Spread the entire sdfValidation module so any sibling helper called
  // via `this.<name>(...)` resolves correctly. Then override the
  // assembler-side methods the test fixture stubs.
  return {
    ...sdfValidation,
    _withSystemEntities: (entities) => entities,
    _resolveErpModules: () => ({ enabledModules: [], hasErpConfig: false }),
    _normalizeEntityModule: () => 'shared',
    _normalizeEntitiesForModules: (entities) => ({
      normalizedEntities: entities,
      moduleMap: {},
    }),
    _getInvoicePriorityAConfig: () => ({
      invoiceEntity: 'invoices',
      customerEntity: 'customers',
      itemEntity: 'invoice_items',
      invoice_number_field: 'invoice_number',
      customer_field: 'customer_id',
      status_field: 'status',
      subtotal_field: 'subtotal',
      tax_total_field: 'tax_total',
      grand_total_field: 'grand_total',
      item_invoice_field: 'invoice_id',
      item_quantity_field: 'quantity',
      item_unit_price_field: 'unit_price',
      item_line_total_field: 'line_total',
    }),
    _getHRPriorityAConfig: () => ({
      employeeEntity: 'employees',
      departmentEntity: 'departments',
      leaveEntity: 'leaves',
    }),
    _validateInventoryPriorityAConfig: () => {},
    _validateInvoicePriorityAConfig: () => {},
    _validateHRPriorityAConfig: () => {},
  };
}

// Build a fixture SDF for relations testing. Entities have no `module` (treated
// as 'shared') and no inter-entity reference fields, so the existing reference
// resolver in _validateSdf doesn't throw on module-disabled targets. The
// `leaves.leave_days` field is computed, set up so derived_field tests can
// target it; `leave_count` is non-computed for the negative case.
function buildSdfWithEntity(extraFields = [], relations = undefined) {
  const sdf = {
    project_name: 'Test',
    entities: [
      {
        slug: 'leaves',
        fields: [
          { name: 'approver_id', type: 'string' },
          { name: 'status', type: 'string', options: ['Pending', 'Approved', 'Cancelled'] },
          { name: 'leave_days', type: 'integer', computed: true },
          { name: 'leave_count', type: 'integer' },
          ...extraFields,
        ],
      },
      {
        slug: 'attendance_entries',
        fields: [
          { name: 'work_date', type: 'date' },
          { name: 'status', type: 'string' },
        ],
      },
    ],
  };
  if (relations !== undefined) {
    sdf.entities[0].relations = relations;
  }
  return sdf;
}

describe('UC-7.5 / sdfValidation._validateRelations — coherence layer (Plan A)', () => {
  // -- Case 1 --------------------------------------------------------------
  test('TC-UC7.5-relations-001 — passes when all five relation kinds are valid', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'reference_contract',
        field: 'approver_id',
        target: '__erp_users',
        when: 'modules.access_control.enabled',
      },
      {
        kind: 'status_propagation',
        on: { field: 'status', from: 'Pending', to: 'Approved' },
        effect: {
          action: 'create_per_work_day',
          target_entity: 'attendance_entries',
          set_fields: { status: 'On Leave' },
        },
        reverse: {
          on: { field: 'status', to: 'Cancelled' },
          action: 'remove_emitted_rows',
        },
        when: 'modules.hr.leave_attendance_link.enabled',
      },
      {
        kind: 'derived_field',
        computed_field: 'leave_days',
        formula: 'working_days(start_date, end_date, modules.hr.work_days)',
      },
      {
        kind: 'invariant',
        rule: 'no_overlap_with(entity=leaves, group_by=employee_id, status_in=[Pending, Approved])',
        error_key: 'entity.leaves.error.overlap',
        severity: 'block',
      },
      {
        kind: 'permission_scope',
        permission: 'hr.leaves.approve',
        scope: 'manager_chain',
        actions: ['update.status:Approved', 'update.status:Rejected'],
      },
    ]);

    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  // -- Case 2 --------------------------------------------------------------
  test('TC-UC7.5-relations-002 — throws on unknown relation kind', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      { kind: 'totally_made_up', some: 'data' },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(/unknown kind/i);
  });

  // -- Case 3 --------------------------------------------------------------
  test('TC-UC7.5-relations-003 — throws when reference_contract.field is not on the entity', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'reference_contract',
        field: 'this_field_does_not_exist',
        target: '__erp_users',
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /this_field_does_not_exist.*does not exist/,
    );
  });

  // -- Case 4 --------------------------------------------------------------
  test('TC-UC7.5-relations-004 — throws when reference_contract.target is not a known entity', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'reference_contract',
        field: 'approver_id',
        target: 'phantom_entity',
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /phantom_entity.*not a known entity/i,
    );
  });

  // -- Case 5 --------------------------------------------------------------
  test('TC-UC7.5-relations-005 — accepts reference_contract to __erp_users even without access control', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'reference_contract',
        field: 'approver_id',
        target: '__erp_users',
      },
    ]);

    // No modules.access_control.* on the SDF; system targets must still resolve.
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  // -- Case 6 --------------------------------------------------------------
  test('TC-UC7.5-relations-006 — throws when status_propagation.effect.target_entity does not exist', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'status_propagation',
        on: { field: 'status', from: 'Pending', to: 'Approved' },
        effect: {
          action: 'create_per_work_day',
          target_entity: 'phantom_target',
        },
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /phantom_target.*not a known entity/i,
    );
  });

  // -- Case 7 --------------------------------------------------------------
  test('TC-UC7.5-relations-007 — throws when derived_field.computed_field is not marked computed:true', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'derived_field',
        computed_field: 'leave_count',  // exists but NOT computed:true
        formula: 'count(*)',
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /leave_count.*computed=true/,
    );
  });

  // -- Case 8 --------------------------------------------------------------
  test('TC-UC7.5-relations-008 — throws on invariant.severity invalid value', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'invariant',
        rule: 'something',
        severity: 'panic',
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /severity must be 'block' or 'warn'/,
    );
  });

  // -- Case 9 --------------------------------------------------------------
  test('TC-UC7.5-relations-009 — throws on permission_scope.scope invalid value', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'permission_scope',
        permission: 'hr.leaves.read',
        scope: 'galactic',
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(/scope must be one of/i);
  });

  // -- Case 10 -------------------------------------------------------------
  test('TC-UC7.5-relations-010 — throws when a field has computed:true AND required:true', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([
      { name: 'bad_field', type: 'integer', computed: true, required: true },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /bad_field.*computed=true and required=true/,
    );
  });

  // -- Case 11 -------------------------------------------------------------
  test('TC-UC7.5-relations-011 — accepts computed:true + unique:true but pushes a warning', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([
      { name: 'risky_field', type: 'string', computed: true, unique: true },
    ]);

    expect(() => harness._validateSdf(sdf)).not.toThrow();
    expect(Array.isArray(sdf.warnings)).toBe(true);
    expect(sdf.warnings.some((w) => /risky_field/.test(w) && /unique/.test(w))).toBe(true);
  });

  // -- Case 12 -------------------------------------------------------------
  test('TC-UC7.5-relations-012 — throws on malformed `when` clause', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity([], [
      {
        kind: 'reference_contract',
        field: 'approver_id',
        target: '__erp_users',
        when: 'this is not a valid when clause',
      },
    ]);

    expect(() => harness._validateSdf(sdf)).toThrow(
      /when must match shape/i,
    );
  });

  // -- Bonus: backwards compat -------------------------------------------------
  test('SDF without `relations[]` validates as before (backwards compat)', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdfWithEntity();
    delete sdf.entities[0].relations;

    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  // -- Plan E — Group E: issue_stock arg-shape validation ------------------
  // The runtime _relAct_issue_stock fails open when its args are malformed
  // (no movement, no error) — the SDF-time validation has to be the loud
  // check. Build a separate harness that puts the test entities in real
  // modules so the cross-entity reference resolver finds enabled targets.
  // Use field names that don't end in `_id` to bypass the resolver's
  // FK heuristic (which would otherwise need real reference fields and
  // module wiring just to reach the issue_stock arg check we're after).
  function buildInvoiceStockSdf(actionString, items = {
    fields: [
      { name: 'invoice_ref', type: 'string' },
      { name: 'product_ref', type: 'string' },
      { name: 'quantity', type: 'decimal' },
    ],
  }) {
    return {
      project_name: 'Test',
      entities: [
        {
          slug: 'invoices',
          fields: [
            { name: 'status', type: 'string', options: ['Draft', 'Posted', 'Cancelled'] },
          ],
          relations: [
            {
              kind: 'status_propagation',
              on: { field: 'status', to: 'Posted' },
              effect: { action: actionString, target_entity: 'stock_movements' },
              when: 'modules.invoice.stock_link.enabled',
            },
          ],
        },
        { slug: 'invoice_items', fields: items.fields },
        { slug: 'products', fields: [{ name: 'quantity', type: 'integer' }] },
        { slug: 'stock_movements', fields: [{ name: 'movement_type', type: 'string' }] },
      ],
    };
  }

  test('TC-UC7.5-relations-013 — issue_stock with valid args passes', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildInvoiceStockSdf(
      'issue_stock(child_entity=invoice_items, parent_field=invoice_ref, item_field=product_ref, qty_field=quantity, stock_entity=products)'
    );
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  test('TC-UC7.5-relations-014 — issue_stock missing required arg throws', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildInvoiceStockSdf(
      'issue_stock(child_entity=invoice_items, parent_field=invoice_ref, qty_field=quantity)'
    );
    expect(() => harness._validateSdf(sdf)).toThrow(/non-empty 'item_field'/);
  });

  test('TC-UC7.5-relations-015 — issue_stock with unknown child_entity throws', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildInvoiceStockSdf(
      'issue_stock(child_entity=phantom_lines, parent_field=invoice_ref, item_field=product_ref, qty_field=quantity)'
    );
    expect(() => harness._validateSdf(sdf)).toThrow(/phantom_lines.*not a known entity/);
  });

  test('TC-UC7.5-relations-016 — issue_stock with item_field that does not exist on child throws', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildInvoiceStockSdf(
      'issue_stock(child_entity=invoice_items, parent_field=invoice_ref, item_field=does_not_exist, qty_field=quantity)'
    );
    expect(() => harness._validateSdf(sdf)).toThrow(/item_field.*does_not_exist.*does not exist on child entity/);
  });

  test('TC-UC7.5-relations-017 — issue_stock with location_field present but not on child throws', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildInvoiceStockSdf(
      'issue_stock(child_entity=invoice_items, parent_field=invoice_ref, item_field=product_ref, qty_field=quantity, location_field=missing_location)'
    );
    expect(() => harness._validateSdf(sdf)).toThrow(/location_field.*missing_location.*does not exist/);
  });

  test('TC-UC7.5-relations-018 — issue_stock with stock_entity that does not exist throws', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildInvoiceStockSdf(
      'issue_stock(child_entity=invoice_items, parent_field=invoice_ref, item_field=product_ref, qty_field=quantity, stock_entity=phantom_products)'
    );
    expect(() => harness._validateSdf(sdf)).toThrow(/stock_entity.*phantom_products.*not a known entity/);
  });
});
