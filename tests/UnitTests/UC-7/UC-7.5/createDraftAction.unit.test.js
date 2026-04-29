/**
 * Plan H — `createDraft` service-method codegen + runtime behaviour.
 *
 * SUT: platform/assembler/generators/backend/validationCodegen.js
 *      (specifically `_injectCreateDraftMethod`)
 *
 * The method is injected into the generated entity service via the
 * `// @HOOK: ADDITIONAL_METHODS` marker. We capture the injected source
 * with a fake weaver, evaluate it inside a TestService class that mocks
 * `this.create` + `this.repository`, and verify:
 *   - status is forced to the entity's literal Draft option,
 *   - required string fields receive DRAFT-{ulid} placeholders,
 *   - required date fields receive today's ISO date,
 *   - required datetime fields receive an ISO datetime,
 *   - required references stay null (validator handles them at transition),
 *   - the method calls `this.create(data)` and returns `{ id }`,
 *   - non-qualifying entities receive no injection (gate is enforced).
 */

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
  return harness;
}

function makeFakeWeaver() {
  const captured = [];
  return {
    captured,
    inject(hook, code) {
      captured.push({ hook, code });
    },
  };
}

function buildMethodCode(entity) {
  const harness = makeHarness();
  const weaver = makeFakeWeaver();
  harness._injectCreateDraftMethod(weaver, entity);
  if (!weaver.captured.length) return null;
  expect(weaver.captured[0].hook).toBe('ADDITIONAL_METHODS');
  return weaver.captured[0].code;
}

function buildTestService(methodCode, mockCreate) {
  if (!methodCode) throw new Error('No method code emitted');
  const factory = new Function(
    `
    return class TestService {
      constructor(repository, slug) {
        this.repository = repository;
        this.slug = slug;
        this._createCalls = [];
      }
      async create(data, context) {
        this._createCalls.push({ data, context });
        return { id: 'created-' + this._createCalls.length, ...data };
      }
      ${methodCode}
    };
  `
  );
  return factory();
}

const PURCHASE_ORDERS = {
  slug: 'purchase_orders',
  display_name: 'Purchase Order',
  children: ['purchase_order_items'],
  fields: [
    { name: 'po_number', type: 'string', required: true, unique: true },
    { name: 'order_date', type: 'date', required: true },
    { name: 'received_at', type: 'datetime', required: true },
    {
      name: 'status',
      type: 'string',
      required: true,
      options: ['Draft', 'Open', 'Received', 'Closed'],
    },
    { name: 'supplier_id', type: 'reference', required: true },
    { name: 'notes', type: 'string', required: false },
    { name: 'subtotal', type: 'decimal', required: false, computed: true },
  ],
};

const INVOICES_LOWERCASE_DRAFT = {
  slug: 'invoices',
  display_name: 'Invoice',
  children: ['invoice_items'],
  fields: [
    { name: 'invoice_number', type: 'string', required: true, unique: true },
    { name: 'issue_date', type: 'date', required: true },
    {
      name: 'status',
      type: 'string',
      options: ['draft', 'issued', 'paid'],
    },
  ],
};

const PRODUCTS_NO_QUALIFY = {
  slug: 'products',
  display_name: 'Product',
  children: [],
  fields: [
    { name: 'sku', type: 'string', required: true, unique: true },
  ],
};

describe('Plan H — createDraft action codegen + runtime behaviour', () => {
  test('does NOT emit createDraft for non-qualifying entities', () => {
    const code = buildMethodCode(PRODUCTS_NO_QUALIFY);
    expect(code).toBeNull();
  });

  test('emits a createDraft async method for qualifying entities', () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    expect(code).toMatch(/async createDraft\(payload, context = \{\}\)/);
    expect(code).toContain("data.status = 'Draft'");
  });

  test('runtime — forces status to Draft (preserving casing)', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    const result = await svc.createDraft({});
    expect(svc._createCalls).toHaveLength(1);
    expect(svc._createCalls[0].data.status).toBe('Draft');
    expect(result).toEqual({ id: 'created-1' });
  });

  test('runtime — preserves user-supplied status override is OVERRIDDEN to Draft', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({ status: 'Open' });
    // Plan H — the auto-draft endpoint always writes Draft, ignoring any
    // status the client tries to pre-set. Otherwise the validator's
    // __isDraft guard would be silently bypassed.
    expect(svc._createCalls[0].data.status).toBe('Draft');
  });

  test('runtime — required string fields get DRAFT-{ulid} placeholders', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({});
    const data = svc._createCalls[0].data;
    expect(data.po_number).toMatch(/^PO_NUMBER-DRAFT-/);
  });

  test('runtime — required date fields get todays ISO date (YYYY-MM-DD)', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({});
    const data = svc._createCalls[0].data;
    expect(data.order_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('runtime — required datetime fields get ISO datetime', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({});
    const data = svc._createCalls[0].data;
    expect(data.received_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('runtime — required references stay null (validator enforces on transition)', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({});
    const data = svc._createCalls[0].data;
    expect(data.supplier_id).toBeUndefined();
  });

  test('runtime — non-required fields are not auto-filled', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({});
    const data = svc._createCalls[0].data;
    expect(data.notes).toBeUndefined();
  });

  test('runtime — computed fields are not auto-filled', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({});
    const data = svc._createCalls[0].data;
    expect(data.subtotal).toBeUndefined();
  });

  test('runtime — user-supplied placeholder-eligible values are preserved', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({ po_number: 'PO-2026-001', order_date: '2026-04-29' });
    const data = svc._createCalls[0].data;
    expect(data.po_number).toBe('PO-2026-001');
    expect(data.order_date).toBe('2026-04-29');
  });

  test('runtime — empty-string placeholder-eligible values get replaced', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft({ po_number: '   ' });
    const data = svc._createCalls[0].data;
    expect(data.po_number).toMatch(/^PO_NUMBER-DRAFT-/);
  });

  test('runtime — invoices use lowercase "draft" matching their status enum', async () => {
    const code = buildMethodCode(INVOICES_LOWERCASE_DRAFT);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'invoices');
    await svc.createDraft({});
    expect(svc._createCalls[0].data.status).toBe('draft');
  });

  test('runtime — non-object payloads (null, array, string) are coerced safely', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    await svc.createDraft(null);
    await svc.createDraft([1, 2, 3]);
    await svc.createDraft('not an object');
    for (const call of svc._createCalls) {
      expect(call.data.status).toBe('Draft');
      expect(call.data.po_number).toMatch(/^PO_NUMBER-DRAFT-/);
    }
  });

  test('runtime — context is forwarded to the underlying create()', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    const ctx = { user: { id: 'u-1' } };
    await svc.createDraft({}, ctx);
    expect(svc._createCalls[0].context).toBe(ctx);
  });

  test('runtime — returns { id } shape derived from create()', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const TestService = buildTestService(code);
    const svc = new TestService({}, 'purchase_orders');
    const result = await svc.createDraft({});
    expect(result).toEqual({ id: 'created-1' });
  });

  test('runtime — handles a create() that returns a bare id (no object)', async () => {
    const code = buildMethodCode(PURCHASE_ORDERS);
    const factory = new Function(`
      return class StrIdService {
        constructor() { this.repository = {}; this.slug = 'purchase_orders'; }
        async create() { return 'bare-id-string'; }
        ${code}
      };
    `);
    const Cls = factory();
    const svc = new Cls();
    const result = await svc.createDraft({});
    expect(result).toEqual({ id: 'bare-id-string' });
  });
});
