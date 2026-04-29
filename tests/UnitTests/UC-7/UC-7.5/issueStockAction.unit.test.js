/**
 * UC-7.5 / Plan E — Group E (invoice -> stock) action handlers.
 *
 * SUT: brick-library/backend-bricks/mixins/relationRuleLibrary.js
 *      (_relAct_issue_stock, _relAct_reverse_issue_stock)
 *      brick-library/backend-bricks/mixins/RelationRuleRunnerMixin.js
 *      (after-persist dispatch)
 *
 * Coverage:
 *   1. Posted -> issue_stock fans out per child line; one
 *      atomicAdjustQuantity(-qty) and one stock_movements row per line
 *      with a non-empty product_id.
 *   2. Lines whose product_id is empty/null are skipped silently (no
 *      adjust call, no audit row).
 *   3. When invoice_items.location_id is set, the audit row carries it.
 *   4. Posted -> Cancelled fires reverse_issue_stock: positive
 *      atomicAdjustQuantity(+qty) plus a compensating Adjust audit row
 *      tagged origin_ref `<slug>:<id>:reverse`. The original Issue row
 *      is preserved (audit is immutable).
 *   5. Toggle gating: when modules.invoice.stock_link.enabled = false,
 *      _relWhenActive() makes the runner skip the relation entirely.
 *   6. allow_negative_stock toggle is forwarded into atomicAdjustQuantity.
 */

const RelationRuleRunnerMixinFactory = require(
  '../../../../brick-library/backend-bricks/mixins/RelationRuleRunnerMixin'
);

function buildRunnerClass(slug = 'invoices') {
  const mixin = RelationRuleRunnerMixinFactory({});
  const code = `class RelationRuleService {
    constructor(repo, mixinConfig) {
      this.repository = repo;
      this.mixinConfig = mixinConfig || {};
      this.slug = ${JSON.stringify(slug)};
      this._relPrevState = null;
    }
    ${mixin.methods}
  }
  return RelationRuleService;`;
  // eslint-disable-next-line no-new-func
  return new Function(code)();
}

function buildRepoStub(seed = {}) {
  const data = JSON.parse(JSON.stringify(seed));
  const adjustments = [];
  return {
    findAll: jest.fn(async (slug, filter = {}) => {
      const rows = data[slug] || [];
      return rows.filter((row) => {
        for (const [k, v] of Object.entries(filter)) {
          if (String(row[k]) !== String(v)) return false;
        }
        return true;
      });
    }),
    findById: jest.fn(async (slug, id) => {
      const rows = data[slug] || [];
      return rows.find((r) => String(r.id) === String(id)) || null;
    }),
    create: jest.fn(async (slug, row) => {
      data[slug] = data[slug] || [];
      const created = { id: data[slug].length + 1, ...row };
      data[slug].push(created);
      return created;
    }),
    delete: jest.fn(async (slug, id) => {
      data[slug] = (data[slug] || []).filter((r) => String(r.id) !== String(id));
      return true;
    }),
    atomicAdjustQuantity: jest.fn(async (slug, id, delta, opts) => {
      adjustments.push({ slug, id, delta, opts });
      const rows = data[slug] || [];
      const row = rows.find((r) => String(r.id) === String(id));
      if (row) row.quantity = (Number(row.quantity) || 0) + Number(delta);
      return row || { id, quantity: Number(delta) };
    }),
    _data: data,
    _adjustments: adjustments,
  };
}

function makeStockLinkRelation() {
  return {
    kind: 'status_propagation',
    on: { field: 'status', to: 'Posted' },
    effect: {
      action: 'issue_stock(child_entity=invoice_items, parent_field=invoice_id, item_field=product_id, qty_field=quantity, location_field=location_id, stock_entity=products)',
      target_entity: 'stock_movements',
      stock_entity: 'products',
    },
    reverse: {
      on: { field: 'status', to: 'Cancelled' },
      action: 'reverse_issue_stock()',
    },
    when: 'modules.invoice.stock_link.enabled',
  };
}

let RunnerClass;
beforeAll(() => {
  RunnerClass = buildRunnerClass('invoices');
});

