# UI Flows — Invoice & HR Modules (Manual E2E Checklist)

> This file defines manual UI test flows for the generated ERP.  
> It complements automated backend/module tests and should be executed against a multi‑module build created from `test/sample_sdf_multi_module.json` or `test/sample_sdf_hr_inventory.json`.

## Prerequisites

- Platform is running (via `scripts/dev.ps1 start` or `scripts/dev.sh start`).
- AI Gateway is reachable and can finalize SDFs.
- An ERP has been generated using one of the multi‑module sample SDFs and is running (backend + frontend) according to the README in the generated project.

## Invoice Module Core Flow

1. **Open Invoice Module**
   - Navigate to the generated ERP frontend.
   - From the main navigation, open the **Invoice** module/list page.
   - Verify the invoice list renders without errors.

2. **Create Invoice with Line Items**
   - Click **New Invoice** (or equivalent action).
   - Select a valid customer.
   - Add at least two line items:
     - Ensure `description`, `quantity`, `unit_price` fields are editable.
   - Save the invoice.
   - Expect:
     - A unique `invoice_number` is assigned.
     - `subtotal`, `tax_total`, and `grand_total` fields are populated.

3. **Edit Invoice**
   - Open the invoice detail page.
   - Change the status (e.g., `Draft` → `Sent` or `Paid`).
   - Edit one line item’s quantity.
   - Save.
   - Expect:
     - Status change is persisted.
     - Invoice totals are recalculated according to updated line items.

4. **List & Filter**
   - Return to the invoice list.
   - Confirm the new invoice appears with correct number, customer, and status.
   - Apply a basic search/filter (if available) and ensure the invoice remains visible when matching criteria.

## HR Module Core Flow

1. **Open HR Module**
   - Navigate to the **HR** module.
   - Verify that **Employees** and **Departments** pages are accessible.

2. **Create Department**
   - From **Departments**, create a new department with `name` and optional `location`.
   - Save and ensure no validation error appears for a non‑empty name.

3. **Create Employee**
   - From **Employees**, create a new employee:
     - Fill `first_name`, `last_name`, `email`, `job_title`, `hire_date`.
     - Select the previously created department.
   - Save.
   - Expect:
     - Email is normalized (trimmed, lower‑cased) and stored.
     - Record appears in the employee list.

4. **Record Leave Request**
   - Navigate to **Leave Requests** (or equivalent).
   - Create a leave entry for the employee with `start_date` and `end_date`.
   - Use a valid date range first → expect success.
   - Try an invalid range (`end_date` before `start_date`) → expect a validation error and no record creation.

## Expected vs Not Expected

- **Expected**
  - Navigation between modules works without client‑side errors.
  - Create/edit flows respect basic validation (required fields, date ranges, email normalization).
  - Invoice totals are consistent with line items.
- **Not Expected**
  - Blank pages or unhandled exceptions in console.
  - Ability to save obviously invalid entities (empty required fields, inverted leave ranges).
  - Mismatched totals on invoice after editing line items.

