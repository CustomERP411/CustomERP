/**
 * Plan F A6 — prefilledSdfService emits derived_field relations and
 * computed flags + the discount field + the project tax_rate field.
 *
 * SUT: platform/backend/src/services/prefilledSdfService.js
 *      (buildInvoiceEntities + buildHrEntities + buildInventoryEntities
 *       through buildPrefilledSdfDraft)
 *
 * Coverage:
 *   - invoices: subtotal/tax_total/grand_total marked computed, relations
 *     present in dependency order, discount field added, tax_rate has
 *     default_from
 *   - invoice_items: line_total marked computed + relation present;
 *     line_tax_total + line_tax_rate appear when calc_engine on
 *   - leaves: leave_days marked computed + date_diff_days_inclusive
 *     relation present
 *   - products: total_value marked computed + multiply_fields relation
 *     present when costing method is set
 */

const path = require('path');
const { buildPrefilledSdfDraft } = require(
  '../../../../platform/backend/src/services/prefilledSdfService.js'
);

function buildSdf(modules, answers = {}) {
  return buildPrefilledSdfDraft({
    projectName: 'Plan F Test',
    modules,
    mandatoryAnswers: answers,
    templateVersions: {},
  });
}

function findEntity(sdf, slug) {
  return (sdf.entities || []).find((e) => e && e.slug === slug);
}
function findField(entity, name) {
  return (entity.fields || []).find((f) => f && f.name === name);
}
function findDerived(entity, computedField) {
  return (entity.relations || []).find(
    (r) => r && r.kind === 'derived_field' && r.computed_field === computedField
  );
}

describe('Plan F A6 — invoices', () => {
  const sdf = buildSdf(['invoice'], { invoice_tax_rate: 18 });
  const invoices = findEntity(sdf, 'invoices');

  test('1. invoices entity exists', () => {
    expect(invoices).toBeDefined();
  });

  test('2. subtotal/tax_total/grand_total are marked computed:true', () => {
    expect(findField(invoices, 'subtotal').computed).toBe(true);
    expect(findField(invoices, 'tax_total').computed).toBe(true);
    expect(findField(invoices, 'grand_total').computed).toBe(true);
  });

  test('3. discount field added (decimal, not required)', () => {
    const f = findField(invoices, 'discount');
    expect(f).toBeDefined();
    expect(f.type).toBe('decimal');
    expect(f.required === true).toBe(false);
  });

  test('4. tax_rate field has default_from=modules.invoice.tax_rate', () => {
    const f = findField(invoices, 'tax_rate');
    expect(f).toBeDefined();
    expect(f.default_from).toBe('modules.invoice.tax_rate');
  });

  test('5. derived_field relations emitted in dependency order', () => {
    const sub = findDerived(invoices, 'subtotal');
    const tax = findDerived(invoices, 'tax_total');
    const grand = findDerived(invoices, 'grand_total');
    expect(sub).toBeDefined();
    expect(tax).toBeDefined();
    expect(grand).toBeDefined();
    expect(sub.formula).toMatch(/^sum_lines\(/);
    expect(tax.formula).toBe('percent_of(subtotal, tax_rate)');
    expect(grand.formula).toMatch(/^linear_combine\(/);
    // Order: subtotal before tax_total before grand_total
    const idxSub = invoices.relations.indexOf(sub);
    const idxTax = invoices.relations.indexOf(tax);
    const idxGrand = invoices.relations.indexOf(grand);
    expect(idxSub).toBeLessThan(idxTax);
    expect(idxTax).toBeLessThan(idxGrand);
  });
});

describe('Plan F A6 — invoice_items', () => {
  test('6. line_total marked computed + relation present', () => {
    const sdf = buildSdf(['invoice'], {});
    const items = findEntity(sdf, 'invoice_items');
    expect(findField(items, 'line_total').computed).toBe(true);
    const rel = findDerived(items, 'line_total');
    expect(rel).toBeDefined();
    expect(rel.formula).toBe('multiply_fields(quantity, unit_price)');
  });

  test('7. line_tax_total + line_tax_rate emitted only when calc_engine on', () => {
    const off = buildSdf(['invoice'], {});
    const itemsOff = findEntity(off, 'invoice_items');
    expect(findField(itemsOff, 'line_tax_total')).toBeUndefined();
    expect(findField(itemsOff, 'line_tax_rate')).toBeUndefined();

    const on = buildSdf(['invoice'], { invoice_enable_calc_engine: 'yes' });
    const itemsOn = findEntity(on, 'invoice_items');
    expect(findField(itemsOn, 'line_tax_total').computed).toBe(true);
    expect(findField(itemsOn, 'line_tax_rate').default_from).toBe(
      'modules.invoice.tax_rate'
    );
    const taxRel = findDerived(itemsOn, 'line_tax_total');
    expect(taxRel).toBeDefined();
    expect(taxRel.formula).toMatch(/^percent_of\(/);
  });
});

describe('Plan F A6 — leaves', () => {
  test('8. leave_days marked computed + date_diff relation present', () => {
    const sdf = buildSdf(['hr'], { hr_enable_leave_engine: 'yes' });
    const leaves = findEntity(sdf, 'leaves');
    expect(leaves).toBeDefined();
    const f = findField(leaves, 'leave_days');
    expect(f.computed).toBe(true);
    const rel = findDerived(leaves, 'leave_days');
    expect(rel).toBeDefined();
    expect(rel.formula).toBe('date_diff_days_inclusive(start_date, end_date)');
  });
});

describe('Plan F A6 — products', () => {
  test('9. total_value marked computed + multiply_fields relation when costing on', () => {
    const sdf = buildSdf(['inventory'], { inv_costing_method: 'fifo' });
    const products = findEntity(sdf, 'products');
    expect(products).toBeDefined();
    const f = findField(products, 'total_value');
    expect(f).toBeDefined();
    expect(f.computed).toBe(true);
    const rel = findDerived(products, 'total_value');
    expect(rel).toBeDefined();
    expect(rel.formula).toBe('multiply_fields(cost_price, quantity)');
  });

  test('10. total_value NOT emitted when no costing method', () => {
    const sdf = buildSdf(['inventory'], {});
    const products = findEntity(sdf, 'products');
    expect(findField(products, 'total_value')).toBeUndefined();
    expect(findDerived(products, 'total_value')).toBeUndefined();
  });
});
