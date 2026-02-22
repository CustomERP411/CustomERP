# Mixin Architecture Updates (Phase 2 - ASA)

**Date:** 2026-02-22  
**Author:** Ahmet Selim Alpkirişçi (ASA)  
**Related PR:** sprint1/asa/mixin-architecture

## 1. Custom Mixin Loading
- Added a `MixinRegistry` that can load mixins from:
  - built‑in mixins (`brick-library/backend-bricks/mixins/`)
  - custom mixins (`custom_mixins/` at repo root)
- Mixins can be defined as:
  - plain objects (`{ hooks, methods, dependencies }`)
  - factory functions `(config, context) => ({ hooks, methods, dependencies })`

## 2. Explicit Mixin Config per Entity
- Entities can now specify `mixins` as:
  - an object (`{ AuditMixin: { enabled: true, ... } }`)
  - an array (`["AuditMixin", { name: "MyCustomMixin", ... }]`)
- Explicit mixin config overrides feature‑based defaults.

## 3. Deterministic Ordering + Dependencies
- Mixins are ordered with dependency resolution (topological sort).
- Base order preserved when no dependencies:
  - Inventory → Batch → Serial → Audit → Location.
- Cycles or missing dependencies now throw errors before generation.
