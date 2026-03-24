# Invoice Module Default Questions (SDF-Impact Only)

## Purpose

This questionnaire includes only questions that directly change generated SDF for invoice capabilities we currently support.

If an answer does not affect SDF output, it is intentionally excluded.

---

## Scope Covered (Current Capabilities)

- Core invoice setup (currency, tax, numbering prefix)
- Priority A invoice packs:
  - transactions
  - payments
  - notes (credit/debit adjustments)
  - lifecycle
  - calculation_engine (line tax/discount/charges)
- Optional naming customization for generated entities

---

## Question Flow

1. Ask core invoice questions.
2. Ask only enabled capability packs.
3. Ask naming/customization only when user wants custom names.
4. Build prefilled SDF from these answers before AI generation.

---

## Core Questions (Always Ask)

### Q1
- ID: `invoice_enable_module`
- User question: "Do you want Invoice in your ERP?"
- Input: `yes_no`
- SDF mapping: `modules.invoice.enabled`

### Q2
- ID: `invoice_currency`
- User question: "What is your main invoice currency?"
- Input: `choice + custom`
- Options: `USD`, `EUR`, `GBP`, `TRY`, `AED`, `SAR`, `Other`
- SDF mapping: `modules.invoice.currency`

### Q3
- ID: `invoice_default_tax_rate`
- User question: "What is your default tax rate (%)?"
- Input: `number`
- SDF mapping: `modules.invoice.tax_rate`

### Q4
- ID: `invoice_prefix`
- User question: "What prefix should invoice numbers start with?"
- Input: `text`
- Example: `INV-`
- SDF mapping: `modules.invoice.prefix`

### Q5
- ID: `invoice_enable_transactions_pack`
- User question: "Enable transaction-safe invoice posting and number allocation?"
- Input: `yes_no`
- SDF mapping: `modules.invoice.transactions.enabled`

### Q6
- ID: `invoice_enable_payments_pack`
- User question: "Do you want payment tracking and allocation?"
- Input: `yes_no`
- SDF mapping: `modules.invoice.payments.enabled`

### Q7
- ID: `invoice_enable_notes_pack`
- User question: "Do you want credit/debit note workflows linked to invoices?"
- Input: `yes_no`
- SDF mapping: `modules.invoice.notes.enabled`

### Q8
- ID: `invoice_enable_lifecycle_pack`
- User question: "Do you want strict invoice status workflow (Draft, Sent, Paid, Overdue, Cancelled)?"
- Input: `yes_no`
- SDF mapping: `modules.invoice.lifecycle.enabled`

### Q9
- ID: `invoice_enable_calc_engine_pack`
- User question: "Do you want line-level calculations (line discount, tax, additional charges)?"
- Input: `yes_no`
- SDF mapping: `modules.invoice.calculation_engine.enabled`

---

## Lifecycle Detail (Ask Only If Lifecycle Enabled)

### Q10
- ID: `invoice_enforce_transitions`
- User question: "Should status transitions be strictly enforced?"
- Input: `yes_no`
- Condition: Q8 = yes
- SDF mapping: `modules.invoice.lifecycle.enforce_transitions`

### Q11
- ID: `invoice_status_field_name`
- User question: "Use default status field name 'status'?"
- Input: `yes_no + custom`
- Condition: Q8 = yes
- SDF mapping: `modules.invoice.lifecycle.status_field`

---

## Naming Questions (Only If User Wants Custom Names)

### Q12
- ID: `invoice_use_default_entity_names`
- User question: "Use default names (invoices, invoice_items, invoice_payments, invoice_payment_allocations, invoice_notes)?"
- Input: `yes_no`
- If `yes`: keep defaults.
- If `no`: ask Q13-Q16.

### Q13
- ID: `invoice_header_item_customer_names`
- User question: "What should we call these records?"
- Input: `group_text`
- Fields:
  - `invoice_entity`
  - `invoice_item_entity`
  - `customer_entity`
- Condition: Q12 = no
- SDF mapping:
  - `modules.invoice.invoice_entity`
  - `modules.invoice.invoice_item_entity`
  - `modules.invoice.customer_entity`

### Q14
- ID: `invoice_payment_entity_names`
- User question: "What should we call payment records?"
- Input: `group_text`
- Fields:
  - `payment_entity`
  - `allocation_entity`
- Condition: Q6 = yes and Q12 = no
- SDF mapping:
  - `modules.invoice.payments.payment_entity`
  - `modules.invoice.payments.allocation_entity`

### Q15
- ID: `invoice_note_entity_name`
- User question: "What should we call invoice adjustment notes?"
- Input: `text`
- Condition: Q7 = yes and Q12 = no
- SDF mapping: `modules.invoice.notes.note_entity`

### Q16
- ID: `invoice_item_field_names`
- User question: "Use default invoice line field names (quantity, unit_price, line_tax_total, line_total)?"
- Input: `yes_no + custom`
- Condition: Q9 = yes and Q12 = no
- SDF mapping:
  - `modules.invoice.calculation_engine.item_quantity_field`
  - `modules.invoice.calculation_engine.item_unit_price_field`
  - `modules.invoice.calculation_engine.item_tax_total_field`
  - `modules.invoice.calculation_engine.item_line_total_field`

---

## Internal Mapping Checklist (System Side)

Map only these keys from answers:

- `modules.invoice.enabled`
- `modules.invoice.currency`
- `modules.invoice.tax_rate`
- `modules.invoice.prefix`
- `modules.invoice.transactions.*`
- `modules.invoice.payments.*`
- `modules.invoice.notes.*`
- `modules.invoice.lifecycle.*`
- `modules.invoice.calculation_engine.*`
- optional `modules.invoice.invoice_entity`, `invoice_item_entity`, `customer_entity`

If a question does not map to one of these, remove it.

---

## Validation Gates Before AI Call

- Do not call AI if Q1 is unanswered.
- Do not call AI if any enabled pack has missing required answers.
- Do not call AI until prefilled SDF is generated and confirmed.

---

## Minimal Example Handoff

```json
{
  "module": "invoice",
  "mandatory_answers": {
    "invoice_enable_module": "yes",
    "invoice_currency": "USD",
    "invoice_default_tax_rate": 12,
    "invoice_prefix": "INV-",
    "invoice_enable_transactions_pack": "yes",
    "invoice_enable_payments_pack": "yes",
    "invoice_enable_notes_pack": "yes",
    "invoice_enable_lifecycle_pack": "yes",
    "invoice_enable_calc_engine_pack": "yes"
  },
  "prefilled_sdf": {
    "modules": {
      "invoice": {
        "enabled": true,
        "currency": "USD",
        "tax_rate": 12,
        "prefix": "INV-",
        "transactions": { "enabled": true },
        "payments": { "enabled": true },
        "notes": { "enabled": true },
        "lifecycle": { "enabled": true },
        "calculation_engine": { "enabled": true }
      }
    }
  }
}
```
