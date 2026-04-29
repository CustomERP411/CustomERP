/**
 * computedFieldRegistry
 *
 * Plan B follow-up #6 — canonical list of fields that should be marked
 * `computed: true` whenever the corresponding capability toggle is on.
 *
 * Why a registry: today each module's entity builder (`hrEntities.js`,
 * `invoiceEntities.js`, `inventoryEntities.js`) has hard-coded knowledge of
 * which fields it computes. A few fields (e.g. `invoices.outstanding_balance`,
 * `invoice_items.line_total`, HR `leave_days`) are emitted from multiple
 * places (wizard pre-fill, generator AI, copy-paste SDFs) and were getting
 * out of sync. The registry centralizes "this capability owns this field"
 * and lets a single normalization pass enforce it across every codegen path.
 *
 * The registry is consulted by:
 *
 *   - `prefilledSdfService.js`        — wizard path
 *   - `systemAndRuntime.js` (or each
 *     module's entity builder)        — assembler path
 *
 * Each entry says: "if `<toggle>` is enabled and `<entity>.<field>` exists,
 * set its `computed` flag to true and clear `required` (computed values are
 * never required of the client)." Idempotent.
 *
 * Toggle paths follow the same convention as `RelationRuleRunnerMixin`:
 * dot-notation like `modules.invoice.calculation_engine.enabled`. A `null`
 * toggle means "always promote (no toggle gate)". For now we keep gating
 * explicit because turning the engine off must leave the field client-owned.
 */

const COMPUTED_FIELD_REGISTRY = [
  // Invoice calculation engine
  { entity: 'invoices',      field: 'subtotal',           toggle: 'modules.invoice.calculation_engine.enabled' },
  { entity: 'invoices',      field: 'tax_total',          toggle: 'modules.invoice.calculation_engine.enabled' },
  { entity: 'invoices',      field: 'grand_total',        toggle: 'modules.invoice.calculation_engine.enabled' },
  { entity: 'invoice_items', field: 'line_total',         toggle: 'modules.invoice.calculation_engine.enabled' },
  // Plan F A5 — per-line tax echo. Only meaningful when the invoice
  // calculation engine is on; otherwise tax is summarized at the invoice
  // header level and there's no line-tax column to compute.
  { entity: 'invoice_items', field: 'line_tax_total',     toggle: 'modules.invoice.calculation_engine.enabled' },

  // Invoice payments
  { entity: 'invoices',      field: 'outstanding_balance', toggle: 'modules.invoice.payments.enabled' },
  { entity: 'invoices',      field: 'paid_amount',         toggle: 'modules.invoice.payments.enabled' },

  // HR leave engine
  { entity: 'leaves',           field: 'leave_days',     toggle: 'modules.hr.leave_engine.enabled' },
  { entity: 'leave_balances',   field: 'available_days', toggle: 'modules.hr.leave_engine.enabled' },
  { entity: 'leave_balances',   field: 'used_days',      toggle: 'modules.hr.leave_engine.enabled' },

  // HR payroll / compensation snapshot
  { entity: 'compensation_snapshots', field: 'gross_amount', toggle: 'modules.hr.payroll.enabled' },
  { entity: 'compensation_snapshots', field: 'net_amount',   toggle: 'modules.hr.payroll.enabled' },
  { entity: 'timesheets',             field: 'total_hours',  toggle: 'modules.hr.timesheet_engine.enabled' },

  // Inventory: most computed fields are already handled by inventoryEntities.js;
  // we list them here so the registry is the single source of truth and any
  // wizard/AI-generated SDFs are normalized too.
  { entity: 'inventory_items', field: 'available_quantity', toggle: 'modules.inventory.reservations.enabled' },
  { entity: 'inventory_items', field: 'reserved_quantity',  toggle: 'modules.inventory.reservations.enabled' },
  { entity: 'inventory_items', field: 'committed_quantity', toggle: 'modules.inventory.commitments.enabled' },
  // Plan F A5 — products.total_value = cost × quantity. Always-on (no
  // capability gate); the field is only PROMOTED when both `cost` and
  // `quantity` are present on the products entity, which prefilledSdfService
  // checks before emitting the derived_field relation.
  { entity: 'products',        field: 'total_value',        toggle: null },
];

function _readToggle(modules, dotPath) {
  if (!dotPath) return true;
  if (!modules || typeof modules !== 'object') return false;
  // Strip the leading 'modules.' if present — the registry stores it as
  // 'modules.invoice.x' but the SDF root has the modules tree under `modules`.
  const parts = String(dotPath).replace(/^modules\./, '').split('.');
  let cursor = modules;
  for (const seg of parts) {
    if (cursor === null || cursor === undefined) return false;
    cursor = cursor[seg];
  }
  if (cursor === undefined || cursor === null) return false;
  if (cursor === false) return false;
  if (typeof cursor === 'object' && cursor.enabled === false) return false;
  // Default-on: treat 'present and not explicitly disabled' as enabled,
  // mirroring the assembler's behavior for module toggles.
  return true;
}

/**
 * applyComputedFieldRegistry(sdf)
 *
 * Walks the registry and promotes matching fields to `computed: true`.
 * Returns a NEW SDF; does not mutate `sdf`.
 *
 * Idempotent: re-running on an already-promoted SDF produces the same output.
 *
 * No-op when the SDF has no `entities` array.
 */
function applyComputedFieldRegistry(sdf) {
  if (!sdf || typeof sdf !== 'object') return sdf;
  const next = JSON.parse(JSON.stringify(sdf));
  applyComputedFieldRegistryToEntities(Array.isArray(next.entities) ? next.entities : [], next.modules || {});
  return next;
}

/**
 * applyComputedFieldRegistryToEntities(entities, modules)
 *
 * Mutates the given entities array in place. Used by the assembler path
 * where the entity list is already separately constructed and we want the
 * normalization to flow through without an extra deep-copy.
 */
function applyComputedFieldRegistryToEntities(entities, modules) {
  if (!Array.isArray(entities) || entities.length === 0) return;
  for (const spec of COMPUTED_FIELD_REGISTRY) {
    if (!_readToggle(modules || {}, spec.toggle)) continue;
    const entity = entities.find((e) => e && e.slug === spec.entity);
    if (!entity || !Array.isArray(entity.fields)) continue;
    const field = entity.fields.find((f) => f && f.name === spec.field);
    if (!field) continue;
    if (field.computed !== true) field.computed = true;
    if (field.required === true) field.required = false;
  }
}

module.exports = {
  COMPUTED_FIELD_REGISTRY,
  applyComputedFieldRegistry,
  applyComputedFieldRegistryToEntities,
};
