const Project = require('../models/Project');

class ProjectService {
  async getUserProjects(userId) {
    return Project.findByUser(userId);
  }

  async createProject(userId, data) {
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Project name is required');
    }
    return Project.create({ name: data.name.trim(), userId });
  }

  async getProject(id, userId) {
    const project = await Project.findById(id, userId);
    if (!project) throw new Error('Project not found');
    return project;
  }

  async updateProject(id, userId, updates) {
    const project = await Project.update(id, userId, updates);
    if (!project) throw new Error('Project not found');
    return project;
  }

  async deleteProject(id, userId) {
    const deleted = await Project.delete(id, userId);
    if (!deleted) throw new Error('Project not found');
    return true;
  }
}

module.exports = new ProjectService();

