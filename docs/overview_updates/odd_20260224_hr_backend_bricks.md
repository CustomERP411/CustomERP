# HR Backend Bricks (Phase 5)

Date: 2026-02-24  
Author: ODD  

## Summary
- Added HR backend mixins for `employees`, `departments`, and `leaves` to normalize common fields and enforce basic date sanity.
- No approval workflow, accrual logic, or attendance entities included; this is a minimal brick layer for Phase 5.

## Details
- `HREmployeeMixin`: trims name/job title, lowercases emails, normalizes `hire_date` to ISO when valid.
- `HRDepartmentMixin`: trims `name` and `location`.
- `HRLeaveMixin`: validates `start_date`/`end_date` range and normalizes dates to ISO when valid.

## Notes / Follow-up
- Generator wiring to apply these mixins for HR entities is a separate Phase‑5 task.
