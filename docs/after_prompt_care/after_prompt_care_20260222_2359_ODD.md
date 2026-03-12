# After Prompt Care - ODD (Mandatory Module Questions + Prefilled SDF)

## What was delivered

- Mandatory module questionnaire flow (inventory/invoice/hr) before analyze.
- Backend question template registry with versioned packs.
- Question + answer persistence using existing `questions` and `answers` tables.
- Prefilled SDF draft generation from mandatory answers.
- Analyze gate to block AI call until required/conditional mandatory answers are complete.
- AI gateway contract and prompts updated to consume mandatory answers + prefilled draft as hard constraints.

## Manual validation checklist

1. Open a project detail page.
2. Confirm module selectors appear (`inventory`, `invoice`, `hr`).
3. Confirm default questions load and conditional questions appear based on prerequisite answers.
4. Save answers and confirm prefilled draft appears.
5. Verify Analyze is disabled until required visible questions are completed.
6. Run Analyze and confirm backend does not return "mandatory questions incomplete".
7. Verify AI response still returns SDF and clarification questions.

## Environment notes

- Runtime command validation is limited in this environment because `node` is unavailable (`command not found`).
- Static diagnostics from IDE lints were checked for edited backend/frontend/ai-gateway paths and returned no issues.

## Follow-up guidance

- Replace temporary invoice/hr packs by editing:
  - `platform/backend/src/defaultQuestions/packs/invoice.v1.js`
  - `platform/backend/src/defaultQuestions/packs/hr.v1.js`
- Keep IDs stable where possible to preserve answer continuity.
- If schema-backed questionnaire versioning is later required, current metadata-in-JSONB approach is migration-ready.
