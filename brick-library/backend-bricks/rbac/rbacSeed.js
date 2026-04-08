const { v4: uuid } = require('uuid');

function hashPassword(plain) {
  try {
    const bcrypt = require('bcryptjs');
    return bcrypt.hashSync(plain, 10);
  } catch (_) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(plain).digest('hex');
  }
}

async function seed(repository, entitySlugs = []) {
  console.log('[RBAC-SEED] Running access-control seed...');

  const existingUsers = await repository.findAll('__erp_users');
  let adminUser = existingUsers.find((u) => u.username === 'admin');
  if (!adminUser) {
    adminUser = await repository.create('__erp_users', {
      username: 'admin',
      email: 'admin@erp.local',
      display_name: 'Administrator',
      password_hash: hashPassword('admin'),
      is_active: 1,
    });
    console.log('[RBAC-SEED] Created default admin user (username: admin, password: admin)');
  }

  const existingGroups = await repository.findAll('__erp_groups');
  let superadminGroup = existingGroups.find((g) => String(g.name).toLowerCase() === 'superadmin');
  if (!superadminGroup) {
    superadminGroup = await repository.create('__erp_groups', {
      name: 'superadmin',
      description: 'Full access to all entities and actions',
    });
    console.log('[RBAC-SEED] Created superadmin group');
  }

  const existingMemberships = await repository.findAll('__erp_user_groups', {
    user_id: adminUser.id,
    group_id: superadminGroup.id,
  });
  if (!existingMemberships.length) {
    await repository.create('__erp_user_groups', {
      user_id: adminUser.id,
      group_id: superadminGroup.id,
    });
    console.log('[RBAC-SEED] Assigned admin to superadmin group');
  }

  const actions = ['create', 'read', 'update', 'delete'];
  const slugsToSeed = entitySlugs.length ? entitySlugs : [];

  if (slugsToSeed.length) {
    const existingPerms = await repository.findAll('__erp_permissions');
    const existingKeys = new Set(existingPerms.map((p) => p.key));

    const allGP = await repository.findAll('__erp_group_permissions');
    const superadminPermIds = new Set(
      allGP.filter((gp) => gp.group_id === superadminGroup.id).map((gp) => gp.permission_id)
    );

    for (const slug of slugsToSeed) {
      for (const action of actions) {
        const key = `${slug}.${action}`;
        if (existingKeys.has(key)) continue;

        const scope = slug.startsWith('__erp_') ? 'global' : 'module';
        const perm = await repository.create('__erp_permissions', {
          key,
          label: `${action.charAt(0).toUpperCase() + action.slice(1)} ${slug}`,
          scope,
          description: `Allow ${action} on ${slug}`,
        });

        if (!superadminPermIds.has(perm.id)) {
          await repository.create('__erp_group_permissions', {
            group_id: superadminGroup.id,
            permission_id: perm.id,
          });
        }
      }
    }
    console.log(`[RBAC-SEED] Ensured ${slugsToSeed.length * actions.length} permissions exist`);
  }

  console.log('[RBAC-SEED] Seed complete.');
}

module.exports = { seed, hashPassword };
