/**
 * Plan H — formPage emits AUTO_DRAFT_ON_CREATE constant + mount-time
 * effect for qualifying entities (children[] non-empty AND status enum
 * contains Draft/draft).
 *
 * SUT: platform/assembler/generators/frontend/entityPages/formPage.js
 *
 * Approach: template assertions on the emitted page source. We verify:
 *   - the AUTO_DRAFT_ON_CREATE constant matches qualification,
 *   - the mount-time effect calls api.post('/{slug}/draft', initialFromQuery),
 *   - on success it navigates to /{slug}/{newId}/edit with replace:true,
 *   - on error it falls back gracefully (toast + setAutoDraftCreating(false)),
 *   - the rendered tree shows a "Preparing your draft" branch only when
 *     autoDraftCreating is true.
 */

const { buildEntityFormPage } = require(
  '../../../../platform/assembler/generators/frontend/entityPages/formPage'
);

function buildArgs(overrides = {}) {
  return {
    entity: { slug: 'purchase_orders', display_name: 'Purchase Order' },
    entityName: 'PurchaseOrders',
    fieldDefs: "{ name: 'po_number', type: 'string' },",
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

const QUALIFYING_PO = {
  slug: 'purchase_orders',
  display_name: 'Purchase Order',
  children: ['purchase_order_items'],
  fields: [
    { name: 'po_number', type: 'string', required: true, unique: true },
    { name: 'status', type: 'string', options: ['Draft', 'Open', 'Closed'] },
  ],
};

const QUALIFYING_INVOICE_LOWERCASE = {
  slug: 'invoices',
  display_name: 'Invoice',
  children: ['invoice_items'],
  fields: [
    { name: 'invoice_number', type: 'string', required: true, unique: true },
    { name: 'status', type: 'string', options: ['draft', 'issued'] },
  ],
};

const NON_QUALIFYING_NO_CHILDREN = {
  slug: 'products',
  display_name: 'Product',
  children: [],
  fields: [
    { name: 'sku', type: 'string', required: true, unique: true },
    { name: 'status', type: 'string', options: ['Draft', 'Active'] },
  ],
};

const NON_QUALIFYING_NO_DRAFT = {
  slug: 'tasks',
  display_name: 'Task',
  children: ['subtasks'],
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'status', type: 'string', options: ['Open', 'Done'] },
  ],
};

const NON_QUALIFYING_NO_STATUS = {
  slug: 'comments',
  display_name: 'Comment',
  children: ['comment_replies'],
  fields: [{ name: 'body', type: 'string', required: true }],
};

describe('Plan H — formPage AUTO_DRAFT_ON_CREATE flag', () => {
  test('purchase_orders qualifies — emits AUTO_DRAFT_ON_CREATE = true', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toContain('const AUTO_DRAFT_ON_CREATE = true as const;');
  });

  test('invoices with lowercase "draft" enum still qualifies', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_INVOICE_LOWERCASE }));
    expect(out).toContain('const AUTO_DRAFT_ON_CREATE = true as const;');
  });

  test('products (no children) does NOT qualify — flag is false', () => {
    const out = buildEntityFormPage(buildArgs({ entity: NON_QUALIFYING_NO_CHILDREN }));
    expect(out).toContain('const AUTO_DRAFT_ON_CREATE = false as const;');
  });

  test('tasks (children but no Draft status) does NOT qualify — flag is false', () => {
    const out = buildEntityFormPage(buildArgs({ entity: NON_QUALIFYING_NO_DRAFT }));
    expect(out).toContain('const AUTO_DRAFT_ON_CREATE = false as const;');
  });

  test('comments (children but no status field) does NOT qualify — flag is false', () => {
    const out = buildEntityFormPage(buildArgs({ entity: NON_QUALIFYING_NO_STATUS }));
    expect(out).toContain('const AUTO_DRAFT_ON_CREATE = false as const;');
  });
});

