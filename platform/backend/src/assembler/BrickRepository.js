// platform/backend/src/assembler/BrickRepository.js
const fs = require('fs').promises;
const path = require('path');

class BrickRepository {
  constructor(libraryPath) {
    this.libraryPath = libraryPath;
  }

  async getTemplate(templateName) {
    // Try multiple locations for convenience
    const locations = [
      'templates',
      'backend-bricks/core',
      'backend-bricks/controllers',
      'backend-bricks/services',
      'backend-bricks/repository',
      'frontend-bricks/components',
      'frontend-bricks/widgets',
      'frontend-bricks/pages',
      'frontend-bricks/layouts'
    ];

    for (const loc of locations) {
      const fullPath = path.join(this.libraryPath, loc, templateName);
      try {
        await fs.access(fullPath);
        return fs.readFile(fullPath, 'utf8');
      } catch {
        continue;
      }
    }
    throw new Error(`Template not found: ${templateName}`);
  }

  async copyFile(sourcePath, destPath) {
    // sourcePath is relative to libraryPath
    const fullSource = path.join(this.libraryPath, sourcePath);
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    
    await fs.copyFile(fullSource, destPath);
  }

  async getManifest() {
    const manifestPath = path.join(this.libraryPath, 'manifest.json');
    try {
      const data = await fs.readFile(manifestPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {}; // Return empty manifest if not found
    }
  }
}

module.exports = BrickRepository;
