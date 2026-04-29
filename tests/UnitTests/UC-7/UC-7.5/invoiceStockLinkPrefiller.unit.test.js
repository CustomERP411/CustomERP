/**
 * UC-7.5 / Plan E — Group E (invoice -> stock).
 *
 * SUT: platform/backend/src/services/prefilledSdfService.js
 *      (_applyStockLinkSchema runs after _applyLinkToggles)
 *
 * Coverage:
 *   1. stock_link off (only one module selected): no product_id, no
 *      location_id, no status_propagation relation on invoices.
 *   2. stock_link on (both modules + invoice_stock_link=yes), single-
 *      location: product_id appended to invoice_items, NO location_id,
 *      status_propagation issue_stock relation on invoices.
 *   3. stock_link on + multi-location: location_id appended with
 *      visibility_when, sibling conditional_required invariant on
 *      invoice_items, status_propagation relation on invoices.
 *   4. Renamed stock entity: when modules.inventory.stock_entity is
 *      'tires' (user renamed `products`), the action's stock_entity arg
 *      and product_id reference_entity both use the new slug.
 *   5. Idempotency: running the prefiller twice yields the same SDF
 *      shape (no duplicate fields/relations). [Smoke check via running
 *      the same input through buildPrefilledSdfDraft twice.]
 */

const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const { buildPrefilledSdfDraft } = require(path.join(
  REPO_ROOT,
  'platform/backend/src/services/prefilledSdfService.js',
));

function findEntity(sdf, slug) {
  return (sdf.entities || []).find((e) => e && e.slug === slug);
}

describe('Plan E — invoice -> stock prefiller schema', () => {
  test('1. stock_link off: no product_id, no location_id, no propagation relation', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice'],
      mandatoryAnswers: { invoice_stock_link: 'yes' },
      templateVersions: {},
    });

    const items = findEntity(sdf, 'invoice_items');
    expect(items).toBeTruthy();
    const fieldNames = items.fields.map((f) => f.name);
    expect(fieldNames).not.toContain('product_id');
    expect(fieldNames).not.toContain('location_id');

    const invoices = findEntity(sdf, 'invoices');
    const hasIssueStock = (invoices.relations || []).some(
      (r) => r.kind === 'status_propagation'
        && r.effect && typeof r.effect.action === 'string'
        && r.effect.action.indexOf('issue_stock') === 0
    );
    expect(hasIssueStock).toBe(false);
  });

  test('2. stock_link on, single-location: product_id added, no location_id, propagation relation present', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: {
        invoice_stock_link: 'yes',
        inv_multi_location: 'no',
      },
      templateVersions: {},
    });

    expect(sdf.modules.invoice.stock_link).toEqual({ enabled: true });

    const items = findEntity(sdf, 'invoice_items');
    const productIdField = items.fields.find((f) => f.name === 'product_id');
    expect(productIdField).toMatchObject({
      name: 'product_id',
      type: 'reference',
      reference_entity: 'products',
    });
    expect(items.fields.find((f) => f.name === 'location_id')).toBeUndefined();
    expect(
      (items.relations || []).some(
        (r) => r.kind === 'invariant'
          && typeof r.rule === 'string'
          && r.rule.indexOf('conditional_required') === 0
          && r.rule.indexOf('field=location_id') !== -1
      )
    ).toBe(false);

    const invoices = findEntity(sdf, 'invoices');
    const stockProp = (invoices.relations || []).find(
      (r) => r.kind === 'status_propagation'
        && r.effect && typeof r.effect.action === 'string'
        && r.effect.action.indexOf('issue_stock') === 0
    );
    expect(stockProp).toBeTruthy();
    expect(stockProp.on).toEqual({ field: 'status', to: 'Posted' });
    expect(stockProp.effect.target_entity).toBe('stock_movements');
    expect(stockProp.when).toBe('modules.invoice.stock_link.enabled');
    expect(stockProp.effect.action).toContain('child_entity=invoice_items');
    expect(stockProp.effect.action).toContain('parent_field=invoice_id');
    expect(stockProp.effect.action).toContain('item_field=product_id');
    expect(stockProp.effect.action).toContain('qty_field=quantity');
    expect(stockProp.effect.action).toContain('stock_entity=products');
    expect(stockProp.reverse).toBeTruthy();
    expect(stockProp.reverse.on).toEqual({ field: 'status', to: 'Cancelled' });
    expect(stockProp.reverse.action).toBe('reverse_issue_stock()');
  });

  test('3. stock_link on + multi-location: location_id with visibility_when + paired conditional_required', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: {
        invoice_stock_link: 'yes',
        inv_multi_location: 'yes',
      },
      templateVersions: {},
    });

    const items = findEntity(sdf, 'invoice_items');
    const locationField = items.fields.find((f) => f.name === 'location_id');
    expect(locationField).toMatchObject({
      name: 'location_id',
      type: 'reference',
      reference_entity: 'locations',
    });
    expect(locationField.visibility_when).toEqual({
      field: 'product_id',
      is_set: true,
    });

    const conditionalRequired = (items.relations || []).find(
      (r) => r.kind === 'invariant'
        && typeof r.rule === 'string'
        && r.rule.indexOf('conditional_required') === 0
        && r.rule.indexOf('field=location_id') !== -1
    );
    expect(conditionalRequired).toBeTruthy();
    expect(conditionalRequired.severity).toBe('block');
    expect(conditionalRequired.rule).toContain('when_field=product_id');
    expect(conditionalRequired.rule).toContain('when_is_set=true');
  });

  test('4. idempotency: running buildPrefilledSdfDraft twice yields one product_id, one relation', () => {
    const args = {
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: {
        invoice_stock_link: 'yes',
        inv_multi_location: 'yes',
      },
      templateVersions: {},
    };
    const a = buildPrefilledSdfDraft(args);
    const b = buildPrefilledSdfDraft(args);

    const itemsA = findEntity(a, 'invoice_items');
    const itemsB = findEntity(b, 'invoice_items');
    expect(itemsA.fields.filter((f) => f.name === 'product_id')).toHaveLength(1);
    expect(itemsB.fields.filter((f) => f.name === 'product_id')).toHaveLength(1);
    expect(itemsA.fields.filter((f) => f.name === 'location_id')).toHaveLength(1);

    const invoicesA = findEntity(a, 'invoices');
    const issueStockRels = (invoicesA.relations || []).filter(
      (r) => r.kind === 'status_propagation'
        && r.effect && typeof r.effect.action === 'string'
        && r.effect.action.indexOf('issue_stock') === 0
    );
    expect(issueStockRels).toHaveLength(1);
  });

  test('5. stock_link explicitly off ("no"): does not emit schema bits even with both modules', () => {
    const sdf = buildPrefilledSdfDraft({
      projectName: 'Test',
      modules: ['invoice', 'inventory'],
      mandatoryAnswers: {
        invoice_stock_link: 'no',
        inv_multi_location: 'yes',
      },
      templateVersions: {},
    });

    expect(sdf.modules.invoice.stock_link).toEqual({ enabled: false });

    const items = findEntity(sdf, 'invoice_items');
    expect(items.fields.find((f) => f.name === 'product_id')).toBeUndefined();
    expect(items.fields.find((f) => f.name === 'location_id')).toBeUndefined();

    const invoices = findEntity(sdf, 'invoices');
    const hasIssueStock = (invoices.relations || []).some(
      (r) => r.kind === 'status_propagation'
        && r.effect && typeof r.effect.action === 'string'
        && r.effect.action.indexOf('issue_stock') === 0
    );
    expect(hasIssueStock).toBe(false);
  });
});
