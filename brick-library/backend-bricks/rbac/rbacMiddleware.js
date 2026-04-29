const jwt = require('jsonwebtoken');

let scopeEvaluator = null;
try {
  scopeEvaluator = require('./scopeEvaluator');
} catch (_) {
  scopeEvaluator = null;
}

const JWT_SECRET = process.env.ERP_JWT_SECRET || 'erp-default-secret-change-me';

let _provider = null;

// Plan B follow-up #5: registry of entity -> permission_scope[] entries.
// Populated at boot from systemConfig.rbac.permissionScopes (passed by the
// generated index.js template). The middleware uses it for row-level scope
// checks AFTER the flat-key check has already determined that the actor has
// the broad permission. Each entry is shaped:
//   { entity, permission, scope, actions?, when?, actorFields?, rowEmployeeFields? }
const _permissionScopeRegistry = {
  byEntity: new Map(), // entitySlug -> array of scope entries
};

function setPermissionScopes(scopes = []) {
  _permissionScopeRegistry.byEntity = new Map();
  if (!Array.isArray(scopes)) return;
  for (const entry of scopes) {
    if (!entry || !entry.entity) continue;
    const list = _permissionScopeRegistry.byEntity.get(entry.entity) || [];
    list.push(entry);
    _permissionScopeRegistry.byEntity.set(entry.entity, list);
  }
}

function getPermissionScopes(entitySlug) {
  return _permissionScopeRegistry.byEntity.get(entitySlug) || [];
}

function dumpPermissionScopes() {
  const out = [];
  for (const [, list] of _permissionScopeRegistry.byEntity) {
    for (const entry of list) out.push(entry);
  }
  return out;
}

function setProvider(provider) {
  _provider = provider;
}

function getProvider() {
  if (!_provider) throw new Error('RBAC provider not initialised. Call setProvider() first.');
  return _provider;
}

async function loadUserPermissions(userId) {
  const repo = getProvider();

  const memberships = await repo.findAll('__erp_user_groups', { user_id: userId });
  if (!memberships.length) return { permissions: new Set(), isSuperadmin: false };

  const groupIds = memberships.map((m) => m.group_id);
  const groups = await repo.findAll('__erp_groups');
  const userGroups = groups.filter((g) => groupIds.includes(g.id));
  const isSuperadmin = userGroups.some((g) => String(g.name).toLowerCase() === 'superadmin');

  const allGP = await repo.findAll('__erp_group_permissions');
  const relevantGP = allGP.filter((gp) => groupIds.includes(gp.group_id));
  const permIds = [...new Set(relevantGP.map((gp) => gp.permission_id))];

  const allPerms = await repo.findAll('__erp_permissions');
  const userPerms = allPerms.filter((p) => permIds.includes(p.id));
  const keys = new Set(userPerms.map((p) => p.key));

  return { permissions: keys, isSuperadmin };
}

function rbacLoader(req, _res, next) {
  const authHeader = String(req.headers.authorization || '');
  const userIdHeader = String(req.headers['x-erp-user-id'] || '').trim();

  let userId = null;
  let tokenUsername = null;

  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      userId = decoded.userId || decoded.user_id || decoded.sub || null;
      tokenUsername = decoded.username || null;
    } catch (_) {
      /* invalid token – treat as anonymous */
    }
  }

  if (!userId && userIdHeader) {
    userId = userIdHeader;
  }

  if (!userId) {
    req.erpUser = null;
    return next();
  }

  Promise.all([
    loadUserPermissions(userId),
    getProvider().findById('__erp_users', userId).catch(() => null),
  ])
    .then(async ([{ permissions, isSuperadmin }, user]) => {
      // Plan B follow-up #5: pre-load the actor's employee row so scope
      // evaluators have employee_id / department_id / manager_chain context
      // without having to hit the DB on every requirePermission call. The
      // load is best-effort — if the employees entity does not exist or the
      // user is not linked to one, scope evaluation falls through to its
      // own defaults (deny for self/manager_chain, accept for module/all).
      let employee = null;
      const employeeId = user?.employee_id || user?.employeeId || null;
      if (employeeId) {
        try {
          employee = await getProvider().findById('employees', employeeId);
        } catch (_) {
          employee = null;
        }
      }

      req.erpUser = {
        userId,
        id: userId,
        username: user?.username || tokenUsername || null,
        display_name: user?.display_name || user?.displayName || user?.username || tokenUsername || null,
        displayName: user?.display_name || user?.displayName || user?.username || tokenUsername || null,
        permissions,
        isSuperadmin,
        employee_id: employeeId,
        department_id: employee?.department_id || null,
        manager_id: employee?.manager_id || null,
      };
      // Per-request cache for manager-chain walks; shared across multiple
      // requirePermission invocations on the same request.
      req.erpScopeCache = new Map();
      next();
    })
    .catch(() => {
      req.erpUser = null;
      next();
    });
}

