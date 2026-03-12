# Invoice Module Default Questions (SMB-Friendly, Full-Capability Target)

## Purpose

This document defines invoice default questions for non-technical SMB users.

It is intentionally broader than current implementation and assumes we want to support most invoice capabilities from `invoice_module_capability_research_and_gap_analysis.md`.

Users see simple business questions only.
System converts answers into structured configuration and prefilled SDF before AI generation.

---

## Design Rules

- Ask in plain language (no developer terms).
- Use branching so users only answer relevant sections.
- Keep core questions short and required.
- Ask advanced questions only after user enables that capability.
- Treat these answers as hard constraints during AI generation.

---

## User Flow

1. User selects Invoice module.
2. System asks Core Questions (always required).
3. System asks only the enabled Advanced Packs.
4. System generates prefilled SDF/config from answers.
5. User reviews and confirms.
6. System sends `mandatory_answers + prefilled_sdf + business_description` to AI.
7. Final AI output is validated against mandatory answers.

---

## Core Questions (Always Required)

### Q1
- ID: `inv_business_model`
- User question: "What best describes your business?"
- Input: `choice`
- Options: `Product sales`, `Service provider`, `Both products and services`, `Subscription/recurring`, `Other`

### Q2
- ID: `inv_customer_type`
- User question: "Who are your customers?"
- Input: `choice`
- Options: `Businesses (B2B)`, `Consumers (B2C)`, `Both`

### Q3
- ID: `inv_currency`
- User question: "What is your main currency?"
- Input: `choice + custom`
- Options: `USD`, `EUR`, `GBP`, `TRY`, `AED`, `SAR`, `Other`

### Q4
- ID: `inv_multi_currency`
- User question: "Do you invoice in multiple currencies?"
- Input: `yes_no`

### Q5
- ID: `inv_tax_applicable`
- User question: "Do you charge tax on invoices?"
- Input: `yes_no`

### Q6
- ID: `inv_tax_type`
- User question: "What type of tax do you charge?"
- Input: `choice`
- Options: `VAT`, `GST`, `Sales tax`, `Multiple tax types`, `Other`
- Condition: ask only when Q5 = yes

### Q7
- ID: `inv_default_tax_rate`
- User question: "What is your default tax rate (%)?"
- Input: `number`
- Condition: ask only when Q5 = yes

### Q8
- ID: `inv_payment_terms`
- User question: "What are your standard payment terms?"
- Input: `choice`
- Options: `Due on receipt`, `Net 7`, `Net 15`, `Net 30`, `Net 60`, `Custom`

### Q9
- ID: `inv_track_payments`
- User question: "Do you need to track payments against invoices?"
- Input: `yes_no`

### Q10
- ID: `inv_partial_payments`
- User question: "Do customers sometimes pay in installments or partial amounts?"
- Input: `yes_no`
- Condition: ask only when Q9 = yes

### Q11
- ID: `inv_need_quotes`
- User question: "Do you send quotes or estimates before invoicing?"
- Input: `yes_no`

### Q12
- ID: `inv_need_credit_notes`
- User question: "Do you issue credit notes or refunds?"
- Input: `yes_no`

### Q13
- ID: `inv_need_recurring`
- User question: "Do you have recurring invoices (subscriptions, retainers)?"
- Input: `yes_no`

### Q14
- ID: `inv_send_invoices`
- User question: "How do you send invoices to customers?"
- Input: `multi_choice`
- Options: `Email`, `Print/mail`, `Customer portal`, `Manual delivery`

### Q15
- ID: `inv_need_reminders`
- User question: "Do you want to send payment reminders for overdue invoices?"
- Input: `yes_no`

---

## Advanced Pack A: Customer Master

Ask this pack for all users.

### Q16
- ID: `inv_customer_info`
- User question: "What customer information do you track? (Select all)"
- Input: `multi_choice`
- Options: `Company name`, `Contact person`, `Email`, `Phone`, `Billing address`, `Shipping address`, `Tax ID/VAT number`

### Q17
- ID: `inv_customer_groups`
- User question: "Do you group customers (for example by region, type, or tier)?"
- Input: `yes_no`

### Q18
- ID: `inv_customer_payment_terms`
- User question: "Can different customers have different payment terms?"
- Input: `yes_no`

### Q19
- ID: `inv_customer_credit_limit`
- User question: "Do you set credit limits for customers?"
- Input: `yes_no`

### Q20
- ID: `inv_customer_credit_hold`
- User question: "Should the system warn or block invoicing when credit limit is exceeded?"
- Input: `choice`
- Options: `Warn only`, `Block invoicing`, `No restriction`
- Condition: ask only when Q19 = yes

