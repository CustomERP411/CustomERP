**Sprint Progress Report**

| **Sprint Start** | 09/02/2026                              |                       |                           | **Report No**        | 1                   |
|------------------|-----------------------------------------|-----------------------|---------------------------|----------------------|---------------------|
| **Sprint End**   | 23/02/2026                              |                       |                           |                      |                     |
| **Project Name** | CustomERP                               |                       |                           | **Team No**          | 10                  |
| **Team Members** | Ahmet Selim Alpkirişçi (ASA)            | Burak Tan Bilgi (BTB) | Orhan Demir Demiröz (ODD) | Tunç Erdoğanlar (TE) | Elkhan Abbasov (EA) |
| **Prepared by**  | Ahmet Selim Alpkirişçi, Burak Tan Bilgi |                       |                           |                      |                     |

**[Last Sprint]{.underline}**

**UC-11 & UC-12: Register Account & Login (Authentication Stack)**

- Implemented full stack authentication flow.

- Developed Login/Register UI pages with validation.

- Created AuthContext for client-side session management.

- Implemented JWT-based backend endpoints (Register, Login, Me).

**UC-1: View BMS List (Dashboard & Projects)**

- Developed the main Dashboard Layout with responsive design.

- Implemented Project List view to display user projects.

- Built complete Project CRUD API.

**UC-2: Create New BMS (Project Initialization)**

- Implemented the \"Create New Project\" modal interface.

- Developed backend logic to initialize new ERP projects.

**UC-3: Generate SDF using Chatbot (AI → SDF)**

- Configured Gemini AI connection for natural language processing.

- Implemented the clarification question/answer flow in the backend.

- Established SDF schema validation logic to ensure data integrity.

**UC-4 & UC-4.1: Generate Inventory Module (Assembler Engine)**

- Completed the ERP Assembler engine structure.

- Established Brick library and implemented base bricks.

- Implemented FlatFileProvider and Repository interface.

- Generated functional Inventory module prototype.

**Cross-cutting: Infrastructure & Deployment**

- Finalized Docker and Docker Compose configuration.

- Resolved deployment bugs to ensure system readiness for Milestone-1.

**[Unfinished Tasks (Backlog)]{.underline}**

*Scope: Finish the inventory module generator and what it needs to run.* *Out of scope for now: UC-6 (Approve/Edit), review/approval UI, schema preview UI.*

**Management & Oversight**

- Oversee project progress, conduct code reviews, and manage branch merging (ASA).

**UC-3: Generate SDF using Chatbot (AI → SDF)**

- Make /ai/finalize merge answers and return a clean, final SDF (BTB).

- Reject or fix AI outputs that do not follow SDF_REFERENCE (BTB).

- Save clarification questions and answers in the database (ODD).

**UC-4.1: Generate Inventory Module (Core Generator & Bricks)**

- Allow custom mixins without editing core code (load from SDF or a project folder) (ASA).

- Define mixin order rules so hooks always run in a clear, predictable order (ASA).

- Allow mixin settings per entity (e.g., batch rules, serial rules, audit fields) (ODD).

- Fail fast if a hook marker is missing or duplicated (avoid silent bad output) (BTB).

- Validate relationships before generation (no broken references or bad relations) (BTB).

- Confirm all SDF features are supported end-to-end: children, bulk_actions, etc. (EA).

**UC-7: Export Generated BMS & UC-10: Logs**

- Create generation job records for status/progress tracking (ODD).

- Record generated artifacts and their paths in the database (ODD).

- Store platform logs in the DB instead of console only (ODD).

**Cross-cutting: Testing & QA**

- Unit test hook injection (CodeWeaver) and each mixin (TE).

- Unit test referential integrity in FlatFileProvider (TE).

- Integration test: sample SDF → generated ERP builds and runs (EA).

- API tests: analyze / clarify / generate endpoints (TE).

- UI test: end-to-end inventory generator flow (EA).

**Cross-cutting: Documentation**

- Write a short dev guide: how to add a mixin / feature safely (ASA).

- Write a test plan, release QA checklist, and local test steps (TE).

- Write a step-by-step "Generate an inventory module" guide (TE).

**[Next Sprint Tasks]{.underline}**

Scope: finish UC-4 (Generate ERP System) with three modules: Inventory (UC-4.1), Invoice (UC-4.2), HR (UC-4.3).  
Out of scope for now: UC-6 (Approve/Edit), review/approval UI, schema preview UI. Note: UC-4.1 (Inventory) work is tracked in **Backlog** and is not repeated here.

**UC-4: Generate ERP System (multi-module output)**

- Update AI prompts/schema to output module list and module-specific fields. (BTB)

- Make assembler accept multiple modules in one SDF and generate them in one build. (ASA)

- Handle shared entities/relations across modules (avoid duplicate models/routes). (ODD)

- Generate module-aware navigation and routing (each module visible in UI). (EA)

- Enforce a consistent folder layout per module in output. (ODD)

