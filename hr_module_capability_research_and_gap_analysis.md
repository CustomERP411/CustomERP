# HR Module ERP Capability Research and Gap Analysis

## Purpose

This document lists what a full ERP HR module typically needs, then compares that list against the current CustomERP generated HR implementation.

Goal:
- define the complete capability scope,
- identify what is already implemented,
- identify what is partial,
- identify what is missing and should be added as backlog.

Assessment source:
- code in `platform/assembler/**`,
- mixins in `brick-library/backend-bricks/mixins/**`,
- SDF contract in `SDF_REFERENCE.md`,
- AI normalization/guardrails in `platform/ai-gateway/**`,
- current sprint/project docs and HR test artifacts.

Status legend:
- `Implemented` = present and usable now.
- `Partial` = some support exists, but important parts are still missing.
- `Missing` = not currently present in generated ERP.

---

## Complete HR Capability Catalog (What a full ERP HR module may require)

## 1) Employee Master and Organizational Structure
- Employee master record (identity, contact, status, hire details)
- Department structure and manager assignments
- Position/job title taxonomy
- Reporting hierarchy (manager chain)
- Employment type (full-time, part-time, contract, intern)
- Work location and assignment history

## 2) Workforce Scheduling and Time
- Work calendar and work-day configuration
- Shift definitions and shift assignments
- Attendance capture (clock-in/clock-out)
- Timesheets and overtime tracking
- Break rules and late/absence flags
- Attendance correction workflow

## 3) Leave and Absence Management
- Leave request submission and status lifecycle
- Leave policy definitions per leave type
- Leave entitlement and accrual logic
- Leave balance tracking and carry-forward
- Holiday calendar integration
- Manager approval workflow and audit trail

## 4) Compensation and Payroll Readiness
- Salary and compensation components
- Allowance and deduction structures
- Payroll period setup and lock points
- Payroll calculation inputs (attendance, leave, overtime)
- Payroll adjustments and correction records
- Payslip-ready structured payroll outputs

## 5) Employee Lifecycle Operations
- Onboarding checklist and readiness states
- Probation tracking
- Role/title transfer history
- Offboarding workflow and clearance tasks
- Exit reason tracking and final settlement inputs

## 6) Performance and Development
- Goal and KPI definition
- Performance review cycles
- Manager/employee review workflow
- Development plans and training needs
- Certification tracking with expiry dates

## 7) HR Documents and Compliance
- Contract/document registry per employee
- Policy acknowledgement tracking
- Mandatory document expiry alerts
- HR action auditability and retention

## 8) HR Self-service and Manager Workbench
- Employee self-service profile updates
- Employee leave request and leave balance view
- Manager approval queue
- Team availability overview

## 9) Reporting and Analytics
- Headcount and movement trends
- Turnover and retention metrics
- Leave utilization and leave liability insights
- Attendance variance and overtime trend
- Department-level workforce summaries

## 10) Integration and Automation
- Integration points for payroll/accounting systems
- Import/export for HR data migration
- Alerts/reminders for HR events
- Scheduled HR health checks and reports

## 11) Non-functional Requirements
- Data consistency for HR status transitions
- Concurrency-safe updates for leave balances and approvals
- Idempotent request handling for HR transaction endpoints
- Privacy-aware access control hooks for HR operations

---

## Current Coverage vs Missing Capabilities

