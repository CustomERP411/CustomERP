# Generator Validation Updates (Phase 2 - Early)

**Date:** 2026-02-22  
**Author:** Burak Tan Bilgi (BTB)  
**Related PR:** sprint1/btb/generator-validation

## 1. Fail-Fast Hook Validation
The `CodeWeaver` class now enforces strict hook integrity:
- **Missing Hooks:** If a requested hook (e.g., `BEFORE_CREATE_VALIDATION`) is missing from the template, the generator throws an error immediately. This prevents silent failures where validation logic or mixins are ignored.
- **Duplicate Hooks:** If a hook marker appears more than once, it throws an error to prevent ambiguous injection.

## 2. SDF Relationship Validation
The `ProjectAssembler` now validates the System Definition File (SDF) *before* generation begins:
- **Duplicate Entities:** Ensures every entity slug is unique.
- **Reference Integrity:** Validates that fields with `type: "reference"` (or explicit `reference_entity`) point to entities that actually exist in the SDF.
- **Child Relations:** Validates that embedded `children` configurations point to existing entities and that the child entity contains the specified `foreign_key`.

## 3. Testing
A reproduction script (`platform/assembler/repro_validation.js`) was used to verify that:
- Duplicate entities throw errors.
- Missing reference targets throw errors.
- Invalid child configurations throw errors.
- Missing/Duplicate hooks in templates throw errors.
