# After Prompt Care — 20260223_2215

## Prompt Result
- Code/Logic: Added invoice backend mixins, assembler invoice validation, and invoice-aware generator wiring.
- Visuals/UI: Added invoice list page generator and invoice form enhancements (totals + print button).
- Data/Config: Updated multi-module sample SDF to include invoice entities/children required by validation.
- Tests: Ran assembler generation for invoice-only and multi-module samples.

## What User Must Add/Prepare
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Setup Steps
- Code/Logic: Not required in this prompt.
- Visuals/UI: Not required in this prompt.
- Data/Config: Not required in this prompt.
- Tests: Not required in this prompt.

## Test Checklist
- Code/Logic:
  - `node test/run_assembler.js test/sample_sdf_invoice.json`
  - `node test/run_assembler.js test/sample_sdf_multi_module.json`
- Visuals/UI: Open generated ERP and verify invoice list/cards, totals summary, and print button.
- Data/Config: Validate invoice entities and children match `SDF_REFERENCE.md` requirements.
- Tests: Not required beyond assembler checks in this prompt.

## Expected vs Not Expected
- Code/Logic: Expected invoice entities required when `modules.invoice.enabled`; not expected auto-generation of missing entities.
- Visuals/UI: Expected invoice list + totals summary in generated pages; not expected full PDF generation.
- Data/Config: Expected `sample_sdf_multi_module.json` to include invoice_items; not expected HR entities to generate when disabled.
- Tests: Expected assembler to pass for invoice-only and multi-module samples; not expected Docker compose run in this prompt.

## Known Risks / Follow-up
- Code/Logic: Totals/number generation logic should be confirmed against real invoice workflows.
- Visuals/UI: Consider adding invoice detail-specific UI if future requirements go beyond generic forms.
- Data/Config: Keep AI prompt examples aligned with invoice field requirements.
- Tests: Add automated tests for invoice mixins and totals recalculation.

## Blocked Dependencies
- Code/Logic: None.
- Visuals/UI: None.
- Data/Config: None.
- Tests: None.
