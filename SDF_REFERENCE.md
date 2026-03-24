## CustomERP SDF Reference (Schema Definition Format)

This document defines **all supported SDF properties** currently implemented by CustomERP’s generators/assembler.

Use it as the authoritative reference when writing or generating SDF JSON files.

---

## Top-level shape

An SDF file is a JSON object:

- **`project_name`** *(string, required)*: Human name for the generated ERP project.
- **`modules`** *(object, optional)*: Enables/disables global modules (dashboard widgets, activity log, reports) **and** ERP modules (`inventory`, `invoice`, `hr`).
- **`entities`** *(array, required)*: List of entity definitions (tables/resources) to generate.

### ERP module toggles (optional)
Use `modules.inventory|invoice|hr` to enable/disable ERP modules:
```json
{
  "modules": {
    "inventory": { "enabled": true },
    "invoice": { "enabled": true },
    "hr": { "enabled": false }
  }
}
```

### When to enable ERP modules
- **Inventory**: default module. Use for stock, materials, locations, movements, and simple employee references tied to inventory actions.
- **Invoice**: enable only when invoicing/billing is explicitly requested (invoices, billing, payments, quote-to-cash).
- **HR**: enable only when HR features are explicitly requested (departments, leave tracking, payroll, working hours, HR module).
- If employees are only used to record who handled inventory actions, keep `employees` in `inventory` or `shared` and do **not** enable HR.
- If a module is enabled, its required entities must exist; incomplete modules may be auto-disabled during AI normalization or fail validation downstream.

---

## Invoice Module (`modules.invoice`)

Enables invoicing, PDF generation, and payment tracking.

- **`modules.invoice.enabled`** *(boolean)*
- **`modules.invoice.tax_rate`** *(number, default 0)*: Global default tax rate percentage.
- **`modules.invoice.currency`** *(string, default "USD")*: Currency code/symbol.
- **`modules.invoice.payment_terms`** *(number, default 30)*: Default due date offset in days.
- **`modules.invoice.prefix`** *(string, default "INV-")*: Invoice number prefix.

### Base expected entities
When invoice is enabled, generator expects:

1. **`invoices`** (Header) — **required**
   - Core fields: `invoice_number`, `customer_id` (reference), `issue_date`, `due_date`, `status`, `subtotal`, `tax_total`, `grand_total`.
2. **`customers`** (Shared) — **required**
   - Used for the invoice customer reference.
3. **`invoice_items`** (Line Items) — optional baseline, but required for calculation-engine pack.
   - Typical fields: `invoice_id`, `description`, `quantity`, `unit_price`, `line_total`.

### Invoice Priority A Capability Packs (`modules.invoice`)

Use these optional packs to enable production-grade invoice behavior per generated ERP.
Each pack is toggle-based and can be enabled independently.

```json
{
  "modules": {
    "invoice": {
      "enabled": true,
      "transactions": { "enabled": true },
      "payments": { "enabled": true },
      "notes": { "enabled": true },
      "lifecycle": { "enabled": true },
      "calculation_engine": { "enabled": true }
    }
  }
}
```

#### Pack: transactions (DB-safe numbering/posting)

- **`modules.invoice.transactions.enabled`** *(boolean)*
- **`modules.invoice.transactions.invoice_entity`** *(string, default `"invoices"`)*  
- **`modules.invoice.transactions.invoice_item_entity`** *(string, default `"invoice_items"`)*  
- **`modules.invoice.transactions.invoice_number_field`** *(string, default `"invoice_number"`)*  
- **`modules.invoice.transactions.idempotency_field`** *(string, default `"idempotency_key"`)*  
- **`modules.invoice.transactions.posted_at_field`** *(string, default `"posted_at"`)*  

Generated backend APIs (on invoice header entity):
- `POST /api/<invoice_entity>/:id/issue`
- `POST /api/<invoice_entity>/:id/cancel`

#### Pack: payments (record and allocate)

- **`modules.invoice.payments.enabled`** *(boolean)*
- **`modules.invoice.payments.payment_entity`** *(string, default `"invoice_payments"`)*  
- **`modules.invoice.payments.allocation_entity`** *(string, default `"invoice_payment_allocations"`)*  
- **`modules.invoice.payments.payment_number_field`** *(string, default `"payment_number"`)*  
- **`modules.invoice.payments.amount_field`** *(string, default `"amount"`)*  
- **`modules.invoice.payments.unallocated_field`** *(string, default `"unallocated_amount"`)*  
- **`modules.invoice.payments.status_field`** *(string, default `"status"`)*  
- **`modules.invoice.payments.allocation_payment_field`** *(string, default `"payment_id"`)*  
- **`modules.invoice.payments.allocation_invoice_field`** *(string, default `"invoice_id"`)*  
- **`modules.invoice.payments.allocation_amount_field`** *(string, default `"amount"`)*  

