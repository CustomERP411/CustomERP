# After-Prompt Care: Frontend Mixin Capability Support

**Date**: 2026-03-08  
**Time**: 23:07  
**Owner**: EA (Frontend)  
**Prompt**: Update frontend pages to support new inventory, invoice, and HR capabilities from mixins

---

## 1) Prompt Result

Frontend pages have been updated to support the new backend mixin capabilities across all three ERP modules:

### Inventory Module
- Added reservation field display (reserved_quantity, committed_quantity, available_quantity)
- Added status lifecycle transition buttons (Draft → Active → Obsolete)
- Enhanced table to show status badges with appropriate styling

### Invoice Module
- Added status filtering by Draft, Sent, Paid, Overdue, Cancelled
- Updated card links to point to edit mode for workflow actions
- Status transition buttons automatically appear based on current status

### HR Module
- Added status filtering for employees (Active, On Leave, Terminated)
- Added status filtering for leave requests (Pending, Approved, Rejected)
- Added approval action buttons (Approve/Reject) for pending leave requests
- Added pending count badge on leave requests page

### Generic Entity Pages
- Status badges automatically styled based on status values
- Status transition buttons rendered dynamically from mixin configuration
- Approval workflow controls rendered when approval config is present
- Stock availability panel shows on detail pages when reservation fields exist

**Files Modified**:
- `platform/assembler/generators/frontend/entityPages.js`
- `platform/assembler/generators/frontend/invoicePages.js`
- `platform/assembler/generators/frontend/hrPages.js`
- `platform/assembler/generators/FrontendGenerator.js`

---

## 2) What User Must Add/Prepare

### Code/Logic
**Mandatory**:
- None. The implementation is complete and self-contained.

**Optional**:
- Custom status badge styles can be added by modifying `getStatusBadgeClass` function in generated entity list pages
- Additional workflow actions can be added to entity form pages by extending the status transition configuration

### Visuals/UI
**Mandatory**:
- None. All UI components use existing Tailwind classes and design patterns.

**Optional**:
- Custom icons for status transitions could be added
- Enhanced reservation field visualization (charts/graphs) could be added to inventory detail pages

### Data/Config
**Mandatory**:
- Entities must have proper mixin configuration in SDF to enable:
  - `inventory_lifecycle`, `invoice_lifecycle`, `hr_employee_status`, or `hr_leave_approval` mixins
  - `inventory_reservation` mixin for reservation field support
- Status field must exist on entity for lifecycle transitions
- Reservation fields (reserved_quantity, committed_quantity, available_quantity) must exist for reservation display

**Optional**:
- Custom status lists can be defined in mixin configuration
- Custom transition rules can be defined per entity

### Tests
**Mandatory**:
- Generate test projects with mixins enabled:
  ```powershell
  # Test inventory lifecycle
  node test/run_assembler.js test/sample_sdf_inventory_lifecycle.json
  
  # Test invoice lifecycle
  node test/run_assembler.js test/sample_sdf_invoice.json
  
  # Test HR approval workflow
  node test/run_assembler.js test/sample_sdf_hr.json
  ```

**Optional**:
- Create sample SDFs that exercise all status transition paths
- Test reservation field calculations with multiple inventory items

---

## 3) Setup Steps

### Before Testing
1. Ensure backend mixins are in place (already completed by ODD):
   - `InventoryLifecycleMixin.js`
   - `InventoryReservationMixin.js`
   - `InvoiceLifecycleMixin.js`
   - `HRLeaveApprovalMixin.js`
   - `HREmployeeStatusMixin.js`

2. Ensure test SDF files include mixin configurations:
   ```json
   {
     "entities": [{
       "slug": "products",
       "mixins": {
         "inventory_lifecycle": {
           "enforce_transitions": true,
           "use_default_transitions": true
         },
         "inventory_reservation": {
           "auto_calculate_available": true
         }
       },
       "fields": [
         {"name": "status", "type": "string"},
         {"name": "quantity", "type": "number"},
         {"name": "reserved_quantity", "type": "number"},
         {"name": "committed_quantity", "type": "number"},
         {"name": "available_quantity", "type": "number"}
       ]
     }]
   }
   ```

### Running Tests
1. Generate a test ERP:
   ```powershell
   cd c:\Users\Elxan\CustomERP
   node test/run_assembler.js test/sample_sdf_hr.json
   ```

