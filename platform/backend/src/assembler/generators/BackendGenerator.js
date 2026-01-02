// platform/backend/src/assembler/generators/BackendGenerator.js
const fs = require('fs').promises;
const path = require('path');
const CodeWeaver = require('../CodeWeaver');
const TemplateEngine = require('../TemplateEngine');

class BackendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
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

  async generateEntity(outputDir, entity) {
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
    await this._generateService(outputDir, entity, context);

    // 3. Generate Route File
    await this._generateEntityRoute(outputDir, entity, context);
  }

  async _generateService(outputDir, entity, context) {
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
      if (features.audit_trail) mixins.push('AuditMixin');
      if (features.multi_location) mixins.push('LocationMixin');

      // De-duplicate while preserving order
      return [...new Set(mixins)];
  }

  async _applyMixin(weaver, mixinName) {
      try {
          // In a real app, this might be dynamic require, but for safety we might map them or ensure path is safe
          // Assuming mixins are in backend-bricks/mixins and accessible via brickRepo or direct require if local
          // Since we are running in the platform, we can require them if they are local files
          // OR we read them as files if they are just text. 
          // Our Task C3 defined them as module.exports objects.
          
          // Let's assume we can require them relative to the brick library path
          // But since we are in the platform execution context, we need to find where they are.
          // For simplicity in this environment, we will read the file content and eval it (risky in prod, ok for generator tool)
          // OR better, we require them by path if we know where brick-library is relative to this file.
          
          // Current path: platform/backend/src/assembler/generators/BackendGenerator.js
          // Brick Lib: ../../../../../brick-library/backend-bricks/mixins/
          
          const mixinPath = path.resolve(__dirname, '../../../../../brick-library/backend-bricks/mixins', `${mixinName}.js`);
          
          // Check if exists
          try {
            await fs.access(mixinPath);
          } catch(e) {
              console.warn(`Mixin ${mixinName} not found at ${mixinPath}`);
              return;
          }

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
              // Primitive injection: find last '}' and insert before it
              // A better way would be a specific hook like // @HOOK: ADDITIONAL_METHODS
              // Let's modify BaseService.js.hbs to have that hook or use a regex replacement
              
              // For now, let's assume we update BaseService to have // @HOOK: ADDITIONAL_METHODS
              // or we blindly insert before last brace.
              
              // Let's check if the template has the specific hook, if not, try regex
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

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

module.exports = BackendGenerator;
