# UAT Test Plan - CustomERP (Post-Pull Baseline)

Version: 2.1  
Date: 2026-03-26  
Prepared by: QA / Tester  
Type: User Acceptance Testing (UAT)

## Purpose
Validate the current post-pull baseline end-to-end: platform access, AI flow, assembler generation, generated ERP usability, and known failure behavior with reproducible evidence.

## Scope (In)
- Platform availability and health checks
- AI analyze/clarify/finalize behavior
- CLI generation from current sample SDFs under `test/`
- Generated ERP startup and key user flows (Invoice, HR, Inventory)
- API route mount verification in generated backend
- Regression documentation for known blockers

## Out of Scope
- Performance/load testing
- Security and penetration testing
- Production deployment hardening
- Refactoring failing unit tests

## Test Environment
- OS: Windows/macOS/Linux (as available)
- Docker Desktop installed and running
- Platform startup:
  - Windows: `.\scripts\dev.ps1 start`
  - macOS/Linux: `./scripts/dev.sh start`
- Service URLs:
  - Platform Frontend: `http://localhost:5173`
  - Platform Backend: `http://localhost:3000`
  - AI Gateway: `http://localhost:8000`
- `.env` configured, including `GOOGLE_AI_API_KEY`

## Entry Criteria
- Platform services are reachable
- Tester can log in/open the platform UI
- Repository is updated via latest pull
- Test scripts and sample SDFs are present

## Exit Criteria
- All Critical and High UAT cases pass, or
- Blocked/failing items are logged with root cause and reproduction details

## Test Data / Scenario Pools

### A) Baseline SDFs
1) `test/sample_sdf_invoice.json`  
2) `test/sample_sdf_hr.json`  
3) `test/sample_sdf_hr_inventory.json`  
4) `test/sample_sdf_multi_module.json`

### B) Inventory Priority A SDFs
1) `test/sample_sdf_inventory_priority_a_reservations.json`  
2) `test/sample_sdf_inventory_priority_a_inbound.json`  
3) `test/sample_sdf_inventory_priority_a_cycle.json`  
4) `test/sample_sdf_inventory_priority_a_mixed.json`

### C) Invoice Priority A SDFs
1) `test/sample_sdf_invoice_priority_a_transactions.json`  
2) `test/sample_sdf_invoice_priority_a_payments.json`  
3) `test/sample_sdf_invoice_priority_a_notes.json`  
4) `test/sample_sdf_invoice_priority_a_lifecycle.json`  
5) `test/sample_sdf_invoice_priority_a_calculation.json`  
6) `test/sample_sdf_invoice_priority_a_mixed.json`

### D) HR Priority A SDFs
1) `test/sample_sdf_hr_priority_a_leave_engine.json`  
2) `test/sample_sdf_hr_priority_a_leave_approvals.json`  
3) `test/sample_sdf_hr_priority_a_attendance_time.json`  
4) `test/sample_sdf_hr_priority_a_compensation_ledger.json`  
5) `test/sample_sdf_hr_priority_a_mixed.json`

### E) Stress/Custom SDFs
1) `test/sample_sdf_all_modules_priority_a_customized.json`  
2) `test/sample_sdf_solar_panel_firm.json`  
3) `test/sample_sdf_full_capability_test.json`

## Recommended Execution Order
1. Platform health checks
2. Unit smoke (`invoice_bricks`, `hr_bricks`)
3. Integration generation (`module_generation.integration`)
4. Manual generation for target UAT artifact(s)
5. Generated ERP startup and UI checks
6. Route mount checks
7. Defect logging and sign-off

## Test Cases

### A. Platform Health & Access
**UAT-001: Platform UI loads**
- Steps:
  1. Open `http://localhost:5173`
- Expected:
  - Platform UI loads without blocking errors
- Result: [X] Pass [ ] Fail
- Notes:

**UAT-002: Backend and AI health**
- Steps:
  1. Open `http://localhost:3000/health`
  2. Open `http://localhost:8000/health`
- Expected:
  - Both endpoints return success
- Result: [ ] Pass [X] Fail
- Notes: Backend endpoint returned succesfully However AI health failed

### B. AI Flow
**UAT-010: Analyze prompt**
- Steps:
  1. Create/open project
  2. Submit business description and run analyze
- Expected:
  - Valid SDF returned
- Result: [ ] Pass [ ] Fail
- Notes:

**UAT-011: Clarify/finalize prompt**
- Steps:
  1. Answer clarification questions (if shown)
  2. Finalize
- Expected:
  - Final SDF produced without unresolved blockers
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

### C. Automated Script Smoke
**UAT-020: Invoice bricks unit**
- Steps:
  1. Run `node test/invoice_bricks.unit.test.js`
