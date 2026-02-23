# After-Prompt Care: HR Frontend Pages (Phase 5 - EA)

**Date:** 2026-02-23 23:50  
**Author:** EA  
**Branch:** sprint1/EA/hr-frontend-pages  
**Related Phase:** Sprint 1, Phase 5 — HR Module (UC-4.3)

---

## 1. Prompt Result

### What Was Built
- **HR frontend pages** for three HR entities (employees, departments, leave requests)
- **FrontendGenerator integration** to detect and render HR entities with specialized list pages
- **Module navigation support** (already exists in sidebar, confirmed working)

### Files Created
- `platform/assembler/generators/frontend/hrPages.js`
  - `buildEmployeeListPage()` — card-based employee list with status badges
  - `buildDepartmentListPage()` — department list with location/manager info
  - `buildLeaveListPage()` — leave request list with status/type badges

### Files Modified
- `platform/assembler/generators/FrontendGenerator.js`
  - Added import for HR page builders
  - Added HR entity detection logic (isEmployeeEntity, isDepartmentEntity, isLeaveEntity)
  - Updated list page content selection to use HR-specific builders for HR entities

---

## 2. What User Must Add/Prepare

### Code/Logic
- ODD must complete backend HR bricks (controllers, services, routes) before HR pages can function
- ODD must wire HR module into assembler before generation works end-to-end
- Form pages (create/edit) still use the generic `buildEntityFormPage` — may need HR-specific forms later

### Visuals/UI
- HR list pages are card-based (same pattern as invoices)
- Status badges use semantic colors (green=active/approved, amber=pending/on-leave, red=rejected, slate=terminated)
- Leave type badges use contextual colors (blue=vacation, rose=sick, slate=unpaid)

### Data/Config
- HR entities must be tagged with `module: "hr"` in SDF
- Expected HR entity slugs: `employees`, `departments`, `leaves` (or `leave_requests`)
- HR module config in SDF (`sdf.modules.hr`) is passed to page builders but not yet used — can be extended for work calendar, daily hours, etc.

### Tests
- No tests included in this PR (EA responsibility ends at UI implementation)
- TE must add:
  - Integration test: generate HR module and verify all three entities render
  - UI test: load employee/department/leave list pages and verify cards display correctly
  - Multi-module test: generate HR + inventory + invoice and verify sidebar groups correctly

---

## 3. Setup Steps

### Prerequisites
- BTB must have merged `sprint1/btb/hr-sdf-def` (SDF_REFERENCE.md + AI prompts + sample_sdf_hr.json)
- ODD backend bricks must be ready (Phase 5 parallel work)

### To Test This Branch
1. `git checkout sprint1/EA/hr-frontend-pages`
2. Generate an ERP using `test/sample_sdf_hr.json`:
   ```bash
   node test/run_assembler.js test/sample_sdf_hr.json
   ```
3. Navigate to generated output and run:
   ```bash
   cd generated/techcorp-hr-<timestamp>/frontend
   npm install
   npm run dev
   ```
4. Visit `http://localhost:5173` and verify:
   - Sidebar shows "HR" module group with three entities (Employees, Departments, Leave Requests)
   - Click each entity and verify card-based list pages render with correct fields and badges

---

## 4. Test Checklist

### Code/Logic
- [ ] `platform/assembler/generators/frontend/hrPages.js` exports all three builders
- [ ] FrontendGenerator imports HR page builders correctly
- [ ] HR entity detection logic triggers for `employees`, `departments`, `leaves`/`leave_requests` when `module: "hr"`
- [ ] Non-HR entities still use default `buildEntityListPage` (no regression)

### Visuals/UI
- [ ] Employee cards display: full name, status badge, job title, email, phone, hire date
- [ ] Department cards display: name, location, manager ID
- [ ] Leave cards display: employee ID, status badge, leave type badge, start/end dates, reason
- [ ] Status badges use correct colors (green, amber, red, slate)
- [ ] "New Employee/Department/Leave Request" buttons work (navigate to form page)
- [ ] Empty states show appropriate messaging

### Data/Config
- [ ] `test/sample_sdf_hr.json` generates successfully
- [ ] HR entity routes are created under `/api/employees`, `/api/departments`, `/api/leaves`
- [ ] Multi-module SDF with HR + inventory generates both modules correctly
- [ ] Sidebar groups HR entities under "HR" heading

### Tests
- [ ] TE adds integration test for HR module generation
- [ ] TE adds UI test for HR list pages rendering
- [ ] TE adds multi-module test (HR + inventory + invoice)

---

## 5. Expected vs Not Expected

### Expected (In Scope)
✅ HR list pages render with specialized card layouts  
✅ Status and type badges display correctly  
✅ Sidebar navigation groups HR entities under "HR" module  
✅ HR entities integrate seamlessly with existing multi-module architecture  
✅ Generic form pages work for create/edit (using DynamicForm)  

### Not Expected (Out of Scope)
❌ HR-specific form wizards (multi-step employee onboarding, leave approval workflow)  
❌ HR dashboard with leave balance calculation or employee statistics  
❌ Leave calendar view or time-off approval UI  
❌ Department org chart visualization  
❌ Integration with external HR systems (payroll, time tracking)  
❌ Backend HR business logic (leave approval, balance tracking) — ODD responsibility  

---

## 6. Known Risks / Follow-up

### Risks
1. **Backend dependency:** HR pages will fail if ODD backend bricks are not ready or incomplete
2. **Form limitations:** Generic form page may not handle HR-specific validation (e.g., leave date ranges, salary formatting)
3. **Reference fields:** Employee list shows "manager_id" as raw ID — may need reference lookup later
4. **Missing features:** No leave approval workflow, no employee onboarding wizard

### Follow-up Tasks (Next Sprint or Later)
- [ ] Build HR-specific form wizards (employee onboarding, leave approval)
- [ ] Add HR dashboard (leave balance, headcount by department)
- [ ] Enhance employee/department cards with avatar/photo support
- [ ] Add leave calendar view (month/week view with approval status)
- [ ] Add department org chart visualization (tree or hierarchical view)
- [ ] Add reference field lookup in list pages (show manager name instead of ID)

---

## 7. Blocked Dependencies

### Blocking Other Work
- **ODD (backend bricks):** Cannot test HR pages until backend routes/services are wired
- **ODD (assembler wiring):** Cannot generate HR module until assembler calls backend generator for HR entities
- **BTB (sample SDFs):** Need BTB to add combined sample SDFs (HR+inventory, HR+invoice, all three modules)

### Blocked By
- None (EA work is complete and ready for integration)

---

## Summary for Reviewer (ASA)

**What to merge:**
- `platform/assembler/generators/frontend/hrPages.js` (new file, 3 builders)
- `platform/assembler/generators/FrontendGenerator.js` (updated: import + HR detection + list page selection)

**What to verify before merge:**
- No syntax errors in generated TypeScript/React code
- HR page builders follow same pattern as invoice pages (consistent style)
- Multi-module navigation still works (no regression)

**Next steps after merge:**
- ODD: Wire HR backend bricks into BackendGenerator
- ODD: Complete assembler integration for HR module
- TE: Add integration/UI tests for HR module generation
- BTB: Add multi-module sample SDFs (HR+inventory, HR+invoice, all three)

---

**Status:** Ready for review and merge (pending ODD backend readiness)
