// platform/assembler/ProjectAssembler.js
const path = require('path');
const BackendGenerator = require('./generators/BackendGenerator');
const FrontendGenerator = require('./generators/FrontendGenerator');

const ERP_MODULE_KEYS = ['inventory', 'invoice', 'hr'];
const DEFAULT_ERP_MODULE = 'inventory';

class ProjectAssembler {
  constructor(brickRepo, outputPath) {
    this.brickRepo = brickRepo;
    this.outputPath = outputPath;
    this.backendGenerator = new BackendGenerator(brickRepo);
    this.frontendGenerator = new FrontendGenerator(brickRepo);
  }

  async assemble(projectId, sdf) {
    const outputDir = path.join(this.outputPath, projectId);
    const backendDir = path.join(outputDir, 'backend');
    const frontendDir = path.join(outputDir, 'frontend');

    console.log(`Starting assembly for project ${projectId} at ${outputDir}`);

    try {
      // 0. Validate SDF integrity (Fail Fast)
      this._validateSdf(sdf);

      // ==================== BACKEND ====================
      console.log('Generating backend...');
      await this.backendGenerator.scaffold(backendDir, projectId);
      // Pass global module config to generators (e.g., activity log defaults)
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

      if (backendEntities.length) {
        for (const entity of backendEntities) {
          console.log(`  - Entity: ${entity.slug}`);
          // Pass the full schema so the backend generator can enforce cross-entity rules
          // (e.g., reference integrity / delete restrictions).
          await this.backendGenerator.generateEntity(backendDir, entity, backendEntities);
        }
        await this.backendGenerator.generateRoutesIndex(backendDir, backendEntities);
      }

      await this.backendGenerator.generateMainEntry(backendDir);
      await this._applyBackendRuntimeModules(backendDir, sdf, backendEntities);

      // ==================== FRONTEND ====================
      console.log('Generating frontend...');
      await this.frontendGenerator.scaffold(frontendDir, sdf);

      if (normalizedEntities.length) {
        // Generate DynamicForm component (shared)
        await this.frontendGenerator.generateDynamicForm(frontendDir);

        // Generate entity pages
        for (const entity of normalizedEntities) {
          console.log(`  - Page: ${entity.slug}`);
          // Pass the FULL list of entities so the generator can resolve relationships (e.g. category_id -> categories)
          await this.frontendGenerator.generateEntityPage(frontendDir, entity, normalizedEntities, sdf);
        }

        // Generate App with routes
        await this.frontendGenerator.generateApp(frontendDir, normalizedEntities, sdf);

        // Generate Sidebar with links
        await this.frontendGenerator.generateSidebar(frontendDir, normalizedEntities, sdf);
      }

      // ==================== ROOT FILES ====================
      await this._generateRootFiles(outputDir, projectId);

      console.log('Assembly complete.');
      return outputDir;
    } catch (error) {
      console.error('Assembly failed:', error);
      throw error;
    }
  }

