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

  async assemble(projectId, sdf, options = {}) {
    const standalone = !!options.standalone;
    const outputDir = path.join(this.outputPath, projectId);
    const backendDir = standalone ? path.join(outputDir, 'app') : path.join(outputDir, 'backend');
    const frontendDir = path.join(outputDir, 'frontend');

    console.log(`Starting assembly for project ${projectId} at ${outputDir} (standalone=${standalone})`);

    try {
      this._validateSdf(sdf);

      console.log('Generating backend...');
      if (standalone && typeof this.frontendGenerator.setStandalone === 'function') {
        this.frontendGenerator.setStandalone(true);
      }
      await this.backendGenerator.scaffold(backendDir, projectId, { standalone });
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

      await this.backendGenerator.generateDatabaseArtifacts(backendDir, backendEntities);

      await this.backendGenerator.generateMainEntry(backendDir);
      await this._applyBackendRuntimeModules(backendDir, sdf, backendEntities);

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

  _validateSdf(sdf) {
    if (!sdf || typeof sdf !== 'object') {
      throw new Error('SDF Validation Error: Invalid SDF object.');
    }
    const userEntities = Array.isArray(sdf.entities) ? sdf.entities : [];
    // Validation runs against the same effective entity graph used by generation,
    // including auto-added system/runtime entities for enabled capability packs.
    const entities = this._withSystemEntities(userEntities, sdf);
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

    const requireEntity = (slug, label) => {
      if (!entitySlugs.has(slug)) {
        throw new Error(`SDF Validation Error: Required entity '${slug}' is missing${label ? ` (${label})` : ''}.`);
      }
      return allBySlug.get(slug);
    };

    const ensureFields = (entity, required, label) => {
      const fields = Array.isArray(entity?.fields) ? entity.fields : [];
      const fieldNames = new Set(fields.map((f) => f && f.name).filter(Boolean));
      const missing = required.filter((name) => !fieldNames.has(name));
      if (missing.length) {
        throw new Error(
          `SDF Validation Error: Entity '${label}' is missing required fields: ${missing.join(', ')}.`
        );
      }
    };

    const invoiceEnabled = enabledSet.has('invoice');
    if (invoiceEnabled) {
      const invoiceCfg = this._getInvoicePriorityAConfig(sdf);
      const invoicesEntity = requireEntity(invoiceCfg.invoiceEntity, 'invoice header');
      const customersEntity = requireEntity(invoiceCfg.customerEntity, 'customer list');

      const invoicesModule = this._normalizeEntityModule(invoicesEntity, { hasErpConfig });
      const customersModule = this._normalizeEntityModule(customersEntity, { hasErpConfig });

      if (invoicesModule !== 'invoice') {
        throw new Error(`SDF Validation Error: Entity '${invoiceCfg.invoiceEntity}' must be in module 'invoice'.`);
      }
      if (customersModule !== 'shared' && customersModule !== 'invoice') {
        throw new Error(`SDF Validation Error: Entity '${invoiceCfg.customerEntity}' must be 'shared' or in module 'invoice'.`);
      }

      ensureFields(
        invoicesEntity,
        [
          invoiceCfg.invoice_number_field,
          invoiceCfg.customer_field,
          'issue_date',
          'due_date',
          invoiceCfg.status_field,
          invoiceCfg.subtotal_field,
          invoiceCfg.tax_total_field,
          invoiceCfg.grand_total_field,
        ],
        invoiceCfg.invoiceEntity
      );

      const itemsEntity = allBySlug.get(invoiceCfg.itemEntity);
      if (itemsEntity) {
        const itemsModule = this._normalizeEntityModule(itemsEntity, { hasErpConfig });
        if (itemsModule !== 'invoice') {
          throw new Error(`SDF Validation Error: Entity '${invoiceCfg.itemEntity}' must be in module 'invoice'.`);
        }

        const children = Array.isArray(invoicesEntity.children) ? invoicesEntity.children : [];
        const invoiceChild = children.find((child) => {
          const slug = child && (child.entity || child.slug);
          return slug === invoiceCfg.itemEntity;
        });
        if (invoiceChild) {
          const invoiceFk = invoiceChild.foreign_key || invoiceChild.foreignKey;
          if (!invoiceFk) {
            throw new Error(`SDF Validation Error: Child relation for '${invoiceCfg.itemEntity}' must define a foreign key.`);
          }
          const itemFields = Array.isArray(itemsEntity.fields) ? itemsEntity.fields : [];
          const hasInvoiceFk = itemFields.some((f) => f && f.name === invoiceFk);
          if (!hasInvoiceFk) {
            throw new Error(
              `SDF Validation Error: Entity '${invoiceCfg.itemEntity}' must include foreign key field '${invoiceFk}'.`
            );
          }
        }

        ensureFields(
          itemsEntity,
          [
            invoiceCfg.item_invoice_field,
            'description',
            invoiceCfg.item_quantity_field,
            invoiceCfg.item_unit_price_field,
            invoiceCfg.item_line_total_field,
          ],
          invoiceCfg.itemEntity
        );
      }
    }

    const hrEnabled = enabledSet.has('hr');
    if (hrEnabled) {
      const hrCfg = this._getHRPriorityAConfig(sdf);
      const employeeEntitySlug = hrCfg.employeeEntity || 'employees';
      const departmentEntitySlug = hrCfg.departmentEntity || 'departments';
      const leaveEntitySlug = hrCfg.leaveEntity || 'leaves';

      const employeesEntity = requireEntity(employeeEntitySlug, 'employee list');
      const employeesModule = this._normalizeEntityModule(employeesEntity, { hasErpConfig });

      if (employeesModule !== 'hr' && employeesModule !== 'shared') {
        throw new Error(
          `SDF Validation Error: Entity '${employeeEntitySlug}' must be in module 'hr' or 'shared'.`
        );
      }

      const departmentsEntity = allBySlug.get(departmentEntitySlug);
      if (departmentsEntity) {
        const departmentsModule = this._normalizeEntityModule(departmentsEntity, { hasErpConfig });
        if (departmentsModule !== 'hr') {
          throw new Error(`SDF Validation Error: Entity '${departmentEntitySlug}' must be in module 'hr'.`);
        }
      }

      const leaveEntities = [leaveEntitySlug, 'leaves', 'leave_requests']
        .filter((slug, idx, arr) => arr.indexOf(slug) === idx)
        .map((slug) => allBySlug.get(slug))
        .filter(Boolean);
      leaveEntities.forEach((leaveEntity) => {
        const leavesModule = this._normalizeEntityModule(leaveEntity, { hasErpConfig });
        if (leavesModule !== 'hr') {
          throw new Error(`SDF Validation Error: Entity '${leaveEntity.slug}' must be in module 'hr'.`);
        }
      });
    }

    this._validateInventoryPriorityAConfig({
      sdf,
      enabledSet,
      hasErpConfig,
      allBySlug,
      requireEntity,
      ensureFields,
    });
    this._validateInvoicePriorityAConfig({
      sdf,
      enabledSet,
      hasErpConfig,
      allBySlug,
      requireEntity,
      ensureFields,
    });
    this._validateHRPriorityAConfig({
      sdf,
      enabledSet,
      hasErpConfig,
      allBySlug,
      requireEntity,
      ensureFields,
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

  _validateInventoryPriorityAConfig({
    sdf,
    enabledSet,
    hasErpConfig,
    allBySlug,
    requireEntity,
    ensureFields,
  }) {
    const cfg = this._getInventoryPriorityAConfig(sdf);
    const packsEnabled =
      this._isPackEnabled(cfg.reservations) ||
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.inbound) ||
      this._isPackEnabled(cfg.cycleCounting);

    if (!packsEnabled) return;

    const inventoryEnabled = enabledSet.has('inventory');
    if (!inventoryEnabled) {
      throw new Error(
        'SDF Validation Error: Inventory Priority A capability packs require module \'inventory\' to be enabled.'
      );
    }

    const stockEntity = requireEntity(cfg.stockEntity, 'inventory stock');
    const stockModule = this._normalizeEntityModule(stockEntity, { hasErpConfig });
    if (stockModule !== 'inventory' && stockModule !== 'shared') {
      throw new Error(
        `SDF Validation Error: Inventory stock entity '${cfg.stockEntity}' must be in module 'inventory' or 'shared'.`
      );
    }

    if (this._isPackEnabled(cfg.reservations) || this._isPackEnabled(cfg.transactions)) {
      const qtyField = this._pickFirstString(
        cfg.transactions.quantity_field,
        cfg.transactions.quantityField,
        cfg.reservations.quantity_field,
        cfg.reservations.quantityField,
        'quantity'
      );
      const reservedField = this._pickFirstString(
        cfg.reservations.reserved_field,
        cfg.reservations.reservedField,
        'reserved_quantity'
      );
      const committedField = this._pickFirstString(
        cfg.reservations.committed_field,
        cfg.reservations.committedField,
        'committed_quantity'
      );
      const availableField = this._pickFirstString(
        cfg.reservations.available_field,
        cfg.reservations.availableField,
        'available_quantity'
      );
      ensureFields(stockEntity, [qtyField, reservedField, committedField, availableField], cfg.stockEntity);
    }

    if (this._isPackEnabled(cfg.reservations)) {
      const reservationEntity = requireEntity(cfg.reservationEntity, 'inventory reservation workflow');
      const reservationModule = this._normalizeEntityModule(reservationEntity, { hasErpConfig });
      if (reservationModule !== 'inventory') {
        throw new Error(
          `SDF Validation Error: Reservation entity '${cfg.reservationEntity}' must be in module 'inventory'.`
        );
      }
      ensureFields(
        reservationEntity,
        [
          cfg.reservations.item_field,
          cfg.reservations.quantity_field,
          cfg.reservations.status_field,
        ],
        cfg.reservationEntity
      );
    }

    if (this._isPackEnabled(cfg.inbound)) {
      const poEntity = requireEntity(cfg.inbound.purchase_order_entity, 'purchase order header');
      const poItemEntity = requireEntity(cfg.inbound.purchase_order_item_entity, 'purchase order lines');
      const grnEntity = requireEntity(cfg.inbound.grn_entity, 'goods receipt');
      const grnItemEntity = requireEntity(cfg.inbound.grn_item_entity, 'goods receipt lines');

      [poEntity, poItemEntity, grnEntity, grnItemEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'inventory') {
          throw new Error(
            `SDF Validation Error: Inbound workflow entity '${entity.slug}' must be in module 'inventory'.`
          );
        }
      });

      ensureFields(
        poItemEntity,
        [
          cfg.inbound.po_item_parent_field,
          cfg.inbound.po_item_item_field,
          cfg.inbound.po_item_ordered_field,
          cfg.inbound.po_item_received_field,
        ],
        cfg.inbound.purchase_order_item_entity
      );
      ensureFields(
        grnItemEntity,
        [
          cfg.inbound.grn_item_parent_field,
          cfg.inbound.grn_item_po_item_field,
          cfg.inbound.grn_item_item_field,
          cfg.inbound.grn_item_received_field,
        ],
        cfg.inbound.grn_item_entity
      );
    }

    if (this._isPackEnabled(cfg.cycleCounting)) {
      const sessionEntity = requireEntity(cfg.cycleCounting.session_entity, 'cycle count session');
      const lineEntity = requireEntity(cfg.cycleCounting.line_entity, 'cycle count lines');

      [sessionEntity, lineEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'inventory') {
          throw new Error(
            `SDF Validation Error: Cycle counting entity '${entity.slug}' must be in module 'inventory'.`
          );
        }
      });

      ensureFields(
        lineEntity,
        [
          cfg.cycleCounting.line_session_field,
          cfg.cycleCounting.line_item_field,
          cfg.cycleCounting.line_expected_field,
          cfg.cycleCounting.line_counted_field,
          cfg.cycleCounting.line_variance_field,
        ],
        cfg.cycleCounting.line_entity
      );
    }

    // Keep unused helper warning clean for strict lint configs.
    void allBySlug;
  }

  _validateInvoicePriorityAConfig({
    sdf,
    enabledSet,
    hasErpConfig,
    allBySlug,
    requireEntity,
    ensureFields,
  }) {
    const cfg = this._getInvoicePriorityAConfig(sdf);
    const packsEnabled =
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.payments) ||
      this._isPackEnabled(cfg.notes) ||
      this._isPackEnabled(cfg.lifecycle) ||
      this._isPackEnabled(cfg.calculationEngine);

    if (!packsEnabled) return;

    const invoiceEnabled = enabledSet.has('invoice');
    if (!invoiceEnabled) {
      throw new Error(
        'SDF Validation Error: Invoice Priority A capability packs require module \'invoice\' to be enabled.'
      );
    }

    const invoiceEntity = requireEntity(cfg.invoiceEntity, 'invoice header');
    const invoiceModule = this._normalizeEntityModule(invoiceEntity, { hasErpConfig });
    if (invoiceModule !== 'invoice') {
      throw new Error(
        `SDF Validation Error: Invoice header entity '${cfg.invoiceEntity}' must be in module 'invoice'.`
      );
    }

    ensureFields(
      invoiceEntity,
      [
        cfg.customer_field,
        cfg.status_field,
        cfg.subtotal_field,
        cfg.tax_total_field,
        cfg.grand_total_field,
        cfg.outstanding_field,
      ],
      cfg.invoiceEntity
    );

    if (this._isPackEnabled(cfg.transactions)) {
      ensureFields(
        invoiceEntity,
        [cfg.invoice_number_field, cfg.idempotency_field],
        cfg.invoiceEntity
      );
    }

    if (this._isPackEnabled(cfg.lifecycle)) {
      ensureFields(invoiceEntity, [cfg.status_field], cfg.invoiceEntity);
    }

    if (this._isPackEnabled(cfg.calculationEngine)) {
      const itemEntity = requireEntity(cfg.itemEntity, 'invoice line items');
      const itemsModule = this._normalizeEntityModule(itemEntity, { hasErpConfig });
      if (itemsModule !== 'invoice') {
        throw new Error(
          `SDF Validation Error: Invoice line entity '${cfg.itemEntity}' must be in module 'invoice'.`
        );
      }
      ensureFields(
        itemEntity,
        [
          cfg.item_invoice_field,
          cfg.item_quantity_field,
          cfg.item_unit_price_field,
          cfg.item_line_subtotal_field,
          cfg.item_discount_value_field,
          cfg.item_discount_total_field,
          cfg.item_tax_rate_field,
          cfg.item_tax_total_field,
          cfg.item_additional_charge_field,
          cfg.item_line_total_field,
        ],
        cfg.itemEntity
      );
    }

    if (this._isPackEnabled(cfg.payments)) {
      const paymentEntity = requireEntity(cfg.payments.payment_entity, 'invoice payment header');
      const allocationEntity = requireEntity(cfg.payments.allocation_entity, 'invoice payment allocation');
      [paymentEntity, allocationEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'invoice') {
          throw new Error(
            `SDF Validation Error: Invoice payment workflow entity '${entity.slug}' must be in module 'invoice'.`
          );
        }
      });
      ensureFields(
        paymentEntity,
        [
          cfg.payments.payment_number_field,
          cfg.payments.amount_field,
          cfg.payments.unallocated_field,
          cfg.payments.status_field,
        ],
        cfg.payments.payment_entity
      );
      ensureFields(
        allocationEntity,
        [
          cfg.payments.allocation_payment_field,
          cfg.payments.allocation_invoice_field,
          cfg.payments.allocation_amount_field,
        ],
        cfg.payments.allocation_entity
      );
    }

    if (this._isPackEnabled(cfg.notes)) {
      const noteEntity = requireEntity(cfg.notes.note_entity, 'invoice adjustment notes');
      const noteModule = this._normalizeEntityModule(noteEntity, { hasErpConfig });
      if (noteModule !== 'invoice') {
        throw new Error(
          `SDF Validation Error: Invoice note entity '${cfg.notes.note_entity}' must be in module 'invoice'.`
        );
      }
      ensureFields(
        noteEntity,
        [
          cfg.notes.note_number_field,
          cfg.notes.note_invoice_field,
          cfg.notes.note_type_field,
          cfg.notes.note_status_field,
          cfg.notes.note_amount_field,
        ],
        cfg.notes.note_entity
      );
    }

    // Keep unused helper warning clean for strict lint configs.
    void allBySlug;
  }

  _validateHRPriorityAConfig({
    sdf,
    enabledSet,
    hasErpConfig,
    allBySlug,
    requireEntity,
    ensureFields,
  }) {
    const cfg = this._getHRPriorityAConfig(sdf);
    const packsEnabled =
      this._isPackEnabled(cfg.leaveEngine) ||
      this._isPackEnabled(cfg.leaveApprovals) ||
      this._isPackEnabled(cfg.attendanceTime) ||
      this._isPackEnabled(cfg.compensationLedger);

    if (!packsEnabled) return;

    if (!enabledSet.has('hr')) {
      throw new Error(
        'SDF Validation Error: HR Priority A capability packs require module \'hr\' to be enabled.'
      );
    }

    const employeeEntity = requireEntity(cfg.employeeEntity, 'hr employee master');
    const employeeModule = this._normalizeEntityModule(employeeEntity, { hasErpConfig });
    if (employeeModule !== 'hr' && employeeModule !== 'shared') {
      throw new Error(
        `SDF Validation Error: HR employee entity '${cfg.employeeEntity}' must be in module 'hr' or 'shared'.`
      );
    }

    if (this._isPackEnabled(cfg.leaveEngine) || this._isPackEnabled(cfg.leaveApprovals)) {
      const leaveEntity = requireEntity(cfg.leaveEntity, 'hr leave requests');
      const leaveModule = this._normalizeEntityModule(leaveEntity, { hasErpConfig });
      if (leaveModule !== 'hr') {
        throw new Error(
          `SDF Validation Error: HR leave entity '${cfg.leaveEntity}' must be in module 'hr'.`
        );
      }
      ensureFields(
        leaveEntity,
        [
          cfg.leaveEngine.employee_field,
          cfg.leaveEngine.leave_type_field,
          cfg.leaveEngine.start_date_field,
          cfg.leaveEngine.end_date_field,
          cfg.leaveEngine.status_field,
        ],
        cfg.leaveEntity
      );
    }

    if (this._isPackEnabled(cfg.leaveEngine)) {
      const balanceEntity = requireEntity(cfg.leaveEngine.balance_entity, 'hr leave balances');
      const balanceModule = this._normalizeEntityModule(balanceEntity, { hasErpConfig });
      if (balanceModule !== 'hr') {
        throw new Error(
          `SDF Validation Error: HR leave balance entity '${cfg.leaveEngine.balance_entity}' must be in module 'hr'.`
        );
      }
      ensureFields(
        balanceEntity,
        [
          cfg.leaveEngine.employee_field,
          cfg.leaveEngine.leave_type_field,
          cfg.leaveEngine.entitlement_field,
          cfg.leaveEngine.accrued_field,
          cfg.leaveEngine.consumed_field,
          cfg.leaveEngine.carry_forward_field,
          cfg.leaveEngine.available_field,
          cfg.leaveEngine.fiscal_year_field,
        ],
        cfg.leaveEngine.balance_entity
      );
    }

    if (this._isPackEnabled(cfg.leaveApprovals)) {
      const leaveEntity = requireEntity(cfg.leaveEntity, 'hr leave approvals');
      ensureFields(
        leaveEntity,
        [
          cfg.leaveApprovals.status_field,
          cfg.leaveApprovals.approver_field,
          cfg.leaveApprovals.approved_at_field,
          cfg.leaveApprovals.rejected_at_field,
        ],
        cfg.leaveEntity
      );
    }

    if (this._isPackEnabled(cfg.attendanceTime)) {
      const attendanceEntity = requireEntity(cfg.attendanceTime.attendance_entity, 'hr attendance entries');
      const shiftEntity = requireEntity(cfg.attendanceTime.shift_entity, 'hr shift assignments');
      const timesheetEntity = requireEntity(cfg.attendanceTime.timesheet_entity, 'hr timesheets');

      [attendanceEntity, shiftEntity, timesheetEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'hr') {
          throw new Error(
            `SDF Validation Error: HR attendance/time entity '${entity.slug}' must be in module 'hr'.`
          );
        }
      });

      ensureFields(
        attendanceEntity,
        [
          cfg.attendanceTime.attendance_employee_field,
          cfg.attendanceTime.attendance_date_field,
          cfg.attendanceTime.check_in_field,
          cfg.attendanceTime.check_out_field,
          cfg.attendanceTime.worked_hours_field,
          cfg.attendanceTime.attendance_status_field,
        ],
        cfg.attendanceTime.attendance_entity
      );
      ensureFields(
        shiftEntity,
        [
          cfg.attendanceTime.shift_employee_field,
          cfg.attendanceTime.shift_start_field,
          cfg.attendanceTime.shift_end_field,
          cfg.attendanceTime.shift_status_field,
        ],
        cfg.attendanceTime.shift_entity
      );
      ensureFields(
        timesheetEntity,
        [
          cfg.attendanceTime.timesheet_employee_field,
          cfg.attendanceTime.timesheet_date_field,
          cfg.attendanceTime.timesheet_hours_field,
          cfg.attendanceTime.timesheet_overtime_field,
          cfg.attendanceTime.timesheet_status_field,
        ],
        cfg.attendanceTime.timesheet_entity
      );
    }

    if (this._isPackEnabled(cfg.compensationLedger)) {
      const ledgerEntity = requireEntity(cfg.compensationLedger.ledger_entity, 'hr compensation ledger');
      const snapshotEntity = requireEntity(cfg.compensationLedger.snapshot_entity, 'hr compensation snapshots');

      [ledgerEntity, snapshotEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'hr') {
          throw new Error(
            `SDF Validation Error: HR compensation entity '${entity.slug}' must be in module 'hr'.`
          );
        }
      });

      ensureFields(
        ledgerEntity,
        [
          cfg.compensationLedger.ledger_employee_field,
          cfg.compensationLedger.ledger_period_field,
          cfg.compensationLedger.ledger_component_field,
          cfg.compensationLedger.ledger_type_field,
          cfg.compensationLedger.ledger_amount_field,
          cfg.compensationLedger.ledger_status_field,
        ],
        cfg.compensationLedger.ledger_entity
      );
      ensureFields(
        snapshotEntity,
        [
          cfg.compensationLedger.snapshot_employee_field,
          cfg.compensationLedger.snapshot_period_field,
          cfg.compensationLedger.snapshot_gross_field,
          cfg.compensationLedger.snapshot_deduction_field,
          cfg.compensationLedger.snapshot_net_field,
          cfg.compensationLedger.snapshot_status_field,
        ],
        cfg.compensationLedger.snapshot_entity
      );
    }

    // Keep unused helper warning clean for strict lint configs.
    void allBySlug;
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

  _getInventoryPriorityAConfig(sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const inventory = (modules.inventory && typeof modules.inventory === 'object') ? modules.inventory : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const reservations = normalizePack(
      inventory.reservations || inventory.reservation,
      {
        reservation_entity: 'stock_reservations',
        item_field: 'item_id',
        quantity_field: 'quantity',
        status_field: 'status',
        reserved_field: 'reserved_quantity',
        committed_field: 'committed_quantity',
        available_field: 'available_quantity',
      }
    );

    const transactions = normalizePack(
      inventory.transactions || inventory.transaction || inventory.stock_transactions || inventory.stockTransactions,
      {
        quantity_field: reservations.quantity_field || 'quantity',
      }
    );

    const inbound = normalizePack(
      inventory.inbound || inventory.receiving,
      {
        purchase_order_entity: 'purchase_orders',
        purchase_order_item_entity: 'purchase_order_items',
        grn_entity: 'goods_receipts',
        grn_item_entity: 'goods_receipt_items',
        po_item_parent_field: 'purchase_order_id',
        po_item_item_field: 'item_id',
        po_item_ordered_field: 'ordered_quantity',
        po_item_received_field: 'received_quantity',
        po_item_status_field: 'status',
        grn_parent_field: 'purchase_order_id',
        grn_item_parent_field: 'goods_receipt_id',
        grn_item_po_item_field: 'purchase_order_item_id',
        grn_item_item_field: 'item_id',
        grn_item_received_field: 'received_quantity',
        grn_item_accepted_field: 'accepted_quantity',
        grn_status_field: 'status',
      }
    );

    const cycleCounting = normalizePack(
      inventory.cycle_counting || inventory.cycleCounting || inventory.cycle_counts || inventory.cycleCounts,
      {
        session_entity: 'cycle_count_sessions',
        line_entity: 'cycle_count_lines',
        line_session_field: 'cycle_count_session_id',
        line_item_field: 'item_id',
        line_expected_field: 'expected_quantity',
        line_counted_field: 'counted_quantity',
        line_variance_field: 'variance_quantity',
        session_status_field: 'status',
      }
    );

    const stockEntity = this._pickFirstString(
      inventory.stock_entity,
      inventory.stockEntity,
      reservations.stock_entity,
      reservations.stockEntity,
      transactions.stock_entity,
      transactions.stockEntity,
      inbound.stock_entity,
      inbound.stockEntity,
      cycleCounting.stock_entity,
      cycleCounting.stockEntity,
      'products'
    );

    reservations.reservation_entity = this._pickFirstString(
      reservations.reservation_entity,
      reservations.reservationEntity,
      'stock_reservations'
    );
    reservations.item_field = this._pickFirstString(
      reservations.item_field,
      reservations.itemField,
      reservations.item_ref_field,
      reservations.itemRefField,
      'item_id'
    );
    reservations.quantity_field = this._pickFirstString(
      reservations.quantity_field,
      reservations.quantityField,
      reservations.reservation_quantity_field,
      reservations.reservationQuantityField,
      'quantity'
    );
    reservations.status_field = this._pickFirstString(
      reservations.status_field,
      reservations.statusField,
      'status'
    );
    reservations.reserved_field = this._pickFirstString(
      reservations.reserved_field,
      reservations.reservedField,
      'reserved_quantity'
    );
    reservations.committed_field = this._pickFirstString(
      reservations.committed_field,
      reservations.committedField,
      'committed_quantity'
    );
    reservations.available_field = this._pickFirstString(
      reservations.available_field,
      reservations.availableField,
      'available_quantity'
    );

    transactions.quantity_field = this._pickFirstString(
      transactions.quantity_field,
      transactions.quantityField,
      reservations.quantity_field,
      'quantity'
    );

    inbound.purchase_order_entity = this._pickFirstString(
      inbound.purchase_order_entity,
      inbound.purchaseOrderEntity,
      'purchase_orders'
    );
    inbound.purchase_order_item_entity = this._pickFirstString(
      inbound.purchase_order_item_entity,
      inbound.purchaseOrderItemEntity,
      'purchase_order_items'
    );
    inbound.grn_entity = this._pickFirstString(
      inbound.grn_entity,
      inbound.grnEntity,
      'goods_receipts'
    );
    inbound.grn_item_entity = this._pickFirstString(
      inbound.grn_item_entity,
      inbound.grnItemEntity,
      'goods_receipt_items'
    );
    inbound.po_item_parent_field = this._pickFirstString(
      inbound.po_item_parent_field,
      inbound.poItemParentField,
      'purchase_order_id'
    );
    inbound.po_item_item_field = this._pickFirstString(
      inbound.po_item_item_field,
      inbound.poItemItemField,
      'item_id'
    );
    inbound.po_item_ordered_field = this._pickFirstString(
      inbound.po_item_ordered_field,
      inbound.poItemOrderedField,
      'ordered_quantity'
    );
    inbound.po_item_received_field = this._pickFirstString(
      inbound.po_item_received_field,
      inbound.poItemReceivedField,
      'received_quantity'
    );
    inbound.po_item_status_field = this._pickFirstString(
      inbound.po_item_status_field,
      inbound.poItemStatusField,
      'status'
    );
    inbound.grn_parent_field = this._pickFirstString(
      inbound.grn_parent_field,
      inbound.grnParentField,
      'purchase_order_id'
    );
    inbound.grn_item_parent_field = this._pickFirstString(
      inbound.grn_item_parent_field,
      inbound.grnItemParentField,
      'goods_receipt_id'
    );
    inbound.grn_item_po_item_field = this._pickFirstString(
      inbound.grn_item_po_item_field,
      inbound.grnItemPoItemField,
      'purchase_order_item_id'
    );
    inbound.grn_item_item_field = this._pickFirstString(
      inbound.grn_item_item_field,
      inbound.grnItemItemField,
      'item_id'
    );
    inbound.grn_item_received_field = this._pickFirstString(
      inbound.grn_item_received_field,
      inbound.grnItemReceivedField,
      'received_quantity'
    );
    inbound.grn_item_accepted_field = this._pickFirstString(
      inbound.grn_item_accepted_field,
      inbound.grnItemAcceptedField,
      'accepted_quantity'
    );
    inbound.grn_status_field = this._pickFirstString(
      inbound.grn_status_field,
      inbound.grnStatusField,
      'status'
    );

    cycleCounting.session_entity = this._pickFirstString(
      cycleCounting.session_entity,
      cycleCounting.sessionEntity,
      'cycle_count_sessions'
    );
    cycleCounting.line_entity = this._pickFirstString(
      cycleCounting.line_entity,
      cycleCounting.lineEntity,
      'cycle_count_lines'
    );
    cycleCounting.line_session_field = this._pickFirstString(
      cycleCounting.line_session_field,
      cycleCounting.lineSessionField,
      'cycle_count_session_id'
    );
    cycleCounting.line_item_field = this._pickFirstString(
      cycleCounting.line_item_field,
      cycleCounting.lineItemField,
      'item_id'
    );
    cycleCounting.line_expected_field = this._pickFirstString(
      cycleCounting.line_expected_field,
      cycleCounting.lineExpectedField,
      'expected_quantity'
    );
    cycleCounting.line_counted_field = this._pickFirstString(
      cycleCounting.line_counted_field,
      cycleCounting.lineCountedField,
      'counted_quantity'
    );
    cycleCounting.line_variance_field = this._pickFirstString(
      cycleCounting.line_variance_field,
      cycleCounting.lineVarianceField,
      'variance_quantity'
    );
    cycleCounting.session_status_field = this._pickFirstString(
      cycleCounting.session_status_field,
      cycleCounting.sessionStatusField,
      'status'
    );

    return {
      stockEntity,
      reservations,
      transactions,
      inbound,
      cycleCounting,
      reservationEntity: reservations.reservation_entity,
    };
  }

  _getInvoicePriorityAConfig(sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const invoice = (modules.invoice && typeof modules.invoice === 'object') ? modules.invoice : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const transactions = normalizePack(
      invoice.transactions || invoice.transaction,
      {
        invoice_entity: 'invoices',
        invoice_item_entity: 'invoice_items',
        invoice_number_field: 'invoice_number',
        idempotency_field: 'idempotency_key',
        posted_at_field: 'posted_at',
      }
    );

    const payments = normalizePack(
      invoice.payments || invoice.payment,
      {
        payment_entity: 'invoice_payments',
        allocation_entity: 'invoice_payment_allocations',
        payment_number_field: 'payment_number',
        payment_customer_field: 'customer_id',
        payment_date_field: 'payment_date',
        payment_method_field: 'payment_method',
        amount_field: 'amount',
        unallocated_field: 'unallocated_amount',
        status_field: 'status',
        allocation_payment_field: 'payment_id',
        allocation_invoice_field: 'invoice_id',
        allocation_amount_field: 'amount',
        allocation_date_field: 'allocated_at',
      }
    );

    const notes = normalizePack(
      invoice.notes || invoice.credit_debit_notes || invoice.creditDebitNotes,
      {
        note_entity: 'invoice_notes',
        note_number_field: 'note_number',
        note_invoice_field: 'source_invoice_id',
        note_type_field: 'note_type',
        note_status_field: 'status',
        note_amount_field: 'amount',
        note_tax_total_field: 'tax_total',
        note_grand_total_field: 'grand_total',
        note_posted_at_field: 'posted_at',
      }
    );

    const lifecycle = normalizePack(
      invoice.lifecycle || invoice.invoice_lifecycle || invoice.invoiceLifecycle,
      {
        status_field: 'status',
        statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
        enforce_transitions: true,
      }
    );

    const calculationEngine = normalizePack(
      invoice.calculation_engine || invoice.calculationEngine || invoice.pricing_engine || invoice.pricingEngine,
      {
        invoice_item_entity: 'invoice_items',
        item_invoice_field: 'invoice_id',
        item_quantity_field: 'quantity',
        item_unit_price_field: 'unit_price',
        item_line_subtotal_field: 'line_subtotal',
        item_discount_type_field: 'line_discount_type',
        item_discount_value_field: 'line_discount_value',
        item_discount_total_field: 'line_discount_total',
        item_tax_rate_field: 'line_tax_rate',
        item_tax_total_field: 'line_tax_total',
        item_additional_charge_field: 'line_additional_charge',
        item_line_total_field: 'line_total',
        subtotal_field: 'subtotal',
        tax_total_field: 'tax_total',
        discount_total_field: 'discount_total',
        additional_charges_field: 'additional_charges_total',
        grand_total_field: 'grand_total',
      }
    );

    const invoiceEntity = this._pickFirstString(
      invoice.invoice_entity,
      invoice.invoiceEntity,
      transactions.invoice_entity,
      transactions.invoiceEntity,
      'invoices'
    );
    const itemEntity = this._pickFirstString(
      invoice.invoice_item_entity,
      invoice.invoiceItemEntity,
      transactions.invoice_item_entity,
      transactions.invoiceItemEntity,
      calculationEngine.invoice_item_entity,
      calculationEngine.invoiceItemEntity,
      'invoice_items'
    );
    const customerEntity = this._pickFirstString(
      invoice.customer_entity,
      invoice.customerEntity,
      'customers'
    );

    const invoice_number_field = this._pickFirstString(
      transactions.invoice_number_field,
      transactions.invoiceNumberField,
      'invoice_number'
    );
    const customer_field = this._pickFirstString(
      invoice.customer_field,
      invoice.customerField,
      'customer_id'
    );
    const status_field = this._pickFirstString(
      lifecycle.status_field,
      lifecycle.statusField,
      'status'
    );
    const subtotal_field = this._pickFirstString(
      calculationEngine.subtotal_field,
      calculationEngine.subtotalField,
      'subtotal'
    );
    const tax_total_field = this._pickFirstString(
      calculationEngine.tax_total_field,
      calculationEngine.taxTotalField,
      'tax_total'
    );
    const discount_total_field = this._pickFirstString(
      calculationEngine.discount_total_field,
      calculationEngine.discountTotalField,
      'discount_total'
    );
    const additional_charges_field = this._pickFirstString(
      calculationEngine.additional_charges_field,
      calculationEngine.additionalChargesField,
      'additional_charges_total'
    );
    const grand_total_field = this._pickFirstString(
      calculationEngine.grand_total_field,
      calculationEngine.grandTotalField,
      'grand_total'
    );
    const paid_total_field = this._pickFirstString(
      invoice.paid_total_field,
      invoice.paidTotalField,
      'paid_total'
    );
    const outstanding_field = this._pickFirstString(
      invoice.outstanding_balance_field,
      invoice.outstandingBalanceField,
      'outstanding_balance'
    );
    const idempotency_field = this._pickFirstString(
      transactions.idempotency_field,
      transactions.idempotencyField,
      'idempotency_key'
    );
    const posted_at_field = this._pickFirstString(
      transactions.posted_at_field,
      transactions.postedAtField,
      'posted_at'
    );
    const cancelled_at_field = this._pickFirstString(
      invoice.cancelled_at_field,
      invoice.cancelledAtField,
      'cancelled_at'
    );

    const item_invoice_field = this._pickFirstString(
      calculationEngine.item_invoice_field,
      calculationEngine.itemInvoiceField,
      'invoice_id'
    );
    const item_quantity_field = this._pickFirstString(
      calculationEngine.item_quantity_field,
      calculationEngine.itemQuantityField,
      'quantity'
    );
    const item_unit_price_field = this._pickFirstString(
      calculationEngine.item_unit_price_field,
      calculationEngine.itemUnitPriceField,
      'unit_price'
    );
    const item_line_subtotal_field = this._pickFirstString(
      calculationEngine.item_line_subtotal_field,
      calculationEngine.itemLineSubtotalField,
      'line_subtotal'
    );
    const item_discount_type_field = this._pickFirstString(
      calculationEngine.item_discount_type_field,
      calculationEngine.itemDiscountTypeField,
      'line_discount_type'
    );
    const item_discount_value_field = this._pickFirstString(
      calculationEngine.item_discount_value_field,
      calculationEngine.itemDiscountValueField,
      'line_discount_value'
    );
    const item_discount_total_field = this._pickFirstString(
      calculationEngine.item_discount_total_field,
      calculationEngine.itemDiscountTotalField,
      'line_discount_total'
    );
    const item_tax_rate_field = this._pickFirstString(
      calculationEngine.item_tax_rate_field,
      calculationEngine.itemTaxRateField,
      'line_tax_rate'
    );
    const item_tax_total_field = this._pickFirstString(
      calculationEngine.item_tax_total_field,
      calculationEngine.itemTaxTotalField,
      'line_tax_total'
    );
    const item_additional_charge_field = this._pickFirstString(
      calculationEngine.item_additional_charge_field,
      calculationEngine.itemAdditionalChargeField,
      'line_additional_charge'
    );
    const item_line_total_field = this._pickFirstString(
      calculationEngine.item_line_total_field,
      calculationEngine.itemLineTotalField,
      'line_total'
    );

    payments.payment_entity = this._pickFirstString(
      payments.payment_entity,
      payments.paymentEntity,
      'invoice_payments'
    );
    payments.allocation_entity = this._pickFirstString(
      payments.allocation_entity,
      payments.allocationEntity,
      'invoice_payment_allocations'
    );
    payments.payment_number_field = this._pickFirstString(
      payments.payment_number_field,
      payments.paymentNumberField,
      'payment_number'
    );
    payments.payment_customer_field = this._pickFirstString(
      payments.payment_customer_field,
      payments.paymentCustomerField,
      customer_field
    );
    payments.payment_date_field = this._pickFirstString(
      payments.payment_date_field,
      payments.paymentDateField,
      'payment_date'
    );
    payments.payment_method_field = this._pickFirstString(
      payments.payment_method_field,
      payments.paymentMethodField,
      'payment_method'
    );
    payments.amount_field = this._pickFirstString(
      payments.amount_field,
      payments.amountField,
      'amount'
    );
    payments.unallocated_field = this._pickFirstString(
      payments.unallocated_field,
      payments.unallocatedField,
      'unallocated_amount'
    );
    payments.status_field = this._pickFirstString(
      payments.status_field,
      payments.statusField,
      'status'
    );
    payments.allocation_payment_field = this._pickFirstString(
      payments.allocation_payment_field,
      payments.allocationPaymentField,
      'payment_id'
    );
    payments.allocation_invoice_field = this._pickFirstString(
      payments.allocation_invoice_field,
      payments.allocationInvoiceField,
      item_invoice_field
    );
    payments.allocation_amount_field = this._pickFirstString(
      payments.allocation_amount_field,
      payments.allocationAmountField,
      'amount'
    );
    payments.allocation_date_field = this._pickFirstString(
      payments.allocation_date_field,
      payments.allocationDateField,
      'allocated_at'
    );

    notes.note_entity = this._pickFirstString(
      notes.note_entity,
      notes.noteEntity,
      'invoice_notes'
    );
    notes.note_number_field = this._pickFirstString(
      notes.note_number_field,
      notes.noteNumberField,
      'note_number'
    );
    notes.note_invoice_field = this._pickFirstString(
      notes.note_invoice_field,
      notes.noteInvoiceField,
      'source_invoice_id'
    );
    notes.note_type_field = this._pickFirstString(
      notes.note_type_field,
      notes.noteTypeField,
      'note_type'
    );
    notes.note_status_field = this._pickFirstString(
      notes.note_status_field,
      notes.noteStatusField,
      'status'
    );
    notes.note_amount_field = this._pickFirstString(
      notes.note_amount_field,
      notes.noteAmountField,
      'amount'
    );
    notes.note_tax_total_field = this._pickFirstString(
      notes.note_tax_total_field,
      notes.noteTaxTotalField,
      'tax_total'
    );
    notes.note_grand_total_field = this._pickFirstString(
      notes.note_grand_total_field,
      notes.noteGrandTotalField,
      'grand_total'
    );
    notes.note_posted_at_field = this._pickFirstString(
      notes.note_posted_at_field,
      notes.notePostedAtField,
      'posted_at'
    );

    lifecycle.status_field = status_field;
    lifecycle.statuses = Array.isArray(lifecycle.statuses) && lifecycle.statuses.length
      ? lifecycle.statuses
      : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
    lifecycle.enforce_transitions =
      lifecycle.enforce_transitions !== false &&
      lifecycle.enforceTransitions !== false;

    return {
      invoiceEntity,
      itemEntity,
      customerEntity,
      invoice_number_field,
      customer_field,
      status_field,
      subtotal_field,
      tax_total_field,
      discount_total_field,
      additional_charges_field,
      grand_total_field,
      paid_total_field,
      outstanding_field,
      idempotency_field,
      posted_at_field,
      cancelled_at_field,
      item_invoice_field,
      item_quantity_field,
      item_unit_price_field,
      item_line_subtotal_field,
      item_discount_type_field,
      item_discount_value_field,
      item_discount_total_field,
      item_tax_rate_field,
      item_tax_total_field,
      item_additional_charge_field,
      item_line_total_field,
      transactions,
      payments,
      notes,
      lifecycle,
      calculationEngine,
    };
  }

  _getHRPriorityAConfig(sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const hr = (modules.hr && typeof modules.hr === 'object') ? modules.hr : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const leaveEngine = normalizePack(
      hr.leave_engine || hr.leaveEngine || hr.leave_policy || hr.leavePolicy,
      {
        leave_entity: 'leaves',
        balance_entity: 'leave_balances',
        employee_field: 'employee_id',
        leave_type_field: 'leave_type',
        start_date_field: 'start_date',
        end_date_field: 'end_date',
        days_field: 'leave_days',
        status_field: 'status',
        entitlement_field: 'annual_entitlement',
        accrued_field: 'accrued_days',
        consumed_field: 'consumed_days',
        carry_forward_field: 'carry_forward_days',
        available_field: 'available_days',
        fiscal_year_field: 'year',
        last_accrual_at_field: 'last_accrual_at',
        default_entitlement: 18,
        auto_create_balance: true,
      }
    );
    const leaveApprovals = normalizePack(
      hr.leave_approvals ||
      hr.leaveApprovals ||
      hr.leave_approval ||
      hr.leaveApproval ||
      hr.approval_workflow ||
      hr.approvalWorkflow,
      {
        leave_entity: 'leaves',
        status_field: 'status',
        approver_field: 'approver_id',
        approved_at_field: 'approved_at',
        rejected_at_field: 'rejected_at',
        cancelled_at_field: 'cancelled_at',
        rejection_reason_field: 'rejection_reason',
        decision_key_field: 'decision_key',
        statuses: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        enforce_transitions: true,
        consume_on_approval: true,
      }
    );
    const attendanceTime = normalizePack(
      hr.attendance_time || hr.attendanceTime || hr.attendance || hr.time_tracking || hr.timeTracking,
      {
        attendance_entity: 'attendance_entries',
        shift_entity: 'shift_assignments',
        timesheet_entity: 'timesheet_entries',
        attendance_employee_field: 'employee_id',
        attendance_date_field: 'work_date',
        check_in_field: 'check_in_at',
        check_out_field: 'check_out_at',
        worked_hours_field: 'worked_hours',
        attendance_status_field: 'status',
        shift_employee_field: 'employee_id',
        shift_start_field: 'start_time',
        shift_end_field: 'end_time',
        shift_days_field: 'work_days',
        shift_status_field: 'status',
        timesheet_employee_field: 'employee_id',
        timesheet_date_field: 'work_date',
        timesheet_hours_field: 'regular_hours',
        timesheet_overtime_field: 'overtime_hours',
        timesheet_status_field: 'status',
        timesheet_attendance_field: 'attendance_id',
      }
    );
    const compensationLedger = normalizePack(
      hr.compensation_ledger || hr.compensationLedger || hr.payroll_ledger || hr.payrollLedger,
      {
        ledger_entity: 'compensation_ledger',
        snapshot_entity: 'compensation_snapshots',
        ledger_employee_field: 'employee_id',
        ledger_period_field: 'pay_period',
        ledger_component_field: 'component',
        ledger_type_field: 'component_type',
        ledger_amount_field: 'amount',
        ledger_status_field: 'status',
        snapshot_employee_field: 'employee_id',
        snapshot_period_field: 'pay_period',
        snapshot_gross_field: 'gross_amount',
        snapshot_deduction_field: 'deduction_amount',
        snapshot_net_field: 'net_amount',
        snapshot_status_field: 'status',
        snapshot_posted_at_field: 'posted_at',
      }
    );

    const employeeEntity = this._pickFirstString(
      hr.employee_entity,
      hr.employeeEntity,
      leaveEngine.employee_entity,
      leaveEngine.employeeEntity,
      attendanceTime.employee_entity,
      attendanceTime.employeeEntity,
      compensationLedger.employee_entity,
      compensationLedger.employeeEntity,
      'employees'
    );
    const departmentEntity = this._pickFirstString(
      hr.department_entity,
      hr.departmentEntity,
      'departments'
    );
    const leaveEntity = this._pickFirstString(
      hr.leave_entity,
      hr.leaveEntity,
      leaveEngine.leave_entity,
      leaveEngine.leaveEntity,
      leaveApprovals.leave_entity,
      leaveApprovals.leaveEntity,
      'leaves'
    );

    leaveEngine.leave_entity = this._pickFirstString(
      leaveEngine.leave_entity,
      leaveEngine.leaveEntity,
      leaveEntity
    );
    leaveEngine.balance_entity = this._pickFirstString(
      leaveEngine.balance_entity,
      leaveEngine.balanceEntity,
      'leave_balances'
    );
    leaveEngine.employee_field = this._pickFirstString(
      leaveEngine.employee_field,
      leaveEngine.employeeField,
      'employee_id'
    );
    leaveEngine.leave_type_field = this._pickFirstString(
      leaveEngine.leave_type_field,
      leaveEngine.leaveTypeField,
      'leave_type'
    );
    leaveEngine.start_date_field = this._pickFirstString(
      leaveEngine.start_date_field,
      leaveEngine.startDateField,
      'start_date'
    );
    leaveEngine.end_date_field = this._pickFirstString(
      leaveEngine.end_date_field,
      leaveEngine.endDateField,
      'end_date'
    );
    leaveEngine.days_field = this._pickFirstString(
      leaveEngine.days_field,
      leaveEngine.daysField,
      'leave_days'
    );
    leaveEngine.status_field = this._pickFirstString(
      leaveEngine.status_field,
      leaveEngine.statusField,
      'status'
    );
    leaveEngine.entitlement_field = this._pickFirstString(
      leaveEngine.entitlement_field,
      leaveEngine.entitlementField,
      'annual_entitlement'
    );
    leaveEngine.accrued_field = this._pickFirstString(
      leaveEngine.accrued_field,
      leaveEngine.accruedField,
      'accrued_days'
    );
    leaveEngine.consumed_field = this._pickFirstString(
      leaveEngine.consumed_field,
      leaveEngine.consumedField,
      'consumed_days'
    );
    leaveEngine.carry_forward_field = this._pickFirstString(
      leaveEngine.carry_forward_field,
      leaveEngine.carryForwardField,
      'carry_forward_days'
    );
    leaveEngine.available_field = this._pickFirstString(
      leaveEngine.available_field,
      leaveEngine.availableField,
      'available_days'
    );
    leaveEngine.fiscal_year_field = this._pickFirstString(
      leaveEngine.fiscal_year_field,
      leaveEngine.fiscalYearField,
      'year'
    );
    leaveEngine.last_accrual_at_field = this._pickFirstString(
      leaveEngine.last_accrual_at_field,
      leaveEngine.lastAccrualAtField,
      'last_accrual_at'
    );
    leaveEngine.default_entitlement = Number(leaveEngine.default_entitlement || leaveEngine.defaultEntitlement || 18);
    if (!Number.isFinite(leaveEngine.default_entitlement) || leaveEngine.default_entitlement < 0) {
      leaveEngine.default_entitlement = 18;
    }
    leaveEngine.auto_create_balance =
      leaveEngine.auto_create_balance !== false &&
      leaveEngine.autoCreateBalance !== false;

    leaveApprovals.leave_entity = this._pickFirstString(
      leaveApprovals.leave_entity,
      leaveApprovals.leaveEntity,
      leaveEntity
    );
    leaveApprovals.status_field = this._pickFirstString(
      leaveApprovals.status_field,
      leaveApprovals.statusField,
      leaveEngine.status_field
    );
    leaveApprovals.approver_field = this._pickFirstString(
      leaveApprovals.approver_field,
      leaveApprovals.approverField,
      'approver_id'
    );
    leaveApprovals.approved_at_field = this._pickFirstString(
      leaveApprovals.approved_at_field,
      leaveApprovals.approvedAtField,
      'approved_at'
    );
    leaveApprovals.rejected_at_field = this._pickFirstString(
      leaveApprovals.rejected_at_field,
      leaveApprovals.rejectedAtField,
      'rejected_at'
    );
    leaveApprovals.cancelled_at_field = this._pickFirstString(
      leaveApprovals.cancelled_at_field,
      leaveApprovals.cancelledAtField,
      'cancelled_at'
    );
    leaveApprovals.rejection_reason_field = this._pickFirstString(
      leaveApprovals.rejection_reason_field,
      leaveApprovals.rejectionReasonField,
      'rejection_reason'
    );
    leaveApprovals.decision_key_field = this._pickFirstString(
      leaveApprovals.decision_key_field,
      leaveApprovals.decisionKeyField,
      'decision_key'
    );
    leaveApprovals.statuses = Array.isArray(leaveApprovals.statuses) && leaveApprovals.statuses.length
      ? leaveApprovals.statuses
      : ['Pending', 'Approved', 'Rejected', 'Cancelled'];
    leaveApprovals.enforce_transitions =
      leaveApprovals.enforce_transitions !== false &&
      leaveApprovals.enforceTransitions !== false;
    leaveApprovals.consume_on_approval =
      leaveApprovals.consume_on_approval !== false &&
      leaveApprovals.consumeOnApproval !== false;

    attendanceTime.attendance_entity = this._pickFirstString(
      attendanceTime.attendance_entity,
      attendanceTime.attendanceEntity,
      'attendance_entries'
    );
    attendanceTime.shift_entity = this._pickFirstString(
      attendanceTime.shift_entity,
      attendanceTime.shiftEntity,
      'shift_assignments'
    );
    attendanceTime.timesheet_entity = this._pickFirstString(
      attendanceTime.timesheet_entity,
      attendanceTime.timesheetEntity,
      'timesheet_entries'
    );
    attendanceTime.attendance_employee_field = this._pickFirstString(
      attendanceTime.attendance_employee_field,
      attendanceTime.attendanceEmployeeField,
      'employee_id'
    );
    attendanceTime.attendance_date_field = this._pickFirstString(
      attendanceTime.attendance_date_field,
      attendanceTime.attendanceDateField,
      'work_date'
    );
    attendanceTime.check_in_field = this._pickFirstString(
      attendanceTime.check_in_field,
      attendanceTime.checkInField,
      'check_in_at'
    );
    attendanceTime.check_out_field = this._pickFirstString(
      attendanceTime.check_out_field,
      attendanceTime.checkOutField,
      'check_out_at'
    );
    attendanceTime.worked_hours_field = this._pickFirstString(
      attendanceTime.worked_hours_field,
      attendanceTime.workedHoursField,
      'worked_hours'
    );
    attendanceTime.attendance_status_field = this._pickFirstString(
      attendanceTime.attendance_status_field,
      attendanceTime.attendanceStatusField,
      'status'
    );
    attendanceTime.shift_employee_field = this._pickFirstString(
      attendanceTime.shift_employee_field,
      attendanceTime.shiftEmployeeField,
      'employee_id'
    );
    attendanceTime.shift_start_field = this._pickFirstString(
      attendanceTime.shift_start_field,
      attendanceTime.shiftStartField,
      'start_time'
    );
    attendanceTime.shift_end_field = this._pickFirstString(
      attendanceTime.shift_end_field,
      attendanceTime.shiftEndField,
      'end_time'
    );
    attendanceTime.shift_days_field = this._pickFirstString(
      attendanceTime.shift_days_field,
      attendanceTime.shiftDaysField,
      'work_days'
    );
    attendanceTime.shift_status_field = this._pickFirstString(
      attendanceTime.shift_status_field,
      attendanceTime.shiftStatusField,
      'status'
    );
    attendanceTime.timesheet_employee_field = this._pickFirstString(
      attendanceTime.timesheet_employee_field,
      attendanceTime.timesheetEmployeeField,
      'employee_id'
    );
    attendanceTime.timesheet_date_field = this._pickFirstString(
      attendanceTime.timesheet_date_field,
      attendanceTime.timesheetDateField,
      'work_date'
    );
    attendanceTime.timesheet_hours_field = this._pickFirstString(
      attendanceTime.timesheet_hours_field,
      attendanceTime.timesheetHoursField,
      'regular_hours'
    );
    attendanceTime.timesheet_overtime_field = this._pickFirstString(
      attendanceTime.timesheet_overtime_field,
      attendanceTime.timesheetOvertimeField,
      'overtime_hours'
    );
    attendanceTime.timesheet_status_field = this._pickFirstString(
      attendanceTime.timesheet_status_field,
      attendanceTime.timesheetStatusField,
      'status'
    );
    attendanceTime.timesheet_attendance_field = this._pickFirstString(
      attendanceTime.timesheet_attendance_field,
      attendanceTime.timesheetAttendanceField,
      'attendance_id'
    );
    attendanceTime.work_days = Array.isArray(attendanceTime.work_days)
      ? attendanceTime.work_days
      : (Array.isArray(attendanceTime.workDays) ? attendanceTime.workDays : null);
    if (!Array.isArray(attendanceTime.work_days) || !attendanceTime.work_days.length) {
      attendanceTime.work_days = Array.isArray(hr.work_days) && hr.work_days.length
        ? hr.work_days
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }
    attendanceTime.daily_hours = Number(attendanceTime.daily_hours || attendanceTime.dailyHours || hr.daily_hours || hr.dailyHours || 8);
    if (!Number.isFinite(attendanceTime.daily_hours) || attendanceTime.daily_hours <= 0) {
      attendanceTime.daily_hours = 8;
    }

    compensationLedger.ledger_entity = this._pickFirstString(
      compensationLedger.ledger_entity,
      compensationLedger.ledgerEntity,
      'compensation_ledger'
    );
    compensationLedger.snapshot_entity = this._pickFirstString(
      compensationLedger.snapshot_entity,
      compensationLedger.snapshotEntity,
      'compensation_snapshots'
    );
    compensationLedger.ledger_employee_field = this._pickFirstString(
      compensationLedger.ledger_employee_field,
      compensationLedger.ledgerEmployeeField,
      'employee_id'
    );
    compensationLedger.ledger_period_field = this._pickFirstString(
      compensationLedger.ledger_period_field,
      compensationLedger.ledgerPeriodField,
      'pay_period'
    );
    compensationLedger.ledger_component_field = this._pickFirstString(
      compensationLedger.ledger_component_field,
      compensationLedger.ledgerComponentField,
      'component'
    );
    compensationLedger.ledger_type_field = this._pickFirstString(
      compensationLedger.ledger_type_field,
      compensationLedger.ledgerTypeField,
      'component_type'
    );
    compensationLedger.ledger_amount_field = this._pickFirstString(
      compensationLedger.ledger_amount_field,
      compensationLedger.ledgerAmountField,
      'amount'
    );
    compensationLedger.ledger_status_field = this._pickFirstString(
      compensationLedger.ledger_status_field,
      compensationLedger.ledgerStatusField,
      'status'
    );
    compensationLedger.snapshot_employee_field = this._pickFirstString(
      compensationLedger.snapshot_employee_field,
      compensationLedger.snapshotEmployeeField,
      'employee_id'
    );
    compensationLedger.snapshot_period_field = this._pickFirstString(
      compensationLedger.snapshot_period_field,
      compensationLedger.snapshotPeriodField,
      'pay_period'
    );
    compensationLedger.snapshot_gross_field = this._pickFirstString(
      compensationLedger.snapshot_gross_field,
      compensationLedger.snapshotGrossField,
      'gross_amount'
    );
    compensationLedger.snapshot_deduction_field = this._pickFirstString(
      compensationLedger.snapshot_deduction_field,
      compensationLedger.snapshotDeductionField,
      'deduction_amount'
    );
    compensationLedger.snapshot_net_field = this._pickFirstString(
      compensationLedger.snapshot_net_field,
      compensationLedger.snapshotNetField,
      'net_amount'
    );
    compensationLedger.snapshot_status_field = this._pickFirstString(
      compensationLedger.snapshot_status_field,
      compensationLedger.snapshotStatusField,
      'status'
    );
    compensationLedger.snapshot_posted_at_field = this._pickFirstString(
      compensationLedger.snapshot_posted_at_field,
      compensationLedger.snapshotPostedAtField,
      'posted_at'
    );

    return {
      employeeEntity,
      departmentEntity,
      leaveEntity,
      leaveEngine,
      leaveApprovals,
      attendanceTime,
      compensationLedger,
    };
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

  async _generateRootFiles(outputDir, projectId, options = {}) {
    const fs = require('fs').promises;
    const standalone = !!options.standalone;

    if (standalone) {
      try {
        const readmeTpl = await this.brickRepo.getTemplate('standalone/README.md');
        await fs.writeFile(path.join(outputDir, 'README.md'), readmeTpl);
      } catch (e) {
        console.warn('Warning: Could not generate standalone README', e);
      }
      return;
    }

    const dockerCompose = `version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=erpdb
      - POSTGRES_USER=erpuser
      - POSTGRES_PASSWORD=erppassword
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      - PORT=3000
      - PGHOST=postgres
      - PGPORT=5432
      - PGDATABASE=erpdb
      - PGUSER=erpuser
      - PGPASSWORD=erppassword
    command: sh -c "npm run migrate && npm start"

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000/api
    depends_on:
      - backend

volumes:
  postgres_data:
`;
    await fs.writeFile(path.join(outputDir, 'docker-compose.yml'), dockerCompose);

    // Root README
    const readme = `# ${projectId}

This ERP was automatically generated by CustomERP.

## Quick Start (Docker, recommended)

### Windows (PowerShell)
\`\`\`powershell
.\\dev.ps1 start
\`\`\`

### Linux/macOS
\`\`\`bash
chmod +x dev.sh
./dev.sh start
\`\`\`

Services:
- PostgreSQL: http://localhost:5432
- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

## Manual Start (without Docker)

1) Backend
\`\`\`bash
cd backend
npm install
npm run migrate
npm start
\`\`\`

2) Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

Backend env vars (example):
\`\`\`env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=erpdb
PGUSER=erpuser
PGPASSWORD=erppassword
\`\`\`

## Commands

- \`start\`: Build and start containers
- \`stop\`: Stop all services
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

    this._withInventoryPriorityAEntities(entities, sdf);
    this._withInvoicePriorityAEntities(entities, sdf);
    this._withHRPriorityAEntities(entities, sdf);

    return entities;
  }

  _withInventoryPriorityAEntities(entities, sdf) {
    const cfg = this._getInventoryPriorityAConfig(sdf);
    const { enabledModules } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const inventoryEnabled = enabledSet.has('inventory');
    const packsEnabled =
      this._isPackEnabled(cfg.reservations) ||
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.inbound) ||
      this._isPackEnabled(cfg.cycleCounting);

    if (!inventoryEnabled || !packsEnabled) return;

    const bySlug = new Map();
    for (const entity of entities) {
      if (!entity || !entity.slug) continue;
      bySlug.set(entity.slug, entity);
    }

    const ensureEntity = (slug, factory) => {
      if (bySlug.has(slug)) {
        const existing = bySlug.get(slug);
        if (!existing.module) existing.module = 'inventory';
        return existing;
      }
      const created = factory();
      entities.push(created);
      bySlug.set(slug, created);
      return created;
    };

    const ensureField = (entity, field) => {
      if (!entity || !field || !field.name) return;
      if (!Array.isArray(entity.fields)) entity.fields = [];
      if (entity.fields.some((f) => f && f.name === field.name)) return;
      entity.fields.push({ ...field });
    };

    const ensureChild = (entity, childCfg) => {
      if (!entity || !childCfg || !childCfg.entity || !childCfg.foreign_key) return;
      if (!Array.isArray(entity.children)) entity.children = [];
      const exists = entity.children.some((c) => {
        const childSlug = c && (c.entity || c.slug);
        const fk = c && (c.foreign_key || c.foreignKey);
        return childSlug === childCfg.entity && fk === childCfg.foreign_key;
      });
      if (!exists) {
        entity.children.push({ ...childCfg });
      }
    };

    const stockSlug = cfg.stockEntity;
    const stockEntity = ensureEntity(stockSlug, () => ({
      slug: stockSlug,
      display_name: this._formatAutoName(stockSlug),
      display_field: 'name',
      module: 'inventory',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['name', 'quantity'] },
      fields: [
        { name: 'name', type: 'string', label: 'Name', required: true },
        { name: 'quantity', type: 'decimal', label: 'Quantity', required: true, min: 0 },
      ],
      features: { inventory: true },
    }));

    const stockQtyField = this._pickFirstString(
      cfg.transactions.quantity_field,
      cfg.transactions.quantityField,
      cfg.reservations.quantity_field,
      cfg.reservations.quantityField,
      'quantity'
    );
    ensureField(stockEntity, { name: stockQtyField, type: 'decimal', label: this._formatAutoName(stockQtyField), required: true, min: 0 });

    if (this._isPackEnabled(cfg.reservations) || this._isPackEnabled(cfg.transactions)) {
      ensureField(stockEntity, {
        name: cfg.reservations.reserved_field,
        type: 'decimal',
        label: this._formatAutoName(cfg.reservations.reserved_field),
        required: true,
        min: 0,
      });
      ensureField(stockEntity, {
        name: cfg.reservations.committed_field,
        type: 'decimal',
        label: this._formatAutoName(cfg.reservations.committed_field),
        required: true,
        min: 0,
      });
      ensureField(stockEntity, {
        name: cfg.reservations.available_field,
        type: 'decimal',
        label: this._formatAutoName(cfg.reservations.available_field),
        required: true,
        min: 0,
      });
    }

    if (this._isPackEnabled(cfg.reservations)) {
      const reservationEntity = ensureEntity(cfg.reservationEntity, () => ({
        slug: cfg.reservationEntity,
        display_name: 'Stock Reservations',
        display_field: 'reservation_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['reservation_number', cfg.reservations.item_field, cfg.reservations.quantity_field, cfg.reservations.status_field] },
        fields: [],
        features: {},
      }));

      ensureField(reservationEntity, {
        name: 'reservation_number',
        type: 'string',
        label: 'Reservation Number',
        required: true,
        unique: true,
      });
      ensureField(reservationEntity, {
        name: cfg.reservations.item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(reservationEntity, {
        name: cfg.reservations.quantity_field,
        type: 'decimal',
        label: 'Quantity',
        required: true,
        min: 0,
      });
      ensureField(reservationEntity, {
        name: cfg.reservations.status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Pending', 'Released', 'Committed', 'Cancelled'],
      });
      ensureField(reservationEntity, { name: 'source_reference', type: 'string', label: 'Source Reference', required: false });
      ensureField(reservationEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(reservationEntity, { name: 'reserved_at', type: 'datetime', label: 'Reserved At', required: false });
      ensureField(reservationEntity, { name: 'released_at', type: 'datetime', label: 'Released At', required: false });
      ensureField(reservationEntity, { name: 'committed_at', type: 'datetime', label: 'Committed At', required: false });
      ensureChild(stockEntity, {
        entity: cfg.reservationEntity,
        foreign_key: cfg.reservations.item_field,
        label: 'Reservations',
        columns: ['reservation_number', cfg.reservations.quantity_field, cfg.reservations.status_field],
      });
    }

    if (this._isPackEnabled(cfg.inbound)) {
      const poEntity = ensureEntity(cfg.inbound.purchase_order_entity, () => ({
        slug: cfg.inbound.purchase_order_entity,
        display_name: 'Purchase Orders',
        display_field: 'po_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['po_number', 'order_date', 'expected_date', 'status'] },
        fields: [],
        features: {},
      }));
      ensureField(poEntity, { name: 'po_number', type: 'string', label: 'PO Number', required: true, unique: true });
      ensureField(poEntity, { name: 'supplier_name', type: 'string', label: 'Supplier', required: false });
      ensureField(poEntity, {
        name: 'status',
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Open', 'Partial', 'Received', 'Cancelled'],
      });
      ensureField(poEntity, { name: 'order_date', type: 'date', label: 'Order Date', required: true });
      ensureField(poEntity, { name: 'expected_date', type: 'date', label: 'Expected Date', required: false });
      ensureField(poEntity, { name: 'allow_over_receipt', type: 'boolean', label: 'Allow Over Receipt', required: false });
      ensureField(poEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      const poItemEntity = ensureEntity(cfg.inbound.purchase_order_item_entity, () => ({
        slug: cfg.inbound.purchase_order_item_entity,
        display_name: 'Purchase Order Items',
        display_field: cfg.inbound.po_item_item_field,
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.inbound.po_item_parent_field,
            cfg.inbound.po_item_item_field,
            cfg.inbound.po_item_ordered_field,
            cfg.inbound.po_item_received_field,
            cfg.inbound.po_item_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_parent_field,
        type: 'reference',
        label: 'Purchase Order',
        required: true,
        reference_entity: cfg.inbound.purchase_order_entity,
      });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_ordered_field,
        type: 'decimal',
        label: 'Ordered Quantity',
        required: true,
        min: 0,
      });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_received_field,
        type: 'decimal',
        label: 'Received Quantity',
        required: true,
        min: 0,
      });
      ensureField(poItemEntity, { name: 'unit_cost', type: 'decimal', label: 'Unit Cost', required: false, min: 0 });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Open', 'Partial', 'Received', 'Cancelled'],
      });

      const grnEntity = ensureEntity(cfg.inbound.grn_entity, () => ({
        slug: cfg.inbound.grn_entity,
        display_name: 'Goods Receipts',
        display_field: 'grn_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['grn_number', cfg.inbound.grn_parent_field, cfg.inbound.grn_status_field, 'received_at'] },
        fields: [],
        features: {},
      }));
      ensureField(grnEntity, { name: 'grn_number', type: 'string', label: 'GRN Number', required: true, unique: true });
      ensureField(grnEntity, {
        name: cfg.inbound.grn_parent_field,
        type: 'reference',
        label: 'Purchase Order',
        required: true,
        reference_entity: cfg.inbound.purchase_order_entity,
      });
      ensureField(grnEntity, {
        name: cfg.inbound.grn_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(grnEntity, { name: 'received_at', type: 'datetime', label: 'Received At', required: false });
      ensureField(grnEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(grnEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });

      const grnItemEntity = ensureEntity(cfg.inbound.grn_item_entity, () => ({
        slug: cfg.inbound.grn_item_entity,
        display_name: 'Goods Receipt Items',
        display_field: cfg.inbound.grn_item_item_field,
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.inbound.grn_item_parent_field,
            cfg.inbound.grn_item_po_item_field,
            cfg.inbound.grn_item_item_field,
            cfg.inbound.grn_item_received_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_parent_field,
        type: 'reference',
        label: 'Goods Receipt',
        required: true,
        reference_entity: cfg.inbound.grn_entity,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_po_item_field,
        type: 'reference',
        label: 'PO Item',
        required: true,
        reference_entity: cfg.inbound.purchase_order_item_entity,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_received_field,
        type: 'decimal',
        label: 'Received Quantity',
        required: true,
        min: 0,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_accepted_field,
        type: 'decimal',
        label: 'Accepted Quantity',
        required: false,
        min: 0,
      });
      ensureField(grnItemEntity, { name: 'rejected_quantity', type: 'decimal', label: 'Rejected Quantity', required: false, min: 0 });
      ensureField(grnItemEntity, { name: 'discrepancy_reason', type: 'text', label: 'Discrepancy Reason', required: false });

      ensureChild(poEntity, {
        entity: cfg.inbound.purchase_order_item_entity,
        foreign_key: cfg.inbound.po_item_parent_field,
        label: 'PO Items',
        columns: [
          cfg.inbound.po_item_item_field,
          cfg.inbound.po_item_ordered_field,
          cfg.inbound.po_item_received_field,
          cfg.inbound.po_item_status_field,
        ],
      });
      ensureChild(grnEntity, {
        entity: cfg.inbound.grn_item_entity,
        foreign_key: cfg.inbound.grn_item_parent_field,
        label: 'Receipt Lines',
        columns: [
          cfg.inbound.grn_item_po_item_field,
          cfg.inbound.grn_item_item_field,
          cfg.inbound.grn_item_received_field,
          cfg.inbound.grn_item_accepted_field,
        ],
      });
    }

    if (this._isPackEnabled(cfg.cycleCounting)) {
      const sessionEntity = ensureEntity(cfg.cycleCounting.session_entity, () => ({
        slug: cfg.cycleCounting.session_entity,
        display_name: 'Cycle Count Sessions',
        display_field: 'session_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['session_number', cfg.cycleCounting.session_status_field, 'planned_at', 'posted_at'] },
        fields: [],
        features: {},
      }));
      ensureField(sessionEntity, { name: 'session_number', type: 'string', label: 'Session Number', required: true, unique: true });
      ensureField(sessionEntity, {
        name: cfg.cycleCounting.session_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'InProgress', 'PendingApproval', 'Approved', 'Posted', 'Cancelled'],
      });
      ensureField(sessionEntity, { name: 'planned_at', type: 'date', label: 'Planned At', required: false });
      ensureField(sessionEntity, { name: 'started_at', type: 'datetime', label: 'Started At', required: false });
      ensureField(sessionEntity, { name: 'approved_at', type: 'datetime', label: 'Approved At', required: false });
      ensureField(sessionEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });
      ensureField(sessionEntity, { name: 'blind_count', type: 'boolean', label: 'Blind Count', required: false });
      ensureField(sessionEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      const lineEntity = ensureEntity(cfg.cycleCounting.line_entity, () => ({
        slug: cfg.cycleCounting.line_entity,
        display_name: 'Cycle Count Lines',
        display_field: cfg.cycleCounting.line_item_field,
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.cycleCounting.line_session_field,
            cfg.cycleCounting.line_item_field,
            cfg.cycleCounting.line_expected_field,
            cfg.cycleCounting.line_counted_field,
            cfg.cycleCounting.line_variance_field,
            'status',
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_session_field,
        type: 'reference',
        label: 'Cycle Session',
        required: true,
        reference_entity: cfg.cycleCounting.session_entity,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_expected_field,
        type: 'decimal',
        label: 'Expected Quantity',
        required: true,
        min: 0,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_counted_field,
        type: 'decimal',
        label: 'Counted Quantity',
        required: false,
        min: 0,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_variance_field,
        type: 'decimal',
        label: 'Variance Quantity',
        required: false,
      });
      ensureField(lineEntity, {
        name: 'status',
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Pending', 'Counted', 'Posted'],
      });
      ensureField(lineEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      ensureChild(sessionEntity, {
        entity: cfg.cycleCounting.line_entity,
        foreign_key: cfg.cycleCounting.line_session_field,
        label: 'Cycle Count Lines',
        columns: [
          cfg.cycleCounting.line_item_field,
          cfg.cycleCounting.line_expected_field,
          cfg.cycleCounting.line_counted_field,
          cfg.cycleCounting.line_variance_field,
          'status',
        ],
      });
    }
  }

  _withInvoicePriorityAEntities(entities, sdf) {
    const cfg = this._getInvoicePriorityAConfig(sdf);
    const { enabledModules } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const invoiceEnabled = enabledSet.has('invoice');
    const packsEnabled =
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.payments) ||
      this._isPackEnabled(cfg.notes) ||
      this._isPackEnabled(cfg.lifecycle) ||
      this._isPackEnabled(cfg.calculationEngine);

    if (!invoiceEnabled || !packsEnabled) return;

    const bySlug = new Map();
    for (const entity of entities) {
      if (!entity || !entity.slug) continue;
      bySlug.set(entity.slug, entity);
    }

    const ensureEntity = (slug, defaultModule, factory) => {
      if (bySlug.has(slug)) {
        const existing = bySlug.get(slug);
        if (!existing.module && defaultModule) existing.module = defaultModule;
        return existing;
      }
      const created = factory();
      entities.push(created);
      bySlug.set(slug, created);
      return created;
    };

    const ensureField = (entity, field) => {
      if (!entity || !field || !field.name) return;
      if (!Array.isArray(entity.fields)) entity.fields = [];
      if (entity.fields.some((f) => f && f.name === field.name)) return;
      entity.fields.push({ ...field });
    };

    const ensureChild = (entity, childCfg) => {
      if (!entity || !childCfg || !childCfg.entity || !childCfg.foreign_key) return;
      if (!Array.isArray(entity.children)) entity.children = [];
      const exists = entity.children.some((c) => {
        const childSlug = c && (c.entity || c.slug);
        const fk = c && (c.foreign_key || c.foreignKey);
        return childSlug === childCfg.entity && fk === childCfg.foreign_key;
      });
      if (!exists) {
        entity.children.push({ ...childCfg });
      }
    };

    const customerEntity = ensureEntity(cfg.customerEntity, 'shared', () => ({
      slug: cfg.customerEntity,
      display_name: 'Customers',
      display_field: 'name',
      module: 'shared',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['name', 'email'] },
      fields: [],
      features: {},
    }));
    ensureField(customerEntity, { name: 'name', type: 'string', label: 'Name', required: true });
    ensureField(customerEntity, { name: 'email', type: 'string', label: 'Email', required: false });
    ensureField(customerEntity, { name: 'phone', type: 'string', label: 'Phone', required: false });

    const invoiceEntity = ensureEntity(cfg.invoiceEntity, 'invoice', () => ({
      slug: cfg.invoiceEntity,
      display_name: 'Invoices',
      display_field: cfg.invoice_number_field,
      module: 'invoice',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: [cfg.invoice_number_field, cfg.customer_field, cfg.status_field, cfg.grand_total_field, cfg.outstanding_field] },
      fields: [],
      features: { print_invoice: true },
    }));

    const statusOptions = Array.from(
      new Set(
        (Array.isArray(cfg.lifecycle.statuses) && cfg.lifecycle.statuses.length
          ? cfg.lifecycle.statuses
          : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']).map((s) => String(s))
      )
    );

    ensureField(invoiceEntity, { name: cfg.invoice_number_field, type: 'string', label: 'Invoice Number', required: true, unique: true });
    ensureField(invoiceEntity, {
      name: cfg.customer_field,
      type: 'reference',
      label: 'Customer',
      required: true,
      reference_entity: cfg.customerEntity,
    });
    ensureField(invoiceEntity, { name: 'issue_date', type: 'date', label: 'Issue Date', required: true });
    ensureField(invoiceEntity, { name: 'due_date', type: 'date', label: 'Due Date', required: true });
    ensureField(invoiceEntity, {
      name: cfg.status_field,
      type: 'string',
      label: 'Status',
      required: true,
      options: statusOptions,
    });
    ensureField(invoiceEntity, { name: cfg.subtotal_field, type: 'decimal', label: 'Subtotal', required: true, min: 0 });
    ensureField(invoiceEntity, { name: cfg.tax_total_field, type: 'decimal', label: 'Tax Total', required: true, min: 0 });
    ensureField(invoiceEntity, { name: cfg.grand_total_field, type: 'decimal', label: 'Grand Total', required: true, min: 0 });
    ensureField(invoiceEntity, { name: cfg.paid_total_field, type: 'decimal', label: 'Paid Total', required: false, min: 0 });
    ensureField(invoiceEntity, { name: cfg.outstanding_field, type: 'decimal', label: 'Outstanding Balance', required: false, min: 0 });
    ensureField(invoiceEntity, { name: 'currency', type: 'string', label: 'Currency', required: false });

    if (this._isPackEnabled(cfg.transactions)) {
      ensureField(invoiceEntity, { name: cfg.idempotency_field, type: 'string', label: 'Idempotency Key', required: false, unique: true });
      ensureField(invoiceEntity, { name: cfg.posted_at_field, type: 'datetime', label: 'Posted At', required: false });
      ensureField(invoiceEntity, { name: cfg.cancelled_at_field, type: 'datetime', label: 'Cancelled At', required: false });
    }

    if (this._isPackEnabled(cfg.calculationEngine)) {
      ensureField(invoiceEntity, { name: cfg.discount_total_field, type: 'decimal', label: 'Discount Total', required: false, min: 0 });
      ensureField(invoiceEntity, { name: cfg.additional_charges_field, type: 'decimal', label: 'Additional Charges', required: false, min: 0 });

      const itemEntity = ensureEntity(cfg.itemEntity, 'invoice', () => ({
        slug: cfg.itemEntity,
        display_name: 'Invoice Items',
        display_field: 'description',
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.item_invoice_field,
            'description',
            cfg.item_quantity_field,
            cfg.item_unit_price_field,
            cfg.item_line_total_field,
          ],
        },
        fields: [],
        features: {},
      }));

      ensureField(itemEntity, {
        name: cfg.item_invoice_field,
        type: 'reference',
        label: 'Invoice',
        required: true,
        reference_entity: cfg.invoiceEntity,
      });
      ensureField(itemEntity, { name: 'description', type: 'string', label: 'Description', required: true });
      ensureField(itemEntity, { name: cfg.item_quantity_field, type: 'decimal', label: 'Quantity', required: true, min: 0 });
      ensureField(itemEntity, { name: cfg.item_unit_price_field, type: 'decimal', label: 'Unit Price', required: true, min: 0 });
      ensureField(itemEntity, { name: cfg.item_line_subtotal_field, type: 'decimal', label: 'Line Subtotal', required: false, min: 0 });
      ensureField(itemEntity, {
        name: cfg.item_discount_type_field,
        type: 'string',
        label: 'Discount Type',
        required: false,
        options: ['Amount', 'Percent'],
      });
      ensureField(itemEntity, { name: cfg.item_discount_value_field, type: 'decimal', label: 'Discount Value', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_discount_total_field, type: 'decimal', label: 'Discount Total', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_tax_rate_field, type: 'decimal', label: 'Tax Rate', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_tax_total_field, type: 'decimal', label: 'Tax Total', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_additional_charge_field, type: 'decimal', label: 'Additional Charge', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_line_total_field, type: 'decimal', label: 'Line Total', required: false, min: 0 });

      ensureChild(invoiceEntity, {
        entity: cfg.itemEntity,
        foreign_key: cfg.item_invoice_field,
        label: 'Invoice Items',
        columns: ['description', cfg.item_quantity_field, cfg.item_unit_price_field, cfg.item_line_total_field],
      });
    }

    if (this._isPackEnabled(cfg.payments)) {
      const paymentEntity = ensureEntity(cfg.payments.payment_entity, 'invoice', () => ({
        slug: cfg.payments.payment_entity,
        display_name: 'Invoice Payments',
        display_field: cfg.payments.payment_number_field,
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.payments.payment_number_field,
            cfg.payments.payment_customer_field,
            cfg.payments.payment_date_field,
            cfg.payments.amount_field,
            cfg.payments.unallocated_field,
            cfg.payments.status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(paymentEntity, { name: cfg.payments.payment_number_field, type: 'string', label: 'Payment Number', required: true, unique: true });
      ensureField(paymentEntity, {
        name: cfg.payments.payment_customer_field,
        type: 'reference',
        label: 'Customer',
        required: false,
        reference_entity: cfg.customerEntity,
      });
      ensureField(paymentEntity, { name: cfg.payments.payment_date_field, type: 'date', label: 'Payment Date', required: true });
      ensureField(paymentEntity, { name: cfg.payments.payment_method_field, type: 'string', label: 'Payment Method', required: false });
      ensureField(paymentEntity, { name: cfg.payments.amount_field, type: 'decimal', label: 'Amount', required: true, min: 0 });
      ensureField(paymentEntity, { name: cfg.payments.unallocated_field, type: 'decimal', label: 'Unallocated Amount', required: false, min: 0 });
      ensureField(paymentEntity, {
        name: cfg.payments.status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(paymentEntity, { name: 'reference_number', type: 'string', label: 'Reference Number', required: false });
      ensureField(paymentEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(paymentEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });

      const allocationEntity = ensureEntity(cfg.payments.allocation_entity, 'invoice', () => ({
        slug: cfg.payments.allocation_entity,
        display_name: 'Payment Allocations',
        display_field: cfg.payments.allocation_invoice_field,
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.payments.allocation_payment_field,
            cfg.payments.allocation_invoice_field,
            cfg.payments.allocation_amount_field,
            cfg.payments.allocation_date_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_payment_field,
        type: 'reference',
        label: 'Payment',
        required: true,
        reference_entity: cfg.payments.payment_entity,
      });
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_invoice_field,
        type: 'reference',
        label: 'Invoice',
        required: true,
        reference_entity: cfg.invoiceEntity,
      });
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_amount_field,
        type: 'decimal',
        label: 'Allocated Amount',
        required: true,
        min: 0,
      });
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_date_field,
        type: 'datetime',
        label: 'Allocated At',
        required: false,
      });
      ensureField(allocationEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      ensureChild(paymentEntity, {
        entity: cfg.payments.allocation_entity,
        foreign_key: cfg.payments.allocation_payment_field,
        label: 'Allocations',
        columns: [
          cfg.payments.allocation_invoice_field,
          cfg.payments.allocation_amount_field,
          cfg.payments.allocation_date_field,
        ],
      });
    }

    if (this._isPackEnabled(cfg.notes)) {
      const noteEntity = ensureEntity(cfg.notes.note_entity, 'invoice', () => ({
        slug: cfg.notes.note_entity,
        display_name: 'Invoice Notes',
        display_field: cfg.notes.note_number_field,
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.notes.note_number_field,
            cfg.notes.note_invoice_field,
            cfg.notes.note_type_field,
            cfg.notes.note_status_field,
            cfg.notes.note_grand_total_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(noteEntity, { name: cfg.notes.note_number_field, type: 'string', label: 'Note Number', required: true, unique: true });
      ensureField(noteEntity, {
        name: cfg.notes.note_invoice_field,
        type: 'reference',
        label: 'Source Invoice',
        required: true,
        reference_entity: cfg.invoiceEntity,
      });
      ensureField(noteEntity, {
        name: cfg.notes.note_type_field,
        type: 'string',
        label: 'Note Type',
        required: true,
        options: ['Credit', 'Debit'],
      });
      ensureField(noteEntity, {
        name: cfg.notes.note_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(noteEntity, { name: 'issue_date', type: 'date', label: 'Issue Date', required: true });
      ensureField(noteEntity, { name: 'reason', type: 'text', label: 'Reason', required: false });
      ensureField(noteEntity, { name: cfg.notes.note_amount_field, type: 'decimal', label: 'Amount', required: true, min: 0 });
      ensureField(noteEntity, { name: cfg.notes.note_tax_total_field, type: 'decimal', label: 'Tax Total', required: false, min: 0 });
      ensureField(noteEntity, { name: cfg.notes.note_grand_total_field, type: 'decimal', label: 'Grand Total', required: false, min: 0 });
      ensureField(noteEntity, { name: cfg.notes.note_posted_at_field, type: 'datetime', label: 'Posted At', required: false });
      ensureField(noteEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      ensureChild(invoiceEntity, {
        entity: cfg.notes.note_entity,
        foreign_key: cfg.notes.note_invoice_field,
        label: 'Notes',
        columns: [
          cfg.notes.note_number_field,
          cfg.notes.note_type_field,
          cfg.notes.note_status_field,
          cfg.notes.note_grand_total_field,
        ],
      });
    }
  }

  _withHRPriorityAEntities(entities, sdf) {
    const cfg = this._getHRPriorityAConfig(sdf);
    const { enabledModules } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const hrEnabled = enabledSet.has('hr');
    const packsEnabled =
      this._isPackEnabled(cfg.leaveEngine) ||
      this._isPackEnabled(cfg.leaveApprovals) ||
      this._isPackEnabled(cfg.attendanceTime) ||
      this._isPackEnabled(cfg.compensationLedger);

    if (!hrEnabled || !packsEnabled) return;

    const bySlug = new Map();
    for (const entity of entities) {
      if (!entity || !entity.slug) continue;
      bySlug.set(entity.slug, entity);
    }

    const ensureEntity = (slug, defaultModule, factory) => {
      if (bySlug.has(slug)) {
        const existing = bySlug.get(slug);
        if (!existing.module && defaultModule) existing.module = defaultModule;
        return existing;
      }
      const created = factory();
      entities.push(created);
      bySlug.set(slug, created);
      return created;
    };

    const ensureField = (entity, field) => {
      if (!entity || !field || !field.name) return;
      if (!Array.isArray(entity.fields)) entity.fields = [];
      if (entity.fields.some((f) => f && f.name === field.name)) return;
      entity.fields.push({ ...field });
    };

    const ensureChild = (entity, childCfg) => {
      if (!entity || !childCfg || !childCfg.entity || !childCfg.foreign_key) return;
      if (!Array.isArray(entity.children)) entity.children = [];
      const exists = entity.children.some((c) => {
        const childSlug = c && (c.entity || c.slug);
        const fk = c && (c.foreign_key || c.foreignKey);
        return childSlug === childCfg.entity && fk === childCfg.foreign_key;
      });
      if (!exists) {
        entity.children.push({ ...childCfg });
      }
    };

    const employeeEntity = ensureEntity(cfg.employeeEntity, 'hr', () => ({
      slug: cfg.employeeEntity,
      display_name: 'Employees',
      display_field: 'first_name',
      module: 'hr',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['first_name', 'last_name', 'email', 'status', 'job_title'] },
      fields: [],
      features: { audit_trail: true },
    }));
    ensureField(employeeEntity, { name: 'first_name', type: 'string', label: 'First Name', required: true });
    ensureField(employeeEntity, { name: 'last_name', type: 'string', label: 'Last Name', required: true });
    ensureField(employeeEntity, { name: 'email', type: 'string', label: 'Email', required: true, unique: true });
    ensureField(employeeEntity, { name: 'job_title', type: 'string', label: 'Job Title', required: false });
    ensureField(employeeEntity, { name: 'hire_date', type: 'date', label: 'Hire Date', required: false });
    ensureField(employeeEntity, {
      name: 'status',
      type: 'string',
      label: 'Status',
      required: true,
      options: ['Active', 'On Leave', 'Terminated'],
    });

    const departmentsEntity = ensureEntity(cfg.departmentEntity, 'hr', () => ({
      slug: cfg.departmentEntity,
      display_name: 'Departments',
      display_field: 'name',
      module: 'hr',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['name', 'manager_id', 'location'] },
      fields: [],
      features: {},
    }));
    ensureField(departmentsEntity, { name: 'name', type: 'string', label: 'Department', required: true, unique: true });
    ensureField(departmentsEntity, {
      name: 'manager_id',
      type: 'reference',
      label: 'Manager',
      required: false,
      reference_entity: cfg.employeeEntity,
    });
    ensureField(departmentsEntity, { name: 'location', type: 'string', label: 'Location', required: false });
    const employeeModule = String(employeeEntity.module || 'hr').trim().toLowerCase();
    const departmentModule = String(departmentsEntity.module || 'hr').trim().toLowerCase();
    const canLinkDepartmentFromEmployee =
      employeeModule === departmentModule ||
      employeeModule === 'hr' ||
      departmentModule === 'shared';
    const canLinkEmployeeChildEntity = (childEntity) => {
      const childModule = String((childEntity && childEntity.module) || 'hr').trim().toLowerCase();
      return (
        employeeModule === childModule ||
        employeeModule === 'hr' ||
        childModule === 'shared'
      );
    };
    if (canLinkDepartmentFromEmployee) {
      ensureField(employeeEntity, {
        name: 'department_id',
        type: 'reference',
        label: 'Department',
        required: false,
        reference_entity: cfg.departmentEntity,
      });
    }

    if (this._isPackEnabled(cfg.leaveEngine) || this._isPackEnabled(cfg.leaveApprovals)) {
      const leaveEntity = ensureEntity(cfg.leaveEntity, 'hr', () => ({
        slug: cfg.leaveEntity,
        display_name: 'Leave Requests',
        display_field: cfg.leaveEngine.leave_type_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.leaveEngine.employee_field,
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.start_date_field,
            cfg.leaveEngine.end_date_field,
            cfg.leaveEngine.status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(leaveEntity, {
        name: cfg.leaveEngine.employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveEngine.leave_type_field,
        type: 'string',
        label: 'Leave Type',
        required: true,
        options: ['Annual', 'Sick', 'Casual', 'Unpaid'],
      });
      ensureField(leaveEntity, { name: cfg.leaveEngine.start_date_field, type: 'date', label: 'Start Date', required: true });
      ensureField(leaveEntity, { name: cfg.leaveEngine.end_date_field, type: 'date', label: 'End Date', required: true });
      ensureField(leaveEntity, { name: cfg.leaveEngine.days_field, type: 'decimal', label: 'Leave Days', required: false, min: 0 });
      ensureField(leaveEntity, {
        name: cfg.leaveEngine.status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: cfg.leaveApprovals.statuses,
      });
      if (cfg.leaveApprovals.status_field !== cfg.leaveEngine.status_field) {
        ensureField(leaveEntity, {
          name: cfg.leaveApprovals.status_field,
          type: 'string',
          label: 'Approval Status',
          required: true,
          options: cfg.leaveApprovals.statuses,
        });
      }
      ensureField(leaveEntity, { name: 'reason', type: 'text', label: 'Reason', required: false });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.approver_field,
        type: 'reference',
        label: 'Approver',
        required: false,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.approved_at_field,
        type: 'datetime',
        label: 'Approved At',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.rejected_at_field,
        type: 'datetime',
        label: 'Rejected At',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.cancelled_at_field,
        type: 'datetime',
        label: 'Cancelled At',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.rejection_reason_field,
        type: 'text',
        label: 'Rejection Reason',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.decision_key_field,
        type: 'string',
        label: 'Decision Key',
        required: false,
      });

      if (canLinkEmployeeChildEntity(leaveEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.leaveEntity,
          foreign_key: cfg.leaveEngine.employee_field,
          label: 'Leave Requests',
          columns: [
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.start_date_field,
            cfg.leaveEngine.end_date_field,
            cfg.leaveEngine.status_field,
          ],
        });
      }
    }

    if (this._isPackEnabled(cfg.leaveEngine)) {
      const balanceEntity = ensureEntity(cfg.leaveEngine.balance_entity, 'hr', () => ({
        slug: cfg.leaveEngine.balance_entity,
        display_name: 'Leave Balances',
        display_field: cfg.leaveEngine.leave_type_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.leaveEngine.employee_field,
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.available_field,
            cfg.leaveEngine.fiscal_year_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.leave_type_field,
        type: 'string',
        label: 'Leave Type',
        required: true,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.entitlement_field,
        type: 'decimal',
        label: 'Entitlement',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.accrued_field,
        type: 'decimal',
        label: 'Accrued',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.consumed_field,
        type: 'decimal',
        label: 'Consumed',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.carry_forward_field,
        type: 'decimal',
        label: 'Carry Forward',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.available_field,
        type: 'decimal',
        label: 'Available',
        required: true,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.fiscal_year_field,
        type: 'string',
        label: 'Year',
        required: true,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.last_accrual_at_field,
        type: 'datetime',
        label: 'Last Accrual At',
        required: false,
      });
      ensureField(balanceEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      if (canLinkEmployeeChildEntity(balanceEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.leaveEngine.balance_entity,
          foreign_key: cfg.leaveEngine.employee_field,
          label: 'Leave Balances',
          columns: [
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.entitlement_field,
            cfg.leaveEngine.accrued_field,
            cfg.leaveEngine.available_field,
          ],
        });
      }
    }

    if (this._isPackEnabled(cfg.attendanceTime)) {
      const attendanceEntity = ensureEntity(cfg.attendanceTime.attendance_entity, 'hr', () => ({
        slug: cfg.attendanceTime.attendance_entity,
        display_name: 'Attendance Entries',
        display_field: cfg.attendanceTime.attendance_date_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.attendanceTime.attendance_employee_field,
            cfg.attendanceTime.attendance_date_field,
            cfg.attendanceTime.worked_hours_field,
            cfg.attendanceTime.attendance_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.attendance_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.attendance_date_field,
        type: 'date',
        label: 'Work Date',
        required: true,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.check_in_field,
        type: 'datetime',
        label: 'Check In',
        required: false,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.check_out_field,
        type: 'datetime',
        label: 'Check Out',
        required: false,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.worked_hours_field,
        type: 'decimal',
        label: 'Worked Hours',
        required: false,
        min: 0,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.attendance_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Present', 'Absent', 'Half Day', 'On Leave'],
      });
      ensureField(attendanceEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(attendanceEntity, { name: 'idempotency_key', type: 'string', label: 'Idempotency Key', required: false, unique: true });

      const shiftEntity = ensureEntity(cfg.attendanceTime.shift_entity, 'hr', () => ({
        slug: cfg.attendanceTime.shift_entity,
        display_name: 'Shift Assignments',
        display_field: 'shift_name',
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.attendanceTime.shift_employee_field,
            'shift_name',
            cfg.attendanceTime.shift_start_field,
            cfg.attendanceTime.shift_end_field,
            cfg.attendanceTime.shift_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(shiftEntity, { name: 'shift_name', type: 'string', label: 'Shift Name', required: true });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_start_field,
        type: 'string',
        label: 'Start Time',
        required: true,
      });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_end_field,
        type: 'string',
        label: 'End Time',
        required: true,
      });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_days_field,
        type: 'text',
        label: 'Work Days',
        required: false,
      });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Active', 'Inactive'],
      });
      ensureField(shiftEntity, { name: 'effective_from', type: 'date', label: 'Effective From', required: false });
      ensureField(shiftEntity, { name: 'effective_to', type: 'date', label: 'Effective To', required: false });

      const timesheetEntity = ensureEntity(cfg.attendanceTime.timesheet_entity, 'hr', () => ({
        slug: cfg.attendanceTime.timesheet_entity,
        display_name: 'Timesheets',
        display_field: cfg.attendanceTime.timesheet_date_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.attendanceTime.timesheet_employee_field,
            cfg.attendanceTime.timesheet_date_field,
            cfg.attendanceTime.timesheet_hours_field,
            cfg.attendanceTime.timesheet_overtime_field,
            cfg.attendanceTime.timesheet_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_date_field,
        type: 'date',
        label: 'Work Date',
        required: true,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_hours_field,
        type: 'decimal',
        label: 'Regular Hours',
        required: false,
        min: 0,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_overtime_field,
        type: 'decimal',
        label: 'Overtime Hours',
        required: false,
        min: 0,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Submitted', 'Approved', 'Rejected'],
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_attendance_field,
        type: 'reference',
        label: 'Attendance',
        required: false,
        reference_entity: cfg.attendanceTime.attendance_entity,
      });
      ensureField(timesheetEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      if (canLinkEmployeeChildEntity(attendanceEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.attendanceTime.attendance_entity,
          foreign_key: cfg.attendanceTime.attendance_employee_field,
          label: 'Attendance',
          columns: [
            cfg.attendanceTime.attendance_date_field,
            cfg.attendanceTime.worked_hours_field,
            cfg.attendanceTime.attendance_status_field,
          ],
        });
      }
      if (canLinkEmployeeChildEntity(timesheetEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.attendanceTime.timesheet_entity,
          foreign_key: cfg.attendanceTime.timesheet_employee_field,
          label: 'Timesheets',
          columns: [
            cfg.attendanceTime.timesheet_date_field,
            cfg.attendanceTime.timesheet_hours_field,
            cfg.attendanceTime.timesheet_overtime_field,
            cfg.attendanceTime.timesheet_status_field,
          ],
        });
      }
    }

    if (this._isPackEnabled(cfg.compensationLedger)) {
      const ledgerEntity = ensureEntity(cfg.compensationLedger.ledger_entity, 'hr', () => ({
        slug: cfg.compensationLedger.ledger_entity,
        display_name: 'Compensation Ledger',
        display_field: cfg.compensationLedger.ledger_period_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.compensationLedger.ledger_employee_field,
            cfg.compensationLedger.ledger_period_field,
            cfg.compensationLedger.ledger_component_field,
            cfg.compensationLedger.ledger_amount_field,
            cfg.compensationLedger.ledger_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_period_field,
        type: 'string',
        label: 'Pay Period',
        required: true,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_component_field,
        type: 'string',
        label: 'Component',
        required: true,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_type_field,
        type: 'string',
        label: 'Type',
        required: true,
        options: ['Earning', 'Deduction'],
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_amount_field,
        type: 'decimal',
        label: 'Amount',
        required: true,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(ledgerEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });
      ensureField(ledgerEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      const snapshotEntity = ensureEntity(cfg.compensationLedger.snapshot_entity, 'hr', () => ({
        slug: cfg.compensationLedger.snapshot_entity,
        display_name: 'Compensation Snapshots',
        display_field: cfg.compensationLedger.snapshot_period_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.compensationLedger.snapshot_employee_field,
            cfg.compensationLedger.snapshot_period_field,
            cfg.compensationLedger.snapshot_gross_field,
            cfg.compensationLedger.snapshot_deduction_field,
            cfg.compensationLedger.snapshot_net_field,
            cfg.compensationLedger.snapshot_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_period_field,
        type: 'string',
        label: 'Pay Period',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_gross_field,
        type: 'decimal',
        label: 'Gross Amount',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_deduction_field,
        type: 'decimal',
        label: 'Deduction Amount',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_net_field,
        type: 'decimal',
        label: 'Net Amount',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted'],
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_posted_at_field,
        type: 'datetime',
        label: 'Posted At',
        required: false,
      });
      ensureField(snapshotEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      if (canLinkEmployeeChildEntity(ledgerEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.compensationLedger.ledger_entity,
          foreign_key: cfg.compensationLedger.ledger_employee_field,
          label: 'Compensation Ledger',
          columns: [
            cfg.compensationLedger.ledger_period_field,
            cfg.compensationLedger.ledger_component_field,
            cfg.compensationLedger.ledger_amount_field,
            cfg.compensationLedger.ledger_status_field,
          ],
        });
      }
      if (canLinkEmployeeChildEntity(snapshotEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.compensationLedger.snapshot_entity,
          foreign_key: cfg.compensationLedger.snapshot_employee_field,
          label: 'Compensation Snapshots',
          columns: [
            cfg.compensationLedger.snapshot_period_field,
            cfg.compensationLedger.snapshot_gross_field,
            cfg.compensationLedger.snapshot_deduction_field,
            cfg.compensationLedger.snapshot_net_field,
          ],
        });
      }
    }
  }

  _formatAutoName(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  }

  async _applyBackendRuntimeModules(backendDir, sdf, backendEntities) {
    const fs = require('fs').promises;
    const path = require('path');

    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const scheduled = modules?.scheduled_reports || {};
    const inventoryCfg = this._getInventoryPriorityAConfig(sdf);
    const inventoryPriority = {
      stock_entity: inventoryCfg.stockEntity,
      reservations: {
        enabled: this._isPackEnabled(inventoryCfg.reservations),
        reservation_entity: inventoryCfg.reservations.reservation_entity,
        item_field: inventoryCfg.reservations.item_field,
        quantity_field: inventoryCfg.reservations.quantity_field,
        status_field: inventoryCfg.reservations.status_field,
      },
      transactions: {
        enabled: this._isPackEnabled(inventoryCfg.transactions),
        quantity_field: inventoryCfg.transactions.quantity_field,
      },
      inbound: {
        enabled: this._isPackEnabled(inventoryCfg.inbound),
        purchase_order_entity: inventoryCfg.inbound.purchase_order_entity,
        purchase_order_item_entity: inventoryCfg.inbound.purchase_order_item_entity,
        grn_entity: inventoryCfg.inbound.grn_entity,
        grn_item_entity: inventoryCfg.inbound.grn_item_entity,
      },
      cycle_counting: {
        enabled: this._isPackEnabled(inventoryCfg.cycleCounting),
        session_entity: inventoryCfg.cycleCounting.session_entity,
        line_entity: inventoryCfg.cycleCounting.line_entity,
      },
    };

    const invoiceCfg = this._getInvoicePriorityAConfig(sdf);
    const invoicePriority = {
      invoice_entity: invoiceCfg.invoiceEntity,
      invoice_item_entity: invoiceCfg.itemEntity,
      transactions: {
        enabled: this._isPackEnabled(invoiceCfg.transactions),
        invoice_number_field: invoiceCfg.invoice_number_field,
        idempotency_field: invoiceCfg.idempotency_field,
      },
      payments: {
        enabled: this._isPackEnabled(invoiceCfg.payments),
        payment_entity: invoiceCfg.payments.payment_entity,
        allocation_entity: invoiceCfg.payments.allocation_entity,
      },
      notes: {
        enabled: this._isPackEnabled(invoiceCfg.notes),
        note_entity: invoiceCfg.notes.note_entity,
      },
      lifecycle: {
        enabled: this._isPackEnabled(invoiceCfg.lifecycle),
        status_field: invoiceCfg.status_field,
        statuses: invoiceCfg.lifecycle.statuses,
      },
      calculation_engine: {
        enabled: this._isPackEnabled(invoiceCfg.calculationEngine),
        line_total_field: invoiceCfg.item_line_total_field,
      },
    };

    const hrCfg = this._getHRPriorityAConfig(sdf);
    const hrPriority = {
      employee_entity: hrCfg.employeeEntity,
      leave_entity: hrCfg.leaveEntity,
      leave_engine: {
        enabled: this._isPackEnabled(hrCfg.leaveEngine),
        balance_entity: hrCfg.leaveEngine.balance_entity,
        employee_field: hrCfg.leaveEngine.employee_field,
        leave_type_field: hrCfg.leaveEngine.leave_type_field,
        available_field: hrCfg.leaveEngine.available_field,
        fiscal_year_field: hrCfg.leaveEngine.fiscal_year_field,
      },
      leave_approvals: {
        enabled: this._isPackEnabled(hrCfg.leaveApprovals),
        status_field: hrCfg.leaveApprovals.status_field,
        approver_field: hrCfg.leaveApprovals.approver_field,
        statuses: hrCfg.leaveApprovals.statuses,
      },
      attendance_time: {
        enabled: this._isPackEnabled(hrCfg.attendanceTime),
        attendance_entity: hrCfg.attendanceTime.attendance_entity,
        shift_entity: hrCfg.attendanceTime.shift_entity,
        timesheet_entity: hrCfg.attendanceTime.timesheet_entity,
        work_days: hrCfg.attendanceTime.work_days,
        daily_hours: hrCfg.attendanceTime.daily_hours,
      },
      compensation_ledger: {
        enabled: this._isPackEnabled(hrCfg.compensationLedger),
        ledger_entity: hrCfg.compensationLedger.ledger_entity,
        snapshot_entity: hrCfg.compensationLedger.snapshot_entity,
      },
    };

    // Generate optional runtime config for the backend entrypoint (scheduler, etc.)
    const systemConfig = {
      modules: {
        inventory_priority_a: inventoryPriority,
        invoice_priority_a: invoicePriority,
        hr_priority_a: hrPriority,
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
      systemConfig.modules.scheduled_reports.enabled === true ||
      systemConfig.modules.inventory_priority_a.reservations.enabled === true ||
      systemConfig.modules.inventory_priority_a.transactions.enabled === true ||
      systemConfig.modules.inventory_priority_a.inbound.enabled === true ||
      systemConfig.modules.inventory_priority_a.cycle_counting.enabled === true ||
      systemConfig.modules.invoice_priority_a.transactions.enabled === true ||
      systemConfig.modules.invoice_priority_a.payments.enabled === true ||
      systemConfig.modules.invoice_priority_a.notes.enabled === true ||
      systemConfig.modules.invoice_priority_a.lifecycle.enabled === true ||
      systemConfig.modules.invoice_priority_a.calculation_engine.enabled === true ||
      systemConfig.modules.hr_priority_a.leave_engine.enabled === true ||
      systemConfig.modules.hr_priority_a.leave_approvals.enabled === true ||
      systemConfig.modules.hr_priority_a.attendance_time.enabled === true ||
      systemConfig.modules.hr_priority_a.compensation_ledger.enabled === true;

    if (shouldWriteConfig) {
      await fs.writeFile(
        path.join(backendDir, 'src/systemConfig.js'),
        'module.exports = ' + JSON.stringify(systemConfig, null, 2) + ';\n'
      );

      if (systemConfig.modules.scheduled_reports.enabled === true) {
        // Ensure dependency exists only when scheduler is enabled.
        const pkgPath = path.join(backendDir, 'package.json');
        const pkgRaw = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgRaw);
        pkg.dependencies = pkg.dependencies || {};
        if (!pkg.dependencies['node-cron']) {
          pkg.dependencies['node-cron'] = '^3.0.3';
        }
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
      }
    }

    // Silence unused param lint in this file (kept for future modules)
    void backendEntities;
  }
}

module.exports = ProjectAssembler;
