const { query } = require('../config/database');
const logger = require('../utils/logger');

function normalize(name) {
  return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function recordFeatures({ userId, projectId, features, source, userPrompt }) {
  if (!Array.isArray(features) || features.length === 0) return [];

  const inserted = [];
  for (const raw of features) {
    const featureName = typeof raw === 'string' ? raw.trim() : String(raw).trim();
    if (!featureName) continue;
    const normalized = normalize(featureName);
    try {
      const result = await query(
        `INSERT INTO feature_requests (feature_name, feature_name_normalized, source, user_id, project_id, user_prompt)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (feature_name_normalized, user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'))
         DO NOTHING
         RETURNING *`,
        [featureName, normalized, source, userId, projectId || null, userPrompt || null]
      );
      if (result.rows[0]) inserted.push(result.rows[0]);
    } catch (err) {
      logger.warn(`Failed to record feature request "${featureName}": ${err.message}`);
    }
  }
  return inserted;
}

async function recordWarnings({ userId, projectId, warnings, userPrompt }) {
  if (!Array.isArray(warnings) || warnings.length === 0) return [];

  const unsupportedPatterns = [
    /not (?:natively )?supported/i,
    /unsupported/i,
    /is not supported by the generator/i,
    /currently does not/i,
    /will be ignored/i,
  ];

  const featureWarnings = warnings.filter((w) =>
    typeof w === 'string' && unsupportedPatterns.some((p) => p.test(w))
  );

  if (featureWarnings.length === 0) return [];

  const featureNames = featureWarnings.map((w) => {
    const moduleMatch = w.match(/^Module `([^`]+)`/);
    if (moduleMatch) return `Module: ${moduleMatch[1]}`;
    const featureMatch = w.match(/^Feature `([^`]+)` on entity `([^`]+)`/);
    if (featureMatch) return `Feature: ${featureMatch[1]} (${featureMatch[2]})`;
    if (/chatbot/i.test(w)) return 'In-app chatbot';
    return w.length > 100 ? w.slice(0, 100) + '...' : w;
  });

  const features = featureNames.map((name, i) => ({
    name,
    detail: featureWarnings[i],
  }));

  const inserted = [];
  for (const f of features) {
    const normalized = normalize(f.name);
    try {
      const result = await query(
        `INSERT INTO feature_requests (feature_name, feature_name_normalized, source, source_detail, user_id, project_id, user_prompt)
         VALUES ($1, $2, 'sdf_generation', $3, $4, $5, $6)
         ON CONFLICT (feature_name_normalized, user_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'))
         DO NOTHING
         RETURNING *`,
        [f.name, normalized, f.detail, userId, projectId || null, userPrompt || null]
      );
      if (result.rows[0]) inserted.push(result.rows[0]);
    } catch (err) {
      logger.warn(`Failed to record warning-based feature request: ${err.message}`);
    }
  }
  return inserted;
}

async function listAll({ status, source, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) {
    conditions.push(`fr.status = $${idx++}`);
    params.push(status);
  }
  if (source) {
    conditions.push(`fr.source = $${idx++}`);
    params.push(source);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(
    `SELECT COUNT(*) AS total FROM feature_requests fr ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].total, 10);

  params.push(limit, offset);
  const dataResult = await query(
    `SELECT fr.*, u.name AS user_name, u.email AS user_email, p.name AS project_name
     FROM feature_requests fr
     LEFT JOIN users u ON u.user_id = fr.user_id
     LEFT JOIN projects p ON p.project_id = fr.project_id
     ${where}
     ORDER BY fr.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    params
  );

  return { total, requests: dataResult.rows };
}

async function listByUser(userId) {
  const result = await query(
    `SELECT fr.*, p.name AS project_name
     FROM feature_requests fr
     LEFT JOIN projects p ON p.project_id = fr.project_id
     WHERE fr.user_id = $1
     ORDER BY fr.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function updateStatus(id, { status, adminNotes }) {
  const result = await query(
    `UPDATE feature_requests
     SET status = $2, admin_notes = $3, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, status, adminNotes ?? null]
  );
  if (!result.rows[0]) throw Object.assign(new Error('Feature request not found'), { statusCode: 404 });
  return result.rows[0];
}

async function getStats() {
  const statusResult = await query(`
    SELECT status, COUNT(*) AS count FROM feature_requests GROUP BY status
  `);
  const byStatus = {};
  let total = 0;
  for (const row of statusResult.rows) {
    byStatus[row.status] = parseInt(row.count, 10);
    total += parseInt(row.count, 10);
  }

  const topResult = await query(`
    SELECT feature_name_normalized AS feature, COUNT(*) AS count
    FROM feature_requests
    GROUP BY feature_name_normalized
    ORDER BY count DESC
    LIMIT 15
  `);

  const sourceResult = await query(`
    SELECT source, COUNT(*) AS count FROM feature_requests GROUP BY source
  `);
  const bySource = {};
  for (const row of sourceResult.rows) {
    bySource[row.source] = parseInt(row.count, 10);
  }

  return {
    total,
    by_status: byStatus,
    by_source: bySource,
    top_requested: topResult.rows.map((r) => ({ feature: r.feature, count: parseInt(r.count, 10) })),
  };
}

async function getById(id) {
  const result = await query(
    `SELECT fr.*, u.name AS user_name, u.email AS user_email, p.name AS project_name
     FROM feature_requests fr
     LEFT JOIN users u ON u.user_id = fr.user_id
     LEFT JOIN projects p ON p.project_id = fr.project_id
     WHERE fr.id = $1`,
    [id]
  );
  if (!result.rows[0]) throw Object.assign(new Error('Feature request not found'), { statusCode: 404 });
  return result.rows[0];
}

async function getMessages(featureRequestId) {
  const result = await query(
    `SELECT m.*, u.name AS sender_name, u.email AS sender_email
     FROM feature_request_messages m
     LEFT JOIN users u ON u.user_id = m.sender_id
     WHERE m.feature_request_id = $1
     ORDER BY m.created_at ASC`,
    [featureRequestId]
  );
  return result.rows;
}

async function addMessage({ featureRequestId, senderId, senderRole, body }) {
  const result = await query(
    `INSERT INTO feature_request_messages (feature_request_id, sender_id, sender_role, body)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [featureRequestId, senderId, senderRole, body]
  );
  return result.rows[0];
}

module.exports = {
  recordFeatures, recordWarnings, listAll, listByUser, updateStatus,
  getStats, getById, getMessages, addMessage,
};
