/**
 * Plan H F3 — formPage seeds initialData from URL query params on the
 * new-form path so rollup "Add" deep-links pre-fill the foreign key.
 *
 * SUT: platform/assembler/generators/frontend/entityPages/formPage.js
 *
 * Approach: template assertions on the emitted page source. We verify the
 * `useSearchParams` import, the seeding memo, and the initialData spread
 * gate that protects edit mode from being overwritten by URL params.
 */

const { buildEntityFormPage } = require(
  '../../../../platform/assembler/generators/frontend/entityPages/formPage',
);

function buildArgs(overrides = {}) {
  return {
    entity: { slug: 'employees', display_name: 'Employee' },
    entityName: 'Employees',
    fieldDefs: "{ name: 'full_name', type: 'string' },",
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

describe('Plan H F3 — formPage URL-param seeding for new-form deep links', () => {
  test('1. useSearchParams imported from react-router-dom', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toMatch(/from 'react-router-dom'/);
    expect(out).toContain('useSearchParams');
    expect(out).toMatch(/import \{[^}]*useSearchParams[^}]*\} from 'react-router-dom'/);
  });

  test('2. searchParams hook called and stored', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toContain('const [searchParams] = useSearchParams()');
  });

  test('3. initialFromQuery memo is gated on !isEdit so edit mode stays untouched', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toContain('const initialFromQuery = useMemo');
    expect(out).toMatch(/if \(isEdit\) return seed/);
  });

  test('4. only fields whose name appears in fieldDefinitions are seeded', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toMatch(/const knownNames = new Set\(\(fieldDefinitions as any\[\]\)\.map/);
    expect(out).toMatch(/if \(knownNames\.has\(k\)\) seed\[k\] = v/);
  });

  test('5. DynamicForm receives initialFromQuery merged BEFORE server initialData on !isEdit', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toMatch(/initialData=\{isEdit \? initialData : \{ \.\.\.initialFromQuery, \.\.\.initialData \}\}/);
  });

  test('6. memo dependency array includes searchParams and isEdit', () => {
    const out = buildEntityFormPage(buildArgs());
    expect(out).toMatch(/\}, \[searchParams, isEdit\]\)/);
  });
});
