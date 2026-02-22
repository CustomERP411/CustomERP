# After Prompt Care — 20260222_2315

## Prompt Result
- Code/Logic: Restored `mixinConfig` in the backend controller render context so generated controllers pass `entity.mixins` into services.
- Visuals/UI: Not required in this prompt.
- Data/Config: `entity.mixins` remains optional; defaults preserve existing behavior when absent.
- Tests: Run the assembler sanity test and a mixin-config generation run.

## What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Provide an SDF with `entity.mixins` to verify per‑entity settings end‑to‑end.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic: Confirm generated controllers contain `new <Entity>Service(repo, <config>)`.
- Visuals/UI: Not required in this prompt.
- Data/Config: Generate with one `entity.mixins` config and verify mixin logic reads it.
- Tests: `node test/run_assembler.js` and `node test/run_assembler.js <path-to-mixin-sdf>`.

## Expected vs Not Expected
- Code/Logic: Expected per‑entity mixin config to be passed into services; not expected any behavior change without `entity.mixins`.
- Visuals/UI: Expected no UI changes; not expected new UI behavior.
- Data/Config: Expected config to be optional; not expected schema changes in this prompt.
- Tests: Expected only the assembler sanity check and mixin-config run; not expected automated coverage changes.

## Known Risks / Follow‑up
- Code/Logic: If other template placeholders are missing in render context, they will remain as literals; keep controller/service templates in sync with render context.
- Visuals/UI: Not required in this prompt.
- Data/Config: Align `entity.mixins` contract with BTB schema/prompt updates.
- Tests: Add automated tests for mixin config once schema and assembler are stable.

## Blocked Dependencies
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: BTB must finalize `entity.mixins` contract in schema/prompt docs.
- Tests: Not required in this prompt.
# After Prompt Care — 20260222_2315

## Prompt Result
- Code/Logic: Restored `mixinConfig` in the backend controller render context so generated controllers pass `entity.mixins` into services.
- Visuals/UI: Not required in this prompt.
- Data/Config: `entity.mixins` remains optional; defaults preserve existing behavior when absent.
- Tests: Ran the assembler sanity test (`node test/run_assembler.js`).

## What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Provide an SDF with `entity.mixins` if you want to verify per‑entity settings end‑to‑end.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic: Confirm generated controllers contain `new <Entity>Service(repo, <config>)`.
- Visuals/UI: Not required in this prompt.
- Data/Config: Generate with one `entity.mixins` config and verify mixin logic reads it.
- Tests: `node test/run_assembler.js` (already run here).

## Expected vs Not Expected
- Code/Logic: Expected per‑entity mixin config to be passed into services; not expected any behavior change without `entity.mixins`.
- Visuals/UI: Expected no UI changes; not expected new UI behavior.
- Data/Config: Expected config to be optional; not expected schema changes in this prompt.
- Tests: Expected only the assembler sanity check; not expected automated coverage changes.

## Known Risks / Follow‑up
- Code/Logic: If other template placeholders are missing in render context, they will remain as literals; keep controller/service templates in sync with render context.
- Visuals/UI: Not required in this prompt.
- Data/Config: Align `entity.mixins` contract with BTB schema/prompt updates.
- Tests: Add automated tests for mixin config once schema and assembler are stable.

## Blocked Dependencies
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: BTB must finalize `entity.mixins` contract in schema/prompt docs.
- Tests: Not required in this prompt.
