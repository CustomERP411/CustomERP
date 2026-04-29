/**
 * Plan F A1 — server-side derived formula handlers + parity with the
 * client evaluator.
 *
 * SUT: brick-library/backend-bricks/mixins/relationRuleLibrary.js
 *      brick-library/frontend-bricks/components/derivedFieldEvaluator.ts
 *
 * Why parity? Plan F's contract is that the same named formula runs in
 * BOTH places with identical semantics. If the implementations drift the
 * user sees one value while typing and a different one after save. This
 * test runs the SAME inputs through both implementations and asserts
 * identical outputs.
 *
 * Coverage:
 *   - All five new server handlers compute correctly in isolation
 *   - FORMULA_NAMES advertises every handler the runner can dispatch
 *   - Parity table for each shared formula across server and client
 */

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const ESBUILD = require(path.join(REPO_ROOT, 'platform/frontend/node_modules/esbuild'));

const {
  LIBRARY_PROTO,
  FORMULA_NAMES,
} = require(
  path.join(REPO_ROOT, 'brick-library/backend-bricks/mixins/relationRuleLibrary.js')
);
const {
  parseRelationRule,
} = require(
  path.join(REPO_ROOT, 'brick-library/backend-bricks/mixins/relationRuleParser.js')
);

function loadClientEvaluator() {
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

const client = loadClientEvaluator();

// Tiny stub repository for sum_lines on the server side.
function makeStubSelf({ childRowsByEntity = {}, mixinConfig = {} } = {}) {
  return {
    repository: {
      findAll: async (entityName) => {
        return childRowsByEntity[entityName] || [];
      },
    },
    mixinConfig,
    slug: 'invoices',
    _relUtil_asArray: LIBRARY_PROTO._relUtil_asArray,
    _relUtil_parseDate: LIBRARY_PROTO._relUtil_parseDate,
  };
}

async function runServerFormula(formulaText, computed_field, data, opts = {}) {
  const parsedRule = parseRelationRule(formulaText);
  expect(parsedRule).not.toBeNull();
  const stub = makeStubSelf(opts);
  const ctx = {
    rel: { computed_field },
    parsedRule,
    data: { ...data },
    prevState: opts.prevState || null,
    op: 'create',
  };
  const handler = LIBRARY_PROTO[`_relForm_${parsedRule.name}`];
  expect(typeof handler).toBe('function');
  await handler.call(stub, ctx);
  return ctx.data[computed_field];
}

describe('Plan F A1 — FORMULA_NAMES advertises every handler', () => {
  test('1. lists the five new Plan F handlers', () => {
    for (const name of ['multiply_fields', 'percent_of', 'linear_combine', 'date_diff_days_inclusive']) {
      expect(FORMULA_NAMES).toContain(name);
    }
    // sum_lines was already in the list; we reuse it.
    expect(FORMULA_NAMES).toContain('sum_lines');
  });

  test('2. every advertised name has a matching handler method', () => {
    for (const name of FORMULA_NAMES) {
      expect(typeof LIBRARY_PROTO[`_relForm_${name}`]).toBe('function');
    }
  });
});

describe('Plan F A1 — server multiply_fields', () => {
  test('3. multiplies positional fields', async () => {
    const out = await runServerFormula(
      'multiply_fields(quantity, unit_price)',
      'line_total',
      { quantity: 4, unit_price: 25 },
    );
    expect(out).toBe(100);
  });

  test('4. NaN-safe', async () => {
    const out = await runServerFormula(
      'multiply_fields(quantity, unit_price)',
      'line_total',
      { quantity: 'x', unit_price: 7 },
    );
    expect(out).toBe(0);
  });
});

describe('Plan F A1 — server percent_of', () => {
  test('5. default denominator 100', async () => {
    const out = await runServerFormula(
      'percent_of(subtotal, tax_rate)',
      'tax_total',
      { subtotal: 200, tax_rate: 18 },
    );
    expect(out).toBeCloseTo(36, 5);
  });

  test('6. custom denominator', async () => {
    const out = await runServerFormula(
      'percent_of(subtotal, tax_rate, denominator=1)',
      'tax_total',
      { subtotal: 200, tax_rate: 0.18 },
    );
    expect(out).toBeCloseTo(36, 5);
  });
});

describe('Plan F A1 — server linear_combine', () => {
  test('7. plus minus minus', async () => {
    const out = await runServerFormula(
      'linear_combine(plus_fields=[subtotal, tax_total], minus_fields=[discount])',
      'grand_total',
      { subtotal: 100, tax_total: 18, discount: 5 },
    );
    expect(out).toBe(113);
  });
});

describe('Plan F A1 — server date_diff_days_inclusive', () => {
  test('8. Mon→Wed = 3', async () => {
    const out = await runServerFormula(
      'date_diff_days_inclusive(start_date, end_date)',
      'leave_days',
      { start_date: '2026-04-27', end_date: '2026-04-29' },
    );
    expect(out).toBe(3);
  });

  test('9. end<start = 0', async () => {
    const out = await runServerFormula(
      'date_diff_days_inclusive(start_date, end_date)',
      'leave_days',
      { start_date: '2026-04-29', end_date: '2026-04-27' },
    );
    expect(out).toBe(0);
  });
});

describe('Plan F A1 — server sum_lines (existing handler, reused)', () => {
  test('10. sums sum_field over child rows fetched from repo', async () => {
    const out = await runServerFormula(
      'sum_lines(child_entity=invoice_items, parent_field=invoice_id, sum_field=line_total)',
      'subtotal',
      { id: 'inv-1' },
      {
        prevState: { id: 'inv-1' },
        childRowsByEntity: {
          invoice_items: [
            { line_total: 100 },
            { line_total: 50.5 },
            { line_total: 9.5 },
          ],
        },
      },
    );
    expect(out).toBe(160);
  });
});

// ---- Parity table -------------------------------------------------------

describe('Plan F — server / client parity', () => {
  const formula = 'multiply_fields(quantity, unit_price)';
  const cases = [
    { quantity: 3, unit_price: 25 },
    { quantity: 0, unit_price: 100 },
    { quantity: '4.5', unit_price: '2' },
    { quantity: 'NaN', unit_price: 5 },
  ];
  test.each(cases)('11. multiply_fields(%o) — server === client', async (input) => {
    const server = await runServerFormula(formula, 'out', input);
    const c = client.evaluate({ computed_field: 'out', formula }, { formData: input });
    expect(server).toBe(c);
  });

  const pcases = [
    { subtotal: 200, tax_rate: 18, denom: 100 },
    { subtotal: 100, tax_rate: 0, denom: 100 },
    { subtotal: 0, tax_rate: 18, denom: 100 },
    { subtotal: 200, tax_rate: 0.18, denom: 1 },
  ];
  test.each(pcases)('12. percent_of(%o) — server === client', async (input) => {
    const formula = `percent_of(subtotal, tax_rate, denominator=${input.denom})`;
    const server = await runServerFormula(formula, 'out', input);
    const c = client.evaluate({ computed_field: 'out', formula }, { formData: input });
    expect(server).toBeCloseTo(c, 6);
  });

  const lcases = [
    { subtotal: 100, tax_total: 18, discount: 5 },
    { subtotal: 0, tax_total: 0, discount: 0 },
    { subtotal: 100, tax_total: 0, discount: 200 },
  ];
  test.each(lcases)('13. linear_combine(%o) — server === client', async (input) => {
    const formula = 'linear_combine(plus_fields=[subtotal, tax_total], minus_fields=[discount])';
    const server = await runServerFormula(formula, 'out', input);
    const c = client.evaluate({ computed_field: 'out', formula }, { formData: input });
    expect(server).toBe(c);
  });

  const dcases = [
    { start_date: '2026-04-27', end_date: '2026-04-29' }, // 3
    { start_date: '2026-04-27', end_date: '2026-04-27' }, // 1
    { start_date: '2026-04-29', end_date: '2026-04-27' }, // 0
  ];
  test.each(dcases)('14. date_diff_days_inclusive(%o) — server === client', async (input) => {
    const formula = 'date_diff_days_inclusive(start_date, end_date)';
    const server = await runServerFormula(formula, 'out', input);
    const c = client.evaluate({ computed_field: 'out', formula }, { formData: input });
    expect(server).toBe(c);
  });
});
