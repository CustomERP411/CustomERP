---
title: How to Generate Three Modules (Inventory, Invoice, HR)
---

## 1. Goal

This guide walks through generating an ERP that includes:

- Inventory module.
- Invoice module.
- HR module.

It assumes the platform is already running (see `README.md` for setup).

## 2. Prepare a Multi-Module SDF

You can either:

- Use the existing sample SDFs under `test/` as a starting point, or
- Ask the AI Gateway (via the platform UI) to produce an SDF that enables all three modules.

### 2.1 Using Sample SDFs

The repository includes example SDFs:

- `test/sample_sdf_invoice.json`
- `test/sample_sdf_hr.json`
- `test/sample_sdf_hr_inventory.json`
- `test/sample_sdf_multi_module.json`

For a three-module scenario (Inventory + Invoice + HR), you can start from:

- `test/sample_sdf_multi_module.json` (Inventory + Invoice) and extend it with HR entities similar to `test/sample_sdf_hr_inventory.json`.

Ensure the SDF:

- Sets all modules to enabled:

```json
{
  "modules": {
    "inventory": { "enabled": true },
    "invoice": { "enabled": true },
    "hr": { "enabled": true }
  }
}
```

- Tags entities with the appropriate module:
  - Inventory entities: `"module": "inventory"`.
  - Invoice entities: `"module": "invoice"`.
  - HR entities: `"module": "hr"`.
  - Shared entities: `"module": "shared"` (if used by more than one module).

## 3. Generate via Platform UI

1. Open the platform frontend (`http://localhost:5173`).
2. Create or open a project for your multi-module ERP.
3. Provide a business description that clearly calls for:
   - Inventory operations.
   - Invoicing and billing.
   - HR basics (departments, employees, leaves).
4. Use the chatbot to refine requirements:
   - Answer clarification questions until the SDF is finalized.
5. Trigger generation from the project detail screen.
6. Wait for the generation job to complete and download/open the generated ERP artifact.

## 4. Generate via CLI (Assembler Helper)

If you already have a finalized SDF JSON file (e.g., `test/sample_sdf_multi_module.json` extended with HR entities):

```bash
node test/run_assembler.js path/to/your_multi_module_sdf.json
```

The script will:

- Create a project under `generated/<project-id>/`.
- Print the path and a tree view of the generated files.

## 5. Run the Generated ERP

Change into the generated project directory printed by the assembler, then:

### 5.1 Using Docker (Inside Generated Project)

```bash
docker compose up -d
```

or follow the `dev.ps1` / `dev.sh` commands documented in the generated README.

### 5.2 Without Docker (Inside Generated Project)

Typical pattern (exact commands are in the generated README):

```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

## 6. Verify All Three Modules

Once the generated ERP is running:

1. Open the generated frontend (URL from the generated README).
2. Confirm that navigation shows:
   - Inventory module.
   - Invoice module.
   - HR module.
3. For each module:
   - Open its main list pages.
   - Create a sample record.
   - Confirm the record appears in the list and basic validation works.

## 7. Related Documents & Tests

- Tests:
  - `test/module_generation.integration.test.js`
  - `platform/backend/tests/api_invoice_hr_routes.test.js`
  - `test/ui_invoice_hr.flows.test.md`
- Docs:
  - `docs/uc4_test_plan.md`
  - `docs/uc4_qa_checklist.md`
  - `docs/local_testing_guide.md`

