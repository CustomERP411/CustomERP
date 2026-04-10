---
title: After Prompt Care - Preview Deadlock Fix
---

## 1. Prompt Result

- Implemented a generator safeguard in `platform/assembler/ProjectAssembler.js` that automatically relaxes required reference fields when they create bootstrap deadlocks:
  - required self-references (for example `employees.manager_id -> employees`)
  - mutual required references (for example `employees.department_id <-> departments.manager_id`)
- Updated finalize flow in `platform/frontend/src/pages/ProjectDetailPage.tsx` so "finalize" now persists a real SDF snapshot to backend (clears remaining clarifications and saves), instead of only toggling local UI state.
- Added regression coverage:
  - `test/assembler_required_reference_cycles.unit.test.js`

## 2. What User Must Add/Prepare

- Regenerate the ERP artifact for affected projects so the new assembler logic is applied.
- If an existing generated ERP already has strict DB `NOT NULL` constraints from older output, replace it with a freshly generated build.

## 3. Setup Steps

1. From repo root run:
   - `node test/assembler_required_reference_cycles.unit.test.js`
2. Regenerate target ERP:
   - via UI generation flow, or
   - `node test/run_assembler.js <your-sdf.json>`
3. Start generated ERP and verify creation flows for `employees` and `departments`.

## 4. Test Checklist

- [ ] Unit test passes: `node test/assembler_required_reference_cycles.unit.test.js`
- [ ] New ERP generation succeeds with your SDF.
- [ ] In project detail page, finalize action persists (page reload still shows finalized SDF status/questions state).
- [ ] In generated ERP:
  - [ ] Create first department without requiring an existing manager.
  - [ ] Create first employee and assign department.
  - [ ] Edit department to assign manager after employee exists.
- [ ] Download flows still work from preview/project pages.

## 5. Expected vs Not Expected

**Expected**

- Circular required-reference forms no longer block first-record creation.
- At least one side of a mutual required reference becomes optional deterministically.
- Self-required references become optional.

**Not Expected**

- Both sides remaining required in a circular dependency.
- First record creation impossible due empty reference lists.

## 6. Known Risks / Follow-up

- The assembler logs warnings when it relaxes a required reference; this is intentional for traceability.
- If business rules truly require both sides non-null at all times, enforce that with workflow/business logic after bootstrap (not strict first-create schema constraints).

## 7. Blocked Dependencies

Not required in this prompt.
