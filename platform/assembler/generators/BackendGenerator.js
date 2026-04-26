// platform/assembler/generators/BackendGenerator.js
const fs = require('fs').promises;
const path = require('path');
const CodeWeaver = require('../CodeWeaver');
const TemplateEngine = require('../TemplateEngine');
const MixinRegistry = require('../MixinRegistry');
const { tFor, moduleDisplayNames, normalizeLanguage } = require('../i18n/labels');

class BackendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
    this.modules = {};
    this.moduleMap = {};
    this._moduleDirs = new Set();
    this._standalone = false;
    this._language = 'en';
    const customMixinsPath =
      process.env.CUSTOM_MIXINS_PATH ||
      path.resolve(this.brickRepo.libraryPath, '..', 'custom_mixins');
    this.mixinRegistry = new MixinRegistry({
      brickLibraryPath: this.brickRepo.libraryPath,
      customMixinsPath,
    });
  }

  setModules(modules) {
    this.modules = modules && typeof modules === 'object' ? modules : {};
  }

  setModuleMap(moduleMap) {
    this.moduleMap = moduleMap && typeof moduleMap === 'object' ? moduleMap : {};
  }

  setLanguage(language) {
    this._language = normalizeLanguage(language);
  }

  _getModuleKey(entity) {
    const raw = entity && (entity.module || entity.module_slug || entity.moduleSlug);
    const cleaned = String(raw || 'inventory').trim().toLowerCase();
    return cleaned || 'inventory';
  }

  _pickFirstString(...values) {
    for (const value of values) {
      const str = String(value || '').trim();
      if (str) return str;
    }
    return '';
  }

  _isPackEnabled(packCfg) {
    if (packCfg === true) return true;
    if (packCfg === false || packCfg === null || packCfg === undefined) return false;
    if (typeof packCfg === 'object') return packCfg.enabled !== false;
    return false;
  }

  async _ensureModuleDirs(outputDir, moduleKey) {
    if (this._moduleDirs.has(moduleKey)) return;

    const moduleRoot = path.join(outputDir, 'modules', moduleKey);
    const dirs = [
      'src/controllers',
      'src/routes',
      'src/services',
      'src/repository',
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(moduleRoot, dir), { recursive: true });
    }

    if (this._standalone) {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/SQLiteProvider.js',
        path.join(moduleRoot, 'src/repository/SQLiteProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/sqliteDb.js',
        path.join(moduleRoot, 'src/repository/sqliteDb.js')
      );
    } else {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/PostgresProvider.js',
        path.join(moduleRoot, 'src/repository/PostgresProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/db.js',
        path.join(moduleRoot, 'src/repository/db.js')
      );
    }

    this._moduleDirs.add(moduleKey);
  }

  async scaffold(outputDir, projectId, options = {}) {
    this._moduleDirs = new Set();
    this._standalone = !!options.standalone;
    this._accessControlEnabled = !!options.accessControlEnabled;

    const dirs = [
      'src/controllers',
      'src/routes',
      'src/services',
      'src/repository',
      'modules'
    ];

    if (this._accessControlEnabled) {
      dirs.push('src/rbac');
    }

    for (const dir of dirs) {
      await fs.mkdir(path.join(outputDir, dir), { recursive: true });
    }

    await this._generateBaseFiles(outputDir, projectId);

    if (this._standalone) {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/SQLiteProvider.js',
        path.join(outputDir, 'src/repository/SQLiteProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/sqliteDb.js',
        path.join(outputDir, 'src/repository/sqliteDb.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/runSQLiteMigrations.js',
        path.join(outputDir, 'src/repository/runSQLiteMigrations.js')
      );
    } else {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/PostgresProvider.js',
        path.join(outputDir, 'src/repository/PostgresProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/db.js',
        path.join(outputDir, 'src/repository/db.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/runMigrations.js',
        path.join(outputDir, 'src/repository/runMigrations.js')
      );
    }

    if (this._accessControlEnabled) {
      await this.brickRepo.copyFile(
        'backend-bricks/rbac/rbacMiddleware.js',
        path.join(outputDir, 'src/rbac/rbacMiddleware.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/rbac/rbacSeed.js',
        path.join(outputDir, 'src/rbac/rbacSeed.js')
      );
      await this._generateRbacLabels(outputDir);
      await this.brickRepo.copyFile(
        'backend-bricks/rbac/rbacRoutes.js',
        path.join(outputDir, 'src/rbac/rbacRoutes.js')
      );
    }
  }

  async _generateRbacLabels(outputDir) {
    const t = tFor(this._language);
    const moduleNames = moduleDisplayNames(this._language);
    const labels = {
      language: this._language,
      modules: {
        ...moduleNames,
        access_control: t('sidebar.settings'),
      },
      actions: {
        create: t('rbac.actionCreate'),
        read: t('rbac.actionRead'),
        update: t('rbac.actionUpdate'),
        delete: t('rbac.actionDelete'),
      },
      seed: {
        superadminDescription: t('rbac.seedSuperadminDescription'),
        adminDescription: t('rbac.seedAdminDescription'),
        moduleAdminGroupSuffix: t('rbac.seedModuleAdminGroupSuffix'),
        moduleAdminDescription: t('rbac.seedModuleAdminDescription'),
        permissionDescription: t('rbac.seedPermissionDescription'),
        customPermissionDescription: t('rbac.seedCustomPermissionDescription'),
      },
    };

    const content = `// Generated by the assembler. Machine permission keys stay stable; labels are localized.\nmodule.exports = ${JSON.stringify(labels, null, 2)};\n`;
    await fs.writeFile(path.join(outputDir, 'src/rbac/rbacLabels.js'), content);
  }

  async _generateBaseFiles(outputDir, projectId) {
    console.log(`  Using ${this._standalone ? 'standalone' : 'docker'} templates`);
    const files = this._standalone
      ? [
          { template: 'standalone/package.json.template', dest: 'package.json' },
        ]
      : [
          { template: 'package.json.template', dest: 'package.json' },
          { template: 'Dockerfile.template', dest: 'Dockerfile' },
          { template: 'docker-compose.template.yml', dest: 'docker-compose.yml' },
          { template: 'README.template.md', dest: 'README.md' },
        ];

    for (const file of files) {
      const template = await this.brickRepo.getTemplate(file.template);
      const content = TemplateEngine.render(template, { projectId });
      await fs.writeFile(path.join(outputDir, file.dest), content);
    }

    if (this._standalone) {
      await fs.writeFile(path.join(outputDir, '.standalone'), 'true\n');
    }
  }

  async generateEntity(outputDir, entity, allEntities = []) {
    const moduleKey = this._getModuleKey(entity);
    await this._ensureModuleDirs(outputDir, moduleKey);
    const moduleRoot = path.join(outputDir, 'modules', moduleKey);
    const moduleSrcDir = path.join(moduleRoot, 'src');

    const mixinsToApply = await this._resolveMixins(entity, allEntities);
    const effectiveMixinConfig = this._buildEffectiveMixinConfig(entity, mixinsToApply);

    const context = {
      EntityName: this._capitalize(entity.slug),
      entitySlug: entity.slug,
      mixinConfig: JSON.stringify(effectiveMixinConfig),
      ProviderName: this._standalone ? 'SQLiteProvider' : 'PostgresProvider',
    };

    const controllerTemplate = await this.brickRepo.getTemplate('BaseController.js.hbs');
    const controllerContent = TemplateEngine.render(controllerTemplate, context);
    await fs.writeFile(
      path.join(moduleSrcDir, `controllers/${context.EntityName}Controller.js`),
      controllerContent
    );

    await this._generateService(moduleSrcDir, entity, context, allEntities, mixinsToApply);
    await this._generateEntityRoute(moduleSrcDir, entity, context);
  }

  async _generateService(moduleSrcDir, entity, context, allEntities = [], mixinsToApply = null) {
    const serviceTemplate = await this.brickRepo.getTemplate('BaseService.js.hbs');
    const weaver = new CodeWeaver(serviceTemplate);

    const resolvedMixins = Array.isArray(mixinsToApply)
      ? mixinsToApply
      : await this._resolveMixins(entity, allEntities);

    for (const mixinEntry of resolvedMixins) {
      await this._applyMixin(weaver, mixinEntry, { entity, allEntities });
    }

    this._injectSchemaValidations(weaver, entity, allEntities);

    let finalContent = weaver.getContent();
    finalContent = TemplateEngine.render(finalContent, context);

    await fs.writeFile(
      path.join(moduleSrcDir, `services/${context.EntityName}Service.js`),
      finalContent
    );
  }

  async generateDatabaseArtifacts(outputDir, entities = []) {
    const repoDir = path.join(outputDir, 'src/repository');
    const migrationsDir = path.join(repoDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    const sql = this._standalone
      ? this._buildSQLiteSchemaSql(entities)
      : this._buildDatabaseSchemaSql(entities);
    await fs.writeFile(path.join(migrationsDir, '001_initial_schema.sql'), sql);

    const backfill = this._buildCommittedBackfillSql(entities);
    if (backfill) {
      await fs.writeFile(
        path.join(migrationsDir, '002_committed_backfill.sql'),
        backfill
      );
    }
  }

  /**
   * Builds a safe backfill migration that zeroes every product's
   * committed_quantity, so the new sales-order-driven commitment math
   * starts from a known baseline. Only emitted when the stock entity has
   * a committed_quantity column.
   *
   * Operators are expected to call POST /sales-orders/recompute-committed
   * immediately after deploy to repopulate the column from approved
   * unshipped sales order lines. A SQL-level hint comment is included for
   * anyone inspecting the migration manually.
   */
  _buildCommittedBackfillSql(entities = []) {
    const list = Array.isArray(entities) ? entities : [];
    const stockEntities = list.filter((entity) => {
      if (!entity || !entity.slug) return false;
      const fields = Array.isArray(entity.fields) ? entity.fields : [];
      return fields.some((f) => f && f.name === 'committed_quantity');
    });

    if (stockEntities.length === 0) return null;

    const header = [
      '-- Generated by CustomERP assembler',
      '-- 002_committed_backfill.sql',
      '--',
      '-- Purpose: zero out committed_quantity on every stock row so that the',
      '-- sales-order-driven commitment math in SalesOrderCommitmentMixin starts',
      '-- from a known baseline. Available_quantity is recomputed to keep the',
      '-- denormalized column consistent.',
      '--',
      '-- IMPORTANT: after this migration runs, call',
      "--   POST /api/sales-orders/recompute-committed",
      '-- to rebuild committed_quantity from approved unshipped sales order lines.',
      '',
    ];

    const buildBlock = (entity) => {
      const table = `"${String(entity.slug).replace(/"/g, '""')}"`;
      const fields = Array.isArray(entity.fields) ? entity.fields : [];
      const fieldNames = new Set(fields.map((f) => f && f.name).filter(Boolean));
      const stmts = [`UPDATE ${table} SET committed_quantity = 0 WHERE committed_quantity IS NOT NULL;`];
      if (
        fieldNames.has('available_quantity') &&
        fieldNames.has('quantity') &&
        fieldNames.has('reserved_quantity')
      ) {
        stmts.push(
          `UPDATE ${table} SET available_quantity = COALESCE(quantity, 0) - COALESCE(reserved_quantity, 0) - COALESCE(committed_quantity, 0);`
        );
      }
      return stmts.join('\n');
    };

    const body = stockEntities.map(buildBlock).join('\n\n');
    return `${header.join('\n')}\n${body}\n`;
  }

  async generateMainEntry(outputDir) {
    const templateName = this._standalone
      ? 'standalone/index.js.template'
      : 'index.js.template';
    const template = await this.brickRepo.getTemplate(templateName);
    await fs.writeFile(path.join(outputDir, 'src/index.js'), template);
  }
}

// Merge extracted method groups onto the prototype
Object.assign(BackendGenerator.prototype, require('./backend/inventoryConfig'));
Object.assign(BackendGenerator.prototype, require('./backend/invoiceConfig'));
Object.assign(BackendGenerator.prototype, require('./backend/hrConfig'));
Object.assign(BackendGenerator.prototype, require('./backend/mixinConfigBuilders'));
Object.assign(BackendGenerator.prototype, require('./backend/mixinResolver'));
Object.assign(BackendGenerator.prototype, require('./backend/routeGenerator'));
Object.assign(BackendGenerator.prototype, require('./backend/validationCodegen'));
Object.assign(BackendGenerator.prototype, require('./backend/schemaGenerator'));

module.exports = BackendGenerator;
