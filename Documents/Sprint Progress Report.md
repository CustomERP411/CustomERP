**Last Sprint**

  

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

- Implemented the "Create New Project" modal interface.
    
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
    

  

  

**Unfinished Tasks (Backlog)**

  

_Scope: Finish the inventory module generator and what it needs to run._ _Out of scope for now: UC-6 (Approve/Edit), review/approval UI, schema preview UI._

  

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
    
- Write a step-by-step “Generate an inventory module” guide (TE).
    

  

  

**Next Sprint Tasks**

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
    
- Add “How to generate 3 modules” guide (step-by-step). (TE)
    
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
    

  

  

**Risks & Issues**

  

- AI Response Consistency: The non-deterministic nature of LLM outputs causes occasional schema validation failures, requiring more robust prompt engineering and error handling in the next sprint.
    
- Migration Overhead: Transitioning from the MVP's flat-file storage to the PostgreSQL database for Increment-2 may require significant refactoring of the current Assembler logic.
    
- API Cost Management: High volume of testing for the "Clarification Flow" is increasing token usage; we need to monitor costs closely to stay within the budget.
    

  

  

**Milestones and Deliverables**

  

**Date** **Things to do**

24/02/2026 Sprint 1 Completion

10/03/2026 Sprint 2 Completion

24/03/2026 Sprint 3 Completion

07/04/2026 Sprint 4 Completion

21/04/2026 Sprint 5 Completion

29/04/2026 Demo Day

  

  

**ALL COMPLETED TASKS** List all completed tasks

  

**Sprint** **Completed Task**

  

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

Sprint 0 Implemented the "Create New Project" modal interface.

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