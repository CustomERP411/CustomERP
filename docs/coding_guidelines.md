# Coding Guidelines (Repo‑Wide)

This is the default coding guideline for CustomERP. Follow these rules unless ASA approves an exception.

---

## 1) Purpose
- Keep code consistent across teams and layers.
- Avoid merge conflicts and cross‑team breaks.
- Make changes testable, traceable, and reviewable.

---

## 2) Ownership (Default Boundaries)
- **BTB:** `platform/ai-gateway/**`, `SDF_REFERENCE.md`, AI prompts/schemas
- **ODD:** `platform/backend/**`, `brick-library/backend-bricks/**`
- **EA:** `platform/frontend/**`, `brick-library/frontend-bricks/**`
- **ASA:** `platform/assembler/**`, generation wiring/orchestration
- **TE:** tests + docs only (`docs/**`, `test/**`, `platform/**/tests/**`)

**Rule:** Do not edit other owners’ files without explicit approval and coordination.

---

## 3) Do Not Touch (Without ASA Approval)
- `.env`, `.env.example`
- production compose files
- database migrations already committed
- other owners’ folders (see Section 2)

---

## 4) Git Workflow (Required)
1. `git checkout main`
2. `git pull`
3. `git checkout -b sprint1/<initials>/<task>`
4. Work only in your owned paths
5. `git add -A`
6. `git commit -m "<short message>"`
7. `git push -u origin HEAD`
8. Open PR → ASA reviews → merge

**Rules:**
- No direct commits to `main`.
- Keep PRs small and focused (one feature/fix).
- Rebase or merge main only if requested by ASA.
- **One branch per task.** Do not reuse a branch across phases.
- **No shared phase branches.** Each person works in their own branch.
- ASA may create a temporary **integration branch** only for combined testing.

---

## 5) Formatting & Whitespace
- **Indentation:** JS/TS = 2 spaces, Python = 4 spaces, JSON/YAML = 2 spaces.
- **No tabs.** Spaces only.
- **Single quotes** for JS/TS strings; **double quotes** for JSX attributes.
- **Trailing commas** in multiline objects/arrays.
- **Newline at end of file** required.
- Keep lines reasonably short (~100 chars) where practical.

---

## 6) Naming Conventions
- **Classes / React components:** `PascalCase` (e.g., `ProjectAssembler`, `ProjectDetailPage`).
- **Functions / variables (JS/TS):** `camelCase` (e.g., `generateProjectDir`).
- **Functions / variables (Python):** `snake_case` (e.g., `finalize_sdf`).
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`).
- **Types / interfaces:** `PascalCase` (e.g., `Project`, `ClarifyRequest`).
- **SDF slugs:** lowercase `snake_case` (e.g., `stock_movements`).

**File naming:**
- React components: `PascalCase.tsx` (e.g., `ProjectDetailPage.tsx`).
- Hooks: `useThing.ts`.
- Services/controllers: `camelCase.js` / `camelCase.ts`.
- Python files: `snake_case.py`.
- Docs: `snake_case.md` (e.g., `prompt_expectations.md`).

---

## 7) Imports & Module Structure
- Order imports: external → internal absolute → relative.
- Separate groups with a blank line.
- Use `import type` for type‑only imports in TS.
- Avoid deep relative paths when an internal alias exists.

---

## 8) Coding Style (General)
- Follow existing style in the file you edit.
- Prefer small, clear functions over large blocks.
- Avoid duplicating logic across layers.
- Use descriptive variable names; avoid single letters (except loop indices).
- Validate inputs at the boundary (API, AI gateway).

---

## 9) JavaScript / TypeScript
- Prefer `const` and `let`, avoid `var`.
- Use `async/await`; avoid mixed promise chains.
- No silent catch blocks; log or rethrow with context.
- Do not use `any` unless approved; prefer typed interfaces.
- Keep functions pure where possible (minimize hidden side effects).

---

## 10) Frontend (React)
- Use functional components only.
- Keep side effects in `useEffect`.
- Keep state updates immutable.
- Avoid inline style objects; use Tailwind classes.
- UI logic belongs in components; data fetching in services/hooks.
- Platform UI must not include ERP module pages/components. Module UI lives in `brick-library/frontend-bricks/components/modules/<module>` and generator templates.

---

## 11) Backend (Express)
- Controllers validate input and return consistent JSON errors:
  - `{ error: "message" }`
- Services contain business logic; controllers stay thin.
- Do not throw raw errors to the client; map to status codes.
- Log errors with context (request id or route where possible).

---

## 12) Python (AI Gateway)
- Follow PEP8.
- Use type hints for public functions.
- Centralize API calls in `services/`.
- Validate data using Pydantic models.
- Do not return raw exceptions to clients.

---

## 13) Templates and CodeWeaver Rules
- Never edit generated output directly.
- Keep hook markers intact; do not remove or rename them.
- Inject logic through CodeWeaver or generator APIs only.

---

## 14) Testing Expectations
When you change:
- **AI output or SDF rules:** add/adjust AI gateway tests and sample SDFs.
- **Bricks:** add unit tests for the brick behavior.
- **Assembler wiring:** add integration test using sample SDF.
- **Frontend behavior:** add/update UI tests if available.

If you cannot add tests, explain why in the PR.

---

## 15) Documentation Expectations
When you change:
- **SDF schema:** update `SDF_REFERENCE.md`.
- **Architecture or flow:** update `docs/overview.md`.
- **Sprint work:** update `docs/sprint1.md`.
- **New behavior:** add a short usage note in the relevant doc.

---

## 16) Security and Ops
- Never commit secrets or tokens.
- Validate external input at API boundaries.
- Log errors with context (but do not log secrets).
- Coordinate on any dependency updates.

---

## 17) Review & Acceptance
- ASA reviews every PR.
- Include tests run (or explain why not).
- Include relevant doc updates in the PR.

---

## 18) Documentation Merge Policy (Avoid Conflicts)
- **Doc integrator:** TE (ASA oversight).
- Only TE (or ASA) edits:
  - `docs/overview.md`
  - `docs/prompt_expectations.md`
- Everyone else adds change notes in:
  - `docs/overview_updates/<initials>_<YYYYMMDD>_<topic>.md`
- **After-prompt-care files:**
  - One file per prompt in `docs/after_prompt_care/`.
  - Use unique timestamp names to avoid conflicts:
    - `after_prompt_care_YYYYMMDD_HHMM_<initials>.md`
  - Do not edit or rename existing after_prompt_care files in feature branches.
