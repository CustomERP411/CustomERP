---
title: Sprint 3 (TE) Testing Plan and Regression Pack
---

## 1. Purpose

This plan operationalizes the TE objectives listed in `progressreport.md` (items 131-138) with:

- runnable test code,
- step-by-step execution instructions,
- defect logging and retest loop guidance.

## 2. Required Test Assets

- `test/sprint3_te_objectives.e2e.test.js` (objective runner for 131-138)
- `test/sprint3_te_regression.test.js` (static Sprint 3 contract checks)
- `docs/sprint3_te_defect_log.md` (defect and retest tracker)
- `test/ui_invoice_hr.flows.test.md` (manual UI checks)

## 3. Environment Setup (Step 0)

1. Start platform services:
   - Windows: `.\scripts\dev.ps1 start`
   - macOS/Linux: `./scripts/dev.sh start`
2. Confirm health:
   - Backend: `http://localhost:3000/health`
   - AI Gateway: `http://localhost:8000/health` 
3. (Optional) Run quick static sanity:
   - `node test/sprint3_te_regression.test.js `

## 4. Objective-by-Objective Steps (131-138)

### 4.1 Objective 131
**Test iterative clarifying-question loop end-to-end across single and multi-module projects.**

1. Run:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=131`
2. What this command does:
   - registers/logs in test user,
   - creates single-module scenario project,
   - creates multi-module scenario project,
   - auto-fills mandatory questions,
   - runs analyze + iterative clarify rounds.
3. Evidence:
   - pass result in terminal,
   - run report JSON under `test-results/sprint3-te/`.

### 4.2 Objective 132
**Test AI chat mode to build mode transition flow.**

1. Run:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=132`
2. Expected current outcome:
   - likely `BLOCKED` unless dedicated chat/build workflow is implemented.
3. Action:
   - log blocker in `docs/sprint3_te_defect_log.md`.

### 4.3 Objective 133
**Test one-click executable packaging on Windows, Mac, and Linux environments.**

1. Run API packaging matrix:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=133 --platforms=windows-x64,macos-x64,linux-x64 --save-zips`
2. This command:
   - ensures a multi-module project with SDF exists,
   - tests `/generate` and `/generate/standalone` endpoints,
   - validates ZIP signature,
   - saves ZIP artifacts in `test-results/sprint3-te/`.
3. Manual OS runtime verification (required):
   - unzip each package on target OS,
   - run generated startup script (`start.bat`, `start.sh`, or `start.command`),
   - verify app boot and health.

### 4.4 Objective 134
**Test SDF review/approve/reject/revise workflow end-to-end.**

1. Run:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=134`
2. This command tests:
   - `GET /sdf/latest`,
   - `POST /sdf/save` (review/save revise baseline),
   - `POST /sdf/ai-edit` (AI revise step).
3. Expected current outcome:
   - `PASS` if AI gateway + model are available,
   - `BLOCKED` if AI infrastructure is unavailable,
   - `BLOCKED` where full approve/reject workflow is not yet implemented.

### 4.5 Objective 135
**Test project and account soft-delete behavior and list filtering.**

1. Run:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=135`
2. This command validates:
   - project delete endpoint behavior + list filtering,
   - code-level presence of project/account soft-delete implementation.
3. Expected current outcome:
   - runtime project deletion/list filtering passes,
   - soft-delete scope may be reported as `BLOCKED` if hard delete is still in place.

### 4.6 Objective 136
**Run module-capability regression scenarios to verify Sprint 2 fixes hold.**

Run:

- `node test/sprint3_te_objectives.e2e.test.js --objectives=136`

This executes:

- `node test/verify_features_ea.js`
- `node test/invoice_bricks.unit.test.js`
- `node test/hr_bricks.unit.test.js`
- `node test/module_generation.integration.test.js`

### 4.7 Objective 137
**Prepare continuous regression pack for review+approval flows.**

1. Run baseline pack:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=137`
2. Run with API surface in pack:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=137 --include-api-surface-in-pack`
3. Equivalent direct command set:
   - `node test/sprint3_te_regression.test.js`
   - `node test/sprint3_te_regression.test.js --run-regression`
   - `node test/sprint3_te_regression.test.js --run-regression --run-api-surface`

### 4.8 Objective 138
**Log defects and retest after fixes continuously.**

1. Defect logging file:
   - `docs/sprint3_te_defect_log.md`
2. After any fix, retest only failed objectives:
   - example: `node test/sprint3_te_objectives.e2e.test.js --objectives=133,134 --retest-of=TE-S3-004`
3. Attach the new report JSON from `test-results/sprint3-te/` to the same defect row.

## 5. Recommended Full Execution Order

1. Static contracts:
   - `node test/sprint3_te_regression.test.js`
2. E2E API objectives:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=131,132,133,134,135,138 --save-zips`
3. Capability regression:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=136`
4. Continuous regression pack:
   - `node test/sprint3_te_objectives.e2e.test.js --objectives=137 --include-api-surface-in-pack`
5. Manual UI and packaged runtime checks:
   - `test/ui_invoice_hr.flows.test.md`
   - packaged startup on Windows/macOS/Linux.

## 6. Pass/Block/Fail Rules

- **PASS**: objective behavior validated end-to-end in current implementation.
- **BLOCKED**: objective cannot be fully validated due missing feature or unavailable dependency.
- **FAIL**: objective is implemented but test assertion failed.

## 7. Exit Criteria

- No open **Critical/High** failures in implemented objectives.
- All blocked items are logged with owner and follow-up plan.
- Retest evidence is attached for all fixed defects in `docs/sprint3_te_defect_log.md`.