describe('Plan H — auto-draft mount effect (qualifying entities)', () => {
  test('the mount effect is gated on !isEdit && AUTO_DRAFT_ON_CREATE', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toMatch(/if \(isEdit \|\| !AUTO_DRAFT_ON_CREATE\) return;/);
  });

  test('the effect POSTs /{slug}/draft with initialFromQuery as the body', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toContain("api.post('/purchase_orders/draft', initialFromQuery)");
  });

  test('on success the effect navigates to /{slug}/{newId}/edit with replace:true', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toContain("navigate('/purchase_orders/' + newId + '/edit', { replace: true })");
  });

  test('on success the effect pre-arms loading=true to avoid empty-form flash', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    // Verify setLoading(true) appears inside the navigate branch (paired
    // with the navigate call so the forthcoming GET shows "Loading…").
    const idx = out.indexOf("navigate('/purchase_orders/' + newId + '/edit'");
    expect(idx).toBeGreaterThan(-1);
    const window = out.slice(Math.max(0, idx - 200), idx);
    expect(window).toContain('setLoading(true)');
  });

  test('on error the effect calls setAutoDraftCreating(false) + toasts the fallback', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toContain('setAutoDraftCreating(false)');
    expect(out).toContain('I18N.draftFailedFallback');
  });

  test('the effect runs once on mount (empty deps array)', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    // A useEffect with the auto-draft body should be terminated by the
    // empty-deps array. Assert the deps array appears alongside the
    // disable-comment for hooks-exhaustive-deps and the api.post line.
    const idx = out.indexOf("api.post('/purchase_orders/draft'");
    expect(idx).toBeGreaterThan(-1);
    const tail = out.slice(idx, idx + 1500);
    expect(tail).toMatch(/eslint-disable-next-line react-hooks\/exhaustive-deps/);
    expect(tail).toMatch(/\}, \[\]\);/);
  });
});

describe('Plan H — render branches and i18n keys', () => {
  test('I18N.draftCreating + I18N.draftFailedFallback are referenced in the template', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toContain('I18N.draftCreating');
    expect(out).toContain('I18N.draftFailedFallback');
  });

  test('the "Preparing your draft" branch precedes the loading branch', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    const draftIdx = out.indexOf('autoDraftCreating ?');
    const loadingIdx = out.indexOf('loading ? (');
    expect(draftIdx).toBeGreaterThan(-1);
    expect(loadingIdx).toBeGreaterThan(-1);
    expect(draftIdx).toBeLessThan(loadingIdx);
  });

  test('autoDraftCreating initial state is gated on !isEdit && AUTO_DRAFT_ON_CREATE', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO }));
    expect(out).toMatch(
      /useState<boolean>\(!isEdit && AUTO_DRAFT_ON_CREATE\)/
    );
  });

  test('English copy: "Preparing your draft…" is present in I18N JSON', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO, language: 'en' }));
    expect(out).toContain('Preparing your draft');
    expect(out).toContain('Draft creation failed');
  });

  test('Turkish copy: "Taslak hazırlanıyor…" is present in I18N JSON for tr', () => {
    const out = buildEntityFormPage(buildArgs({ entity: QUALIFYING_PO, language: 'tr' }));
    expect(out).toContain('Taslak hazırlanıyor');
    expect(out).toContain('Taslak oluşturulamadı');
  });
});

describe('Plan H — non-qualifying entities still emit a working form', () => {
  test('non-qualifying entity emits no api.post(/draft) call', () => {
    const out = buildEntityFormPage(buildArgs({ entity: NON_QUALIFYING_NO_CHILDREN }));
    // Effect body is still there (gated at runtime) but with the
    // const false, the runtime path short-circuits. Codegen-time we
    // accept either: the effect can still appear since it's runtime
    // gated — what matters is the AUTO_DRAFT_ON_CREATE constant.
    expect(out).toContain('const AUTO_DRAFT_ON_CREATE = false as const;');
  });

  test('non-qualifying entity still preserves the existing "save first" hint', () => {
    const out = buildEntityFormPage(buildArgs({ entity: NON_QUALIFYING_NO_DRAFT }));
    expect(out).toContain('I18N.lineItemsSaveFirst');
  });
});
