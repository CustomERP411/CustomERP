# After Prompt Care

## Prompt Result
- Code/Logic: Backend brick mixins now read optional `this.mixinConfig` for per-entity settings; defaults preserve existing behavior.
- Visuals/UI: Not required in this prompt.
- Data/Config: Requires assembler to pass `entity.mixins` into generated service constructors to take effect.
- Tests: Not required in this prompt.

## What User Must Add/Prepare
- Code/Logic: ASA must wire `entity.mixins` into service construction; BTB must document the config in `SDF_REFERENCE.md` and prompts.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Regenerate a sample ERP once assembler pass-through is implemented.
- Visuals/UI: Not required in this prompt.
- Data/Config: Provide an SDF with `entity.mixins` config once BTB updates schema/docs.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic: Verify mixin defaults match previous behavior when no config is provided.
- Visuals/UI: Not required in this prompt.
- Data/Config: Test one SDF with custom mixin config values (e.g., allow_negative).
- Tests: Manual verification only once assembler passes config.

## Expected vs Not Expected
- Code/Logic: Expected no behavior change without mixin config; not expected runtime changes until assembler pass-through is done.
- Visuals/UI: Expected no UI changes; not expected UI updates.
- Data/Config: Expected `entity.mixins` to be ignored until schema and assembler pass-through are in place.
- Tests: Expected manual tests only; not expected automated coverage yet.

## Known Risks / Follow-up
- Code/Logic: If assembler never passes mixin config, settings will be ignored; coordinate with ASA.
- Visuals/UI: Not required in this prompt.
- Data/Config: Config shape is not in `SDF_REFERENCE.md` yet; coordinate with BTB.
- Tests: Add unit tests for mixin config behavior after assembler wiring.

## Blocked Dependencies
- Code/Logic: ASA must pass `entity.mixins` into generated service constructors.
- Visuals/UI: Not required in this prompt.
- Data/Config: BTB must define the schema/prompt shape for mixin config.
- Tests: Not required in this prompt.
