# HR Module Default Questions (SMB-Friendly, Full-Capability Target)

## Purpose

This document defines HR default questions for non-technical SMB users.

It is intentionally broader than current implementation and assumes we want to support most HR capabilities from `hr_module_capability_research_and_gap_analysis.md`.

Users see simple business questions only.
System converts answers into structured configuration and prefilled SDF before AI generation.

---

## Design Rules

- Ask in plain language (no developer terms).
- Use branching so users only answer relevant sections.
- Keep core questions short and required.
- Ask advanced questions only after user enables that capability.
- Treat these answers as hard constraints during AI generation.

---

## User Flow

1. User selects HR module.
2. System asks Core Questions (always required).
3. System asks only the enabled Advanced Packs.
4. System generates prefilled SDF/config from answers.
5. User reviews and confirms.
6. System sends `mandatory_answers + prefilled_sdf + business_description` to AI.
7. Final AI output is validated against mandatory answers.

---

## Core Questions (Always Required)

### Q1
- ID: `hr_company_size`
- User question: "How many employees do you have?"
- Input: `choice`
- Options: `1-10`, `11-50`, `51-200`, `201-500`, `Over 500`

### Q2
- ID: `hr_employee_types`
- User question: "What types of workers do you have? (Select all)"
- Input: `multi_choice`
- Options: `Full-time`, `Part-time`, `Contract`, `Intern`, `Freelance`

### Q3
- ID: `hr_use_departments`
- User question: "Do you organize employees into departments or teams?"
- Input: `yes_no`

### Q4
- ID: `hr_track_positions`
- User question: "Do you want to track job titles and positions?"
- Input: `yes_no`

### Q5
- ID: `hr_track_managers`
- User question: "Do employees report to managers?"
- Input: `yes_no`

### Q6
- ID: `hr_track_salaries`
- User question: "Do you want to track employee salaries and compensation?"
- Input: `yes_no`

### Q7
- ID: `hr_track_leaves`
- User question: "Do employees take time off (vacation, sick leave, etc.)?"
- Input: `yes_no`

### Q8
- ID: `hr_track_attendance`
- User question: "Do you need to track attendance (clock-in/clock-out)?"
- Input: `yes_no`

### Q9
- ID: `hr_multiple_locations`
- User question: "Do employees work in multiple offices or locations?"
- Input: `yes_no`

### Q10
- ID: `hr_need_employee_documents`
- User question: "Do you need to store employee documents (contracts, IDs, certificates)?"
- Input: `yes_no`

### Q11
- ID: `hr_need_onboarding`
- User question: "Do you need onboarding checklists for new employees?"
- Input: `yes_no`

### Q12
- ID: `hr_need_offboarding`
- User question: "Do you need offboarding workflows when employees leave?"
- Input: `yes_no`

### Q13
- ID: `hr_need_performance_reviews`
- User question: "Do you conduct performance reviews?"
- Input: `yes_no`

### Q14
- ID: `hr_need_training_tracking`
- User question: "Do you need to track employee training and certifications?"
- Input: `yes_no`

### Q15
- ID: `hr_need_self_service`
- User question: "Should employees be able to view and update their own information?"
- Input: `yes_no`

---

## Advanced Pack A: Employee Master and Organization

Ask this pack for all users.

### Q16
- ID: `hr_employee_id_format`
- User question: "How do you identify employees?"
- Input: `choice`
- Options: `Auto-generated ID`, `Custom employee code`, `National ID`, `Email only`

### Q17
- ID: `hr_track_contact_info`
- User question: "What contact information do you track? (Select all)"
- Input: `multi_choice`
- Options: `Phone`, `Email`, `Address`, `Emergency contact`

### Q18
- ID: `hr_employee_statuses`
- User question: "What employee statuses do you need?"
- Input: `multi_choice`
- Options: `Active`, `On Leave`, `Probation`, `Suspended`, `Terminated`, `Retired`

### Q19
- ID: `hr_track_hire_date`
- User question: "Do you need to track hire date and employment history?"
- Input: `yes_no`

### Q20
- ID: `hr_track_personal_info`
- User question: "Do you need to track personal details (date of birth, gender, nationality)?"
- Input: `yes_no`

---

## Advanced Pack B: Department and Hierarchy

Ask when Q3 = yes.

### Q21
- ID: `hr_department_structure`
- User question: "How is your organization structured?"
- Input: `choice`
- Options: `Flat (single level)`, `Hierarchical (departments with sub-departments)`, `Matrix (multiple reporting lines)`

### Q22
- ID: `hr_department_managers`
- User question: "Does each department have a manager?"
- Input: `yes_no`

### Q23
- ID: `hr_department_locations`
- User question: "Are departments tied to specific locations?"
- Input: `yes_no`
- Condition: ask only when Q9 = yes