Generated backend APIs:
- `POST /api/<invoice_entity>/:id/payments`
- `GET /api/<invoice_entity>/:id/payments`
- `POST /api/<payment_entity>/:id/post`
- `POST /api/<payment_entity>/:id/cancel`

#### Pack: notes (credit/debit note workflow)

- **`modules.invoice.notes.enabled`** *(boolean)*
- **`modules.invoice.notes.note_entity`** *(string, default `"invoice_notes"`)*  
- **`modules.invoice.notes.note_number_field`** *(string, default `"note_number"`)*  
- **`modules.invoice.notes.note_invoice_field`** *(string, default `"source_invoice_id"`)*  
- **`modules.invoice.notes.note_type_field`** *(string, default `"note_type"`; values: `Credit`, `Debit`)*  
- **`modules.invoice.notes.note_status_field`** *(string, default `"status"`)*  
- **`modules.invoice.notes.note_amount_field`** *(string, default `"amount"`)*  

Generated backend APIs:
- `POST /api/<invoice_entity>/:id/notes`
- `GET /api/<invoice_entity>/:id/notes`
- `POST /api/<note_entity>/:id/post`
- `POST /api/<note_entity>/:id/cancel`

#### Pack: lifecycle (strict status rules)

- **`modules.invoice.lifecycle.enabled`** *(boolean)*
- **`modules.invoice.lifecycle.status_field`** *(string, default `"status"`)*  
- **`modules.invoice.lifecycle.statuses`** *(array, default `["Draft","Sent","Paid","Overdue","Cancelled"]`)*  
- **`modules.invoice.lifecycle.enforce_transitions`** *(boolean, default `true`)*  

When enabled, generated services enforce strict state transitions for invoice status updates.

#### Pack: calculation_engine (line-level pricing/tax/discount/charges)

- **`modules.invoice.calculation_engine.enabled`** *(boolean)*
- **`modules.invoice.calculation_engine.invoice_item_entity`** *(string, default `"invoice_items"`)*  
- **`modules.invoice.calculation_engine.item_invoice_field`** *(string, default `"invoice_id"`)*  
- **`modules.invoice.calculation_engine.item_quantity_field`** *(string, default `"quantity"`)*  
- **`modules.invoice.calculation_engine.item_unit_price_field`** *(string, default `"unit_price"`)*  
- **`modules.invoice.calculation_engine.item_line_subtotal_field`** *(string, default `"line_subtotal"`)*  
- **`modules.invoice.calculation_engine.item_discount_type_field`** *(string, default `"line_discount_type"`)*  
- **`modules.invoice.calculation_engine.item_discount_value_field`** *(string, default `"line_discount_value"`)*  
- **`modules.invoice.calculation_engine.item_discount_total_field`** *(string, default `"line_discount_total"`)*  
- **`modules.invoice.calculation_engine.item_tax_rate_field`** *(string, default `"line_tax_rate"`)*  
- **`modules.invoice.calculation_engine.item_tax_total_field`** *(string, default `"line_tax_total"`)*  
- **`modules.invoice.calculation_engine.item_additional_charge_field`** *(string, default `"line_additional_charge"`)*  
- **`modules.invoice.calculation_engine.item_line_total_field`** *(string, default `"line_total"`)*  

When enabled, generated backend computes invoice totals from line-level values (discount/tax/charge) instead of relying only on a global tax default.

### Auto-entity behavior
If Invoice Priority A packs are enabled and required entities/fields are missing, assembler auto-adds minimal runtime entities/fields:
- `invoice_payments`, `invoice_payment_allocations` for payments,
- `invoice_notes` for credit/debit notes,
- extra invoice and invoice-item fields needed by transaction/lifecycle/calculation packs.

This keeps capabilities toggle-driven and backward-compatible for generated ERP projects.

---

## HR Module (`modules.hr`)

Enables employee management, department structure, and leave tracking.

- **`modules.hr.enabled`** *(boolean)*
- **`modules.hr.work_days`** *(array, default ["Mon", "Tue", "Wed", "Thu", "Fri"])*: Working days.
- **`modules.hr.daily_hours`** *(number, default 8)*: Standard daily working hours.

### Expected Entities
When enabled, the generator expects these entities:

1. **`employees`** — **required**
   - Typical fields: `first_name`, `last_name`, `email`, `phone`, `job_title`, `hire_date`, `status`, `salary`.
   - **Features**: `features.audit_trail: true` (recommended).

