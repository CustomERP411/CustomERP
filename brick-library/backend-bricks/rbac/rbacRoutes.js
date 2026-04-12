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

/* ── User entity guards ─────────────────────────────────────
   Mounted by the generated routes index as middleware on /__erp_users
   to hash passwords and protect the superadmin account.            */

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
    if (await isSeedAdmin(req.params.id)) {
      if (req.body.is_active !== undefined && Number(req.body.is_active) === 0) {
        return res.status(403).json({ error: 'The default admin account cannot be deactivated' });
      }
    }
    next();
  });

  guardRouter.delete('/:id', async (req, res, next) => {
    if (await isSeedAdmin(req.params.id)) {
      return res.status(403).json({ error: 'The default admin account cannot be deleted' });
    }
    next();
  });

  return guardRouter;
}

module.exports = router;
module.exports.userEntityGuard = userEntityGuard;
