/**
 * Plan F A2 — derivedFieldEvaluator (client) unit tests.
 *
 * SUT: brick-library/frontend-bricks/components/derivedFieldEvaluator.ts
 *
 * Loaded via esbuild on-the-fly (same pattern as
 * dependencyMirrorParity.unit.test.js) so we don't need a TS build step.
 *
 * Coverage:
 *   - parseFormula round-trips every shape used by the named handlers
 *   - multiply_fields with positional and keyword args, NaN-safe
 *   - percent_of with default and custom denominator, missing rate
 *   - linear_combine with plus + minus, missing fields = 0
 *   - date_diff_days_inclusive (Mon→Wed = 3, same day = 1, end<start = 0)
 *   - sum_lines reads childItemsBySlug, ignores rows w/o the sum_field
 *   - unknown handler returns undefined (caller leaves value alone)
 */

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const ESBUILD = require(path.join(REPO_ROOT, 'platform/frontend/node_modules/esbuild'));

function loadEvaluator() {
  const tsSource = fs.readFileSync(
    path.join(REPO_ROOT, 'brick-library/frontend-bricks/components/derivedFieldEvaluator.ts'),
    'utf8'
  );
  const out = ESBUILD.transformSync(tsSource, { loader: 'ts', format: 'cjs' });
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', out.code)(mod, mod.exports);
  return mod.exports;
}

const E = loadEvaluator();

describe('Plan F A2 — parseFormula', () => {
  test('1. parses positional args', () => {
    const p = E.parseFormula('multiply_fields(quantity, unit_price)');
    expect(p).toEqual({ name: 'multiply_fields', args: {}, positional: ['quantity', 'unit_price'] });
  });

  test('2. parses keyword args', () => {
    const p = E.parseFormula('sum_lines(child_entity=invoice_items, parent_field=invoice_id, sum_field=line_total)');
    expect(p.name).toBe('sum_lines');
    expect(p.args.child_entity).toBe('invoice_items');
    expect(p.args.parent_field).toBe('invoice_id');
    expect(p.args.sum_field).toBe('line_total');
  });

  test('3. parses array values', () => {
    const p = E.parseFormula('linear_combine(plus_fields=[subtotal, tax_total], minus_fields=[discount])');
    expect(p.args.plus_fields).toEqual(['subtotal', 'tax_total']);
    expect(p.args.minus_fields).toEqual(['discount']);
  });

  test('4. returns null on garbage input', () => {
    expect(E.parseFormula('')).toBeNull();
    expect(E.parseFormula(null)).toBeNull();
    expect(E.parseFormula('not a formula')).toBeNull();
  });
});

describe('Plan F A2 — multiply_fields', () => {
  const rel = { computed_field: 'line_total', formula: 'multiply_fields(quantity, unit_price)' };

  test('5. multiplies two numeric fields', () => {
    expect(E.evaluate(rel, { formData: { quantity: 3, unit_price: 25 } })).toBe(75);
  });

  test('6. handles strings via Number(...)', () => {
    expect(E.evaluate(rel, { formData: { quantity: '3', unit_price: '10.5' } })).toBe(31.5);
  });

  test('7. NaN-safe: missing inputs collapse to 0', () => {
    expect(E.evaluate(rel, { formData: {} })).toBe(0);
    expect(E.evaluate(rel, { formData: { quantity: 'abc', unit_price: 5 } })).toBe(0);
  });
});

describe('Plan F A2 — percent_of', () => {
  test('8. computes percent at default denominator (100)', () => {
    const rel = { computed_field: 'tax_total', formula: 'percent_of(subtotal, tax_rate)' };
    expect(E.evaluate(rel, { formData: { subtotal: 200, tax_rate: 18 } })).toBeCloseTo(36, 5);
  });

  test('9. honors custom denominator', () => {
    const rel = {
      computed_field: 'fractional_tax',
      formula: 'percent_of(subtotal, tax_rate, denominator=1)',
    };
    expect(E.evaluate(rel, { formData: { subtotal: 200, tax_rate: 0.18 } })).toBeCloseTo(36, 5);
  });

  test('10. missing rate = 0', () => {
    const rel = { computed_field: 'tax_total', formula: 'percent_of(subtotal, tax_rate)' };
    expect(E.evaluate(rel, { formData: { subtotal: 200 } })).toBe(0);
  });
});

