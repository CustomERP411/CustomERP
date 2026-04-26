const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.ERP_JWT_SECRET || 'erp-default-secret-change-me';

let _provider = null;

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
    .then(([{ permissions, isSuperadmin }, user]) => {
      req.erpUser = {
        userId,
        id: userId,
        username: user?.username || tokenUsername || null,
        display_name: user?.display_name || user?.displayName || user?.username || tokenUsername || null,
        displayName: user?.display_name || user?.displayName || user?.username || tokenUsername || null,
        permissions,
        isSuperadmin,
      };
      next();
    })
    .catch(() => {
      req.erpUser = null;
      next();
    });
}

function requirePermission(entitySlug) {
  return (req, res, next) => {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.erpUser.isSuperadmin) return next();

    const method = String(req.method).toUpperCase();
    let action;
    switch (method) {
      case 'POST':   action = 'create'; break;
      case 'PUT':
      case 'PATCH':  action = 'update'; break;
      case 'DELETE': action = 'delete'; break;
      default:       action = 'read';   break;
    }

    const key = `${entitySlug}.${action}`;
    if (req.erpUser.permissions.has(key)) return next();

    return res.status(403).json({ error: `Permission denied: ${key}` });
  };
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
  JWT_SECRET,
};
