const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const SDF = require('../models/SDF');
const erpGenerationService = require('../services/erpGenerationService');
const { validateGeneratorSdf } = require('./projectHelpers');

exports.generateErpZip = async (req, res) => {
  req.setTimeout(300000);
  let outputDir = null;
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;

    const project = await projectService.getProject(projectId, userId);
    const latest = await SDF.findLatestByProject(project.id);
    if (!latest?.sdf_json) {
      return res.status(400).json({ error: 'No SDF found. Analyze and save an SDF first.' });
    }

    const sdf = latest.sdf_json;
    const validation = validateGeneratorSdf(sdf);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Latest SDF is invalid: ' + validation.error });
    }

    const result = await erpGenerationService.generateProjectDir({
      projectId: project.name || project.id,
      sdf,
      language: project.language,
    });
    outputDir = result.outputDir;

    await projectService.updateProject(projectId, userId, { status: 'Generated' });

    await erpGenerationService.streamZipFromDir(res, {
      outputDir,
      zipName: sdf.project_name || project.name || 'custom-erp',
    });
  } catch (err) {
    logger.error('Generate ERP zip error:', err);
    if (!res.headersSent) {
      const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
      res.status(status).json({ error: err.message || 'Internal server error' });
    }
  } finally {
    if (outputDir) {
      await erpGenerationService.rmDirRecursive(outputDir);
    }
  }
};

exports.generateStandaloneErpZip = async (req, res) => {
  req.setTimeout(300000);
  let outputDir = null;
  try {
    const userId = req.user.userId;
    const projectId = req.params.id;
    const platform = String(req.query.platform || '').trim();

    if (!platform) {
      return res.status(400).json({
        error: 'Missing required query parameter: platform',
        supported: ['macos-arm64', 'macos-x64', 'linux-x64', 'windows-x64'],
      });
    }

    const project = await projectService.getProject(projectId, userId);
    const latest = await SDF.findLatestByProject(project.id);
    if (!latest?.sdf_json) {
      return res.status(400).json({ error: 'No SDF found. Analyze and save an SDF first.' });
    }

    const sdf = latest.sdf_json;
    const validation = validateGeneratorSdf(sdf);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Latest SDF is invalid: ' + validation.error });
    }

    const result = await erpGenerationService.generateStandaloneDir({
      projectId: project.name || project.id,
      sdf,
      platform,
      language: project.language,
    });
    outputDir = result.outputDir;

    await projectService.updateProject(projectId, userId, { status: 'Generated' });

    const zipName = `${sdf.project_name || project.name || 'custom-erp'}-${platform}`;
    await erpGenerationService.streamZipFromDir(res, { outputDir, zipName });
  } catch (err) {
    logger.error('Generate standalone ERP zip error:', err);
    if (!res.headersSent) {
      const status = err.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
      res.status(status).json({ error: err.message || 'Internal server error' });
    }
  } finally {
    if (outputDir) {
      await erpGenerationService.rmDirRecursive(outputDir);
    }
  }
};
