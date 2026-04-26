const express = require('express');
const router = express.Router();
const { getProvider, signToken, rbacLoader, loadUserPermissions } = require('./rbacMiddleware');

function comparePassword(plain, hash) {
  try {
    const bcrypt = require('bcryptjs');
    return bcrypt.compareSync(plain, hash);
  } catch (_) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(plain).digest('hex') === hash;
  }
}

async function writeAuthAudit(action, user) {
  try {
    if (!user || !user.id) return;
    const repo = getProvider();
    await repo.create('__audit_logs', {
      at: new Date().toISOString(),
      action,
      entity: '__erp_users',
      entity_id: user.id,
      user_id: user.id,
      username: user.username || null,
      user_display_name: user.display_name || user.displayName || user.username || null,
      message: '',
      meta: JSON.stringify({ user_id: user.id, username: user.username || null }),
    });
  } catch (err) {
    console.warn('[AUTH-AUDIT] Failed to persist auth audit log:', err?.message || err);
  }
}

function parseDashboardConfig(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function serializeDashboardConfig(value) {
  if (value == null) return '{}';
  if (typeof value === 'string') {
    const parsed = parseDashboardConfig(value);
    return JSON.stringify(parsed || {});
  }
  return JSON.stringify(value);
}

router.get('/default-credentials', async (req, res) => {
  try {
    const repo = getProvider();
    const users = await repo.findAll('__erp_users');
    const admin = users.find((u) => u.username === 'admin');
    if (!admin) return res.json({ active: false });
    res.json({ active: comparePassword('admin', String(admin.password_hash || '')) });
  } catch {
    res.json({ active: false });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const repo = getProvider();
    const users = await repo.findAll('__erp_users', { username: String(username) });
    const user = users[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (Number(user.is_active) === 0) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    if (!comparePassword(String(password), String(user.password_hash || ''))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken({ userId: user.id, username: user.username });
    await writeAuthAudit('LOGIN', user);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
      },
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', rbacLoader, async (req, res) => {
  try {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const repo = getProvider();
    const user = await repo.findById('__erp_users', req.erpUser.userId);
    await writeAuthAudit('LOGOUT', user || { id: req.erpUser.userId, username: req.erpUser.username });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[AUTH] Logout error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', rbacLoader, async (req, res) => {
  try {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const repo = getProvider();
    const user = await repo.findById('__erp_users', req.erpUser.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { permissions, isSuperadmin } = await loadUserPermissions(user.id);

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        display_name: user.display_name,
        is_active: user.is_active,
      },
      permissions: [...permissions],
      isSuperadmin,
    });
  } catch (err) {
    console.error('[AUTH] /me error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', rbacLoader, async (req, res) => {
  try {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    if (String(new_password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const repo = getProvider();
    const user = await repo.findById('__erp_users', req.erpUser.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!comparePassword(String(current_password), String(user.password_hash || ''))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const { hashPassword } = require('./rbacSeed');
    await repo.update('__erp_users', user.id, {
      password_hash: hashPassword(String(new_password)),
    });

    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('[AUTH] change-password error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/dashboard/preferences', rbacLoader, async (req, res) => {
  try {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const repo = getProvider();
    const rows = await repo.findAll('__erp_dashboard_preferences', { user_id: req.erpUser.userId });
    const row = rows && rows[0];
    if (!row || !row.config) {
      return res.json({ config: null });
    }

    return res.json({ config: parseDashboardConfig(row.config) });
  } catch (err) {
    console.error('[AUTH] dashboard preferences read error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/dashboard/preferences', rbacLoader, async (req, res) => {
  try {
    if (!req.erpUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const config = req.body && Object.prototype.hasOwnProperty.call(req.body, 'config')
      ? req.body.config
      : req.body;
    const normalizedConfig = parseDashboardConfig(config) || {};
    const serialized = serializeDashboardConfig(normalizedConfig);
    const repo = getProvider();
    const existing = await repo.findAll('__erp_dashboard_preferences', { user_id: req.erpUser.userId });
    let row = existing && existing[0];
    if (row) {
      row = await repo.update('__erp_dashboard_preferences', row.id, { config: serialized });
    } else {
      row = await repo.create('__erp_dashboard_preferences', {
        user_id: req.erpUser.userId,
        config: serialized,
      });
    }
    return res.json({ config: normalizedConfig });
  } catch (err) {
    console.error('[AUTH] dashboard preferences write error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/* ── User entity guards ─────────────────────────────────────
   Mounted by the generated routes index as middleware on /__erp_users
   and /__erp_user_groups to hash passwords and prevent
   self-lockout / last-superadmin scenarios.                         */

async function getSuperadminGroup() {
  try {
    const repo = getProvider();
    const groups = await repo.findAll('__erp_groups');
    return groups.find((g) => String(g.name).toLowerCase() === 'superadmin') || null;
  } catch { return null; }
}

async function getActiveSuperadminUserIds() {
  try {
    const repo = getProvider();
    const superGroup = await getSuperadminGroup();
    if (!superGroup) return [];
    const memberships = await repo.findAll('__erp_user_groups', { group_id: superGroup.id });
    const ids = [...new Set(memberships.map((m) => m.user_id))];
    if (!ids.length) return [];
    const users = await repo.findAll('__erp_users');
    const byId = new Map(users.map((u) => [u.id, u]));
    return ids.filter((id) => {
      const u = byId.get(id);
      return u && Number(u.is_active) !== 0;
    });
  } catch { return []; }
}

async function isUserSuperadmin(userId) {
  const ids = await getActiveSuperadminUserIds();
  return ids.includes(userId);
}

function userEntityGuard() {
  const guardRouter = express.Router();
  const { hashPassword } = require('./rbacSeed');

  async function isSeedAdmin(userId) {
    try {
      const repo = getProvider();
      const user = await repo.findById('__erp_users', userId);
      return user && String(user.username).toLowerCase() === 'admin';
    } catch { return false; }
  }

  guardRouter.post('/', (req, _res, next) => {
    if (req.body && req.body.password_hash && typeof req.body.password_hash === 'string' && req.body.password_hash.length > 0) {
      req.body.password_hash = hashPassword(req.body.password_hash);
    }
    next();
  });

  guardRouter.put('/:id', async (req, res, next) => {
    if (req.body && req.body.password_hash && typeof req.body.password_hash === 'string' && req.body.password_hash.length > 0) {
      req.body.password_hash = hashPassword(req.body.password_hash);
    }

    const targetId = String(req.params.id);
    const selfId = req.erpUser && req.erpUser.userId ? String(req.erpUser.userId) : null;
    const deactivating = req.body && req.body.is_active !== undefined && Number(req.body.is_active) === 0;

    if (await isSeedAdmin(targetId)) {
      if (deactivating) {
        return res.status(403).json({ error: 'The default admin account cannot be deactivated' });
      }
    }

    if (deactivating && selfId && selfId === targetId) {
      return res.status(403).json({ error: 'You cannot deactivate your own account' });
    }

    if (deactivating) {
      const supers = await getActiveSuperadminUserIds();
      if (supers.length && supers.includes(targetId) && supers.length === 1) {
        return res.status(403).json({ error: 'Cannot deactivate the last remaining superadmin' });
      }
    }

    next();
  });

  guardRouter.delete('/:id', async (req, res, next) => {
    const targetId = String(req.params.id);
    const selfId = req.erpUser && req.erpUser.userId ? String(req.erpUser.userId) : null;

    if (await isSeedAdmin(targetId)) {
      return res.status(403).json({ error: 'The default admin account cannot be deleted' });
    }

    if (selfId && selfId === targetId) {
      return res.status(403).json({ error: 'You cannot delete your own account' });
    }

    const supers = await getActiveSuperadminUserIds();
    if (supers.length && supers.includes(targetId) && supers.length === 1) {
      return res.status(403).json({ error: 'Cannot delete the last remaining superadmin' });
    }

    next();
  });

  return guardRouter;
}

function userGroupGuard() {
  const guardRouter = express.Router();

  guardRouter.delete('/:id', async (req, res, next) => {
    try {
      const repo = getProvider();
      const membership = await repo.findById('__erp_user_groups', req.params.id);
      if (!membership) return next();

      const superGroup = await getSuperadminGroup();
      if (!superGroup || String(membership.group_id) !== String(superGroup.id)) {
        return next();
      }

      const selfId = req.erpUser && req.erpUser.userId ? String(req.erpUser.userId) : null;
      const targetId = String(membership.user_id);

      if (selfId && selfId === targetId) {
        return res.status(403).json({ error: 'You cannot remove your own superadmin role' });
      }

      const supers = await getActiveSuperadminUserIds();
      if (supers.length && supers.includes(targetId) && supers.length === 1) {
        return res.status(403).json({ error: 'Cannot remove the last remaining superadmin' });
      }

      next();
    } catch (err) {
      console.error('[RBAC] userGroupGuard error:', err.message || err);
      next();
    }
  });

  return guardRouter;
}

module.exports = router;
module.exports.userEntityGuard = userEntityGuard;
module.exports.userGroupGuard = userGroupGuard;
module.exports.getActiveSuperadminUserIds = getActiveSuperadminUserIds;
module.exports.isUserSuperadmin = isUserSuperadmin;
