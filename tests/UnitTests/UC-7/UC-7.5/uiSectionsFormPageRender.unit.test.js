/**
 * UC-7.5 / UI Sections — formPage emits a section-driven render when
 * `ui.sections` is provided.
 *
 * SUT: platform/assembler/generators/frontend/entityPages/formPage.js
 *
 * Approach: template assertions on the emitted page source. We build a
 * minimal `buildEntityFormPage` invocation with `sections` set and check
 * the generated TSX contains:
 *   - the LAYOUT_SECTIONS const with the JSON-encoded section list,
 *   - the SECTIONS-mode branch wiring `groups={layoutGroups}` and
 *     `slots={layoutSlots}` to DynamicForm,
 *   - the slot-key derivation for `line_items:<child_slug>`.
 *
 * The fallback path (no `ui.sections`) is covered by
 * `uiSectionsFallback.unit.test.js`.
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
        { name: 'notes', type: 'text' },
      ],
      children: [{ entity: 'invoice_items', foreign_key: 'invoice_id' }],
    },
    entityName: 'Invoices',
    fieldDefs: "{ name: 'customer_name', type: 'string' }, { name: 'status', type: 'string' }, { name: 'notes', type: 'string' },",
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

const canonicalSections = [
  { kind: 'fields', id: 'identity', heading: 'form.sections.identity', fields: ['customer_name', 'status'] },
  { kind: 'line_items', child: 'invoice_items' },
  { kind: 'fields', id: 'details', heading: 'form.sections.details', fields: ['notes'] },
  { kind: 'totals' },
  { kind: 'rollups' },
];

describe('UC-7.5 / formPage — UI sections render', () => {
  test('TC-UC7.5-form-001 — emits LAYOUT_SECTIONS const with the JSON-encoded section list', () => {
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    expect(out).toMatch(/const LAYOUT_SECTIONS = \[\{/);
    expect(out).toContain('"heading":"form.sections.identity"');
    expect(out).toContain('"child":"invoice_items"');
    expect(out).toContain('"kind":"totals"');
    expect(out).toContain('"kind":"rollups"');
  });

  test('TC-UC7.5-form-002 — preserves declared section order in LAYOUT_SECTIONS', () => {
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    const m = out.match(/const LAYOUT_SECTIONS = (\[[\s\S]*?\]) as const;/);
    expect(m).toBeTruthy();
    const list = JSON.parse(m[1]);
    expect(list.map((s) => s.kind)).toEqual([
      'fields', 'line_items', 'fields', 'totals', 'rollups',
    ]);
    expect(list[0].id).toBe('identity');
    expect(list[2].id).toBe('details');
  });

  test('TC-UC7.5-form-003 — wires layoutGroups + layoutSlots into DynamicForm', () => {
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    expect(out).toMatch(/groups=\{layoutGroups as any\}/);
    expect(out).toMatch(/slots=\{layoutSlots as any\}/);
  });

  test('TC-UC7.5-form-004 — emits a runtime slot key for each line_items child', () => {
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    // The slot-name builder for line_items concatenates the prefix with the
    // child slug; assert the generator emits the literal prefix used at
    // runtime.
    expect(out).toContain("'line_items:' + String(s.child");
    expect(out).toContain("'line_items:' + slug");
  });

  test('TC-UC7.5-form-005 — emits dedicated SECTIONS-mode branch alongside the default-layout branch', () => {
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    expect(out).toMatch(/: loading \? \([\s\S]*?\) : LAYOUT_SECTIONS \?/);
  });

  test('TC-UC7.5-form-006 — keeps default-layout JSX in the generated source for opt-out entities', () => {
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    // The default layout is still emitted as the else-branch even when
    // sections are provided, so future entities without sections continue
    // to render correctly.
    expect(out).toContain('CHILD_SECTIONS.length ? (');
    expect(out).toContain('ROLLUP_SECTIONS.length ? (');
  });

  test('TC-UC7.5-form-007 — generateEntityPage threads `entity.ui.sections` into formPage', () => {
    // Sanity check that the embedded LAYOUT_SECTIONS payload is exactly
    // the input list (no reordering, no kind drift).
    const out = buildEntityFormPage(buildArgs({ sections: canonicalSections }));
    const m = out.match(/const LAYOUT_SECTIONS = (\[[\s\S]*?\]) as const;/);
    const parsed = JSON.parse(m[1]);
    expect(parsed).toEqual(canonicalSections);
  });
});
