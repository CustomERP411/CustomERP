# After Prompt Care

## Prompt Result
- Code/Logic: Added backend models and a service to persist clarification questions/answers; analyze/clarify now rewrite question IDs before saving SDF.
- Visuals/UI: Not required in this prompt.
- Data/Config: Uses existing `questions`/`answers` tables with no migration changes.
- Tests: Not required in this prompt.

## What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Ensure local Postgres has `questions` and `answers` tables from `001_initial_schema.sql`.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Start backend API and AI Gateway as usual.
- Visuals/UI: Not required in this prompt.
- Data/Config: Confirm DB env vars are set and the database is reachable.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic: Run analyze then clarify for a project; ensure no API errors are returned.
- Visuals/UI: Confirm clarification questions render with new UUID IDs (no UI changes expected).
- Data/Config: Verify `questions` and `answers` rows are created for the project.
- Tests: Manual flow only; no automated tests added.

## Expected vs Not Expected
- Code/Logic: Expected `clarifications_needed` IDs are UUIDs; not expected legacy `q1`-style IDs in responses.
- Visuals/UI: Expected no UI layout changes; not expected new UI behavior.
- Data/Config: Expected new rows in `questions`/`answers`; not expected schema changes.
- Tests: Expected manual verification only; not expected new automated tests.

## Known Risks / Follow-up
- Code/Logic: If AI returns invalid question objects, inserts may fail; consider stricter validation later.
- Visuals/UI: Not required in this prompt.
- Data/Config: If DB migrations are not applied, inserts will fail; ensure schema is up to date.
- Tests: Add backend tests for clarification persistence in Phase 7.

## Blocked Dependencies
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.
