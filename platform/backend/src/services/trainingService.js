const { query } = require('../config/database');
const logger = require('../utils/logger');

const DEFAULT_BASE_URL = 'http://localhost:8000';
const AI_GATEWAY_URL = (process.env.AI_GATEWAY_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

async function gatewayGet(path) {
  const url = `${AI_GATEWAY_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === 'object' && data ? (data.detail || JSON.stringify(data)) : String(data || '');
    const err = new Error(detail || `AI Gateway error (${res.status})`);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

async function listSessions({ limit = 50, offset = 0, endpoint, quality, reviewed } = {}) {
  const gwData = await gatewayGet(
    `/ai/training/sessions?limit=1000&offset=0${endpoint ? `&endpoint=${encodeURIComponent(endpoint)}` : ''}`
  );
  let sessions = gwData.sessions || [];

  const reviewResult = await query('SELECT session_id, quality, reviewer_notes, is_exported, reviewed_at FROM training_reviews');
  const reviewMap = {};
  for (const row of reviewResult.rows) {
    reviewMap[row.session_id] = row;
  }

  sessions = sessions.map((s) => ({
    ...s,
    quality: reviewMap[s.session_id]?.quality || null,
    reviewed: !!reviewMap[s.session_id]?.reviewed_at,
    is_exported: !!reviewMap[s.session_id]?.is_exported,
  }));

  if (quality) sessions = sessions.filter((s) => s.quality === quality);
  if (reviewed === 'true') sessions = sessions.filter((s) => s.reviewed);
  if (reviewed === 'false') sessions = sessions.filter((s) => !s.reviewed);

  const total = sessions.length;
  const page = sessions.slice(offset, offset + limit);
  return { total, offset, limit, sessions: page };
}

async function getSession(sessionId) {
  const gwData = await gatewayGet(`/ai/training/sessions/${encodeURIComponent(sessionId)}`);
  const reviewResult = await query(
    'SELECT quality, reviewer_notes, edited_output, is_exported, reviewed_at FROM training_reviews WHERE session_id = $1',
    [sessionId]
  );
  const review = reviewResult.rows[0] || null;
  return { ...gwData, review };
}

async function saveReview(sessionId, { quality, notes, editedOutput }) {
  const result = await query(
    `INSERT INTO training_reviews (session_id, quality, reviewer_notes, edited_output, reviewed_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (session_id) DO UPDATE SET
       quality = EXCLUDED.quality,
       reviewer_notes = EXCLUDED.reviewer_notes,
       edited_output = EXCLUDED.edited_output,
       reviewed_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [sessionId, quality, notes || null, editedOutput ? JSON.stringify(editedOutput) : null]
  );
  logger.info(`Training review saved for session ${sessionId}: ${quality}`);
  return result.rows[0];
}

async function getStats() {
  const gwStats = await gatewayGet('/ai/training/stats');
  const reviewStats = await query(`
    SELECT
      COUNT(*) AS total_reviewed,
      COUNT(*) FILTER (WHERE quality = 'good') AS good_count,
      COUNT(*) FILTER (WHERE quality = 'bad') AS bad_count,
      COUNT(*) FILTER (WHERE quality = 'needs_edit') AS needs_edit_count,
      COUNT(*) FILTER (WHERE is_exported = TRUE) AS exported_count
    FROM training_reviews
  `);
  const row = reviewStats.rows[0] || {};
  return {
    ...gwStats,
    reviewed: {
      total: parseInt(row.total_reviewed, 10) || 0,
      good: parseInt(row.good_count, 10) || 0,
      bad: parseInt(row.bad_count, 10) || 0,
      needs_edit: parseInt(row.needs_edit_count, 10) || 0,
      exported: parseInt(row.exported_count, 10) || 0,
    },
  };
}

const AGENT_SYSTEM_PROMPTS = {
  distributor: 'You are a routing agent for CustomERP SDF generation. Given a business description, you determine which modules (hr, invoice, inventory) are needed and extract context for each module generator. Output a structured JSON with project_name, modules_needed, shared_entities, and per-module context.',
  hr_generator: 'You are the HR module specialist for CustomERP SDF generation. Given a business description and HR-specific context, you generate the HR portion of the System Definition File including entities (employees, departments, leave_requests, attendance, compensation) with their fields, types, and relationships.',
  invoice_generator: 'You are the Invoice module specialist for CustomERP SDF generation. Given a business description and invoice-specific context, you generate the Invoice portion of the System Definition File including entities (customers, invoices, invoice_items, payments, credit_notes) with their fields, types, and relationships.',
  inventory_generator: 'You are the Inventory module specialist for CustomERP SDF generation. Given a business description and inventory-specific context, you generate the Inventory portion of the System Definition File including entities (products/items, stock_movements, locations, stock_counts) with their fields, types, and relationships.',
  integrator: 'You are an SDF Integration specialist for CustomERP. You receive partial SDF outputs from module-specific generators (HR, Invoice, Inventory) and combine them into a single coherent System Definition File. You resolve cross-module entity references, deduplicate shared entities, and produce a complete valid SDF JSON.',
  chatbot: 'You are an always-available ERP advisor for the CustomERP platform. You assist users throughout their entire ERP setup journey — from choosing modules, through answering questions, to reviewing generated output. You respond in natural conversational language with a JSON structure containing reply, suggested_modules, discussion_points, confidence, and unsupported_features.',
};

function getSystemPrompt(agentName) {
  return AGENT_SYSTEM_PROMPTS[agentName] || `You are the ${agentName} agent in the CustomERP generation pipeline.`;
}

function buildChatUserContent(input) {
  const parts = [];
  if (input.business_description) parts.push(`Business: ${input.business_description}`);
  if (input.selected_modules?.length) parts.push(`Selected modules: ${input.selected_modules.join(', ')}`);
  if (input.current_step) parts.push(`Current step: ${input.current_step}`);
  if (input.sdf_status) parts.push(`SDF status: ${input.sdf_status}`);
  if (input.business_answers) parts.push(`Business answers: ${JSON.stringify(input.business_answers)}`);
  if (input.conversation_history?.length) {
    const history = input.conversation_history.map((m) => `${m.role}: ${m.content}`).join('\n');
    parts.push(`Conversation history:\n${history}`);
  }
  parts.push(`User message: ${input.message}`);
  return parts.join('\n\n');
}

async function exportForAzure({ agentTypes, qualityFilter = 'good' }) {
  const gwData = await gatewayGet('/ai/training/sessions?limit=10000&offset=0');
  const allSessions = gwData.sessions || [];

  const qualityValues = qualityFilter === 'good' ? ['good'] : ['good', 'needs_edit'];
  const reviewResult = await query(
    'SELECT session_id, quality, edited_output FROM training_reviews WHERE quality = ANY($1)',
    [qualityValues]
  );
  const reviewMap = {};
  for (const row of reviewResult.rows) reviewMap[row.session_id] = row;

  const eligibleIds = new Set(Object.keys(reviewMap));
  const eligibleSessions = allSessions.filter((s) => eligibleIds.has(s.session_id));

  const fullSessions = [];
  for (const s of eligibleSessions) {
    try {
      const full = await gatewayGet(`/ai/training/sessions/${encodeURIComponent(s.session_id)}`);
      full._review = reviewMap[s.session_id];
      fullSessions.push(full);
    } catch (e) {
      logger.warn(`Failed to fetch session ${s.session_id} for export: ${e.message}`);
    }
  }

  const agentFiles = {};
  const requestedAgents = new Set(agentTypes || []);

  for (const session of fullSessions) {
    const steps = session.step_logs || [];
    const review = session._review;

    if (steps.length === 0) {
      const agentName = session.endpoint === '/ai/chat' ? 'chatbot' : 'pipeline';
      if (requestedAgents.size && !requestedAgents.has(agentName)) continue;
      const output = review?.edited_output || session.output;
      const userContent = agentName === 'chatbot'
        ? buildChatUserContent(session.input)
        : JSON.stringify(session.input);
      const entry = {
        messages: [
          { role: 'system', content: getSystemPrompt(agentName) },
          { role: 'user', content: userContent },
          { role: 'assistant', content: typeof output === 'string' ? output : JSON.stringify(output) },
        ],
      };
      if (!agentFiles[agentName]) agentFiles[agentName] = [];
      agentFiles[agentName].push(JSON.stringify(entry));
    } else {
      for (const step of steps) {
        const agentName = step.agent || 'unknown';
        if (requestedAgents.size && !requestedAgents.has(agentName)) continue;
        const output = (review?.edited_output && agentName === 'integrator')
          ? review.edited_output
          : step.output_parsed;
        const entry = {
          messages: [
            { role: 'system', content: getSystemPrompt(agentName) },
            { role: 'user', content: JSON.stringify(step.input_summary) },
            { role: 'assistant', content: typeof output === 'string' ? output : JSON.stringify(output) },
          ],
        };
        if (!agentFiles[agentName]) agentFiles[agentName] = [];
        agentFiles[agentName].push(JSON.stringify(entry));
      }
    }
  }

  // Mark sessions as exported
  const exportedIds = fullSessions.map((s) => s.session_id);
  if (exportedIds.length) {
    await query(
      'UPDATE training_reviews SET is_exported = TRUE, updated_at = NOW() WHERE session_id = ANY($1)',
      [exportedIds]
    );
  }

  return agentFiles;
}

module.exports = { listSessions, getSession, saveReview, getStats, exportForAzure };
