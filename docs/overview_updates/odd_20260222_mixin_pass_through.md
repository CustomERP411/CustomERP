# Phase 2 mixin config pass-through (ODD)

- Assembler now passes `entity.mixins` into generated service constructors via controller templates.
- Services already accept `mixinConfig`; mixins can read per-entity settings when present.
- SDF contract for `entity.mixins` must be defined in schema/prompt docs (BTB).
