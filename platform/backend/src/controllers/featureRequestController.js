const featureRequestService = require('../services/featureRequestService');
const logger = require('../utils/logger');

function errStatus(err) {
  return err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
}

exports.listAll = async (req, res) => {
  try {
    const { status, source, limit, offset } = req.query;
    const data = await featureRequestService.listAll({
      status: status || undefined,
      source: source || undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    res.json(data);
  } catch (err) {
    logger.error('Feature requests listAll error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.getStats = async (_req, res) => {
  try {
    const stats = await featureRequestService.getStats();
    res.json(stats);
  } catch (err) {
    logger.error('Feature requests getStats error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, admin_notes } = req.body;
    if (!status || !['recorded', 'denied', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of: recorded, denied, in_progress, completed' });
    }
    const updated = await featureRequestService.updateStatus(req.params.id, {
      status,
      adminNotes: admin_notes ?? null,
    });
    res.json(updated);
  } catch (err) {
    logger.error('Feature requests updateStatus error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.listMine = async (req, res) => {
  try {
    const requests = await featureRequestService.listByUser(req.user.userId);
    res.json({ requests });
  } catch (err) {
    logger.error('Feature requests listMine error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.getDetail = async (req, res) => {
  try {
    const fr = await featureRequestService.getById(req.params.id);
    const messages = await featureRequestService.getMessages(req.params.id);
    res.json({ ...fr, messages });
  } catch (err) {
    logger.error('Feature request getDetail error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.getMyDetail = async (req, res) => {
  try {
    const fr = await featureRequestService.getById(req.params.id);
    if (fr.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const messages = await featureRequestService.getMessages(req.params.id);
    res.json({ ...fr, messages });
  } catch (err) {
    logger.error('Feature request getMyDetail error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};

exports.addMessage = async (req, res) => {
  try {
    const { body: msgBody } = req.body;
    if (!msgBody || typeof msgBody !== 'string' || !msgBody.trim()) {
      return res.status(400).json({ error: 'body is required' });
    }
    const isAdmin = req.user.isAdmin === true || req.user.is_admin === true;
    const senderRole = isAdmin ? 'admin' : 'user';
    const fr = await featureRequestService.getById(req.params.id);
    if (!isAdmin && fr.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const message = await featureRequestService.addMessage({
      featureRequestId: req.params.id,
      senderId: req.user.userId,
      senderRole,
      body: msgBody.trim(),
    });
    res.status(201).json(message);
  } catch (err) {
    logger.error('Feature request addMessage error:', err);
    res.status(errStatus(err)).json({ error: err.message || 'Internal server error' });
  }
};
