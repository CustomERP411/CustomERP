const db = require('../config/database');

class ProjectConversation {
  static async create({
    projectId,
    sdfVersion = null,
    mode = 'build',
    businessAnswers = null,
    selectedModules = null,
    accessRequirements = null,
    descriptionSnapshot = null,
    defaultQuestionAnswers = null,
    answerReview = null,
    acknowledgedUnsupportedFeatures = null,
  }) {
    const result = await db.query(
      `INSERT INTO project_conversations
         (project_id, sdf_version, mode, business_answers, selected_modules,
          access_requirements, description_snapshot, default_question_answers,
          answer_review, acknowledged_unsupported_features)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        projectId,
        sdfVersion,
        mode,
        businessAnswers ? JSON.stringify(businessAnswers) : null,
        selectedModules ? JSON.stringify(selectedModules) : null,
        accessRequirements ? JSON.stringify(accessRequirements) : null,
        descriptionSnapshot,
        defaultQuestionAnswers ? JSON.stringify(defaultQuestionAnswers) : null,
        answerReview ? JSON.stringify(answerReview) : null,
        acknowledgedUnsupportedFeatures && acknowledgedUnsupportedFeatures.length
          ? JSON.stringify(acknowledgedUnsupportedFeatures)
          : null,
      ]
    );
    return this._transform(result.rows[0]);
  }

  static async updateAnswerReview(conversationId, answerReview) {
    const result = await db.query(
      `UPDATE project_conversations
       SET answer_review = $1
       WHERE conversation_id = $2
       RETURNING *`,
      [answerReview ? JSON.stringify(answerReview) : null, conversationId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async findByProject(projectId) {
    const result = await db.query(
      `SELECT * FROM project_conversations
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
    return result.rows.map(this._transform);
  }

  static async updateSdfVersion(conversationId, sdfVersion) {
    const result = await db.query(
      `UPDATE project_conversations
       SET sdf_version = $1
       WHERE conversation_id = $2
       RETURNING *`,
      [sdfVersion, conversationId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static async findLatestByProject(projectId) {
    const result = await db.query(
      `SELECT * FROM project_conversations
       WHERE project_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [projectId]
    );
    return result.rows[0] ? this._transform(result.rows[0]) : null;
  }

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.conversation_id,
      project_id: row.project_id,
      sdf_version: row.sdf_version,
      mode: row.mode,
      business_answers: row.business_answers,
      selected_modules: row.selected_modules,
      access_requirements: row.access_requirements,
      description_snapshot: row.description_snapshot,
      default_question_answers: row.default_question_answers,
      answer_review: row.answer_review,
      acknowledged_unsupported_features: row.acknowledged_unsupported_features,
      created_at: row.created_at,
    };
  }
}

module.exports = ProjectConversation;
