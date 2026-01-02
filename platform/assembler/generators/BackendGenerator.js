// platform/assembler/generators/BackendGenerator.js
const fs = require('fs').promises;
const path = require('path');
const CodeWeaver = require('../CodeWeaver');
const TemplateEngine = require('../TemplateEngine');

class BackendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
    this.modules = {};
  }

  setModules(modules) {
    this.modules = modules && typeof modules === 'object' ? modules : {};
  }

  async scaffold(outputDir, projectId) {
    // 1. Create directory structure
    const dirs = [
      'src/controllers',
      'src/routes',
      'src/services',
      'src/repository',
      'data'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(outputDir, dir), { recursive: true });
    }

    // 2. Generate Base Files (package.json, Dockerfile, etc.)
    await this._generateBaseFiles(outputDir, projectId);

    // 3. Copy Static Helpers
    await this.brickRepo.copyFile(
      'backend-bricks/repository/FlatFileProvider.js',
      path.join(outputDir, 'src/repository/FlatFileProvider.js')
    );
  }

  async _generateBaseFiles(outputDir, projectId) {
    const files = [
      { template: 'package.json.template', dest: 'package.json' },
      { template: 'Dockerfile.template', dest: 'Dockerfile' },
      { template: 'docker-compose.template.yml', dest: 'docker-compose.yml' },
      { template: 'README.template.md', dest: 'README.md' }
    ];

    for (const file of files) {
      const template = await this.brickRepo.getTemplate(file.template);
      const content = TemplateEngine.render(template, { projectId });
      await fs.writeFile(path.join(outputDir, file.dest), content);
    }
  }

  async generateEntity(outputDir, entity, allEntities = []) {
    const context = {
      EntityName: this._capitalize(entity.slug), // e.g., "products" -> "Products"
      entitySlug: entity.slug
    };

    // 1. Generate Controller (Using BaseController template)
    const controllerTemplate = await this.brickRepo.getTemplate('BaseController.js.hbs');
    // Note: We use TemplateEngine here because Controller structure is simpler and mostly static replacements
    // CodeWeaver is primarily for Service logic injection
    const controllerContent = TemplateEngine.render(controllerTemplate, context);
    await fs.writeFile(
      path.join(outputDir, `src/controllers/${context.EntityName}Controller.js`),
      controllerContent
    );

    // 2. Generate Service (The complex part with Mixins)
    await this._generateService(outputDir, entity, context, allEntities);

    // 3. Generate Route File
    await this._generateEntityRoute(outputDir, entity, context);
  }

  async _generateService(outputDir, entity, context, allEntities = []) {
    // Load BaseService template
    const serviceTemplate = await this.brickRepo.getTemplate('BaseService.js.hbs');

    // Initialize CodeWeaver with the template
    const weaver = new CodeWeaver(serviceTemplate);

    // Determine Mixins to apply based on features
    const mixinsToApply = this._resolveMixins(entity);

    // Apply Mixins
    for (const mixinName of mixinsToApply) {
      await this._applyMixin(weaver, mixinName);
    }

    // Inject schema-driven validation and reference integrity rules
    this._injectSchemaValidations(weaver, entity, allEntities);

    // Render placeholders (EntityName, entitySlug) AFTER weaving logic
    let finalContent = weaver.getContent();
    finalContent = TemplateEngine.render(finalContent, context);

    await fs.writeFile(
      path.join(outputDir, `src/services/${context.EntityName}Service.js`),
      finalContent
    );
  }

  _resolveMixins(entity) {
    const features = entity.features || {};
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    // IMPORTANT: Mixins must be optional.
    // We only apply InventoryMixin when the entity actually has inventory-like behavior,
    // otherwise we would accidentally add "quantity" to unrelated entities (e.g., Categories).
    const hasQuantityField = fields.some(f => f && f.name === 'quantity');
    const wantsInventoryBehavior =
      !!hasQuantityField ||
      !!features.inventory ||
      !!features.stock_tracking ||
      !!features.batch_tracking ||
      !!features.serial_tracking ||
      !!features.multi_location;

    const mixins = [];

    if (wantsInventoryBehavior) mixins.push('InventoryMixin');

    if (features.batch_tracking) mixins.push('BatchTrackingMixin');
    if (features.serial_tracking) mixins.push('SerialTrackingMixin');
    // Audit trail:
    // - If entity.features.audit_trail is explicitly set (true/false), respect it.
    // - Otherwise, if modules.activity_log.enabled is true, audit ALL non-system entities by default
    //   (or only the listed entity slugs if modules.activity_log.entities is provided).
    const slug = String(entity && entity.slug ? entity.slug : '');
    const isSystemEntity = slug.startsWith('__') || (entity && entity.system && entity.system.hidden);

    let auditEnabled = false;
    if (!isSystemEntity) {
      const hasAuditFlag = Object.prototype.hasOwnProperty.call(features, 'audit_trail');
      if (hasAuditFlag) {
        auditEnabled = features.audit_trail === true;
      } else {
        const activity = (this.modules && (this.modules.activity_log || this.modules.activityLog)) || {};
        if (activity.enabled === true) {
          const list = Array.isArray(activity.entities) ? activity.entities : [];
          auditEnabled = list.length ? list.includes(slug) : true;
        }
      }
    }

    if (auditEnabled) mixins.push('AuditMixin');
    if (features.multi_location) mixins.push('LocationMixin');

    // De-duplicate while preserving order
    return [...new Set(mixins)];
  }

  async _applyMixin(weaver, mixinName) {
    try {
      // Resolve mixin path from the configured brick library root so this generator
      // does not depend on its own filesystem location.
      const mixinPath = path.join(this.brickRepo.libraryPath, 'backend-bricks', 'mixins', `${mixinName}.js`);

      // Check if exists
      try {
        await fs.access(mixinPath);
      } catch (e) {
        console.warn(`Mixin ${mixinName} not found at ${mixinPath}`);
        return;
      }

      // eslint-disable-next-line global-require, import/no-dynamic-require
      const mixin = require(mixinPath);

      // Apply hooks
      if (mixin.hooks) {
        for (const [hookName, code] of Object.entries(mixin.hooks)) {
          weaver.inject(hookName, code);
        }
      }

      // Apply additional methods
      // CodeWeaver needs a way to append methods to the class.
      // Our BaseService.js.hbs ends with '}' and 'module.exports'
      // We can inject methods before the last '}'
      if (mixin.methods) {
        const content = weaver.getContent();
        if (content.includes('// @HOOK: ADDITIONAL_METHODS')) {
          weaver.inject('ADDITIONAL_METHODS', mixin.methods);
        } else {
          // Fallback: replace last '}' with methods + '}'
          const lastBraceIndex = content.lastIndexOf('}');
          if (lastBraceIndex !== -1) {
            const newContent = content.substring(0, lastBraceIndex) +
              `\n  ${mixin.methods}\n` +
              content.substring(lastBraceIndex);
            weaver.content = newContent; // Direct manipulation as fallback
          }
        }
      }

    } catch (err) {
      console.error(`Failed to apply mixin ${mixinName}:`, err);
    }
  }

  async _generateEntityRoute(outputDir, entity, context) {
    const routeTemplate = `
const express = require('express');
const router = express.Router();
const {{EntityName}}Controller = require('../controllers/{{EntityName}}Controller');

const controller = new {{EntityName}}Controller();

router.get('/', (req, res) => controller.getAll(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.post('/', (req, res) => controller.create(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

module.exports = router;
`;
    const content = TemplateEngine.render(routeTemplate, context);
    await fs.writeFile(
      path.join(outputDir, `src/routes/${entity.slug}Routes.js`),
      content
    );
  }

  async generateRoutesIndex(outputDir, entities) {
    let imports = '';
    let mappings = '';

    entities.forEach(entity => {
      const slug = entity.slug;
      imports += `const ${slug}Router = require('./${slug}Routes');\n`;
      mappings += `router.use('/${slug}', ${slug}Router);\n`;
    });

    const template = `
const express = require('express');
const router = express.Router();

${imports}

${mappings}

module.exports = router;
`;
    await fs.writeFile(path.join(outputDir, 'src/routes/index.js'), template);
  }

  async generateMainEntry(outputDir) {
    const template = await this.brickRepo.getTemplate('index.js.template');
    await fs.writeFile(path.join(outputDir, 'src/index.js'), template);
  }

  _injectSchemaValidations(weaver, entity, allEntities) {
    const createSnippet = this._buildCreateValidationSnippet(entity, allEntities);
    const updateSnippet = this._buildUpdateValidationSnippet(entity, allEntities);
    const deleteSnippet = this._buildDeleteRestrictionSnippet(entity, allEntities);

    if (createSnippet) weaver.inject('BEFORE_CREATE_VALIDATION', createSnippet);
    if (updateSnippet) weaver.inject('BEFORE_UPDATE_VALIDATION', updateSnippet);
    if (deleteSnippet) weaver.inject('BEFORE_DELETE_VALIDATION', deleteSnippet);
  }

  _buildCreateValidationSnippet(entity, allEntities) {
    const rules = this._getFieldRules(entity, allEntities);
    if (rules.length === 0) return '';

    const uniqueFields = rules.filter((r) => r.unique);
    const referenceFields = rules.filter((r) => r.referenceEntity);

    let code = `
      // Schema-driven validation (generated)
      const fieldErrors = {};
      const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const isMissingNonString = (v) => v === undefined || v === null;
`;

    if (uniqueFields.length) {
      code += `
      const existingItems = await this.repository.findAll(this.slug);
`;
    }

    if (referenceFields.length) {
      code += `
      const __refIdSets = {};
      const getRefIdSet = async (slug) => {
        if (__refIdSets[slug]) return __refIdSets[slug];
        const all = await this.repository.findAll(slug);
        __refIdSets[slug] = new Set(all.map((x) => x.id));
        return __refIdSets[slug];
      };
`;
    }

    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `data['${fieldKey}']`;

      // required
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!Array.isArray(${accessor}) || ${accessor}.length === 0) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else {
          code += `
      if (isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${label} must be at least ${r.minLength} characters';
`;
      }
      if (typeof r.maxLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${label} must be at most ${r.maxLength} characters';
`;
      }
      if (typeof r.pattern === 'string' && r.pattern.length) {
        code += `
      if (!isMissing(${accessor})) {
        try {
          const re = new RegExp('${this._escapeJsString(r.pattern)}');
          if (!re.test(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} is invalid';
        } catch (e) {}
      }
`;
      }

      // numeric rules
      const isNumeric = ['integer', 'decimal', 'number'].includes(r.type);
      if (isNumeric || typeof r.min === 'number' || typeof r.max === 'number') {
        code += `
      if (!isMissing(${accessor})) {
        const num = typeof ${accessor} === 'number' ? ${accessor} : Number(${accessor});
        if (Number.isNaN(num)) {
          fieldErrors['${fieldKey}'] = '${label} must be a number';
        } else {
`;
        if (r.type === 'integer') {
          code += `
          if (!Number.isInteger(num)) fieldErrors['${fieldKey}'] = '${label} must be an integer';
`;
        }
        if (typeof r.min === 'number') {
          code += `
          if (num < ${r.min}) fieldErrors['${fieldKey}'] = '${label} must be ≥ ${r.min}';
`;
        }
        if (typeof r.max === 'number') {
          code += `
          if (num > ${r.max}) fieldErrors['${fieldKey}'] = '${label} must be ≤ ${r.max}';
`;
        }
        code += `
        }
      }
`;
      }

      // unique
      if (r.unique) {
        code += `
      if (!isMissing(${accessor}) && existingItems.some((it) => String(it['${fieldKey}']) === String(${accessor}))) {
        fieldErrors['${fieldKey}'] = '${label} must be unique';
      }
`;
      }

      // reference exists
      if (r.referenceEntity) {
        const refSlug = this._escapeJsString(r.referenceEntity);
        if (r.multiple) {
          code += `
      if (!isMissing(${accessor})) {
        if (!Array.isArray(${accessor})) {
          fieldErrors['${fieldKey}'] = '${label} must be a list of IDs';
        } else {
          const ids = await getRefIdSet('${refSlug}');
          const bad = ${accessor}.find((v) => !ids.has(String(v)));
          if (bad !== undefined) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
        }
      }
`;
        } else {
          code += `
      if (!isMissing(${accessor})) {
        const ids = await getRefIdSet('${refSlug}');
        if (!ids.has(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
      }
`;
        }
      }
    }

    code += `
      if (Object.keys(fieldErrors).length) {
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.fieldErrors = fieldErrors;
        throw err;
      }
`;
    return code;
  }

  _buildUpdateValidationSnippet(entity, allEntities) {
    const rules = this._getFieldRules(entity, allEntities);
    if (rules.length === 0) return '';

    const uniqueFields = rules.filter((r) => r.unique);
    const referenceFields = rules.filter((r) => r.referenceEntity);

    let code = `
      // Schema-driven validation (generated)
      const existing = await this.repository.findById(this.slug, id);
      if (!existing) return null;
      const merged = { ...existing, ...data };

      const fieldErrors = {};
      const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const isMissingNonString = (v) => v === undefined || v === null;
`;

    if (uniqueFields.length) {
      code += `
      const existingItems = await this.repository.findAll(this.slug);
`;
    }

    if (referenceFields.length) {
      code += `
      const __refIdSets = {};
      const getRefIdSet = async (slug) => {
        if (__refIdSets[slug]) return __refIdSets[slug];
        const all = await this.repository.findAll(slug);
        __refIdSets[slug] = new Set(all.map((x) => x.id));
        return __refIdSets[slug];
      };
`;
    }

    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `merged['${fieldKey}']`;

      // required
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!Array.isArray(${accessor}) || ${accessor}.length === 0) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else {
          code += `
      if (isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${label} must be at least ${r.minLength} characters';
`;
      }
      if (typeof r.maxLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${label} must be at most ${r.maxLength} characters';
`;
      }
      if (typeof r.pattern === 'string' && r.pattern.length) {
        code += `
      if (!isMissing(${accessor})) {
        try {
          const re = new RegExp('${this._escapeJsString(r.pattern)}');
          if (!re.test(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} is invalid';
        } catch (e) {}
      }
`;
      }

      // numeric rules
      const isNumeric = ['integer', 'decimal', 'number'].includes(r.type);
      if (isNumeric || typeof r.min === 'number' || typeof r.max === 'number') {
        code += `
      if (!isMissing(${accessor})) {
        const num = typeof ${accessor} === 'number' ? ${accessor} : Number(${accessor});
        if (Number.isNaN(num)) {
          fieldErrors['${fieldKey}'] = '${label} must be a number';
        } else {
`;
        if (r.type === 'integer') {
          code += `
          if (!Number.isInteger(num)) fieldErrors['${fieldKey}'] = '${label} must be an integer';
`;
        }
        if (typeof r.min === 'number') {
          code += `
          if (num < ${r.min}) fieldErrors['${fieldKey}'] = '${label} must be ≥ ${r.min}';
`;
        }
        if (typeof r.max === 'number') {
          code += `
          if (num > ${r.max}) fieldErrors['${fieldKey}'] = '${label} must be ≤ ${r.max}';
`;
        }
        code += `
        }
      }
`;
      }

      // unique
      if (r.unique) {
        code += `
      if (!isMissing(${accessor}) && existingItems.some((it) => it.id !== id && String(it['${fieldKey}']) === String(${accessor}))) {
        fieldErrors['${fieldKey}'] = '${label} must be unique';
      }
`;
      }

      // reference exists
      if (r.referenceEntity) {
        const refSlug = this._escapeJsString(r.referenceEntity);
        if (r.multiple) {
          code += `
      if (!isMissing(${accessor})) {
        if (!Array.isArray(${accessor})) {
          fieldErrors['${fieldKey}'] = '${label} must be a list of IDs';
        } else {
          const ids = await getRefIdSet('${refSlug}');
          const bad = ${accessor}.find((v) => !ids.has(String(v)));
          if (bad !== undefined) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
        }
      }
`;
        } else {
          code += `
      if (!isMissing(${accessor})) {
        const ids = await getRefIdSet('${refSlug}');
        if (!ids.has(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
      }
`;
        }
      }
    }

    code += `
      if (Object.keys(fieldErrors).length) {
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.fieldErrors = fieldErrors;
        throw err;
      }
`;
    return code;
  }

  _buildDeleteRestrictionSnippet(entity, allEntities) {
    const dependentsByEntity = new Map();

    for (const other of allEntities) {
      if (!other || other.slug === entity.slug) continue;
      const otherFields = Array.isArray(other.fields) ? other.fields : [];

      const referencingFields = otherFields
        .map((f) => {
          const ref = this._resolveReferenceEntitySlug(f, allEntities);
          if (ref !== entity.slug) return null;
          return {
            name: f.name,
            multiple: this._isFieldMultiple(f),
          };
        })
        .filter(Boolean);

      if (referencingFields.length) {
        dependentsByEntity.set(other.slug, { entity: other, fields: referencingFields });
      }
    }

    if (dependentsByEntity.size === 0) return '';

    let code = `
      // Delete protection (generated): prevent deleting a record that is referenced by others
      const dependents = [];
`;

    for (const [otherSlug, info] of dependentsByEntity.entries()) {
      const otherEntity = info.entity;
      const displayField = this._guessDisplayField(otherEntity);
      const displayFieldEsc = this._escapeJsString(displayField);

      // Build per-row match condition across all referencing fields
      const checks = info.fields.map((f) => {
        const key = this._escapeJsString(f.name);
        if (f.multiple) {
          return `(Array.isArray(row['${key}']) && row['${key}'].some((v) => String(v) === String(id)))`;
        }
        return `String(row['${key}'] ?? '') === String(id)`;
      });
      const matchExpr = checks.join(' || ') || 'false';

      const viaFields = info.fields.map((f) => `'${this._escapeJsString(f.name)}'`).join(', ');

      code += `
      {
        const rows = await this.repository.findAll('${this._escapeJsString(otherSlug)}');
        const matches = rows.filter((row) => ${matchExpr});
        if (matches.length) {
          dependents.push({
            entity: '${this._escapeJsString(otherSlug)}',
            via: [${viaFields}],
            count: matches.length,
            preview: matches.slice(0, 10).map((r) => ({ id: r.id, display: r['${displayFieldEsc}'] || r.id })),
          });
        }
      }
`;
    }

    code += `
      if (dependents.length) {
        const err = new Error('Cannot delete: this record is referenced by other records');
        err.statusCode = 409;
        err.dependents = dependents;
        throw err;
      }
`;

    return code;
  }

  _getFieldRules(entity, allEntities) {
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    return fields
      .filter((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name))
      .map((f) => {
        const type = String(f.type || 'string');
        const label = f.label ? String(f.label) : this._formatLabel(f.name);
        const rule = {
          name: f.name,
          type,
          label,
          required: !!f.required,
          unique: !!f.unique,
          minLength: typeof f.min_length === 'number' ? f.min_length : (typeof f.minLength === 'number' ? f.minLength : undefined),
          maxLength: typeof f.max_length === 'number' ? f.max_length : (typeof f.maxLength === 'number' ? f.maxLength : undefined),
          min: typeof f.min === 'number' ? f.min : (typeof f.min_value === 'number' ? f.min_value : (typeof f.minValue === 'number' ? f.minValue : undefined)),
          max: typeof f.max === 'number' ? f.max : (typeof f.max_value === 'number' ? f.max_value : (typeof f.maxValue === 'number' ? f.maxValue : undefined)),
          pattern: typeof f.pattern === 'string' ? f.pattern : (typeof f.regex === 'string' ? f.regex : undefined),
          referenceEntity: this._resolveReferenceEntitySlug(f, allEntities),
          multiple: this._isFieldMultiple(f),
        };

        // If the field isn't a reference, clear referenceEntity so we don't accidentally validate it.
        const isReferenceish = type === 'reference' || f.name.endsWith('_id') || f.name.endsWith('_ids') || !!(f.reference_entity || f.referenceEntity);
        if (!isReferenceish) {
          rule.referenceEntity = null;
          rule.multiple = false;
        }

        return rule;
      });
  }

  _isFieldMultiple(field) {
    return field && (field.multiple === true || field.is_array === true || String(field.name || '').endsWith('_ids'));
  }

  _resolveReferenceEntitySlug(field, allEntities) {
    if (!field) return null;

    const explicit = field.reference_entity || field.referenceEntity;
    const name = String(field.name || '');
    const inferredBase = name.replace(/_ids?$/, '');
    const baseName = String(explicit || inferredBase);

    if (!baseName) return null;

    const entities = Array.isArray(allEntities) ? allEntities : [];
    const target = entities.find((e) =>
      e.slug === baseName ||
      e.slug === baseName + 's' ||
      e.slug === baseName + 'es' ||
      (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
      e.slug.startsWith(baseName)
    );

    return target ? target.slug : (explicit ? String(explicit) : null);
  }

  _guessDisplayField(entity) {
    if (!entity) return 'id';
    if (entity.display_field) return String(entity.display_field);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    if (fields.some((f) => f && f.name === 'name')) return 'name';
    if (fields.some((f) => f && f.name === 'sku')) return 'sku';
    const first = fields.find((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name));
    return first ? String(first.name) : 'id';
  }

  _escapeJsString(str) {
    // Escape a string for safe inclusion inside single-quoted JS string literals.
    // Important for generated code (regex patterns can include `$`/backslashes/newlines/etc).
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/'/g, "\\'");
  }

  _formatLabel(str) {
    return String(str).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = BackendGenerator;


