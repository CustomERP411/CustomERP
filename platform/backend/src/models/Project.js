const db = require('../config/database');
const { normalizeLanguage, DEFAULT_LANGUAGE } = require('../services/authService');

class Project {
  /**
   * Create a project. `language` is silently inherited from the user's preferred
   * language (passed in by the controller) and LOCKED at creation time. Callers
   * MUST NOT allow it to be mutated later.
   */
  static async create({ name, userId, description = null, language }) {
    const lang = normalizeLanguage(language || DEFAULT_LANGUAGE);

    const result = await db.query(
      `INSERT INTO projects (name, owner_user_id, description, status, language)
       VALUES ($1, $2, $3, 'Draft', $4)
       RETURNING *`,
      [name, userId, description, lang]
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

  /**
   * Update a project. `language` is intentionally immutable after creation:
   * even if the caller passes it, we ignore it.
   */
  static async update(id, userId, updates) {
    const { name, description, status, mode } = updates || {};
    // Note: `language` is explicitly NOT destructured and NOT updated. The
    // project language is locked at creation.
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

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.project_id,
      name: row.name,
      status: row.status,
      description: row.description,
      mode: row.mode || 'chat',
      language: normalizeLanguage(row.language || DEFAULT_LANGUAGE),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = Project;
