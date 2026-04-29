/**
 * UC-7.5 / Plan B follow-up #3 — sdfActorMigration unit tests.
 *
 * SUT:
 *   platform/assembler/assembler/sdfActorMigration.js   (canonical impl)
 *   platform/backend/src/services/sdfActorMigration.js  (re-export)
 *   platform/assembler/assembler/actorRegistry.js
 *
 * Coverage (8 cases):
 *   1. Adds reference field + reference_contract relation when missing.
 *   2. Retypes existing string actor field to reference -> __erp_users.
 *   3. Emits permission_scope relation when spec defines one.
 *   4. Idempotent — running twice produces an identical SDF.
 *   5. No-op when modules.access_control = { enabled: false }.
 *   6. Applies on default-on (no modules.access_control set explicitly).
 *   7. Backend re-export points at the same canonical implementation.
 *   8. applyActorMigrationToEntities mutates in place when AC enabled.
 */

const { applyActorMigration, applyActorMigrationToEntities } = require(
  '../../../../platform/assembler/assembler/sdfActorMigration'
);
const backendReexport = require(
  '../../../../platform/backend/src/services/sdfActorMigration'
);

function buildSdf(overrides = {}) {
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
        ],
      },
    ],
    ...overrides,
  };
}

describe('sdfActorMigration.applyActorMigration', () => {
  test('1. adds requested_by reference + reference_contract relation when missing', () => {
    const out = applyActorMigration(buildSdf());
    const leaves = out.entities.find((e) => e.slug === 'leaves');
    const requested = leaves.fields.find((f) => f.name === 'requested_by');
    expect(requested).toBeDefined();
    expect(requested.type).toBe('reference');
    expect(requested.reference_entity).toBe('__erp_users');
    expect(requested.required).toBe(false);
    const contract = leaves.relations.find(
      (r) => r.kind === 'reference_contract' && r.field === 'requested_by'
    );
    expect(contract).toBeDefined();
    expect(contract.target).toBe('__erp_users');
    expect(contract.when).toBe('modules.access_control.enabled');
  });

  test('2. retypes existing string approver_id field to reference -> __erp_users', () => {
    const sdf = buildSdf();
    sdf.entities[0].fields.push({ name: 'approver_id', type: 'string', label: 'Approver' });
    const out = applyActorMigration(sdf);
    const approver = out.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.type).toBe('reference');
    expect(approver.reference_entity).toBe('__erp_users');
    expect(approver.label).toBe('Approver'); // preserved
  });

  test('3. emits permission_scope relation when spec defines one', () => {
    const out = applyActorMigration(buildSdf());
    const leaves = out.entities.find((e) => e.slug === 'leaves');
    const perm = leaves.relations.find(
      (r) => r.kind === 'permission_scope' && r.permission === 'hr.leaves.approve'
    );
    expect(perm).toBeDefined();
    expect(perm.scope).toBe('manager_chain');
  });

  test('4. idempotent — running twice produces an identical SDF', () => {
    const once = applyActorMigration(buildSdf());
    const twice = applyActorMigration(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  test('5. no-op when modules.access_control.enabled === false', () => {
    const sdf = buildSdf();
    sdf.modules.access_control.enabled = false;
    const out = applyActorMigration(sdf);
    const leaves = out.entities.find((e) => e.slug === 'leaves');
    expect(leaves.fields.find((f) => f.name === 'requested_by')).toBeUndefined();
    expect(leaves.relations || []).toHaveLength(0);
  });

  test('6. applies by default when modules.access_control is not set explicitly', () => {
    const sdf = buildSdf();
    delete sdf.modules.access_control;
    const out = applyActorMigration(sdf);
    const leaves = out.entities.find((e) => e.slug === 'leaves');
    expect(leaves.fields.find((f) => f.name === 'requested_by')).toBeDefined();
  });

  test('7. backend re-export exposes the same applyActorMigration symbol', () => {
    expect(backendReexport.applyActorMigration).toBe(applyActorMigration);
    expect(backendReexport.applyActorMigrationToEntities).toBe(applyActorMigrationToEntities);
  });

  test('8. applyActorMigrationToEntities mutates the entities array in place', () => {
    const entities = [
      {
        slug: 'invoices',
        fields: [{ name: 'id', type: 'string' }],
      },
    ];
    const result = applyActorMigrationToEntities(entities, { modules: { access_control: { enabled: true } } });
    expect(result).toBe(entities); // same reference
    expect(entities[0].fields.find((f) => f.name === 'posted_by')).toBeDefined();
    expect(Array.isArray(entities[0].relations)).toBe(true);
  });

  test('preserves existing reference field when retype target already matches', () => {
    const sdf = buildSdf();
    sdf.entities[0].fields.push({
      name: 'approver_id',
      type: 'reference',
      reference_entity: '__erp_users',
    });
    const out = applyActorMigration(sdf);
    // Should not duplicate the field
    const approvers = out.entities[0].fields.filter((f) => f.name === 'approver_id');
    expect(approvers).toHaveLength(1);
    // Should still emit the contract relation
    const contracts = out.entities[0].relations.filter(
      (r) => r.kind === 'reference_contract' && r.field === 'approver_id'
    );
    expect(contracts).toHaveLength(1);
  });

  test('respects pre-existing reference to a non-__erp_users target', () => {
    const sdf = buildSdf();
    sdf.entities[0].fields.push({
      name: 'approver_id',
      type: 'reference',
      reference_entity: 'employees', // unusual but allowed
    });
    const out = applyActorMigration(sdf);
    const approver = out.entities[0].fields.find((f) => f.name === 'approver_id');
    expect(approver.reference_entity).toBe('employees'); // not overwritten
    // No reference_contract emitted (existing reference is the contract)
    const contracts = out.entities[0].relations.filter(
      (r) => r.kind === 'reference_contract' && r.field === 'approver_id'
    );
    expect(contracts).toHaveLength(0);
  });
});