  _validateSdf(sdf) {
    if (!sdf || typeof sdf !== 'object') {
      throw new Error('SDF Validation Error: Invalid SDF object.');
    }
    const entities = Array.isArray(sdf.entities) ? sdf.entities : [];
    const { enabledModules, hasErpConfig } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const allEntities = entities.map((ent) => ({
      ...ent,
      module: this._normalizeEntityModule(ent, { hasErpConfig }),
    }));
    const { normalizedEntities } = this._normalizeEntitiesForModules(allEntities, {
      enabledModules,
      hasErpConfig,
    });
    const activeSlugs = new Set(normalizedEntities.map((ent) => ent && ent.slug).filter(Boolean));
    const entitySlugs = new Set();
    const allBySlug = new Map();

    // 1. Check for Duplicate Entities
    allEntities.forEach((ent, index) => {
      if (!ent || typeof ent !== 'object') return;
      if (!ent.slug) throw new Error(`SDF Validation Error: Entity at index ${index} is missing a slug.`);
      
      if (entitySlugs.has(ent.slug)) {
        throw new Error(`SDF Validation Error: Duplicate entity slug detected: '${ent.slug}'.`);
      }
      entitySlugs.add(ent.slug);
      allBySlug.set(ent.slug, ent);
    });

    // 2. Validate Relationships and References
    normalizedEntities.forEach((ent) => {
      const fields = Array.isArray(ent.fields) ? ent.fields : [];
      fields.forEach((field) => {
        if (!field) return;
        
        // Resolve reference target
        // Logic mirrors BackendGenerator._resolveReferenceEntitySlug but simpler for validation
        const explicit = field.reference_entity || field.referenceEntity;
        const name = String(field.name || '');
        const isRefName = name.endsWith('_id') || name.endsWith('_ids');
        
        // If it looks like a reference, we should validate it
        if (field.type === 'reference' || explicit || isRefName) {
            let targetSlug = explicit;
            
            if (!targetSlug) {
                // Infer from name
                const baseName = name.replace(/_ids?$/, '');
                if (entitySlugs.has(baseName)) targetSlug = baseName;
                else if (entitySlugs.has(baseName + 's')) targetSlug = baseName + 's';
                else if (entitySlugs.has(baseName + 'es')) targetSlug = baseName + 'es';
                // Try removing 's' from baseName if it ends with s (e.g. users_id -> users)
                else if (baseName.endsWith('s') && entitySlugs.has(baseName)) targetSlug = baseName;
            }

            // If we found a target, check if it exists in SDF
            // If we didn't find a target but it was explicitly marked as reference, that's an error.
            // If it was just inferred from name (e.g. 'external_id') and not found, we might warn or ignore.
            // For now, strict mode: if explicit or type=reference, it MUST exist.
            if ((field.type === 'reference' || explicit) && !targetSlug) {
                 throw new Error(`SDF Validation Error: Field '${ent.slug}.${field.name}' is a reference but target entity could not be resolved.`);
            }

            if (targetSlug && !entitySlugs.has(targetSlug)) {
                 // Allow referencing system entities that might be added later? 
                 // For now, we only check against user entities + known system ones if added before validation.
                 // But validation happens BEFORE _withSystemEntities.
                 // We should allow standard system entities if we want to be safe, or just fail.
                 // Let's fail for now to catch typos.
                 throw new Error(`SDF Validation Error: Field '${ent.slug}.${field.name}' references non-existent entity '${targetSlug}'.`);
            }

            if (targetSlug) {
              const targetEntity = allBySlug.get(targetSlug);
              const targetModule = this._normalizeEntityModule(targetEntity, { hasErpConfig });
              const sourceModule = this._normalizeEntityModule(ent, { hasErpConfig });
              const targetEnabled = targetModule === 'shared' ? enabledSet.size > 0 : enabledSet.has(targetModule);

              if (!targetEnabled) {
                throw new Error(
                  `SDF Validation Error: Field '${ent.slug}.${field.name}' references entity '${targetSlug}' from disabled module '${targetModule}'.`
                );
              }

              // Enforce module boundary: same module or shared
              if (sourceModule !== targetModule) {
                if (targetModule !== 'shared') {
                  throw new Error(
                    `SDF Validation Error: Field '${ent.slug}.${field.name}' must reference an entity in the same module or marked shared.`
                  );
                }
                if (sourceModule === 'shared') {
                  throw new Error(
                    `SDF Validation Error: Shared entity '${ent.slug}' cannot reference module-specific entity '${targetSlug}'.`
                  );
                }
              }
            }
        }
      });

      // 3. Validate Children Configuration
      if (Array.isArray(ent.children)) {
        ent.children.forEach((childConfig) => {
            const childSlug = childConfig.entity || childConfig.slug;
            if (!childSlug) return;
            if (!entitySlugs.has(childSlug)) {
                throw new Error(`SDF Validation Error: Entity '${ent.slug}' defines a child relation to non-existent entity '${childSlug}'.`);
            }
            if (!activeSlugs.has(childSlug)) {
                throw new Error(
                  `SDF Validation Error: Entity '${ent.slug}' defines a child relation to '${childSlug}', which is not in an enabled module.`
                );
            }
            // Check FK existence in child
            const foreignKey = childConfig.foreign_key || childConfig.foreignKey;
            const childEntity = allEntities.find(e => e.slug === childSlug);
            const childFields = Array.isArray(childEntity.fields) ? childEntity.fields : [];
            const hasFk = childFields.some(f => f.name === foreignKey);
            
            if (foreignKey && !hasFk) {
                 throw new Error(`SDF Validation Error: Child entity '${childSlug}' does not have the specified foreign key field '${foreignKey}' required by parent '${ent.slug}'.`);
            }

            const childModule = this._normalizeEntityModule(childEntity, { hasErpConfig });
            const sourceModule = this._normalizeEntityModule(ent, { hasErpConfig });
            if (sourceModule !== childModule) {
              if (childModule !== 'shared') {
                throw new Error(
                  `SDF Validation Error: Child entity '${childSlug}' must be in the same module or marked shared.`
                );
              }
              if (sourceModule === 'shared') {
                throw new Error(
                  `SDF Validation Error: Shared entity '${ent.slug}' cannot reference module-specific child '${childSlug}'.`
                );
              }
            }
        });
      }
    });
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

  async _generateRootFiles(outputDir, projectId) {
    const fs = require('fs').promises;

    // Root docker-compose.yml
    const dockerCompose = `version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    volumes:
      - ./backend/data:/app/data
    environment:
      - PORT=3000

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000/api
    depends_on:
      - backend
`;
    await fs.writeFile(path.join(outputDir, 'docker-compose.yml'), dockerCompose);

    // Root README
    const readme = `# ${projectId}

This ERP was automatically generated by CustomERP.

## Quick Start

### Windows (PowerShell)
\`\`\`powershell
.\\dev.ps1 start
\`\`\`

### Linux/macOS
\`\`\`bash
chmod +x dev.sh
./dev.sh start
\`\`\`

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

## Commands

- \`start\`: Build and start containers
- \`stop\`: Stop containers
- \`logs\`: View live logs
- \`clean\`: Remove containers and volumes
`;
    await fs.writeFile(path.join(outputDir, 'README.md'), readme);

    // Development Scripts
    // NOTE: Kept for backward-compat; templates are loaded via brickRepo.
    const templateEngine = require('./TemplateEngine'); // Require locally if not passed

    try {
      const devShTemplate = await this.brickRepo.getTemplate('dev.sh.template');
      const devPs1Template = await this.brickRepo.getTemplate('dev.ps1.template');

      const devSh = devShTemplate.replace(/\{\{projectId\}\}/g, projectId);
      const devPs1 = devPs1Template.replace(/\{\{projectId\}\}/g, projectId);

      await fs.writeFile(path.join(outputDir, 'dev.sh'), devSh);
      await fs.writeFile(path.join(outputDir, 'dev.ps1'), devPs1);

      // Make shell script executable (on Unix-like systems)
      try {
        await fs.chmod(path.join(outputDir, 'dev.sh'), '755');
      } catch (e) {
        // Ignore on Windows
      }
    } catch (e) {
      console.warn('Warning: Could not generate dev scripts', e);
    }
  }

  _withSystemEntities(userEntities, sdf) {
    const entities = Array.isArray(userEntities) ? [...userEntities] : [];
    const modules = (sdf && sdf.modules) ? sdf.modules : {};

    const wantsActivityLog =
      modules?.activity_log?.enabled === true ||
      entities.some((e) => e && e.features && e.features.audit_trail);

    const wantsScheduledReports = modules?.scheduled_reports?.enabled === true;
    const reportsSlug =
      (modules?.scheduled_reports && (modules.scheduled_reports.target_slug || modules.scheduled_reports.targetSlug)) ||
      '__reports';

    if (wantsActivityLog && !entities.some((e) => e && e.slug === '__audit_logs')) {
      entities.push({
        slug: '__audit_logs',
        display_name: 'Audit Logs',
        display_field: 'at',
        module: 'shared',
        system: { hidden: true },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['at', 'action', 'entity', 'entity_id', 'message'] },
        fields: [
          { name: 'at', type: 'string', label: 'At', required: true },
          { name: 'action', type: 'string', label: 'Action', required: true },
          { name: 'entity', type: 'string', label: 'Entity', required: true },
          { name: 'entity_id', type: 'string', label: 'Entity ID', required: false },
          { name: 'message', type: 'string', label: 'Message', required: false },
          { name: 'meta', type: 'text', label: 'Meta', required: false },
        ],
        features: {},
      });
    }

    if (wantsScheduledReports && !entities.some((e) => e && e.slug === reportsSlug)) {
      entities.push({
        slug: reportsSlug,
        display_name: 'Reports',
        display_field: 'report_date',
        module: 'shared',
        system: { hidden: true },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['report_date', 'report_type'] },
        fields: [
          { name: 'report_date', type: 'string', label: 'Report Date', required: true },
          { name: 'report_type', type: 'string', label: 'Report Type', required: true },
          { name: 'generated_at', type: 'string', label: 'Generated At', required: true },
          { name: 'data', type: 'text', label: 'Data (JSON)', required: false },
        ],
        features: {},
      });
    }

