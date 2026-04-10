---
title: Phase 6 / Testing & Docs (TE) — UC-4 Invoice & HR
---

## 1. Prompt Result

- Added unit-style tests for invoice and HR backend bricks under `test/`:
  - `test/invoice_bricks.unit.test.js`
  - `test/hr_bricks.unit.test.js`
- Added assembler integration tests that generate ERPs from sample SDFs and verify module layout and routes:
  - `test/module_generation.integration.test.js`
- Added API-surface checks for generated invoice/HR routes:
  - `platform/backend/tests/api_invoice_hr_routes.test.js`
- Defined manual UI/e2e flows for invoice and HR modules:
  - `test/ui_invoice_hr.flows.test.md`
- Added UC-4 test plan, QA checklist, local testing guide, and a “generate three modules” how-to:
  - `docs/uc4_test_plan.md`
  - `docs/uc4_qa_checklist.md`
  - `docs/local_testing_guide.md`
  - `docs/how_to_generate_three_modules.md`
- Integrated these into the main docs:
  - Updated `docs/overview.md` key documents list.
  - Refined testing expectations in `docs/prompt_expectations.md` for UC-4.

## 2. What User Must Add/Prepare

- Ensure the core platform and assembler continue to build successfully (no changes were made to them in this prompt, but upstream work from other phases must be merged and stable).
- Confirm `.env` is configured and database migrations are up to date (follow `README.md`).
- Have Docker or a compatible local Node/Python/Postgres setup as described in `README.md`.
- Optionally extend sample SDFs if you want more complex invoice/HR scenarios (e.g., extra fields or relations) while staying within `SDF_REFERENCE.md`.

## 3. Setup Steps

1. **Start the Platform**
   - Using Docker (recommended), from repo root:
     - Windows: `.\scripts\dev.ps1 start`
     - macOS/Linux: `./scripts/dev.sh start`
   - Or start backend, frontend, and AI Gateway individually as in `README.md`.
2. **Generate Sample ERPs**
   - From repo root, generate from provided SDFs:
     - `node test/run_assembler.js test/sample_sdf_invoice.json`
     - `node test/run_assembler.js test/sample_sdf_hr.json`
     - `node test/run_assembler.js test/sample_sdf_hr_inventory.json`
     - `node test/run_assembler.js test/sample_sdf_multi_module.json`
   - Note the printed output paths under `generated/`.
3. **(Optional) Run Generated ERPs**
   - For any generated project, change into its directory and follow its README (Docker or direct Node) to start backend and frontend.

## 4. Test Checklist

- **Unit**
  - [ ] `node test/invoice_bricks.unit.test.js`
  - [ ] `node test/hr_bricks.unit.test.js`
- **Integration (Assembler)**
  - [ ] `node test/module_generation.integration.test.js`
- **API Surface**
  - [ ] `node platform/backend/tests/api_invoice_hr_routes.test.js`
- **UI / E2E (Manual)**
  - [ ] Execute all steps in `test/ui_invoice_hr.flows.test.md` against a multi-module ERP build.
- **Docs Consistency**
  - [ ] Review `docs/uc4_test_plan.md` and `docs/uc4_qa_checklist.md` and confirm they match current behavior.
  - [ ] Follow `docs/local_testing_guide.md` once end-to-end to ensure commands are correct.
  - [ ] Optionally follow `docs/how_to_generate_three_modules.md` to generate a full inventory+invoice+HR ERP.

## 5. Expected vs Not Expected

**Expected**

- Unit scripts exit without failures and confirm brick wiring (invoice totals/numbering, HR normalization/validation).
- Integration script confirms:
  - Backend modules for each enabled module exist (inventory, invoice, HR).
  - Frontend modules exist under `frontend/modules/<module>`.
  - Generated backend routes index mounts expected entity routes.
- API-surface script confirms invoice and HR entity routes are present in the latest generated backend.
- Manual UI flows:
  - Pages load without client-side errors.
  - Valid operations succeed; invalid inputs (e.g., inverted leave dates, non-numeric invoice quantities) are rejected.

**Not Expected**

- Missing module folders for enabled modules in generated ERPs.
- Absence of basic REST routes for invoice/HR entities in the generated backend.
- Ability to save clearly invalid records (empty required fields, reversed leave ranges, malformed email).
- Docs that reference non-existent scripts or commands.

## 6. Known Risks / Follow-up

- **Runtime API tests**: Current API tests focus on route wiring rather than full HTTP end-to-end behavior. Extending them to hit live endpoints will require a stable way to start a generated backend in test mode and may involve adding test dependencies (to be coordinated with backend owners).
- **Automated browser tests**: UI coverage is currently manual. Introducing a browser automation framework (Playwright/Cypress) would require adding frontend dev dependencies and wiring scripts, which should be planned with the frontend owner (EA).
- **SDF evolution**: If `SDF_REFERENCE.md` or invoice/HR shapes change, sample SDFs and tests may need updates to stay aligned.
- **Generated project templates**: Changes in backend/frontend templates for generated ERPs might move files or routes, requiring small updates to integration/API-surface scripts.

## 7. Blocked Dependencies

- Automated API and UI tests that spin up generated ERPs in a controlled way depend on:
  - A shared agreement on how to start/stop a generated backend/frontend in CI.
  - Potential new dev dependencies (HTTP test clients, browser automation) and scripts in platform projects, owned by backend/frontend teams.
- Any change to SDF schema, brick behavior, or assembler routing must be coordinated with:
  - BTB for AI prompts/schema.
  - ODD for backend behavior and data contracts.
  - EA for frontend module UI.
  - ASA for assembler wiring and generation flow.

