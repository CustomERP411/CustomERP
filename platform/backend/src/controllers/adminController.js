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

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email } = req.body;
    if (!name && !email) {
      return res.status(400).json({ error: 'At least one of name or email is required' });
    }
    const user = await adminService.updateUser(userId, { name, email });
    res.json({ user });
  } catch (err) {
    logger.error('Admin updateUser error:', err);
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

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account from the admin panel' });
    }
    await adminService.deleteUser(userId);
    res.json({ message: 'User deleted' });
  } catch (err) {
    logger.error('Admin deleteUser error:', err);
    const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  }
};
