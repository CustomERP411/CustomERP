const trainingService = require('../services/trainingService');
const logger = require('../utils/logger');

function errStatus(err) {
  return err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
}

exports.listSessions = async (req, res) => {
  try {
    const { limit, offset, endpoint, quality, reviewed, agent } = req.query;
    const data = await trainingService.listSessions({
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      endpoint: endpoint || undefined,
      quality: quality || undefined,
      reviewed: reviewed || undefined,
      agent: agent || undefined,
    });
    res.json(data);
  } catch (err) {
    logger.error('Training listSessions error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.getStats = async (_req, res) => {
  try {
    const stats = await trainingService.getStats();
    res.json(stats);
  } catch (err) {
    logger.error('Training getStats error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.getSession = async (req, res) => {
  try {
    const session = await trainingService.getSession(req.params.sessionId);
    res.json(session);
  } catch (err) {
    logger.error('Training getSession error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.saveReview = async (req, res) => {
  try {
    const { quality, notes, edited_output, corrective_instruction } = req.body;
    if (!quality || !['good', 'bad', 'needs_edit'].includes(quality)) {
      return res.status(400).json({ error: 'quality must be one of: good, bad, needs_edit' });
    }
    const review = await trainingService.saveReview(req.params.sessionId, {
      quality,
      notes: notes || null,
      editedOutput: edited_output || null,
      correctiveInstruction: corrective_instruction || null,
    });
    res.json({ review });
  } catch (err) {
    logger.error('Training saveReview error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.saveStepReview = async (req, res) => {
  try {
    const { sessionId, agent } = req.params;
    const { quality, notes, edited_output, corrective_instruction } = req.body;
    if (!quality || !['good', 'bad', 'needs_edit'].includes(quality)) {
      return res.status(400).json({ error: 'quality must be one of: good, bad, needs_edit' });
    }
    const review = await trainingService.saveStepReview(sessionId, agent, {
      quality,
      notes: notes || null,
      editedOutput: edited_output || null,
      correctiveInstruction: corrective_instruction || null,
    });
    res.json({ review });
  } catch (err) {
    logger.error('Training saveStepReview error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.exportAzure = async (req, res) => {
  try {
    const { agent_types, quality_filter } = req.body;
    const agentFiles = await trainingService.exportForAzure({
      agentTypes: Array.isArray(agent_types) ? agent_types : [],
      qualityFilter: quality_filter || 'good',
    });

    const entries = Object.entries(agentFiles);
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No exportable data found for the given filters' });
    }

    if (entries.length === 1) {
      const [agentName, lines] = entries[0];
      const bom = '\uFEFF';
      const content = bom + lines.join('\n') + '\n';
      res.setHeader('Content-Type', 'application/jsonl; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${agentName}.jsonl"`);
      return res.send(content);
    }

    const archiver = require('archiver');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="training_export.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    for (const [agentName, lines] of entries) {
      const bom = '\uFEFF';
      const content = bom + lines.join('\n') + '\n';
      archive.append(content, { name: `${agentName}.jsonl` });
    }
    await archive.finalize();
  } catch (err) {
    logger.error('Training export error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};
