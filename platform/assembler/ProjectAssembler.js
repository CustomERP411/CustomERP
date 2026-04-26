// platform/assembler/ProjectAssembler.js
const path = require('path');
const BackendGenerator = require('./generators/BackendGenerator');
const FrontendGenerator = require('./generators/FrontendGenerator');
const { normalizeLanguage } = require('./i18n/labels');

const ERP_MODULE_KEYS = ['inventory', 'invoice', 'hr'];
const DEFAULT_ERP_MODULE = 'inventory';

class ProjectAssembler {
  constructor(brickRepo, outputPath) {
    this.brickRepo = brickRepo;
    this.outputPath = outputPath;
    this.backendGenerator = new BackendGenerator(brickRepo);
    this.frontendGenerator = new FrontendGenerator(brickRepo);
  }

  async assemble(projectId, sdf, options = {}) {
    const standalone = !!options.standalone;
    const language = normalizeLanguage(options.language || sdf?.language || sdf?.locale);
    const outputDir = path.join(this.outputPath, projectId);
    const backendDir = standalone ? path.join(outputDir, 'app') : path.join(outputDir, 'backend');
    const frontendDir = path.join(outputDir, 'frontend');

    console.log(`Starting assembly for project ${projectId} at ${outputDir} (standalone=${standalone}, language=${language})`);

    try {
      this._validateSdf(sdf);

      console.log('Generating backend...');
      if (standalone && typeof this.frontendGenerator.setStandalone === 'function') {
        this.frontendGenerator.setStandalone(true);
      }
      if (typeof this.frontendGenerator.setLanguage === 'function') {
        this.frontendGenerator.setLanguage(language);
      }
      if (typeof this.backendGenerator.setLanguage === 'function') {
        this.backendGenerator.setLanguage(language);
      }
      const acConfig = (sdf && sdf.modules && sdf.modules.access_control) || {};
      const accessControlEnabled = acConfig.enabled !== false;
      await this.backendGenerator.scaffold(backendDir, projectId, { standalone, accessControlEnabled, language });
      if (typeof this.backendGenerator.setModules === 'function') {
        this.backendGenerator.setModules((sdf && sdf.modules) || {});
      }
      if (typeof this.frontendGenerator.setModules === 'function') {
        this.frontendGenerator.setModules((sdf && sdf.modules) || {});
      }

      const userEntities = sdf.entities && Array.isArray(sdf.entities) ? sdf.entities : [];
      const { enabledModules, hasErpConfig } = this._resolveErpModules(sdf);
      const { normalizedEntities, moduleMap } = this._normalizeEntitiesForModules(userEntities, {
        enabledModules,
        hasErpConfig,
      });

      if (typeof this.backendGenerator.setModuleMap === 'function') {
        this.backendGenerator.setModuleMap(moduleMap);
      }
      if (typeof this.frontendGenerator.setModuleMap === 'function') {
        this.frontendGenerator.setModuleMap(moduleMap);
      }

      const backendEntities = this._withSystemEntities(normalizedEntities, sdf);
      this._relaxCircularRequiredReferences(backendEntities);

      if (backendEntities.length) {
        for (const entity of backendEntities) {
          console.log(`  - Entity: ${entity.slug}`);
          // Pass the full schema so the backend generator can enforce cross-entity rules
          // (e.g., reference integrity / delete restrictions).
          await this.backendGenerator.generateEntity(backendDir, entity, backendEntities);
        }
        await this.backendGenerator.generateRoutesIndex(backendDir, backendEntities);
      }

      await this.backendGenerator.generateDatabaseArtifacts(backendDir, backendEntities);

      await this.backendGenerator.generateMainEntry(backendDir);
      await this._applyBackendRuntimeModules(backendDir, sdf, backendEntities, language);

      // ==================== FRONTEND ====================
      console.log('Generating frontend...');
      await this.frontendGenerator.scaffold(frontendDir, sdf);

      const frontendEntities = (backendEntities || []).filter(
        (entity) => entity && !(entity.system && entity.system.hidden) && !String(entity.slug || '').startsWith('__')
      );

      if (frontendEntities.length) {
        // Generate DynamicForm component (shared)
        await this.frontendGenerator.generateDynamicForm(frontendDir);

        // Generate entity pages
        for (const entity of frontendEntities) {
          console.log(`  - Page: ${entity.slug}`);
          // Pass the FULL list of entities so the generator can resolve relationships (e.g. category_id -> categories)
          await this.frontendGenerator.generateEntityPage(frontendDir, entity, frontendEntities, sdf);
        }

        // Generate App with routes
        await this.frontendGenerator.generateApp(frontendDir, frontendEntities, sdf);

        // Generate Sidebar with links
        await this.frontendGenerator.generateSidebar(frontendDir, frontendEntities, sdf);

        // Generate Topbar with project name and user display
        await this.frontendGenerator.generateTopbar(frontendDir, sdf);
      }

      // ==================== ROOT FILES ====================
      await this._generateRootFiles(outputDir, projectId, { standalone });

      console.log('Assembly complete.');
      return outputDir;
    } catch (error) {
      console.error('Assembly failed:', error);
      throw error;
    }
  }