### Q24
- ID: `hr_department_budgets`
- User question: "Do you track budgets per department?"
- Input: `yes_no`

### Q25
- ID: `hr_cost_centers`
- User question: "Do you use cost centers for departments?"
- Input: `yes_no`

---

## Advanced Pack C: Leave and Absence Management

Ask when Q7 = yes.

### Q26
- ID: `hr_leave_types`
- User question: "What types of leave do your employees take? (Select all)"
- Input: `multi_choice`
- Options: `Vacation/Annual`, `Sick`, `Unpaid`, `Maternity`, `Paternity`, `Bereavement`, `Public holiday`, `Comp time`, `Other`

### Q27
- ID: `hr_leave_approval`
- User question: "Do leave requests need manager approval?"
- Input: `yes_no`

### Q28
- ID: `hr_leave_balance_tracking`
- User question: "Do you want to track leave balances (days remaining)?"
- Input: `yes_no`

### Q29
- ID: `hr_leave_accrual`
- User question: "Do employees earn leave days over time (accrual)?"
- Input: `yes_no`
- Condition: ask only when Q28 = yes

### Q30
- ID: `hr_leave_carry_forward`
- User question: "Can unused leave days carry forward to the next year?"
- Input: `choice`
- Options: `Yes, unlimited`, `Yes, with limit`, `No, use it or lose it`
- Condition: ask only when Q28 = yes

### Q31
- ID: `hr_leave_entitlement_by_tenure`
- User question: "Do leave entitlements increase with years of service?"
- Input: `yes_no`

### Q32
- ID: `hr_holiday_calendar`
- User question: "Do you need a company holiday calendar?"
- Input: `yes_no`

### Q33
- ID: `hr_leave_conflicts`
- User question: "Should the system warn about overlapping leave requests in the same team?"
- Input: `yes_no`

---

## Advanced Pack D: Attendance and Time Tracking

Ask when Q8 = yes.

### Q34
- ID: `hr_work_schedule`
- User question: "What are your standard working days?"
- Input: `choice`
- Options: `Monday-Friday`, `Monday-Saturday`, `Shifts/Rotating`, `Custom`

### Q35
- ID: `hr_daily_hours`
- User question: "How many hours is a standard work day?"
- Input: `choice`
- Options: `8 hours`, `9 hours`, `10 hours`, `Flexible`, `Custom`

### Q36
- ID: `hr_attendance_method`
- User question: "How do employees record attendance?"
- Input: `multi_choice`
- Options: `Manual entry`, `Clock in/out button`, `Biometric`, `QR code`, `Mobile app`

### Q37
- ID: `hr_track_overtime`
- User question: "Do you need to track overtime hours?"
- Input: `yes_no`

### Q38
- ID: `hr_overtime_approval`
- User question: "Does overtime need manager approval?"
- Input: `yes_no`
- Condition: ask only when Q37 = yes

### Q39
- ID: `hr_track_breaks`
- User question: "Do you need to track break times?"
- Input: `yes_no`

### Q40
- ID: `hr_late_absence_flags`
- User question: "Should the system flag late arrivals and absences automatically?"
- Input: `yes_no`

### Q41
- ID: `hr_timesheet_approval`
- User question: "Do timesheets need manager approval?"
- Input: `yes_no`

### Q42
- ID: `hr_shift_management`
- User question: "Do you need shift scheduling and assignment?"
- Input: `yes_no`

---

## Advanced Pack E: Compensation and Payroll Readiness

Ask when Q6 = yes.

### Q43
- ID: `hr_salary_structure`
- User question: "How is employee compensation structured?"
- Input: `choice`
- Options: `Fixed salary only`, `Salary + allowances`, `Salary + allowances + deductions`, `Hourly rate`

### Q44
- ID: `hr_allowance_types`
- User question: "What allowances do you offer? (Select all)"
- Input: `multi_choice`
- Options: `Housing`, `Transport`, `Meals`, `Phone`, `Health`, `Education`, `Other`
- Condition: ask only when Q43 includes allowances

### Q45
- ID: `hr_deduction_types`
- User question: "What deductions apply? (Select all)"
- Input: `multi_choice`
- Options: `Tax`, `Social security`, `Insurance`, `Loan repayment`, `Union dues`, `Other`
- Condition: ask only when Q43 includes deductions

### Q46
- ID: `hr_payroll_frequency`
- User question: "How often do you run payroll?"
- Input: `choice`
- Options: `Weekly`, `Bi-weekly`, `Monthly`, `Semi-monthly`

### Q47
- ID: `hr_payroll_integration`
- User question: "Do you need to export payroll data to an external payroll system?"
- Input: `yes_no`

### Q48
- ID: `hr_payslip_generation`
- User question: "Do you want to generate payslips?"
- Input: `yes_no`