2. **`departments`** — **optional**
   - Typical fields: `name`, `manager_id` (reference to `employees`), `location`.

3. **`leaves`** / **`leave_requests`** — **optional**
   - Typical fields: `employee_id` (reference), `leave_type`, `start_date`, `end_date`, `reason`, `status`.

### HR Priority A Capability Packs (`modules.hr`)

Use these optional packs to enable production-grade HR workflows per generated ERP.
Each pack is toggle-based and can be enabled independently.

```json
{
  "modules": {
    "hr": {
      "enabled": true,
      "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "daily_hours": 8,
      "leave_engine": { "enabled": true },
      "leave_approvals": { "enabled": true },
      "attendance_time": { "enabled": true },
      "compensation_ledger": { "enabled": true }
    }
  }
}
```

#### Shared HR base config

- **`modules.hr.employee_entity`** *(string, default `"employees"`)*  
- **`modules.hr.department_entity`** *(string, default `"departments"`)*  
- **`modules.hr.leave_entity`** *(string, default `"leaves"`)*  

#### Pack: leave_engine (leave policy + balances)

- **`modules.hr.leave_engine.enabled`** *(boolean)*
- **`modules.hr.leave_engine.leave_entity`** *(string, default `"leaves"`)*  
- **`modules.hr.leave_engine.balance_entity`** *(string, default `"leave_balances"`)*  
- **`modules.hr.leave_engine.employee_field`** *(string, default `"employee_id"`)*  
- **`modules.hr.leave_engine.leave_type_field`** *(string, default `"leave_type"`)*  
- **`modules.hr.leave_engine.start_date_field`** *(string, default `"start_date"`)*  
- **`modules.hr.leave_engine.end_date_field`** *(string, default `"end_date"`)*  
- **`modules.hr.leave_engine.days_field`** *(string, default `"leave_days"`)*  
- **`modules.hr.leave_engine.entitlement_field`** *(string, default `"annual_entitlement"`)*  
- **`modules.hr.leave_engine.accrued_field`** *(string, default `"accrued_days"`)*  
- **`modules.hr.leave_engine.consumed_field`** *(string, default `"consumed_days"`)*  
- **`modules.hr.leave_engine.carry_forward_field`** *(string, default `"carry_forward_days"`)*  
- **`modules.hr.leave_engine.available_field`** *(string, default `"available_days"`)*  
- **`modules.hr.leave_engine.fiscal_year_field`** *(string, default `"year"`)*  
- **`modules.hr.leave_engine.default_entitlement`** *(number, default `18`)*

Generated backend APIs:
- `GET /api/<employee_entity>/:id/leave-balance`
- `POST /api/<employee_entity>/:id/leave-balance/accrue`
- `POST /api/<employee_entity>/:id/leave-balance/adjust`
- `POST /api/<leave_entity>/:id/recalculate-days`

#### Pack: leave_approvals (strict approval transitions + audit)

- **`modules.hr.leave_approvals.enabled`** *(boolean)*
- **`modules.hr.leave_approvals.leave_entity`** *(string, default `"leaves"`)*  
- **`modules.hr.leave_approvals.status_field`** *(string, default `"status"`)*  
- **`modules.hr.leave_approvals.approver_field`** *(string, default `"approver_id"`)*  
- **`modules.hr.leave_approvals.approved_at_field`** *(string, default `"approved_at"`)*  
- **`modules.hr.leave_approvals.rejected_at_field`** *(string, default `"rejected_at"`)*  
- **`modules.hr.leave_approvals.rejection_reason_field`** *(string, default `"rejection_reason"`)*  
- **`modules.hr.leave_approvals.decision_key_field`** *(string, default `"decision_key"`)*  
- **`modules.hr.leave_approvals.statuses`** *(array, default `["Pending","Approved","Rejected","Cancelled"]`)*  
- **`modules.hr.leave_approvals.enforce_transitions`** *(boolean, default `true`)*  

Generated backend APIs:
- `GET /api/<leave_entity>/approvals/pending`
- `POST /api/<leave_entity>/:id/approve`
- `POST /api/<leave_entity>/:id/reject`
- `POST /api/<leave_entity>/:id/cancel`

#### Pack: attendance_time (attendance + shift + timesheet core)

