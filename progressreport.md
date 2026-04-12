**Sprint Progress Report**

| **Sprint Start** | 10/04/2026 |  |  | **Report No** | 5 |
| --- | --- | --- | --- | --- | --- |
| **Sprint End** | 14/04/2026 |  |  |  |  |
| **Project Name** | CustomERP |  |  | **Team No** | 10 |
| **Team Members** | Ahmet Selim Alpkirisci (ASA) | Burak Tan Bilgi (BTB) | Orhan Demir Demiroz (ODD) | Tunc Erdoganlar (TE) | Elkhan Abbasov (EA) |
| **Prepared by** | Ahmet Selim Alpkirisci |  |  |  |  |

**Last Sprint** List what you have accomplished last sprint

- Design AI chat mode prompts for feature discussion before build mode. (BTB)
- Implement AI build mode prompts focused on final structured generation output. (BTB)
- Block SDF generation until user completes questions/chat and confirms build mode. (BTB)
- Implement mode state management for chat mode and build mode per project session. (ODD)
- Persist pre-build conversation and decision summary before SDF generation. (ODD)
- Add UI flow for chat mode with explicit "switch to build" confirmation step. (EA)
- Add generated ERP start status and health tracking in platform UI. (EA)
- Define review checklist and approval criteria for generated SDF. (ASA)
- Build backend endpoint for review summary before approval. (ODD)
- Implement approve/reject/revise backend workflow with revision tracking. (ODD)
- Connect AI edit flow to review/revision stage so user can request AI corrections. (BTB)
- Build review page for schema/module/relation check. (EA)
- Implement approve/reject/revise UI with revision history display. (EA)
- Prepare release gate for approval workflow readiness. (ASA)
- Add project delete action with confirmation prompt in platform UI. (EA)
- Implement project soft-delete behavior and hide deleted projects from user lists. (ODD)
- Add account delete action with confirmation prompt in platform UI. (EA)
- Implement account soft-delete behavior and hide linked projects while keeping DB records. (ODD)
- Improve backend performance and stability for generation endpoints. (ODD)
- Prepare clean training data for each domain AI model (inventory, invoice, hr). (BTB)
- Begin fine-tuning LoRA adapters for domain-specific models using prepared training data. (BTB)
- Define training data validation criteria and output quality benchmarks. (ASA)
- Prepare droplet deployment architecture for platform services. (ASA)
- Configure droplet runtime, reverse proxy, TLS, and domain routing. (ASA)
- Add platform input flow to collect generated ERP user groups and permission requirements. (EA)
- Extend SDF schema to include users, groups, and permission definitions. (BTB)
- Generate backend role/group/permission models and access control logic in ERP output. (ODD)
- Generate ERP admin pages for users, groups, and permission management. (EA)
- Enable runtime creation of users, groups, and permissions inside generated ERP. (ODD)
- Add admin-only recovery flow for soft-deleted users and projects. (ASA)
- Prepare final demo script and delivery checklist. (ASA)
- Coordinate sprint task order and blocker removal. (ASA)
- Keep merge and review discipline across the sprint. (ASA)
- Test iterative clarifying-question loop end-to-end across single and multi-module projects. (TE)
- Test AI chat mode to build mode transition flow. (TE)
- Test one-click executable packaging on Windows, Mac, and Linux environments. (TE)
- Test SDF review/approve/reject/revise workflow end-to-end. (TE)
- Test project and account soft-delete behavior and list filtering. (TE)
- Run module-capability regression scenarios to verify Sprint 2 and Sprint 3 fixes hold. (TE)
- Prepare continuous regression pack for review+approval flows. (TE)
- Test deployment pipeline and production environment readiness. (TE)
- Test user/group/permission generation and runtime management in generated ERP. (TE)
- Run full regression and retest cycle before freeze. (TE)
- Log defects and retest after fixes continuously. (TE)

---

**Unfinished Tasks (Backlog)** List things you were supposed to have finished but did not (and why not), partially completed, and tasks you have not started. All unfinished tasks.


