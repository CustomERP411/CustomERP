/**
 * UC-7.5 / Plan J §J1 — statusFormatter wiring assertions.
 *
 * SUTs:
 *   - platform/assembler/generators/frontend/entityPages/listPage.js
 *   - platform/assembler/generators/frontend/entityPages/formPage.js
 *
 * Plan §J1 says every place a workflow status is rendered must go
 * through the generated `formatStatus(slug, value)` helper instead of
 * dumping the raw enum value into the DOM. These tests pin that
 * contract on the generators that produce the generic list and form
 * templates so a regression — e.g. someone "simplifying" a JSX block
 * back to `{value}` — surfaces as a unit-test failure rather than as a
 * UI bug only TR-language users notice.
 *
 * Test IDs follow the UC-7.5 convention (TC-UC7.5-STATFMT-NNN).
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const { buildEntityListPage } = require(
  path.join(REPO_ROOT, 'platform/assembler/generators/frontend/entityPages/listPage.js')
);
const { buildEntityFormPage } = require(
  path.join(REPO_ROOT, 'platform/assembler/generators/frontend/entityPages/formPage.js')
);

// ---------------------------------------------------------------------------
// Minimal fixtures — enough surface area for the generators to traverse
// and emit the status-rendering branches.
// ---------------------------------------------------------------------------

const STATUS_FIELD = {
  name: 'status',
  type: 'enum',
  options: ['draft', 'approved', 'paid'],
  required: true,
};

const TITLE_FIELD = {
  name: 'title',
  type: 'string',
  required: true,
};

const ENTITY = {
  slug: 'invoice',
  name: 'Invoice',
  fields: [STATUS_FIELD, TITLE_FIELD],
  workflow: {
    statuses: ['draft', 'approved', 'paid'],
    transitions: [
      { from: 'draft', to: 'approved' },
      { from: 'approved', to: 'paid' },
    ],
  },
};

const escapeJsString = (s) => String(s ?? '').replace(/[\\'`$]/g, (c) => `\\${c}`);

function makeListSource() {
  return buildEntityListPage({
    entity: ENTITY,
    entityName: 'Invoice',
    fieldDefs: ENTITY.fields,
    tableColumns: ['title', 'status'],
    enableSearch: false,
    enableCsvImport: false,
    enableCsvExport: false,
    enablePrint: false,
    enableReceive: false,
    enableQuickReceive: false,
    enableAdjust: false,
    enableIssue: false,
    enableQuickIssue: false,
    canTransfer: false,
    enableQrLabels: false,
    enableBulkActions: false,
    enableBulkDelete: false,
    enableBulkUpdate: false,
    bulkUpdateFields: [],
    escapeJsString,
    importBase: '..',
    hasReservationFields: false,
    hasStatusField: true,
    language: 'en',
  });
}

function makeFormSource() {
  return buildEntityFormPage({
    entity: ENTITY,
    entityName: 'Invoice',
    fieldDefs: ENTITY.fields,
    derivedRelations: [],
    childSections: [],
    rollupSections: [],
    escapeJsString,
    importBase: '..',
    invoiceConfig: null,
    enablePrintInvoice: false,
    statusTransitions: ENTITY.workflow.transitions,
    hasReservationFields: false,
    approvalConfig: null,
    availabilityLabels: null,
    companionUserConfig: null,
    language: 'en',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Plan J §J1 — listPage formatStatus wiring', () => {
  let src;
  beforeAll(() => { src = makeListSource(); });

  test('TC-UC7.5-STATFMT-001: imports formatStatus from utils/statusFormatter', () => {
    expect(src).toMatch(/import\s*\{\s*formatStatus\s*\}\s*from\s*'.*\/utils\/statusFormatter'/);
  });

  test('TC-UC7.5-STATFMT-002: defines ENTITY_SLUG so the formatter call has a stable namespace', () => {
    expect(src).toMatch(/const\s+ENTITY_SLUG\s*=\s*'invoice'/);
  });

  test('TC-UC7.5-STATFMT-003: renders status column through formatStatus(ENTITY_SLUG, value)', () => {
    expect(src).toMatch(/formatStatus\(ENTITY_SLUG,\s*value\)/);
  });

  test('TC-UC7.5-STATFMT-004: does NOT render a raw {value} inside a status badge', () => {
    // Look for the "getStatusBadgeClass(...)>{value}" pattern that was
    // there before J1. Catching it via a single regex keeps the test
    // robust to whitespace tweaks but specific enough to flag a real
    // regression.
    expect(src).not.toMatch(/getStatusBadgeClass\([^)]*\)\s*}>\s*\{\s*value\s*\}/);
  });
});

describe('Plan J §J1 — formPage formatStatus wiring', () => {
  let src;
  beforeAll(() => { src = makeFormSource(); });

  test('TC-UC7.5-STATFMT-010: imports formatStatus from utils/statusFormatter', () => {
    expect(src).toMatch(/import\s*\{\s*formatStatus\s*\}\s*from\s*'.*\/utils\/statusFormatter'/);
  });

  test('TC-UC7.5-STATFMT-011: defines ENTITY_SLUG', () => {
    expect(src).toMatch(/const\s+ENTITY_SLUG\s*=\s*'invoice'/);
  });

  test('TC-UC7.5-STATFMT-012: status transition button label uses formatStatus', () => {
    expect(src).toMatch(/formatStatus\(ENTITY_SLUG,\s*nextStatus\)/);
  });

  test('TC-UC7.5-STATFMT-013: handleStatusChange interpolates the localized status into confirm/toast copy', () => {
    expect(src).toMatch(/const\s+localizedStatus\s*=\s*formatStatus\(ENTITY_SLUG,\s*newStatus\)/);
    expect(src).toMatch(/status:\s*localizedStatus/);
  });

  test('TC-UC7.5-STATFMT-014: does NOT pass the raw newStatus enum into i18n interpolate calls', () => {
    // The `{ status: newStatus }` pattern is fine when it's the API
    // payload sent to the backend (api.put('...', { status: newStatus }))
    // — that's an SDF identifier, not a UI string. What we DO want to
    // forbid is feeding the raw enum into a translation interpolation
    // helper, which would render unlocalized labels in the toast/confirm.
    expect(src).not.toMatch(/interpolate\([^,]+,\s*\{\s*status:\s*newStatus\s*\}\s*\)/);
  });
});