    return entities;
  }

  async _applyBackendRuntimeModules(backendDir, sdf, backendEntities) {
    const fs = require('fs').promises;
    const path = require('path');

    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const scheduled = modules?.scheduled_reports || {};

    // Generate optional runtime config for the backend entrypoint (scheduler, etc.)
    const systemConfig = {
      modules: {
        scheduled_reports: {
          enabled: scheduled.enabled === true,
          cron: scheduled.cron || '0 0 * * *',
          target_slug: scheduled.target_slug || '__reports',
          report_type: scheduled.report_type || 'daily_summary',
          entities: Array.isArray(scheduled.entities) ? scheduled.entities : [],
          low_stock: scheduled.low_stock || scheduled.lowStock || null,
          expiry: scheduled.expiry || null,
          inventory_value:
            scheduled.inventory_value ||
            scheduled.inventoryValue ||
            scheduled.valuation ||
            scheduled.inventory_valuation ||
            null,
          movements:
            scheduled.movements ||
            scheduled.movement_summary ||
            scheduled.movementSummary ||
            null,
          entity_snapshots:
            (Array.isArray(scheduled.entity_snapshots) ? scheduled.entity_snapshots : null) ||
            (Array.isArray(scheduled.entitySnapshots) ? scheduled.entitySnapshots : []) ||
            [],
        },
      },
    };

    const shouldWriteConfig =
      systemConfig.modules.scheduled_reports.enabled === true;

    if (shouldWriteConfig) {
      await fs.writeFile(
        path.join(backendDir, 'src/systemConfig.js'),
        'module.exports = ' + JSON.stringify(systemConfig, null, 2) + ';\n'
      );

      // Ensure dependency exists
      const pkgPath = path.join(backendDir, 'package.json');
      const pkgRaw = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgRaw);
      pkg.dependencies = pkg.dependencies || {};
      if (!pkg.dependencies['node-cron']) {
        pkg.dependencies['node-cron'] = '^3.0.3';
      }
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
    }

    // Silence unused param lint in this file (kept for future modules)
    void backendEntities;
  }
}

module.exports = ProjectAssembler;
