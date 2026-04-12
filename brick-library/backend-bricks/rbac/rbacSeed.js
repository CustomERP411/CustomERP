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

const CRUD_ACTIONS = ['create', 'read', 'update', 'delete'];

const ABSTRACT_PERM_SLUGS = {
  manage_users: ['__erp_users', '__erp_user_groups'],
  manage_groups: ['__erp_groups', '__erp_group_permissions'],
  manage_permissions: ['__erp_permissions'],
};

function resolveAbstractPermissions(abstractPerms, customPermsStr, entitySlugs) {
  const keys = new Set();
  const businessSlugs = entitySlugs.filter((s) => !s.startsWith('__erp_'));

  for (const ap of abstractPerms) {
    if (ap === 'view_records') {
      businessSlugs.forEach((s) => keys.add(`${s}.read`));
    } else if (ap === 'create_records') {
      businessSlugs.forEach((s) => keys.add(`${s}.create`));
    } else if (ap === 'edit_records' || ap === 'approve_transactions') {
      businessSlugs.forEach((s) => keys.add(`${s}.update`));
    } else if (ap === 'delete_records') {
      businessSlugs.forEach((s) => keys.add(`${s}.delete`));
    } else if (ABSTRACT_PERM_SLUGS[ap]) {
      ABSTRACT_PERM_SLUGS[ap].forEach((slug) => {
        CRUD_ACTIONS.forEach((a) => keys.add(`${slug}.${a}`));
      });
    }
  }

  if (customPermsStr) {
    customPermsStr.split(',').map((s) => s.trim()).filter(Boolean).forEach((k) => keys.add(k));
  }

  return keys;
}

async function ensureGroup(repository, existingGroups, name, description) {
  let group = existingGroups.find((g) => String(g.name).toLowerCase() === name.toLowerCase());
  if (!group) {
    group = await repository.create('__erp_groups', { name, description });
    existingGroups.push(group);
    console.log(`[RBAC-SEED] Created group "${name}"`);
  }
  return group;
}

async function assignPermissionsToGroup(repository, groupId, permIds, allGP) {
  const existing = new Set(allGP.filter((gp) => gp.group_id === groupId).map((gp) => gp.permission_id));
  let added = 0;
  for (const pid of permIds) {
    if (!existing.has(pid)) {
      await repository.create('__erp_group_permissions', { group_id: groupId, permission_id: pid });
      allGP.push({ group_id: groupId, permission_id: pid });
      added++;
    }
  }
  return added;
}

async function seed(repository, entitySlugs = [], groups = [], entityModuleMap = {}) {
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

  let existingGroups = await repository.findAll('__erp_groups');

  const superadminGroup = await ensureGroup(repository, existingGroups, 'superadmin', 'Full access to all entities and actions');

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

  const slugsToSeed = entitySlugs.length ? entitySlugs : [];

  const permByKey = new Map();
  if (slugsToSeed.length) {
    const existingPerms = await repository.findAll('__erp_permissions');
    existingPerms.forEach((p) => permByKey.set(p.key, p));

    let allGP = await repository.findAll('__erp_group_permissions');

    for (const slug of slugsToSeed) {
      for (const action of CRUD_ACTIONS) {
        const key = `${slug}.${action}`;
        if (permByKey.has(key)) continue;

        const scope = slug.startsWith('__erp_') ? 'global' : 'module';
        const perm = await repository.create('__erp_permissions', {
          key,
          label: `${action.charAt(0).toUpperCase() + action.slice(1)} ${slug}`,
          scope,
          description: `Allow ${action} on ${slug}`,
        });
        permByKey.set(key, perm);
      }
    }
    console.log(`[RBAC-SEED] Ensured ${slugsToSeed.length * CRUD_ACTIONS.length} permissions exist`);

    allGP = await repository.findAll('__erp_group_permissions');

    const allPermIds = [...permByKey.values()].map((p) => p.id);
    await assignPermissionsToGroup(repository, superadminGroup.id, allPermIds, allGP);

    const adminGroup = await ensureGroup(repository, existingGroups, 'Admin', 'Full access (manageable admin group)');
    await assignPermissionsToGroup(repository, adminGroup.id, allPermIds, allGP);
    console.log('[RBAC-SEED] Admin group receives all permissions');

    const businessSlugs = slugsToSeed.filter((s) => !s.startsWith('__erp_'));
    const moduleGroups = {};
    for (const slug of businessSlugs) {
      const mod = (entityModuleMap[slug] || 'inventory').toLowerCase();
      if (!moduleGroups[mod]) moduleGroups[mod] = [];
      moduleGroups[mod].push(slug);
    }

    for (const [mod, modSlugs] of Object.entries(moduleGroups)) {
      const groupName = `${mod}admin`;
      const modGroup = await ensureGroup(repository, existingGroups, groupName, `Admin for ${mod} module entities`);

      const modPermIds = [];
      for (const slug of modSlugs) {
        for (const action of CRUD_ACTIONS) {
          const p = permByKey.get(`${slug}.${action}`);
          if (p) modPermIds.push(p.id);
        }
      }
      const cnt = await assignPermissionsToGroup(repository, modGroup.id, modPermIds, allGP);
      console.log(`[RBAC-SEED] Module group "${groupName}" assigned ${modPermIds.length} permissions (${cnt} new)`);
    }
  }

  const userGroups = Array.isArray(groups) ? groups : [];
  if (userGroups.length) {
    let allGP = await repository.findAll('__erp_group_permissions');
    existingGroups = await repository.findAll('__erp_groups');
    const groupNameMap = new Map(existingGroups.map((g) => [String(g.name).toLowerCase(), g]));

    for (const gDef of userGroups) {
      const gName = String(gDef.name || '').trim();
      if (!gName || gName.toLowerCase() === 'superadmin' || gName.toLowerCase() === 'admin') continue;

      let group = groupNameMap.get(gName.toLowerCase());
      if (!group) {
        group = await repository.create('__erp_groups', {
          name: gName,
          description: gDef.responsibilities || '',
        });
        groupNameMap.set(gName.toLowerCase(), group);
        console.log(`[RBAC-SEED] Created group "${gName}"`);
      }

      const abstractPerms = Array.isArray(gDef.permissions) ? gDef.permissions : [];
      const customPerms = String(gDef.custom_permissions || '');
      const neededKeys = resolveAbstractPermissions(abstractPerms, customPerms, slugsToSeed);

      const groupPermIds = new Set(
        allGP.filter((gp) => gp.group_id === group.id).map((gp) => gp.permission_id)
      );

      for (const key of neededKeys) {
        let perm = permByKey.get(key);
        if (!perm) {
          perm = await repository.create('__erp_permissions', {
            key,
            label: key,
            scope: key.startsWith('__erp_') ? 'global' : 'module',
            description: `Custom permission: ${key}`,
          });
          permByKey.set(key, perm);
        }
        if (!groupPermIds.has(perm.id)) {
          await repository.create('__erp_group_permissions', {
            group_id: group.id,
            permission_id: perm.id,
          });
        }
      }
      console.log(`[RBAC-SEED] Group "${gName}" assigned ${neededKeys.size} permissions`);
    }
  }

  console.log('[RBAC-SEED] Seed complete.');
}

module.exports = { seed, hashPassword };
