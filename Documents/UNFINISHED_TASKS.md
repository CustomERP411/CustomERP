# Unfinished Tasks (Direct List)

Scope: finish the inventory module generator and what it needs to run.  
Out of scope for now: UC-6 (Approve/Edit), review/approval UI, schema preview UI.

## UC-3: Generate SDF using Chatbot (AI → SDF)
- [ ] Make `/ai/finalize` merge answers and return a clean, final SDF (not a passthrough).
- [ ] Reject or fix AI outputs that do not follow `SDF_REFERENCE`.
- [ ] Save clarification questions and answers in the database (tables already exist).

## UC-4.1: Generate Inventory Module (core generator + bricks)
- [ ] Allow custom mixins without editing core code (load from SDF or a project folder).
- [ ] Allow mixin settings per entity (e.g., batch rules, serial rules, audit fields).
- [ ] Define mixin order rules so hooks always run in a clear, predictable order.
- [ ] Fail fast if a hook marker is missing or duplicated (avoid silent bad output).
- [ ] Validate relationships before generation (no broken references or bad relations).
- [ ] Confirm all SDF features are supported end-to-end: `children`, `bulk_actions`, `inventory_ops.quantity_mode`, `quick_actions`.

## UC-7: Export Generated BMS (package + artifacts)
- [ ] Create generation job records (use `generation_jobs` for status/progress).
- [ ] Record generated artifacts and their paths (use `modules` + `schema_artifacts`).

## UC-10: View Activity and Error Logs (platform logs)
- [ ] Store platform logs in the DB (use `log_entries`, not console only).

## Cross-cutting (affects UC-1..UC-7): Testing / QA
- [ ] Unit test hook injection (CodeWeaver).
- [ ] Unit test each mixin (audit, batch, serial, location, inventory).
- [ ] Unit test referential integrity in FlatFileProvider.
- [ ] Integration test: sample SDF → generated ERP builds and runs.
- [ ] API tests: analyze / clarify / generate endpoints.
- [ ] UI test: end-to-end inventory generator flow.

## Cross-cutting (affects UC-1..UC-7): Documentation
- [ ] Write a test plan and local test steps.
- [ ] Write test cases for inventory features (wizards, reports, CSV, QR, audit).
- [ ] Write a release QA checklist.
- [ ] Write a short dev guide: how to add a mixin / feature safely.
- [ ] Write a step-by-step “Generate an inventory module” guide.
