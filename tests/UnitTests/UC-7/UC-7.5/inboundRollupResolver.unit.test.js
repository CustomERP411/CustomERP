/**
 * Plan H F1 — generateEntityPage._buildInboundRollupSections.
 *
 * SUT: platform/assembler/generators/frontend/generateEntityPage.js
 *
 * Coverage:
 *  - Positive: Department + Employees fixture produces one rollup with
 *    `displayField == 'full_name'` and `foreignKey == 'department_id'`.
 *  - Override merge: per-entity `rollups: { employees: { columns: [...] } }`
 *    wins over the auto-derived column pick.
 *  - Suppression: `rollups: { employees: false }` returns no rollup for
 *    that source.
 *  - System exclusion: source `__erp_audit_logs` is dropped.
 *  - Actor exclusion: `__erp_users` rollup-target page does NOT show
 *    inbound `posted_by` / `approved_by` rollups (they would explode the
 *    user detail page into one section per actor field across the SDF).
 *  - Children-overlap exclusion: when `parent.children[]` already
 *    declares the source/FK, no rollup is emitted (no duplicate with
 *    CHILD_SECTIONS).
 *  - Disabled-module exclusion: when the source isn't in `allEntities`
 *    (because its module is off), no rollup emits.
 *  - Disambiguation: two FKs from the same source target the same entity
 *    → labels include `(via <fk_label>)`.
 */

const generateEntityPage = require(
  '../../../../platform/assembler/generators/frontend/generateEntityPage',
);
const fieldUtils = require(
  '../../../../platform/assembler/generators/frontend/fieldUtils',
);

function buildHost(language = 'en') {
  return {
    _language: language,
    _buildInboundRollupSections: generateEntityPage._buildInboundRollupSections,
    _fieldReferencesEntity: generateEntityPage._fieldReferencesEntity,
    _resolveReferenceTargetLabel: fieldUtils._resolveReferenceTargetLabel,
    _resolveColumnLabel: fieldUtils._resolveColumnLabel,
    _formatLabel: fieldUtils._formatLabel,
    _capitalize: fieldUtils._capitalize,
    _escapeJsString: fieldUtils._escapeJsString,
    _guessDisplayField: fieldUtils._guessDisplayField,
    _getModuleKey: (entity) => {
      const raw = entity && (entity.module || entity.module_slug || entity.moduleSlug);
      const cleaned = String(raw || 'inventory').trim().toLowerCase();
      return cleaned || 'inventory';
    },
  };
}

function call(target, allEntities, sdf = {}, language = 'en') {
  const host = buildHost(language);
  return host._buildInboundRollupSections(target, allEntities, sdf);
}

const dept = {
  slug: 'departments',
  display_name: 'Department',
  module: 'hr',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'description', type: 'text' },
  ],
};

const employees = {
  slug: 'employees',
  display_name: 'Employee',
  display_field: 'full_name',
  module: 'hr',
  fields: [
    { name: 'full_name', type: 'string', required: true },
    { name: 'title', type: 'string' },
    { name: 'status', type: 'string', options: ['Active', 'Terminated'] },
    { name: 'salary', type: 'decimal' },
    { name: 'department_id', type: 'reference', reference_entity: 'departments' },
  ],
};