- **`modules.hr.attendance_time.enabled`** *(boolean)*
- **`modules.hr.attendance_time.attendance_entity`** *(string, default `"attendance_entries"`)*  
- **`modules.hr.attendance_time.shift_entity`** *(string, default `"shift_assignments"`)*  
- **`modules.hr.attendance_time.timesheet_entity`** *(string, default `"timesheet_entries"`)*  
- **`modules.hr.attendance_time.attendance_employee_field`** *(string, default `"employee_id"`)*  
- **`modules.hr.attendance_time.attendance_date_field`** *(string, default `"work_date"`)*  
- **`modules.hr.attendance_time.check_in_field`** *(string, default `"check_in_at"`)*  
- **`modules.hr.attendance_time.check_out_field`** *(string, default `"check_out_at"`)*  
- **`modules.hr.attendance_time.worked_hours_field`** *(string, default `"worked_hours"`)*  
- **`modules.hr.attendance_time.timesheet_hours_field`** *(string, default `"regular_hours"`)*  
- **`modules.hr.attendance_time.timesheet_overtime_field`** *(string, default `"overtime_hours"`)*  

Generated backend APIs:
- `POST /api/<attendance_entity>/record`
- `POST /api/<attendance_entity>/:id/recalculate`
- `POST /api/<timesheet_entity>/sync`
- `POST /api/<timesheet_entity>/:id/approve`

#### Pack: compensation_ledger (payroll-ready ledger + period snapshots)

- **`modules.hr.compensation_ledger.enabled`** *(boolean)*
- **`modules.hr.compensation_ledger.ledger_entity`** *(string, default `"compensation_ledger"`)*  
- **`modules.hr.compensation_ledger.snapshot_entity`** *(string, default `"compensation_snapshots"`)*  
- **`modules.hr.compensation_ledger.ledger_employee_field`** *(string, default `"employee_id"`)*  
- **`modules.hr.compensation_ledger.ledger_period_field`** *(string, default `"pay_period"`)*  
- **`modules.hr.compensation_ledger.ledger_type_field`** *(string, default `"component_type"`)*  
- **`modules.hr.compensation_ledger.ledger_amount_field`** *(string, default `"amount"`)*  

Generated backend APIs:
- `POST /api/<ledger_entity>/snapshot`
- `POST /api/<ledger_entity>/:id/post`
- `POST /api/<snapshot_entity>/:id/post`

### Auto-entity behavior

If HR Priority A packs are enabled and required entities/fields are missing, assembler auto-adds runtime HR entities/fields:
- `leave_balances` (leave balance engine),
- `attendance_entries`, `shift_assignments`, `timesheet_entries` (attendance/time core),
- `compensation_ledger`, `compensation_snapshots` (payroll-ready ledger/snapshots),
- required leave approval/balance audit fields on leave entities.

This keeps capability packs optional and backward-compatible for generated ERP projects.

---

## Inventory Priority A Capability Packs (`modules.inventory`)

Use these module-level toggles to enable only the Inventory workflows you need.
They are runtime-capable packs: each pack can be enabled independently.

```json
{
  "modules": {
    "inventory": {
      "enabled": true,
      "stock_entity": "products",
      "transactions": { "enabled": true },
      "reservations": { "enabled": true },
      "inbound": { "enabled": true },
      "cycle_counting": { "enabled": false }
    }
  }
}
```

### Shared base config

- **`modules.inventory.stock_entity`** *(string, default `"products"`)*:
  - Main stock entity where quantity is mutated.
  - Must be in module `inventory` (or `shared` for cross-module sharing).

### Pack: transactions (concurrency-safe stock updates)

- **`modules.inventory.transactions.enabled`** *(boolean)*
- **`modules.inventory.transactions.quantity_field`** *(string, default `"quantity"`)*
- Optional movement logging is read from per-entity `inventory_ops` config on the stock entity.

When enabled on the stock entity, generated backend exposes atomic workflow APIs:
- `POST /api/<stock_entity>/:id/inventory/receive`
- `POST /api/<stock_entity>/:id/inventory/issue`
- `POST /api/<stock_entity>/:id/inventory/adjust`
- `POST /api/<stock_entity>/:id/inventory/transfer`

### Pack: reservations

- **`modules.inventory.reservations.enabled`** *(boolean)*
- **`modules.inventory.reservations.reservation_entity`** *(string, default `"stock_reservations"`)*
- **`modules.inventory.reservations.item_field`** *(string, default `"item_id"`)*
- **`modules.inventory.reservations.quantity_field`** *(string, default `"quantity"`)*
- **`modules.inventory.reservations.status_field`** *(string, default `"status"`)*
- **`modules.inventory.reservations.reserved_field`** *(string, default `"reserved_quantity"`)*
- **`modules.inventory.reservations.committed_field`** *(string, default `"committed_quantity"`)*
- **`modules.inventory.reservations.available_field`** *(string, default `"available_quantity"`)*

