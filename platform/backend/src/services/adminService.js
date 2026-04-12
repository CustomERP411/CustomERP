const { query } = require('../config/database');
const logger = require('../utils/logger');

async function listUsers() {
  const result = await query(
    `SELECT user_id, name, email, is_admin, created_at, updated_at, deleted_at
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
  }));
}

async function updateUser(userId, { name, email }) {
  const updates = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (email !== undefined) {
    const normalized = email.toLowerCase().trim();
    const existing = await query('SELECT user_id FROM users WHERE email = $1', [normalized]);
    if (existing.rows.length && existing.rows[0].user_id !== userId) {
      const err = new Error('This email is already in use by another account.');
      err.statusCode = 409;
      throw err;
    }
    updates.push(`email = $${idx++}`);
    values.push(normalized);
  }

  if (!updates.length) {
    const err = new Error('No fields to update');
    err.statusCode = 400;
    throw err;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(userId);

  const sql = `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${idx} AND deleted_at IS NULL
               RETURNING user_id, name, email, is_admin, created_at, updated_at`;
  const result = await query(sql, values);
  if (!result.rows[0]) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  const row = result.rows[0];
  logger.info(`Admin updated user: ${userId}`);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    is_admin: !!row.is_admin,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted: false,
  };
}

async function setAdminStatus(userId, isAdmin) {
  const result = await query(
    `UPDATE users SET is_admin = $1, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2 AND deleted_at IS NULL
     RETURNING user_id, name, email, is_admin, created_at, updated_at`,
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
  };
}

async function deleteUser(userId) {
  const result = await query(
    `UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND deleted_at IS NULL RETURNING user_id`,
    [userId]
  );
  if (!result.rowCount) {
    const err = new Error('User not found or already deleted');
    err.statusCode = 404;
    throw err;
  }
  logger.info(`Admin soft-deleted user: ${userId}`);
  return true;
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

module.exports = { listUsers, updateUser, setAdminStatus, deleteUser, listAllProjects };