### Q21
- ID: `inv_customer_discounts`
- User question: "Do certain customers get special pricing or discounts?"
- Input: `yes_no`

---

## Advanced Pack B: Pre-Invoice Documents

Ask when Q11 = yes.

### Q22
- ID: `inv_quote_workflow`
- User question: "Do quotes need approval before sending?"
- Input: `yes_no`

### Q23
- ID: `inv_quote_validity`
- User question: "Do quotes have an expiry/validity period?"
- Input: `yes_no`

### Q24
- ID: `inv_quote_to_invoice`
- User question: "Do you want to convert accepted quotes to invoices?"
- Input: `yes_no`

### Q25
- ID: `inv_proforma_invoices`
- User question: "Do you issue proforma invoices (before actual invoice)?"
- Input: `yes_no`

### Q26
- ID: `inv_quote_versioning`
- User question: "Do you need to track quote revisions/versions?"
- Input: `yes_no`

---

## Advanced Pack C: Invoice Structure

Ask this pack for all users.

### Q27
- ID: `inv_number_format`
- User question: "How should invoice numbers look?"
- Input: `choice`
- Options: `Simple sequence (001, 002...)`, `Year prefix (2026-001)`, `Custom prefix (INV-001)`, `Custom format`

### Q28
- ID: `inv_custom_prefix`
- User question: "What prefix do you want for invoice numbers?"
- Input: `text`
- Condition: ask only when Q27 = Custom prefix

### Q29
- ID: `inv_line_items`
- User question: "Do your invoices have multiple line items?"
- Input: `yes_no`

### Q30
- ID: `inv_line_discounts`
- User question: "Can you apply discounts to individual line items?"
- Input: `yes_no`
- Condition: ask only when Q29 = yes

### Q31
- ID: `inv_document_discount`
- User question: "Can you apply a discount to the entire invoice?"
- Input: `yes_no`

### Q32
- ID: `inv_additional_charges`
- User question: "Do you add extra charges? (Select all)"
- Input: `multi_choice`
- Options: `Shipping/delivery`, `Handling fee`, `Service charge`, `Rush fee`, `None`

### Q33
- ID: `inv_notes_terms`
- User question: "Do you need notes, terms, or conditions on invoices?"
- Input: `yes_no`

### Q34
- ID: `inv_internal_notes`
- User question: "Do you need internal notes (not shown to customer)?"
- Input: `yes_no`

---

## Advanced Pack D: Tax and Compliance

Ask when Q5 = yes.

### Q35
- ID: `inv_multi_tax_rates`
- User question: "Do you charge different tax rates on different items?"
- Input: `yes_no`

### Q36
- ID: `inv_tax_inclusive`
- User question: "Are your prices tax-inclusive or tax-exclusive?"
- Input: `choice`
- Options: `Tax exclusive (add tax on top)`, `Tax inclusive (tax included in price)`, `Both options needed`

### Q37
- ID: `inv_tax_exempt`
- User question: "Can some customers or items be tax-exempt?"
- Input: `yes_no`

### Q38
- ID: `inv_reverse_charge`
- User question: "Do you need reverse charge VAT for international B2B?"
- Input: `yes_no`
- Condition: ask only when Q2 includes B2B

### Q39
- ID: `inv_tax_reporting`
- User question: "Do you need tax summary reports for filing?"
- Input: `yes_no`

### Q40
- ID: `inv_withholding_tax`
- User question: "Do customers deduct withholding tax from payments?"
- Input: `yes_no`

---

## Advanced Pack E: Payments and Accounts Receivable

Ask when Q9 = yes.

### Q41
- ID: `inv_payment_methods`
- User question: "What payment methods do you accept? (Select all)"
- Input: `multi_choice`
- Options: `Bank transfer`, `Cash`, `Check`, `Credit card`, `Online payment`, `Mobile payment`, `Other`

### Q42
- ID: `inv_payment_allocation`
- User question: "Can one payment cover multiple invoices?"
- Input: `yes_no`

### Q43
- ID: `inv_overpayment_handling`
- User question: "What happens when a customer overpays?"
- Input: `choice`
- Options: `Apply to next invoice`, `Refund`, `Keep as credit`, `Ask each time`

### Q44
- ID: `inv_underpayment_handling`
- User question: "What happens when a customer pays less than owed?"
- Input: `choice`
- Options: `Leave balance open`, `Write off small amounts`, `Ask each time`

### Q45
- ID: `inv_payment_receipt`
- User question: "Do you issue payment receipts?"
- Input: `yes_no`

### Q46
- ID: `inv_aging_buckets`
- User question: "What aging periods do you track? (Select all)"
- Input: `multi_choice`
- Options: `Current`, `1-30 days`, `31-60 days`, `61-90 days`, `Over 90 days`

