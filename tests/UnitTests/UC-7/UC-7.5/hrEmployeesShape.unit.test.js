// Plan E G1 + G2 + G3 — HR entity shape coverage.
//
// SUT: platform/backend/src/services/prefilledSdfService.js (buildHrEntities
//      via buildPrefilledSdfDraft).
//
// Coverage:
//   G1: shift_assignments has NO work_date column; start_time/end_time are
//       datetime fields.
//   G2: employees has unconditional salary + salary_currency + salary_frequency,
//       even when compensation_ledger is OFF.
//   G2: Salary trio defaults match the plan (TRY/Monthly).
//   G2: When compensation_ledger is ON, salary.help references the ledger.
//   G3: employees has termination_date with visibility_when={status:Terminated}.

const path = require('path');
const { buildPrefilledSdfDraft } = require(
  '../../../../platform/backend/src/services/prefilledSdfService.js'
);

function buildHrSdf(extraAnswers = {}) {
  return buildPrefilledSdfDraft({
    projectName: 'Test',
    modules: ['hr'],
    mandatoryAnswers: extraAnswers,
    templateVersions: {},
  });
}

describe('Plan E G1 — shift_assignments has no work_date', () => {
  test('1. shift_assignments has NO work_date column', () => {
    const sdf = buildHrSdf({ hr_enable_attendance_time: 'yes' });
    const shifts = (sdf.entities || []).find((e) => e.slug === 'shift_assignments');
    expect(shifts).toBeDefined();
    const fieldNames = shifts.fields.map((f) => f.name);
    expect(fieldNames).not.toContain('work_date');
  });

  test('2. shift_assignments uses datetime for start_time and end_time', () => {
    const sdf = buildHrSdf({ hr_enable_attendance_time: 'yes' });
    const shifts = sdf.entities.find((e) => e.slug === 'shift_assignments');
    const start = shifts.fields.find((f) => f.name === 'start_time');
    const end = shifts.fields.find((f) => f.name === 'end_time');
    expect(start.type).toBe('datetime');
    expect(start.required).toBe(true);
    expect(end.type).toBe('datetime');
    expect(end.required).toBe(true);
  });

  test('3. attendance_entries STILL has work_date (untouched by Plan E)', () => {
    const sdf = buildHrSdf({ hr_enable_attendance_time: 'yes' });
    const attendance = sdf.entities.find((e) => e.slug === 'attendance_entries');
    const workDate = attendance.fields.find((f) => f.name === 'work_date');
    expect(workDate).toBeDefined();
    expect(workDate.type).toBe('date');
  });

  test('4. timesheet_entries STILL has work_date (untouched by Plan E)', () => {
    const sdf = buildHrSdf({ hr_enable_attendance_time: 'yes' });
    const ts = sdf.entities.find((e) => e.slug === 'timesheet_entries');
    const workDate = ts.fields.find((f) => f.name === 'work_date');
    expect(workDate).toBeDefined();
  });
});

describe('Plan E G2 — salary trio is unconditional on employees', () => {
  test('1. salary trio present even when compensation_ledger is OFF', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    expect(employees).toBeDefined();
    const fieldNames = employees.fields.map((f) => f.name);
    expect(fieldNames).toContain('salary');
    expect(fieldNames).toContain('salary_currency');
    expect(fieldNames).toContain('salary_frequency');
  });

  test('2. salary_currency has TRY/USD/EUR options + TRY default', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const cur = employees.fields.find((f) => f.name === 'salary_currency');
    expect(cur.options).toEqual(['TRY', 'USD', 'EUR']);
    expect(cur.default).toBe('TRY');
    expect(cur.required).toBe(false);
  });

  test('3. salary_frequency has Monthly/Yearly options + Monthly default', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const freq = employees.fields.find((f) => f.name === 'salary_frequency');
    expect(freq.options).toEqual(['Monthly', 'Yearly']);
    expect(freq.default).toBe('Monthly');
  });

  test('4. salary itself is decimal + optional', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const salary = employees.fields.find((f) => f.name === 'salary');
    expect(salary.type).toBe('decimal');
    expect(salary.required).toBe(false);
  });

  test('5. salary.help references compensation ledger when ledger is ON', () => {
    const sdf = buildHrSdf({ hr_enable_compensation_ledger: 'yes' });
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const salary = employees.fields.find((f) => f.name === 'salary');
    expect(typeof salary.help).toBe('string');
    expect(salary.help.toLowerCase()).toContain('compensation ledger');
  });

  test('6. salary.help is the simpler form when ledger is OFF', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const salary = employees.fields.find((f) => f.name === 'salary');
    expect(typeof salary.help).toBe('string');
    expect(salary.help.toLowerCase()).not.toContain('compensation ledger');
  });
});

describe('Plan E G3 — termination_date with visibility_when', () => {
  test('1. termination_date field exists on employees', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const term = employees.fields.find((f) => f.name === 'termination_date');
    expect(term).toBeDefined();
    expect(term.type).toBe('date');
    expect(term.required).toBe(false);
  });

  test('2. termination_date carries visibility_when={field:status, equals:Terminated}', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const term = employees.fields.find((f) => f.name === 'termination_date');
    expect(term.visibility_when).toEqual({ field: 'status', equals: 'Terminated' });
  });

  test('3. status options still include Terminated (so the predicate is reachable)', () => {
    const sdf = buildHrSdf({});
    const employees = sdf.entities.find((e) => e.slug === 'employees');
    const status = employees.fields.find((f) => f.name === 'status');
    expect(Array.isArray(status.options)).toBe(true);
    expect(status.options).toContain('Terminated');
  });
});
