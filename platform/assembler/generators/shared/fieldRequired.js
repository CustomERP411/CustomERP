/**
 * Canonical fields that should be treated as required in generated UIs and
 * backend validation when the SDF omits `required: true`.
 */
const ALWAYS_REQUIRED = new Set([
  'name',
  'sku',
  'code',
  'quantity',
  'unit_price',
  'cost_price',
  'order_number',
  'invoice_number',
  'customer_id',
  'supplier_id',
  'product_id',
  'item_id',
  'sales_order_id',
  'purchase_order_id',
  'employee_id',
  'department_id',
  'movement_type',
  'movement_date',
  'order_date',
  'invoice_date',
  'total_amount',
  'line_total',
  'username',
  'email',
  'ordered_qty',
  'shipped_qty',
]);

function resolveEffectiveRequired(field) {
  if (!field || field.computed === true) return false;
  if (field.required === true) return true;
  const n = String(field.name || '');
  return ALWAYS_REQUIRED.has(n);
}

module.exports = {
  ALWAYS_REQUIRED,
  resolveEffectiveRequired,
};
