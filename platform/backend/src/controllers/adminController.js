const adminService = require('../services/adminService');
const logger = require('../utils/logger');

exports.listUsers = async (req, res) => {
  try {
    const users = await adminService.listUsers();
    res.json({ users });
  } catch (err) {
    logger.error('Admin listUsers error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.listAllProjects = async (req, res) => {
  try {
    const projects = await adminService.listAllProjects();
    res.json({ projects });
  } catch (err) {
    logger.error('Admin listAllProjects error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.setAdminStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_admin } = req.body;
    if (typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'is_admin (boolean) is required' });
    }
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot change your own admin status' });
    }
    const user = await adminService.setAdminStatus(userId, is_admin);
    res.json({ user });
  } catch (err) {
    logger.error('Admin setAdminStatus error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot block your own account' });
    }
    const user = await adminService.blockUser(userId, reason || null);
    res.json({ user });
  } catch (err) {
    logger.error('Admin blockUser error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await adminService.unblockUser(userId);
    res.json({ user });
  } catch (err) {
    logger.error('Admin unblockUser error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};
