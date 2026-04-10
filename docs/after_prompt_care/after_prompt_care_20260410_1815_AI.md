---
title: After Prompt Care - Testing Guide for Fine-Tuning
---

## 1. Prompt Result

- Added a new guide: `docs/testing_guide.md`.
- The guide provides:
  - test layers and command packs,
  - a defect classification model for fine-tuning,
  - a repeatable defect -> fix -> retest loop.
- Cross-discipline coverage:
  - **Code/Logic:** maps failures to prompt/schema, assembler/bricks, and platform layers.
  - **Visuals/UI:** includes manual flow validation via `test/ui_invoice_hr.flows.test.md`.
  - **Data/Config:** includes environment/setup expectations and report artifact usage.
  - **Tests:** includes quick smoke pack, full pack, objective runner, API surface, and AI gateway tests.

## 2. What User Must Add/Prepare

- Ensure `.env` is configured (especially `GOOGLE_AI_API_KEY`).
- Ensure Docker/Desktop or equivalent local stack is available.
- Ensure Python venv + dependencies are installable for AI gateway tests.
- Optional: define team-owned defect IDs/labels for fine-tuning cycles.

## 3. Setup Steps

1. Start services:
   - Windows: `.\scripts\dev.ps1 start`
   - macOS/Linux: `./scripts/dev.sh start`
2. Confirm health endpoints:
   - `http://localhost:3000/health`
   - `http://localhost:8000/health`
3. Open and follow `docs/testing_guide.md`.

## 4. Test Checklist

- [ ] Run quick smoke pack from `docs/testing_guide.md`.
- [ ] Run full fine-tuning pack from `docs/testing_guide.md`.
- [ ] Execute manual UI checklist in `test/ui_invoice_hr.flows.test.md`.
- [ ] For each failure, log command, expected/actual, and artifact path.
- [ ] Retest fixed cases and update status.

## 5. Expected vs Not Expected

**Expected**

- Commands in `docs/testing_guide.md` are runnable in current repo layout.
- Failures can be categorized by layer and routed to the right owner.
- Retest loop is explicit and repeatable.

**Not Expected**

- Ambiguous ownership of failures.
- Test runs without evidence capture.
- Fixes merged without targeted retest + smoke rerun.

## 6. Known Risks / Follow-up

- Some scenarios may still be blocked by in-progress features (for example objective-level blockers).
- AI-dependent tests can fail due to gateway/model availability rather than code defects.
- As modules evolve, test command sets/docs should be revalidated at sprint boundaries.

## 7. Blocked Dependencies

- No hard blocked dependency for document usage.
- Runtime test completeness still depends on:
  - local service availability,
  - AI gateway availability,
  - up-to-date sample SDFs and generation scripts.
