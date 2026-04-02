**Sprint Progress Report**

| **Sprint Start** | 21/03/2026 |  |  | **Report No** | 3 |
| --- | --- | --- | --- | --- | --- |
| **Sprint End** | 02/04/2026 |  |  |  |  |
| **Project Name** | CustomERP |  |  | **Team No** | 10 |
| **Team Members** | Ahmet Selim Alpkirisci (ASA) | Burak Tan Bilgi (BTB) | Orhan Demir Demiroz (ODD) | Tunc Erdoganlar (TE) | Elkhan Abbasov (EA) |
| **Prepared by** | Ahmet Selim Alpkirisci, Burak Tan Bilgi |  |  |  |  |

**Last Sprint** List what you have accomplished last sprint

- Separate AI by function into five agents (distributor, inventory, invoice, hr, integrator). (BTB)
- Implement backend API usage logic to call the AI gateway and normalize responses. (ODD)
- Implement module-combiner (Integrator AI) call flow for multi-module final SDF assembly. (BTB)
- Define mandatory module question set for inventory that every inventory user must answer before SDF generation. (ASA)
- Define mandatory module question set for invoice that every invoice user must answer before SDF generation. (ASA)
- Define mandatory module question set for hr that every hr user must answer before SDF generation. (ASA)
- Define fixed answer-to-SDF field mapping for mandatory inventory questions. (ASA)
- Define fixed answer-to-SDF field mapping for mandatory invoice questions. (ASA)
- Define fixed answer-to-SDF field mapping for mandatory hr questions. (ASA)
- Build pre-SDF UI flow to ask mandatory module questions and collect answers. (EA)
- Add prefilled SDF draft screen where user can review and edit mandatory fields before AI generation. (EA)
- Save mandatory-question templates, template version, and user answers in database. (ODD)
- Build backend step that manually fills SDF draft from mandatory-question answers before AI call. (ODD)
- Send mandatory answers and prefilled SDF draft to selected SDF generator AI in one structured input. (BTB)
- Validate final AI SDF output against mandatory-question answers so required fields are always generated. (BTB)
- Research real ERP use-cases for inventory module and define missing capability list. (ASA)
- Research real ERP use-cases for invoice module and define missing capability list. (ASA)
- Research real ERP use-cases for hr module and define missing capability list. (ASA)
- Implement new inventory mixins based on research findings. (ODD)
- Implement new invoice mixins based on research findings. (ODD)
- Implement new hr mixins based on research findings. (ODD)
- Update frontend pages to support new inventory capabilities from mixins. (EA)
- Update frontend pages to support new invoice capabilities from mixins. (EA)
- Update frontend pages to support new hr capabilities from mixins. (EA)
- Replace generated ERP flat-file storage with database storage design. (ODD)
- Update generated backend templates to use database repositories instead of flat files. (ODD)
- Update assembler output so generated ERP includes database setup/config. (ASA)
- Run default-question-to-prefilled-SDF flow tests and regression checks. (TE)
- Run module-capability regression scenarios for new mixins/pages. (TE)
- Run generated ERP database-mode verification across inventory, invoice, and hr outputs. (TE)

---

**Unfinished Tasks (Backlog)** List things you were supposed to have finished but did not (and why not), partially completed, and tasks you have not started. All unfinished tasks.

Whole-project pending tasks not included in the Sprint 3 plan (deferred to Sprint 4):

- Prepare droplet deployment architecture for platform services. (ASA)
- Configure droplet runtime, reverse proxy, TLS, and domain routing. (ODD)
- Create production deployment pipeline for droplet releases. (ASA)
- Configure production backups and restore checks for droplet environment. (ODD)
- Add production monitoring and alerting for droplet deployment. (ODD)
- Add platform input flow to collect generated ERP user groups and permission requirements. (EA)
- Extend SDF schema to include users, groups, and permission definitions. (BTB)
- Generate backend role/group/permission models and access control logic in ERP output. (ODD)
- Generate ERP admin pages for users, groups, and permission management. (EA)
- Enable runtime creation of users, groups, and permissions inside generated ERP. (ODD)
- Add admin-only recovery flow for soft-deleted users and projects. (ASA)
- Prepare final demo script and delivery checklist. (ASA)
- Run full regression and retest cycle before freeze. (TE)

---

