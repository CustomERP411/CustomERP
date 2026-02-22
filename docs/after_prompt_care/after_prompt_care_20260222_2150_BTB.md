# After-Prompt Care: Generator Validation (Phase 2)

**Date:** 2026-02-22  
**Author:** BTB  
**Topic:** Assembler Hook & Relationship Validation

---

## 1. Prompt Result
- Implemented **Fail-Fast Hook Validation** in `CodeWeaver.js`:
  - Throws an error if a requested hook marker is missing in the template.
  - Throws an error if a hook marker is duplicated (ambiguous injection).
- Implemented **SDF Relationship Validation** in `ProjectAssembler.js` (`_validateSdf`):
  - Checks for duplicate entity slugs.
  - Validates `type: "reference"` fields point to existing entities.
  - Validates `children` configurations (target entity existence + foreign key existence).
- Created reproduction script `platform/assembler/repro_validation.js` to verify validation logic.

## 2. What User Must Add/Prepare
- **No external dependencies** were added.
- **Rebuild:** If running the assembler via Docker, rebuild the `backend` or `assembler` container if they share this code (currently `platform/assembler` is a library used by the backend generator).

## 3. Setup Steps
No special setup required. The validation runs automatically at the start of every generation process.

## 4. Test Checklist
- [ ] **Manual Verify:**
  1. Create a "Bad" SDF with a reference to a non-existent entity.
  2. Run the generator/assembler.
  3. Expect an immediate error: `SDF Validation Error: ... references non-existent entity`.
- [ ] **Manual Verify (Templates):**
  1. Temporarily remove a hook marker (e.g., `// @HOOK: BEFORE_CREATE_VALIDATION`) from `BaseService.js.hbs`.
  2. Run generation for an entity that uses that hook (e.g., one with unique fields).
  3. Expect error: `CodeWeaver Error: Hook point ... not found`.

## 5. Expected vs Not Expected
- **Expected:** The generation process aborts immediately if the SDF is invalid.
- **Not Expected:** Silent failures where code is injected into the wrong place or references break at runtime.

## 6. Known Risks / Follow-up
- **Risk:** Existing "working" SDFs might now fail if they were relying on loose validation (e.g., referencing a missing entity but not actually using the field). This is a feature, not a bug, but might require cleanup of old test data.

## 7. Blocked Dependencies
None.
