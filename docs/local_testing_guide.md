---
title: Local Testing Guide (Updated Project v2)
---

## 1. Purpose

This guide describes the current local test flow for the updated CustomERP project.

It includes:

- Platform startup (Docker and local mode).
- Core regression commands.
- Current sample SDF behavior (including known failures).
- API surface test caveats.
- Manual QA references.
- AI Gateway test flow.

## 2. Prerequisites

- Run commands from repo root unless noted:
  - `C:\Users\ASUS\CustomERP`
- Node.js installed (Node 20.x recommended).
- Python 3.11+ installed (for AI Gateway tests).
- Docker Desktop running (recommended).
- `.env` present and configured (`.env.example` -> `.env`).
- `GOOGLE_AI_API_KEY` set for AI endpoint tests.

## 3. Start the Platform

### 3.1 Docker (recommended)

```powershell
.\scripts\dev.ps1 start
```

```bash
./scripts/dev.sh start
```

Useful Windows helpers:

```powershell
.\scripts\dev.ps1 status
.\scripts\dev.ps1 logs
.\scripts\dev.ps1 down
```

Service URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`
- AI Gateway: `http://localhost:8000`
- pgAdmin (optional): `http://localhost:5050`

### 3.2 Without Docker

```powershell
# Terminal 1 (backend)
cd platform\backend
npm install
npm run dev
```

```powershell
# Terminal 2 (frontend)
cd platform\frontend
npm install
npm run dev
```

```powershell
# Terminal 3 (AI Gateway)
cd platform\ai-gateway
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## 4. Core Automated Tests (Repo Root)

There is no single root `npm test`. Run scripts directly.

### 4.1 Unit tests

```bash
node test/invoice_bricks.unit.test.js
node test/hr_bricks.unit.test.js
```

### 4.2 Integration generation test

```bash
node test/module_generation.integration.test.js
```

### 4.3 API surface test

```bash
node platform/backend/tests/api_invoice_hr_routes.test.js
```

### 4.4 Optional feature verification

```bash
node test/verify_features_ea.js
```

## 5. Sample SDF Sets and Current Status

Use:

```bash
node test/run_assembler.js <path-to-sdf.json>
```

### 5.1 UC-4 baseline set

```bash
node test/run_assembler.js test/sample_sdf_invoice.json
node test/run_assembler.js test/sample_sdf_hr.json
node test/run_assembler.js test/sample_sdf_hr_inventory.json
node test/run_assembler.js test/sample_sdf_multi_module.json
```

Current known behavior:

- `sample_sdf_invoice.json`: expected to generate.
- `sample_sdf_hr.json`: expected to generate.
- `sample_sdf_hr_inventory.json`: currently fails SDF validation (see section 10.1).
- `sample_sdf_multi_module.json`: expected to generate (inventory + invoice).

### 5.2 Inventory Priority A set

```bash
node test/run_assembler.js test/sample_sdf_inventory_priority_a_reservations.json
node test/run_assembler.js test/sample_sdf_inventory_priority_a_inbound.json
node test/run_assembler.js test/sample_sdf_inventory_priority_a_cycle.json
node test/run_assembler.js test/sample_sdf_inventory_priority_a_mixed.json
```

### 5.3 Stress/customized set

```bash
node test/run_assembler.js test/sample_sdf_all_modules_priority_a_customized.json
node test/run_assembler.js test/sample_sdf_solar_panel_firm.json
```

## 6. Run a Generated ERP Locally

From the generated project path printed by assembler:

```powershell
cd <generated-project-path>
.\dev.ps1 start
```

Or macOS/Linux:

```bash
cd <generated-project-path>
chmod +x dev.sh
./dev.sh start
```

Manual startup:

```bash
# Terminal 1
cd backend
npm install
npm run migrate
npm start

# Terminal 2
cd frontend
npm install
npm run dev
```

## 7. Manual QA References

- `test/ui_invoice_hr.flows.test.md` (Invoice + HR UI flows)
- `docs/uc4_qa_checklist.md` (UC-4 QA checklist)
- `docs/inventory_priority_a_test_instructions.txt` (Inventory Priority A checks)

## 8. AI Gateway Tests

From `platform/ai-gateway`:

```powershell
cd platform\ai-gateway
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
```

Mocked/unit:

```bash
pytest tests/test_sdf_service.py tests/test_finalize_flow.py -q
```

Integration (AI Gateway must be running):

```bash
pytest tests/test_integration.py -q
```

Optional URL override:

```powershell
$env:AI_GATEWAY_URL="http://localhost:8000"
pytest tests/test_integration.py -q
```

## 9. Recommended Daily Flow

1. Start platform (`.\scripts\dev.ps1 start`).
2. Run unit tests.
3. Run `module_generation.integration.test.js`.
4. If integration fails on a known SDF issue, continue with manual `run_assembler` on target SDFs.
5. Run API surface test only after confirming the selected generated backend includes required routes.
6. Execute manual checklists as needed.

## 10. Known Problems and Root Causes

### 10.1 SDF Validation Error (cross-module reference)

Observed error:

`SDF Validation Error: Field 'warehouses.manager_id' must reference an entity in the same module or marked shared.`

Root cause:

- In `test/sample_sdf_hr_inventory.json`, `warehouses` is in `inventory`.
- `warehouses.manager_id` references `employees`, which is in `hr`.
- Validator rule in `platform/assembler/ProjectAssembler.js` requires references to be:
  - same module, or
  - target module `shared`.

Impact:

- `node test/module_generation.integration.test.js` stops at `hr-inventory` case.

Typical fix strategy:

- Move cross-module shared entities (for example `employees`) to `module: "shared"`, or
- remove/replace cross-module reference fields that violate boundary rules.

### 10.2 API Surface Test selects latest generated backend

Observed pattern:

`Using generated backend from: itest-hr-only-...`

Then failure:

`Expected /invoices route to be mounted ...`

Root cause:

- `platform/backend/tests/api_invoice_hr_routes.test.js` reads the most recently modified generated backend.
- If latest output is HR-only, Invoice assertions fail.
- If latest output is Invoice-only, HR assertions fail.
- The script does not guarantee invoice and HR assertions are evaluated against separate matching artifacts.

Practical workaround:

- Before running API surface test, ensure latest generated backend actually contains routes expected by the script.
- If needed, generate a dedicated SDF/artifact that includes all expected canonical entity routes:
  - `/invoices`, `/invoice_items`, `/employees`, `/departments`, `/leaves`.

## 11. Troubleshooting Quick Notes

- **Generation failed**
  - Re-run the same command and inspect full stack trace.
  - Validate reference targets and module assignments in SDF.
- **API surface assertion failed**
  - Open selected generated backend `src/routes/index.js` and verify mounts.
  - Confirm the backend picked by test is the one you intended.
- **Priority A endpoint 404**
  - Confirm corresponding pack is enabled in that SDF.
  - Confirm you started the ERP generated from that same SDF.
- **PowerShell script blocked**
  - Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.
