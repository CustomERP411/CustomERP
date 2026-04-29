/**
 * UC-7.5 / UI Sections — JS-side `entity.ui.sections` validation.
 *
 * SUT: platform/assembler/assembler/sdfValidation.js (_validateUiSections)
 *
 * Mirrors the Pydantic Entity._validate_ui_sections rules (covered by
 * platform/ai-gateway/tests/test_ui_sections_schema.py). This pass also
 * runs at the JS layer so prefilled SDFs / direct uploads that bypass
 * the AI gateway get the same protection.
 */

const sdfValidation = require(
  '../../../../platform/assembler/assembler/sdfValidation',
);

function buildAssemblerHarness() {
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

function buildSdf(uiSections, { withChildren = true } = {}) {
  const sdf = {
    project_name: 'Test',
    entities: [
      {
        slug: 'invoices',
        fields: [
          // String-typed, name does NOT end in `_id` so the reference
          // resolver in `_validateSdf` does not try (and fail) to find
          // a target entity. The UI-sections rules we're testing only
          // care about field names, not types.
          { name: 'customer_name', type: 'string' },
          { name: 'status', type: 'string', options: ['Draft', 'Sent'] },
          { name: 'notes', type: 'text' },
        ],
      },
    ],
  };
  if (uiSections !== undefined) {
    sdf.entities[0].ui = { sections: uiSections };
  }
  if (withChildren) {
    sdf.entities.push({
      slug: 'invoice_items',
      fields: [
        // No `_id` suffix to keep the reference resolver quiet, but still
        // matches the foreign_key declared on the parent below.
        { name: 'invoice_link', type: 'string' },
        { name: 'qty', type: 'integer' },
      ],
    });
    sdf.entities[0].children = [{ entity: 'invoice_items', foreign_key: 'invoice_link' }];
  }
  return sdf;
}

describe('UC-7.5 / sdfValidation._validateUiSections — UI sections', () => {
  test('TC-UC7.5-uisections-001 — passes when ui.sections is absent', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf(undefined);
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  test('TC-UC7.5-uisections-002 — passes for full canonical invoice layout', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([
      { kind: 'fields', id: 'identity', heading: 'form.sections.identity', fields: ['customer_name', 'status'] },
      { kind: 'line_items', child: 'invoice_items' },
      { kind: 'fields', id: 'details', heading: 'form.sections.details', fields: ['notes'] },
      { kind: 'totals' },
      { kind: 'rollups' },
    ]);
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  test('TC-UC7.5-uisections-003 — throws on unknown section kind', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([{ kind: 'totally_made_up' }]);
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*unknown kind 'totally_made_up'/i);
  });

  test('TC-UC7.5-uisections-004 — throws when fields[*] references unknown field', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([{ kind: 'fields', fields: ['phantom'] }]);
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*'phantom' that is not declared/i);
  });

  test('TC-UC7.5-uisections-005 — throws on duplicate field across sections', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([
      { kind: 'fields', fields: ['customer_name', 'status'] },
      { kind: 'fields', fields: ['status'] },
    ]);
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*at most one section/i);
  });

  test('TC-UC7.5-uisections-006 — throws on line_items.child not in entity.children[]', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([
      { kind: 'fields', fields: ['customer_name'] },
      { kind: 'line_items', child: 'phantom_items' },
    ]);
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*'phantom_items' but no entry in/i);
  });

  test('TC-UC7.5-uisections-007 — throws on line_items when entity declares no children[]', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf(
      [
        { kind: 'fields', fields: ['customer_name'] },
        { kind: 'line_items', child: 'invoice_items' },
      ],
      { withChildren: false },
    );
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*'invoice_items' but no entry/i);
  });

  test('TC-UC7.5-uisections-008 — throws on raw English heading', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([
      { kind: 'fields', heading: 'Identity Section', fields: ['customer_name'] },
    ]);
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*i18n dot-key/i);
  });

  test('TC-UC7.5-uisections-009 — accepts camelCase dot-key heading', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([
      { kind: 'fields', heading: 'form.sections.lineItems', fields: ['customer_name'] },
    ]);
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });

  test('TC-UC7.5-uisections-010 — throws on non-list ui.sections', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf(undefined);
    sdf.entities[0].ui = { sections: 'not-a-list' };
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*ui.sections must be a list/i);
  });

  test('TC-UC7.5-uisections-011 — throws on empty fields section', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([{ kind: 'fields', fields: [] }]);
    expect(() => harness._validateSdf(sdf)).toThrow(/SDF Validation Error.*at least one field/i);
  });

  test('TC-UC7.5-uisections-012 — accepts marker-only sections without extras', () => {
    const harness = buildAssemblerHarness();
    const sdf = buildSdf([
      { kind: 'fields', fields: ['customer_name'] },
      { kind: 'rollups' },
      { kind: 'totals' },
      { kind: 'stock_availability' },
      { kind: 'companion_user' },
    ]);
    expect(() => harness._validateSdf(sdf)).not.toThrow();
  });
});
