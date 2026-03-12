# ODD Update - Mandatory Module Questions + Prefilled SDF Flow

## Scope

Implemented end-to-end platform flow so users answer default module questions before AI analyze, then backend builds a prefilled SDF draft and sends both mandatory answers and prefilled draft to AI gateway as constraints.

Current module coverage:
- Inventory: full-capability question pack loaded from `inventory_module_default_questions_full_capability.md`
- Invoice: temporary core pack (v1-temp)
- HR: temporary core pack (v1-temp)

## Backend changes

### Question-bank and registry
- Added versioned question packs:
  - `platform/backend/src/defaultQuestions/packs/inventory.v1.js`
  - `platform/backend/src/defaultQuestions/packs/invoice.v1.js`
  - `platform/backend/src/defaultQuestions/packs/hr.v1.js`
- Added registry/normalization layer:
  - `platform/backend/src/services/moduleQuestionRegistry.js`

### Questionnaire persistence and state
- Added questionnaire service:
  - `platform/backend/src/services/moduleQuestionnaireService.js`
- Reused existing `questions` and `answers` tables by storing default-question metadata in `questions.options` JSONB.
- Added model helpers:
  - `platform/backend/src/models/Question.js`
    - `findDefaultByProject`
    - `findDefaultByProjectAndModules`
    - `findByProjectAndIds`
  - `platform/backend/src/models/Answer.js`
    - `findLatestByProjectAndQuestionIds`

### Prefilled SDF mapping
- Added:
  - `platform/backend/src/services/prefilledSdfService.js`
- Generates module-aware draft SDF from mandatory answers and completion state.
- Persists draft versions via existing `SDF.create(...)` during answer-save endpoint.

### New project endpoints
- Updated `platform/backend/src/routes/projectRoutes.js`:
  - `GET /api/projects/:id/default-questions`
  - `POST /api/projects/:id/default-questions/answers`
  - `GET /api/projects/:id/default-questions/prefill`
- Updated controller:
  - `platform/backend/src/controllers/projectController.js`
  - Added handlers for endpoints above.
  - Updated `analyzeProject` to enforce mandatory-question completion and pass:
    - `default_question_answers`
    - `prefilled_sdf`

### AI client payload contract
- Updated:
  - `platform/backend/src/services/aiGatewayClient.js`
- Analyze payload now includes default answers + prefilled SDF when available.

## Frontend changes

- Updated project detail flow:
  - `platform/frontend/src/pages/ProjectDetailPage.tsx`
  - Added module selection (inventory/invoice/hr), mandatory questionnaire UI, conditional rendering, answer persistence, completion gate, and prefilled SDF preview.
  - Analyze button now requires mandatory completion and sends module/constraint payload.
- Updated API client:
  - `platform/frontend/src/services/projectService.ts`
  - Added `getDefaultQuestions(...)`, `saveDefaultAnswers(...)`, and extended `analyzeProject(...)`.
- Added types:
  - `platform/frontend/src/types/defaultQuestions.ts`

## AI Gateway changes

- Request contract extended in:
  - `platform/ai-gateway/src/main.py`
  - `platform/ai-gateway/src/services/sdf_service.py`
  - `platform/ai-gateway/src/services/multi_agent_service.py`
  - `platform/ai-gateway/src/prompts/sdf_generation.py`
  - `platform/ai-gateway/src/schemas/multi_agent.py`
- Added pipeline threading for:
  - `default_question_answers`
  - `prefilled_sdf`

## Prompt enforcement updates

- Updated:
  - `platform/ai-gateway/src/prompts/distributor_prompt.txt`
  - `platform/ai-gateway/src/prompts/integrator_prompt.txt`
- Removed reserved-placeholder behavior.
- Added explicit hard-constraint instructions and input sections for mandatory answers + prefilled SDF.

## API contract summary

### Fetch default questions
- `GET /api/projects/:id/default-questions?modules=inventory,invoice,hr`
- Returns:
  - `questions`, `completion`, `mandatory_answers`, `prefilled_sdf`, `template_versions`

### Save default answers
- `POST /api/projects/:id/default-questions/answers`
- Body:
  - `modules: string[]`
  - `answers: [{ question_id, answer }]`
- Returns updated state + refreshed `prefilled_sdf` and persisted `prefilled_sdf_version`.

### Analyze
- `POST /api/projects/:id/analyze`
- Body now supports:
  - `description`
  - `modules`
  - `default_question_answers`
  - `prefilled_sdf`
- Backend blocks analyze if mandatory required answers are incomplete.

## Notes

- No DB migration added in this step (explicitly reused current schema).
- Inventory pack is source-of-truth markdown driven; invoice/hr are intentionally temporary and file-replaceable later.