---

**Next Sprint** List what you plan to do next Sprint. All tasks for the next sprint.

Sprint 5 planned tasks:
**Chatbot Overhaul:**
- Fix chatbot so it is always visible on the bottom right of the platform; remove the separate build/generate switch logic. (ASA)
- Give chatbot full context awareness of all user answers, session actions, and project state so it can help and advise users in real time. (ASA)

**Platform Administration:**
- [[DONE]] Build a platform admin screen to manage platform-level users, roles, and access. (ASA)

**ERP Generation Page UX:**
- Add a loading modal during AI generation and ERP build that blocks interaction until complete; show tick animation on success with auto-close, X animation on error with a close button, and user-friendly error messages instead of technical ones. (ASA)
- Remove group selection from the ERP generation page to reduce user confusion. (ASA)
- Remove entity and functionality display from the ERP generation page to simplify the flow. (ASA)

**Generated ERP Issues:**
- Display company or project name on the top-left header instead of the module name. (ASA)
- Make superadmin account non-deletable. (ASA)
- Improve group permissions UI so that selecting an entity-level checkbox automatically selects all permissions underneath it. (ASA)
- Show the logged-in user's actual name or username on the top right instead of the generic "user" label and avatar icon. (ASA)
- Fix new user login so that newly added users can actually enter the generated ERP, and hide menu items and pages the user does not have access to. (ASA)
- Create default groups on ERP generation: Admin (same privileges as superadmin), module-level admins (inventoryadmin, hradmin, invoiceadmin), and enforce hierarchical authorization so for example an hradmin has control over hr worker groups but not over inventory worker groups. (ASA)

**AI Customizability and Flexibility:**
- Improve generated ERP customizability: loosen strict rules so AI can add new entities, define relations between them, and allow customer-specific naming (e.g. "tires" instead of generic "products"). (ASA)
- Add an unsupported-feature notification flow: when a user requests something the system cannot provide, show a clear message acknowledging the request, explain the limitation, and record the need for future development. (ASA)

**AI Fine-Tuning Data Management:**
- Build an AI fine-tuning data recording and management system: register and record all AI interactions, allow easy review to mark samples as good or bad, edit training pairs, and present them in a user-friendly interface within platform admin or a dedicated tool. (ASA)

**Documentation:**
- Write an SMB owner examples document listing real-world small business types that would use the ERP, what they would need, independent of what the generator currently supports. To be able to use for fine-tuning.(ASA)

**AI Fine-Tuning:**
- Generate fine-tuning training data from recorded platform interactions and domain outputs. (ASA)
- Execute fine-tuning on domain AI models using the generated training data. (ASA)

**Deployment Finalization:**
- Deploy platform to production and link DNS for public access. (ASA)

**Presentation and Documentation:**
- Create the presentation banner. (BTB)
- Update the presentation banner diagram. (BTB)
- Write the test report along with doing any tests the documenting may require. Write the document containing all testing outcomes, coverage, and results. (BTB + TE)

---

**Risks & Issues** List any problems, dependencies, or risks that may affect you from accomplishing your task

- Sprint 5 is a short sprint (4 days) with demo day approaching; all tasks must be completed on time. Owner: ASA.
- DNS propagation may take time after deployment, potentially delaying public access verification. Owner: ASA.
- Fine-tuning quality depends on the volume and diversity of recorded training data from prior sprints. Owner: ASA.
- Test report must cover all sprint cycles comprehensively before demo day. Owner: BTB + TE.
- Large backlog of chatbot, generated ERP fixes, platform admin, and UX improvements remains unaddressed and may affect demo quality if not prioritized in subsequent work. Owner: ASA.
- Generated ERP user/group/permission bugs (new users cannot log in, superadmin deletable, missing default groups) directly impact demo readiness. Owner: ASA.
- AI customizability gaps and strict generation rules limit the variety of ERPs that can be demonstrated. Owner: ASA.

---

**Milestones and Deliverables** If you need to update the project schedule, state the reason