2. Navigate to generated output and start the ERP:
   ```powershell
   cd generated/<project-name>
   npm install
   npm run dev
   ```

3. Open browser to `http://localhost:3000`

4. Verify UI elements appear:
   - Status filter buttons on list pages
   - Status badges in table rows and cards
   - Status transition buttons on detail pages
   - Approval buttons on pending leave requests
   - Stock availability panel on inventory detail pages

---

## 4) Test Checklist

### Inventory Module (Code/Logic)
- [ ] Create a product with status "Draft"
- [ ] Verify status badge appears with correct styling (amber)
- [ ] Edit product and verify "→ Active" and "→ Obsolete" buttons appear
- [ ] Click "→ Active" and verify status updates and UI refreshes
- [ ] Verify "→ Obsolete" button now appears (Active can only go to Obsolete)
- [ ] Add reserved_quantity and committed_quantity values
- [ ] Verify stock availability panel shows on detail page with correct calculations

### Inventory Module (Visuals/UI)
- [ ] Status badges use correct colors (green=active, amber=draft, gray=obsolete)
- [ ] Stock availability panel displays all 4 metrics (On Hand, Reserved, Committed, Available)
- [ ] Buttons are properly styled and responsive
- [ ] Status transition buttons are disabled while API call is in progress

### Invoice Module (Code/Logic)
- [ ] Create an invoice with status "Draft"
- [ ] Verify status filter buttons appear on list page
- [ ] Click "Sent" filter and verify only sent invoices show
- [ ] Edit draft invoice and verify "→ Sent" and "→ Cancelled" buttons appear
- [ ] Click "→ Sent" and verify status updates
- [ ] Verify "→ Paid", "→ Overdue", "→ Cancelled" buttons now appear
- [ ] Click "→ Paid" and verify no more transitions are available (terminal state)

### Invoice Module (Visuals/UI)
- [ ] Status filter buttons highlight active filter with blue background
- [ ] Invoice cards display status badges with correct colors
- [ ] Filter counts update correctly when clicking different statuses
- [ ] Empty state message changes based on active filter

### HR Module - Employees (Code/Logic)
- [ ] Create an employee with status "Active"
- [ ] Verify status filter buttons appear on list page
- [ ] Edit employee and verify "→ On Leave" and "→ Terminated" buttons appear
- [ ] Click "→ On Leave" and verify status updates
- [ ] Verify "→ Active" and "→ Terminated" buttons now appear
- [ ] Click "→ Terminated" and verify no more transitions available

### HR Module - Employees (Visuals/UI)
- [ ] Employee cards show status badges with correct colors
- [ ] Status filters work correctly
- [ ] Employee card links go to edit mode

### HR Module - Leave Requests (Code/Logic)
- [ ] Create a leave request with status "Pending"
- [ ] Verify pending count badge appears in page header
- [ ] Edit pending leave request
- [ ] Verify "Approve" (green) and "Reject" (red) buttons appear
- [ ] Click "Approve" and verify status updates to "Approved"
- [ ] Verify approval buttons disappear on approved request
- [ ] Create another pending request and reject it
- [ ] Verify no more actions available on rejected request

### HR Module - Leave Requests (Visuals/UI)
- [ ] Leave request cards show status badges
- [ ] Status filters work correctly
- [ ] Pending count is displayed prominently
- [ ] Approve/Reject buttons are styled correctly (green/red)
- [ ] Buttons disable during API call

### Generic Entity Pages (Data/Config)
- [ ] Entities without status field do not show status transitions
- [ ] Entities without reservation fields do not show stock availability panel
- [ ] Entities without mixin config do not show workflow buttons
- [ ] Custom status lists in mixin config are respected
- [ ] Custom transitions in mixin config are respected

### Generic Entity Pages (Tests)
- [ ] Generate ERP with multiple entities with different mixin configs
- [ ] Verify each entity renders appropriate controls
- [ ] Verify entities without lifecycle mixins still work normally
- [ ] Test with custom status transitions and verify buttons match config

---

## 5) Expected vs Not Expected

### Expected Behavior
✅ **Status badges automatically styled** based on status value (active/approved/paid = green, pending/draft/sent = amber, rejected/cancelled/terminated = red/rose, obsolete/overdue = gray)

