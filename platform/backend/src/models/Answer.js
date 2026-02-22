const db = require('../config/database');

class Answer {
  static async create({ projectId, questionId, answerText }) {
    if (!projectId) throw new Error('projectId is required');
    if (!questionId) throw new Error('questionId is required');

    const result = await db.query(
      `INSERT INTO answers (question_id, project_id, answer_text)
       VALUES ($1, $2, $3)
       RETURNING answer_id, question_id, project_id, answer_text, created_at`,
      [questionId, projectId, answerText]
    );

    return this._transform(result.rows[0]);
  }

  static async createMany(answers) {
    if (!Array.isArray(answers) || answers.length === 0) return [];
    const created = [];
    for (const answer of answers) {
      created.push(await this.create(answer));
    }
    return created;
  }

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.answer_id,
      project_id: row.project_id,
      question_id: row.question_id,
      answer: row.answer_text,
      created_at: row.created_at,
    };
  }
}

module.exports = Answer;