function _methodToAction(method) {
  switch (String(method).toUpperCase()) {
    case 'POST':   return 'create';
    case 'PUT':
    case 'PATCH':  return 'update';
    case 'DELETE': return 'delete';
    default:       return 'read';
  }
}

function _matchesAction(scopeEntry, action) {
  if (!scopeEntry) return false;
  const acts = scopeEntry.actions;
  if (!acts) return true;
  if (Array.isArray(acts)) return acts.length === 0 || acts.includes(action);
  return false;
}

function _bestScopeForEntry(scopes, action) {
  // When multiple permission_scope entries match the same action, pick the
  // most permissive — 'all' > 'module' > 'department' > 'manager_chain' > 'self'.
  // The flat-key permission has already passed at this point, so granting
  // the most permissive scope is consistent with the user's existing rights.
  if (!Array.isArray(scopes) || scopes.length === 0) return null;
  const order = { all: 5, module: 4, department: 3, manager_chain: 2, self: 1 };
  let best = null;
  let bestRank = -1;
  for (const entry of scopes) {
    if (!_matchesAction(entry, action)) continue;
    const rank = order[String(entry.scope || '').toLowerCase()] || 0;
    if (rank > bestRank) {
      best = entry;
      bestRank = rank;
    }
  }
  return best;
}

async function _evaluateRowScopeIfNeeded(req, entitySlug, action) {
  // Returns true if access should be granted, false to deny, or null if no
  // row-level scope check applies (caller treats null as "allow because
  // flat-key already passed").
  if (!scopeEvaluator || typeof scopeEvaluator.evaluateScope !== 'function') return null;
  const scopes = getPermissionScopes(entitySlug);
  if (!scopes.length) return null;
  const entry = _bestScopeForEntry(scopes, action);
  if (!entry) return null;
  const kind = String(entry.scope || '').toLowerCase();
  // 'module' and 'all' are already covered by the flat-key check above.
  if (kind === 'module' || kind === 'all') return null;

  const id = req.params && (req.params.id || req.params.ID);
  let row = null;
  if (id) {
    try {
      row = await getProvider().findById(entitySlug, id);
    } catch (_) {
      row = null;
    }
    if (!row) return null; // 404 will surface from the controller
  } else if (action === 'create') {
    // For create with self-scope the actor IS the row's owner; let the
    // controller's data validation enforce that the actor field matches.
    return null;
  } else {
    // List/collection routes — defer row-level filtering to the service.
    return null;
  }

  return await scopeEvaluator.evaluateScope(kind, req.erpUser, row, {
    repository: getProvider(),
    cache: req.erpScopeCache,
    actorFields: entry.actorFields,
    rowEmployeeFields: entry.rowEmployeeFields,
  });
}

function requirePermission(entitySlug) {
  return async (req, res, next) => {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.erpUser.isSuperadmin) return next();

    const action = _methodToAction(req.method);
    const key = `${entitySlug}.${action}`;
    if (!req.erpUser.permissions.has(key)) {
      return res.status(403).json({ error: `Permission denied: ${key}` });
    }

    // Plan B follow-up #5: row-level scope check after flat-key passes.
    // The flat-key permission says the actor "can do X on this entity in
    // general"; the scope check narrows it to "...for this specific row".
    try {
      const allowed = await _evaluateRowScopeIfNeeded(req, entitySlug, action);
      if (allowed === false) {
        return res.status(403).json({ error: `Permission denied: ${key} (out of scope)` });
      }
    } catch (e) {
      // Defensive: scope check errors do not block the request — log and
      // fall through to the controller. This preserves backwards-compat
      // when scope metadata is misconfigured.
      console.warn('[RBAC] scope evaluation failed:', e?.message || e);
    }

    return next();
  };
}

// Service-layer helper: lets generated services / mixins evaluate scope
// against a row they have already loaded. Returns true / false.
async function evaluateRowScope(req, entitySlug, row, opts = {}) {
  if (!req || !req.erpUser) return false;
  if (req.erpUser.isSuperadmin) return true;
  if (!scopeEvaluator) return true;
  const action = opts.action || _methodToAction(req.method);
  const scopes = getPermissionScopes(entitySlug);
  const entry = _bestScopeForEntry(scopes, action);
  if (!entry) return true;
  const kind = String(entry.scope || '').toLowerCase();
  if (kind === 'module' || kind === 'all') return true;
  return await scopeEvaluator.evaluateScope(kind, req.erpUser, row, {
    repository: getProvider(),
    cache: req.erpScopeCache || new Map(),
    actorFields: entry.actorFields,
    rowEmployeeFields: entry.rowEmployeeFields,
  });
}

function signToken(payload, expiresIn = '24h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  setProvider,
  getProvider,
  rbacLoader,
  requirePermission,
  loadUserPermissions,
  signToken,
  verifyToken,
  setPermissionScopes,
  getPermissionScopes,
  dumpPermissionScopes,
  evaluateRowScope,
  JWT_SECRET,
};
