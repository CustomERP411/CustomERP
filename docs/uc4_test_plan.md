---
title: UC-4 Test Plan (Invoice, HR, Multi-Module)
---

## 1. Scope

- **Use Cases Covered**
  - UC-4: Generate ERP System (multi-module output).
  - UC-4.2: Generate Invoice Module.
  - UC-4.3: Generate HR Module.
- **Modules**
  - Inventory (for combined builds).
  - Invoice.
  - HR.
- **Artifacts Under Test**
  - Generated ERP backend (Node/Express, flat-file data).
  - Generated ERP frontend (React/Tailwind).
  - Assembly pipeline (ProjectAssembler + Backend/Frontend generators).

## 2. Objectives

- Verify that invoice- and HR-related bricks are correctly wired and behave as expected.
- Confirm that single-module and multi-module SDFs generate runnable ERPs with the correct folder layout.
- Ensure routes for invoice and HR entities are exposed and reachable.
- Validate core UI flows for invoice and HR from an end-user perspective (manual checklist).

## 3. Test Types

- **Unit**
  - Backend mixins for:
    - `InvoiceMixin`, `InvoiceItemsMixin`.
    - `HREmployeeMixin`, `HRDepartmentMixin`, `HRLeaveMixin`.
- **Integration (Assembler)**
  - SDF → Generated ERP:
    - Invoice-only build.
    - HR-only build.
    - HR + Inventory combined build.
    - Inventory + Invoice multi-module build.
- **API Surface**
  - Verification that `/api/<entity>` style routes are mounted for:
    - `invoices`, `invoice_items`.
    - `employees`, `departments`, `leaves`.
- **UI / E2E (Manual)**
  - Invoice: create/edit invoice with line items, status changes.
  - HR: create departments, employees, leave records with validation.

## 4. Environments

- **Local Docker (recommended)**
  - Start platform with `scripts/dev.ps1 start` (Windows) or `scripts/dev.sh start` (macOS/Linux).
  - Generate ERPs using the platform UI or `test/run_assembler.js`.
- **Local (no Docker)**
  - Backend: `platform/backend` (`npm run dev`).
  - Frontend: `platform/frontend` (`npm run dev`).
  - AI Gateway: `platform/ai-gateway` (uvicorn).

## 5. Entry Criteria

- Platform services are running and reachable (frontend, backend, AI gateway).
- `.env` is configured and migrations are applied.
- Sample SDF files exist under `test/`:
  - `sample_sdf_invoice.json`.
  - `sample_sdf_hr.json`.
  - `sample_sdf_hr_inventory.json`.
  - `sample_sdf_multi_module.json`.

## 6. Exit Criteria

- All automated tests defined in this plan pass on the target environment.
- Manual UI flows in `test/ui_invoice_hr.flows.test.md` are executed without critical issues.
- No open Sev-1/Sev-2 defects related to:
  - Data loss.
  - Broken routes.
  - Inability to generate or run ERPs for invoice/HR/combined builds.

## 7. Test Cases (High-Level)

### 7.1 Unit Tests (Bricks)

- **UT-INV-001**: Invoice number generation respects prefix, uniqueness, and sequence gaps.
- **UT-INV-002**: Invoice totals (`subtotal`, `tax_total`, `grand_total`) are calculated from line items.
- **UT-HR-001**: Employee email normalization and non-empty validation.
- **UT-HR-002**: Department name/location normalization.
- **UT-HR-003**: Leave date range validation prevents end date before start date.

### 7.2 Integration Tests (Assembler)

- **IT-INV-001**: Invoice-only SDF → ERP with invoice backend/frontend modules and routes.
- **IT-HR-001**: HR-only SDF → ERP with HR backend/frontend modules and routes.
- **IT-HR-002**: HR+Inventory SDF → ERP with both modules present.
- **IT-MOD-001**: Multi-module SDF → ERP with inventory + invoice modules and correct routes.

### 7.3 API Surface Tests

- **API-INV-001**: `/api/invoices` and `/api/invoice_items` are mounted in the generated backend router.
- **API-HR-001**: `/api/employees`, `/api/departments`, `/api/leaves` are mounted.

### 7.4 UI / E2E Flows

- **UI-INV-001**: Create invoice with valid line items.
- **UI-INV-002**: Edit invoice status and line items; verify totals update.
- **UI-HR-001**: Create department and employee; verify department linkage.
- **UI-HR-002**: Create leave record with valid dates; reject invalid range.

## 8. Traceability

- This test plan supports the Sprint 1 acceptance checklist in:
  - `docs/sprint1_detailed_blueprint.md` (Phase 4, 5, 7).
  - `docs/sprint1.md` (Next Sprint UC-4 testing tasks).