### Q47
- ID: `inv_bad_debt_writeoff`
- User question: "Do you need to write off bad debts?"
- Input: `yes_no`

---

## Advanced Pack F: Credit and Debit Notes

Ask when Q12 = yes.

### Q48
- ID: `inv_credit_note_reasons`
- User question: "Why do you issue credit notes? (Select all)"
- Input: `multi_choice`
- Options: `Returns`, `Pricing error`, `Service issue`, `Cancellation`, `Goodwill discount`, `Other`

### Q49
- ID: `inv_credit_note_link`
- User question: "Should credit notes link to the original invoice?"
- Input: `yes_no`

### Q50
- ID: `inv_credit_note_approval`
- User question: "Do credit notes need approval?"
- Input: `yes_no`

### Q51
- ID: `inv_debit_notes`
- User question: "Do you issue debit notes (for additional charges)?"
- Input: `yes_no`

### Q52
- ID: `inv_credit_balance`
- User question: "Can customers have credit balances to apply to future invoices?"
- Input: `yes_no`

---

## Advanced Pack G: Recurring Billing

Ask when Q13 = yes.

### Q53
- ID: `inv_recurring_frequency`
- User question: "How often do you bill recurring customers? (Select all)"
- Input: `multi_choice`
- Options: `Weekly`, `Monthly`, `Quarterly`, `Semi-annually`, `Annually`, `Custom`

### Q54
- ID: `inv_recurring_auto_generate`
- User question: "Should recurring invoices be generated automatically?"
- Input: `yes_no`

### Q55
- ID: `inv_recurring_review`
- User question: "Do you want to review recurring invoices before sending?"
- Input: `yes_no`
- Condition: ask only when Q54 = yes

### Q56
- ID: `inv_subscription_proration`
- User question: "Do you need to prorate for mid-cycle changes?"
- Input: `yes_no`

### Q57
- ID: `inv_recurring_contract`
- User question: "Do recurring customers have contracts with start/end dates?"
- Input: `yes_no`

### Q58
- ID: `inv_recurring_price_changes`
- User question: "Can recurring prices change over time (for example annual increases)?"
- Input: `yes_no`

---

## Advanced Pack H: Invoice Delivery and Collections

Ask when Q14 or Q15 has selections.

### Q59
- ID: `inv_email_template`
- User question: "Do you want customizable email templates for invoices?"
- Input: `yes_no`

### Q60
- ID: `inv_pdf_generation`
- User question: "Do you need to generate PDF invoices?"
- Input: `yes_no`

### Q61
- ID: `inv_invoice_template`
- User question: "Do you want a customizable invoice print layout?"
- Input: `yes_no`

### Q62
- ID: `inv_track_delivery`
- User question: "Do you want to track if invoices were sent/viewed?"
- Input: `yes_no`

### Q63
- ID: `inv_reminder_schedule`
- User question: "When should payment reminders be sent?"
- Input: `multi_choice`
- Options: `On due date`, `3 days before due`, `7 days overdue`, `14 days overdue`, `30 days overdue`, `Custom`
- Condition: ask only when Q15 = yes

### Q64
- ID: `inv_escalation`
- User question: "Do you escalate overdue invoices to collections or legal?"
- Input: `yes_no`

### Q65
- ID: `inv_dunning_levels`
- User question: "Do you want different reminder tones (friendly, firm, final)?"
- Input: `yes_no`
- Condition: ask only when Q15 = yes

---

## Advanced Pack I: Invoice Lifecycle

Ask for all users.

### Q66
- ID: `inv_draft_mode`
- User question: "Do you want to save draft invoices before finalizing?"
- Input: `yes_no`

### Q67
- ID: `inv_approval_required`
- User question: "Do invoices need approval before sending?"
- Input: `yes_no`

### Q68
- ID: `inv_approval_threshold`
- User question: "Is approval only needed above a certain amount?"
- Input: `yes_no`
- Condition: ask only when Q67 = yes

### Q69
- ID: `inv_void_cancel`
- User question: "Can you void or cancel sent invoices?"
- Input: `yes_no`

### Q70
- ID: `inv_edit_after_send`
- User question: "Can you edit an invoice after it's sent?"
- Input: `choice`
- Options: `No, create credit note instead`, `Yes, with audit trail`, `Yes, freely`

---

## Advanced Pack J: Reporting and Analytics

Ask for all users, but allow simple selections.

### Q71
- ID: `inv_report_set`
- User question: "Which invoice reports do you want? (Select all)"
- Input: `multi_choice`
- Options:
  - `Invoice aging`
  - `Outstanding receivables`
  - `Collections performance`
  - `Revenue by customer`
  - `Revenue by product/service`
  - `Revenue by period`
  - `Tax summary`
  - `Payment history`

