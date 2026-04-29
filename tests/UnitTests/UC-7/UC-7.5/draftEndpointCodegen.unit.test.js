/**
 * Plan H — draft endpoint codegen gate.
 *
 * SUT: platform/assembler/generators/backend/routeGenerator.js +
 *      platform/assembler/generators/backend/validationCodegen.js
 *
 * Verifies the qualifying-entity gate for the auto-draft creation flow:
 *   - entity has non-empty `children[]`,
 *   - entity has a `status` field,
 *   - status options include `Draft` (case-insensitive).
 *
 * Positive: parents that should get a `POST /draft` route + `createDraft`
 *           service method (purchase_orders, sales_orders, goods_receipts,
 *           cycle_count_sessions, invoices, mixed-case 'draft', explicit
 *           reference resolution via `enum`).
 * Negative: leaf entities, entities without `children[]`, entities with
 *           `children[]` but no Draft status, and entities with a Draft
 *           status but no inline children.
 */

const RouteGenerator = require(
  '../../../../platform/assembler/generators/backend/routeGenerator'
);
const ValidationCodegen = require(
  '../../../../platform/assembler/generators/backend/validationCodegen'
);

function makeHarness() {
  const harness = {
    _escapeJsString(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
    },
    _isFieldMultiple(field) {
      return !!(field && (field.multiple === true || field.is_array === true));
    },
  };
  Object.assign(harness, ValidationCodegen);
  Object.assign(harness, RouteGenerator);
  return harness;
}

const PURCHASE_ORDERS = {
  slug: 'purchase_orders',
  display_name: 'Purchase Order',
  children: ['purchase_order_items'],
  fields: [
    { name: 'po_number', type: 'string', required: true, unique: true },
    { name: 'order_date', type: 'date', required: true },
    {
      name: 'status',
      type: 'string',
      required: true,
      options: ['Draft', 'Open', 'Received', 'Closed'],
    },
    { name: 'supplier_id', type: 'reference', required: true },
  ],
};

const INVOICES = {
  slug: 'invoices',
  display_name: 'Invoice',
  children: ['invoice_items'],
  fields: [
    { name: 'invoice_number', type: 'string', required: true, unique: true },
    {
      name: 'status',
      type: 'string',
      options: ['draft', 'issued', 'paid'],
    },
  ],
};

const PRODUCTS = {
  slug: 'products',
  display_name: 'Product',
  children: [],
  fields: [
    { name: 'sku', type: 'string', required: true, unique: true },
    { name: 'name', type: 'string', required: true },
  ],
};

const TASKS_NO_DRAFT = {
  slug: 'tasks',
  display_name: 'Task',
  children: ['task_subtasks'],
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'status', type: 'string', options: ['Open', 'Done'] },
  ],
};

const PAYMENTS_DRAFT_NO_CHILDREN = {
  slug: 'payments',
  display_name: 'Payment',
  fields: [
    { name: 'amount', type: 'number', required: true },
    { name: 'status', type: 'string', options: ['Draft', 'Posted'] },
  ],
};

const ENUM_VARIANT = {
  slug: 'sales_orders',
  display_name: 'Sales Order',
  children: ['sales_order_lines'],
  fields: [
    { name: 'so_number', type: 'string', required: true, unique: true },
    { name: 'status', type: 'string', enum: ['DRAFT', 'CONFIRMED'] },
  ],
};

describe('Plan H — draft endpoint codegen gate', () => {
  describe('_qualifiesForAutoDraft', () => {
    test('positive — parent with children + Draft status', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(PURCHASE_ORDERS)).toBe(true);
    });

    test('positive — invoices with lowercase "draft" status', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(INVOICES)).toBe(true);
    });

    test('positive — uppercase "DRAFT" via `enum` alias is recognized', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(ENUM_VARIANT)).toBe(true);
    });

    test('negative — leaf entity with no children[] does NOT qualify', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(PRODUCTS)).toBe(false);
    });

    test('negative — children but no Draft status does NOT qualify', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(TASKS_NO_DRAFT)).toBe(false);
    });

    test('negative — Draft status but no children does NOT qualify', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(PAYMENTS_DRAFT_NO_CHILDREN)).toBe(false);
    });

    test('negative — undefined / non-object input falls through to false', () => {
      const h = makeHarness();
      expect(h._qualifiesForAutoDraft(undefined)).toBe(false);
      expect(h._qualifiesForAutoDraft(null)).toBe(false);
      expect(h._qualifiesForAutoDraft({})).toBe(false);
    });
  });

  describe('_buildDraftRouteDefinition', () => {
    test('emits POST /draft route for qualifying entity', () => {
      const h = makeHarness();
      const route = h._buildDraftRouteDefinition(PURCHASE_ORDERS);
      expect(route).toContain("router.post('/draft'");
      expect(route).toContain("'createDraft'");
      expect(route).toContain('req.body || {}');
    });

    test('returns empty string for non-qualifying entity (leaf)', () => {
      const h = makeHarness();
      expect(h._buildDraftRouteDefinition(PRODUCTS)).toBe('');
    });

    test('returns empty string for entity with children but no Draft status', () => {
      const h = makeHarness();
      expect(h._buildDraftRouteDefinition(TASKS_NO_DRAFT)).toBe('');
    });
  });

  describe('_getDraftStatusValue', () => {
    test('returns the literal Draft value preserving casing (Draft)', () => {
      const h = makeHarness();
      expect(h._getDraftStatusValue(PURCHASE_ORDERS)).toBe('Draft');
    });

    test('returns the literal lowercase value (draft) for invoices', () => {
      const h = makeHarness();
      expect(h._getDraftStatusValue(INVOICES)).toBe('draft');
    });

    test('returns the literal uppercase value (DRAFT) when enum uses caps', () => {
      const h = makeHarness();
      expect(h._getDraftStatusValue(ENUM_VARIANT)).toBe('DRAFT');
    });

    test('falls back to "Draft" when the status field/options are missing', () => {
      const h = makeHarness();
      expect(h._getDraftStatusValue({})).toBe('Draft');
      expect(h._getDraftStatusValue({ fields: [] })).toBe('Draft');
    });
  });
});
