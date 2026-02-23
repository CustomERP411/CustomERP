# After-Prompt Care: HR Backend Bricks (Phase 5)

Date: 2026-02-24  
Author: ODD  
Topic: HR backend bricks (employees, departments, leaves)

---

## 1. Prompt Result
- Code/Logic: Added HR mixins (`HREmployeeMixin`, `HRDepartmentMixin`, `HRLeaveMixin`) for normalization and basic date checks.
- Visuals/UI: Not required in this prompt.
- Data/Config: No schema changes; aligned to `SDF_REFERENCE.md` and `test/sample_sdf_hr.json`.
- Tests: Not added in this prompt.

## 2. What User Must Add/Prepare
- Code/Logic: Wire HR mixins in the assembler (Phase‑5 wiring task) or add explicit mixins in SDF for manual testing.
- Visuals/UI: HR pages are a separate EA task.
- Data/Config: Ensure HR entities use the expected fields (`employees`, `departments`, `leaves`).
- Tests: TE to add unit/integration tests for HR bricks.

## 3. Setup Steps
- Code/Logic: Pull latest changes that include the HR SDF definition (BTB branch if not merged).
- Visuals/UI: Not required in this prompt.
- Data/Config: Use `test/sample_sdf_hr.json` as the reference for field names.
- Tests: Install Node.js if you plan to run generator tests locally.

## 4. Test Checklist
- Code/Logic: Create/update leaves and verify invalid date ranges are rejected; check employee email normalization.
- Visuals/UI: Not required in this prompt.
- Data/Config: Confirm `hire_date`, `start_date`, `end_date` store ISO strings when valid.
- Tests: TE‑owned unit tests for mixins and integration tests for HR module generation.

## 5. Expected vs Not Expected
- Code/Logic: Expected basic normalization and date sanity checks; not expected approval workflows or attendance tracking.
- Visuals/UI: Not expected (HR UI pages are separate).
- Data/Config: Expected no new schema fields.
- Tests: Not expected in this prompt.

## 6. Known Risks / Follow-up
- Code/Logic: Mixins will not run until assembler wiring is implemented.
- Visuals/UI: HR UI remains pending.
- Data/Config: If HR field names diverge from the schema, normalization will not apply.
- Tests: Coverage gap until TE adds tests.

## 7. Blocked Dependencies
- Code/Logic: Assembler wiring for HR mixins (ODD/ASA).
- Visuals/UI: HR frontend pages (EA).
- Data/Config: None beyond the HR SDF definition already documented.
- Tests: TE to add unit and integration tests.
