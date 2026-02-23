# After-Prompt Care: Invoice Module SDF (Phase 4)

**Date:** 2026-02-23  
**Author:** BTB  
**Topic:** Invoice Module SDF Definition

---

## 1. Prompt Result
- Defined the **Invoice Module** specification in `SDF_REFERENCE.md`.
- Updated all AI prompts (`analyze`, `clarify`, `edit`, `finalize`) with an **INVOICE PATTERN** section to guide the AI in generating invoice-related entities (`invoices`, `invoice_items`, `customers`) and configurations.
- Whitelisted `invoice` and `hr` modules in `SDFService` scope guardrails.
- Created `test/sample_sdf_invoice.json` as a canonical example of a valid invoice SDF.

## 2. What User Must Add/Prepare
- **Rebuild:** The AI Gateway container needs to be rebuilt to pick up the code changes in `sdf_service.py` (module whitelist).
  ```bash
  docker compose build ai-gateway
  docker compose up -d ai-gateway
  ```
- **Assembler Update (Next Task):** This task only defined the *shape* of the data. The Assembler (ASA) must now be updated to actually *generate* the invoice module code (backend mixins, frontend pages) based on this shape. This is a separate task (ASA's responsibility in Phase 4).

## 3. Setup Steps
1. Pull the branch `sprint1/btb/invoice-sdf-def`.
2. Rebuild the AI Gateway.
3. Test generation with a prompt like "Create a system for consulting billing with invoices".

## 4. Test Checklist
- [ ] **AI Generation:**
  1. Send `POST /ai/analyze` with: "I need a system to send PDF invoices to my consulting clients."
  2. Verify the output contains:
     - `modules.invoice.enabled: true`
     - Entities: `invoices`, `invoice_items`, `customers`
     - `invoices` entity has `features.print_invoice: true`
- [ ] **Manual Validation:**
  1. Run the verification script inside the container (or locally if env is set up):
     ```bash
     docker exec customwerp-ai-gateway python /app/tests/verify_invoice_sdf_container.py
     ```
     (Note: You may need to recreate the script inside the container or mount it).

## 5. Expected vs Not Expected
- **Expected:** The AI now "knows" about invoices and will suggest the correct structure. The Validator accepts `module: "invoice"`.
- **Not Expected:** The *code* for the invoice module (PDF generation logic, specific UI components) will NOT be generated yet. The Assembler simply doesn't know what to do with `module: "invoice"` until ASA's tasks are complete.

## 6. Known Risks / Follow-up
- **Risk:** Users might expect a working invoice system immediately. We must communicate that this only enables the *definition* support.

## 7. Blocked Dependencies
- **ASA:** Can now proceed with "Invoice generator implementation" (backend/frontend bricks) using the spec in `SDF_REFERENCE.md`.