- Expected:
  - Script exits successfully
- Result: [ ] Pass [ ] Fail [ ] Known-Issue
- Notes:

**UAT-021: HR bricks unit**
- Steps:
  1. Run `node test/hr_bricks.unit.test.js`
- Expected:
  - Script exits successfully
- Result: [ ] Pass [ ] Fail
- Notes:

**UAT-022: Module generation integration**
- Steps:
  1. Run `node test/module_generation.integration.test.js`
- Expected:
  - Baseline scenarios run; failures captured with SDF validation details if present
- Result: [ ] Pass [ ] Fail [ ] Blocked
- Notes:

### D. Assembler Generation (Artifact-by-Artifact)
**UAT-030: Invoice-only artifact**
- Steps:
  1. `node test/run_assembler.js test/sample_sdf_invoice.json`
- Expected:
  - Generated backend/frontend available
- Result: [ ] Pass [ ] Fail
- Notes:

**UAT-031: HR-only artifact**
- Steps:
  1. `node test/run_assembler.js test/sample_sdf_hr.json`
- Expected:
  - HR artifact generated
- Result: [ ] Pass [ ] Fail
- Notes:

**UAT-032: HR+Inventory artifact (known blocker check)**
- Steps:
  1. `node test/run_assembler.js test/sample_sdf_hr_inventory.json`
- Expected:
  - Current baseline may fail with cross-module reference validation
- Result: [ ] Pass [ ] Fail [ ] Blocked
- Notes:

### E. Generated ERP Startup
**UAT-040: Start generated ERP**
- Steps:
  1. `cd <generated-project-path>`
  2. Run `.\dev.ps1 start` (Windows) or `./dev.sh start` (macOS/Linux)
- Expected:
  - Backend and frontend start and UI opens
- Result: [ ] Pass [ ] Fail
- Notes:

### F. API Route Mount Validation
**UAT-050: Invoice routes mounted**
- Steps:
  1. In generated artifact folder run:
     - `Select-String -Path ".\backend\src\routes\index.js" -SimpleMatch -Pattern "router.use('/invoices'", "router.use('/invoice_items'"`
- Expected:
  - Both lines exist for invoice-capable artifact
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

**UAT-051: HR routes mounted**
- Steps:
  1. In generated artifact folder run:
     - `Select-String -Path ".\backend\src\routes\index.js" -SimpleMatch -Pattern "router.use('/employees'", "router.use('/departments'", "router.use('/leaves'"`
- Expected:
  - Lines exist for HR-capable artifact
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

### G. Functional UAT by Module
**UAT-060: Invoice flow**
- Steps:
  1. Create customer
  2. Create invoice with line items
  3. Edit line and verify totals
- Expected:
  - Save and recalculation behave correctly
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

**UAT-061: HR flow**
- Steps:
  1. Create department and employee
  2. Create valid leave
  3. Try invalid leave range
- Expected:
  - Valid save succeeds
  - Invalid date range is rejected
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

**UAT-062: Inventory Priority A flow**
- Steps:
  1. Execute reservation/inbound/cycle operations (based on enabled packs)
- Expected:
  - Status and quantity changes follow business rules
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

### H. Persistence and CSV (if enabled)
**UAT-070: CSV import/export smoke**
- Steps:
  1. Import valid CSV
  2. Export list data
- Expected:
  - Import creates rows
  - Export includes expected data
- Result: [ ] Pass [ ] Fail [ ] N/A
- Notes:

**UAT-071: Persistence after restart**
- Steps:
  1. Create records
  2. Restart generated ERP
  3. Verify records remain
- Expected:
  - Data persists after restart
- Result: [ ] Pass [ ] Fail
- Notes:

## Current Known Defects / Risks

1) **SDF validation cross-module reference blocker**
- Symptom: `Field 'warehouses.manager_id' must reference an entity in the same module or marked shared.`
- Affects: `test/sample_sdf_hr_inventory.json`
- Status: Known baseline blocker unless SDF is adjusted.

2) **API route script artifact-selection risk**
- Symptom: `node platform/backend/tests/api_invoice_hr_routes.test.js` may fail when latest generated artifact does not include expected module routes.
- Mitigation: Validate routes inside the exact artifact under test.

3) **Invoice unit test expectation drift**
- Symptom: `test/invoice_bricks.unit.test.js` may fail on string-based expectation in recalculation method check.
- Likely cause: test expects hardcoded entity names while implementation is config-driven.

## Defect Logging
For each failure capture:
- Test Case ID
- Command or UI steps
- Expected vs actual
- Full error text / stack trace
- Screenshot or terminal log
- Severity (Critical/High/Medium/Low)

## Sign-off
- QA Lead: ____________________  Date: __________
- Product Owner: ______________  Date: __________
