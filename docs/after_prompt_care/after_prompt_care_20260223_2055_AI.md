# After Prompt Care — 20260223_2055

## Prompt Result
- Code/Logic: Enforced module-aware validation (same module or shared), added per-module backend/frontend output layout, and wired module-aware sidebar grouping.
- Visuals/UI: Module grouping is wired in the sidebar but not manually verified in the browser.
- Data/Config: Formalized `entity.module` contract in AI schema/prompts and `SDF_REFERENCE.md`; updated sample SDF with a shared entity.
- Tests: Ran assembler generation and `docker compose up`/`ps`/`down`.

## What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic: `node test/run_assembler.js test/sample_sdf_multi_module.json`
- Visuals/UI: Open the generated ERP and confirm the sidebar groups entities by module when multiple modules are enabled.
- Data/Config: Confirm cross-module references only target `shared` entities.
- Tests:
  - `docker compose up -d`
  - `docker compose ps`
  - `docker compose down`

## Expected vs Not Expected
- Code/Logic: Expected per-module directories under `backend/modules/*` and `frontend/modules/*`; not expected any module-disabled entities to be generated.
- Visuals/UI: Expected module-grouped navigation when multiple modules are enabled; not expected single-module behavior to change.
- Data/Config: Expected `entity.module` to be accepted by schema and prompts; not expected older SDFs without module tags to fail.
- Tests: Expected Docker warning about obsolete compose `version` key; not expected build/runtime failures.

## Known Risks / Follow-up
- Code/Logic: Add automated coverage for module-boundary validation and shared-entity references.
- Visuals/UI: Manually verify module navigation and module page routing in the browser.
- Data/Config: Keep AI prompt examples aligned with the formal `entity.module` contract.
- Tests: Add CI integration tests after Phase 3 wraps.

## Blocked Dependencies
- Code/Logic: None.
- Visuals/UI: None.
- Data/Config: None.
- Tests: None.
