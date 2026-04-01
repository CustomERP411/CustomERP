# Invoice Module ERP Capability Research and Gap Analysis

## Purpose

This document lists what a full ERP invoice module typically needs, then compares that list against the current CustomERP generated invoice implementation.

Goal:
- define the complete capability scope,
- identify what is already implemented,
- identify what is partial,
- identify what is missing and should be added as backlog.

Assessment source:
- code in `platform/assembler/**`,
- mixins in `brick-library/backend-bricks/mixins/**`,
- SDF contract in `SDF_REFERENCE.md`,
- AI normalization/guardrails in `platform/ai-gateway/**`,
- current sprint/project docs.

Status legend:
- `Implemented` = present and usable now.
- `Partial` = some support exists, but important parts are still missing.
- `Missing` = not currently present in generated ERP.

---

## Complete Invoice Capability Catalog (What a full ERP invoice module may require)

## 1) Customer and Billing Master Data
- Customer master (company/legal name, contacts, billing address)
- Customer tax profile (VAT/GST registration, tax exemption flags)
- Customer default payment terms
- Customer currency preferences
- Customer credit limit and credit hold flag
- Customer billing rules (delivery/billing split, invoice grouping)

## 2) Commercial Documents Before Invoice
- Quotation/estimate creation and versioning
- Quotation approval flow
- Pro forma invoice generation
- Quote to invoice conversion
- Sales order to invoice conversion rules
- Partial invoicing from order lines

## 3) Invoice Core Data Model
- Invoice header (number, customer, dates, status)
- Invoice line items (description, quantity, unit price, line totals)
- Automatic subtotal, tax total, grand total calculations
- Discount model (line discount and document discount)
- Additional charges (shipping, handling, service fee)
- Notes, terms, and internal remarks

## 4) Numbering, Terms, and Lifecycle
- Configurable invoice number prefix/sequence
- Issue date and due date defaults from payment terms
- Lifecycle statuses (Draft, Sent, Paid, Overdue, Cancelled)
- Status transition rules and restrictions
- Duplicate invoice number prevention
- Void/cancel with traceability

## 5) Tax and Compliance Calculation
- Multi-rate tax support in one invoice
- Tax inclusive vs tax exclusive pricing
- Tax rounding policy configuration
- Reverse charge / zero-rated handling
- Credit note and debit note tax correction handling
- Country-specific tax reporting outputs

## 6) Payments and Accounts Receivable
- Payment recording against invoices
- Partial payment support
- Multi-invoice payment allocation
- Unapplied payments and reallocation
- Refund and write-off handling
- Outstanding balance and aging buckets

## 7) Credit/Debit Notes and Adjustments
- Credit note creation linked to invoice
- Debit note creation linked to invoice
- Full or partial line-level reversals
- Automatic invoice balance recalculation after note posting
- Audit trail for all financial adjustments

## 8) Recurring and Contract Billing
- Recurring invoice schedules
- Subscription/contract billing plans
- Proration handling for mid-cycle changes
- Auto-generation with review step
- Retry/skip handling for failed runs

## 9) Dispatch, Customer Delivery, and Collections
- Send invoice via email workflow
- Customer-facing invoice PDF/print layout
- Delivery status tracking (sent, viewed)
- Payment reminder schedules (dunning)
- Escalation workflow for overdue invoices

## 10) Integration and Operational Controls
- Inventory/fulfillment linkage for billable items
- Accounting posting integration (AR, revenue, tax)
- External API/webhook integration
- Import/export for migration and bulk operations
- Approval checks for high-value invoices

## 11) Reporting and Analytics
- Invoice aging report
- Collections performance report
- Revenue by period/customer/item
- Tax summary report
- Paid vs unpaid trend analysis
- Credit note/debit note impact report

## 12) Non-functional Requirements
- Idempotent create/post invoice operations
- Concurrency-safe number allocation and updates
- Precision-safe money math and rounding consistency
- Strong auditability for invoice-impacting events
- Scalability for high invoice volume

---

## Current Coverage vs Missing Capabilities

