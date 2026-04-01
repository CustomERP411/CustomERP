# Inventory Module Default Questions (SDF-Impact Only)

## Purpose

Every question here directly toggles a capability pack or config value in the generated SDF.
No naming, no technical jargon, no questions about things we haven't built yet.

---

## Questions

### Q1
- ID: `inv_multi_location`
- User question: "Do you keep stock in more than one place (warehouse, store, shelf)?"
- Input: `yes_no`
- SDF impact:
  - `entities.products.features.multi_location = true`
  - `entities.products.inventory_ops.transfer = { enabled: true }`
  - Creates `locations` entity (name, code)
  - Adds `location_id` (reference -> locations) field on products entity
  - Adds `location_id`, `from_location_id`, `to_location_id` to `stock_movements` entity

### Q2
- ID: `inv_allow_negative_stock`
- User question: "If stock runs out, should the system still allow sending stock out?"
- Input: `yes_no`
- SDF impact:
  - `entities.products.inventory_ops.issue.allow_negative_stock = true/false`

### Q3
- ID: `inv_enable_reservations`
- User question: "Do you want to reserve stock for orders before confirming?"
- Input: `yes_no`
- SDF impact:
  - `modules.inventory.reservations = { enabled: true, reservation_entity: 'stock_reservations', stock_entity: 'products' }`
  - Adds `reserved_quantity`, `committed_quantity`, `available_quantity` fields to products entity
  - Creates `stock_reservations` entity:
    - `reservation_number` (string, unique)
    - `item_id` (reference -> products)
    - `quantity` (integer)
    - `status` (Pending / Released / Committed)
    - `source_reference` (string)
    - `note` (text)
    - `reserved_at` (datetime)

### Q4
- ID: `inv_enable_inbound`
- User question: "Do you buy from suppliers and want to track what you ordered vs what you received?"
- Input: `yes_no`
- SDF impact:
  - `modules.inventory.inbound = { enabled: true, stock_entity, purchase_order_entity, ... }`
  - Creates `purchase_orders` entity:
    - `po_number` (string, unique)
    - `supplier_name` (string)
    - `status` (Open / Partial / Received / Cancelled)
    - `order_date` (date)
    - `notes` (text)
  - Creates `purchase_order_items` entity:
    - `purchase_order_id` (reference -> purchase_orders)
    - `item_id` (reference -> products)
    - `ordered_quantity` (integer)
    - `received_quantity` (integer)
    - `status` (Open / Partial / Received)
  - Creates `goods_receipts` entity:
    - `grn_number` (string, unique)
    - `purchase_order_id` (reference -> purchase_orders)
    - `status` (Draft / Posted / Cancelled)
    - `received_at`, `posted_at`, `cancelled_at` (datetime)
    - `note` (text)
  - Creates `goods_receipt_items` entity:
    - `goods_receipt_id` (reference -> goods_receipts)
    - `purchase_order_item_id` (reference -> purchase_order_items)
    - `item_id` (reference -> products)
    - `received_quantity` (integer)
    - `accepted_quantity` (integer)

### Q5
- ID: `inv_enable_cycle_counting`
- User question: "Do you want to do stock counts to check if system matches reality?"
- Input: `yes_no`
- SDF impact:
  - `modules.inventory.cycle_counting = { enabled: true, session_entity, line_entity, stock_entity }`
  - Creates `cycle_count_sessions` entity:
    - `session_number` (string, unique)
    - `status` (Draft / InProgress / PendingApproval / Approved / Posted)
    - `started_at`, `approved_at`, `posted_at` (datetime)
    - `approved_by` (string)
    - `note` (text)
  - Creates `cycle_count_lines` entity:
    - `cycle_count_session_id` (reference -> cycle_count_sessions)
    - `item_id` (reference -> products)
    - `expected_quantity` (integer)
    - `counted_quantity` (integer)
    - `variance_quantity` (integer)
    - `status` (Pending / Counted / Posted)

### Q6
- ID: `inv_batch_tracking`
- User question: "Do you track items by batch or lot number? (common for food, medicine, chemicals)"
- Input: `yes_no`
- SDF impact:
  - `entities.products.features.batch_tracking = true`
  - Adds `batch_number` field on products entity
  - Adds `batch_number` field on stock_movements entity
  - Triggers `BatchTrackingMixin` (batch validation, findByBatch, getExpiredItems)

### Q7
- ID: `inv_serial_tracking`
- User question: "Do you track individual items by serial number? (common for electronics, equipment)"
- Input: `yes_no`
- SDF impact:
  - `entities.products.features.serial_tracking = true`
  - Adds `serial_number` (unique) field on products entity
  - Adds `serial_number` field on stock_movements entity
  - Triggers `SerialTrackingMixin` (serial uniqueness, quantity fixed to 1)

### Q8
- ID: `inv_expiry_tracking`
- User question: "Do your products have expiry dates?"
- Input: `yes_no`
- SDF impact:
  - `entities.products.features.expiry_tracking = true`
  - Adds `expiry_date` field on products entity
  - `modules.inventory_dashboard.expiry.enabled = true`

### Q9
- ID: `inv_low_stock_alerts`
- User question: "Do you want to be warned when stock is running low?"
- Input: `yes_no`
- SDF impact:
  - `modules.inventory_dashboard.low_stock.enabled = true`
  - Uses `reorder_point` field on products entity as threshold

