# Sprint 1 Detailed Blueprint (Backlog + UC‑4)

This document is the low‑level, step‑by‑step blueprint for Sprint 1. It combines:
- **Backlog gaps** needed to complete the Inventory generator, and
- **Sprint 1 tasks** needed to finish UC‑4 with Inventory + Invoice + HR modules.

It is written to be explicit for non‑specialists and precise for implementers.

---

## A) Scope, Goals, and Non‑Goals

### A1) Scope (Sprint 1)
- UC‑3: AI → SDF reliability (final SDF must be usable and in scope).
- UC‑4.1: Inventory generator stability (customization and correctness).
- UC‑7: Export / packaging (job + artifacts tracked).
- UC‑10: Platform logs in DB.
- UC‑4: Multi‑module generation (Inventory + Invoice + HR in one build).
- UC‑4.2: Invoice module generation.
- UC‑4.3: HR module generation.

### A2) Goals (Why this sprint matters)
- **Automatic customization:** ERP output must reflect SDF choices, not generic tables.
- **Reliable AI output:** SDF must be valid, in scope, and consistent with features you already support.
- **Modular generation:** Can generate multiple modules in one build.

### A3) Non‑Goals
- UC‑5 / UC‑6 review/approval UI.
- Changing platform auth or project CRUD.
- Switching the generated ERP data layer to PostgreSQL (still flat‑files).

---

## B) Global Rules (Everyone Must Follow)

These come from `docs/coding_guidelines.md` and must be followed:
- Ownership boundaries by role (BTB/ODD/EA/ASA/TE).
- Git workflow (branch, PR, merge).
- Do‑not‑touch files (`.env`, migrations, other owners’ folders).

If a change needs cross‑owner files, it must be coordinated and merged in order.

**Branching policy (Sprint 1):**
- One branch per task; do not reuse a branch across phases.
- No shared phase branches; each person uses their own branch.
- ASA may create a short‑lived integration branch for combined testing only.

**Docs merge policy (Sprint 1):**
- TE is the doc integrator (ASA oversight).
- Only TE (or ASA) edits `docs/overview.md` and `docs/prompt_expectations.md`.
- Others add notes in `docs/overview_updates/`.
- After‑prompt care files use timestamp naming in `docs/after_prompt_care/`.

---

## C) Architecture Blueprint (Low‑Level)

This section defines **how** we will achieve Sprint 1 goals, including architecture, data contracts, and generation logic. This is the core technical blueprint.

### C1) System Layers (What each layer is responsible for)
1. **AI Gateway (FastAPI)**
   - Converts text → SDF JSON.
   - Enforces schema validity.
   - Never writes code directly.
2. **Platform Backend (Express)**
   - Manages projects, SDF storage, and generation jobs.
   - Calls assembler and returns artifacts.
3. **Assembler (Node.js)**
   - Reads SDF and selects bricks.
   - Injects logic via hooks into templates.
4. **Brick Library**
   - Backend mixins (audit, serial, batch, inventory).
   - Frontend components (DynamicForm, CSV tools, etc.).
   - Module UI components under `frontend-bricks/components/modules/<module>` (invoice/hr/inventory).
5. **Generated ERP**
   - Runs independently (backend + frontend + data files).

### C2) Data Contracts (Strict Interfaces)
**SDF (system definition file)**  
Source of truth for generation. Must follow `SDF_REFERENCE.md`.

**Module specification (new)**
- Each module is defined under `modules` with module‑specific config.
- Example (target shape):
```json
{
  "modules": {
    "inventory": { "enabled": true },
    "invoice": { "enabled": true, "number_prefix": "INV-" },
    "hr": { "enabled": true }
  }
}
```

**Entity specification (existing)**
- Entities remain top‑level in SDF.
- Each entity gets a `module` tag if it belongs to invoice/HR.
- Example:
```json
{ "slug": "invoice", "module": "invoice", "fields": [ ... ] }
```

**Mixin specification (new)**
- Each entity can declare mixins with config:
```json
{
  "mixins": {
    "audit": { "enabled": true, "fields": ["entity", "action", "at"] },
    "serial_tracking": { "enabled": true, "enforce_unique": true }
  }
}
```

### C3) Mixin Architecture (Customization)
**Goal:** Mixins must be configurable and composable.

**Design rules:**
- Built‑in mixins are registered in a **Mixin Registry**.
- Custom mixins can be loaded from:
  - SDF `mixins.custom[]` definitions, OR
  - a project folder (e.g., `project_mixins/`).
- Each mixin defines:
  - `hooks` → which hook points it injects
  - `dependencies` → other mixins required first
  - `config_schema` → validation rules for its config

**Hook ordering algorithm:**
1. Gather all enabled mixins.
2. Resolve dependencies (topological order).
3. Inject hooks in ordered list.
4. Fail if hook marker not found or duplicated.

### C4) Relation Architecture (Entity Links)
**Goal:** No broken references in generated ERP.

Rules:
- Every `reference` field must specify `reference_entity` or resolve by naming rule.
- Generator validates:
  - target entity exists
  - `multiple` matches `_ids` convention
