const projectService = require('../services/projectService');
const logger = require('../utils/logger');

exports.listProjects = async (req, res) => {
  try {
    const projects = await projectService.getUserProjects(req.user.id);
    res.json({ projects });
  } catch (err) {
    logger.error('List projects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.createProject = async (req, res) => {
  try {
    const project = await projectService.createProject(req.user.id, req.body);
    res.status(201).json(project);
  } catch (err) {
    logger.error('Create project error:', err);
    if (err.message === 'Project name is required') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProject = async (req, res) => {
  try {
    const project = await projectService.getProject(req.params.id, req.user.id);
    res.json(project);
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Get project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateProject = async (req, res) => {
  try {
    const project = await projectService.updateProject(req.params.id, req.user.id, req.body);
    res.json(project);
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Update project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteProject = async (req, res) => {
  try {
    await projectService.deleteProject(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) {
    if (err.message === 'Project not found') {
      return res.status(404).json({ error: err.message });
    }
    logger.error('Delete project error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

