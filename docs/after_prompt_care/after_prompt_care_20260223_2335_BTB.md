# After-Prompt Care: HR Module SDF (Phase 5)

**Date:** 2026-02-23  
**Author:** BTB  
**Topic:** HR Module SDF Definition

---

## 1. Prompt Result
- Defined the **HR Module** specification in `SDF_REFERENCE.md`.
- Updated all AI prompts (`analyze`, `clarify`, `edit`, `finalize`) with an **HR PATTERN** section.
- Created `test/sample_sdf_hr.json` as a canonical example of a valid HR SDF.

## 2. What User Must Add/Prepare
- **Assembler Update (Next Task):** This task only defined the *shape* of the data. The Assembler (ODD/ASA) must now be updated to actually *generate* the HR module code (backend bricks, frontend pages) based on this shape. This is a separate task (ODD's responsibility in Phase 5).

## 3. Setup Steps
1. Pull the branch `sprint1/btb/hr-sdf-def`.
2. Test generation with a prompt like "Create a system to manage employees and leave requests".

## 4. Test Checklist
- [ ] **AI Generation:**
  1. Send `POST /ai/analyze` with: "I need a system to manage employees, departments, and leave requests."
  2. Verify the output contains:
     - `modules.hr.enabled: true`
     - Entities: `employees`, `departments`, `leaves`
     - `employees` entity has `features.audit_trail: true`

## 5. Expected vs Not Expected
- **Expected:** The AI now "knows" about HR and will suggest the correct structure. The Validator accepts `module: "hr"`.
- **Not Expected:** The *code* for the HR module (employee CRUD logic, leave approval workflow) will NOT be generated yet. The Assembler needs ODD's bricks.

## 6. Known Risks / Follow-up
- **Risk:** Users might expect a working HR system immediately. We must communicate that this only enables the *definition* support.

## 7. Blocked Dependencies
- **ODD:** Can now proceed with "HR backend bricks" (employees, departments, leave/attendance).
- **EA:** Can now proceed with "HR frontend pages".
