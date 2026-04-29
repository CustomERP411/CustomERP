// Plan D follow-up #7: localization lint unit tests.
//
// Verifies sdfLocalizationLint:
//   - Detects unkeyed user-facing strings (entity / field / option / action / invariant).
//   - Severity is 'block' for non-English projects, 'warn' for English.
//   - Strings already shaped as dot-path keys are treated as keyed.
//   - Strings that resolve in the dictionary are treated as keyed.
//   - Status enum values pass when either `entity.*.field.*.option.*` or
//     the cross-cutting `status.<slug>.<value>` key resolves.

const lint = require('../../../../platform/assembler/assembler/sdfLocalizationLint');

describe('UC-7.5 / sdfLocalizationLint', () => {
  // TC-UC7.5-LOC-001
  test('TC-UC7.5-LOC-001 — flags raw English label on a Turkish project as block-severity', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'Leave Requests',
          fields: [],
        },
      ],
    };
    const dict = {};
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary: dict });
    expect(report.severity).toBe('block');
    expect(report.unkeyedCount).toBeGreaterThan(0);
    const finding = report.findings.find(
      (f) => f.path === 'entities[leaves].display_name'
    );
    expect(finding).toBeDefined();
    expect(finding.suggestedKey).toBe('entity.leaves.label');
    expect(finding.severity).toBe('block');
  });

  // TC-UC7.5-LOC-002
  test('TC-UC7.5-LOC-002 — same project on English emits warn-severity findings', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'Leave Requests',
          fields: [],
        },
      ],
    };
    const dict = {};
    const report = lint.lintSdfLocalization(sdf, { language: 'en', dictionary: dict });
    expect(report.severity).toBe('warn');
    const finding = report.findings.find(
      (f) => f.path === 'entities[leaves].display_name'
    );
    expect(finding.severity).toBe('warn');
  });

  // TC-UC7.5-LOC-003
  test('TC-UC7.5-LOC-003a — strings shaped as dot-path keys pass when dictionary covers them (TR)', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [
            { name: 'reason', label: 'entity.leaves.field.reason.label' },
          ],
        },
      ],
    };
    const dictionary = {
      entity: {
        leaves: {
          label: 'Leave Requests',
          field: { reason: { label: 'Reason' } },
        },
      },
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary });
    expect(report.unkeyedCount).toBe(0);
    expect(report.findings).toEqual([]);
  });

  // TC-UC7.5-LOC-003b — Plan J dictionary-completeness check
  test('TC-UC7.5-LOC-003b — dot-path keys with no dictionary entry block on TR projects (Plan J)', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [],
        },
      ],
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary: {} });
    expect(report.severity).toBe('block');
    expect(report.unkeyedCount).toBe(1);
    const finding = report.findings.find(
      (f) => f.path === 'entities[leaves].display_name'
    );
    expect(finding).toBeDefined();
    expect(finding.reason).toBe('dictionary_missing_entry');
    expect(finding.severity).toBe('block');
  });

  // TC-UC7.5-LOC-003c — dictionary completeness is not enforced on EN projects
  test('TC-UC7.5-LOC-003c — dot-path keys with no dictionary entry pass on EN projects', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [],
        },
      ],
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'en', dictionary: {} });
    expect(report.unkeyedCount).toBe(0);
    expect(report.findings).toEqual([]);
  });

  // TC-UC7.5-LOC-004
  test('TC-UC7.5-LOC-004 — strings that resolve in the en dictionary are not flagged', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'Leave Requests',
          fields: [
            { name: 'reason', label: 'Reason' },
          ],
        },
      ],
    };
    const dictionary = {
      entity: {
        leaves: {
          label: 'Leave Requests',
          field: { reason: { label: 'Reason' } },
        },
      },
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary });
    expect(report.unkeyedCount).toBe(0);
  });

  // TC-UC7.5-LOC-005
  test('TC-UC7.5-LOC-005 — status enum option passes when status.<slug>.<value> resolves', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [
            {
              name: 'status',
              type: 'string',
              options: ['Approved'],
            },
          ],
        },
      ],
    };
    const dictionary = {
      entity: { leaves: { label: 'Leave Requests' } },
      status: { leaves: { approved: 'Onaylandı' } },
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary });
    expect(report.unkeyedCount).toBe(0);
  });

  // TC-UC7.5-LOC-006
  test('TC-UC7.5-LOC-006 — invariant message gets a suggested error key', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [],
          relations: [
            {
              kind: 'invariant',
              id: 'end_after_start',
              rule: 'end_date >= start_date',
              message: 'End date must come after start date',
            },
          ],
        },
      ],
    };
    const dictionary = {
      entity: { leaves: { label: 'Leave Requests' } },
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary });
    const finding = report.findings.find(
      (f) => f.path === 'entities[leaves].relations[0].message'
    );
    expect(finding).toBeDefined();
    expect(finding.suggestedKey).toBe('entity.leaves.error.end_after_start');
  });

  // TC-UC7.5-LOC-007
  test('TC-UC7.5-LOC-007 — slugifyValue handles spaces, casing, and punctuation', () => {
    expect(lint._slugifyValue('On Leave')).toBe('on_leave');
    expect(lint._slugifyValue('Half Day')).toBe('half_day');
    expect(lint._slugifyValue('Voided')).toBe('voided');
    expect(lint._slugifyValue('  Pending  ')).toBe('pending');
    expect(lint._slugifyValue('Credit/Debit')).toBe('credit_debit');
  });

  // TC-UC7.5-LOC-008
  test('TC-UC7.5-LOC-008 — empty SDF / no entities yields no findings', () => {
    expect(lint.lintSdfLocalization(null).unkeyedCount).toBe(0);
    expect(lint.lintSdfLocalization({}).unkeyedCount).toBe(0);
    expect(lint.lintSdfLocalization({ entities: [] }).unkeyedCount).toBe(0);
  });

  // TC-UC7.5-LOC-009 — Plan J top-level project + module strings
  test('TC-UC7.5-LOC-009 — top-level project_name and modules.*.title are walked (Plan J)', () => {
    const sdf = {
      project_name: 'Acme ERP',
      project_description: 'Inventory and invoicing for Acme.',
      modules: {
        invoice: { title: 'Invoicing', description: 'Customer invoices and payments.' },
        hr: { title: 'HR & People' },
      },
      entities: [],
    };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary: {} });
    expect(report.unkeyedCount).toBe(5);
    const paths = report.findings.map((f) => f.path).sort();
    expect(paths).toContain('project_name');
    expect(paths).toContain('project_description');
    expect(paths).toContain('modules.invoice.title');
    expect(paths).toContain('modules.invoice.description');
    expect(paths).toContain('modules.hr.title');
    const projectFinding = report.findings.find((f) => f.path === 'project_name');
    expect(projectFinding.suggestedKey).toBe('project.name');
  });

  // TC-UC7.5-LOC-010 — Plan J bulk_actions walk (array shape)
  test('TC-UC7.5-LOC-010 — bulk_actions array is walked symmetric to actions[]', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [],
          bulk_actions: [
            { id: 'bulk_approve', label: 'Approve selected', confirm: 'Approve all?' },
          ],
        },
      ],
    };
    const dictionary = { entity: { leaves: { label: 'Leave Requests' } } };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary });
    const labelFinding = report.findings.find(
      (f) => f.path === 'entities[leaves].bulk_actions[bulk_approve].label'
    );
    expect(labelFinding).toBeDefined();
    expect(labelFinding.suggestedKey).toBe('entity.leaves.bulk_action.bulk_approve.label');
    const confirmFinding = report.findings.find(
      (f) => f.path === 'entities[leaves].bulk_actions[bulk_approve].confirm'
    );
    expect(confirmFinding).toBeDefined();
  });

  // TC-UC7.5-LOC-011 — bulk_actions object shape (`bulk_actions: { actions: [...] }`)
  test('TC-UC7.5-LOC-011 — bulk_actions.actions[] object shape is walked', () => {
    const sdf = {
      entities: [
        {
          slug: 'leaves',
          display_name: 'entity.leaves.label',
          fields: [],
          bulk_actions: {
            enabled: true,
            actions: [{ id: 'bulk_export', label: 'Export selected' }],
          },
        },
      ],
    };
    const dictionary = { entity: { leaves: { label: 'Leave Requests' } } };
    const report = lint.lintSdfLocalization(sdf, { language: 'tr', dictionary });
    const finding = report.findings.find(
      (f) => f.path === 'entities[leaves].bulk_actions[bulk_export].label'
    );
    expect(finding).toBeDefined();
    expect(finding.suggestedKey).toBe('entity.leaves.bulk_action.bulk_export.label');
  });
});
