# Invoice Module Default Questions (SDF-Impact Only)

## Purpose

Every question here directly toggles a capability pack or config value in the generated SDF.
No naming, no technical jargon, no questions about things we haven't built yet.

---

## Questions

### Q1
- ID: `invoice_currency`
- User question: "What currency do you use for invoices?"
- Input: `choice + custom`
- Options: `USD`, `EUR`, `GBP`, `TRY`, `AED`, `SAR`, `Other`
- SDF impact:
  - `modules.invoice.currency` (string)
  - Used by `InvoiceMixin` for header formatting
  - Used by generated frontend for currency display (`Intl.NumberFormat`)

### Q2
- ID: `invoice_tax_rate`
- User question: "What is your standard tax rate (%)?"
- Input: `choice + custom` (0, 1, 5, 8, 10, 18, 20, Custom)
- SDF impact:
  - `modules.invoice.tax_rate` (number)
  - Used by `InvoiceMixin` and `InvoiceItemsMixin` for automatic `tax_total` calculation

### Q3
- ID: `invoice_enable_payments`
- User question: "Do you want to record payments against invoices and track what is still owed?"
- Input: `yes_no`
- SDF impact:
  - `modules.invoice.payments = { enabled: true, invoice_entity: 'invoices', payment_entity: 'invoice_payments', allocation_entity: 'invoice_payment_allocations' }`
  - Creates `invoice_payments` entity:
    - `payment_number` (string, unique)
    - `invoice_id` (reference -> invoices, required)
    - `amount` (decimal, required)
    - `payment_date` (date, required)
    - `payment_method` (string)
    - `status` (string, options: Draft/Posted/Cancelled)
    - `reference_number` (string)
    - `posted_at` (datetime)
    - `cancelled_at` (datetime)
    - `cancel_reason` (text)
    - `note` (text)
  - Creates `invoice_payment_allocations` entity:
    - `payment_id` (reference -> invoice_payments, required)
    - `invoice_id` (reference -> invoices, required)
    - `amount` (decimal, required)
  - Wires `InvoicePaymentWorkflowMixin` (record, post, cancel payments; invoice balance updates)

### Q4
- ID: `invoice_enable_notes`
- User question: "Do you need credit notes or debit notes to adjust invoices after they are sent?"
- Input: `yes_no`
- SDF impact:
  - `modules.invoice.notes = { enabled: true, invoice_entity: 'invoices', note_entity: 'invoice_notes' }`
  - Creates `invoice_notes` entity:
    - `note_number` (string, unique)
    - `source_invoice_id` (reference -> invoices, required)
    - `note_type` (string, required, options: Credit/Debit)
    - `amount` (decimal, required)
    - `tax_total` (decimal)
    - `grand_total` (decimal)
    - `status` (string, options: Draft/Posted/Cancelled)
    - `issue_date` (date)
    - `reason` (text)
    - `post_reference` (string)
    - `posted_at` (datetime)
    - `cancelled_at` (datetime)
    - `cancel_reason` (text)
    - `note` (text)
  - Wires `InvoiceNoteWorkflowMixin` (create, post, cancel notes; invoice grand_total/outstanding impact)

### Q5
- ID: `invoice_enable_calc_engine`
- User question: "Do you want per-line discounts and extra charges on invoice lines?"
- Input: `yes_no`
- SDF impact:
  - `modules.invoice.calculation_engine = { enabled: true, invoice_entity: 'invoices', item_entity: 'invoice_items' }`
  - Adds to `invoices` header:
    - `discount_total` (decimal)
    - `additional_charges_total` (decimal)
  - Adds to `invoice_items`:
    - `line_subtotal` (decimal)
    - `line_discount_type` (string, options: Percent/Fixed)
    - `line_discount_value` (decimal)
    - `line_discount_amount` (decimal)
    - `line_tax_rate` (decimal)
    - `line_tax_amount` (decimal)
    - `line_charges` (decimal)
  - Wires `InvoiceCalculationEngineMixin` instead of `InvoiceItemsMixin`

### Q6
- ID: `invoice_print`
- User question: "Do you want to print or download invoices as PDF?"
- Input: `yes_no`
- SDF impact:
  - `entities.invoices.features.print_invoice = true`
  - Enables print/download button on invoice form page in generated frontend

---

## Auto-Enabled (No Question Needed)

These are always turned on when invoice module is selected:

| SDF key | Value | Reason |
|---|---|---|
| `modules.invoice.enabled` | `true` | User selected invoice module |
| `modules.invoice.prefix` | `"INV-"` | Sensible default, AI can customize |
| `modules.invoice.invoice_entity` | `'invoices'` | Core entity slug reference |
| `modules.invoice.item_entity` | `'invoice_items'` | Core entity slug reference |
| `modules.invoice.customer_entity` | `'customers'` | Core entity slug reference |
| `modules.invoice.transactions.enabled` | `true` | Always recommended for data safety |
| `modules.invoice.lifecycle.enabled` | `true` | Invoice status workflow always needed |
| `modules.invoice.lifecycle.enforce_transitions` | `true` | Prevents invalid status jumps |
| `modules.invoice.lifecycle.statuses` | `['Draft','Sent','Paid','Overdue','Cancelled']` | Complete status set |

---

## Supporting Entities Created Per Capability

| Capability | Entities Created |
|---|---|
| Always (invoice selected) | `customers`, `invoices`, `invoice_items` |
| Payments (Q3) | `invoice_payments`, `invoice_payment_allocations` |
| Credit/debit notes (Q4) | `invoice_notes` |

---

## SDF Output Example (all capabilities enabled)