**Next Sprint** List what you plan to do next Sprint. All tasks for the next sprint.

Sprint 3 planned tasks:

AI Iterative Clarifying-Question Loop (MapReduce-style orchestration):
- [DONE] Update domain model prompts (HR, Inventory, Invoice) to output clarifying_questions array alongside partial SDF — added sdf_complete signal + priority field. (BTB)
- [DONE] Update Integrator AI to deduplicate, group, and prioritize clarifying questions from all domain models — priority sorting + module grouping in _aggregate_clarifications. (BTB)
- [DONE] Implement iterative orchestration loop: re-dispatch user answers through Distributor until domain models return empty clarifying_questions — pipeline re-run with termination check. (BTB)
- [DONE] Add termination condition logic so pipeline stops when all domain models signal SDF completeness — sdf_complete flag in PipelineResult. (BTB)
- [DONE] Redesign AI flow so SDF generation runs once after final confirmation of the iterative loop — explicit "Generate Final SDF" button in frontend. (BTB)
- [DONE] Tune AI prompts and guardrails for lower output variance across loop iterations — iteration guardrails in all domain + integrator prompts. (BTB)
- [DONE] Implement backend state management for iterative loop: persist partial SDFs, questions, and user answers per cycle — cycle tracking in clarificationService + projectController. (ODD)
- [DONE] Store requirement drafts and conversation deltas without triggering repeated SDF generation calls — cycle number tracking, sdf_complete passthrough. (ODD)
- [DONE] Track token usage per project per loop cycle and show cost-control metrics — GenerationResult + token_usage in PipelineResult/API responses. (ODD)
- [DONE] Build frontend UI for iterative clarifying questions: display grouped questions, collect answers, show loop progress — ClarificationQuestions grouped by module with priority badges + round counter. (EA)
- [DONE] Add explicit "Generate SDF now" action after iterative loop confirms SDF is complete — finalize button + skip link in ClarificationQuestions. (EA)
- [DONE] Improve UI behavior for long generation waits and error states during loop cycles — split running flags, phased progress text, extended timeouts. (EA)

Multi-Provider AI Architecture (Azure OpenAI primary, Gemini fallback):
- [DONE] Create AzureOpenAIClient implementing BaseAIClient with token tracking. (BTB)
- [DONE] Update config.py + .env.example for multi-provider with per-agent provider selection. (BTB)
- [DONE] Add GenerationResult dataclass to base_client.py, update GeminiClient to return token counts. (BTB)
- [DONE] Update MultiAgentService._create_client to select provider based on agent config with fallback. (BTB)
- [DONE] Create step-by-step Azure OpenAI setup guide (azure_openai_setup_guide.md) including fine-tuning roadmap. (DOC)

AI Chat Mode and Build Mode:
- Design AI chat mode prompts for feature discussion before build mode. (BTB)
- Implement AI build mode prompts focused on final structured generation output. (BTB)
- Block SDF generation until user completes questions/chat and confirms build mode. (BTB)
- Implement mode state management for chat mode and build mode per project session. (ODD)
- Persist pre-build conversation and decision summary before SDF generation. (ODD)
- Add UI flow for chat mode with explicit "switch to build" confirmation step. (EA)

One-Click Executable ERP (cross-platform, no Docker required):
- DONE: Design cross-platform packaging strategy (Node.js + SQLite standalone bundle). (ASA)
- DONE: Bundle Node.js runtime and SQLite into the generated ERP package (StandalonePackager). (ODD)
- DONE: Generate platform-specific startup scripts (start.bat, start.sh, start.command) with friendly banners and error handling. (ODD)
- DONE: Build backend orchestration to package, zip, and stream the generated ERP as a download (erpGenerationService). (ODD)
- DONE: Update assembler output to produce a self-contained standalone package with SQLite backend. (ASA)
- DONE: Add guided download wizard UI with OS auto-detection, post-download instructions, and SMB-friendly explanations. (EA)
- Add generated ERP start status and health tracking in platform UI. (EA)

SDF Review and Approval Workflow:
- Define review checklist and approval criteria for generated SDF. (ASA)
- Build backend endpoint for review summary before approval. (ODD)
- Implement approve/reject/revise backend workflow with revision tracking. (ODD)
- Connect AI edit flow to review/revision stage so user can request AI corrections. (BTB)
- Build review page for schema/module/relation check. (EA)
- Implement approve/reject/revise UI with revision history display. (EA)
- Prepare release gate for approval workflow readiness. (ASA)

