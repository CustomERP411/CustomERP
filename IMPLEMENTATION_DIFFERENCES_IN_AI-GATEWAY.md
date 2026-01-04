# Implementation Notes vs. SPRINT_TASKS.md

This document outlines the key differences between the implementation in the `platform/ai-gateway` service and the original plan described in `SPRINT_TASKS.md`.

## D2: Prompt Engineering + SDF Schema

The implementation meets the spirit and goals of the D2 task, but uses more modern and robust techniques better suited for a FastAPI application.

### 1. Schema Definition & Validation

*   **Plan (`SPRINT_TASKS.md`):** Specified the creation of a static `sdf_schema.json` file and a separate `sdf_validator.py` script to perform validation.
*   **Actual Implementation:** Uses Pydantic models (`src/schemas/sdf.py`) as the single source of truth for the data structure. This is the standard and recommended practice for FastAPI.

*   **Rationale:**
    *   **Strong Typing:** Pydantic provides strong typing and excellent editor support (autocompletion, type checking).
    *   **Automatic Validation:** Validation is handled automatically and efficiently by calling `SystemDefinitionFile.model_validate(data)` within the `SDFService`. This is cleaner than maintaining a separate validation script.
    *   **Maintainability:** The schema is defined in one place (the Python models). A script (`scripts/generate_schema.py`) was created to generate the static `sdf_schema.json` file from these models, providing the required artifact for other modules while ensuring a single source of truth.

### 2. Prompt Management

*   **Plan (`SPRINT_TASKS.md`):** Specified `.txt` files for prompts.
*   **Actual Implementation:** This was aligned. The implementation was refactored to use `analyze_prompt.txt` and `clarify_prompt.txt` as requested, with the loading logic handled in `src/prompts/sdf_generation.py`.

### 3. Clarification Logic

*   **Plan (`SPRINT_TASKS.md`):** Included a `clarifications_needed` field in the schema.
*   **Actual Implementation:** This was fully implemented. The Pydantic models were updated to include the `ClarificationQuestion` model, and the `analyze_prompt.txt` was updated to instruct the AI to generate these questions when it encounters ambiguity.