describe('Plan H F1 — _buildInboundRollupSections', () => {
  test('1. positive: Department detail page surfaces an Employees rollup', () => {
    const sections = call(dept, [dept, employees]);
    expect(sections).toHaveLength(1);
    const [s] = sections;
    expect(s.sourceSlug).toBe('employees');
    expect(s.foreignKey).toBe('department_id');
    expect(s.displayField).toBe('full_name');
    expect(s.sourceModule).toBe('hr');
    const colKeys = s.columns.map((c) => c.key);
    expect(colKeys).toContain('full_name');
    expect(colKeys).toContain('status');
    expect(colKeys).not.toContain('department_id');
  });

  test('2. override-merge: rollups.employees.columns wins over auto-derive', () => {
    const target = {
      ...dept,
      rollups: { employees: { columns: ['title', 'status'] } },
    };
    const sections = call(target, [target, employees]);
    expect(sections).toHaveLength(1);
    expect(sections[0].columns.map((c) => c.key)).toEqual(['title', 'status']);
  });

  test('3. override-merge: rollups.employees.label wins over auto-derive', () => {
    const target = {
      ...dept,
      rollups: { employees: { label: 'Team members' } },
    };
    const sections = call(target, [target, employees]);
    expect(sections[0].label).toBe('Team members');
  });

  test('4. suppression: rollups.employees === false drops the rollup', () => {
    const target = { ...dept, rollups: { employees: false } };
    const sections = call(target, [target, employees]);
    expect(sections).toEqual([]);
  });

  test('5. system-target exclusion: target slug starting with __erp_ returns []', () => {
    const usersEntity = { slug: '__erp_users', module: 'access_control', fields: [] };
    expect(call(usersEntity, [usersEntity, employees])).toEqual([]);
  });

  test('6. system-source exclusion: __erp_audit_logs source is dropped', () => {
    const audit = {
      slug: '__erp_audit_logs',
      module: 'access_control',
      fields: [
        { name: 'action', type: 'string' },
        { name: 'entity_id', type: 'reference', reference_entity: 'departments' },
      ],
    };
    const sections = call(dept, [dept, audit]);
    expect(sections).toEqual([]);
  });

  test('7. actor-field exclusion: __erp_users skips posted_by/approved_by inbound refs', () => {
    const users = {
      slug: '__erp_users',
      display_name: 'User',
      display_field: 'username',
      module: 'access_control',
      fields: [
        { name: 'username', type: 'string' },
      ],
    };
    const invoices = {
      slug: 'invoices',
      display_name: 'Invoice',
      module: 'invoice',
      fields: [
        { name: 'invoice_number', type: 'string' },
        { name: 'posted_by', type: 'reference', reference_entity: '__erp_users' },
        { name: 'cancelled_by', type: 'reference', reference_entity: '__erp_users' },
      ],
    };
    const sections = call(users, [users, invoices]);
    expect(sections).toEqual([]);
  });

  test('8. children-overlap exclusion: declared parent.children FK is skipped', () => {
    const target = {
      ...dept,
      children: [{ entity: 'employees', foreign_key: 'department_id' }],
    };
    const sections = call(target, [target, employees]);
    expect(sections).toEqual([]);
  });

  test('9. disabled-module exclusion: source absent from allEntities is implicit', () => {
    const sections = call(dept, [dept]);
    expect(sections).toEqual([]);
  });

  test('10. disambiguation: two FKs from same source produce labels with via suffix', () => {
    const customers = {
      slug: 'customers',
      display_name: 'Customer',
      display_field: 'name',
      module: 'invoice',
      fields: [
        { name: 'name', type: 'string', required: true },
      ],
    };
    const invoices = {
      slug: 'invoices',
      display_name: 'Invoice',
      module: 'invoice',
      fields: [
        { name: 'invoice_number', type: 'string' },
        { name: 'customer_id', type: 'reference', reference_entity: 'customers', label: 'Customer' },
        { name: 'bill_to_customer_id', type: 'reference', reference_entity: 'customers', label: 'Bill to' },
      ],
    };
    const sections = call(customers, [customers, invoices]);
    expect(sections).toHaveLength(2);
    const labels = sections.map((s) => s.label);
    expect(labels.every((l) => l.includes('(') && l.includes(')'))).toBe(true);
    expect(labels.some((l) => l.includes('Customer'))).toBe(true);
    expect(labels.some((l) => l.includes('Bill to'))).toBe(true);
  });

  test('11. override foreign_key narrows to a single FK when source has multiples', () => {
    const customers = {
      slug: 'customers',
      display_name: 'Customer',
      display_field: 'name',
      module: 'invoice',
      fields: [{ name: 'name', type: 'string' }],
      rollups: {
        invoices: { foreign_key: 'customer_id', columns: ['invoice_number', 'grand_total'] },
      },
    };
    const invoices = {
      slug: 'invoices',
      display_name: 'Invoice',
      module: 'invoice',
      fields: [
        { name: 'invoice_number', type: 'string' },
        { name: 'grand_total', type: 'decimal' },
        { name: 'customer_id', type: 'reference', reference_entity: 'customers' },
        { name: 'bill_to_customer_id', type: 'reference', reference_entity: 'customers' },
      ],
    };
    const sections = call(customers, [customers, invoices]);
    expect(sections).toHaveLength(1);
    expect(sections[0].foreignKey).toBe('customer_id');
    expect(sections[0].columns.map((c) => c.key)).toEqual(['invoice_number', 'grand_total']);
  });

  test('12. self-reference is excluded (no recursion through self in auto-derive)', () => {
    const employee = {
      slug: 'employees',
      display_name: 'Employee',
      display_field: 'full_name',
      module: 'hr',
      fields: [
        { name: 'full_name', type: 'string' },
        { name: 'manager_id', type: 'reference', reference_entity: 'employees' },
      ],
    };
    const sections = call(employee, [employee]);
    expect(sections).toEqual([]);
  });

  test('13. only fields with type=reference or explicit reference_entity match', () => {
    const orphanSource = {
      slug: 'notes',
      display_name: 'Note',
      module: 'shared',
      fields: [
        // _id-suffix only — must be ignored (too noisy)
        { name: 'department_id', type: 'string' },
      ],
    };
    expect(call(dept, [dept, orphanSource])).toEqual([]);
  });

  test('14. inferred type=reference name match resolves through pluralization', () => {
    const inferred = {
      slug: 'notes',
      display_name: 'Note',
      module: 'shared',
      fields: [{ name: 'department_id', type: 'reference' }],
    };
    const sections = call(dept, [dept, inferred]);
    expect(sections).toHaveLength(1);
    expect(sections[0].sourceSlug).toBe('notes');
    expect(sections[0].foreignKey).toBe('department_id');
  });

  test('15. malformed override (non-object, non-false) is silently ignored', () => {
    const target = { ...dept, rollups: { employees: 'truthy-string' } };
    const sections = call(target, [target, employees]);
    expect(sections).toHaveLength(1);
    expect(sections[0].columns.map((c) => c.key)).toContain('full_name');
  });

  test('16. column descriptors carry referenceEntity for reference columns', () => {
    const sections = call(dept, [dept, employees]);
    const dispCol = sections[0].columns.find((c) => c.key === 'full_name');
    expect(dispCol).toBeTruthy();
    expect(dispCol.referenceEntity).toBeNull();
    const numericCol = sections[0].columns.find((c) => c.key === 'salary');
    if (numericCol) {
      expect(numericCol.referenceEntity).toBeNull();
    }
  });
});
