# After-Prompt Care: HR Generator Wiring (Phase 5)

Date: 2026-02-24  
Author: ODD  
Topic: HR module generator wiring

---

## 1. Prompt Result
- Code/Logic: Assembler validates HR entities and wires HR backend mixins for `employees`, `departments`, `leaves`.
- Visuals/UI: Not required in this prompt.
- Data/Config: HR validation uses fields defined in `SDF_REFERENCE.md`.
- Tests: Not added in this prompt.

## 2. What User Must Add/Prepare
- Code/Logic: Ensure HR backend mixins are present on main (they are required by assembler wiring).
- Visuals/UI: HR frontend pages must be implemented by EA.
- Data/Config: Use `module: "hr"` and required HR fields in the SDF.
- Tests: TE to add unit/integration tests for HR module generation.

## 3. Setup Steps
- Code/Logic: Pull latest `main` before testing generation.
- Visuals/UI: Not required in this prompt.
- Data/Config: Use `test/sample_sdf_hr.json` as the reference SDF.
- Tests: Install Node.js if you plan to run generator tests locally.

## 4. Test Checklist
- Code/Logic: Run assembler with `test/sample_sdf_hr.json` and confirm services include HR mixin logic.
- Visuals/UI: Not required in this prompt.
- Data/Config: Verify entities tagged `module: "hr"` are generated under `modules/hr/`.
- Tests: TE-owned tests for HR bricks and module generation.

## 5. Expected vs Not Expected
- Code/Logic: Expected HR validation and mixin wiring; not expected HR workflows or attendance logic.
- Visuals/UI: Not expected in this prompt.
- Data/Config: Expected no schema changes.
- Tests: Not expected in this prompt.

## 6. Known Risks / Follow-up
- Code/Logic: If HR entities are missing required fields, validation will fail on assembly.
- Visuals/UI: HR pages remain pending until EA delivers frontend bricks.
- Data/Config: Mismatched HR field names will break validation or wiring.
- Tests: Coverage gap until TE adds tests.

## 7. Blocked Dependencies
- Code/Logic: None if HR mixins are already merged into main.
- Visuals/UI: HR frontend pages (EA).
- Data/Config: HR schema already defined by BTB.
- Tests: TE to add unit + integration tests.
