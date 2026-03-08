# After-Prompt Care: Capability Mixins (Inventory/Invoice/HR)

Date: 2026-03-08  
Author: ODD  
Topic: New backend mixins based on capability research

---

## 1. Prompt Result
- Code/Logic: Added new backend mixins for inventory lifecycle/reservations, invoice lifecycle, and HR status/leave approval.
- Visuals/UI: Not required in this prompt.
- Data/Config: No schema changes; mixins are config-driven via `entity.mixins.<MixinName>`.
- Tests: Not added in this prompt.

## 2. What User Must Add/Prepare
- Code/Logic: If you want strict transitions or duration calculations, set mixin config on entities (see mixin names in overview update).
- Visuals/UI: Not required in this prompt.
- Data/Config: Ensure SDF entities include any optional fields you want the mixins to act on (e.g., status fields, reserved quantities, approval timestamps).
- Tests: TE to add tests for new mixin behavior.

## 3. Setup Steps
- Code/Logic: Pull latest changes on your branch.
- Visuals/UI: Not required in this prompt.
- Data/Config: Use an SDF with `entity.mixins` config to exercise strict transitions.
- Tests: Install Node.js if you plan to run generator tests locally.

## 4. Test Checklist
- Code/Logic: Generate ERP and verify:
  - Inventory entities respect lifecycle/reservation rules when fields are present.
  - Invoice status transitions are enforced when configured.
  - HR leave approval transitions and optional duration field update when configured.
- Visuals/UI: Not required in this prompt.
- Data/Config: Confirm no errors when optional fields are absent.
- Tests: TE-owned mixin tests (unit + integration).

## 5. Expected vs Not Expected
- Code/Logic: Expected optional, config-driven enforcement; not expected new entities or DB migrations.
- Visuals/UI: Not expected in this prompt.
- Data/Config: Expected no schema changes; optional fields can be added later.
- Tests: Not expected in this prompt.

## 6. Known Risks / Follow-up
- Code/Logic: If mixin configs are mis-specified (field names), rules may not trigger.
- Visuals/UI: None.
- Data/Config: Strict transitions are opt-in; defaults remain permissive.
- Tests: Coverage gap until TE adds tests.

## 7. Blocked Dependencies
- Code/Logic: None.
- Visuals/UI: None.
- Data/Config: No dependency unless new fields require BTB schema updates later.
- Tests: TE to add tests when ready.
