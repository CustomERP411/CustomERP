/**
 * actorRegistry
 *
 * Plan B follow-up #3 — canonical map of "actor" fields per entity.
 *
 * Every field listed here represents "the user who did X" on a given record
 * (approver, requester, poster, ...). The migration utility
 * (sdfActorMigration.js) walks this registry and:
 *
 *   1. Adds the field if it doesn't exist (when `ensure: 'add'`).
 *   2. Retypes `string` fields to `reference -> __erp_users` when the field
 *      already exists (so projects with existing fields like
 *      `leaves.approver_id` flip to references in place).
 *   3. Emits a `reference_contract` relation (always) and a
 *      `permission_scope` relation when the spec ships a default scope.
 *
 * The registry is intentionally data-only — no behaviour. The migration code
 * is the single consumer.
 *
 * Source-of-truth alignment: this map mirrors `module_coherence_design.md`
 * Section 3.5 (string-actor migration table) plus a few additional entries
 * called out under per-capability audits in Section 4.
 */

// Spec shape:
//   {
//     field:             string         (column name on the entity)
//     ensure:            'add' | 'retype'  (default 'add')
//     purpose:           string         (descriptive prose; never rendered)
//     label:             string         (Plan E C3 — canonical English
//                                         action-past-tense form rendered as
//                                         the SDF field label, e.g.
//                                         "Approved by". For non-EN projects
//                                         the assembler glossary
//                                         (`glossary.tr.json:fields.<name>`)
//                                         translates at render time.)
//     scope:             'self' | 'manager_chain' | 'department' | 'module' | 'all' | undefined
//     permission?:       string         (when present, emit permission_scope)
//     module:            'hr' | 'invoice' | 'inventory' | 'shared' | 'access_control'
//   }

const ACTOR_REGISTRY = {
  // ----- HR module -------------------------------------------------------
  leaves: [
    {
      field: 'requested_by',
      ensure: 'add',
      purpose: 'Employee who submitted the leave',
      label: 'Requested by',
      module: 'hr',
      scope: 'self',
      permission: 'hr.leaves.create',
    },
    {
      field: 'approver_id',
      ensure: 'retype',
      purpose: 'Manager/admin who approved the leave',
      label: 'Approved by',
      module: 'hr',
      scope: 'manager_chain',
      permission: 'hr.leaves.approve',
    },
  ],
  attendance_entries: [
    {
      field: 'recorded_by',
      ensure: 'add',
      purpose: 'User who recorded the attendance entry',
      label: 'Recorded by',
      module: 'hr',
      scope: 'self',
      permission: 'hr.attendance.record',
    },
  ],
  timesheet_entries: [
    {
      field: 'submitted_by',
      ensure: 'add',
      purpose: 'Employee who submitted the timesheet entry',
      label: 'Submitted by',
      module: 'hr',
      scope: 'self',
      permission: 'hr.timesheets.submit',
    },
    {
      field: 'approved_by',
      ensure: 'retype',
      purpose: 'Manager/admin who approved the timesheet',
      label: 'Approved by',
      module: 'hr',
      scope: 'manager_chain',
      permission: 'hr.timesheets.approve',
    },
  ],
  compensation_ledger: [
    {
      field: 'posted_by',
      ensure: 'add',
      purpose: 'User who posted the compensation ledger row',
      label: 'Posted by',
      module: 'hr',
      scope: 'module',
      permission: 'hr.compensation.post',
    },
  ],

  // ----- Invoice module --------------------------------------------------
  invoices: [
    {
      field: 'posted_by',
      ensure: 'add',
      purpose: 'User who posted the invoice',
      label: 'Posted by',
      module: 'invoice',
      scope: 'module',
      permission: 'invoice.invoices.post',
    },
    {
      field: 'cancelled_by',
      ensure: 'add',
      purpose: 'User who cancelled the invoice',
      label: 'Cancelled by',
      module: 'invoice',
      scope: 'module',
      permission: 'invoice.invoices.cancel',
    },
  ],
  invoice_payments: [
    {
      field: 'recorded_by',
      ensure: 'add',
      purpose: 'User who recorded the payment',
      label: 'Recorded by',
      module: 'invoice',
      scope: 'module',
      permission: 'invoice.payments.record',
    },
    {
      field: 'cancelled_by',
      ensure: 'add',
      purpose: 'User who cancelled the payment',
      label: 'Cancelled by',
      module: 'invoice',
      scope: 'module',
      permission: 'invoice.payments.cancel',
    },
  ],
  invoice_notes: [
    {
      field: 'posted_by',
      ensure: 'add',
      purpose: 'User who issued the credit/debit note',
      label: 'Posted by',
      module: 'invoice',
      scope: 'module',
      permission: 'invoice.notes.post',
    },
    {
      field: 'cancelled_by',
      ensure: 'add',
      purpose: 'User who cancelled the note',
      label: 'Cancelled by',
      module: 'invoice',
      scope: 'module',
      permission: 'invoice.notes.cancel',
    },
  ],

  // ----- Inventory module ------------------------------------------------
  purchase_orders: [
    {
      field: 'approved_by',
      ensure: 'retype',
      purpose: 'User who approved the purchase order',
      label: 'Approved by',
      module: 'inventory',
      scope: 'module',
      permission: 'inventory.purchase_orders.approve',
    },
    {
      field: 'created_by',
      ensure: 'add',
      purpose: 'User who created the purchase order',
      label: 'Created by',
      module: 'inventory',
      scope: 'self',
    },
  ],
  goods_receipts: [
    {
      field: 'received_by',
      ensure: 'add',
      purpose: 'User who received the goods',
      label: 'Received by',
      module: 'inventory',
      scope: 'self',
      permission: 'inventory.goods_receipts.receive',
    },
    {
      field: 'posted_by',
      ensure: 'add',
      purpose: 'User who posted the receipt to stock',
      label: 'Posted by',
      module: 'inventory',
      scope: 'module',
      permission: 'inventory.goods_receipts.post',
    },
  ],
  cycle_count_sessions: [
    {
      field: 'approved_by',
      ensure: 'retype',
      purpose: 'User who approved the cycle count adjustments',
      label: 'Approved by',
      module: 'inventory',
      scope: 'module',
      permission: 'inventory.cycle_counts.approve',
    },
    {
      field: 'counted_by',
      ensure: 'add',
      purpose: 'User who performed the count',
      label: 'Counted by',
      module: 'inventory',
      scope: 'self',
    },
  ],

  // ----- System / cross-cutting -----------------------------------------
  __audit_logs: [
    {
      field: 'user_id',
      ensure: 'retype',
      purpose: 'User responsible for the audited action',
      label: 'User',
      module: 'access_control',
      // No permission_scope — audit logs are global.
    },
  ],
};

const SYSTEM_USERS_ENTITY = '__erp_users';

/**
 * Returns the spec list for `slug`, or [] if the entity has no actor fields.
 */
function getActorSpecs(slug) {
  if (!slug || typeof slug !== 'string') return [];
  const list = ACTOR_REGISTRY[slug];
  return Array.isArray(list) ? list : [];
}

/**
 * Returns every `(slug, spec)` pair in the registry, useful for migrations
 * that want to walk the full set without iterating object keys themselves.
 */
function listAllActorSpecs() {
  const out = [];
  for (const slug of Object.keys(ACTOR_REGISTRY)) {
    for (const spec of ACTOR_REGISTRY[slug]) {
      out.push({ slug, spec });
    }
  }
  return out;
}

module.exports = {
  ACTOR_REGISTRY,
  SYSTEM_USERS_ENTITY,
  getActorSpecs,
  listAllActorSpecs,
};
