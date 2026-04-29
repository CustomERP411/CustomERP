/**
 * UC-7.5 / Plan B follow-up #6 — computedFieldRegistry tests.
 *
 * SUT: platform/assembler/assembler/computedFieldRegistry.js
 *
 * 5 cases:
 *   1. Each registry entry promoted under its toggle (smoke)
 *   2. Toggle off -> field unchanged
 *   3. Field absent on entity -> no-op (no field added)
 *   4. Idempotent: running twice produces equivalent SDF
 *   5. `required: true` is cleared when promoting to computed
 */

const path = require('path');
const {
  applyComputedFieldRegistry,
  COMPUTED_FIELD_REGISTRY,
} = require(path.resolve(
  __dirname,
  '../../../../platform/assembler/assembler/computedFieldRegistry.js'
));

function makeSdf(modulesPatch = {}) {
  return {
    modules: {
      invoice: { calculation_engine: { enabled: true }, payments: { enabled: true } },
      hr: { leave_engine: { enabled: true }, payroll: { enabled: true }, timesheet_engine: { enabled: true } },
      inventory: { reservations: { enabled: true }, commitments: { enabled: true } },
      ...modulesPatch,
    },
    entities: [
      {
        slug: 'invoices',
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'subtotal', type: 'number' },
          { name: 'tax_total', type: 'number' },
          { name: 'grand_total', type: 'number' },
          { name: 'outstanding_balance', type: 'number' },
        ],
      },
      {
        slug: 'invoice_items',
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'line_total', type: 'number', required: true },
        ],
      },
      {
        slug: 'leaves',
        fields: [
          { name: 'id', type: 'uuid' },
          { name: 'leave_days', type: 'number' },
        ],
      },
    ],
  };
}

describe('computedFieldRegistry (UC-7.5)', () => {
  test('promotes registered fields when their toggles are enabled', () => {
    const sdf = makeSdf();
    const out = applyComputedFieldRegistry(sdf);
    const invoices = out.entities.find((e) => e.slug === 'invoices');
    expect(invoices.fields.find((f) => f.name === 'subtotal').computed).toBe(true);
    expect(invoices.fields.find((f) => f.name === 'tax_total').computed).toBe(true);
    expect(invoices.fields.find((f) => f.name === 'grand_total').computed).toBe(true);
    expect(invoices.fields.find((f) => f.name === 'outstanding_balance').computed).toBe(true);
    const leaves = out.entities.find((e) => e.slug === 'leaves');
    expect(leaves.fields.find((f) => f.name === 'leave_days').computed).toBe(true);
  });

  test('toggle off leaves the field unchanged', () => {
    const sdf = makeSdf({ invoice: { calculation_engine: { enabled: false }, payments: { enabled: false } } });
    const out = applyComputedFieldRegistry(sdf);
    const invoices = out.entities.find((e) => e.slug === 'invoices');
    for (const name of ['subtotal', 'tax_total', 'grand_total', 'outstanding_balance']) {
      const field = invoices.fields.find((f) => f.name === name);
      expect(field.computed).toBeFalsy();
    }
  });

  test('absent fields are not added by the registry', () => {
    const sdf = {
      modules: { invoice: { calculation_engine: { enabled: true } } },
      entities: [{ slug: 'invoices', fields: [{ name: 'id', type: 'uuid' }] }],
    };
    const out = applyComputedFieldRegistry(sdf);
    const invoices = out.entities.find((e) => e.slug === 'invoices');
    expect(invoices.fields.length).toBe(1); // unchanged
    expect(invoices.fields[0].name).toBe('id');
  });

  test('idempotent: second pass produces equivalent SDF', () => {
    const sdf = makeSdf();
    const once = applyComputedFieldRegistry(sdf);
    const twice = applyComputedFieldRegistry(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  test('clears `required: true` when promoting a field to computed', () => {
    const sdf = makeSdf();
    const out = applyComputedFieldRegistry(sdf);
    const lineTotal = out.entities
      .find((e) => e.slug === 'invoice_items').fields
      .find((f) => f.name === 'line_total');
    expect(lineTotal.computed).toBe(true);
    expect(lineTotal.required).toBe(false);
  });

  test('registry has expected entries (sanity)', () => {
    const slugs = COMPUTED_FIELD_REGISTRY.map((e) => `${e.entity}.${e.field}`);
    expect(slugs).toContain('invoices.subtotal');
    expect(slugs).toContain('invoices.outstanding_balance');
    expect(slugs).toContain('leaves.leave_days');
  });
});
