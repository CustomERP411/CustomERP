# HR Module Default Questions (SDF-Impact Only)

## Purpose

Every question here directly toggles a capability pack or config value in the generated SDF.
No naming, no technical jargon, no questions about things we haven't built yet.

---

## Questions

### Q1
- ID: `hr_work_days`
- User question: "Which days does your company work?"
- Input: `multi_choice`
- Options: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`
- SDF impact:
  - `modules.hr.work_days` (array of selected days)
  - Forwarded into `leave_engine`, `leave_approvals`, and `attendance_time` sub-pack configs
  - Used by leave day calculator and overtime split logic

### Q2
- ID: `hr_daily_hours`
- User question: "How many hours is a normal work day?"
- Input: `choice` (6, 7, 8, 9, 10, Custom)
- SDF impact:
  - `modules.hr.daily_hours` (number)
  - Forwarded into `leave_engine`, `leave_approvals`, and `attendance_time` sub-pack configs
  - Used by timesheet mixin to split worked hours into regular vs overtime

### Q3
- ID: `hr_enable_leave_engine`
- User question: "Do you want to track how many leave days each employee has remaining?"
- Input: `yes_no`
- SDF impact:
  - `modules.hr.leave_engine = { enabled: true, leave_entity: 'leaves', balance_entity: 'leave_balances', work_days, daily_hours, consume_on_approval }`
  - Creates `leaves` entity:
    - `employee_id` (reference -> employees, required)
    - `leave_type` (string, required, options: Sick/Vacation/Unpaid/Maternity/Paternity)
    - `start_date` (date, required)
    - `end_date` (date, required)
    - `leave_days` (integer)
    - `status` (string, required, options: Pending/Approved/Rejected/Cancelled)
    - `approver_id` (string)
    - `approved_at` (datetime)
    - `rejected_at` (datetime)
    - `cancelled_at` (datetime)
    - `rejection_reason` (text)
    - `decision_key` (string)
  - Creates `leave_balances` entity:
    - `employee_id` (reference -> employees, required)
    - `leave_type` (string, required)
    - `year` (string, required)
    - `annual_entitlement` (decimal)
    - `accrued_days` (decimal)
    - `consumed_days` (decimal)
    - `carry_forward_days` (decimal)
    - `available_days` (decimal)
    - `last_accrual_at` (datetime)
    - `note` (text)

### Q4
- ID: `hr_enable_leave_approvals`
- User question: "Do leave requests need to be approved before the employee can take time off?"
- Input: `yes_no`
- SDF impact:
  - `modules.hr.leave_approvals = { enabled: true, enforce_transitions: true, leave_entity: 'leaves', balance_entity: 'leave_balances', work_days, daily_hours }`
  - Creates `leaves` entity if not already created by Q3 (same fields)
  - Wires `HRLeaveApprovalMixin` with:
    - Status transition enforcement (Pending -> Approved/Rejected/Cancelled, Approved -> Cancelled)
    - Approver audit fields (approver_id, approved_at, rejected_at, cancelled_at, rejection_reason)
    - Idempotent decision keys
    - Balance consumption on approval when leave engine is also enabled

### Q5
- ID: `hr_enable_attendance_time`
- User question: "Do you need to track when employees arrive, leave, and how many hours they worked?"
- Input: `yes_no`
- SDF impact:
  - `modules.hr.attendance_time = { enabled: true, attendance_entity: 'attendance_entries', shift_entity: 'shift_assignments', timesheet_entity: 'timesheet_entries', work_days, daily_hours }`
  - Creates `attendance_entries` entity:
    - `employee_id` (reference -> employees, required)
    - `work_date` (date, required)
    - `check_in_at` (datetime)
    - `check_out_at` (datetime)
    - `worked_hours` (decimal)
    - `status` (string, options: Present/Absent/Half Day/On Leave)
    - `note` (text)
  - Creates `shift_assignments` entity:
    - `employee_id` (reference -> employees, required)
    - `shift_name` (string, required)
    - `start_time` (string)
    - `end_time` (string)
    - `work_date` (date)
  - Creates `timesheet_entries` entity:
    - `employee_id` (reference -> employees, required)
    - `work_date` (date, required)
    - `attendance_id` (reference -> attendance_entries)
    - `regular_hours` (decimal)
    - `overtime_hours` (decimal)
    - `status` (string, options: Draft/Approved)

### Q6
- ID: `hr_enable_compensation_ledger`
- User question: "Do you want to record salary, allowances, and deductions for payroll preparation?"
- Input: `yes_no`
- SDF impact:
  - `modules.hr.compensation_ledger = { enabled: true, ledger_entity: 'compensation_ledger', snapshot_entity: 'compensation_snapshots' }`
  - Adds `salary` (decimal) field to employees entity
  - Creates `compensation_ledger` entity:
    - `employee_id` (reference -> employees, required)
    - `pay_period` (string, required)
    - `component` (string, required)
    - `component_type` (string, required, options: Earning/Deduction)
    - `amount` (decimal, required)
    - `status` (string, options: Draft/Posted/Cancelled)
    - `posted_at` (datetime)
    - `post_reference` (string)
  - Creates `compensation_snapshots` entity:
    - `employee_id` (reference -> employees, required)
    - `pay_period` (string, required)
    - `gross_amount` (decimal)
    - `deduction_amount` (decimal)
    - `net_amount` (decimal)
    - `status` (string, options: Draft/Posted)
    - `posted_at` (datetime)
    - `note` (text)

### Q7
- ID: `hr_leave_types`
- User question: "What types of leave do your employees use?"
- Input: `multi_choice + custom`
- Options: `Sick Leave`, `Vacation / Annual`, `Unpaid Leave`, `Maternity / Paternity`, `Personal / Family`, `Custom`
- SDF impact:
  - `entities.leaves.fields.leave_type.options` (array of selected types, mapped to short names)
  - Also populates `leave_balances` leave_type options for per-type balance tracking
  - Default if unanswered: `["Sick", "Vacation", "Unpaid"]`

---

## Auto-Enabled (No Question Needed)

These are always turned on when HR module is selected:

| SDF key | Value | Reason |
|---|---|---|
| `modules.hr.enabled` | `true` | User selected HR module |
| `modules.hr.employee_entity` | `'employees'` | Core entity slug reference |
| `modules.hr.department_entity` | `'departments'` | Core entity slug reference |
| `modules.hr.leave_approvals.enforce_transitions` | `true` | Prevents invalid status jumps |

---

## Supporting Entities Created Per Capability

| Capability | Entities Created |
|---|---|
| Always (HR selected) | `departments`, `employees` |
| Leave engine (Q3) | `leaves`, `leave_balances` |
| Leave approvals (Q4) | `leaves` (if not already from Q3) |
| Attendance & time (Q5) | `attendance_entries`, `shift_assignments`, `timesheet_entries` |
| Compensation ledger (Q6) | `compensation_ledger`, `compensation_snapshots` |
| Leave types (Q7) | _(configures options on `leaves.leave_type` field)_ |

---

## SDF Output Example (all capabilities enabled)

```json
{
  "modules": {
    "hr": {
      "enabled": true,
      "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
      "daily_hours": 8,
      "employee_entity": "employees",
      "department_entity": "departments",
      "leave_engine": {
        "enabled": true,
        "leave_entity": "leaves",
        "balance_entity": "leave_balances",
        "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "daily_hours": 8,
        "consume_on_approval": true
      },
      "leave_approvals": {
        "enabled": true,
        "enforce_transitions": true,
        "leave_entity": "leaves",
        "balance_entity": "leave_balances",
        "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "daily_hours": 8
      },
      "attendance_time": {
        "enabled": true,
        "attendance_entity": "attendance_entries",
        "shift_entity": "shift_assignments",
        "timesheet_entity": "timesheet_entries",
        "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "daily_hours": 8
      },
      "compensation_ledger": {
        "enabled": true,
        "ledger_entity": "compensation_ledger",
        "snapshot_entity": "compensation_snapshots"
      }
    }
  },
  "entities": [
    {
      "slug": "departments",
      "display_name": "Departments",
      "module": "hr",
      "fields": [
        { "name": "name", "type": "string", "required": true, "unique": true },
        { "name": "location", "type": "string" }
      ]
    },
    {
      "slug": "employees",
      "display_name": "Employees",
      "module": "hr",
      "fields": [
        { "name": "first_name", "type": "string", "required": true },
        { "name": "last_name", "type": "string", "required": true },
        { "name": "email", "type": "string", "required": true, "unique": true },
        { "name": "job_title", "type": "string", "required": true },
        { "name": "hire_date", "type": "date", "required": true },
        { "name": "status", "type": "string", "required": true, "options": ["Active", "On Leave", "Terminated"] },
        { "name": "department_id", "type": "reference", "reference_entity": "departments", "required": true },
        { "name": "manager_id", "type": "reference", "reference_entity": "employees" },
        { "name": "salary", "type": "decimal" }
      ]
    },
    {
      "slug": "leaves",
      "display_name": "Leaves",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "leave_type", "type": "string", "required": true, "options": ["Sick", "Vacation", "Unpaid", "Maternity", "Paternity"] },
        { "name": "start_date", "type": "date", "required": true },
        { "name": "end_date", "type": "date", "required": true },
        { "name": "leave_days", "type": "integer" },
        { "name": "status", "type": "string", "required": true, "options": ["Pending", "Approved", "Rejected", "Cancelled"] },
        { "name": "approver_id", "type": "string" },
        { "name": "approved_at", "type": "datetime" },
        { "name": "rejected_at", "type": "datetime" },
        { "name": "cancelled_at", "type": "datetime" },
        { "name": "rejection_reason", "type": "text" },
        { "name": "decision_key", "type": "string" }
      ]
    },
    {
      "slug": "leave_balances",
      "display_name": "Leave Balances",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "leave_type", "type": "string", "required": true },
        { "name": "year", "type": "string", "required": true },
        { "name": "annual_entitlement", "type": "decimal" },
        { "name": "accrued_days", "type": "decimal" },
        { "name": "consumed_days", "type": "decimal" },
        { "name": "carry_forward_days", "type": "decimal" },
        { "name": "available_days", "type": "decimal" },
        { "name": "last_accrual_at", "type": "datetime" },
        { "name": "note", "type": "text" }
      ]
    },
    {
      "slug": "attendance_entries",
      "display_name": "Attendance Entries",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "work_date", "type": "date", "required": true },
        { "name": "check_in_at", "type": "datetime" },
        { "name": "check_out_at", "type": "datetime" },
        { "name": "worked_hours", "type": "decimal" },
        { "name": "status", "type": "string", "options": ["Present", "Absent", "Half Day", "On Leave"] },
        { "name": "note", "type": "text" }
      ]
    },
    {
      "slug": "shift_assignments",
      "display_name": "Shift Assignments",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "shift_name", "type": "string", "required": true },
        { "name": "start_time", "type": "string" },
        { "name": "end_time", "type": "string" },
        { "name": "work_date", "type": "date" }
      ]
    },
    {
      "slug": "timesheet_entries",
      "display_name": "Timesheet Entries",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "work_date", "type": "date", "required": true },
        { "name": "attendance_id", "type": "reference", "reference_entity": "attendance_entries" },
        { "name": "regular_hours", "type": "decimal" },
        { "name": "overtime_hours", "type": "decimal" },
        { "name": "status", "type": "string", "options": ["Draft", "Approved"] }
      ]
    },
    {
      "slug": "compensation_ledger",
      "display_name": "Compensation Ledger",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "pay_period", "type": "string", "required": true },
        { "name": "component", "type": "string", "required": true },
        { "name": "component_type", "type": "string", "required": true, "options": ["Earning", "Deduction"] },
        { "name": "amount", "type": "decimal", "required": true },
        { "name": "status", "type": "string", "options": ["Draft", "Posted", "Cancelled"] },
        { "name": "posted_at", "type": "datetime" },
        { "name": "post_reference", "type": "string" }
      ]
    },
    {
      "slug": "compensation_snapshots",
      "display_name": "Compensation Snapshots",
      "module": "hr",
      "fields": [
        { "name": "employee_id", "type": "reference", "reference_entity": "employees", "required": true },
        { "name": "pay_period", "type": "string", "required": true },
        { "name": "gross_amount", "type": "decimal" },
        { "name": "deduction_amount", "type": "decimal" },
        { "name": "net_amount", "type": "decimal" },
        { "name": "status", "type": "string", "options": ["Draft", "Posted"] },
        { "name": "posted_at", "type": "datetime" },
        { "name": "note", "type": "text" }
      ]
    }
  ]
}
```

---

## Validation

- All 7 questions must be answered before AI generation.
- At least one capability pack (Q3-Q6) should be enabled.
- Prefilled SDF is built from answers and shown to user for confirmation.
- Every "yes" answer creates its full entity set in the prefilled SDF (no missing supporting entities).
