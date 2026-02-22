# Prompt Expectations (CustomERP)

This document defines how the AI assistant should behave for CustomERP. It is the default policy for all prompts unless the user explicitly overrides it.

---

## 1) Always‑Available Context
Assume these documents are present and authoritative:
- `docs/overview.md`
- `docs/prompt_expectations.md`
- `docs/coding_guidelines.md`
- `SDF_REFERENCE.md`
- `Blueprint.md`
- `FUNCTIONAL_SCOPE.md`
- `UNFINISHED_TASKS.md`
- `NEXT_SPRINT_TASKS.md`
- `README.md`

If a request conflicts with these documents, explain the conflict and follow the documented scope unless the user overrides it.

---

## 2) Core Principles

1. **Assembly over generation**  
   The AI must not directly invent production code for modules. It must use the assembler + brick library model.

2. **Strict separation of concerns**  
   Platform (project management + AI orchestration) must stay separate from generated ERP output.

3. **SDF is the source of truth**  
   Any ERP output must be derived from a valid SDF that conforms to `SDF_REFERENCE.md`.

4. **Determinism and traceability**  
   Changes must be testable, repeatable, and recorded (docs + tests + sample SDFs).

---

## 3) Prompt Types

### Planning prompts
- Provide a concrete, ordered plan.
- Call out dependencies and missing inputs.
- Do not perform code changes unless asked.

### Build/implementation prompts
You MUST:
- Implement changes in the correct layer (AI gateway, assembler, bricks, or platform).
- Update docs and tests relevant to the change.
- State what you changed and where.
- Create an after‑prompt care file (see Section 11).

---

## 4) SDF Output Rules

When generating or editing an SDF:
- Output **valid JSON only** (no commentary).
- Conform strictly to `SDF_REFERENCE.md`.
- Use correct naming rules:
  - `slug`: lowercase snake_case (e.g., `products`, `stock_movements`)
  - reference fields should include `reference_entity`
- If requirements are unclear:
  - generate clarification questions rather than guessing
  - avoid inventing entities/fields that are not in the description

Required top‑level keys:
- `project_name`
- `entities[]`
- `modules` (when module features are needed)

---

## 5) AI Gateway Expectations

If changes affect SDF or AI behavior:
- Update AI prompts in `platform/ai-gateway/src/prompts/`.
- Update validation models in `platform/ai-gateway/src/schemas/`.
- Ensure `/ai/finalize` returns a complete, clean SDF.
- Add or update tests in `platform/ai-gateway/tests/`.

Do not allow outputs outside the SDF schema. Repair or reject invalid JSON.

---

## 6) Assembler & Brick Expectations

When adding features:
- Add or update bricks first.
- Update generators to wire bricks from SDF.
- Keep `CodeWeaver` hook usage consistent (no ad‑hoc string edits).
- Ensure output remains deterministic across runs.

If a new SDF field is added:
- Update `SDF_REFERENCE.md`.
- Add sample SDFs under `test/`.

---

## 7) Platform Backend/Frontend Expectations

Platform code should:
- Store SDFs and clarification data in Postgres.
- Track generation jobs and artifacts.
- Provide clear error messages and status updates.

Frontend should:
- Stay within current scope (no review/approval UI unless requested).
- Be driven by SDF metadata where possible.

---

## 8) Testing Expectations

Any change that affects generation or SDF must include:
- unit tests where possible
- integration tests using sample SDFs
- updated test documentation (what to run, expected output)

If tests cannot be added, explicitly explain why and document the gap.

---

## 9) Documentation Expectations

When behavior changes:
- Update `docs/overview.md` if architecture or flow changes.
- Update `SDF_REFERENCE.md` for schema changes.
- Keep backlog and sprint docs consistent with new scope.

Documentation should be direct, testable, and written for non‑engineers.

---

## 10) Safety Rules

- Do not edit `.env` or include secrets.
- Do not remove existing functionality unless explicitly requested.
- Do not expand scope (UC‑5/UC‑6) unless requested.
- Follow the branch rules in `docs/coding_guidelines.md` (one branch per task, no shared phase branches).

---

## 11) Default Output Format for Responses

For build prompts:
- Brief explanation of what changed and why.
- List of files created/updated.
- Suggested tests (if any).

For planning prompts:
- Structured plan with dependencies and owners if requested.

---

## 12) After‑Prompt Care File (Mandatory for Build Prompts)

When the prompt is a **build/implementation** request, you MUST:

1. Create exactly one new markdown file under `docs/after_prompt_care/`.
2. Use unique timestamp naming to avoid merge conflicts:
   - `after_prompt_care_YYYYMMDD_HHMM_<initials>.md`
3. Do not edit or rename existing after_prompt_care files in feature branches.
4. The file must describe what the user must do after the prompt to validate and complete the result.

### Required Sections in every file
1. **Prompt Result**
2. **What User Must Add/Prepare**
3. **Setup Steps**
4. **Test Checklist**
5. **Expected vs Not Expected**
6. **Known Risks / Follow‑up**
7. **Blocked Dependencies** (if any)

### Cross‑discipline coverage rule
Each file must explicitly cover:
- Code/Logic
- Visuals/UI
- Data/Config
- Tests

If a section is not required, write: `Not required in this prompt.`
