// Plan E C3 — sdfActorMigration label rewriting on retype + add.
//
// SUT: platform/assembler/assembler/sdfActorMigration.js
//      platform/assembler/assembler/actorRegistry.js
//
// Coverage:
//   1. Retyping a field whose existing label is missing populates spec.label.
//   2. Retyping a field whose existing label is the auto-formatted column
//      name ("Approver Id") overwrites with the canonical action-past-tense
//      form ("Approved by").
//   3. Retyping a field whose existing label is a thoughtful custom string
//      ("Manager who signs off") preserves it.
//   4. Adding a NEW actor field uses spec.label, not spec.purpose.
//   5. Already-correct __erp_users reference with auto-formatted label gets
//      fixed up too (covers AI emitting reference shape without label).
//   6. Idempotent: running twice keeps the canonical label.

const { applyActorMigration } = require(
  '../../../../platform/assembler/assembler/sdfActorMigration'
);

function buildSdfWithLeaves(extraLeaveFields = []) {
  return {
    project_name: 'T',
    modules: { access_control: { enabled: true } },
    entities: [
      {
        slug: 'leaves',
        fields: [
          { name: 'employee_id', type: 'reference', reference_entity: 'employees' },
          { name: 'start_date', type: 'date' },
          { name: 'end_date', type: 'date' },
          ...extraLeaveFields,
        ],
      },
    ],
  };
}

describe('Plan E C3 — actor migration label rewriting', () => {
  test('1. retypes approver_id with missing label → "Approved by"', () => {
    const sdf = buildSdfWithLeaves([
      { name: 'approver_id', type: 'string' },
    ]);
    const out = applyActorMigration(sdf);
    const approver = out.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.type).toBe('reference');
    expect(approver.reference_entity).toBe('__erp_users');
    expect(approver.label).toBe('Approved by');
  });

  test('2. retypes approver_id with auto-formatted label "Approver Id" → "Approved by"', () => {
    const sdf = buildSdfWithLeaves([
      { name: 'approver_id', type: 'string', label: 'Approver Id' },
    ]);
    const out = applyActorMigration(sdf);
    const approver = out.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.label).toBe('Approved by');
  });

  test('3. retype preserves a thoughtful custom label', () => {
    const sdf = buildSdfWithLeaves([
      { name: 'approver_id', type: 'string', label: 'Manager who signs off' },
    ]);
    const out = applyActorMigration(sdf);
    const approver = out.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.label).toBe('Manager who signs off');
  });

  test('4. adding a NEW actor field uses spec.label (action-past-tense)', () => {
    const sdf = buildSdfWithLeaves();
    const out = applyActorMigration(sdf);
    const requested = out.entities[0].fields.find((f) => f.name === 'requested_by');
    expect(requested).toBeDefined();
    expect(requested.label).toBe('Requested by');
    // Must NOT be the descriptive prose form.
    expect(requested.label).not.toContain('Employee who submitted');
  });

  test('5. fixes auto-formatted label on already-correct __erp_users reference', () => {
    const sdf = buildSdfWithLeaves([
      // AI emitted reference shape correctly but skipped the label rule.
      { name: 'approver_id', type: 'reference', reference_entity: '__erp_users', label: 'Approver Id' },
    ]);
    const out = applyActorMigration(sdf);
    const approver = out.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.type).toBe('reference');
    expect(approver.reference_entity).toBe('__erp_users');
    expect(approver.label).toBe('Approved by');
  });

  test('6. idempotent — running twice keeps the canonical label', () => {
    const sdf = buildSdfWithLeaves([
      { name: 'approver_id', type: 'string' },
    ]);
    const once = applyActorMigration(sdf);
    const twice = applyActorMigration(once);
    const approver = twice.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.label).toBe('Approved by');
    // No duplicate fields:
    const approverCount = twice.entities[0].fields.filter((f) => f.name === 'approver_id').length;
    expect(approverCount).toBe(1);
  });

  test('7. inventory purchase_orders.approved_by retype gets canonical label', () => {
    const sdf = {
      project_name: 'T',
      modules: { access_control: { enabled: true } },
      entities: [
        {
          slug: 'purchase_orders',
          fields: [
            { name: 'po_number', type: 'string' },
            { name: 'approved_by', type: 'string', label: 'Approved By' },
          ],
        },
      ],
    };
    const out = applyActorMigration(sdf);
    const approvedBy = out.entities[0].fields.find((f) => f.name === 'approved_by');
    expect(approvedBy.type).toBe('reference');
    expect(approvedBy.reference_entity).toBe('__erp_users');
    expect(approvedBy.label).toBe('Approved by'); // canonical lowercase 'b'
  });
});