### Q10
- ID: `inv_qr_labels`
- User question: "Do you want to print QR code labels for your products?"
- Input: `yes_no`
- SDF impact:
  - `entities.products.labels = { enabled: true, type: 'qrcode' }`
  - Generates QR label page with print capability

---

## Auto-Enabled (No Question Needed)

These are always turned on when inventory module is selected:

| SDF key | Value | Reason |
|---|---|---|
| `modules.inventory.enabled` | `true` | User selected inventory module |
| `modules.inventory.transactions.enabled` | `true` | Always recommended for data safety |
| `modules.inventory.transactions.stock_entity` | `'products'` | Stock entity slug for transaction safety |
| `modules.inventory.transactions.movement_entity` | `'stock_movements'` | Movement log entity |
| `entities.products.inventory_ops.enabled` | `true` | Core stock actions always needed |
| `entities.products.inventory_ops.receive.enabled` | `true` | Receive stock always available |
| `entities.products.inventory_ops.issue.enabled` | `true` | Issue stock always available |
| `entities.products.inventory_ops.adjust.enabled` | `true` | Adjust stock always available |

Auto-enabled when `inv_multi_location = yes`:

| SDF key | Value | Reason |
|---|---|---|
| `entities.products.inventory_ops.transfer.enabled` | `true` | Transfer between locations |

---

## Supporting Entities Created Per Capability

| Capability | Entities Created |
|---|---|
| Always (inventory selected) | `products`, `stock_movements` |
| Multi-location (Q1) | `locations` |
| Reservations (Q3) | `stock_reservations` |
| Inbound/PO (Q4) | `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items` |
| Cycle counting (Q5) | `cycle_count_sessions`, `cycle_count_lines` |

---

## SDF Output Example (all capabilities enabled)

```json
{
  "modules": {
    "inventory": {
      "enabled": true,
      "stock_entity": "products",
      "transactions": {
        "enabled": true,
        "stock_entity": "products",
        "movement_entity": "stock_movements"
      },
      "reservations": {
        "enabled": true,
        "reservation_entity": "stock_reservations",
        "stock_entity": "products"
      },
      "inbound": {
        "enabled": true,
        "stock_entity": "products",
        "purchase_order_entity": "purchase_orders",
        "purchase_order_item_entity": "purchase_order_items",
        "grn_entity": "goods_receipts",
        "grn_item_entity": "goods_receipt_items"
      },
      "cycle_counting": {
        "enabled": true,
        "stock_entity": "products",
        "session_entity": "cycle_count_sessions",
        "line_entity": "cycle_count_lines"
      }
    },
    "inventory_dashboard": {
      "low_stock": { "enabled": true },
      "expiry": { "enabled": true }
    }
  },
  "entities": [
    {
      "slug": "products",
      "display_name": "Products",
      "module": "inventory",
      "fields": [
        { "name": "name", "type": "string", "required": true },
        { "name": "sku", "type": "string", "unique": true },
        { "name": "quantity", "type": "integer", "required": true },
        { "name": "reorder_point", "type": "integer" },
        { "name": "reserved_quantity", "type": "integer" },
        { "name": "committed_quantity", "type": "integer" },
        { "name": "available_quantity", "type": "integer" },
        { "name": "batch_number", "type": "string" },
        { "name": "serial_number", "type": "string", "unique": true },
        { "name": "expiry_date", "type": "date" },
        { "name": "location_id", "type": "reference", "reference_entity": "locations" }
      ],
      "inventory_ops": {
        "enabled": true,
        "receive": { "enabled": true },
        "issue": { "enabled": true, "allow_negative_stock": false },
        "adjust": { "enabled": true },
        "transfer": { "enabled": true }
      },
      "features": {
        "multi_location": true,
        "batch_tracking": true,
        "serial_tracking": true,
        "expiry_tracking": true
      },
      "labels": { "enabled": true, "type": "qrcode" }
    },
    {
      "slug": "locations",
      "display_name": "Locations",
      "module": "inventory"
    },
    {
      "slug": "stock_movements",
      "display_name": "Stock Movements",
      "module": "inventory"
    },
    {
      "slug": "stock_reservations",
      "display_name": "Stock Reservations",
      "module": "inventory"
    },
    {
      "slug": "purchase_orders",
      "display_name": "Purchase Orders",
      "module": "inventory"
    },
    {
      "slug": "purchase_order_items",
      "display_name": "Purchase Order Items",
      "module": "inventory"
    },
    {
      "slug": "goods_receipts",
      "display_name": "Goods Receipts",
      "module": "inventory"
    },
    {
      "slug": "goods_receipt_items",
      "display_name": "Goods Receipt Items",
      "module": "inventory"
    },
    {
      "slug": "cycle_count_sessions",
      "display_name": "Cycle Count Sessions",
      "module": "inventory"
    },
    {
      "slug": "cycle_count_lines",
      "display_name": "Cycle Count Lines",
      "module": "inventory"
    }
  ]
}
```

---

## Validation

- All 10 questions must be answered before AI generation.
- Prefilled SDF is built from answers and shown to user for confirmation.
- Every "yes" answer creates its full entity set in the prefilled SDF (no missing supporting entities).
