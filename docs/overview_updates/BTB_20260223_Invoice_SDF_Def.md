# Invoice Module SDF Definition (Phase 4)

**Date:** 2026-02-23  
**Author:** Burak Tan Bilgi (BTB)  
**Related PR:** sprint1/btb/invoice-sdf-def

## 1. Summary
This update introduces the official Schema Definition Format (SDF) specification for the **Invoice Module**. This allows the AI Gateway to understand, generate, and validate requests for invoicing features, paving the way for the implementation phase (Assembler/Bricks).

## 2. Key Changes

### SDF Reference Update
- Added **`modules.invoice`** configuration:
  - `enabled` (boolean)
  - `tax_rate` (default 0)
  - `currency` (default "USD")
  - `payment_terms` (default 30 days)
  - `prefix` (default "INV-")
- Defined expected entities structure:
  - **`invoices`**: Header entity with status, dates, and totals.
  - **`invoice_items`**: Line items linked to invoices.
  - **`customers`**: Shared entity for billing.

### AI Prompts
- Updated `analyze`, `clarify`, `edit`, and `finalize` prompts with a specific **INVOICE PATTERN**.
- The AI is now instructed to:
  - Recognize keywords like "billing", "invoice", "quote-to-cash".
  - Automatically suggest the standard 3-entity structure (`invoices`, `invoice_items`, `customers`).
  - Configure `features.print_invoice: true` for the invoice header.

### Validation & Guardrails
- Updated `SDFService` to **whitelist** the `invoice` and `hr` modules.
- This ensures that valid invoice requests are no longer stripped out by the guardrails introduced in Phase 1.

## 3. Usage
Developers and the AI can now use `module: "invoice"` in entity definitions.
Example SDF snippet:
```json
{
  "modules": {
    "invoice": { "enabled": true }
  },
  "entities": [
    {
      "slug": "invoices",
      "module": "invoice",
      "features": { "print_invoice": true },
      ...
    }
  ]
}
```

## 4. Next Steps
- **Assembler Implementation (ASA):** The generator needs to be updated to handle these new module/feature flags and generate the actual code (backend mixins, frontend PDF generation).
