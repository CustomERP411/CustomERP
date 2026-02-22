# AI SDF Reliability Updates (Phase 1)

**Date:** 2026-02-22  
**Author:** Burak Tan Bilgi (BTB)  
**Related PR:** sprint1/btb/ai-sdf-reliability

## 1. Finalize Flow (/ai/finalize)
The `/ai/finalize` endpoint has been upgraded to support the "Merge Answers" logic:
- **Input:** Accepts a `ClarifyRequest` (partial SDF + user answers).
- **Process:**
  1. Merges the user's answers into the partial SDF context.
  2. Uses a new `finalize_prompt.txt` to ask the AI to produce a final, clean SDF.
  3. Explicitly instructs the AI to resolve all ambiguities and return an empty `clarifications_needed` list.
- **Output:** A validated `SystemDefinitionFile` ready for generation.

## 2. Scope Guardrails
To ensure the AI does not hallucinate unsupported features, we implemented strict whitelisting in `SDFService._normalize_generator_sdf`:

### Modules Whitelist
Only the following modules are allowed. Any others are removed and a warning is added:
- `activity_log`
- `inventory_dashboard`
- `scheduled_reports`

### Features Whitelist
Only the following entity features are allowed:
- `audit_trail`
- `batch_tracking`
- `serial_tracking`
- `multi_location`

### Chatbot Rejection
Explicit logic was added to detect and reject requests for "chatbot" or "AI assistant" features within the generated ERP, as these are out of scope for the generator.

## 3. Testing
A new test file `tests/test_finalize_flow.py` covers:
- Merging answers into a final SDF.
- Guardrails against lingering clarification questions.
- Self-healing JSON repair during finalization.
