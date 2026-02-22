# Phase 2 mixin settings (ODD)

- Proposed per-entity mixin config contract: `entity.mixins.<mixin_name>` (e.g., `entity.mixins.inventory`, `entity.mixins.batch_tracking`).
- Backend bricks updated to read `this.mixinConfig` when present; defaults preserve current behavior.
- **Dependency:** ASA must pass `entity.mixins` into generated services, and BTB must document the config in `SDF_REFERENCE.md`/AI prompts; otherwise config is ignored at runtime.
