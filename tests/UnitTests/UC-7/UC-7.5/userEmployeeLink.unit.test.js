/**
 * UC-7.5 / Plan B follow-up #5 — UserEmployeeLinkMixin tests.
 *
 * SUT: brick-library/backend-bricks/mixins/UserEmployeeLinkMixin.js
 *
 * 4 cases:
 *   1. Setting __erp_users.employee_id writes back employees.user_id
 *   2. Clearing __erp_users.employee_id clears the previous employee.user_id
 *   3. Uniqueness rejection when another user already links to the employee
 *   4. Mixin is structurally a no-op when access_control is disabled
 *      (i.e. when the assembler doesn't apply the mixin — verified by
 *      asserting the mixin shape doesn't include link logic when the
 *      injection doesn't happen). For this test we just check that the
 *      mixin factory itself returns a clean shape per role.
 */

const path = require('path');
const UserEmployeeLinkMixinFactory = require(path.resolve(
  __dirname,
  '../../../../brick-library/backend-bricks/mixins/UserEmployeeLinkMixin'
));

function buildClassFromMixin(mixin, slug) {
  const code = `class T {
    constructor(repo) {
      this.repository = repo;
      this.slug = ${JSON.stringify(slug)};
    }
    ${mixin.methods}
  }
  return T;`;
  // eslint-disable-next-line no-new-func
  return new Function(code)();
}

function buildRepo(initialState = {}) {
  const data = JSON.parse(JSON.stringify(initialState));
  return {
    _data: data,
    async findAll(slug, filter = {}) {
      const rows = data[slug] || [];
      return rows.filter((row) => {
        for (const [k, v] of Object.entries(filter)) {
          if (String(row[k] ?? '') !== String(v ?? '')) return false;
        }
        return true;
      });
    },
    async findById(slug, id) {
      return (data[slug] || []).find((r) => String(r.id) === String(id)) || null;
    },
    async update(slug, id, payload) {
      const rows = data[slug] || [];
      const idx = rows.findIndex((r) => String(r.id) === String(id));
      if (idx === -1) return null;
      rows[idx] = { ...rows[idx], ...payload };
      return rows[idx];
    },
  };
}

describe('UserEmployeeLinkMixin (UC-7.5)', () => {
  test('setting __erp_users.employee_id writes back to employees.user_id', async () => {
    const mixin = UserEmployeeLinkMixinFactory({ role: 'user' });
    const Cls = buildClassFromMixin(mixin, '__erp_users');
    const repo = buildRepo({
      __erp_users: [{ id: 'u1', username: 'alice', employee_id: null }],
      employees: [{ id: 'emp-1', name: 'Alice', user_id: null }],
    });
    const svc = new Cls(repo);
    await svc._uelSyncFromUser({ id: 'u1', employee_id: 'emp-1' }, { id: 'u1', employee_id: null });
    const employee = await repo.findById('employees', 'emp-1');
    expect(employee.user_id).toBe('u1');
  });

  test('clearing __erp_users.employee_id clears previous employee.user_id', async () => {
    const mixin = UserEmployeeLinkMixinFactory({ role: 'user' });
    const Cls = buildClassFromMixin(mixin, '__erp_users');
    const repo = buildRepo({
      __erp_users: [{ id: 'u1', username: 'alice', employee_id: 'emp-1' }],
      employees: [{ id: 'emp-1', name: 'Alice', user_id: 'u1' }],
    });
    const svc = new Cls(repo);
    await svc._uelSyncFromUser(
      { id: 'u1', employee_id: null },
      { id: 'u1', employee_id: 'emp-1' }
    );
    const employee = await repo.findById('employees', 'emp-1');
    expect(employee.user_id == null).toBe(true);
  });

  test('uniqueness rejection when another user already links to the employee', async () => {
    const mixin = UserEmployeeLinkMixinFactory({ role: 'user' });
    const Cls = buildClassFromMixin(mixin, '__erp_users');
    const repo = buildRepo({
      __erp_users: [
        { id: 'u1', employee_id: 'emp-1' },
        { id: 'u2', employee_id: null },
      ],
      employees: [{ id: 'emp-1', user_id: 'u1' }],
    });
    const svc = new Cls(repo);
    let thrown = null;
    try {
      await svc._uelEnforceUniqueOnUser({ employee_id: 'emp-1' }, { id: 'u2', employee_id: null });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeTruthy();
    expect(thrown.statusCode).toBe(409);
    expect(thrown.fieldErrors).toBeTruthy();
    expect(thrown.fieldErrors.employee_id).toBeTruthy();
  });

  test('mixin shape: role=employee returns hooks+methods independent from role=user', () => {
    const userMix = UserEmployeeLinkMixinFactory({ role: 'user' });
    const empMix = UserEmployeeLinkMixinFactory({ role: 'employee' });
    expect(typeof userMix.methods).toBe('string');
    expect(typeof empMix.methods).toBe('string');
    // Sanity: each role's methods reference the corresponding helper.
    expect(userMix.methods).toContain('_uelEnforceUniqueOnUser');
    expect(userMix.methods).toContain('_uelSyncFromUser');
    expect(empMix.methods).toContain('_uelEnforceUniqueOnEmployee');
    expect(empMix.methods).toContain('_uelSyncFromEmployee');
    // Both factories return distinct hook objects.
    expect(userMix.hooks).not.toBe(empMix.hooks);
  });
});
