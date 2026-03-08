# Capability Mixins (Inventory / Invoice / HR)

Date: 2026-03-08  
Author: ODD  

## Summary
- Added new backend mixins based on capability gap research:
  - Inventory: `InventoryLifecycleMixin`, `InventoryReservationMixin`
  - Invoice: `InvoiceLifecycleMixin`
  - HR: `HREmployeeStatusMixin`, `HRLeaveApprovalMixin`
- Mixins are config-driven via `entity.mixins.<MixinName>` and are safe when fields are missing (no schema changes required).
- `BackendGenerator` now auto-applies these mixins for their respective modules.