Project and Account Management:
- Add project delete action with confirmation prompt in platform UI. (EA)
- Implement project soft-delete behavior and hide deleted projects from user lists. (ODD)
- Add account delete action with confirmation prompt in platform UI. (EA)
- Implement account soft-delete behavior and hide linked projects while keeping DB records. (ODD)
- Improve backend performance and stability for generation endpoints. (ODD)

AI Fine-Tuning Preparation:
- Prepare clean training data for each domain AI model (inventory, invoice, hr). (BTB)
- Begin fine-tuning LoRA adapters for domain-specific models using prepared training data. (BTB)
- Define training data validation criteria and output quality benchmarks. (ASA)

Sprint Coordination and Testing:
- Coordinate sprint task order and blocker removal. (ASA)
- Keep merge and review discipline across the sprint. (ASA)
- Test iterative clarifying-question loop end-to-end across single and multi-module projects. (TE)
- Test AI chat mode to build mode transition flow. (TE)
- Test one-click executable packaging on Windows, Mac, and Linux environments. (TE)
- Test SDF review/approve/reject/revise workflow end-to-end. (TE)
- Test project and account soft-delete behavior and list filtering. (TE)
- Run module-capability regression scenarios to verify Sprint 2 fixes hold. (TE)
- Prepare continuous regression pack for review+approval flows. (TE)
- Log defects and retest after fixes continuously. (TE)

---

**Risks & Issues** List any problems, dependencies, or risks that may affect you from accomplishing your task

- Iterative AI loop may increase token cost per project; need early cost tracking. Owner: BTB.
- Cross-platform packaging without Docker adds complexity for bundling runtimes. Owner: ODD.
- LoRA fine-tuning quality depends on training data volume and diversity. Owner: BTB.
- Loop termination heuristics may need tuning if domain models produce excessive questions. Owner: BTB.
- Sprint 3 is heavily loaded; task prioritization and daily check-ins are critical. Owner: ASA.
- Testing cross-platform executables requires access to all three OS environments. Owner: TE.
- Review/approval workflow depends on iterative loop being stable; sequence matters. Owner: ASA.
- Chat mode and build mode add UX complexity that must not block the core generation flow. Owner: EA.

---

**Milestones and Deliverables** If you need to update the project schedule, state the reason

- Schedule updated: consolidated from 5 sprints to 4 sprints. Sprint 5 removed; Sprint 4 is now the final sprint before demo day.

**Date Things to do**

- 24/02/2026 - Sprint 1 completion target
- 12/03/2026 - Sprint 2 completion target
- 02/04/2026 - Sprint 3 completion target
- 21/04/2026 - Sprint 4 completion target
- 29/04/2026 - Demo day

---

**ALL COMPLETED TASKS** List all completed tasks

