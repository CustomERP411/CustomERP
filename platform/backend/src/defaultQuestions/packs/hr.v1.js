const HR_V1_TEMP_QUESTIONS = [
  {
    key: 'hr_business_size',
    prompt: 'What best describes your workforce size?',
    type: 'choice',
    options: ['1-20 employees', '21-100 employees', '101-500 employees', '500+ employees'],
    required: true,
    sdf_mapping: { target: 'constraints.hr.business_size' },
  },
  {
    key: 'hr_use_departments',
    prompt: 'Do you organize employees by departments?',
    type: 'yes_no',
    required: true,
    sdf_mapping: { target: 'constraints.hr.use_departments' },
  },
  {
    key: 'hr_employee_statuses',
    prompt: 'Which employee statuses do you need?',
    type: 'multi_choice',
    options: ['Active', 'On Leave', 'Terminated', 'Probation'],
    required: true,
    sdf_mapping: { target: 'constraints.hr.employee_statuses' },
  },
  {
    key: 'hr_require_manager_link',
    prompt: 'Should each employee have an optional manager reference?',
    type: 'yes_no',
    required: true,
    sdf_mapping: { target: 'constraints.hr.require_manager_link' },
  },
  {
    key: 'hr_track_leave',
    prompt: 'Do you want leave request tracking?',
    type: 'yes_no',
    required: true,
    sdf_mapping: { target: 'constraints.hr.track_leave' },
  },
  {
    key: 'hr_leave_types',
    prompt: 'Which leave types should be available?',
    type: 'multi_choice',
    options: ['Sick', 'Vacation', 'Unpaid', 'Maternity', 'Paternity', 'Other'],
    required: true,
    condition: {
      op: 'all',
      rules: [{ question_key: 'hr_track_leave', equals: 'yes' }],
    },
    sdf_mapping: { target: 'constraints.hr.leave_types' },
  },
  {
    key: 'hr_leave_approval_flow',
    prompt: 'Should leave requests require manager approval?',
    type: 'yes_no',
    required: true,
    condition: {
      op: 'all',
      rules: [{ question_key: 'hr_track_leave', equals: 'yes' }],
    },
    sdf_mapping: { target: 'constraints.hr.leave_approval_flow' },
  },
  {
    key: 'hr_track_attendance',
    prompt: 'Do you need attendance tracking (check-in/check-out)?',
    type: 'yes_no',
    required: true,
    sdf_mapping: { target: 'constraints.hr.track_attendance' },
  },
  {
    key: 'hr_collect_salary',
    prompt: 'Do you need salary field tracking in employee records?',
    type: 'yes_no',
    required: true,
    sdf_mapping: { target: 'constraints.hr.collect_salary' },
  },
  {
    key: 'hr_onboarding_checklist',
    prompt: 'Do you want onboarding checklist tracking for new hires?',
    type: 'yes_no',
    required: true,
    sdf_mapping: { target: 'constraints.hr.onboarding_checklist' },
  },
];

module.exports = {
  module: 'hr',
  version: 'hr.v1-temp',
  template_type: 'temporary_core',
  getQuestions() {
    return HR_V1_TEMP_QUESTIONS.map((question, index) => ({
      ...question,
      order_index: index,
      section: 'HR Core Questions (Temporary)',
    }));
  },
};
