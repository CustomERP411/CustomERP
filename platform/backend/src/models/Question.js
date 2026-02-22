const db = require('../config/database');

class Question {
  static async create({ questionId, projectId, questionText, questionType, options, orderIndex = 0 }) {
    if (!questionId) throw new Error('questionId is required');
    if (!projectId) throw new Error('projectId is required');

    const result = await db.query(
      `INSERT INTO questions (question_id, project_id, question_text, question_type, options, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING question_id, project_id, question_text, question_type, options, order_index, created_at`,
      [questionId, projectId, questionText, questionType, options, orderIndex]
    );

    return this._transform(result.rows[0]);
  }

  static async createMany(questions) {
    if (!Array.isArray(questions) || questions.length === 0) return [];
    const created = [];
    for (const question of questions) {
      created.push(await this.create(question));
    }
    return created;
  }

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.question_id,
      project_id: row.project_id,
      question: row.question_text,
      type: row.question_type,
      options: row.options,
      order_index: row.order_index,
      created_at: row.created_at,
    };
  }
}

module.exports = Question;
