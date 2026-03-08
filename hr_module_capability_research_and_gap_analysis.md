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
| HR module toggle + config contract (`enabled`, `work_days`, `daily_hours`) | Implemented | `SDF_REFERENCE.md`, `test/sample_sdf_hr.json` | Config is accepted, but behavior usage is limited |
| HR entity validation baseline | Implemented | `_validateSdf()` in `platform/assembler/ProjectAssembler.js` | Only `employees` is strictly required; no strict requirement for full trio |
| HR module boundary validation for entities | Implemented | `ProjectAssembler.js` validates module for `employees`, `departments`, `leaves/leave_requests` | No deeper HR business rule validation |
| AI prompt support for HR pattern + clarification questions | Implemented | `platform/ai-gateway/src/prompts/analyze_prompt.txt`, `clarify_prompt.txt`, `finalize_prompt.txt`, `edit_prompt.txt` | Prompt-level guidance, not full runtime policy engine |
| AI normalization auto-adds required HR entity baseline | Partial | `required_by_module` + `hr_defaults` in `platform/ai-gateway/src/services/sdf_service.py`; tests in `platform/ai-gateway/tests/test_sdf_service.py` | Auto-add flow covers `employees`; does not guarantee full `departments` + `leaves` set |
| HR backend mixin wiring for employees and departments | Implemented | `_resolveMixins()` in `platform/assembler/generators/BackendGenerator.js` | Domain workflow logic still minimal |
| HR leave mixin wiring for `leaves` slug | Partial | `BackendGenerator.js` applies `HRLeaveMixin` only when slug is `leaves` | `leave_requests` path does not receive the leave mixin automatically |
| Employee data normalization and guardrails | Implemented | `brick-library/backend-bricks/mixins/HREmployeeMixin.js` | No advanced employment state machine |
| Department data normalization | Implemented | `brick-library/backend-bricks/mixins/HRDepartmentMixin.js` | No org tree constraints or manager chain rules |
| Leave date range validation and normalization | Implemented | `brick-library/backend-bricks/mixins/HRLeaveMixin.js` | No leave balance/accrual/approval policy enforcement |
| HR-specialized list pages for employees/departments/leaves | Implemented | `platform/assembler/generators/frontend/hrPages.js`, `FrontendGenerator.js` | List-first UI only; no advanced workflow pages |
| HR card components for key entities | Implemented | `brick-library/frontend-bricks/components/modules/hr/EmployeeCard.tsx`, `DepartmentCard.tsx`, `LeaveRequestCard.tsx` | No calendar/timeline/approval dashboard views |
| Generic CRUD + form/edit for HR entities | Implemented | generic entity page/form generation in `platform/assembler/generators/frontend/entityPages.js` | No role-based HR workflow steps in UI |
| Audit trail support on HR entities | Partial | `features.audit_trail` path via `BackendGenerator.js` + `AuditMixin` support | Depends on per-entity config; not a complete HR governance model |
| Work schedule semantics from `work_days`/`daily_hours` | Partial | Config exists in SDF (`SDF_REFERENCE.md`), HR pages receive `hrConfig` in generator path | No attendance or scheduling engine consumes these configs |
| Attendance and shift management | Missing | No attendance/shift mixins or HR page generators beyond list pages | Needs shift, punch, and timesheet data model |
| Leave accrual and balance engine | Missing | No accrual logic in HR mixins (`HREmployeeMixin`, `HRLeaveMixin`) | Needs entitlement, carry-forward, and policy rules |
| Holiday calendar support | Missing | No holiday entity/workflow in HR generator path | Needs holiday configuration and leave-day calculation |
| Payroll-ready data model and workflow | Missing | No payroll entity/mixin/page generation in HR module paths | Needs compensation components, period logic, and outputs |
| Onboarding/offboarding workflow | Missing | Not present in current HR mixins/pages | Needs lifecycle checkpoints and transition controls |
| Performance and development workflow | Missing | Not present in current HR module generation paths | Needs reviews, goals, and training/certification tracking |
| HR analytics workspace | Missing | No dedicated HR analytics pages in frontend generator | Needs HR reporting pages and metrics models |
| Idempotency and transactional safety for HR operations | Missing | Generated runtime still flat-file baseline and no idempotency key strategy | Needs DB-backed transactional controls for HR workflows |

---

## Missing Capability Backlog (Prioritized for HR Module Maturity)

## Priority A (must-have for production-grade HR)
- Implement leave policy and balance engine (entitlement, accrual, carry-forward, and consumption rules per leave type). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement leave approval workflow with strict transition rules and approver audit fields. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement attendance, shift assignment, and timesheet core model using `work_days` and `daily_hours`. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement payroll-ready compensation ledger (earnings, deductions, pay-period snapshots). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement HR operation pages for leave approvals, leave balances, and attendance entries. (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/hr/**`, `brick-library/frontend-bricks/components/**`]

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
