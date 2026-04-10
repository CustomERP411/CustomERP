---
title: Testing Guide for CustomERP (Usage Fine-Tuning)
---

## 1. Purpose

This guide defines a practical testing workflow for improving and fine-tuning CustomERP behavior over time.

It focuses on:

- Platform stability (backend/frontend/AI gateway).
- SDF quality and generation consistency.
- Assembler output quality across modules.
- Generated ERP route/UI correctness.
- A repeatable defect -> fix -> retest loop.

## 2. What "Fine-Tuning Usage" Means Here

In this project, usage fine-tuning means improving the system by testing real scenarios and feeding results back into the correct layer:

- AI prompt/schema tuning (`platform/ai-gateway/**`, `SDF_REFERENCE.md`).
- Assembler/brick tuning (`platform/assembler/**`, `brick-library/**`).
- Platform API/UI tuning (`platform/backend/**`, `platform/frontend/**`).
- Generated ERP behavior checks (`generated/**` artifacts from sample SDFs).

## 3. Prerequisites

- Run commands from repo root: `C:\Users\ASUS\CustomERP`
- Node.js 20+ (Node 18+ minimum for global `fetch` in objective runner)
- Python 3.11+ (AI gateway tests)
- Docker Desktop running (recommended)
- `.env` configured from `.env.example`
- `GOOGLE_AI_API_KEY` set for AI-dependent flows

## 4. Test Layers and Their Fine-Tuning Value

| Layer | Main Command(s) | What You Learn | Typical Tuning Target |
|:------|:----------------|:---------------|:----------------------|
| Static contracts | `node test/sprint3_te_regression.test.js` | Missing routes/endpoints/UI hooks | Backend/frontend wiring |
| Unit checks | `node test/invoice_bricks.unit.test.js`<br>`node test/hr_bricks.unit.test.js` | Module behavior drift | Bricks and service logic |
| Integration generation | `node test/module_generation.integration.test.js` | Module assembly correctness | Assembler wiring + SDF samples |
| API surface | `node platform/backend/tests/api_invoice_hr_routes.test.js` | Generated backend route mounts | Template/generator route wiring |
| E2E objectives | `node test/sprint3_te_objectives.e2e.test.js --objectives=...` | End-to-end product behavior | Cross-layer flow issues |
| AI gateway tests | `pytest ...` under `platform/ai-gateway` | SDF output validity + finalize flow | Prompt/schema/validation logic |
| Manual UX checks | `test/ui_invoice_hr.flows.test.md` | Real operator usability | UI behavior, validations, wording |

## 5. Recommended Execution Packs

### 5.1 Quick Smoke (10-15 min)

1. `node test/sprint3_te_regression.test.js`
2. `node test/invoice_bricks.unit.test.js`
3. `node test/hr_bricks.unit.test.js`
4. `node test/module_generation.integration.test.js`

Use this before coding sessions and before merging non-trivial changes.

### 5.2 Full Fine-Tuning Pack (Daily/Pre-release)

1. Start platform (`.\scripts\dev.ps1 start` on Windows).
2. `node test/sprint3_te_regression.test.js --run-regression`
3. `node test/sprint3_te_objectives.e2e.test.js --objectives=131,133,134,135,138 --save-zips`
4. `node platform/backend/tests/api_invoice_hr_routes.test.js`
5. AI gateway tests (section 7.5)
6. Manual module flows from `test/ui_invoice_hr.flows.test.md`

## 6. Fine-Tuning Loop (Core Process)

### Step A - Run Baseline

Execute the quick smoke pack first. If it is green, run the full pack.

### Step B - Capture Evidence

For each failing/blocked case, record:

- exact command
- input SDF or scenario
- expected vs actual result
- full error text
- artifact/report path (for objective runner: `test-results/sprint3-te/`)

### Step C - Classify the Failure

- **AI prompt/schema issue**: incomplete/invalid/fuzzy SDF output.
- **Assembler/brick issue**: generated files/routes/services missing or malformed.
- **Platform orchestration issue**: analyze/clarify/finalize/project APIs fail.
- **Generated ERP UX issue**: runtime or form behavior incorrect in generated app.

### Step D - Patch the Correct Layer

Apply the smallest fix in the owning layer, then re-run:

1. the failed test,
2. the nearest integration test,
3. the quick smoke pack.

### Step E - Lock the Improvement

After a fix passes:

- keep/update the failing scenario in sample SDFs under `test/`,
- keep/update test script assertions,
- update relevant docs (`docs/local_testing_guide.md`, this guide, or module test plans).

## 7. Command Cookbook

### 7.1 Start/Health

```powershell
.\scripts\dev.ps1 start
```

Health checks:

- Backend: `http://localhost:3000/health`
- AI Gateway: `http://localhost:8000/health`

### 7.2 Core JS Test Commands

```bash
node test/sprint3_te_regression.test.js
node test/invoice_bricks.unit.test.js
node test/hr_bricks.unit.test.js
node test/module_generation.integration.test.js
node platform/backend/tests/api_invoice_hr_routes.test.js
```

### 7.3 Objective Runner (E2E)

```bash
node test/sprint3_te_objectives.e2e.test.js --objectives=131,132,133,134,135,138 --save-zips
```

Useful options:

- `--backend-url=http://localhost:3000`
- `--platforms=windows-x64,macos-x64,linux-x64`
- `--single-modules=invoice`
- `--multi-modules=inventory,invoice,hr`
- `--retest-of=TE-S3-004`
- `--include-api-surface-in-pack` (with objective 137)

### 7.4 Assembler Scenario Runs

```bash
node test/run_assembler.js test/sample_sdf_invoice.json
node test/run_assembler.js test/sample_sdf_hr.json
node test/run_assembler.js test/sample_sdf_multi_module.json
node test/run_assembler.js test/sample_sdf_solar_panel_firm.json
```

### 7.5 AI Gateway Tests

From `platform/ai-gateway`:

```powershell
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
pytest tests/test_sdf_service.py tests/test_finalize_flow.py -q
pytest tests/test_integration.py -q
```

## 8. Defect Log Template (Fine-Tuning Ready)

Use this structure in your defect tracker (`docs/sprint3_te_defect_log.md` or equivalent):

| Defect ID | Layer | Repro Command/Steps | Expected | Actual | Fix Owner | Retest Command | Status |
|:----------|:------|:--------------------|:---------|:-------|:----------|:---------------|:-------|
| TE-FT-001 | Assembler | `node test/module_generation.integration.test.js` | HR+Inventory builds | Cross-module ref validation fail | ASA/ODD | same command + smoke pack | Open |

Tip: for objective-runner failures, attach the exact JSON report under `test-results/sprint3-te/`.

## 9. Exit Criteria for a Fine-Tuning Cycle

- Quick smoke pack passes.
- No open Critical/High defects for the scope under test.
- All newly fixed defects have retest evidence.
- Documentation and commands remain executable as written.

## 10. Related Documents

- `docs/local_testing_guide.md`
- `docs/uc4_test_plan.md`
- `docs/uc4_qa_checklist.md`
- `docs/sprint3_te_test_plan.md`
- `docs/uat_test_plan_current.md`
- `test/ui_invoice_hr.flows.test.md`
