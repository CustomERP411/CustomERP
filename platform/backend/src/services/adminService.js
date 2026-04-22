const { query } = require('../config/database');
const logger = require('../utils/logger');

async function listUsers() {
  const result = await query(
    `SELECT user_id, name, email, is_admin, created_at, updated_at, deleted_at, blocked_at, block_reason
     FROM users
     ORDER BY created_at DESC`
  );
  return result.rows.map((row) => ({
    id: row.user_id,
    name: row.name,
    email: row.email,
    is_admin: !!row.is_admin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: !!row.deleted_at,
    blocked: !!row.blocked_at,
    block_reason: row.block_reason || null,
  }));
}

async function setAdminStatus(userId, isAdmin) {
  const result = await query(
    `UPDATE users SET is_admin = $1, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2 AND deleted_at IS NULL
     RETURNING user_id, name, email, is_admin, created_at, updated_at, blocked_at, block_reason`,
    [!!isAdmin, userId]
  );
  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const row = result.rows[0];
  logger.info(`Admin toggled admin status for ${userId} -> ${isAdmin}`);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    is_admin: !!row.is_admin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: false,
    blocked: !!row.blocked_at,
    block_reason: row.block_reason || null,
  };
}

async function blockUser(userId, reason) {
  const result = await query(
    `UPDATE users SET blocked_at = CURRENT_TIMESTAMP, block_reason = $2, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND deleted_at IS NULL
     RETURNING user_id, name, email, is_admin, created_at, updated_at, blocked_at, block_reason`,
    [userId, reason]
  );
  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const row = result.rows[0];
  logger.info(`Admin blocked user: ${userId} (reason: ${reason || 'none'})`);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    is_admin: !!row.is_admin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: false,
    blocked: true,
    block_reason: row.block_reason || null,
  };
}

async function unblockUser(userId) {
  const result = await query(
    `UPDATE users SET blocked_at = NULL, block_reason = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND deleted_at IS NULL
     RETURNING user_id, name, email, is_admin, created_at, updated_at, blocked_at, block_reason`,
    [userId]
  );
  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const row = result.rows[0];
  logger.info(`Admin unblocked user: ${userId}`);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    is_admin: !!row.is_admin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: false,
    blocked: false,
    block_reason: null,
  };
}

async function listAllProjects() {
  const result = await query(
    `SELECT p.project_id, p.name, p.description, p.status, p.created_at, p.updated_at,
            u.user_id AS owner_id, u.name AS owner_name, u.email AS owner_email
     FROM projects p
     LEFT JOIN users u ON u.user_id = p.owner_user_id
     WHERE p.deleted_at IS NULL OR p.deleted_at IS NULL
     ORDER BY p.created_at DESC`
  );
  return result.rows.map((row) => ({
    id: row.project_id,
    name: row.name,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: {
      id: row.owner_id,
      name: row.owner_name,
      email: row.owner_email,
    },
  }));
}

module.exports = { listUsers, setAdminStatus, blockUser, unblockUser, listAllProjects };