  _isPackEnabled(packCfg) {
    if (packCfg === true) return true;
    if (packCfg === false || packCfg === null || packCfg === undefined) return false;
    if (typeof packCfg === 'object') return packCfg.enabled !== false;
    return false;
  }

  _pickFirstString(...values) {
    for (const val of values) {
      const str = String(val || '').trim();
      if (str) return str;
    }
    return '';
  }

  _resolveErpModules(sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const hasErpConfig = ERP_MODULE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(modules, key));
    const enabled = new Set();

    if (!hasErpConfig) {
      enabled.add(DEFAULT_ERP_MODULE);
      return { enabledModules: Array.from(enabled), hasErpConfig };
    }

    for (const key of ERP_MODULE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(modules, key)) {
        continue;
      }
      const cfg = modules[key];
      const disabled = cfg === false || (cfg && typeof cfg === 'object' && cfg.enabled === false);
      if (!disabled) {
        enabled.add(key);
      }
    }

    if (enabled.size === 0) {
      enabled.add(DEFAULT_ERP_MODULE);
    }

    return { enabledModules: Array.from(enabled), hasErpConfig };
  }

  _normalizeEntityModule(entity, { hasErpConfig }) {
    if (!hasErpConfig) return DEFAULT_ERP_MODULE;
    if (!entity || typeof entity !== 'object') return DEFAULT_ERP_MODULE;

    const raw = entity.module || entity.module_slug || entity.moduleSlug;
    const cleaned = String(raw || '').trim().toLowerCase();

    if (!cleaned) return DEFAULT_ERP_MODULE;
    if (cleaned === 'shared') return 'shared';
    if (ERP_MODULE_KEYS.includes(cleaned)) return cleaned;

    console.warn(`Unknown module '${raw}', defaulting to '${DEFAULT_ERP_MODULE}'.`);
    return DEFAULT_ERP_MODULE;
  }

  _normalizeEntitiesForModules(entities, { enabledModules, hasErpConfig }) {
    const enabledSet = new Set(enabledModules || []);
    const normalizedEntities = (Array.isArray(entities) ? entities : []).map((entity) => ({
      ...entity,
      module: this._normalizeEntityModule(entity, { hasErpConfig }),
    }));

    const filtered = normalizedEntities.filter((entity) => {
      if (entity.module === 'shared') return enabledSet.size > 0;
      return enabledSet.has(entity.module);
    });

    return {
      normalizedEntities: filtered,
      moduleMap: this._buildModuleMap(filtered, enabledModules || []),
    };
  }

  _buildModuleMap(entities, enabledModules) {
    const entitiesByModule = {
      inventory: [],
      invoice: [],
      hr: [],
      shared: [],
    };

    (Array.isArray(entities) ? entities : []).forEach((entity) => {
      const moduleKey = entity && entity.module ? entity.module : DEFAULT_ERP_MODULE;
      if (!entitiesByModule[moduleKey]) {
        entitiesByModule[moduleKey] = [];
      }
      if (entity && entity.slug) {
        entitiesByModule[moduleKey].push(entity.slug);
      }
    });

    return {
      enabled: Array.isArray(enabledModules) ? enabledModules : [],
      entitiesByModule,
    };
  }

  _formatAutoName(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  }

  _resolveReferenceTargetSlug(field, slugSet) {
    if (!field || typeof field !== 'object') return null;
    const explicit =
      field.reference_entity ||
      field.referenceEntity ||
      (field.reference && field.reference.entity);
    if (explicit) {
      const normalized = String(explicit).trim();
      return normalized || null;
    }

    const name = String(field.name || '').trim();
    if (!name || (!name.endsWith('_id') && !name.endsWith('_ids'))) return null;

    const baseName = name.replace(/_ids?$/, '');
    const candidates = [
      baseName,
      `${baseName}s`,
      `${baseName}es`,
    ];

    for (const candidate of candidates) {
      if (slugSet.has(candidate)) return candidate;
    }
    return null;
  }

  _shouldPreferOptionalInCycle(fieldName) {
    const lowered = String(fieldName || '').toLowerCase();
    return (
      lowered.includes('manager') ||
      lowered.includes('approver') ||
      lowered.includes('supervisor') ||
      lowered.includes('lead') ||
      lowered.includes('owner') ||
      lowered.includes('reviewer')
    );
  }

  _pickFieldToRelax(first, second) {
    const firstPreferred = this._shouldPreferOptionalInCycle(first && first.name);
    const secondPreferred = this._shouldPreferOptionalInCycle(second && second.name);

    if (firstPreferred && !secondPreferred) return first;
    if (!firstPreferred && secondPreferred) return second;

    const firstKey = `${first?.sourceSlug || ''}.${first?.name || ''}`;
    const secondKey = `${second?.sourceSlug || ''}.${second?.name || ''}`;
    return firstKey.localeCompare(secondKey) >= 0 ? first : second;
  }

  _relaxCircularRequiredReferences(entities) {
    if (!Array.isArray(entities) || entities.length === 0) return;

    const bySlug = new Map();
    const slugSet = new Set();
    for (const entity of entities) {
      if (!entity || !entity.slug) continue;
      bySlug.set(entity.slug, entity);
      slugSet.add(entity.slug);
    }
    if (slugSet.size === 0) return;

    const refs = [];
    for (const entity of entities) {
      if (!entity || !entity.slug || !Array.isArray(entity.fields)) continue;
      for (const field of entity.fields) {
        if (!field || field.required !== true) continue;
        const targetSlug = this._resolveReferenceTargetSlug(field, slugSet);
        if (!targetSlug || !bySlug.has(targetSlug)) continue;
        refs.push({
          sourceSlug: entity.slug,
          targetSlug,
          field,
          name: String(field.name || ''),
        });
      }
    }

    if (refs.length === 0) return;

    // Self-required references create bootstrap deadlocks (first record cannot be created).
    for (const ref of refs) {
      if (ref.sourceSlug !== ref.targetSlug) continue;
      if (ref.field.required === true) {
        ref.field.required = false;
        console.warn(
          `[Assembler] Relaxed required self-reference '${ref.sourceSlug}.${ref.name}' to avoid bootstrap deadlock.`
        );
      }
    }

    // Mutual required references between two entities can deadlock create flows.
    for (const ref of refs) {
      if (ref.sourceSlug === ref.targetSlug || ref.field.required !== true) continue;

      const reverse = refs.find((candidate) =>
        candidate.sourceSlug === ref.targetSlug &&
        candidate.targetSlug === ref.sourceSlug &&
        candidate.field.required === true
      );
      if (!reverse) continue;

      const chosen = this._pickFieldToRelax(ref, reverse);
      if (chosen && chosen.field && chosen.field.required === true) {
        chosen.field.required = false;
        console.warn(
          `[Assembler] Relaxed required reference '${chosen.sourceSlug}.${chosen.name}' to break circular dependency with '${chosen.targetSlug}'.`
        );
      }
    }
  }
}

// Merge extracted domain methods onto the prototype
Object.assign(ProjectAssembler.prototype, require('./assembler/sdfValidation'));
Object.assign(ProjectAssembler.prototype, require('./assembler/inventoryConfig'));
Object.assign(ProjectAssembler.prototype, require('./assembler/invoiceConfig'));
Object.assign(ProjectAssembler.prototype, require('./assembler/hrConfig'));
Object.assign(ProjectAssembler.prototype, require('./assembler/inventoryEntities'));
Object.assign(ProjectAssembler.prototype, require('./assembler/invoiceEntities'));
Object.assign(ProjectAssembler.prototype, require('./assembler/hrEntities'));
Object.assign(ProjectAssembler.prototype, require('./assembler/systemAndRuntime'));

module.exports = ProjectAssembler;
