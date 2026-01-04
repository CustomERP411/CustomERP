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

## D4: Error Handling + Retry Logic

The implementation follows the spirit of the D4 task but uses a more modular design by separating concerns between the API client and the application service.

*   **Plan (`SPRINT_TASKS.md`):** Suggested a single `analyze_with_retry` function that would handle API retries, JSON parsing, and JSON repair logic all in one place.
*   **Actual Implementation:** The logic was split into two layers:
    1.  **`GeminiClient`:** This client is responsible *only* for API-level concerns. It handles timeouts and retries with exponential backoff for transient network errors (e.g., `ServiceUnavailable`, `DeadlineExceeded`). This keeps the client generic and reusable.
    2.  **`SDFService`:** This service handles the *application-specific* error handling. It contains the self-healing logic to re-prompt the AI and fix malformed JSON, as this is a problem specific to the SDF generation task.

*   **Rationale:** This separation of concerns is a better software design pattern. It makes the code cleaner, more maintainable, and easier to test. The `GeminiClient` remains a general-purpose tool for communicating with the API, while the `SDFService` contains the specialized logic required for its particular task.