- If invalid, generation stops with a clear error.

### C5) Module Architecture (Multi‑Module Build)
**Goal:** One build, multiple modules, one runtime.

Rules:
- Entities tagged with `module` control grouping.
- Shared entities are declared once and reused.
- Backend routes remain flat (`/api/<entity>`), but frontend UI groups them by module.
- Output layout must be consistent:
```
generated/<project>/
  backend/
    modules/
      inventory/
      invoice/
      hr/
  frontend/
    modules/
      inventory/
      invoice/
      hr/
```

### C6) Generation Pipeline (Assembler)
**Pipeline stages:**
1. **Validate SDF** (schema + relations + mixins)
2. **Compute module map** (which entities belong to which module)
3. **Generate backend**
   - services + controllers per entity
   - apply mixin hooks
4. **Generate frontend**
   - entity pages + module navigation
5. **Package output**
   - docker compose + README

### C7) AI Reliability Architecture
**Goals:**
- AI must produce valid JSON.
- AI must stay within schema.

Pipeline:
1. Prompt → draft SDF
2. Validate → if invalid, request AI repair
3. Clarify → merge answers
4. Finalize → clean SDF and save

### C8) Platform Tracking Architecture
On generation:
- Create `generation_jobs` row.
- Create module rows in `modules`.
- Create artifact rows in `schema_artifacts`.
- Log in `log_entries`.

### C9) Error Handling & Logging Architecture
Rules:
- AI errors → return 400 with clear message.
- Generation errors → return 500 + log context.
- All errors recorded in `log_entries`.

### C10) Testing Architecture
Minimal required tests:
- AI gateway: analyze/clarify/finalize
- Assembler: sample SDFs generate output
- Backend: generation job + artifact recording
- Frontend: module nav renders correctly

---

## D) Target Behavior (How the system should work at end of Sprint 1)

### C1) AI → SDF (UC‑3)
**Input:** Business description + optional clarifications.  
**Output:** A clean, validated SDF that:
- follows `SDF_REFERENCE.md`
- contains `project_name`, `entities[]`, optional `modules`
- includes correct reference relationships

**SDF behavior requirements:**
- if a requirement is unclear, AI must ask clarifying questions
- if a response is out of scope, AI must reject or fix it

### C2) Inventory Generator (UC‑4.1)
**Output:** A generated ERP with:
- inventory wizards (receive/issue/transfer/adjust)
- batch and serial tracking if enabled
- correct relation handling and validations
- CSV import/export, print, labels if enabled

### C3) Multi‑Module Generation (UC‑4)
**Output:** One ERP build containing:
1) Inventory module  
2) Invoice module  
3) HR module  
with a single `docker compose up` and a consistent folder layout.

### C4) Platform Tracking (UC‑7 + UC‑10)
Platform must track:
- generation job status (`generation_jobs`)
- artifacts (`modules`, `schema_artifacts`)
- logs (`log_entries`)

---

## E) Sprint 1 Execution Blueprint (Phase‑by‑Phase)

Each phase lists:
- **Owner**
- **Exact files**
- **Implementation steps**
- **Outputs**
- **Validation**

### Phase 0 — Setup & Process
**Owner:** ASA, TE  
**Files:** `docs/coding_guidelines.md`, `docs/sprint1.md`

Steps:
1. ASA confirms Sprint DoD and review checklist.
2. TE submits `docs/coding_guidelines.md` to supervisor.
3. ASA assigns tasks and locks phase order.

Outputs:
- Finalized coding guideline.
- Sprint order confirmed.

Validation:
- Sprint order and DoD documented in `docs/sprint1.md`.

---

### Phase 1 — AI → SDF Reliability (Blocks all generation)
**Owners:** BTB (AI), ODD (DB)  
**Files:**  
- `platform/ai-gateway/src/services/sdf_service.py`  
- `platform/ai-gateway/src/prompts/*`  
- `platform/ai-gateway/src/schemas/sdf.py`  
- `platform/ai-gateway/tests/*`  
- `platform/backend/src/controllers/projectController.js`  
- `platform/backend/src/models/*` (Question/Answer)

Steps:
1. **Finalize logic**
   - `/ai/finalize` must return a clean, complete SDF.
   - Clarification answers must be merged into final SDF.
2. **Scope guardrails**
   - Reject or repair invalid SDF output.
   - Enforce strict schema using Pydantic.
3. **Persist Q/A in DB**
   - Add Question/Answer models (backend).
   - Store questions + answers on clarify flow.

Outputs:
- Clean final SDF available for generation.
- Clarifications stored in Postgres.

Validation:
- `tests/test_sdf_service.py` passes.
- Manual flow: analyze → clarify → finalize returns valid SDF.

---

### Phase 2 — Inventory Generator Stability (Backlog)
**Owners:** ASA, ODD, BTB, EA  
**Files:**  
- `platform/assembler/*`  
- `brick-library/backend-bricks/mixins/*`  
- `brick-library/backend-bricks/repository/FlatFileProvider.js`  
- `platform/assembler/generators/BackendGenerator.js`