```json
{
  "modules": {
    "invoice": {
      "enabled": true,
      "currency": "USD",
      "tax_rate": 18,
      "prefix": "INV-",
      "invoice_entity": "invoices",
      "item_entity": "invoice_items",
      "customer_entity": "customers",
      "transactions": {
        "enabled": true,
        "invoice_entity": "invoices"
      },
      "payments": {
        "enabled": true,
        "invoice_entity": "invoices",
        "payment_entity": "invoice_payments",
        "allocation_entity": "invoice_payment_allocations"
      },
      "notes": {
        "enabled": true,
        "invoice_entity": "invoices",
        "note_entity": "invoice_notes"
      },
      "lifecycle": {
        "enabled": true,
        "enforce_transitions": true,
        "statuses": ["Draft", "Sent", "Paid", "Overdue", "Cancelled"]
      },
      "calculation_engine": {
        "enabled": true,
        "invoice_entity": "invoices",
        "item_entity": "invoice_items"
      }
    }
  },
  "entities": [
    {
      "slug": "customers",
      "display_name": "Customers",
      "module": "shared",
      "fields": [
        { "name": "name", "type": "string", "required": true },
        { "name": "company_name", "type": "string" },
        { "name": "email", "type": "string", "required": true },
        { "name": "phone", "type": "string" },
        { "name": "address", "type": "text" }
      ]
    },
    {
      "slug": "invoices",
      "display_name": "Invoices",
      "module": "invoice",
      "fields": [
        { "name": "invoice_number", "type": "string", "required": true, "unique": true },
        { "name": "customer_id", "type": "reference", "reference_entity": "customers", "required": true },
        { "name": "issue_date", "type": "date", "required": true },
        { "name": "due_date", "type": "date", "required": true },
        { "name": "status", "type": "string", "required": true, "options": ["Draft", "Sent", "Paid", "Overdue", "Cancelled"] },
        { "name": "subtotal", "type": "decimal" },
        { "name": "tax_total", "type": "decimal" },
        { "name": "grand_total", "type": "decimal" },
        { "name": "paid_total", "type": "decimal" },
        { "name": "outstanding_balance", "type": "decimal" },
        { "name": "idempotency_key", "type": "string" },
        { "name": "posted_at", "type": "datetime" },
        { "name": "cancelled_at", "type": "datetime" },
        { "name": "discount_total", "type": "decimal" },
        { "name": "additional_charges_total", "type": "decimal" }
      ],
      "features": { "print_invoice": true }
    },
    {
      "slug": "invoice_items",
      "display_name": "Invoice Items",
      "module": "invoice",
      "fields": [
        { "name": "invoice_id", "type": "reference", "reference_entity": "invoices", "required": true },
        { "name": "description", "type": "string", "required": true },
        { "name": "quantity", "type": "decimal", "required": true },
        { "name": "unit_price", "type": "decimal", "required": true },
        { "name": "line_total", "type": "decimal" },
        { "name": "line_subtotal", "type": "decimal" },
        { "name": "line_discount_type", "type": "string", "options": ["Percent", "Fixed"] },
        { "name": "line_discount_value", "type": "decimal" },
        { "name": "line_discount_amount", "type": "decimal" },
        { "name": "line_tax_rate", "type": "decimal" },
        { "name": "line_tax_amount", "type": "decimal" },
        { "name": "line_charges", "type": "decimal" }
      ]
    },
    {
      "slug": "invoice_payments",
      "display_name": "Invoice Payments",
      "module": "invoice",
      "fields": [
        { "name": "payment_number", "type": "string", "unique": true },
        { "name": "invoice_id", "type": "reference", "reference_entity": "invoices", "required": true },
        { "name": "amount", "type": "decimal", "required": true },
        { "name": "payment_date", "type": "date", "required": true },
        { "name": "payment_method", "type": "string" },
        { "name": "status", "type": "string", "options": ["Draft", "Posted", "Cancelled"] },
        { "name": "reference_number", "type": "string" },
        { "name": "posted_at", "type": "datetime" },
        { "name": "cancelled_at", "type": "datetime" },
        { "name": "cancel_reason", "type": "text" },
        { "name": "note", "type": "text" }
      ]
    },
    {
      "slug": "invoice_payment_allocations",
      "display_name": "Invoice Payment Allocations",
      "module": "invoice",
      "fields": [
        { "name": "payment_id", "type": "reference", "reference_entity": "invoice_payments", "required": true },
        { "name": "invoice_id", "type": "reference", "reference_entity": "invoices", "required": true },
        { "name": "amount", "type": "decimal", "required": true }
      ]
    },
    {
      "slug": "invoice_notes",
      "display_name": "Invoice Notes",
      "module": "invoice",
      "fields": [
        { "name": "note_number", "type": "string", "unique": true },
        { "name": "source_invoice_id", "type": "reference", "reference_entity": "invoices", "required": true },
        { "name": "note_type", "type": "string", "required": true, "options": ["Credit", "Debit"] },
        { "name": "amount", "type": "decimal", "required": true },
        { "name": "tax_total", "type": "decimal" },
        { "name": "grand_total", "type": "decimal" },
        { "name": "status", "type": "string", "options": ["Draft", "Posted", "Cancelled"] },
        { "name": "issue_date", "type": "date" },
        { "name": "reason", "type": "text" },
        { "name": "post_reference", "type": "string" },
        { "name": "posted_at", "type": "datetime" },
        { "name": "cancelled_at", "type": "datetime" },
        { "name": "cancel_reason", "type": "text" },
        { "name": "note", "type": "text" }
      ]
    }
  ]
}
```

---

## Validation

- All 6 questions must be answered before AI generation.
- Prefilled SDF is built from answers and shown to user for confirmation.
- Every "yes" answer creates its full entity set in the prefilled SDF (no missing supporting entities).
