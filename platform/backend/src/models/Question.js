const db = require('../config/database');

class Question {
  static async create({ questionId, projectId, questionText, questionType, options, orderIndex = 0 }) {
    if (!questionId) throw new Error('questionId is required');
    if (!projectId) throw new Error('projectId is required');

    const normalizedOptions = Array.isArray(options)
      ? JSON.stringify(options)
      : (options ?? null);

    const result = await db.query(
      `INSERT INTO questions (question_id, project_id, question_text, question_type, options, order_index)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING question_id, project_id, question_text, question_type, options, order_index, created_at`,
      [questionId, projectId, questionText, questionType, normalizedOptions, orderIndex]
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

  static async findByProjectAndIds(projectId, questionIds) {
    if (!projectId) throw new Error('projectId is required');
    if (!Array.isArray(questionIds) || questionIds.length === 0) return [];

    const result = await db.query(
      `SELECT question_id, project_id, question_text, question_type, options, order_index, created_at
       FROM questions
       WHERE project_id = $1
         AND question_id = ANY($2::uuid[])`,
      [projectId, questionIds]
    );

    return result.rows.map((row) => this._transform(row));
  }

  static async findDefaultByProject(projectId) {
    if (!projectId) throw new Error('projectId is required');

    const result = await db.query(
      `SELECT question_id, project_id, question_text, question_type, options, order_index, created_at
       FROM questions
       WHERE project_id = $1
         AND options IS NOT NULL
         AND jsonb_typeof(options) = 'object'
         AND options->>'source' = 'default_module_question'
       ORDER BY order_index ASC, created_at ASC`,
      [projectId]
    );

    return result.rows.map((row) => this._transform(row));
  }

  static async findDefaultByProjectAndModules(projectId, moduleKeys) {
    if (!projectId) throw new Error('projectId is required');
    if (!Array.isArray(moduleKeys) || moduleKeys.length === 0) return [];

    const result = await db.query(
      `SELECT question_id, project_id, question_text, question_type, options, order_index, created_at
       FROM questions
       WHERE project_id = $1
         AND options IS NOT NULL
         AND jsonb_typeof(options) = 'object'
         AND options->>'source' = 'default_module_question'
         AND options->>'module' = ANY($2::text[])
       ORDER BY order_index ASC, created_at ASC`,
      [projectId, moduleKeys]
    );

    return result.rows.map((row) => this._transform(row));
  }

  static _normalizeOptions(options) {
    if (options === null || options === undefined) return null;
    if (typeof options === 'string') {
      try {
        return JSON.parse(options);
      } catch {
        return options;
      }
    }
    return options;
  }

  static _transform(row) {
    if (!row) return null;
    return {
      id: row.question_id,
      project_id: row.project_id,
      question: row.question_text,
      type: row.question_type,
      options: this._normalizeOptions(row.options),
      order_index: row.order_index,
      created_at: row.created_at,
    };
  }
}

module.exports = Question;
