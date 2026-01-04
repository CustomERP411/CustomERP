const logger = require('../utils/logger');

const DEFAULT_BASE_URL = 'http://localhost:8000';
const BASE_URL = (process.env.AI_GATEWAY_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');

async function postJson(path, body) {
  const url = `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = typeof data === 'object' && data ? (data.detail || data.error || JSON.stringify(data)) : String(data || '');
    const err = new Error(detail || `AI Gateway error (${res.status})`);
    err.statusCode = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

async function analyzeDescription(description, priorContext = null) {
  if (!description || typeof description !== 'string') throw new Error('description must be a string');
  return await postJson('/ai/analyze', { description, prior_context: priorContext });
}

async function clarifySdf({ businessDescription, partialSdf, answers }) {
  return await postJson('/ai/clarify', {
    business_description: businessDescription,
    partial_sdf: partialSdf,
    answers: Array.isArray(answers) ? answers : [],
  });
}

async function finalizeSdf(sdf) {
  return await postJson('/ai/finalize', sdf);
}

async function editSdf({ businessDescription, currentSdf, instructions }) {
  if (!instructions || typeof instructions !== 'string') throw new Error('instructions must be a string');
  if (!currentSdf || typeof currentSdf !== 'object') throw new Error('currentSdf must be an object');
  return await postJson('/ai/edit', {
    business_description: businessDescription,
    current_sdf: currentSdf,
    instructions,
  });
}

module.exports = {
  analyzeDescription,
  clarifySdf,
  finalizeSdf,
  editSdf,
  BASE_URL,
};


