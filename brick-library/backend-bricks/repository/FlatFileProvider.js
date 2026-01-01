/**
 * FlatFileProvider - JSON File-based Repository Implementation
 * 
 * This provider stores data in JSON files, one file per entity type.
 * Used in Increment 1 for simplicity; can be swapped for PostgreSQL later.
 * 
 * Data structure:
 *   /data/product.json  → [{ id, name, price, ... }, ...]
 *   /data/category.json → [{ id, name }, ...]
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuid } = require('uuid');
const RepositoryInterface = require('./RepositoryInterface');

class FlatFileProvider extends RepositoryInterface {
  /**
   * @param {string} dataPath - Path to the data directory
   */
  constructor(dataPath = './data') {
    super();
    this.dataPath = dataPath;
  }

  /**
   * Get the file path for an entity
   * @private
   */
  _getFilePath(entitySlug) {
    return path.join(this.dataPath, `${entitySlug}.json`);
  }

  /**
   * Ensure the data file exists
   * @private
   */
  async _ensureFile(entitySlug) {
    const filePath = this._getFilePath(entitySlug);
    try {
      await fs.access(filePath);
    } catch {
      // File doesn't exist, create it
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.writeFile(filePath, '[]', 'utf8');
    }
  }

  /**
   * Read all data from a file
   * @private
   */
  async _readData(entitySlug) {
    await this._ensureFile(entitySlug);
    const filePath = this._getFilePath(entitySlug);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  /**
   * Write data to a file
   * @private
   */
  async _writeData(entitySlug, data) {
    const filePath = this._getFilePath(entitySlug);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * @inheritdoc
   */
  async findAll(entitySlug) {
    return this._readData(entitySlug);
  }

  /**
   * @inheritdoc
   */
  async findById(entitySlug, id) {
    const items = await this._readData(entitySlug);
    return items.find(item => item.id === id) || null;
  }

  /**
   * @inheritdoc
   */
  async findWhere(entitySlug, query) {
    const items = await this._readData(entitySlug);
    return items.filter(item => {
      return Object.entries(query).every(([key, value]) => item[key] === value);
    });
  }

  /**
   * @inheritdoc
   */
  async create(entitySlug, data) {
    const items = await this._readData(entitySlug);
    
    const newItem = {
      id: uuid(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    items.push(newItem);
    await this._writeData(entitySlug, items);
    
    return newItem;
  }

  /**
   * @inheritdoc
   */
  async update(entitySlug, id, data) {
    const items = await this._readData(entitySlug);
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
      return null;
    }
    
    // Preserve id and created_at, update the rest
    items[index] = {
      ...items[index],
      ...data,
      id: items[index].id,                    // Prevent ID change
      created_at: items[index].created_at,    // Preserve original creation time
      updated_at: new Date().toISOString(),   // Update modification time
    };
    
    await this._writeData(entitySlug, items);
    return items[index];
  }

  /**
   * @inheritdoc
   */
  async delete(entitySlug, id) {
    const items = await this._readData(entitySlug);
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
      return false;
    }
    
    items.splice(index, 1);
    await this._writeData(entitySlug, items);
    
    return true;
  }

  /**
   * @inheritdoc
   */
  async count(entitySlug, query = {}) {
    if (Object.keys(query).length === 0) {
      const items = await this._readData(entitySlug);
      return items.length;
    }
    
    const items = await this.findWhere(entitySlug, query);
    return items.length;
  }

  /**
   * Clear all data for an entity (useful for testing)
   * @param {string} entitySlug - The entity type
   */
  async clear(entitySlug) {
    await this._writeData(entitySlug, []);
  }

  /**
   * Initialize data file with seed data
   * @param {string} entitySlug - The entity type
   * @param {Array} seedData - Initial data to populate
   */
  async seed(entitySlug, seedData) {
    const items = seedData.map(data => ({
      id: uuid(),
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    
    await this._writeData(entitySlug, items);
    return items;
  }
}

module.exports = FlatFileProvider;