- Verify combined build runs with one docker compose up. (ASA)

**UC-4.2: Generate Invoice Module**

- Define invoice SDF shape and update SDF_REFERENCE + AI prompts. (BTB)

- Build backend bricks for invoices (totals, statuses, number generation). (ODD)

- Build frontend pages for invoices and line items. (EA)

- Wire invoice module into the generator (routes, services, UI). (ASA)

- Add sample SDFs: invoice-only + invoice+inventory. (BTB)

**UC-4.3: Generate HR Module**

- Define HR SDF shape and update SDF_REFERENCE + AI prompts. (BTB)

- Build backend bricks for HR basics (employees, departments, leave/attendance). (ODD)

- Build frontend pages for HR basics. (EA)

- Wire HR module into the generator (routes, services, UI). (ODD)

- Add sample SDFs: HR-only + HR+inventory. (BTB)

**Cross-cutting: Tests / QA (UC-4)**

- Unit tests for new invoice/HR bricks. (TE)

- Integration tests: generate invoice module + run. (TE)

- Integration tests: generate HR module + run. (TE)

- Integration tests: generate combined modules + run. (TE)

- API tests for invoice and HR module endpoints. (TE)

- UI tests for invoice and HR core flows. (TE)

**Cross-cutting: Documentation (UC-4)**

- Update SDF docs for invoice and HR modules. (BTB)

- Add "How to generate 3 modules" guide (step-by-step). (TE)

- Add UC-4 test plan focused on invoice + HR + combined modules. (TE)

**Process / Governance**

- Submit a coding guideline to the supervisor. (ASA)

- Define a sprint Definition of Done (tests + docs required). (ASA)

- Add a code review checklist for all module changes. (ASA)

- Add a short release checklist for UC-4 demo. (ASA)

**ASA: Coordination responsibilities**

- Keep sprint board updated and assign blockers. (ASA)

- Review/merge PRs and enforce DoD/checklists. (ASA)

- Run weekly integration checks across modules. (ASA)

**[Implementation Guide — Sprint 1 (Backlog + UC-4)]{.underline}**

**Rules for All Phases (to avoid conflicts)**
- **File ownership (default):**
  - BTB: `platform/ai-gateway/**`, `SDF_REFERENCE.md`, AI prompts/schemas.
  - ODD: `platform/backend/**`, backend bricks in `brick-library/backend-bricks/**`.
  - EA: `platform/frontend/**`, frontend bricks in `brick-library/frontend-bricks/**`.
  - ASA: `platform/assembler/**`, generation wiring and orchestration.
  - TE: tests + docs only (`docs/**`, `test/**`, `platform/**/tests/**`).
- **Do not touch (unless ASA approves):**
  - `.env`, `.env.example`, production compose files, or database migrations.
  - Other people’s owned folders listed above.
- **Git workflow (follow this order):**
  1. `git checkout main`
  2. `git pull`
  3. `git checkout -b sprint1/<initials>/<task>`
  4. Work only in your owned paths
  5. `git status`
  6. `git add -A`
  7. `git commit -m "<short message>"`
  8. `git push -u origin HEAD`
  9. Open PR → ASA reviews → merge
- **Coordination rule:** If two tasks require the same file, agree on order and merge one PR before starting the next edit.

**Phase 0 — Setup & process (start first)**
- ASA: Define Sprint DoD, code review checklist, release checklist, and sprint board flow.
- TE: Submit `docs/coding_guidelines.md` to supervisor (this exact file).
- ASA: Assign tasks and lock sprint order.

**Phase 1 — AI → SDF reliability (blocks all module work)**
- BTB: Make `/ai/finalize` merge answers into a clean final SDF.
- BTB: Add SDF scope guardrails (reject/repair invalid outputs).
- ODD: Persist clarification Q/A in DB.
  - **Files to touch:** `platform/ai-gateway/**`, `SDF_REFERENCE.md`, `platform/backend/**`.
  - **Do not touch:** `platform/assembler/**`, `brick-library/**`, `platform/frontend/**`.

**Phase 2 — Inventory generator stability (finish backlog first)**
- ASA: Custom mixin loading (SDF/project folder).
- ASA: Define mixin order rules (deterministic hook order).
- ODD: Add per-entity mixin settings.
- BTB: Hook validation (fail fast on missing/duplicated markers).
- BTB: Relationship validation before generation.
- EA: Verify SDF feature coverage end-to-end (`children`, `bulk_actions`, `inventory_ops.quantity_mode`, `quick_actions`).
  - **Files to touch (by owner):**
    - ASA: `platform/assembler/**`
    - ODD: `brick-library/backend-bricks/**`
    - BTB: `platform/assembler/**` (validation only, coordinate with ASA)
    - EA: test SDFs + generated output only
  - **Do not touch:** `platform/frontend/**` (unless EA needs a fix), AI Gateway (unless BTB is doing AI tasks).