### Q72
- ID: `inv_dashboard_cards`
- User question: "Which dashboard cards do you want? (Select all)"
- Input: `multi_choice`
- Options: `Total outstanding`, `Overdue amount`, `Invoices this month`, `Payments received`, `Top customers`, `Aging summary`

### Q73
- ID: `inv_scheduled_reports`
- User question: "Do you want scheduled report generation?"
- Input: `yes_no`

---

## Advanced Pack K: Integration and Automation

Ask for all users (simple policy choices).

### Q74
- ID: `inv_accounting_integration`
- User question: "Do you need to post invoices to an accounting system?"
- Input: `yes_no`

### Q75
- ID: `inv_inventory_link`
- User question: "Are invoiced items linked to inventory?"
- Input: `yes_no`

### Q76
- ID: `inv_order_to_invoice`
- User question: "Do you create invoices from sales orders?"
- Input: `yes_no`

### Q77
- ID: `inv_payment_gateway`
- User question: "Do you want online payment links on invoices?"
- Input: `yes_no`

### Q78
- ID: `inv_data_import`
- User question: "Do you need to import invoice data from spreadsheets?"
- Input: `yes_no`

### Q79
- ID: `inv_data_export`
- User question: "Do you need to export invoice data?"
- Input: `yes_no`

### Q80
- ID: `inv_api_access`
- User question: "Do external systems need to create or read invoices?"
- Input: `yes_no`

---

## Advanced Pack L: Access and Governance

Ask for all users with simple policy choices.

### Q81
- ID: `inv_who_creates`
- User question: "Who can create invoices?"
- Input: `multi_choice`
- Options: `Sales team`, `Finance team`, `Managers`, `Everyone`

### Q82
- ID: `inv_who_approves`
- User question: "Who can approve invoices?"
- Input: `multi_choice`
- Options: `Finance manager`, `Department head`, `Owner/admin`
- Condition: ask only when Q67 = yes

### Q83
- ID: `inv_audit_trail`
- User question: "Do you need an audit trail of invoice changes?"
- Input: `yes_no`

### Q84
- ID: `inv_duplicate_prevention`
- User question: "Should the system prevent duplicate invoice numbers?"
- Input: `yes_no`

---

## Internal Mapping Model (System Side)

This section is internal and not shown to end users.

Answers map into these configuration blocks:

- `modules.invoice.enabled`
- `modules.invoice.tax_rate` (from Q7)
- `modules.invoice.currency` (from Q3)
- `modules.invoice.payment_terms` (from Q8)
- `modules.invoice.prefix` (from Q28)
- `entities.customers` (fields based on Q16-Q21)
- `entities.invoices` (fields based on Q27-Q34)
- `entities.invoice_items` (when Q29 = yes)
- `entities.quotes` or `entities.estimates` (when Q11 = yes)
- `entities.credit_notes` (when Q12 = yes)
- `entities.payments` (when Q9 = yes)
- `invoice_tax` (rates, inclusive/exclusive, exempt, reverse charge)
- `invoice_payments` (methods, allocation, overpayment, aging)
- `invoice_credit_debit` (reasons, linking, approval)
- `invoice_recurring` (frequency, auto-generate, proration, contracts)
- `invoice_delivery` (email, PDF, reminders, dunning)
- `invoice_lifecycle` (draft, approval, void, edit rules)
- `invoice_reporting` (dashboard cards, reports, schedule)
- `invoice_integrations` (accounting, inventory, orders, payment gateway)
- `invoice_governance` (permissions, audit trail, duplicate prevention)

---

## Validation Gates Before AI Call

- Do not call AI if any Core Question is unanswered.
- Do not call AI if tax is enabled but tax type/rate answers are missing.
- Do not call AI if payments are enabled but payment method answers are missing.
- Do not call AI if recurring is enabled but frequency answers are missing.
- Do not call AI until user approves prefilled draft.

---

## AI Handoff Payload (Internal)

```json
{
  "module": "invoice",
  "mandatory_answers": {
    "inv_business_model": "Product sales",
    "inv_currency": "USD",
    "inv_tax_applicable": "yes",
    "inv_default_tax_rate": 10,
    "inv_payment_terms": "Net 30",
    "inv_track_payments": "yes"
  },
  "prefilled_sdf": {
    "project_name": "Example SMB Invoice",
    "modules": {
      "invoice": { 
        "enabled": true,
        "tax_rate": 10,
        "currency": "USD",
        "payment_terms": "Net 30",
        "prefix": "INV-"
      }
    },
    "entities": []
  },
  "user_business_description": "..."
}
```

`mandatory_answers` and `prefilled_sdf` are hard constraints for AI generation.
