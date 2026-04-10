---
title: UC-4 QA Checklist (Invoice, HR, Multi-Module)
---

## 1. Generation & Structure

- [ ] Invoice-only SDF (`test/sample_sdf_invoice.json`) generates without errors.
- [ ] HR-only SDF (`test/sample_sdf_hr.json`) generates without errors.
- [ ] HR+Inventory SDF (`test/sample_sdf_hr_inventory.json`) generates without errors.
- [ ] Multi-module SDF (`test/sample_sdf_multi_module.json`) generates without errors.
- [ ] Each generated ERP contains:
  - [ ] `backend/modules/invoice` when invoice is enabled.
  - [ ] `backend/modules/hr` when HR is enabled.
  - [ ] `backend/modules/inventory` when inventory is enabled.
  - [ ] Matching `frontend/modules/<module>` folders.

## 2. API Surface (Generated ERP)

- [ ] `src/routes/index.js` in the generated backend mounts:
  - [ ] `/invoices` and `/invoice_items` when invoice is enabled.
  - [ ] `/employees`, `/departments`, `/leaves` when HR is enabled.
- [ ] Hitting a sample GET endpoint (e.g., `/api/invoices`) returns 200 after at least one record is created.
- [ ] Error responses use consistent JSON shape (e.g., `{ error: "message" }`) where applicable.

## 3. Invoice Module Behavior

- [ ] Creating an invoice without required fields fails with a clear error.
- [ ] Creating an invoice with valid data succeeds.
- [ ] Line items require numeric `quantity` and `unit_price`.
- [ ] `line_total` is calculated as `quantity * unit_price`.
- [ ] `invoice_number` is unique and follows the configured prefix.
- [ ] `subtotal`, `tax_total`, `grand_total` are recalculated when line items change.
- [ ] Changing invoice module `tax_rate` in SDF affects calculated totals.

## 4. HR Module Behavior

- [ ] Department creation with a non-empty `name` succeeds.
- [ ] Department `name` and `location` values are trimmed.
- [ ] Employee `email` is normalized (trimmed, lower-cased) on create/update.
- [ ] Invalid or empty email is rejected.
- [ ] Leave creation enforces valid date ranges:
  - [ ] Valid `start_date` and `end_date` in order are accepted.
  - [ ] `end_date` before `start_date` is rejected with an error.

## 5. UI Flows (Manual)

- [ ] Invoice list, create, and detail pages load without client errors.
- [ ] HR employees, departments, and leaves pages load without client errors.
- [ ] The flows in `test/ui_invoice_hr.flows.test.md` are executed and pass.

## 6. Regression & Stability

- [ ] Running `node test/invoice_bricks.unit.test.js` completes with no failures.
- [ ] Running `node test/hr_bricks.unit.test.js` completes with no failures.
- [ ] Running `node test/module_generation.integration.test.js` completes with no failures.
- [ ] Running `node platform/backend/tests/api_invoice_hr_routes.test.js` completes with no failures.

## 7. Sign-Off

- [ ] QA lead confirms all items above are complete or explicitly waived.
- [ ] Any waived items are documented with rationale and follow-up plan.

