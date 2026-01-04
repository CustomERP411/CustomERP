## CustomERP SDF Reference (Schema Definition Format)

This document defines **all supported SDF properties** currently implemented by CustomERP’s generators/assembler.

Use it as the authoritative reference when writing or generating SDF JSON files.

---

## Top-level shape

An SDF file is a JSON object:

- **`project_name`** *(string, required)*: Human name for the generated ERP project.
- **`modules`** *(object, optional)*: Enables/disables global modules (dashboard widgets, activity log, reports).
- **`entities`** *(array, required)*: List of entity definitions (tables/resources) to generate.

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


