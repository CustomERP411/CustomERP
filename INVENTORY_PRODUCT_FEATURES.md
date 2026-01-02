# Inventory Module — Productization Feature List (v1)

This list focuses on **small/medium business** inventory needs and on turning the generated ERP into a **usable product**, not just a CRUD/table generator.

## Tier 1 (Must-have “Product” Baseline)

- **Professional UI shell**
  - Sidebar + top bar, consistent page headers
  - Empty states, loading skeletons, responsive layout
- **User feedback**
  - Toast notifications (success / error / warning)
  - Clear inline validation messages (no cryptic alerts)
- **Search + quick filters**
  - Search within lists
  - Quick “low stock” filter (when quantity/reorder point exist)
- **CSV tools (Excel compatible)**
  - Export current list to CSV (`.csv`) that opens in Excel
  - Import CSV with:
    - “Download template CSV”
    - Header validation + required-field checks
    - Preview before import + progress indicator
    - Clear error messages (e.g., wrong headers, wrong data type)
- **Printing / PDF**
  - Print-friendly record/list view
  - “Print / Save as PDF” guidance (uses browser print dialog)

## Tier 2 (Strong Inventory Value)

- **Inventory operations (wizards)**
  - Receive stock (adds movement + updates quantity)
  - Adjust stock with reason codes
  - Transfer stock between locations (if multi-location is enabled)
- **Low stock & expiry dashboard**
  - Low stock list + quick reorder suggestions
  - Expiry alerts (if batch/expiry enabled)
- **Bulk actions**
  - Bulk delete
  - Bulk update (status/category/location)
- **Activity log**
  - Recent changes feed (from audit trail)

## Tier 3 (Nice-to-have / Later)

- **Barcode labels** (print templates; future scan support)
- **XLSX import/export** (true Excel files via `xlsx` lib; heavier than CSV)
- **Role-based permissions** (admin vs staff)
- **Scheduled reports** (email, daily summaries)

## Recommended Implementation Order

1. UI shell + toasts + better tables
2. CSV export/import + validation UX
3. Print-friendly views
4. Inventory operation wizards