Generated backend APIs (on stock entity):
- `GET /api/<stock_entity>/:id/reservations`
- `POST /api/<stock_entity>/:id/reservations`
- `POST /api/<stock_entity>/:id/reservations/:reservationId/release`
- `POST /api/<stock_entity>/:id/reservations/:reservationId/commit`

### Pack: inbound (PO/GRN receive)

- **`modules.inventory.inbound.enabled`** *(boolean)*
- **`modules.inventory.inbound.purchase_order_entity`** *(default `"purchase_orders"`)*
- **`modules.inventory.inbound.purchase_order_item_entity`** *(default `"purchase_order_items"`)*
- **`modules.inventory.inbound.grn_entity`** *(default `"goods_receipts"`)*
- **`modules.inventory.inbound.grn_item_entity`** *(default `"goods_receipt_items"`)*
- **`modules.inventory.inbound.po_item_parent_field`** *(default `"purchase_order_id"`)*
- **`modules.inventory.inbound.po_item_item_field`** *(default `"item_id"`)*
- **`modules.inventory.inbound.po_item_ordered_field`** *(default `"ordered_quantity"`)*
- **`modules.inventory.inbound.po_item_received_field`** *(default `"received_quantity"`)*
- **`modules.inventory.inbound.grn_parent_field`** *(default `"purchase_order_id"`)*
- **`modules.inventory.inbound.grn_item_parent_field`** *(default `"goods_receipt_id"`)*
- **`modules.inventory.inbound.grn_item_po_item_field`** *(default `"purchase_order_item_id"`)*
- **`modules.inventory.inbound.grn_item_item_field`** *(default `"item_id"`)*
- **`modules.inventory.inbound.grn_item_received_field`** *(default `"received_quantity"`)*
- **`modules.inventory.inbound.grn_item_accepted_field`** *(default `"accepted_quantity"`)*

Generated backend APIs (on GRN entity):
- `POST /api/<grn_entity>/:id/post`
- `POST /api/<grn_entity>/:id/cancel`

### Pack: cycle counting

- **`modules.inventory.cycle_counting.enabled`** *(boolean)*
- **`modules.inventory.cycle_counting.session_entity`** *(default `"cycle_count_sessions"`)*
- **`modules.inventory.cycle_counting.line_entity`** *(default `"cycle_count_lines"`)*
- **`modules.inventory.cycle_counting.line_session_field`** *(default `"cycle_count_session_id"`)*
- **`modules.inventory.cycle_counting.line_item_field`** *(default `"item_id"`)*
- **`modules.inventory.cycle_counting.line_expected_field`** *(default `"expected_quantity"`)*
- **`modules.inventory.cycle_counting.line_counted_field`** *(default `"counted_quantity"`)*
- **`modules.inventory.cycle_counting.line_variance_field`** *(default `"variance_quantity"`)*

Generated backend APIs (on cycle session entity):
- `POST /api/<session_entity>/:id/start`
- `POST /api/<session_entity>/:id/recalculate`
- `POST /api/<session_entity>/:id/approve`
- `POST /api/<session_entity>/:id/post`

### Auto-entity behavior for enabled packs

If pack entities/fields are missing, assembler auto-adds required Priority A entities and fields:
- reservation fields on stock entity (`reserved`, `committed`, `available`)
- reservation entity
- PO/PO item/GRN/GRN item entities
- cycle session + cycle line entities

This keeps older SDFs backward-compatible while still enabling new workflow packs.

---

## Entity object

Each entry in `entities[]` defines one API resource + UI pages.

### Core properties

- **`slug`** *(string, required)*: Unique identifier for the entity. Used for:
  - API route: `/api/<slug>`
  - Frontend route: `/<slug>`
  - Files: `.../<Slug>Service.js`, `.../<Slug>Page.tsx`, etc.
  - **Rule**: use lowercase snake_case or simple plurals (e.g. `products`, `dairy_skus`, `storage_bins`).

- **`display_name`** *(string, optional)*: UI label shown in sidebar/page headers. Defaults to a title-cased version of `slug`.

- **`display_field`** *(string, optional but strongly recommended)*:
  - The “human readable” field for this entity (e.g. `name`, `sku`, `code`).
  - Used when rendering references in tables and selects.
  - Default fallback order: `display_field` → `name` → `sku` → first non-system field → `id`.

- **`module`** *(string, optional)*: ERP module grouping for the entity.
  - Allowed: `inventory`, `invoice`, `hr`, `shared`.
  - Default: `inventory` when not specified.
  - Use `shared` for entities used by multiple modules (e.g., `customers`).

### UI configuration (per-entity)

