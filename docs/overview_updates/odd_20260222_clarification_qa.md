# Clarification Q/A persistence (ODD)

- Persist clarification questions to the `questions` table with DB UUID ids and order index.
- Persist clarification answers to the `answers` table during the clarify flow.
- Rewrite `clarifications_needed` IDs in API responses and stored SDF versions.