Steps:
1. **Custom mixins**
   - Add support for custom mixins (from SDF or project folder).
   - Define a standard mixin config shape in SDF.
2. **Mixin configuration**
   - Per‑entity mixin parameters (batch rules, serial rules, audit fields).
3. **Hook ordering**
   - Deterministic ordering of hook injections.
4. **Hook validation**
   - Fail if hook marker missing or duplicated.
5. **Relation validation**
   - Validate reference fields before generation.
6. **Confirm SDF features work**
   - `children`, `bulk_actions`, `inventory_ops.quantity_mode`, `quick_actions`.

Outputs:
- Flexible mixin system.
- Valid relations in generated output.

Validation:
- Sample SDFs generate correctly.
- Manual check of feature flags in generated ERP.

---

### Phase 3 — Platform Tracking (UC‑7 + UC‑10)
**Owner:** ODD  
**Files:**  
- `platform/backend/src/models/*`  
- `platform/backend/src/services/*`  
- `platform/backend/src/controllers/projectController.js`

Steps:
1. Store generation jobs in `generation_jobs`.
2. Store module artifacts in `modules` + `schema_artifacts`.
3. Write logs into `log_entries` table.

Outputs:
- API returns job status and artifact metadata.

Validation:
- Trigger generation; confirm job + artifacts recorded in DB.

---

### Phase 4 — Multi‑Module Foundation (UC‑4 Core)
**Owners:** ASA, ODD, EA  
**Files:**  
- `platform/assembler/ProjectAssembler.js`  
- `platform/assembler/generators/BackendGenerator.js`  
- `platform/assembler/generators/FrontendGenerator.js`

Steps:
1. Allow one SDF to specify multiple modules.
2. Prevent duplicate entities/routes across modules.
3. Generate module‑aware navigation.
4. Enforce a stable folder layout per module.

Outputs:
- One build can include Inventory + Invoice + HR.

Validation:
- One `docker compose up` runs a combined ERP.

---

### Phase 5 — Invoice Module (UC‑4.2)
**Owners:** BTB, ODD, EA, ASA  
**Files:**  
- `SDF_REFERENCE.md`  
- `platform/ai-gateway/src/prompts/*`  
- `brick-library/backend-bricks/*`  
- `brick-library/frontend-bricks/*`  
- `platform/assembler/*`

Steps:
1. Define invoice SDF shape.
2. Add backend bricks (invoice totals, statuses, numbering).
3. Add frontend pages (invoice list + line items).
4. Wire generator to use invoice bricks.
5. Add sample SDFs for invoice‑only and invoice+inventory.

Outputs:
- Invoice module generated and functional.

Validation:
- Sample invoice SDF generates ERP and runs.

---

### Phase 6 — HR Module (UC‑4.3)
**Owners:** BTB, ODD, EA  
**Files:**  
- `SDF_REFERENCE.md`  
- `platform/ai-gateway/src/prompts/*`  
- `brick-library/backend-bricks/*`  
- `brick-library/frontend-bricks/*`  
- `platform/assembler/*`

Steps:
1. Define HR SDF shape.
2. Add backend bricks (employees, departments, leave/attendance).
3. Add frontend pages (HR lists + details).
4. Wire generator to use HR bricks.
5. Add sample SDFs for HR‑only and HR+inventory.

Outputs:
- HR module generated and functional.

Validation:
- Sample HR SDF generates ERP and runs.

---

### Phase 7 — Testing & Docs (Parallel after Phase 3)
**Owner:** TE  
**Files:**  
- `test/*`  
- `platform/ai-gateway/tests/*`  
- `docs/*`

Steps:
1. Add unit tests for invoice + HR bricks.
2. Add integration tests for invoice, HR, combined build.
3. Add API tests for new module endpoints.
4. Update docs: test plan + QA checklist + how‑to guide.

Outputs:
- Reproducible test suite.
- Updated docs.

Validation:
- Tests run clean on local environment.

---

## F) Required Deliverables (End of Sprint 1)

1. AI produces clean, validated SDFs.
2. Inventory generator supports flexible mixins and relations.
3. Multi‑module ERP build works.
4. Invoice module generated and runs.
5. HR module generated and runs.
6. Generation jobs + artifacts tracked.
7. Tests and docs updated.

---

## G) Acceptance Checklist

Use this checklist to confirm Sprint 1 is done:
- [ ] `/ai/finalize` returns valid SDF with no out‑of‑scope fields
- [ ] Clarifications stored in DB
- [ ] Custom mixin + config works end‑to‑end
- [ ] Inventory feature flags actually change output
- [ ] Combined build runs with one `docker compose up`
- [ ] Invoice module runs and API responds
- [ ] HR module runs and API responds
- [ ] Generation jobs + artifacts in DB
- [ ] Tests and docs updated

---

## H) References

- `docs/overview.md`
- `docs/prompt_expectations.md`
- `docs/coding_guidelines.md`
- `docs/sprint1.md`
- `UNFINISHED_TASKS.md`
- `NEXT_SPRINT_TASKS.md`
