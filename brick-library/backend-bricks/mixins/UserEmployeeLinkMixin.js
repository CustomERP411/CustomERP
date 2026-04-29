/**
 * UserEmployeeLinkMixin
 *
 * Plan B follow-up #5 — keeps `__erp_users.employee_id` and
 * `employees.user_id` in sync. Applied to BOTH services:
 *
 *   - `__erp_users` service with role: 'user'
 *   - `employees`   service with role: 'employee'
 *
 * Sync rules:
 *
 *   - Setting `__erp_users.employee_id` writes back `employees.user_id`
 *     on the matching employee row (and clears the previous link, if any).
 *   - Setting `employees.user_id` writes back `__erp_users.employee_id`
 *     on the matching user row (and clears the previous link, if any).
 *   - Both fields are optional and both unique among non-null values; a
 *     write that would create a duplicate link throws a 409.
 *
 * No-op when access control is disabled (the link fields aren't injected
 * by `_withAccessControlEntities` in that case, so the mixin has nothing
 * to sync against).
 *
 * Idempotent: writing the same value twice resolves to a no-op.
 *
 * Configuration (passed via assembler):
 *   {
 *     role: 'user' | 'employee',
 *     users_entity:     '__erp_users',  // overrideable
 *     employees_entity: 'employees',
 *   }
 */

module.exports = (config = {}) => {
  const c = {
    role: 'user',
    users_entity: '__erp_users',
    employees_entity: 'employees',
    user_link_field: 'employee_id',
    employee_link_field: 'user_id',
    ...config,
  };
  const role = String(c.role || 'user').toLowerCase();
  const CFG = JSON.stringify(c);

  if (role === 'employee') {
    return {
      dependencies: [],
      hooks: {
        BEFORE_CREATE_VALIDATION: `
          await this._uelEnforceUniqueOnEmployee(data, null);
        `,
        BEFORE_UPDATE_VALIDATION: `
          this._uelPrevEmployee = await this.repository.findById(this.slug, id);
          await this._uelEnforceUniqueOnEmployee(data, this._uelPrevEmployee);
        `,
        AFTER_CREATE_LOGGING: `
          try {
            await this._uelSyncFromEmployee(result || data, null);
          } catch (err) {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[UserEmployeeLink] post-create employee sync failed: ' + (err && err.message));
            }
          }
        `,
        AFTER_UPDATE_LOGGING: `
          try {
            await this._uelSyncFromEmployee(result || data, this._uelPrevEmployee || null);
          } catch (err) {
            if (typeof console !== 'undefined' && console.error) {
              console.error('[UserEmployeeLink] post-update employee sync failed: ' + (err && err.message));
            }
          } finally {
            this._uelPrevEmployee = null;
          }
        `,
      },
      methods: `
async _uelEnforceUniqueOnEmployee(data, prevState) {
  const C = ${CFG};
  if (!data || !Object.prototype.hasOwnProperty.call(data, C.employee_link_field)) return;
  const userId = data[C.employee_link_field];
  if (userId === null || userId === undefined || userId === '') return;
  let rows = [];
  try {
    rows = await this.repository.findAll(this.slug, { [C.employee_link_field]: userId });
  } catch (_e) { rows = []; }
  for (const row of rows || []) {
    if (!row) continue;
    if (prevState && String(row.id) === String(prevState.id)) continue;
    const err = new Error('User is already linked to another employee');
    err.statusCode = 409;
    err.fieldErrors = { [C.employee_link_field]: { code: 'user_already_linked', message: err.message } };
    throw err;
  }
}

async _uelSyncFromEmployee(employeeRow, prevEmployee) {
  const C = ${CFG};
  if (!employeeRow) return;
  const nextUserId = employeeRow[C.employee_link_field];
  const prevUserId = prevEmployee ? prevEmployee[C.employee_link_field] : null;
  if (String(nextUserId || '') === String(prevUserId || '')) return;
  if (prevUserId) {
    try {
      const prev = await this.repository.findById(C.users_entity, prevUserId);
      if (prev && String(prev[C.user_link_field]) === String(employeeRow.id)) {
        await this.repository.update(C.users_entity, prevUserId, { [C.user_link_field]: null });
      }
    } catch (_e) { /* ignore — best-effort cleanup */ }
  }
  if (nextUserId) {
    try {
      await this.repository.update(C.users_entity, nextUserId, { [C.user_link_field]: employeeRow.id });
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[UserEmployeeLink] could not write back __erp_users.employee_id: ' + (err && err.message));
      }
    }
  }
}
`,
    };
  }

  // role === 'user'
  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_VALIDATION: `
        await this._uelEnforceUniqueOnUser(data, null);
      `,
      BEFORE_UPDATE_VALIDATION: `
        this._uelPrevUser = await this.repository.findById(this.slug, id);
        await this._uelEnforceUniqueOnUser(data, this._uelPrevUser);
      `,
      AFTER_CREATE_LOGGING: `
        try {
          await this._uelSyncFromUser(result || data, null);
        } catch (err) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[UserEmployeeLink] post-create user sync failed: ' + (err && err.message));
          }
        }
      `,
      AFTER_UPDATE_LOGGING: `
        try {
          await this._uelSyncFromUser(result || data, this._uelPrevUser || null);
        } catch (err) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[UserEmployeeLink] post-update user sync failed: ' + (err && err.message));
          }
        } finally {
          this._uelPrevUser = null;
        }
      `,
    },
    methods: `
async _uelEnforceUniqueOnUser(data, prevState) {
  const C = ${CFG};
  if (!data || !Object.prototype.hasOwnProperty.call(data, C.user_link_field)) return;
  const employeeId = data[C.user_link_field];
  if (employeeId === null || employeeId === undefined || employeeId === '') return;
  let rows = [];
  try {
    rows = await this.repository.findAll(this.slug, { [C.user_link_field]: employeeId });
  } catch (_e) { rows = []; }
  for (const row of rows || []) {
    if (!row) continue;
    if (prevState && String(row.id) === String(prevState.id)) continue;
    const err = new Error('Employee is already linked to another user');
    err.statusCode = 409;
    err.fieldErrors = { [C.user_link_field]: { code: 'employee_already_linked', message: err.message } };
    throw err;
  }
}

async _uelSyncFromUser(userRow, prevUser) {
  const C = ${CFG};
  if (!userRow) return;
  const nextEmployeeId = userRow[C.user_link_field];
  const prevEmployeeId = prevUser ? prevUser[C.user_link_field] : null;
  if (String(nextEmployeeId || '') === String(prevEmployeeId || '')) return;
  if (prevEmployeeId) {
    try {
      const prev = await this.repository.findById(C.employees_entity, prevEmployeeId);
      if (prev && String(prev[C.employee_link_field]) === String(userRow.id)) {
        await this.repository.update(C.employees_entity, prevEmployeeId, { [C.employee_link_field]: null });
      }
    } catch (_e) { /* ignore — best-effort cleanup */ }
  }
  if (nextEmployeeId) {
    try {
      await this.repository.update(C.employees_entity, nextEmployeeId, { [C.employee_link_field]: userRow.id });
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[UserEmployeeLink] could not write back employees.user_id: ' + (err && err.message));
      }
    }
  }
}
`,
  };
};
