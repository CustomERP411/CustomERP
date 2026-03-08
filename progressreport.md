**Sprint Progress Report**

| **Sprint Start** | 09/02/2026 |  |  | **Report No** | 1 |
| --- | --- | --- | --- | --- | --- |
| **Sprint End** | 23/02/2026 |  |  |  |  |
| **Project Name** | CustomERP |  |  | **Team No** | 10 |
| **Team Members** | Ahmet Selim Alpkirisci (ASA) | Burak Tan Bilgi (BTB) | Orhan Demir Demiroz (ODD) | Tunc Erdoganlar (TE) | Elkhan Abbasov (EA) |
| **Prepared by** | Ahmet Selim Alpkirisci, Burak Tan Bilgi |  |  |  |  |

**Last Sprint** List what you have accomplished last sprint

- Implemented authentication backend APIs (register, login, token flow). (ODD)
- Built login/register screens and session handling in frontend. (EA)
- Connected baseline AI analyze and clarify flow. (BTB)
- Built dashboard and project listing interface. (EA)
- Implemented project CRUD and project initialization backend flow. (ODD)
- Built initial inventory assembler structure. (ASA)
- Added initial backend generation brick/data-provider setup. (ODD)
- Stabilized local Docker environment. (ASA)

---

**Unfinished Tasks (Backlog)** List things you were supposed to have finished but did not (and why not), partially completed, and tasks you have not started. All unfinished tasks.

Whole-project pending tasks after Sprint 1 (Sprint 1 tasks are listed in **Next Sprint**):

- Build backend endpoint for review summary before approval. (ODD)
- Build review page for schema/module/relation check. (EA)
- Define review checklist and approval criteria. (ASA)
- Connect AI edit flow to review/revision stage. (BTB)
- Separate AI by function into four models (inventory, invoice, hr, module-combiner). (BTB)
- Build routing logic that chooses the correct model(s) from user input. (ASA)
- Prepare clean training data for each AI model. (BTB)
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
- Replace generated ERP flat-file storage with database storage design. (ODD)
- Update generated backend templates to use database repositories instead of flat files. (ODD)
- Update assembler output so generated ERP includes database setup/config. (ASA)
- Plan migration path for already-generated projects from flat-file to database mode. (ASA)
- Implement approve/reject/revise backend workflow. (ODD)
- Implement approve/reject/revise UI with revision history. (EA)
- Prepare release gate for approval workflow readiness. (ASA)
- Prepare continuous regression pack for review+approval flows. (TE)
- Tune AI prompts/guardrails for lower output variance. (BTB)
- Improve backend performance/stability for generation endpoints. (ODD)
- Improve UI behavior for long generation and error states. (EA)
- Run full regression and retest cycle before freeze. (TE)
- Prepare final demo script and delivery checklist. (ASA)
- Research real ERP use-cases for inventory module and define missing capability list. (ASA)
- Research real ERP use-cases for invoice module and define missing capability list. (ASA)
- Research real ERP use-cases for hr module and define missing capability list. (ASA)
- Implement new inventory mixins based on research findings. (ODD)
- Implement new invoice mixins based on research findings. (ODD)
- Implement new hr mixins based on research findings. (ODD)
- Update frontend pages to support new inventory capabilities from mixins. (EA)
- Update frontend pages to support new invoice capabilities from mixins. (EA)
- Update frontend pages to support new hr capabilities from mixins. (EA)
- Prepare regression scenarios for newly added module capabilities. (TE)
- Prepare droplet deployment architecture for platform services. (ASA)
- Configure droplet runtime, reverse proxy, TLS, and domain routing. (ODD)
- Create production deployment pipeline for droplet releases. (ASA)
- Configure production backups and restore checks for droplet environment. (ODD)
- Add production monitoring and alerting for droplet deployment. (ODD)
- Implement one-click "Run ERP" flow in platform without manual download. (EA)
- Build backend orchestration to provision and start generated ERP automatically. (ODD)
- Generate runtime-ready ERP package/image for automatic startup. (ASA)
- Add generated ERP start status and health tracking in platform UI. (EA)
- Add backend lifecycle endpoints for start, stop, and status of generated ERP instances. (ODD)
- Design AI chat mode prompts for feature discussion before build mode. (BTB)
- Implement AI build mode prompts focused on final structured generation output. (BTB)
- Implement mode state management for chat mode and build mode per project session. (ODD)
- Add UI flow for chat mode with explicit "switch to build" confirmation step. (EA)
- Block SDF generation until user completes questions/chat and confirms build mode. (BTB)
- Persist pre-build conversation and decision summary before SDF generation. (ODD)
- Add platform input flow to collect generated ERP user groups and permission requirements. (EA)
- Extend SDF schema to include users, groups, and permission definitions. (BTB)
- Generate backend role/group/permission models and access control logic in ERP output. (ODD)
- Generate ERP admin pages for users, groups, and permission management. (EA)
- Enable runtime creation of users, groups, and permissions inside generated ERP. (ODD)
- Add project delete action with confirmation prompt in platform UI. (EA)
- Implement project soft-delete behavior and hide deleted projects from user lists. (ODD)
- Add account delete action with confirmation prompt in platform UI. (EA)
- Implement account soft-delete behavior and hide linked projects while keeping DB records. (ODD)
- Add admin-only recovery flow for soft-deleted users and projects. (ASA)
- Redesign AI flow so SDF generation runs once after final confirmation. (BTB)
- Add explicit "Generate SDF now" action after chat/questions are completed. (EA)
- Store requirement drafts without triggering repeated SDF generation calls. (ODD)
- Track token usage per project and show cost-control metrics. (ODD)