| Capability Area | Current Status | Evidence in Current Code | Gap / Missing |
| --- | --- | --- | --- |
| HR module toggle + config contract (`enabled`, `work_days`, `daily_hours`) | Implemented | `SDF_REFERENCE.md`, `prefilledSdfService.js` | Config values forwarded into all sub-pack configs |
| HR entity validation baseline | Implemented | `_validateSdf()` in `ProjectAssembler.js` | Only `employees` is strictly required; no strict requirement for full trio |
| HR module boundary validation for entities | Implemented | `ProjectAssembler.js` validates module for `employees`, `departments`, `leaves` | No deeper HR business rule validation |
| AI prompt support for HR pattern + clarification questions | Implemented | `platform/ai-gateway/src/prompts/analyze_prompt.txt`, `clarify_prompt.txt`, `finalize_prompt.txt`, `edit_prompt.txt` | Prompt-level guidance, not full runtime policy engine |
| AI normalization auto-adds required HR entity baseline | Partial | `required_by_module` + `hr_defaults` in `platform/ai-gateway/src/services/sdf_service.py` | Auto-add flow covers `employees`; does not guarantee full set |
| HR backend mixin wiring for employees and departments | Implemented | `_resolveMixins()` in `BackendGenerator.js` | Domain workflow logic minimal but functional |
| HR leave mixin wiring for `leaves` slug | Implemented | `BackendGenerator.js` applies `HRLeaveMixin`, `HRLeaveBalanceMixin`, `HRLeaveApprovalMixin` | Wired for `leaves` slug; `leave_requests` path not automatic |
| Employee data normalization and guardrails | Implemented | `HREmployeeMixin.js` | Email validation on both create and update paths |
| Employee status validation and transitions | Implemented | `HREmployeeStatusMixin.js` | Symmetric fallback status list on create and update; configurable transitions |
| Department data normalization | Implemented | `HRDepartmentMixin.js` | No org tree constraints or manager chain rules |
| Leave date range validation and normalization | Implemented | `HRLeaveMixin.js` | Basic date validation and normalization |
| Leave balance engine (entitlement, accrual, consumption, carry-forward) | Implemented | `HRLeaveBalanceMixin.js` | Working-day-aware day calculation, auto-create balance, accrual/adjust/consume operations |
| Leave approval workflow with transition enforcement | Implemented | `HRLeaveApprovalMixin.js` | Strict transitions, approver audit, decision keys, balance consumption on approval in fallback path |
| Attendance, shift assignment, and timesheet model | Implemented | `HRAttendanceTimesheetMixin.js` | Configurable fields for check-in/out, worked hours, overtime split, timesheet sync, approval with configurable field names |
| Compensation ledger (earnings, deductions, pay-period snapshots) | Implemented | `HRCompensationLedgerMixin.js` | Configurable fields for posting, snapshot creation, all field names resolved from config |
| Prefilled SDF creates all supporting entities | Implemented | `prefilledSdfService.js` `buildHrEntities()` | Creates leaves, leave_balances, attendance_entries, shift_assignments, timesheet_entries, compensation_ledger, compensation_snapshots |
| Entity slug references in module config | Implemented | `prefilledSdfService.js` `buildPrefilledSdfDraft()` | Each sub-pack includes explicit entity slugs |
| HR-specialized list pages for employees/departments/leaves | Implemented | `hrPages.js`, `FrontendGenerator.js` | List-first UI only; no advanced workflow pages |
| HR operation pages (leave approvals, leave balances, attendance) | Implemented | `hrPriorityPages.js` | Dedicated workflow pages for Priority A operations |
| HR card components for key entities | Implemented | `EmployeeCard.tsx`, `DepartmentCard.tsx`, `LeaveRequestCard.tsx` | No calendar/timeline/approval dashboard views |
| Generic CRUD + form/edit for HR entities | Implemented | generic entity page/form generation in `entityPages.js` | No role-based HR workflow steps in UI |
| Audit trail support on HR entities | Partial | `features.audit_trail` path via `BackendGenerator.js` + `AuditMixin` support | Depends on per-entity config; not a complete HR governance model |
| Work schedule semantics from `work_days`/`daily_hours` | Implemented | Config forwarded into sub-packs, consumed by leave calc and timesheet split | Full consumption by leave and attendance engines |
| Holiday calendar support | Missing | No holiday entity/workflow in HR generator path | Needs holiday configuration and leave-day calculation |
| Onboarding/offboarding workflow | Missing | Not present in current HR mixins/pages | Needs lifecycle checkpoints and transition controls |
| Performance and development workflow | Missing | Not present in current HR module generation paths | Needs reviews, goals, and training/certification tracking |
| HR analytics workspace | Missing | No dedicated HR analytics pages in frontend generator | Needs HR reporting pages and metrics models |
| Idempotency and transactional safety for HR operations | Implemented | `withTransaction` used in leave approval, balance consumption, attendance recording, compensation snapshot, posting | Atomic provider methods attempted first with fallback |

---

## Robustness Fixes Applied

The following issues were identified and fixed during the HR module robustness overhaul:

| Fix | File(s) | Issue | Resolution |
|---|---|---|---|
| Missing supporting entities | `prefilledSdfService.js` | `leave_balances`, `shift_assignments`, `timesheet_entries`, `compensation_ledger`, `compensation_snapshots` never created | All entities now created when their capability is enabled |
| Wrong attendance field names | `prefilledSdfService.js` | Used `attendance_date`/`check_in`/`check_out` vs mixin defaults `work_date`/`check_in_at`/`check_out_at` | Field names aligned to mixin defaults |
| Missing leave fields | `prefilledSdfService.js` | No `leave_days`, no approval audit fields, missing `Cancelled` status | All fields added, status options complete |
| Missing module config refs | `prefilledSdfService.js` | No entity slug references in sub-pack configs, `work_days`/`daily_hours` not forwarded | Entity slugs and config values forwarded into all sub-packs |
| Email validation on create | `HREmployeeMixin.js` | Create path normalized email but accepted empty string | Empty-email check added after trim |
| Asymmetric status validation | `HREmployeeStatusMixin.js` | Create used `null` fallback (no validation), update used `['Active', 'On Leave', 'Terminated']` | Same fallback list on both paths |
| Approval fallback balance consumption | `HRLeaveApprovalMixin.js` | Fallback path updated status but did not consume leave balance on approval | Balance consumption inlined in fallback when `consume_on_approval` is true |
| Hardcoded timesheet approval fields | `HRAttendanceTimesheetMixin.js` | `approved_at` and `approved_by` used as literal strings | Added `timesheet_approved_at_field`/`timesheet_approved_by_field` to config |
| Hardcoded ledger posting fields | `HRCompensationLedgerMixin.js` | `posted_at` and `post_reference` used as literal strings | Added `ledger_posted_at_field`/`ledger_post_reference_field` to config |

---

## Missing Capability Backlog (Prioritized for HR Module Maturity)

## Priority A (must-have for production-grade HR) -- COMPLETED

All Priority A items have been implemented:

- ~~Implement leave policy and balance engine~~ -> `HRLeaveBalanceMixin.js` (entitlement, accrual, carry-forward, consumption, auto-create balance, working-day calculation)
- ~~Implement leave approval workflow with strict transition rules~~ -> `HRLeaveApprovalMixin.js` (status transitions, approver audit, decision keys, balance consumption)
- ~~Implement attendance, shift assignment, and timesheet core model~~ -> `HRAttendanceTimesheetMixin.js` (attendance recording, shift assignments, timesheet sync, overtime split, approval)
- ~~Implement payroll-ready compensation ledger~~ -> `HRCompensationLedgerMixin.js` (earnings, deductions, pay-period snapshots, posting)
- ~~Implement HR operation pages for leave approvals, leave balances, and attendance entries~~ -> `hrPriorityPages.js` (dedicated workflow pages)

## Priority B (important business capability expansion)
- Implement holiday calendar and policy-aware leave-day calculation. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement employee lifecycle workflow states (onboarding, active, offboarding) with required checkpoints. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement payroll review and pay-period summary pages. (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/hr/**`, `brick-library/frontend-bricks/components/**`]
- Implement employee profile timeline and manager workbench pages. (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/hr/**`, `brick-library/frontend-bricks/components/**`]
- Implement HR clarification set in AI flow for accrual rules, attendance policy, and payroll frequency. (ASA) [Allowed files: `platform/ai-gateway/src/prompts/**`, `platform/ai-gateway/src/services/sdf_service.py`, `platform/ai-gateway/src/schemas/sdf.py`, `SDF_REFERENCE.md`]

## Priority C (advanced/enterprise)
- Implement performance review and goals workflow. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement training and certification tracking with expiry alerts. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement HR analytics pages (headcount trend, turnover, leave utilization, overtime variance). (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/hr/**`, `brick-library/frontend-bricks/components/**`]
- Implement employee self-service pages for requests and profile updates with approval checkpoints. (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/hr/**`, `brick-library/frontend-bricks/components/**`]
- Implement HR document compliance workflow (contract records, acknowledgement tracking, expiry reminders). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]

---

## Notes for ASA Task: "Research HR use-cases and define missing capability list"

Research output should be finalized as:
1. target customer profile (small team, growing SMB, multi-site),
2. mandatory HR controls by profile,
3. phased implementation roadmap (A/B/C priorities),
4. measurable acceptance criteria per capability,
5. explicit ownership mapping (ASA/BTB/ODD/EA/TE).

This document can be used as the baseline reference for that task.