✅ **Status transition buttons appear dynamically** based on:
- Current status value
- Configured transition rules from mixin
- Entity having a status field

✅ **Approval buttons only appear** when:
- Entity has approval config (leave requests)
- Current status is "Pending"
- User is on edit/detail page

✅ **Stock availability panel appears** when:
- Entity has reservation fields (reserved_quantity, committed_quantity, available_quantity)
- User is on edit/detail page
- Page is in edit mode (not create mode)

✅ **Status filters work** on invoice and HR list pages with real-time filtering

✅ **Cards link to edit mode** (not detail mode) for workflow-heavy modules (invoice, HR)

### Not Expected (Out of Scope)
❌ **Role-based access control** for workflow actions - all users can transition/approve (access control is a future feature)

❌ **Bulk status changes** - status can only be changed one record at a time

❌ **Status change history/audit trail** - only current status is shown (audit trail is separate feature)

❌ **Conditional field visibility** based on status - all fields are always visible

❌ **Email notifications** on status change or approval - no notification system is wired

❌ **Calendar view** for leave requests - only list/card view is supported

❌ **Advanced reservation management** (create/release reservations) - only display is supported

❌ **Multi-step approval workflows** - only single-step approve/reject is supported

❌ **Comments or rejection reasons** - status changes have no attached metadata

---

## 6) Known Risks / Follow-up

### Known Risks
**Risk**: Status transition buttons make direct API calls without validation of business rules beyond what backend mixins enforce.  
**Mitigation**: Backend mixins enforce transition rules; frontend just triggers the call. If backend rejects, error toast is shown.

**Risk**: Stock availability panel recalculates on every render if fields change.  
**Mitigation**: Uses existing data from initialData; no extra calculations in frontend. Backend is source of truth.

**Risk**: Status filter state is local; resets on page navigation.  
**Mitigation**: This is expected behavior for now. Future enhancement could use URL query params to persist filter state.

**Risk**: Mixin detection relies on field names and mixin config presence.  
**Mitigation**: This is the correct approach per architecture. If entity doesn't have mixin config or required fields, UI appropriately hides features.

### Follow-up Tasks
1. **Testing**: Create comprehensive test SDFs that exercise all mixin combinations (TE)
   - Inventory with lifecycle + reservation
   - Invoice with lifecycle + line items
   - HR with employee status + leave approval
   - Mixed entities with and without mixins

2. **Documentation**: Update user-facing docs to explain status workflows (TE)
   - How to configure lifecycle mixins in SDF
   - What status transitions are available by default
   - How to customize transitions

3. **Enhancement**: Consider adding status change confirmation dialogs with notes field (EA - future sprint)
   - Allow user to add reason for status change
   - Store change history in activity log

4. **Enhancement**: Add URL query param support for status filters (EA - future sprint)
   - Preserve filter state on page navigation
   - Enable deep linking to filtered views

5. **Enhancement**: Add bulk status update action (EA + ODD - future sprint)
   - Select multiple records
   - Change status in one operation
   - Handle partial failures gracefully

---

## 7) Blocked Dependencies

### None Blocking This Prompt
All dependencies were in place:
- Backend mixins (ODD) ✅
- Entity page generators (existing) ✅
- Tailwind styling (existing) ✅
- API service (existing) ✅

### May Block Future Work
**Future**: Role-based workflow permissions will require:
- Platform auth/permissions system enhancement (ASA + ODD)
- Frontend permission checking hooks (EA)
- SDF schema extension for workflow roles (BTB)

**Future**: Advanced approval workflows (multi-step, parallel, conditional) will require:
- Workflow engine in backend (ODD)
- Workflow visual designer in frontend (EA)
- Workflow definition in SDF (BTB + ASA)

---

## Summary

Frontend now fully supports backend mixin capabilities across inventory, invoice, and HR modules. Status transitions, approval workflows, and reservation fields are automatically rendered based on entity configuration. All changes are non-breaking and backwards-compatible with entities that don't use mixins.

**Testing Priority**: HR leave approval workflow (most complex) → Invoice lifecycle → Inventory lifecycle + reservation.

**Next Steps**: TE creates test SDFs and runs integration tests, then updates user documentation if all tests pass.
