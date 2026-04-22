const Project = require('../models/Project');
const authService = require('./authService');
const { normalizeLanguage, DEFAULT_LANGUAGE } = require('./authService');

class ProjectService {
  async getUserProjects(userId) {
    return Project.findByUser(userId);
  }

  /**
   * Create a project. Language is silently inherited from the user's
   * preferred_language. An explicit `data.language` is only honoured if it
   * matches a supported locale; otherwise we fall back to the user's
   * preference, then to the system default.
   */
  async createProject(userId, data) {
    if (!data || !data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('Project name is required');
    }

    let language = DEFAULT_LANGUAGE;
    try {
      const user = await authService.findById(userId);
      if (user && user.preferred_language) {
        language = normalizeLanguage(user.preferred_language);
      }
    } catch (_) {
      /* fall back to default language */
    }

    if (data.language !== undefined && data.language !== null) {
      language = normalizeLanguage(data.language);
    }

    return Project.create({
      name: data.name.trim(),
      userId,
      language,
    });
  }

  async getProject(id, userId) {
    const project = await Project.findById(id, userId);
    if (!project) throw new Error('Project not found');
    return project;
  }

  async updateProject(id, userId, updates) {
    // Strip any attempt to change `language` — it's locked at creation.
    const { language: _ignored, ...safeUpdates } = updates || {};
    const project = await Project.update(id, userId, safeUpdates);
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