- Sprint 2 - Separate AI by function into five agents (distributor, inventory, invoice, hr, integrator) completed. (BTB)
- Sprint 2 - Build routing logic (Distributor AI) that chooses the correct model(s) from user input completed. (ASA)
- Sprint 2 - Implement backend API usage logic to call the AI gateway and normalize responses completed. (ODD)
- Sprint 2 - Implement module-combiner (Integrator AI) call flow for multi-module final SDF assembly completed. (BTB)
- Sprint 2 - Define mandatory module question set for inventory completed. (ASA)
- Sprint 2 - Define mandatory module question set for invoice completed. (ASA)
- Sprint 2 - Define mandatory module question set for hr completed. (ASA)
- Sprint 2 - Define fixed answer-to-SDF field mapping for mandatory inventory questions completed. (ASA)
- Sprint 2 - Define fixed answer-to-SDF field mapping for mandatory invoice questions completed. (ASA)
- Sprint 2 - Define fixed answer-to-SDF field mapping for mandatory hr questions completed. (ASA)
- Sprint 2 - Build pre-SDF UI flow to ask mandatory module questions and collect answers completed. (EA)
- Sprint 2 - Add prefilled SDF draft screen where user can review and edit mandatory fields before AI generation completed. (EA)
- Sprint 2 - Save mandatory-question templates, template version, and user answers in database completed. (ODD)
- Sprint 2 - Build backend step that manually fills SDF draft from mandatory-question answers before AI call completed. (ODD)
- Sprint 2 - Send mandatory answers and prefilled SDF draft to selected SDF generator AI in one structured input completed. (BTB)
- Sprint 2 - Validate final AI SDF output against mandatory-question answers so required fields are always generated completed. (BTB)
- Sprint 2 - Research real ERP use-cases for inventory module and define missing capability list completed. (ASA)
- Sprint 2 - Research real ERP use-cases for invoice module and define missing capability list completed. (ASA)
- Sprint 2 - Research real ERP use-cases for hr module and define missing capability list completed. (ASA)
- Sprint 2 - Implement new inventory mixins based on research findings completed. (ODD)
- Sprint 2 - Implement new invoice mixins based on research findings completed. (ODD)
- Sprint 2 - Implement new hr mixins based on research findings completed. (ODD)
- Sprint 2 - Update frontend pages to support new inventory capabilities from mixins completed. (EA)
- Sprint 2 - Update frontend pages to support new invoice capabilities from mixins completed. (EA)
- Sprint 2 - Update frontend pages to support new hr capabilities from mixins completed. (EA)
- Sprint 2 - Replace generated ERP flat-file storage with database storage design completed. (ODD)
- Sprint 2 - Update generated backend templates to use database repositories instead of flat files completed. (ODD)
- Sprint 2 - Update assembler output so generated ERP includes database setup/config completed. (ASA)
- Sprint 2 - Robustness overhaul: fix prefilledSdfService entity generation for all modules completed. (ASA)
- Sprint 2 - Robustness overhaul: fix race conditions and transactional safety in mixins completed. (ODD)
- Sprint 2 - Robustness overhaul: add configurable field names and remove hardcoded values in mixins completed. (ODD)
- Sprint 2 - Robustness overhaul: update question packs with sdf_impact_notes and capability docs completed. (ASA)
- Sprint 2 - Run default-question-to-prefilled-SDF flow tests and regression checks completed. (TE)
- Sprint 2 - Run module-capability regression scenarios for new mixins/pages completed. (TE)
- Sprint 2 - Run generated ERP database-mode verification across inventory, invoice, and hr outputs completed. (TE)
- Sprint 1 - Coordinate sprint task order and blocker removal completed. (ASA)
- Sprint 1 - Improve mixin loading and mixin execution order in generator completed. (ASA)
- Sprint 1 - Ensure multi-module generation path integration and stability completed. (ASA)
- Sprint 1 - Merge and review discipline tasks completed. (ASA)
- Sprint 1 - Coding/release checklist updates completed. (ASA)
- Sprint 1 - Final AI step now returns one clean final SDF completed. (BTB)
- Sprint 1 - Strict invalid-output repair and rejection logic completed. (BTB)
- Sprint 1 - Per-entity mixin settings in backend generation flow completed. (ODD)
- Sprint 1 - Generation job progress tracking in database completed. (ODD)
- Sprint 1 - Generated module and artifact records saved in database completed. (ODD)
- Sprint 1 - Runtime logs persistence in database completed. (ODD)
- Sprint 1 - Backend invoice generation flow completed. (ODD)
- Sprint 1 - Backend hr generation flow completed. (ODD)
- Sprint 1 - Frontend invoice generation pages and flow completed. (EA)
- Sprint 1 - Frontend hr generation pages and flow completed. (EA)
- Sprint 1 - Combined-module navigation verification completed. (EA)
- Sprint 1 - Daily functional checks on main platform flow completed. (TE)
- Sprint 1 - Generation output verification for inventory, invoice, hr, and combined modules completed. (TE)
- Sprint 1 - End-to-end checks from project creation to generated output completed. (TE)
- Sprint 1 - Continuous defect logging and retesting completed. (TE)
- Sprint 0 - Authentication backend APIs completed. (ODD)
- Sprint 0 - Login/register screens and session handling completed. (EA)
- Sprint 0 - Dashboard and project listing completed. (EA)
- Sprint 0 - Project CRUD and project initialization backend completed. (ODD)
- Sprint 0 - Baseline AI analyze/clarify flow completed. (BTB)
- Sprint 0 - Initial inventory assembler structure completed. (ASA)
- Sprint 0 - Local Docker setup stabilization completed. (ASA)

Next Sprint Meeting: 09/04/2026 18:30