---

**Next Sprint** List what you plan to do next Sprint. All tasks for the next sprint.

Sprint 1 planned tasks:

- Coordinate sprint task order and blocker removal. (ASA)
- Improve mixin loading and mixin execution order in generator. (ASA)
- Ensure multi-module generation path is integrated and stable. (ASA)
- Keep merge and review discipline across the sprint. (ASA)
- Prepare coding/release checklist updates. (ASA)
- Make final AI step return one clean final SDF. (BTB)
- Add strict invalid-output repair and rejection logic. (BTB)
- Add per-entity mixin settings in backend generation flow. (ODD)
- Implement generation job progress tracking in database. (ODD)
- Save generated module and artifact records in database. (ODD)
- Save runtime logs in database. (ODD)
- Complete backend invoice generation flow. (ODD)
- Complete backend hr generation flow. (ODD)
- Complete frontend invoice generation pages and flow. (EA)
- Complete frontend hr generation pages and flow. (EA)
- Verify combined-module navigation works correctly. (EA)
- Run daily functional checks on main platform flow. (TE)
- Verify generation output for inventory, invoice, hr, and combined modules. (TE)
- Run end-to-end checks from project creation to generated output. (TE)
- Log defects and retest after fixes continuously. (TE)

---

**Risks & Issues** List any problems, dependencies, or risks that may affect you from accomplishing your task

- AI outputs may vary while moving to 4-model strategy. Owner: BTB.
- Sprint 1 delivery can slip if task order is not controlled. Owner: ASA.
- Merge conflicts can slow progress in shared generator files. Owner: ASA.
- Testing can lag if implementation speed is too high. Owner: TE.
- AI and testing cost may rise during repeated runs/training. Owner: BTB.

---

**Milestones and Deliverables** If you need to update the project schedule, state the reason

- No schedule update in this report.

**Date Things to do**

- 24/02/2026 - Sprint 1 completion target
- 10/03/2026 - Sprint 2 completion target
- 24/03/2026 - Sprint 3 completion target
- 07/04/2026 - Sprint 4 completion target
- 21/04/2026 - Sprint 5 completion target
- 29/04/2026 - Demo day

---

**ALL COMPLETED TASKS** List all completed tasks

- Sprint 0 - Authentication backend APIs completed. (ODD)
- Sprint 0 - Login/register screens and session handling completed. (EA)
- Sprint 0 - Dashboard and project listing completed. (EA)
- Sprint 0 - Project CRUD and project initialization backend completed. (ODD)
- Sprint 0 - Baseline AI analyze/clarify flow completed. (BTB)
- Sprint 0 - Initial inventory assembler structure completed. (ASA)
- Sprint 0 - Local Docker setup stabilization completed. (ASA)

Next Sprint Meeting: 03/03/2026 20:00