- **`ui`** *(object, optional)*: Enables/disables list page features.
  - **`ui.search`** *(boolean, default `true`)*
  - **`ui.csv_import`** *(boolean, default `true`)*
  - **`ui.csv_export`** *(boolean, default `true`)*
  - **`ui.print`** *(boolean, default `true`)*

### List/table configuration

- **`list`** *(object, optional)*
  - **`list.columns`** *(array of field names)*: Controls which columns appear on the entity list table.
  - If omitted: generator defaults to the first ~5 non-system fields.

### Fields

- **`fields`** *(array, required)*: List of field definitions (see “Field object”).

### Children / line items (optional, generic)

If one entity “contains a list of rows” (e.g., a shipment has many shipment items, a sales order has many order items),
the generator supports an optional **embedded child list** inside the parent create/edit screen.

This is purely a UI convenience: the underlying data model is still **two entities** linked by a reference field.

- **`children`** *(array, optional)*: list of embedded child sections. Each entry:
  - **`entity`** *(string, required)*: child entity slug (e.g. `shipment_items`)
  - **`foreign_key`** *(string, required)*: field on child pointing to the parent (e.g. `shipment_id`)
  - **`label`** *(string, optional)*: UI label for the embedded section (default: derived from child slug)
  - **`columns`** *(array of field names, optional)*: which child fields to show in the embedded table

### Features (per-entity)

- **`features`** *(object, optional)*:
  - **`features.audit_trail`** *(boolean)*: If enabled or if global activity log is enabled (see modules), writes audit events to `__audit_logs`.
  - **`features.batch_tracking`** *(boolean)*: Enables batch/expiry behavior.
    - Frontend may auto-add `batch_number` / `expiry_date` field widgets unless you explicitly define them.
  - **`features.serial_tracking`** *(boolean)*: Enables serial behavior.
    - Frontend may auto-add `serial_number` unless explicitly defined.
  - **`features.multi_location`** *(boolean)*: Signals “inventory entity supports multiple locations”.
    - Usually paired with a `reference` field with `multiple: true` (e.g. `location_ids` / `storage_location_ids`).
  - **`features.print_invoice`** *(boolean)*: Enables invoice print/PDF actions for the `invoices` entity.

### Bulk actions (per-entity, optional)

- **`bulk_actions`** *(object, optional)*:
  - **`bulk_actions.enabled`** *(boolean, default `false`)*
  - **`bulk_actions.delete`** *(boolean, default `true` if enabled)*
  - **`bulk_actions.update_fields`** *(array of field names)*: Which fields can be bulk-updated.

### Inventory operations (wizards) (per-entity, optional)

Enable “Receive / Adjust / Transfer / Sell(Issue)” wizard pages on an entity.

- **`inventory_ops.enabled`** *(boolean)*: Master switch.

- **`inventory_ops.quantity_mode`** *(string, default `"change"`)*:
  - **`"change"`** *(recommended)*: movement quantity is a signed **quantity change** (positive = add stock, negative = remove stock).
    - Legacy alias: `"delta"` is accepted and treated the same as `"change"`.
  - **`"absolute"`**: movement quantity is always positive; “in/out” semantics come from movement type.

- **`inventory_ops.movement_entity`** *(string, default `"stock_movements"`)*:
  - Entity slug used to store movements/events.

- **`inventory_ops.location_entity`** *(string, default `"locations"`)*:
  - Entity slug representing locations/bins/warehouses.

- **`inventory_ops.quantity_field`** *(string, default `"quantity"`)*:
  - Field name on the *main entity* to update for on-hand.

- **`inventory_ops.location_ids_field` / `inventory_ops.location_id_field` / `inventory_ops.entity_location_field`** *(string, optional)*:
  - Field name on the *main entity* that stores the location reference(s)
  - Example: `storage_location_ids`, `bin_ids`, `location_id`

- **`inventory_ops.fields`** *(object, optional)*: Field mapping **inside the movement entity**.
  - **`item_ref`** *(string)*: main entity id reference field (default inferred like `product_id`, `dairy_sku_id`, etc.)
  - **`qty`** *(string, default `"quantity"`)*: quantity field (represents a **quantity change** in `"change"` mode)
  - **`type`** *(string, default `"movement_type"`)*: movement type field
  - **`location`** *(string, default `"location_id"`)*: optional location field
  - **`from_location`** *(string, default `"from_location_id"`)*: transfer “from”
  - **`to_location`** *(string, default `"to_location_id"`)*: transfer “to”
  - **`reason`** *(string, default `"reason"`)*: notes/reason field
  - **`reference_number`** *(string, default `"reference_number"`)*: external reference
  - **`date`** *(string, default `"movement_date"`)*: movement date field