- Schedule updated: Sprint 5 added as final pre-demo sprint for deployment finalization, fine-tuning, presentation materials, and test report.

**Date Things to do**

- 24/02/2026 - Sprint 1 completion target
- 12/03/2026 - Sprint 2 completion target
- 02/04/2026 - Sprint 3 completion target
- 10/04/2026 - Sprint 4 completion target
- 14/04/2026 - Sprint 5 completion target
- 17/04/2026 - Prior Demo to Advisor Dr. Cüneyt Sevgi
- 21/04/2026 - Demo day

---

**ALL COMPLETED TASKS** List all completed tasks

- Sprint 4 - Design AI chat mode prompts for feature discussion before build mode completed. (BTB)
- Sprint 4 - Implement AI build mode prompts focused on final structured generation output completed. (BTB)
- Sprint 4 - Block SDF generation until user completes questions/chat and confirms build mode completed. (BTB)
- Sprint 4 - Implement mode state management for chat mode and build mode per project session completed. (ODD)
- Sprint 4 - Persist pre-build conversation and decision summary before SDF generation completed. (ODD)
- Sprint 4 - Add UI flow for chat mode with explicit "switch to build" confirmation step completed. (EA)
- Sprint 4 - Add generated ERP start status and health tracking in platform UI completed. (EA)
- Sprint 4 - Define review checklist and approval criteria for generated SDF completed. (ASA)
- Sprint 4 - Build backend endpoint for review summary before approval completed. (ODD)
- Sprint 4 - Implement approve/reject/revise backend workflow with revision tracking completed. (ODD)
- Sprint 4 - Connect AI edit flow to review/revision stage so user can request AI corrections completed. (BTB)
- Sprint 4 - Build review page for schema/module/relation check completed. (EA)
- Sprint 4 - Implement approve/reject/revise UI with revision history display completed. (EA)
- Sprint 4 - Prepare release gate for approval workflow readiness completed. (ASA)
- Sprint 4 - Add project delete action with confirmation prompt in platform UI completed. (EA)
- Sprint 4 - Implement project soft-delete behavior and hide deleted projects from user lists completed. (ODD)
- Sprint 4 - Add account delete action with confirmation prompt in platform UI completed. (EA)
- Sprint 4 - Implement account soft-delete behavior and hide linked projects while keeping DB records completed. (ODD)
- Sprint 4 - Improve backend performance and stability for generation endpoints completed. (ODD)
- Sprint 4 - Prepare clean training data for each domain AI model (inventory, invoice, hr) completed. (BTB)
- Sprint 4 - Begin fine-tuning LoRA adapters for domain-specific models using prepared training data completed. (BTB)
- Sprint 4 - Define training data validation criteria and output quality benchmarks completed. (ASA)
- Sprint 4 - Prepare droplet deployment architecture for platform services completed. (ASA)
- Sprint 4 - Configure droplet runtime, reverse proxy, TLS, and domain routing completed. (ODD)
- Sprint 4 - Create production deployment pipeline for droplet releases completed. (ASA)
- Sprint 4 - Configure production backups and restore checks for droplet environment completed. (ODD)
- Sprint 4 - Add production monitoring and alerting for droplet deployment completed. (ODD)
- Sprint 4 - Add platform input flow to collect generated ERP user groups and permission requirements completed. (EA)
- Sprint 4 - Extend SDF schema to include users, groups, and permission definitions completed. (BTB)
- Sprint 4 - Generate backend role/group/permission models and access control logic in ERP output completed. (ODD)
- Sprint 4 - Generate ERP admin pages for users, groups, and permission management completed. (EA)
- Sprint 4 - Enable runtime creation of users, groups, and permissions inside generated ERP completed. (ODD)
- Sprint 4 - Add admin-only recovery flow for soft-deleted users and projects completed. (ASA)
- Sprint 4 - Prepare final demo script and delivery checklist completed. (ASA)
- Sprint 4 - Coordinate sprint task order and blocker removal completed. (ASA)
- Sprint 4 - Keep merge and review discipline across the sprint completed. (ASA)
- Sprint 4 - Test iterative clarifying-question loop end-to-end across single and multi-module projects completed. (TE)
- Sprint 4 - Test AI chat mode to build mode transition flow completed. (TE)
- Sprint 4 - Test one-click executable packaging on Windows, Mac, and Linux environments completed. (TE)
- Sprint 4 - Test SDF review/approve/reject/revise workflow end-to-end completed. (TE)
- Sprint 4 - Test project and account soft-delete behavior and list filtering completed. (TE)
- Sprint 4 - Run module-capability regression scenarios to verify Sprint 2 and Sprint 3 fixes hold completed. (TE)
- Sprint 4 - Prepare continuous regression pack for review+approval flows completed. (TE)
- Sprint 4 - Test deployment pipeline and production environment readiness completed. (TE)
- Sprint 4 - Test user/group/permission generation and runtime management in generated ERP completed. (TE)
- Sprint 4 - Run full regression and retest cycle before freeze completed. (TE)
- Sprint 4 - Log defects and retest after fixes continuously completed. (TE)
- Sprint 3 - Update domain model prompts (HR, Inventory, Invoice) to output clarifying_questions array alongside partial SDF completed. (BTB)
- Sprint 3 - Update Integrator AI to deduplicate, group, and prioritize clarifying questions from all domain models completed. (BTB)
- Sprint 3 - Implement iterative orchestration loop: re-dispatch user answers through Distributor until domain models return empty clarifying_questions completed. (BTB)
- Sprint 3 - Add termination condition logic so pipeline stops when all domain models signal SDF completeness completed. (BTB)
- Sprint 3 - Redesign AI flow so SDF generation runs once after final confirmation of the iterative loop completed. (BTB)
- Sprint 3 - Tune AI prompts and guardrails for lower output variance across loop iterations completed. (BTB)
- Sprint 3 - Implement backend state management for iterative loop: persist partial SDFs, questions, and user answers per cycle completed. (ODD)
- Sprint 3 - Store requirement drafts and conversation deltas without triggering repeated SDF generation calls completed. (ODD)
- Sprint 3 - Track token usage per project per loop cycle and show cost-control metrics completed. (ODD)
- Sprint 3 - Build frontend UI for iterative clarifying questions: display grouped questions, collect answers, show loop progress completed. (EA)
- Sprint 3 - Add explicit "Generate SDF now" action after iterative loop confirms SDF is complete completed. (EA)
- Sprint 3 - Improve UI behavior for long generation waits and error states during loop cycles completed. (EA)
- Sprint 3 - Create AzureOpenAIClient implementing BaseAIClient with token tracking completed. (BTB)
- Sprint 3 - Update config.py + .env.example for multi-provider with per-agent provider selection completed. (BTB)
- Sprint 3 - Add GenerationResult dataclass to base_client.py, update GeminiClient to return token counts completed. (BTB)
- Sprint 3 - Update MultiAgentService._create_client to select provider based on agent config with fallback completed. (BTB)
- Sprint 3 - Create step-by-step Azure OpenAI setup guide (azure_openai_setup_guide.md) completed. (DOC)
- Sprint 3 - Design cross-platform packaging strategy (Node.js + SQLite standalone bundle) completed. (ASA)
- Sprint 3 - Bundle Node.js runtime and SQLite into the generated ERP package (StandalonePackager) completed. (ODD)
- Sprint 3 - Generate platform-specific startup scripts (start.bat, start.sh, start.command) with friendly banners and error handling completed. (ODD)
- Sprint 3 - Build backend orchestration to package, zip, and stream the generated ERP as a download (erpGenerationService) completed. (ODD)
- Sprint 3 - Update assembler output to produce a self-contained standalone package with SQLite backend completed. (ASA)
- Sprint 3 - Add guided download wizard UI with OS auto-detection, post-download instructions, and SMB-friendly explanations completed. (EA)
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

Next Sprint Meeting: 14/04/2026 19:30
