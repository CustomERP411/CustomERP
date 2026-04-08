const db = require('../config/database');

class Approval {
  static async create({
    projectId,
    decidedByUserId,
    decision,
    comments = null,
    sdfVersion = null,
    revisionInstructions = null,
    resultingSdfVersion = null,
  }) {
    const result = await db.query(
      `INSERT INTO approvals
         (project_id, decided_by_user_id, decision, comments,
          sdf_version, revision_instructions, resulting_sdf_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        projectId,
        decidedByUserId,
        decision,
        comments,
        sdfVersion,
        revisionInstructions,
        resultingSdfVersion,
      ]
    );
    return this._transform(result.rows[0]);
  }

  static async updateResultingSdfVersion(approvalId, resultingSdfVersion) {
    const result = await db.query(
      `UPDATE approvals
       SET resulting_sdf_version = $1
       WHERE approval_id = $2
       RETURNING *`,
      [resultingSdfVersion, approvalId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async findByProject(projectId) {
    const result = await db.query(
      `SELECT * FROM approvals
       WHERE project_id = $1
       ORDER BY decided_at DESC`,
      [projectId]
    );
    return result.rows.map(this._transform);
  }

  static async findLatestByProject(projectId) {
    const result = await db.query(
      `SELECT * FROM approvals
       WHERE project_id = $1
       ORDER BY decided_at DESC
       LIMIT 1`,
      [projectId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.approval_id,
      project_id: row.project_id,
      module_id: row.module_id || null,
      decided_by_user_id: row.decided_by_user_id,
      decision: row.decision,
      comments: row.comments || null,
      sdf_version: row.sdf_version ?? null,
      revision_instructions: row.revision_instructions || null,
      resulting_sdf_version: row.resulting_sdf_version ?? null,
      decided_at: row.decided_at,
    };
  }
}

module.exports = Approval;
