// Plan D follow-up #7: status formatter tests.
//
// Verifies buildStatusFormatter produces:
//   - English projects: dictionary baked from en.json status.*.* keys.
//   - Turkish projects: Turkish strings.
//   - The emitted formatStatus() falls back to raw value when no key.
//   - Slugification of multi-word status values like "On Leave" → "on_leave".

const {
  buildStatusFormatter,
  _collectStatusValues,
  slugifyValue,
} = require('../../../../platform/assembler/generators/frontend/statusFormatter');

const SAMPLE_SDF = {
  entities: [
    {
      slug: 'leaves',
      fields: [
        {
          name: 'status',
          type: 'string',
          options: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        },
      ],
    },
    {
      slug: 'attendance_entries',
      fields: [
        {
          name: 'status',
          type: 'string',
          options: ['Present', 'Absent', 'Half Day', 'On Leave'],
        },
      ],
    },
    {
      slug: 'invoices',
      fields: [
        {
          name: 'status',
          type: 'string',
          options: ['Draft', 'Sent', 'Paid', 'Voided'],
        },
      ],
    },
    {
      // Non-status field: should not contribute to the dictionary.
      slug: 'employees',
      fields: [
        {
          name: 'department',
          type: 'string',
          options: ['Engineering', 'Sales'],
        },
      ],
    },
  ],
};

describe('UC-7.5 / statusFormatter', () => {
  // TC-UC7.5-SF-001
  test('TC-UC7.5-SF-001 — slugifyValue normalizes spaces and casing', () => {
    expect(slugifyValue('On Leave')).toBe('on_leave');
    expect(slugifyValue('Half Day')).toBe('half_day');
    expect(slugifyValue('Approved')).toBe('approved');
    expect(slugifyValue('  Pending  ')).toBe('pending');
  });

  // TC-UC7.5-SF-002
  test('TC-UC7.5-SF-002 — _collectStatusValues only picks up status fields', () => {
    const collected = _collectStatusValues(SAMPLE_SDF);
    expect(collected.has('leaves')).toBe(true);
    expect(collected.has('attendance_entries')).toBe(true);
    expect(collected.has('invoices')).toBe(true);
    expect(collected.has('employees')).toBe(false);
    expect(Array.from(collected.get('leaves'))).toEqual(
      expect.arrayContaining(['Pending', 'Approved'])
    );
  });

  // TC-UC7.5-SF-003
  test('TC-UC7.5-SF-003 — English project emits English status labels', () => {
    const source = buildStatusFormatter({ sdf: SAMPLE_SDF, language: 'en' });
    expect(source).toContain('STATUS_LABELS');
    expect(source).toContain('"leaves":');
    expect(source).toContain('"Approved": "Approved"');
    expect(source).toContain('"On Leave": "On Leave"');
    expect(source).toContain('export function formatStatus');
  });

  // TC-UC7.5-SF-004
  test('TC-UC7.5-SF-004 — Turkish project emits Turkish status labels', () => {
    const source = buildStatusFormatter({ sdf: SAMPLE_SDF, language: 'tr' });
    expect(source).toContain('"Approved": "Onaylandı"');
    expect(source).toContain('"On Leave": "İzinli"');
    expect(source).toContain('"Paid": "Ödendi"');
    expect(source).toContain('"Voided": "Geçersiz"');
  });

  // TC-UC7.5-SF-005
  test('TC-UC7.5-SF-005 — falls back to raw value when key missing (no dictionary entry)', () => {
    const sdf = {
      entities: [
        {
          slug: 'custom_workflow',
          fields: [{ name: 'status', type: 'string', options: ['Brand New', 'Closed'] }],
        },
      ],
    };
    const source = buildStatusFormatter({ sdf, language: 'tr' });
    // No translation in the dictionary, so the dictionary should be empty
    // for `custom_workflow` and the runtime helper falls back to raw value.
    expect(source).toContain('STATUS_LABELS');
    expect(source).not.toContain('Brand New');
  });

  // TC-UC7.5-SF-006
  test('TC-UC7.5-SF-006 — non-status fields are ignored', () => {
    const source = buildStatusFormatter({ sdf: SAMPLE_SDF, language: 'tr' });
    expect(source).not.toContain('"Engineering"');
  });
});