| Capability Area | Current Status | Evidence in Current Code | Gap / Missing |
| --- | --- | --- | --- |
| Invoice module toggle + config contract (`tax_rate`, `currency`, `payment_terms`, `prefix`) | Implemented | `SDF_REFERENCE.md`, `ProjectAssembler.js`, `InvoiceMixin.js` | Config options include entity slug references for all sub-packs |
| Invoice required entity validation (`invoices`, `customers`) | Implemented | `_validateSdf()` in `ProjectAssembler.js` | No deep business validation beyond required fields |
| Invoice-items schema enforcement when provided | Implemented | `_validateSdf()` checks for `invoice_items` + FK in `ProjectAssembler.js` | `invoice_items` created by prefilled SDF with full calc engine fields when enabled |
| AI guardrail support for invoice module | Implemented | module whitelist + invoice defaults in `platform/ai-gateway/src/services/sdf_service.py` | Auto-add path ensures `invoices`/`customers` |
| Invoice service mixin with defaults and validations | Implemented | `InvoiceMixin.js` | Status fallback includes all statuses including Cancelled; update hook recalcs outstanding balance |
| Auto invoice number generation with prefix and uniqueness checks | Implemented | `InvoiceMixin.js` | Workflow mode uses DRAFT- prefix; create mode uses sequential numbering |
| Auto due date from payment terms | Implemented | `InvoiceMixin.js` | No customer-specific terms override logic |
| Header totals auto-calc from subtotal + tax rate | Implemented | `InvoiceMixin.js` | Discount/charges fields properly round in both create and update paths |
| Line item calculation + header recalc on item changes | Implemented | `InvoiceItemsMixin.js` (`_recalculateInvoiceTotals`) | Uses configurable entity slugs; recalcs outstanding_balance alongside totals; rejects negative qty/price |
| Per-line discount/tax/charge calculation engine | Implemented | `InvoiceCalculationEngineMixin.js` | Full line-level discount, tax, charges with header rollup |
| Invoice lifecycle with strict transition enforcement | Implemented | `InvoiceLifecycleMixin.js` | Draft->Sent->Paid/Overdue->Cancelled with configurable transitions |
| Invoice transaction safety (idempotency, posting) | Implemented | `InvoiceTransactionSafetyMixin.js` | Idempotency key, issue/cancel operations, locked status protection |
| Payment recording and invoice allocation | Implemented | `InvoicePaymentWorkflowMixin.js` | Full/partial payments, posting, cancellation, invoice balance impact |
| Credit/debit note workflow | Implemented | `InvoiceNoteWorkflowMixin.js` | Credit/debit notes linked to source invoice, posting with balance impact |
| Prefilled SDF creates all supporting entities | Implemented | `prefilledSdfService.js` `buildInvoiceEntities()` | Creates invoice_payments, invoice_payment_allocations, invoice_notes when enabled |
| Entity slug references in module config | Implemented | `prefilledSdfService.js` `buildPrefilledSdfDraft()` | Each sub-pack includes explicit entity slugs |
| Financial fields on invoice header | Implemented | `prefilledSdfService.js` | paid_total, outstanding_balance, idempotency_key, posted_at, cancelled_at |
| Invoice-focused frontend list/cards | Implemented | `invoicePages.js`, `InvoiceCard.tsx` | No advanced filtering/aging collections dashboard |
| Invoice form with child line-items management | Implemented | `buildEntityFormPage()` in `entityPages.js` | No payment/credit/debit workflows in UI |
| Invoice workflow pages (payments, notes, lifecycle) | Implemented | `invoicePriorityPages.js` via `FrontendGenerator.js` | Dedicated workflow pages for payments, notes, and lifecycle |
| Print action on invoice forms | Partial | invoice print button (`window.print`) in `entityPages.js` | Browser print only; no generated PDF template engine |
| Currency formatting in invoice UI | Implemented | `invoicePages.js`, `entityPages.js`, `InvoiceCard.tsx` | No FX conversion/rate handling |
| Status field baseline (`Draft`, `Sent`, `Paid`, `Overdue`, `Cancelled`) | Implemented | `InvoiceMixin.js`, `InvoiceLifecycleMixin.js` | Full five-status set with transition rules |
| Generic CRUD/import/export support for invoice entities | Implemented | generic generators in `FrontendGenerator.js` + `entityPages.js` | No invoice-specific import validation policies |
| Audit trail support on invoice entities | Partial | `features.audit_trail` path via `BackendGenerator.js` + `AuditMixin` support | Depends on per-entity config |
| Multi-rate tax/compliance engine | Missing | Current tax model uses one global tax rate | Needs per-line tax rules and compliance outputs |
| Recurring billing engine | Missing | Not present in current invoice generator path | Needs schedule model + generation runtime |
| Dunning/collection workflow | Missing | Not present in current invoice generator path | Needs reminder cadence + escalation statuses |
| Accounting posting integration for invoices | Missing | No AR/revenue/tax posting integration in generated ERP | Needs posting map and journal emit logic |

---

## Robustness Fixes Applied

The following issues were identified and fixed during the invoice module robustness overhaul:

| Fix | File(s) | Issue | Resolution |
|---|---|---|---|
| Missing financial fields on header | `prefilledSdfService.js` | No `paid_total`, `outstanding_balance`, `idempotency_key`, `posted_at`, `cancelled_at` | All fields added to invoice header entity |
| Missing discount/charges fields | `prefilledSdfService.js` | No `discount_total`, `additional_charges_total` when calc engine on | Fields added conditionally when calc engine enabled |
| Missing calc engine line fields | `prefilledSdfService.js` | `invoice_items` only had `line_total`; calc engine expects 7 additional fields | All line-level fields added when calc engine enabled |
| Missing payment entities | `prefilledSdfService.js` | `invoice_payments` and `invoice_payment_allocations` never created | Both entities created when payments enabled |
| Missing note entity | `prefilledSdfService.js` | `invoice_notes` never created | Entity created when notes enabled |
| Customer field name mismatch | `prefilledSdfService.js` | Used `company_name` as required; assembler expects `name` | Changed to `name` (required) + `company_name` (optional) |
| Missing entity slug refs | `prefilledSdfService.js` | No entity slug references in sub-pack configs | All sub-packs now include explicit entity slugs |
| Status fallback missing Cancelled | `InvoiceMixin.js` | Update hook fallback `allowedStatuses` was `['Draft','Sent','Paid','Overdue']` | Fixed to include `'Cancelled'` in both hooks |
| Update hook missing discount/charges | `InvoiceMixin.js` | Update path didn't declare or round discount/charges fields | Added `discountTotalField`/`chargesField` declarations and rounding in calc engine path |
| Hardcoded entity slugs in items mixin | `InvoiceItemsMixin.js` | `_recalculateInvoiceTotals` used literal `'invoice_items'`, `'invoices'`, `invoice_id` | All entity/field names resolved from configurable defaults |
| Missing outstanding recalc | `InvoiceItemsMixin.js` | `_recalculateInvoiceTotals` updated subtotal/tax/grand but not `outstanding_balance` | Now reads `paid_total` and computes `outstanding_balance` |
| No negative validation | `InvoiceItemsMixin.js` | Allowed negative `quantity` and `unit_price` | Added rejection of negative values in create and update validation |

---

## Missing Capability Backlog (Prioritized for Invoice Module Maturity)

## Priority A (must-have for production-grade invoicing) -- COMPLETED

All Priority A items have been implemented:

- ~~Implement DB-backed invoice transaction model with safe invoice number allocation~~ -> `InvoiceTransactionSafetyMixin.js` (idempotency keys, atomic number allocation, draft/issue/cancel operations)
- ~~Implement payment recording and invoice allocation flow~~ -> `InvoicePaymentWorkflowMixin.js` (full/partial payments, posting, cancellation, invoice balance impact)
- ~~Implement strict invoice lifecycle rules~~ -> `InvoiceLifecycleMixin.js` (Draft->Sent->Paid/Overdue->Cancelled with configurable transitions)
- ~~Implement credit note and debit note workflows~~ -> `InvoiceNoteWorkflowMixin.js` (credit/debit notes, posting, balance impact)
- ~~Implement per-line tax/discount/additional-charge calculation engine~~ -> `InvoiceCalculationEngineMixin.js` (line subtotal, discount types, per-line tax, charges, header rollup)

## Priority B (important business capability expansion)
- Implement invoice payment workspace pages (record payment, allocate, adjust, view outstanding). (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/invoice/**`, `brick-library/frontend-bricks/components/**`]
- Implement credit/debit note UI pages with invoice linkage and balance impact preview. (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/invoice/**`, `brick-library/frontend-bricks/components/**`]
- Implement invoice analytics pages (aging, overdue buckets, paid vs unpaid trends, customer exposure). (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/invoice/**`, `brick-library/frontend-bricks/components/**`]
- Implement customer-specific terms and credit-limit enforcement in invoice create/update flow. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement normalized invoice clarification questions for payment behavior, tax mode, and note policies in AI output. (ASA) [Allowed files: `platform/ai-gateway/src/prompts/**`, `platform/ai-gateway/src/services/sdf_service.py`, `platform/ai-gateway/src/schemas/sdf.py`, `SDF_REFERENCE.md`]

## Priority C (advanced/enterprise)
- Implement recurring billing schedule engine with review controls before posting invoices. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement invoice dispatch workflow (email send state, delivery status, resend tracking). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement accounting posting integration for AR, revenue, tax, and note adjustments. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement dunning workflow UI (reminder stages, overdue escalation, collections status). (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/invoice/**`, `brick-library/frontend-bricks/components/**`]
- Implement generated invoice print layout as a dedicated invoice template (not only browser print). (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/invoice/**`, `brick-library/frontend-bricks/components/**`]

---

## Notes for ASA Task: "Research invoice use-cases and define missing capability list"

Research output should be finalized as:
1. target customer profile (service billing, product billing, mixed),
2. mandatory invoice controls by profile,
3. phased implementation roadmap (A/B/C priorities),
4. measurable acceptance criteria per capability,
5. explicit ownership mapping (ASA/BTB/ODD/EA/TE).

This document can be used as the baseline reference for that task.
