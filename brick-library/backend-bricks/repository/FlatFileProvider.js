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

  async _read(entitySlug) {
    await this._ensureFile(entitySlug);
    const data = await fs.readFile(this._getFilePath(entitySlug), 'utf8');
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }

  /**
   * Find all items, optionally filtering by exact field match
   * Example: findAll('products', { category_id: '123', status: 'active' })
   */
  async findAll(entitySlug, filter = {}) {
    const items = await this._read(entitySlug);
    if (Object.keys(filter).length === 0) return items;

    return items.filter(item => {
      return Object.entries(filter).every(([key, val]) => {
        // Handle array filters (e.g., find items where id is in [1, 2, 3])
        if (Array.isArray(val)) {
            return val.includes(item[key]);
        }
        // strict equality for now
        return String(item[key]) === String(val);
      });
    });
  }

  async findById(entitySlug, id) {
    const items = await this._read(entitySlug);
    return items.find(item => item.id === id) || null;
  }

  /**
   * Find item and join a related entity
   * Example: findWithRelation('products', '123', 'category')
   * Expects 'category_id' field on product
   */
  async findWithRelation(entitySlug, id, relationSlug) {
    const item = await this.findById(entitySlug, id);
    if (!item) return null;

    const foreignKey = `${relationSlug}_id`; // convention: category -> category_id
    if (item[foreignKey]) {
        const relatedItem = await this.findById(relationSlug, item[foreignKey]);
        item[relationSlug] = relatedItem; // Attach related object
    }
    return item;
  }

  async create(entitySlug, data) {
    const items = await this._read(entitySlug);
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
    const items = await this._read(entitySlug);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    
    items[index] = {
      ...items[index],
      ...data,
      id: items[index].id, // Prevent ID change
      created_at: items[index].created_at, // Preserve original
      updated_at: new Date().toISOString()
    };
    
    await this._atomicWrite(entitySlug, items);
    return items[index];
  }

  async delete(entitySlug, id) {
    const items = await this._read(entitySlug);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return false;
    
    items.splice(index, 1);
    await this._atomicWrite(entitySlug, items);
    return true;
  }
}

module.exports = FlatFileProvider;
