/**
 * Plan H F2 — formPage.js emits the ROLLUP_SECTIONS constant, the
 * `fetchRollupItems` effect, and the read-only render block whose rows
 * deep-link to the source entity's edit page and whose Add button
 * deep-links to the source's new-form page (with the FK in the query
 * string).
 *
 * SUT: platform/assembler/generators/frontend/entityPages/formPage.js
 *
 * Approach: template assertions on the emitted page source. We build a
 * minimal valid invocation of `buildEntityFormPage` with one rollup
 * section and one no-rollup baseline, then check the resulting source
 * string contains the right constants, fetchers, and JSX.
 */

const { buildEntityFormPage } = require(
  '../../../../platform/assembler/generators/frontend/entityPages/formPage',
);

function buildArgs(overrides = {}) {
  return {
    entity: { slug: 'departments', display_name: 'Department' },
    entityName: 'Departments',
    fieldDefs: "{ name: 'name', type: 'string' },",
    derivedRelations: [],
    childSections: [],
    rollupSections: [],
    escapeJsString: (s) => String(s).replace(/'/g, "\\'"),
    importBase: '../../../src',
    invoiceConfig: null,
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

const employeesRollup = {
  sourceSlug: 'employees',
  foreignKey: 'department_id',
  label: 'Employees',
  columns: [
    { key: 'full_name', label: 'Full name', referenceEntity: null, multiple: false },
    { key: 'status', label: 'Status', referenceEntity: null, multiple: false },
  ],
  displayField: 'full_name',
  sourceModule: 'hr',
};

describe('Plan H F2 — formPage rollup emission', () => {
  test('1. ROLLUP_SECTIONS constant present and JSON-serialized with section data', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('const ROLLUP_SECTIONS = [');
    expect(out).toContain('sourceSlug: "employees"');
    expect(out).toContain('foreignKey: "department_id"');
    expect(out).toContain('label: "Employees"');
    expect(out).toContain('"key": "full_name"');
  });

  test('2. ROLLUP_DISPLAY_CAP constant present at 25', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('const ROLLUP_DISPLAY_CAP = 25');
  });

  test('3. fetchRollupItems function present and calls api.get with sourceSlug + fk param', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('const fetchRollupItems = async () =>');
    expect(out).toMatch(/api\.get\('\/' \+ slug, \{ params: \{ \[fk\]: id \} \}\)/);
  });

  test('4. row first-cell wraps content in a Link to the source edit page', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toMatch(/Link[\s\S]+'\/' \+ sourceSlug \+ '\/' \+ String\(r\.id\) \+ '\/edit'/);
  });

  test('5. Add button is a Link to /{sourceSlug}/new?{foreignKey}={id} when isEdit', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toMatch(/'\/' \+ sourceSlug \+ '\/new\?' \+ encodeURIComponent\(fkName\) \+ '=' \+ encodeURIComponent\(String\(id\)\)/);
    // disabled "+ Add" placeholder shown when !isEdit
    expect(out).toMatch(/disabled[\s\S]+rollupAdd/);
  });

  test('6. saveFirst hint surfaced when the parent record is not yet saved', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('I18N.rollupSaveFirst');
  });

  test('7. empty-state message uses I18N.rollupEmpty', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('I18N.rollupEmpty');
  });

  test('8. viewAll overflow footer linked to source list filtered by FK', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toMatch(/'\/' \+ sourceSlug \+ '\?' \+ encodeURIComponent\(fkName\)/);
    expect(out).toContain('I18N.rollupViewAll');
  });

  test('9. ROLLUP_SECTIONS render block is conditional on length so non-rollup pages stay unchanged', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('{ROLLUP_SECTIONS.length ?');
  });

  test('10. empty rollupSections still emits the constant as []', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toContain('const ROLLUP_SECTIONS = [] as const');
  });

  test('11. rollupItemsBySlug + rollupLoading state declared', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('rollupItemsBySlug');
    expect(out).toContain('setRollupItemsBySlug');
    expect(out).toContain('rollupLoading');
  });

  test('12. dedicated rollupRefMaps state for resolving reference column labels', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('rollupRefMaps');
    expect(out).toContain('setRollupRefMaps');
  });

  test('13. getRollupCellDisplay helper present and reads from rollupRefMaps', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toContain('const getRollupCellDisplay');
    expect(out).toMatch(/rollupRefMaps\[String\(refEntity\)\]/);
  });

  test('14. fetchRollupItems is wired into a useEffect on [id, isEdit]', () => {
    const out = buildEntityFormPage(buildArgs({ rollupSections: [employeesRollup] }));
    expect(out).toMatch(/useEffect\(\(\) => \{[\s\S]*?fetchRollupItems\(\);[\s\S]*?\}, \[id, isEdit\]\)/);
  });
});