- **`inventory_ops.movement_types`** *(object, optional)*:
  - **`receive`** *(string, default `"IN"`)*
  - **`issue`** *(string, default `"OUT"`)*
  - **`adjust`** *(string, default `"ADJUSTMENT"`)*
  - **`adjust_in`** *(string, optional)*: only used when `quantity_mode="absolute"` and the adjustment is positive
  - **`adjust_out`** *(string, optional)*: only used when `quantity_mode="absolute"` and the adjustment is negative
  - **`transfer_out`** *(string, default `"TRANSFER_OUT"`)*
  - **`transfer_in`** *(string, default `"TRANSFER_IN"`)*

- **`inventory_ops.receive.enabled`** *(boolean, default `true` when inventory_ops.enabled)*
- **`inventory_ops.adjust.enabled`** *(boolean, default `true` when inventory_ops.enabled)*
- **`inventory_ops.transfer.enabled`** *(boolean, default `true` when inventory_ops.enabled and multi-location is detected)*

- **`inventory_ops.issue.enabled`** *(boolean, default `false`)*:
  - Enables `/entity/issue` wizard.
  - You can alias with `inventory_ops.sell.enabled` (the generator treats sell/issue as the same concept).

- **`inventory_ops.issue.label`** *(string, default `"Sell"`)*:
  - Button/page label (e.g. `"Sell"`, `"Dispatch"`).

- **`inventory_ops.issue.allow_negative_stock`** *(boolean, default `false`)*:
  - If `false`, the Issue/Sell wizard blocks issuing more than current on-hand.

### Inventory quick actions (row actions on list table)

If you want “one-click” actions **per row** (next to Edit/Delete), configure:

- **`inventory_ops.quick_actions`** *(boolean or object)*:
  - If `true`: enables quick actions for the enabled ops (Receive + Sell/Issue).
  - If object: enable individually:
    - `quick_actions.receive` / `quick_actions.add` *(boolean)*
    - `quick_actions.issue` / `quick_actions.sell` *(boolean)*

- **`inventory_ops.adjust.reason_codes`** *(array of strings)*:
  - Used by Adjust wizard dropdown.

### Labels (QR codes) (per-entity, optional)

- **`labels.enabled`** *(boolean, default `false`)*
- **`labels.type`** *(string)*: currently supports `"qrcode"`.
- **`labels.value_field`** *(string)*: field to encode into QR.
- **`labels.text_fields`** *(array of field names)*: printed text fields.
- **`labels.columns`** *(number, default `3`)*
- **`labels.size`** *(number, default `160`)*
- **`labels.scan`** *(boolean, default `false`)*: enables camera scanning UI with BarcodeDetector/jsQR fallback.

### System entities (generated automatically)

Some entities are auto-added when modules are enabled:

- **`__audit_logs`**: created when activity log is enabled.
- **`__reports`**: created when scheduled reports are enabled.

System entities are hidden from the sidebar by default.

---

## Field object

Each field inside `entity.fields[]`:

### Common properties

- **`name`** *(string, required)*: field key stored in records.
- **`type`** *(string, required)*: supported:
  - `string`, `text`, `integer`, `decimal`, `number`, `boolean`, `date`, `datetime`, `reference`
- **`label`** *(string, optional)*: UI label (default: derived from `name`).
- **`required`** *(boolean, default `false`)*
- **`widget`** *(string, optional)*: UI widget override (otherwise inferred from type).
  - Common: `Input`, `TextArea`, `NumberInput`, `Checkbox`, `DatePicker`, `EntitySelect`

### Reference fields

For `type: "reference"` (or fields ending with `_id`/`_ids`):

- **`reference_entity`** *(string, recommended)*: target entity slug.
- **`multiple`** *(boolean, default `false`)*
  - If `true`, values are stored as an array of ids.
  - CSV import/export uses `;` as the default separator for arrays.

### Validation rules (backend enforced; frontend inline validation)

Supported properties (snake_case or camelCase accepted):

- **`min_length` / `minLength`** *(number)*
- **`max_length` / `maxLength`** *(number)*
- **`min` / `min_value` / `minValue`** *(number)*
- **`max` / `max_value` / `maxValue`** *(number)*
- **`pattern` / `regex`** *(string)*: JavaScript RegExp pattern string (no surrounding slashes).
- **`unique`** *(boolean)*: uniqueness checked on create/update.

### Selectable / enum fields (backend enforced; frontend renders select/toggle)

For string-like fields where you want users to pick from a fixed set (no free text),
use **`options`**:

- **`options`** *(array of strings)*: allowed values for the field.
  - Example: `"options": ["New", "Used"]`
  - **Important**: Keep `type` as `"string"` (do **not** use `type: "enum"`).
  - Backend will reject any value not in the list (HTTP 400 + `field_errors`)
  - Frontend will render a selection UI automatically:
    - If `options.length <= 4` → button-style `RadioGroup`
    - Else → dropdown `Select`
  - You can override with `widget` (e.g. `"widget": "Select"` or `"widget": "RadioGroup"`).

---

## Global modules (`modules`)

### Activity log

- **`modules.activity_log.enabled`** *(boolean)*
- **`modules.activity_log.limit`** *(number, default 15)*
- Optional allowlist:
  - **`modules.activity_log.entities`** *(array of slugs)*: if provided, only those entities are audited (otherwise all non-system entities are audited by default unless `features.audit_trail:false`).

### Inventory dashboard

- **`modules.inventory_dashboard.low_stock.enabled`** *(boolean)*
- **`modules.inventory_dashboard.low_stock.entity`** *(string)*: entity slug to evaluate
- **`modules.inventory_dashboard.low_stock.quantity_field`** *(string)*: numeric field
- **`modules.inventory_dashboard.low_stock.reorder_point_field`** *(string)*: numeric field
- **`modules.inventory_dashboard.low_stock.limit`** *(number)*
- **`modules.inventory_dashboard.low_stock.suggestion_multiplier`** *(number)*

- **`modules.inventory_dashboard.expiry.enabled`** *(boolean)*
- **`modules.inventory_dashboard.expiry.entity`** *(string)*
- **`modules.inventory_dashboard.expiry.expiry_field`** *(string)*: date field name
- **`modules.inventory_dashboard.expiry.within_days`** *(number)*
- **`modules.inventory_dashboard.expiry.limit`** *(number)*

### Scheduled reports (backend snapshots + frontend date-range diff UI)

Enables:
- Backend cron snapshots written into `__reports`
- Frontend `/reports` page (Tools → Reports)

Core:
- **`modules.scheduled_reports.enabled`** *(boolean)*
- **`modules.scheduled_reports.cron`** *(string, cron format)* (uses `node-cron`)
- **`modules.scheduled_reports.target_slug`** *(string, default `"__reports"`)*
- **`modules.scheduled_reports.report_type`** *(string, default `"daily_summary"`)*
- **`modules.scheduled_reports.entities`** *(array of slugs, optional)*: creates `entity_counts` in snapshots

Optional snapshot sections:
- **`modules.scheduled_reports.low_stock`** *(object)*: same shape as dashboard low_stock
- **`modules.scheduled_reports.expiry`** *(object)*: same shape as dashboard expiry
- **`modules.scheduled_reports.inventory_value`** *(object)*:
  - `enabled`, `entity`, `quantity_field`, `unit_price_field`, `limit`
- **`modules.scheduled_reports.movements`** *(object)*:
  - `enabled`, `entity`
  - `type_field`, `quantity_field`, `date_field`, `item_ref_field`
  - `location_entity`, `location_field`
  - `quantity_mode`: `"change"` (alias `"delta"`) or `"absolute"`
  - `lookback_days`, `limit`
  - `in_types`, `out_types`, `adjust_types`

Entity snapshots (used for **date-range diff reports**):
- **`modules.scheduled_reports.entity_snapshots`** *(array)*:
  - Each entry:
    - `entity` *(slug, required)*
    - `display_field` *(string, optional)*: used as “Item” label in reports
    - `fields` *(array of field names, required)*: fields captured each snapshot
    - `limit` *(number, default 500)*: number of records stored per day for this entity
    - Optional sorting:
      - `sort_by.field` + `sort_by.direction` (`"asc"`/`"desc"`)

---

## Referential integrity / delete protection (built-in)

If an entity is referenced by other entities (reference fields), delete is blocked:

- API returns **HTTP 409** with a payload listing dependent entities and up to 10 preview rows.
- Frontend shows a “Cannot delete” modal with the dependency list.

To get correct behavior, always define references using:
- `type: "reference"`
- `reference_entity: "<target_slug>"`
- `multiple: true` for multi-relations

---

## CSV import/export behavior

- Export includes `id` and all entity fields.
- Multi-value fields export as `;` separated values.
- Import:
  - If `id` is present → update (PUT); if missing → create (POST)
  - Required fields are validated for creates
  - Backend ignores incoming `id/created_at/updated_at` on create to protect system fields

---

## Examples in repo

- Perishables (expiry): `test/sample_sdf_milk_producer.json`
- Non-perishables (no expiry): `test/sample_sdf_tire_business.json`


