const db = require('../config/database');

class Project {
  static async create({ name, userId, description = null }) {
    // We let DB generate UUID via default if we want, or generate here.
    // Migration says: project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    // So we can skip ID generation or do it here. Let's do it here to return it immediately if needed, 
    // but cleaner to let DB handle it if configured. However, pg driver returns the row.
    // Let's use DB default for ID, but we need to pass owner_user_id.
    
    const result = await db.query(
      `INSERT INTO projects (name, owner_user_id, description, status)
       VALUES ($1, $2, $3, 'Draft')
       RETURNING *`,
      [name, userId, description]
    );
    return this._transform(result.rows[0]);
  }

  static async findByUser(userId) {
    const result = await db.query(
      `SELECT * FROM projects WHERE owner_user_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(this._transform);
  }

  static async findById(id, userId) {
    const result = await db.query(
      `SELECT * FROM projects WHERE project_id = $1 AND owner_user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async update(id, userId, updates) {
    const { name, description, status, mode } = updates;
    const result = await db.query(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           mode = COALESCE($4, mode)
       WHERE project_id = $5 AND owner_user_id = $6 AND deleted_at IS NULL
       RETURNING *`,
      [name, description, status, mode, id, userId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async delete(id, userId) {
    const result = await db.query(
      `UPDATE projects SET deleted_at = CURRENT_TIMESTAMP
       WHERE project_id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
       RETURNING project_id`,
      [id, userId]
    );
    return result.rowCount > 0;
  }

  static async restore(id, userId) {
    const result = await db.query(
      `UPDATE projects SET deleted_at = NULL
       WHERE project_id = $1 AND owner_user_id = $2 AND deleted_at IS NOT NULL
       RETURNING *`,
      [id, userId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async hardDelete(id, userId) {
    const result = await db.query(
      `DELETE FROM projects WHERE project_id = $1 AND owner_user_id = $2 RETURNING project_id`,
      [id, userId]
    );
    return result.rowCount > 0;
  }

  // Helper to normalize DB columns to API response fields if needed
  // e.g. project_id -> id, owner_user_id -> userId (optional, but good for frontend consistency)
  static _transform(row) {
    if (!row) return null;
    return {
      id: row.project_id,
      name: row.name,
      status: row.status,
      description: row.description,
      mode: row.mode || 'chat',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = Project;
