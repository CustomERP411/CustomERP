const db = require('../config/database');

class SDF {
  static async create(projectId, sdfJson) {
    const verRes = await db.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM sdfs
       WHERE project_id = $1`,
      [projectId]
    );
    const version = Number(verRes.rows?.[0]?.next_version || 1);

    const result = await db.query(
      `INSERT INTO sdfs (project_id, version, sdf_json)
       VALUES ($1, $2, $3)
       RETURNING sdf_id, project_id, version, sdf_json, created_at`,
      [projectId, version, sdfJson]
    );

    return this._transform(result.rows[0]);
  }

  static async findLatestByProject(projectId) {
    const result = await db.query(
      `SELECT sdf_id, project_id, version, sdf_json, created_at
       FROM sdfs
       WHERE project_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [projectId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.sdf_id,
      project_id: row.project_id,
      version: row.version,
      sdf_json: row.sdf_json,
      created_at: row.created_at,
    };
  }
}

module.exports = SDF;