let warnSpy;
let errorSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('Plan E — issue_stock / reverse_issue_stock action handlers', () => {
  test('1. Posted fan-out: one adjust + one stock_movements row per stocked line', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [
        { id: 'P1', quantity: 100 },
        { id: 'P2', quantity: 50 },
      ],
      invoice_items: [
        { id: 11, invoice_id: 42, product_id: 'P1', quantity: 3 },
        { id: 12, invoice_id: 42, product_id: 'P2', quantity: 1 },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.invoice.stock_link.enabled': true },
      },
    });
    const data = { status: 'Posted' };
    const result = { id: 42, status: 'Posted', invoice_number: 'INV-001' };
    const prevState = { id: 42, status: 'Draft' };

    await svc._relRunAfterPersist('update', data, result, prevState);

    expect(repo.atomicAdjustQuantity).toHaveBeenCalledTimes(2);
    expect(repo._adjustments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'products', id: 'P1', delta: -3 }),
        expect.objectContaining({ slug: 'products', id: 'P2', delta: -1 }),
      ])
    );
    const movements = repo._data.stock_movements || [];
    expect(movements).toHaveLength(2);
    movements.forEach((m) => {
      expect(m.movement_type).toBe('Issue');
      expect(m.origin_ref).toBe('invoices:42');
      expect(m.reference_number).toBe('INV-001');
      expect(typeof m.movement_date).toBe('string');
    });
  });

  test('2. Lines with empty product_id are skipped silently', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [{ id: 'P1', quantity: 100 }],
      invoice_items: [
        { id: 11, invoice_id: 42, product_id: 'P1', quantity: 2 },
        { id: 12, invoice_id: 42, product_id: null, description: 'Service fee', quantity: 1 },
        { id: 13, invoice_id: 42, product_id: '', description: 'Free-text line', quantity: 1 },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.invoice.stock_link.enabled': true },
      },
    });
    await svc._relRunAfterPersist(
      'update',
      { status: 'Posted' },
      { id: 42, status: 'Posted' },
      { id: 42, status: 'Draft' }
    );

    expect(repo.atomicAdjustQuantity).toHaveBeenCalledTimes(1);
    expect(repo._adjustments[0]).toEqual(
      expect.objectContaining({ id: 'P1', delta: -2 })
    );
    expect((repo._data.stock_movements || [])).toHaveLength(1);
  });

  test('3. multi-location: line.location_id is forwarded into the stock_movements row', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [{ id: 'P1', quantity: 100 }],
      invoice_items: [
        { id: 11, invoice_id: 42, product_id: 'P1', quantity: 5, location_id: 'LOC-A' },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.invoice.stock_link.enabled': true },
      },
    });
    await svc._relRunAfterPersist(
      'update',
      { status: 'Posted' },
      { id: 42, status: 'Posted' },
      { id: 42, status: 'Draft' }
    );

    const movements = repo._data.stock_movements || [];
    expect(movements).toHaveLength(1);
    expect(movements[0].location_id).toBe('LOC-A');
  });

  test('4. Cancelled triggers reverse_issue_stock: restore + compensating Adjust row', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [{ id: 'P1', quantity: 95 }],
      // The forward action wrote these earlier; now we run the reverse.
      stock_movements: [
        {
          id: 1,
          item_id: 'P1',
          movement_type: 'Issue',
          quantity: 5,
          origin_ref: 'invoices:42',
        },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.invoice.stock_link.enabled': true },
      },
    });
    await svc._relRunAfterPersist(
      'update',
      { status: 'Cancelled' },
      { id: 42, status: 'Cancelled' },
      { id: 42, status: 'Posted' }
    );

    expect(repo.atomicAdjustQuantity).toHaveBeenCalledTimes(1);
    expect(repo._adjustments[0]).toEqual(
      expect.objectContaining({ id: 'P1', delta: 5 })
    );
    const movements = repo._data.stock_movements;
    // Original row preserved + compensating Adjust appended.
    expect(movements).toHaveLength(2);
    expect(movements[0]).toEqual(
      expect.objectContaining({ movement_type: 'Issue', origin_ref: 'invoices:42' })
    );
    expect(movements[1]).toEqual(
      expect.objectContaining({
        movement_type: 'Adjust',
        item_id: 'P1',
        quantity: 5,
        origin_ref: 'invoices:42:reverse',
      })
    );
  });

  test('5. toggle off: stock_link.enabled=false makes the runner skip the relation', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [{ id: 'P1', quantity: 100 }],
      invoice_items: [{ id: 11, invoice_id: 42, product_id: 'P1', quantity: 3 }],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.invoice.stock_link.enabled': false },
      },
    });
    await svc._relRunAfterPersist(
      'update',
      { status: 'Posted' },
      { id: 42, status: 'Posted' },
      { id: 42, status: 'Draft' }
    );

    expect(repo.atomicAdjustQuantity).not.toHaveBeenCalled();
    expect((repo._data.stock_movements || [])).toHaveLength(0);
  });

  test('6. allow_negative_stock toggle is forwarded to atomicAdjustQuantity', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [{ id: 'P1', quantity: 1 }],
      invoice_items: [{ id: 11, invoice_id: 42, product_id: 'P1', quantity: 3 }],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: {
          'modules.invoice.stock_link.enabled': true,
          'modules.inventory.allow_negative_stock': true,
        },
      },
    });
    await svc._relRunAfterPersist(
      'update',
      { status: 'Posted' },
      { id: 42, status: 'Posted' },
      { id: 42, status: 'Draft' }
    );
    expect(repo.atomicAdjustQuantity).toHaveBeenCalledWith(
      'products',
      'P1',
      -3,
      expect.objectContaining({ allow_negative_stock: true })
    );
  });

  test('7. reverse skips rows with non-Issue movement_type so a second cancel is a no-op', async () => {
    const relation = makeStockLinkRelation();
    const repo = buildRepoStub({
      products: [{ id: 'P1', quantity: 100 }],
      stock_movements: [
        // After a previous reverse: the original Issue row + a compensating
        // Adjust row already exist. Running reverse again must NOT
        // re-restore (would double-credit stock).
        { id: 1, item_id: 'P1', movement_type: 'Issue', quantity: 5, origin_ref: 'invoices:42' },
        { id: 2, item_id: 'P1', movement_type: 'Adjust', quantity: 5, origin_ref: 'invoices:42:reverse' },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.invoice.stock_link.enabled': true },
      },
    });
    // findAll filters by origin_ref === 'invoices:42' (the forward tag),
    // so only the original Issue row is returned. We restore once.
    await svc._relRunAfterPersist(
      'update',
      { status: 'Cancelled' },
      { id: 42, status: 'Cancelled' },
      { id: 42, status: 'Posted' }
    );
    // One restore + one new compensating row.
    expect(repo.atomicAdjustQuantity).toHaveBeenCalledTimes(1);
  });

  test('8. ACTION_NAMES export includes issue_stock and reverse_issue_stock', () => {
    const { ACTION_NAMES } = require(
      '../../../../brick-library/backend-bricks/mixins/relationRuleLibrary'
    );
    expect(ACTION_NAMES).toEqual(expect.arrayContaining(['issue_stock', 'reverse_issue_stock']));
  });
});
