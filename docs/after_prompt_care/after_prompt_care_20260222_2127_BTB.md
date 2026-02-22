# After-Prompt Care: AI SDF Reliability (Phase 1)

**Date:** 2026-02-22  
**Author:** BTB  
**Topic:** AI Gateway Finalize Logic & Scope Guardrails

---

## 1. Prompt Result
- Implemented `finalize_sdf` in `SDFService` to merge clarification answers into a clean SDF.
- Added `get_finalize_prompt` to `src/prompts/sdf_generation.py` and a new prompt template `finalize_prompt.txt`.
- Updated `/ai/finalize` endpoint in `main.py` to use the new service logic.
- Implemented **Scope Guardrails** in `_normalize_generator_sdf` to reject unsupported modules/features (whitelisting).
- Created reproduction test `tests/test_finalize_flow.py`.

## 2. What User Must Add/Prepare
- **Rebuild Docker:** The AI Gateway code has changed. You must rebuild the container to pick up the changes.
- **Environment Variables:** Ensure `GOOGLE_AI_API_KEY` is set in `.env`.

## 3. Setup Steps
```bash
# Rebuild the AI Gateway
docker compose build ai-gateway
docker compose up -d ai-gateway
```

## 4. Test Checklist
- [ ] **Unit Test:** Run the new test flow (requires local env or inside docker):
  ```bash
  # Inside ai-gateway container or venv
  pytest tests/test_finalize_flow.py
  ```
- [ ] **Manual Verify:**
  1. Send a `POST /ai/finalize` with a `ClarifyRequest` payload (partial SDF + answers).
  2. Verify response is a clean SDF with `clarifications_needed: []`.
  3. Verify unsupported modules (e.g., "chatbot") are removed and warned about in `warnings`.

## 5. Expected vs Not Expected
- **Expected:** Unsupported modules/features are silently removed from the SDF, but a warning is added to the `warnings` list.
- **Not Expected:** The AI should not hallucinate new modules not in the whitelist.

## 6. Known Risks / Follow-up
- **Risk:** If the AI generates a valid module but misspells it (e.g., "activity_logs" vs "activity_log"), it will be stripped by the guardrail. Prompt engineering may need tuning if this happens often.
- **Follow-up:** ODD needs to implement the DB persistence for clarifications (Phase 1 task).

## 7. Blocked Dependencies
None.
