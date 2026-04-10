// Basic unit-style tests for invoice-related backend bricks.
// Run with: node test/invoice_bricks.unit.test.js

/* eslint-disable no-console */

const assert = require('assert');

const InvoiceMixin = require('../brick-library/backend-bricks/mixins/InvoiceMixin');
const InvoiceItemsMixin = require('../brick-library/backend-bricks/mixins/InvoiceItemsMixin');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// InvoiceMixin configuration behavior
runTest('InvoiceMixin applies default config when no overrides provided', () => {
  const mixin = InvoiceMixin();
  assert.ok(mixin);
  assert.ok(mixin.hooks);

  const beforeCreate = mixin.hooks.BEFORE_CREATE_TRANSFORMATION;
  assert.ok(
    beforeCreate.includes('"INV-"') ||
      beforeCreate.includes('INV-'),
    'Default invoice prefix should be present in generated hook code'
  );
  assert.ok(
    beforeCreate.includes('Draft'),
    'Default statuses should include Draft'
  );
});

runTest('InvoiceMixin respects custom prefix and tax_rate', () => {
  const mixin = InvoiceMixin({
    prefix: 'BILL-',
    tax_rate: 15,
  });

  const beforeCreate = mixin.hooks.BEFORE_CREATE_TRANSFORMATION;
  assert.ok(
    beforeCreate.includes('BILL-'),
    'Custom invoice prefix should be embedded in hook code'
  );
  assert.ok(
    beforeCreate.includes('"tax_rate":15') ||
      beforeCreate.includes('tax_rate\":15'),
    'Custom tax_rate should be embedded in hook code'
  );
});

runTest('InvoiceItemsMixin validates numeric quantity and unit_price', () => {
  const mixin = InvoiceItemsMixin();
  assert.ok(mixin);
  assert.ok(mixin.hooks);

  const validate = mixin.hooks.BEFORE_CREATE_VALIDATION;
  assert.ok(
    validate.includes('Quantity and unit price must be numbers'),
    'Validation hook should guard against non-numeric quantity/unit_price'
  );
});

runTest('InvoiceItemsMixin recalculation method uses invoice_items and invoices', () => {
  const mixin = InvoiceItemsMixin();
  const methods = mixin.methods;

  assert.ok(
    methods.includes("findAll('invoice_items'") ||
      methods.includes('findAll(\"invoice_items\"'),
    'Recalculation should read from invoice_items'
  );
  assert.ok(
    methods.includes("update('invoices'") ||
      methods.includes('update(\"invoices\"'),
    'Recalculation should update invoices totals'
  );
});

if (!process.exitCode) {
  console.log('All invoice brick unit checks passed.');
}