**Phase 3 — Multi-module foundation (UC-4 core)**
- ASA: Enable multi-module generation in assembler.
- ODD: Handle shared entities/relations across modules.
- ODD: Enforce consistent output folder layout per module.
- EA: Module-aware navigation and routing.
- ASA: Verify combined build runs with one `docker compose up`.
  - **Order rule:** ASA → ODD → EA → ASA (merge between each step).
  - **Files to touch:** `platform/assembler/**`, `platform/frontend/**`.
  - **Do not touch:** AI Gateway and backend bricks unless required by assigned owners.

**Phase 4 — Invoice module (UC-4.2)**
- BTB: Define invoice SDF shape + update SDF_REFERENCE + prompts.
- ODD: Build invoice backend bricks (totals, statuses, number generation).
- EA: Build invoice frontend pages (invoices + line items).
- ASA: Wire invoice module into generator.
- BTB: Add invoice-only and invoice+inventory sample SDFs.
  - **Order rule:** BTB → ODD/EA (parallel) → ASA → BTB (sample SDFs).
  - **Files to touch:** `SDF_REFERENCE.md`, `platform/ai-gateway/**`, `brick-library/**`, `platform/assembler/**`, `platform/frontend/**`.

**Phase 5 — HR module (UC-4.3)**
- BTB: Define HR SDF shape + update SDF_REFERENCE + prompts.
- ODD: Build HR backend bricks (employees, departments, leave/attendance).
- EA: Build HR frontend pages.
- ODD: Wire HR module into generator.
- BTB: Add HR-only and HR+inventory sample SDFs.
  - **Order rule:** BTB → ODD/EA (parallel) → ODD → BTB (sample SDFs).
  - **Files to touch:** `SDF_REFERENCE.md`, `platform/ai-gateway/**`, `brick-library/**`, `platform/assembler/**`, `platform/frontend/**`.

**Phase 6 — Testing & docs (run in parallel once Phase 3+ start)**
- TE: Unit tests for new invoice/HR bricks.
- TE: Integration tests (invoice module, HR module, combined build).
- TE: API tests for invoice and HR endpoints.
- TE: UI tests for invoice and HR core flows.
- TE: Test plan, QA checklist, local test steps.
- TE: “How to generate 3 modules” guide.
  - **Files to touch:** `docs/**`, `test/**`, `platform/**/tests/**`.
  - **Do not touch:** core feature code; report failures to owners.

**[Risks & Issues]{.underline}**

- AI Response Consistency: The non-deterministic nature of LLM outputs causes occasional schema validation failures, requiring more robust prompt engineering and error handling in the next sprint.

- Migration Overhead: Transitioning from the MVP\'s flat-file storage to the PostgreSQL database for Increment-2 may require significant refactoring of the current Assembler logic.

- API Cost Management: High volume of testing for the \"Clarification Flow\" is increasing token usage; we need to monitor costs closely to stay within the budget.

**[Milestones and Deliverables]{.underline}**

**[Date]{.underline} [Things to do]{.underline}**

24/02/2026 Sprint 1 Completion

10/03/2026 Sprint 2 Completion

24/03/2026 Sprint 3 Completion

07/04/2026 Sprint 4 Completion

21/04/2026 Sprint 5 Completion

29/04/2026 Demo Day

**[ALL COMPLETED TASKS]{.underline}** List all completed tasks

**[Sprint]{.underline} [Completed Task]{.underline}**

**UC-11 & UC-12: Register Account & Login (Authentication Stack)**

Sprint 0 Implemented full stack authentication flow.

Sprint 0 Developed Login/Register UI pages with validation.

Sprint 0 Created AuthContext for client-side session management.

Sprint 0 Implemented JWT-based backend endpoints (Register, Login, Me).

**UC-1: View BMS List (Dashboard & Projects)**

Sprint 0 Developed the main Dashboard Layout with responsive design.

Sprint 0 Implemented Project List view to display user projects.

Sprint 0 Built complete Project CRUD API.

**UC-2: Create New BMS (Project Initialization)**

Sprint 0 Implemented the \"Create New Project\" modal interface.

Sprint 0 Developed backend logic to initialize new ERP projects.

**UC-3: Generate SDF using Chatbot (AI → SDF)**

Sprint 0 Configured Gemini AI connection for natural language processing.

Sprint 0 Implemented the clarification question/answer flow in the backend.

Sprint 0 Established SDF schema validation logic to ensure data integrity.

**UC-4 & UC-4.1: Generate Inventory Module (Assembler Engine)**

Sprint 0 Completed the ERP Assembler engine structure.

Sprint 0 Established Brick library and implemented base bricks.

Sprint 0 Implemented FlatFileProvider and Repository interface.

Sprint 0 Generated functional Inventory module prototype.

**Cross-cutting: Infrastructure & Deployment**

Sprint 0 Finalized Docker and Docker Compose configuration.

Sprint 0 Resolved deployment bugs to ensure system readiness for Milestone-1.

Next Sprint Meeting: 24/02/2026
