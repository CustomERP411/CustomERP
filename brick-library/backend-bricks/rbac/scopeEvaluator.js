/**
 * scopeEvaluator
 *
 * Plan B follow-up #5 — evaluates a row-level RBAC scope against an actor +
 * row pair. The five canonical scopes are:
 *
 *   self            — actor.employee_id matches a known actor field on the row
 *   department      — actor.department_id matches the row's department field
 *   manager_chain   — actor's employee_id appears anywhere up the row's
 *                     reporting chain (used for approver-style permissions)
 *   module          — actor has the module-level permission flag (no row check)
 *   all             — superadmin-style: any actor with the permission can act
 *
 * The evaluator is a pure function (returns true/false). Async because the
 * `manager_chain` scope walks the employees table to resolve `manager_id`.
 *
 * The signature is:
 *
 *   await evaluateScope(scope, actor, row, context)
 *
 * Where:
 *   - `scope`  is one of the five canonical strings (or unknown -> false).
 *   - `actor`  is `req.erpUser` shape: { userId, employee_id?, department_id?, isSuperadmin?, ... }
 *   - `row`    is the entity row being acted on (or null for create).
 *   - `context.repository` is required for `manager_chain` to walk relations.
 *   - `context.cache`     is an optional Map<string, employee> shared across
 *                         requests-or-row-evaluations to avoid N+1 lookups.
 *   - `context.actorFields` is an optional list of field names on the row
 *                         that count as "self" (e.g. ['requested_by',
 *                         'employee_id']). Defaults to `['employee_id',
 *                         'requested_by', 'created_by', 'submitted_by']`.
 *
 * `superadmin` actors short-circuit to true regardless of scope.
 */

const DEFAULT_SELF_FIELDS = [
  'employee_id',
  'requested_by',
  'created_by',
  'submitted_by',
];

const MAX_MANAGER_CHAIN_DEPTH = 32; // safety net against cycles

async function evaluateScope(scope, actor, row, context = {}) {
  if (!actor) return false;
  if (actor.isSuperadmin === true) return true;

  const kind = String(scope || '').trim().toLowerCase();

  switch (kind) {
    case 'all':
      return true;

    case 'module':
      // Module-scope checks are evaluated by the flat-key permission check
      // upstream. Reaching this evaluator means the flat-key already passed,
      // so module-scope is a no-op success.
      return true;

    case 'self':
      return _evaluateSelf(actor, row, context);

    case 'department':
      return _evaluateDepartment(actor, row, context);

    case 'manager_chain':
      return _evaluateManagerChain(actor, row, context);

    default:
      return false;
  }
}

function _evaluateSelf(actor, row, context) {
  if (!row) return true; // create-time: actor is implicitly self
  const actorEmployeeId = actor.employee_id || actor.employeeId || null;
  const actorUserId = actor.userId || actor.id || null;
  const fields = Array.isArray(context.actorFields) && context.actorFields.length > 0
    ? context.actorFields
    : DEFAULT_SELF_FIELDS;
  for (const field of fields) {
    const rowValue = row[field];
    if (rowValue === undefined || rowValue === null) continue;
    if (actorEmployeeId && String(rowValue) === String(actorEmployeeId)) return true;
    if (actorUserId && String(rowValue) === String(actorUserId)) return true;
  }
  return false;
}

function _evaluateDepartment(actor, row, context) {
  if (!row) return true; // create-time
  const actorDept = actor.department_id || actor.departmentId || null;
  if (!actorDept) return false;
  const fields = Array.isArray(context.departmentFields) && context.departmentFields.length > 0
    ? context.departmentFields
    : ['department_id'];
  for (const field of fields) {
    const rowValue = row[field];
    if (rowValue && String(rowValue) === String(actorDept)) return true;
  }
  return false;
}

async function _evaluateManagerChain(actor, row, context) {
  if (!row) return true;
  const actorEmployeeId = actor.employee_id || actor.employeeId || null;
  if (!actorEmployeeId) return false;

  const rowEmployeeId = _resolveRowEmployee(row, context);
  if (!rowEmployeeId) return false;
  if (String(rowEmployeeId) === String(actorEmployeeId)) {
    // The actor IS the row's employee. Manager-chain semantics ALLOW the
    // actor here because the chain trivially includes itself, BUT some
    // policies (e.g. "you cannot approve your own leave") want to deny
    // self. Callers express that via a separate invariant; this evaluator
    // sticks to the chain definition.
    return true;
  }

  const repository = context.repository;
  if (!repository || typeof repository.findById !== 'function') return false;
  const cache = context.cache instanceof Map ? context.cache : null;
  const employeesEntity = context.employeesEntity || 'employees';

  let cursor = rowEmployeeId;
  for (let depth = 0; depth < MAX_MANAGER_CHAIN_DEPTH; depth++) {
    const cacheKey = `${employeesEntity}:${cursor}`;
    let employee = cache ? cache.get(cacheKey) : undefined;
    if (employee === undefined) {
      try {
        employee = await repository.findById(employeesEntity, cursor);
      } catch (_e) {
        employee = null;
      }
      if (cache) cache.set(cacheKey, employee);
    }
    if (!employee) return false;
    const managerId = employee.manager_id || employee.managerId || null;
    if (!managerId) return false;
    if (String(managerId) === String(actorEmployeeId)) return true;
    if (String(managerId) === String(cursor)) return false; // self-loop
    cursor = managerId;
  }
  return false;
}

function _resolveRowEmployee(row, context) {
  const fields = Array.isArray(context.rowEmployeeFields) && context.rowEmployeeFields.length > 0
    ? context.rowEmployeeFields
    : ['employee_id', 'requested_by', 'submitted_by'];
  for (const field of fields) {
    const value = row[field];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

module.exports = {
  evaluateScope,
  DEFAULT_SELF_FIELDS,
  MAX_MANAGER_CHAIN_DEPTH,
};
