const fs = require('fs').promises;
const path = require('path');

const NAME_ALIASES = {
  audit: 'AuditMixin',
  audit_trail: 'AuditMixin',
  inventory: 'InventoryMixin',
  stock_tracking: 'InventoryMixin',
  batch: 'BatchTrackingMixin',
  batch_tracking: 'BatchTrackingMixin',
  serial: 'SerialTrackingMixin',
  serial_tracking: 'SerialTrackingMixin',
  location: 'LocationMixin',
  multi_location: 'LocationMixin',
};

class MixinRegistry {
  constructor({ brickLibraryPath, customMixinsPath }) {
    this.brickLibraryPath = brickLibraryPath;
    this.customMixinsPath = customMixinsPath;
    this._cache = new Map();
  }

  resolveName(rawName) {
    const cleaned = String(rawName || '').trim().replace(/\.js$/i, '');
    const base = path.basename(cleaned);
    if (!base || base !== cleaned) {
      throw new Error(`Invalid mixin name: ${rawName}`);
    }
    const alias = NAME_ALIASES[base];
    return alias || base;
  }

  async loadMixin(rawName, config = {}, context = {}) {
    const name = this.resolveName(rawName);
    const mixinPath = await this._findMixinPath(name);

    if (!mixinPath) {
      throw new Error(`Mixin not found: ${name}`);
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const raw = require(mixinPath);
    const mixin = typeof raw === 'function' ? await raw(config, context) : raw;

    return {
      name,
      hooks: mixin && mixin.hooks ? mixin.hooks : {},
      methods: mixin && mixin.methods ? mixin.methods : '',
      dependencies: Array.isArray(mixin?.dependencies) ? mixin.dependencies : [],
    };
  }

  async _findMixinPath(name) {
    const builtIn = path.join(this.brickLibraryPath, 'backend-bricks', 'mixins', `${name}.js`);
    if (await this._exists(builtIn)) return builtIn;

    if (this.customMixinsPath) {
      const custom = path.join(this.customMixinsPath, `${name}.js`);
      if (await this._exists(custom)) return custom;
    }

    return null;
  }

  async _exists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = MixinRegistry;
