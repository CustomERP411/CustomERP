# After Prompt Care

## Prompt Result
- Code/Logic: Assembler passes `entity.mixins` into generated services via controller template; services receive `mixinConfig`.
- Visuals/UI: Not required in this prompt.
- Data/Config: Requires SDF to include `entity.mixins` to activate per-entity settings.
- Tests: Not required in this prompt.

## What User Must Add/Prepare
- Code/Logic: Ensure generated controllers are rebuilt from updated templates.
- Visuals/UI: Not required in this prompt.
- Data/Config: Provide an SDF with `entity.mixins` once BTB finalizes the contract.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Regenerate a sample ERP after pulling these changes.
- Visuals/UI: Not required in this prompt.
- Data/Config: Confirm SDF includes `entity.mixins` with expected keys.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic: Validate generated services contain `this.mixinConfig` and receive the config.
- Visuals/UI: Not required in this prompt.
- Data/Config: Test one entity with non-default mixin config (e.g., allow_negative).
- Tests: Manual verification only.

## Expected vs Not Expected
- Code/Logic: Expected mixin config available at runtime; not expected behavior change without `entity.mixins`.
- Visuals/UI: Expected no UI changes; not expected new UI behavior.
- Data/Config: Expected config to be optional; not expected schema changes in this prompt.
- Tests: Expected manual checks only; not expected automated tests.

## Known Risks / Follow-up
- Code/Logic: If controller template changes are not regenerated, services won't receive config.
- Visuals/UI: Not required in this prompt.
- Data/Config: Contract for `entity.mixins` must be aligned with BTB schema/prompt updates.
- Tests: Add automated tests once assembler and schema are stabilized.

## Blocked Dependencies
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: BTB must finalize `entity.mixins` contract in schema/prompt docs.
- Tests: Not required in this prompt.