### Q49
- ID: `hr_salary_history`
- User question: "Do you need to track salary change history?"
- Input: `yes_no`

---

## Advanced Pack F: Employee Lifecycle

Ask when Q11 = yes or Q12 = yes.

### Q50
- ID: `hr_onboarding_checklist`
- User question: "Do you want onboarding task checklists?"
- Input: `yes_no`
- Condition: ask only when Q11 = yes

### Q51
- ID: `hr_onboarding_tasks`
- User question: "What onboarding tasks do you track? (Select all)"
- Input: `multi_choice`
- Options: `IT setup`, `Document collection`, `Training`, `Badge/access card`, `Workspace assignment`, `Introduction meetings`
- Condition: ask only when Q50 = yes

### Q52
- ID: `hr_probation_tracking`
- User question: "Do you need to track probation periods?"
- Input: `yes_no`

### Q53
- ID: `hr_probation_duration`
- User question: "What is your standard probation period?"
- Input: `choice`
- Options: `30 days`, `60 days`, `90 days`, `6 months`, `Custom`
- Condition: ask only when Q52 = yes

### Q54
- ID: `hr_offboarding_checklist`
- User question: "Do you want offboarding task checklists?"
- Input: `yes_no`
- Condition: ask only when Q12 = yes

### Q55
- ID: `hr_offboarding_tasks`
- User question: "What offboarding tasks do you track? (Select all)"
- Input: `multi_choice`
- Options: `Exit interview`, `Return equipment`, `Revoke access`, `Final settlement`, `Knowledge transfer`, `Reference letter`
- Condition: ask only when Q54 = yes

### Q56
- ID: `hr_exit_reason_tracking`
- User question: "Do you want to track reasons for employee departure?"
- Input: `yes_no`

---

## Advanced Pack G: Performance and Development

Ask when Q13 = yes or Q14 = yes.

### Q57
- ID: `hr_review_frequency`
- User question: "How often do you conduct performance reviews?"
- Input: `choice`
- Options: `Quarterly`, `Semi-annually`, `Annually`, `Custom`
- Condition: ask only when Q13 = yes

### Q58
- ID: `hr_review_type`
- User question: "What type of reviews do you conduct?"
- Input: `multi_choice`
- Options: `Manager review`, `Self-assessment`, `Peer review`, `360-degree`
- Condition: ask only when Q13 = yes

### Q59
- ID: `hr_goals_kpis`
- User question: "Do you set goals or KPIs for employees?"
- Input: `yes_no`

### Q60
- ID: `hr_development_plans`
- User question: "Do you create development plans for employees?"
- Input: `yes_no`

### Q61
- ID: `hr_training_records`
- User question: "Do you need to track completed training?"
- Input: `yes_no`
- Condition: ask only when Q14 = yes

### Q62
- ID: `hr_certification_expiry`
- User question: "Do certifications have expiry dates that need tracking?"
- Input: `yes_no`
- Condition: ask only when Q14 = yes

### Q63
- ID: `hr_training_reminders`
- User question: "Do you want reminders for upcoming certification renewals?"
- Input: `yes_no`
- Condition: ask only when Q62 = yes

---

## Advanced Pack H: HR Documents and Compliance

Ask when Q10 = yes.

### Q64
- ID: `hr_document_types`
- User question: "What employee documents do you store? (Select all)"
- Input: `multi_choice`
- Options: `Employment contract`, `ID/Passport`, `Resume/CV`, `Certificates`, `Performance reviews`, `Disciplinary records`, `Medical records`, `Other`

### Q65
- ID: `hr_document_expiry`
- User question: "Do any documents have expiry dates (for example work permits, certifications)?"
- Input: `yes_no`

### Q66
- ID: `hr_document_expiry_alerts`
- User question: "Do you want alerts before documents expire?"
- Input: `yes_no`
- Condition: ask only when Q65 = yes

### Q67
- ID: `hr_policy_acknowledgement`
- User question: "Do employees need to acknowledge company policies?"
- Input: `yes_no`

### Q68
- ID: `hr_audit_trail`
- User question: "Do you need an audit trail of HR record changes?"
- Input: `yes_no`

---

## Advanced Pack I: Self-Service and Manager Portal

Ask when Q15 = yes or Q5 = yes.

### Q69
- ID: `hr_employee_self_service`
- User question: "What can employees do themselves? (Select all)"
- Input: `multi_choice`
- Options: `View profile`, `Update contact info`, `Request leave`, `View leave balance`, `View payslips`, `Submit timesheets`
- Condition: ask only when Q15 = yes

### Q70
- ID: `hr_manager_portal`
- User question: "What can managers do? (Select all)"
- Input: `multi_choice`
- Options: `View team`, `Approve leave`, `Approve timesheets`, `Conduct reviews`, `View reports`
- Condition: ask only when Q5 = yes

