// Plan C — wizard wiring (hr.v3)
//
// Same questions as hr.v2 plus three new cross-pack link toggles
// (hr_leave_attendance_link, hr_leave_payroll_link, hr_timesheet_payroll_link)
// gated by `condition` rules so they only appear when both ends are on.
//
// Question keys, slugs, and SDF mappings match the dependencyGraph.js LINK_TOGGLES
// table — the graph is authoritative; this file just surfaces the questions.
const HR_V3_QUESTIONS = [
  {
    key: 'hr_work_days',
    prompt: 'Which days does your company work?',
    type: 'multi_choice',
    options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    required: true,
    section: 'HR Setup',
    question_number: 1,
    sdf_mapping: { target: 'modules.hr.work_days' },
    sdf_impact_notes: 'Sets modules.hr.work_days array. Forwarded into leave_engine, leave_approvals, and attendance_time sub-pack configs for working-day calculations.',
    order_index: 0,
  },
  {
    key: 'hr_daily_hours',
    prompt: 'How many hours is a normal work day?',
    type: 'choice',
    options: ['6', '7', '8', '9', '10'],
    allow_custom: true,
    required: true,
    section: 'HR Setup',
    question_number: 2,
    sdf_mapping: { target: 'modules.hr.daily_hours' },
    sdf_impact_notes: 'Sets modules.hr.daily_hours number. Forwarded into leave_engine, leave_approvals, and attendance_time sub-pack configs for overtime split calculations.',
    order_index: 1,
  },
  {
    key: 'hr_enable_leave_engine',
    prompt: 'Track who is off and how many time-off days each person has left?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 3,
    sdf_mapping: { target: 'modules.hr.leave_engine.enabled' },
    sdf_impact_notes: 'Enables modules.hr.leave_engine with entity refs (leave_entity, balance_entity). Creates leaves entity (employee_id, leave_type, start_date, end_date, leave_days, status [Pending/Approved/Rejected/Cancelled], approver_id, approved_at, rejected_at, cancelled_at, rejection_reason, decision_key). Creates leave_balances entity (employee_id, leave_type, year, annual_entitlement, accrued_days, consumed_days, carry_forward_days, available_days, last_accrual_at, note).',
    order_index: 2,
  },
  {
    key: 'hr_enable_leave_approvals',
    prompt: 'Should a manager approve time-off requests before they count?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 4,
    sdf_mapping: { target: 'modules.hr.leave_approvals.enabled' },
    sdf_impact_notes: 'Enables modules.hr.leave_approvals with enforce_transitions=true and entity refs (leave_entity, balance_entity). Creates leaves entity if not already created by Q3 (same fields). Wires HRLeaveApprovalMixin with approval workflow, status transitions, and balance consumption on approval.',
    order_index: 3,
  },
  {
    key: 'hr_enable_attendance_time',
    prompt: 'Need clock-in/clock-out (or daily hours) so you know who worked how long?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 5,
    sdf_mapping: { target: 'modules.hr.attendance_time.enabled' },
    sdf_impact_notes: 'Enables modules.hr.attendance_time with entity refs (attendance_entity, shift_entity, timesheet_entity). Creates attendance_entries entity (employee_id, work_date, check_in_at, check_out_at, worked_hours, status [Present/Absent/Half Day/On Leave], note). Creates shift_assignments entity (employee_id, shift_name, start_time, end_time, work_date). Creates timesheet_entries entity (employee_id, work_date, attendance_id, regular_hours, overtime_hours, status [Draft/Approved]).',
    order_index: 4,
  },
  {
    key: 'hr_enable_compensation_ledger',
    prompt: 'Want one place to record wages, extras, and deductions before you run payroll?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 6,
    sdf_mapping: { target: 'modules.hr.compensation_ledger.enabled' },
    sdf_impact_notes: 'Enables modules.hr.compensation_ledger with entity refs (ledger_entity, snapshot_entity). Adds salary field to employees entity. Creates compensation_ledger entity (employee_id, pay_period, component, component_type [Earning/Deduction], amount, status [Draft/Posted/Cancelled], posted_at, post_reference). Creates compensation_snapshots entity (employee_id, pay_period, gross_amount, deduction_amount, net_amount, status [Draft/Posted], posted_at, note).',
    order_index: 5,
  },
  {
    key: 'hr_leave_types',
    prompt: 'What types of leave do your employees use?',
    type: 'multi_choice',
    options: ['Sick Leave', 'Vacation / Annual', 'Unpaid Leave', 'Maternity / Paternity', 'Personal / Family'],
    allow_custom: true,
    required: true,
    section: 'HR Setup',
    question_number: 7,
    sdf_mapping: { target: 'entities.leaves.fields.leave_type.options' },
    sdf_impact_notes: 'Sets the options array on the leave_type field of the leaves entity. Also populates leave_type options on the leave_balances entity for per-type balance tracking.',
    order_index: 6,
  },

  // Plan C — cross-pack link toggles. Visible only when both ends are on
  // (handled by the existing `condition` mechanism on the visibility filter).
  // Defaults are seeded server-side via dependencyGraph.applyDependencyCoercion
  // when both ends are on but the user has not yet answered.
  {
    key: 'hr_leave_attendance_link',
    prompt: 'When time off is approved, mark those days as "out" on the attendance sheet automatically?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 8,
    sdf_mapping: { target: 'modules.hr.leave_attendance_link.enabled' },
    sdf_impact_notes:
      'When yes, the rule runner emits attendance_entries rows with status="On Leave" on leaves Pending->Approved and removes them on Approved->Cancelled.',
    order_index: 7,
    condition: {
      op: 'all',
      rules: [
        { question_key: 'hr_enable_leave_engine', equals: 'yes' },
        { question_key: 'hr_enable_attendance_time', equals: 'yes' },
      ],
    },
  },
  {
    key: 'hr_leave_payroll_link',
    prompt: 'Should unpaid leave days automatically reduce that month\'s payroll?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 9,
    sdf_mapping: { target: 'modules.hr.leave_payroll_link.enabled' },
    sdf_impact_notes:
      'When yes, approved Unpaid leaves emit a deduction line into compensation_ledger for the covered work days.',
    order_index: 8,
    condition: {
      op: 'all',
      rules: [
        { question_key: 'hr_enable_leave_engine', equals: 'yes' },
        { question_key: 'hr_enable_compensation_ledger', equals: 'yes' },
      ],
    },
  },
  {
    key: 'hr_timesheet_payroll_link',
    prompt: 'Count extra hours from time sheets toward pay automatically?',
    type: 'yes_no',
    required: true,
    section: 'HR Capabilities',
    question_number: 10,
    sdf_mapping: { target: 'modules.hr.timesheet_payroll_link.enabled' },
    sdf_impact_notes:
      'When yes, approved timesheets emit overtime earning lines into compensation_ledger for the pay period.',
    order_index: 9,
    condition: {
      op: 'all',
      rules: [
        { question_key: 'hr_enable_attendance_time', equals: 'yes' },
        { question_key: 'hr_enable_compensation_ledger', equals: 'yes' },
      ],
    },
  },
];

module.exports = {
  module: 'hr',
  version: 'hr.v3',
  template_type: 'sdf_impact_only',
  getQuestions() {
    return JSON.parse(JSON.stringify(HR_V3_QUESTIONS));
  },
};
