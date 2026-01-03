const db = require('../config/database');

class Project {
  static async create({ name, userId }) {
    // We let DB generate UUID via default if we want, or generate here.
    // Migration says: project_id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
    // So we can skip ID generation or do it here. Let's do it here to return it immediately if needed, 
    // but cleaner to let DB handle it if configured. However, pg driver returns the row.
    // Let's use DB default for ID, but we need to pass owner_user_id.
    
    const result = await db.query(
      `INSERT INTO projects (name, owner_user_id, status)
       VALUES ($1, $2, 'Draft')
       RETURNING *`,
      [name, userId]
    );
    return this._transform(result.rows[0]);
  }

  static async findByUser(userId) {
    const result = await db.query(
      `SELECT * FROM projects WHERE owner_user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(this._transform);
  }

  static async findById(id, userId) {
    const result = await db.query(
      `SELECT * FROM projects WHERE project_id = $1 AND owner_user_id = $2`,
      [id, userId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async update(id, userId, updates) {
    const { name } = updates;
    const result = await db.query(
      `UPDATE projects
       SET name = COALESCE($1, name)
       WHERE project_id = $2 AND owner_user_id = $3
       RETURNING *`, // Trigger updates updated_at automatically via DB trigger
      [name, id, userId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async delete(id, userId) {
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
      created_at: row.created_at,
      updated_at: row.updated_at,
      // owner_user_id: row.owner_user_id // internal
    };
  }
}

module.exports = Project;
