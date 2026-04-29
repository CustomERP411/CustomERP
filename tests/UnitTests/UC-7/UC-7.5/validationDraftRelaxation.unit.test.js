/**
 * Plan H — required-field validation relaxation while status === 'Draft'.
 *
 * SUT: platform/assembler/generators/backend/validationCodegen.js
 *
 * The create + update snippets each compute `__isDraft` from the incoming
 * status value (or, on update, the merged row's status) and gate every
 * required-field rule on `!__isDraft`. Computed-stripping, uniqueness,
 * length, options, pattern, numeric, and reference-existence checks all
 * stay active.
 *
 * Approach: build the snippets with the real codegen, wrap them in async
 * functions, and exercise them against an in-memory fake repository.
 */

const ValidationCodegen = require(
  '../../../../platform/assembler/generators/backend/validationCodegen'
);

function makeHarness() {
  const harness = {
    _language: 'en',
    _escapeJsString(s) {
      return String(s == null ? '' : s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'");
    },
  };
  Object.assign(harness, ValidationCodegen);
  return harness;
}

function buildCreateRunner(entity, allEntities = [entity]) {
  const harness = makeHarness();
  const snippet = harness._buildCreateValidationSnippet(entity, allEntities);
  if (!snippet) throw new Error('No create snippet emitted');
  const factory = new Function(
    'snippet',
    `return async function runCreate(data) { ${snippet} return data; };`
  );
  return factory(snippet);
}

function buildUpdateRunner(entity, allEntities = [entity]) {
  const harness = makeHarness();
  const snippet = harness._buildUpdateValidationSnippet(entity, allEntities);
  if (!snippet) throw new Error('No update snippet emitted');
  const factory = new Function(
    'snippet',
    `return async function runUpdate(id, data) { ${snippet} return merged; };`
  );
  return factory(snippet);
}

function fakeRepository(seed = {}) {
  const tables = {};
  for (const [slug, rows] of Object.entries(seed)) tables[slug] = rows.slice();
  return {
    tables,
    async findAll(slug) {
      return (tables[slug] || []).slice();
    },
    async findById(slug, id) {
      return (tables[slug] || []).find((r) => String(r.id) === String(id)) || null;
    },
  };
}

const PURCHASE_ORDERS = {
  slug: 'purchase_orders',
  display_name: 'Purchase Order',
  children: ['purchase_order_items'],
  fields: [
    { name: 'po_number', type: 'string', label: 'PO Number', required: true, unique: true, max_length: 32 },
    { name: 'order_date', type: 'date', label: 'Order Date', required: true },
    {
      name: 'status',
      type: 'string',
      label: 'Status',
      required: true,
      options: ['Draft', 'Open', 'Received', 'Closed'],
    },
    { name: 'supplier_id', type: 'reference', label: 'Supplier', required: true, reference_entity: 'suppliers' },
    { name: 'note', type: 'string', label: 'Note', max_length: 8 },
  ],
};

const SUPPLIERS = {
  slug: 'suppliers',
  display_name: 'Supplier',
  fields: [{ name: 'name', type: 'string', label: 'Name', required: true }],
};

// A second entity whose status enum uses LOWERCASE `draft`, used to verify
// that the case-insensitive `__isDraft` check works against entities that
// model status that way (e.g. invoices in some packs).
const INVOICES_LOWERCASE = {
  slug: 'invoices_lc',
  display_name: 'Invoice',
  children: ['invoice_items'],
  fields: [
    { name: 'invoice_number', type: 'string', label: 'Invoice Number', required: true, unique: true },
    { name: 'issue_date', type: 'date', label: 'Issue Date', required: true },
    {
      name: 'status',
      type: 'string',
      label: 'Status',
      required: true,
      options: ['draft', 'issued', 'paid'],
    },
  ],
};

describe('Plan H — required-field validation relaxes while status=Draft', () => {
  describe('create snippet', () => {
    test('Draft status — required fields are NOT required', async () => {
      const run = buildCreateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({ purchase_orders: [], suppliers: [] }),
      };
      // Status is Draft; po_number / order_date / supplier_id are all
      // missing. Validation must NOT throw.
      await expect(
        run.call(ctx, { status: 'Draft' })
      ).resolves.toBeTruthy();
    });

    test('Draft status (lowercase) on a lowercase-enum entity — matches __isDraft', async () => {
      const run = buildCreateRunner(INVOICES_LOWERCASE, [INVOICES_LOWERCASE]);
      const ctx = {
        slug: 'invoices_lc',
        repository: fakeRepository({ invoices_lc: [] }),
      };
      // status='draft' both passes the options check AND triggers
      // __isDraft, so required fields (invoice_number, issue_date) can
      // stay empty without throwing.
      await expect(run.call(ctx, { status: 'draft' })).resolves.toBeTruthy();
    });

    test('case-insensitive __isDraft — DRAFT (uppercase) also relaxes required-field rules', async () => {
      // Use an entity whose enum allows BOTH 'DRAFT' and 'Draft' so the
      // options check passes and only the case-insensitive __isDraft
      // matters for skipping required-field rules.
      const dualCaseEntity = {
        ...PURCHASE_ORDERS,
        fields: PURCHASE_ORDERS.fields.map((f) =>
          f.name === 'status'
            ? { ...f, options: ['Draft', 'DRAFT', 'Open', 'Received', 'Closed'] }
            : f
        ),
      };
      const run = buildCreateRunner(dualCaseEntity, [dualCaseEntity, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({ purchase_orders: [], suppliers: [] }),
      };
      await expect(run.call(ctx, { status: 'DRAFT' })).resolves.toBeTruthy();
    });

    test('Non-Draft status — required fields fire validation errors', async () => {
      const run = buildCreateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({ purchase_orders: [], suppliers: [] }),
      };
      let err;
      try {
        await run.call(ctx, { status: 'Open' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      expect(err.fieldErrors).toMatchObject({
        po_number: 'PO Number is required',
        order_date: 'Order Date is required',
        supplier_id: 'Supplier is required',
      });
    });

    test('Draft status — uniqueness check still fires when violated', async () => {
      const run = buildCreateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({
          purchase_orders: [{ id: 'po-1', po_number: 'PO-DUP' }],
          suppliers: [],
        }),
      };
      let err;
      try {
        await run.call(ctx, { status: 'Draft', po_number: 'PO-DUP' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.fieldErrors).toMatchObject({ po_number: 'PO Number must be unique' });
    });

    test('Draft status — length check still fires on out-of-bound input', async () => {
      const run = buildCreateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({ purchase_orders: [], suppliers: [] }),
      };
      let err;
      try {
        await run.call(ctx, { status: 'Draft', note: 'this-string-is-way-too-long-for-the-8-char-cap' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.fieldErrors).toMatchObject({ note: 'Note must be at most 8 characters' });
    });

    test('Draft status — options check still fires for status not in the enum', async () => {
      const run = buildCreateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({ purchase_orders: [], suppliers: [] }),
      };
      // Verify the enum gate runs — status itself must be one of the
      // allowed options. (The qualifying-entity gate guarantees Draft is
      // present, but invalid values like 'Sketch' must still 400.)
      let err;
      try {
        await run.call(ctx, { status: 'Sketch' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.fieldErrors.status).toContain('Status must be one of');
    });

    test('Draft status — reference-existence check still fires for bad FK', async () => {
      const run = buildCreateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({
          purchase_orders: [],
          suppliers: [{ id: 'supplier-real' }],
        }),
      };
      let err;
      try {
        await run.call(ctx, { status: 'Draft', supplier_id: 'supplier-fake' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.fieldErrors).toMatchObject({
        supplier_id: 'Supplier has an invalid reference',
      });
    });
  });

  describe('update snippet (transition out of Draft re-engages required checks)', () => {
    test('Draft → Draft update — required fields still NOT required', async () => {
      const run = buildUpdateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({
          purchase_orders: [
            { id: 'po-1', status: 'Draft', po_number: 'PO_NUMBER-DRAFT-abc' },
          ],
          suppliers: [],
        }),
      };
      // Update keeps status=Draft but leaves required fields blank.
      // Validation must NOT throw.
      await expect(
        run.call(ctx, 'po-1', { status: 'Draft', notes: 'still drafting' })
      ).resolves.toBeTruthy();
    });

    test('Draft → Open transition — required-field rules re-engage', async () => {
      const run = buildUpdateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({
          purchase_orders: [
            { id: 'po-1', status: 'Draft', po_number: 'PO_NUMBER-DRAFT-abc' },
          ],
          suppliers: [],
        }),
      };
      let err;
      try {
        await run.call(ctx, 'po-1', { status: 'Open' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.statusCode).toBe(400);
      // Existing po_number is fine, but order_date and supplier_id are
      // missing on the merged row, so the transition must surface them.
      expect(err.fieldErrors).toMatchObject({
        order_date: 'Order Date is required',
        supplier_id: 'Supplier is required',
      });
      // po_number was satisfied (placeholder from createDraft), so it
      // should NOT be in the field errors.
      expect(err.fieldErrors.po_number).toBeUndefined();
    });

    test('Open → Open update — required-field rules apply normally', async () => {
      const run = buildUpdateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({
          purchase_orders: [
            {
              id: 'po-2',
              status: 'Open',
              po_number: 'PO-OPEN',
              order_date: '2026-01-15',
              supplier_id: 'supp-1',
            },
          ],
          suppliers: [{ id: 'supp-1' }],
        }),
      };
      // Strip out required fields by setting them blank. Should fail.
      let err;
      try {
        await run.call(ctx, 'po-2', { po_number: '' });
      } catch (e) {
        err = e;
      }
      expect(err).toBeTruthy();
      expect(err.fieldErrors).toMatchObject({
        po_number: 'PO Number is required',
      });
    });

    test('Open → Draft update — moving back to Draft relaxes required checks', async () => {
      const run = buildUpdateRunner(PURCHASE_ORDERS, [PURCHASE_ORDERS, SUPPLIERS]);
      const ctx = {
        slug: 'purchase_orders',
        repository: fakeRepository({
          purchase_orders: [
            {
              id: 'po-3',
              status: 'Open',
              po_number: 'PO-OPEN',
              order_date: '2026-01-15',
              supplier_id: 'supp-1',
            },
          ],
          suppliers: [{ id: 'supp-1' }],
        }),
      };
      // Move status back to Draft and clear po_number — must NOT throw.
      await expect(
        run.call(ctx, 'po-3', { status: 'Draft', po_number: '' })
      ).resolves.toBeTruthy();
    });
  });
});
