// brick-library/backend-bricks/repository/FlatFileProvider.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');

class FlatFileProvider {
  constructor(dataPath = './data') {
    this.dataPath = dataPath;
  }

  _getFilePath(entitySlug) {
    return path.join(this.dataPath, `${entitySlug}.json`);
  }

  async _ensureDataDir() {
    try {
      await fs.access(this.dataPath);
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
    }
  }

  async _ensureFile(entitySlug) {
    await this._ensureDataDir();
    const filePath = this._getFilePath(entitySlug);
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, '[]');
    }
  }

  async _atomicWrite(entitySlug, data) {
    const filePath = this._getFilePath(entitySlug);
    const tempPath = `${filePath}.tmp`;
    
    // Write to temp file first
    await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
    
    // Atomic rename (replaces target file if it exists)
    await fs.rename(tempPath, filePath);
  }

  async findAll(entitySlug) {
    await this._ensureFile(entitySlug);
    const data = await fs.readFile(this._getFilePath(entitySlug), 'utf8');
    try {
      return JSON.parse(data);
    } catch (e) {
      // If file is corrupted or empty, return empty array
      return [];
    }
  }

  async findById(entitySlug, id) {
    const items = await this.findAll(entitySlug);
    return items.find(item => item.id === id) || null;
  }

  async create(entitySlug, data) {
    const items = await this.findAll(entitySlug);
    const newItem = {
      id: uuid(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    items.push(newItem);
    await this._atomicWrite(entitySlug, items);
    return newItem;
  }

  async update(entitySlug, id, data) {
    const items = await this.findAll(entitySlug);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    // Create new object but preserve immutable system fields
    items[index] = {
      ...items[index], // Keep existing fields
      ...data,         // Overwrite with new data
      id: items[index].id, // Prevent ID change
      created_at: items[index].created_at, // Preserve creation time
      updated_at: new Date().toISOString() // Update modification time
    };
    
    await this._atomicWrite(entitySlug, items);
    return items[index];
  }

  async delete(entitySlug, id) {
    const items = await this.findAll(entitySlug);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    items.splice(index, 1);
    await this._atomicWrite(entitySlug, items);
    return true;
  }
}

module.exports = FlatFileProvider;
