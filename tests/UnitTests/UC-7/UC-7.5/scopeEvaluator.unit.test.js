/**
 * UC-7.5 / Plan B follow-up #5 — scopeEvaluator unit tests.
 *
 * SUT: brick-library/backend-bricks/rbac/scopeEvaluator.js
 *
 * 8 cases:
 *   1. self  — actor employee_id matches row.employee_id
 *   2. self  — no actor employee_id -> deny
 *   3. department — actor.department_id matches row.department_id
 *   4. manager_chain — actor is direct manager
 *   5. manager_chain — actor is grand-manager (deep chain)
 *   6. module — short-circuit allow
 *   7. all — short-circuit allow
 *   8. unknown scope -> deny; superadmin bypass beats unknown.
 */

const path = require('path');
const { evaluateScope } = require(path.resolve(
  __dirname,
  '../../../../brick-library/backend-bricks/rbac/scopeEvaluator.js'
));

function fakeRepository(employees) {
  return {
    async findById(_table, id) {
      return employees.find((e) => String(e.id) === String(id)) || null;
    },
  };
}

describe('scopeEvaluator (UC-7.5)', () => {
  test('self: actor employee_id matches row.employee_id', async () => {
    const actor = { employee_id: 'emp-1', userId: 'u1' };
    const row = { employee_id: 'emp-1' };
    expect(await evaluateScope('self', actor, row)).toBe(true);
  });

  test('self: no actor employee_id -> deny', async () => {
    const actor = { userId: 'u1' };
    const row = { employee_id: 'emp-1' };
    expect(await evaluateScope('self', actor, row)).toBe(false);
  });

  test('department: matches actor.department_id with row.department_id', async () => {
    const actor = { employee_id: 'emp-1', department_id: 'd1' };
    const row = { department_id: 'd1' };
    expect(await evaluateScope('department', actor, row)).toBe(true);
    expect(await evaluateScope('department', actor, { department_id: 'd2' })).toBe(false);
  });

  test('manager_chain: actor is direct manager of row.employee_id', async () => {
    const employees = [
      { id: 'emp-1', manager_id: 'mgr-1' },
      { id: 'mgr-1', manager_id: null },
    ];
    const actor = { employee_id: 'mgr-1' };
    const row = { employee_id: 'emp-1' };
    const ok = await evaluateScope('manager_chain', actor, row, {
      repository: fakeRepository(employees),
    });
    expect(ok).toBe(true);
  });

  test('manager_chain: deep chain (grand-manager)', async () => {
    const employees = [
      { id: 'emp-1', manager_id: 'mgr-1' },
      { id: 'mgr-1', manager_id: 'gm-1' },
      { id: 'gm-1', manager_id: null },
    ];
    const actor = { employee_id: 'gm-1' };
    const row = { employee_id: 'emp-1' };
    const cache = new Map();
    const ok = await evaluateScope('manager_chain', actor, row, {
      repository: fakeRepository(employees),
      cache,
    });
    expect(ok).toBe(true);
    // Cache should be populated
    expect(cache.has('employees:emp-1')).toBe(true);
  });

  test('module: short-circuits to allow (flat-key already passed upstream)', async () => {
    const actor = { employee_id: 'emp-1' };
    expect(await evaluateScope('module', actor, { id: 'r1' })).toBe(true);
  });

  test('all: short-circuits to allow', async () => {
    const actor = { employee_id: 'emp-1' };
    expect(await evaluateScope('all', actor, null)).toBe(true);
  });

  test('unknown scope falls back to deny; superadmin bypass overrides', async () => {
    expect(await evaluateScope('made_up', { employee_id: 'e1' }, { employee_id: 'e2' })).toBe(false);
    expect(await evaluateScope('made_up', { isSuperadmin: true }, { employee_id: 'e2' })).toBe(true);
  });
});