describe('Plan F A2 — linear_combine', () => {
  const rel = {
    computed_field: 'grand_total',
    formula: 'linear_combine(plus_fields=[subtotal, tax_total], minus_fields=[discount])',
  };

  test('11. sums plus minus minus', () => {
    expect(E.evaluate(rel, { formData: { subtotal: 100, tax_total: 18, discount: 5 } })).toBe(113);
  });

  test('12. treats missing fields as 0', () => {
    expect(E.evaluate(rel, { formData: { subtotal: 100 } })).toBe(100);
  });

  test('13. returns plain number, not string', () => {
    const v = E.evaluate(rel, { formData: { subtotal: '50', tax_total: '9', discount: '4' } });
    expect(typeof v).toBe('number');
    expect(v).toBe(55);
  });
});

describe('Plan F A2 — date_diff_days_inclusive', () => {
  const rel = {
    computed_field: 'leave_days',
    formula: 'date_diff_days_inclusive(start_date, end_date)',
  };

  test('14. Mon→Wed = 3 days (inclusive)', () => {
    expect(E.evaluate(rel, { formData: { start_date: '2026-04-27', end_date: '2026-04-29' } })).toBe(3);
  });

  test('15. same day = 1', () => {
    expect(E.evaluate(rel, { formData: { start_date: '2026-04-27', end_date: '2026-04-27' } })).toBe(1);
  });

  test('16. end<start = 0', () => {
    expect(E.evaluate(rel, { formData: { start_date: '2026-04-29', end_date: '2026-04-27' } })).toBe(0);
  });

  test('17. missing date = 0', () => {
    expect(E.evaluate(rel, { formData: { start_date: '2026-04-27' } })).toBe(0);
    expect(E.evaluate(rel, { formData: {} })).toBe(0);
  });
});

describe('Plan F A2 — sum_lines', () => {
  const rel = {
    computed_field: 'subtotal',
    formula: 'sum_lines(child_entity=invoice_items, parent_field=invoice_id, sum_field=line_total)',
  };

  test('18. sums sum_field across childItemsBySlug rows', () => {
    const ctx = {
      formData: {},
      childItemsBySlug: {
        invoice_items: [
          { line_total: 100 },
          { line_total: 50.5 },
          { line_total: 9.5 },
        ],
      },
    };
    expect(E.evaluate(rel, ctx)).toBe(160);
  });

  test('19. returns 0 when no children', () => {
    expect(E.evaluate(rel, { formData: {} })).toBe(0);
    expect(E.evaluate(rel, { formData: {}, childItemsBySlug: { invoice_items: [] } })).toBe(0);
  });

  test('20. ignores rows missing the sum_field', () => {
    const ctx = {
      formData: {},
      childItemsBySlug: {
        invoice_items: [{ line_total: 10 }, { description: 'no total' }, { line_total: '5' }],
      },
    };
    expect(E.evaluate(rel, ctx)).toBe(15);
  });
});

describe('Plan F A2 — unknown handler', () => {
  test('21. unknown formula name returns undefined', () => {
    const rel = { computed_field: 'x', formula: 'no_such_handler(a, b)' };
    expect(E.evaluate(rel, { formData: {} })).toBeUndefined();
  });

  test('22. malformed formula returns undefined', () => {
    const rel = { computed_field: 'x', formula: 'not_a_call' };
    expect(E.evaluate(rel, { formData: {} })).toBeUndefined();
  });
});