### Q71
- ID: `hr_team_calendar`
- User question: "Do managers need to see team availability calendar?"
- Input: `yes_no`

### Q72
- ID: `hr_delegation`
- User question: "Can managers delegate approval to someone else when absent?"
- Input: `yes_no`

---

## Advanced Pack J: Reporting and Analytics

Ask for all users, but allow simple selections.

### Q73
- ID: `hr_report_set`
- User question: "Which HR reports do you want? (Select all)"
- Input: `multi_choice`
- Options:
  - `Headcount`
  - `Turnover/retention`
  - `Leave utilization`
  - `Attendance summary`
  - `Overtime report`
  - `Department breakdown`
  - `Tenure analysis`

### Q74
- ID: `hr_dashboard_cards`
- User question: "Which dashboard cards do you want? (Select all)"
- Input: `multi_choice`
- Options: `Headcount`, `Upcoming birthdays`, `New hires`, `Pending approvals`, `Leave calendar`, `Upcoming expirations`

### Q75
- ID: `hr_scheduled_reports`
- User question: "Do you want scheduled HR report generation?"
- Input: `yes_no`

---

## Advanced Pack K: Integration and Automation

Ask for all users (simple policy choices).

### Q76
- ID: `hr_integrations`
- User question: "Which systems should HR connect to? (Select all)"
- Input: `multi_choice`
- Options: `Payroll system`, `Accounting`, `Time clock/biometric`, `Benefits provider`, `Recruitment system`, `Other`

### Q77
- ID: `hr_data_import`
- User question: "Do you need to import employee data from spreadsheets?"
- Input: `yes_no`

### Q78
- ID: `hr_data_export`
- User question: "Do you need to export HR data for external use?"
- Input: `yes_no`

### Q79
- ID: `hr_automated_reminders`
- User question: "Do you want automated reminders for HR events (birthdays, anniversaries, expirations)?"
- Input: `yes_no`

---

## Advanced Pack L: Access and Privacy

Ask for all users with simple policy choices.

### Q80
- ID: `hr_sensitive_data_access`
- User question: "Who can see salary information?"
- Input: `choice`
- Options: `HR only`, `HR and managers`, `HR and department heads`, `Custom`

### Q81
- ID: `hr_personal_data_privacy`
- User question: "Do you need to restrict access to personal information (address, ID numbers)?"
- Input: `yes_no`

### Q82
- ID: `hr_data_retention`
- User question: "Do you have data retention requirements for terminated employees?"
- Input: `yes_no`

### Q83
- ID: `hr_gdpr_compliance`
- User question: "Do you need GDPR or data privacy compliance features?"
- Input: `yes_no`

---

## Internal Mapping Model (System Side)

This section is internal and not shown to end users.

Answers map into these configuration blocks:

- `modules.hr.enabled`
- `modules.hr.work_days` (from Q34)
- `modules.hr.daily_hours` (from Q35)
- `entities.employees` (fields based on Q16-Q20)
- `entities.departments` (when Q3 = yes)
- `entities.leaves` or `entities.leave_requests` (when Q7 = yes)
- `hr_leave_policy` (accrual, carry-forward, entitlements)
- `hr_attendance` (clock, overtime, breaks, shifts)
- `hr_compensation` (salary, allowances, deductions, payroll)
- `hr_lifecycle` (onboarding, probation, offboarding)
- `hr_performance` (reviews, goals, development)
- `hr_documents` (types, expiry, acknowledgements)
- `hr_self_service` (employee portal features)
- `hr_manager_portal` (approvals, team view)
- `hr_reporting` (dashboard cards, reports, schedule)
- `hr_integrations` (connectors, import/export)
- `hr_privacy` (access controls, data retention)

---

## Validation Gates Before AI Call

- Do not call AI if any Core Question is unanswered.
- Do not call AI if leave is enabled but leave policy answers are missing.
- Do not call AI if attendance is enabled but schedule answers are missing.
- Do not call AI if compensation is enabled but structure answers are missing.
- Do not call AI until user approves prefilled draft.

---

## AI Handoff Payload (Internal)

```json
{
  "module": "hr",
  "mandatory_answers": {
    "hr_company_size": "11-50",
    "hr_employee_types": ["Full-time", "Part-time"],
    "hr_use_departments": "yes",
    "hr_track_leaves": "yes",
    "hr_leave_approval": "yes"
  },
  "prefilled_sdf": {
    "project_name": "Example SMB HR",
    "modules": {
      "hr": { 
        "enabled": true,
        "work_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
        "daily_hours": 8
      }
    },
    "entities": []
  },
  "user_business_description": "..."
}
```

`mandatory_answers` and `prefilled_sdf` are hard constraints for AI generation.
