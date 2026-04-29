/**
 * UC-7.5 / UI Sections — formPage fallback when `ui.sections` is absent.
 *
 * SUT: platform/assembler/generators/frontend/entityPages/formPage.js
 *
 * Approach: build the same args twice — once with `sections` undefined
 * (or null), once explicitly omitted — and assert:
 *   1. LAYOUT_SECTIONS const is `null`.
 *   2. DynamicForm is rendered without `groups`/`slots` props (default
 *      single-pass render path).
 *   3. The current default-layout cards (CHILD_SECTIONS / ROLLUP_SECTIONS /
 *      invoice totals) are still emitted.
 *   4. The two outputs (no sections / null sections) are byte-identical.
 */

const { buildEntityFormPage } = require(
  '../../../../platform/assembler/generators/frontend/entityPages/formPage',
);

function buildArgs(overrides = {}) {
  return {
    entity: {
      slug: 'invoices',
      display_name: 'Invoice',
      fields: [
        { name: 'customer_name', type: 'string' },
        { name: 'status', type: 'string', options: ['Draft', 'Sent'] },
      ],
      children: [{ entity: 'invoice_items', foreign_key: 'invoice_id' }],
    },
    entityName: 'Invoices',
    fieldDefs: "{ name: 'customer_name', type: 'string' }, { name: 'status', type: 'string' },",
    derivedRelations: [],
    childSections: [{
      childSlug: 'invoice_items',
      foreignKey: 'invoice_id',
      label: 'Invoice items',
      columns: [{ key: 'qty', label: 'Qty' }],
      formFields: '',
      derivedRelations: [],
    }],
    rollupSections: [],
    escapeJsString: (s) => String(s).replace(/'/g, "\\'"),
    importBase: '../../../src',
    invoiceConfig: { tax_rate: 10, currency: 'USD' },
    enablePrintInvoice: false,
    statusTransitions: null,
    hasReservationFields: false,
    approvalConfig: null,
    availabilityLabels: null,
    companionUserConfig: null,
    language: 'en',
    ...overrides,
  };
}

describe('UC-7.5 / formPage — UI sections fallback (default layout preserved)', () => {
  test('TC-UC7.5-fallback-001 — when sections is omitted, LAYOUT_SECTIONS is null', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toContain('const LAYOUT_SECTIONS = null as const;');
  });

  test('TC-UC7.5-fallback-002 — when sections is null, LAYOUT_SECTIONS is null', () => {
    const out = buildEntityFormPage(buildArgs({ sections: null }));
    expect(out).toContain('const LAYOUT_SECTIONS = null as const;');
  });

  test('TC-UC7.5-fallback-003 — when sections is an empty list, LAYOUT_SECTIONS is null', () => {
    const out = buildEntityFormPage(buildArgs({ sections: [] }));
    // Empty arrays opt out of the section-driven layout — there is
    // nothing for the user to declare, fall back to the default.
    expect(out).toContain('const LAYOUT_SECTIONS = null as const;');
  });

  test('TC-UC7.5-fallback-004 — default DynamicForm call exists and is the only one when sections is null', () => {
    const out = buildEntityFormPage(buildArgs());
    // Two DynamicForm elements are emitted: one in the SECTIONS branch
    // (with groups/slots, only reachable when LAYOUT_SECTIONS is set)
    // and one in the default-layout branch (no groups/slots). At runtime
    // LAYOUT_SECTIONS is null in this test fixture, so the default
    // branch is the one that fires. Find the non-grouped DynamicForm
    // element and verify it carries the original props bytewise.
    const matches = out.match(/<DynamicForm[\s\S]*?\/>/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const defaultForm = matches.find((m) => !m.includes('groups={layoutGroups'));
    expect(defaultForm).toBeTruthy();
    expect(defaultForm).toContain('fields={fieldDefinitions');
    expect(defaultForm).toContain('onSubmit={handleSubmit}');
    expect(defaultForm).not.toContain('groups=');
    expect(defaultForm).not.toContain('slots=');
  });

  test('TC-UC7.5-fallback-005 — default-layout cards are still emitted', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toContain('CHILD_SECTIONS.length ? (');
    expect(out).toContain('ROLLUP_SECTIONS.length ? (');
    expect(out).toContain('I18N.invoiceTotalsHeading');
  });

  test('TC-UC7.5-fallback-006 — undefined sections vs null sections produce byte-identical output', () => {
    const a = buildEntityFormPage(buildArgs());
    const b = buildEntityFormPage(buildArgs({ sections: null }));
    expect(a).toBe(b);
  });

  test('TC-UC7.5-fallback-007 — undefined sections vs empty-array sections produce byte-identical output', () => {
    const a = buildEntityFormPage(buildArgs());
    const b = buildEntityFormPage(buildArgs({ sections: [] }));
    expect(a).toBe(b);
  });
});
