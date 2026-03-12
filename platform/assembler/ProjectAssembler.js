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
      const invoicesEntity = requireEntity('invoices', 'invoice header');
      const customersEntity = requireEntity('customers', 'customer list');

      const invoicesModule = this._normalizeEntityModule(invoicesEntity, { hasErpConfig });
      const customersModule = this._normalizeEntityModule(customersEntity, { hasErpConfig });

      if (invoicesModule !== 'invoice') {
        throw new Error(`SDF Validation Error: Entity 'invoices' must be in module 'invoice'.`);
      }
      if (customersModule !== 'shared' && customersModule !== 'invoice') {
        throw new Error(`SDF Validation Error: Entity 'customers' must be 'shared' or in module 'invoice'.`);
      }

      ensureFields(invoicesEntity, ['invoice_number', 'customer_id', 'issue_date', 'due_date', 'status', 'subtotal', 'tax_total', 'grand_total'], 'invoices');

      const itemsEntity = allBySlug.get('invoice_items');
      if (itemsEntity) {
        const itemsModule = this._normalizeEntityModule(itemsEntity, { hasErpConfig });
        if (itemsModule !== 'invoice') {
          throw new Error(`SDF Validation Error: Entity 'invoice_items' must be in module 'invoice'.`);
        }

        const children = Array.isArray(invoicesEntity.children) ? invoicesEntity.children : [];
        const invoiceChild = children.find((child) => {
          const slug = child && (child.entity || child.slug);
          return slug === 'invoice_items';
        });
        if (invoiceChild) {
          const invoiceFk = invoiceChild.foreign_key || invoiceChild.foreignKey;
          if (!invoiceFk) {
            throw new Error(`SDF Validation Error: Child relation for 'invoice_items' must define a foreign key.`);
          }
          const itemFields = Array.isArray(itemsEntity.fields) ? itemsEntity.fields : [];
          const hasInvoiceFk = itemFields.some((f) => f && f.name === invoiceFk);
          if (!hasInvoiceFk) {
            throw new Error(
              `SDF Validation Error: Entity 'invoice_items' must include foreign key field '${invoiceFk}'.`
            );
          }
        }

        ensureFields(itemsEntity, ['invoice_id', 'description', 'quantity', 'unit_price', 'line_total'], 'invoice_items');
      }
    }

    const hrEnabled = enabledSet.has('hr');
    if (hrEnabled) {
      const employeesEntity = requireEntity('employees', 'employee list');
      const employeesModule = this._normalizeEntityModule(employeesEntity, { hasErpConfig });

      if (employeesModule !== 'hr' && employeesModule !== 'shared') {
        throw new Error(`SDF Validation Error: Entity 'employees' must be in module 'hr' or 'shared'.`);
      }

      const departmentsEntity = allBySlug.get('departments');
      if (departmentsEntity) {
        const departmentsModule = this._normalizeEntityModule(departmentsEntity, { hasErpConfig });
        if (departmentsModule !== 'hr') {
          throw new Error(`SDF Validation Error: Entity 'departments' must be in module 'hr'.`);
        }
      }

      const leaveEntities = ['leaves', 'leave_requests']
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

  async _generateRootFiles(outputDir, projectId) {
    const fs = require('fs').promises;

    // Root docker-compose.yml
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
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const inventoryPriority = {
      stock_entity: priorityCfg.stockEntity,
      reservations: {
        enabled: this._isPackEnabled(priorityCfg.reservations),
        reservation_entity: priorityCfg.reservations.reservation_entity,
        item_field: priorityCfg.reservations.item_field,
        quantity_field: priorityCfg.reservations.quantity_field,
        status_field: priorityCfg.reservations.status_field,
      },
      transactions: {
        enabled: this._isPackEnabled(priorityCfg.transactions),
        quantity_field: priorityCfg.transactions.quantity_field,
      },
      inbound: {
        enabled: this._isPackEnabled(priorityCfg.inbound),
        purchase_order_entity: priorityCfg.inbound.purchase_order_entity,
        purchase_order_item_entity: priorityCfg.inbound.purchase_order_item_entity,
        grn_entity: priorityCfg.inbound.grn_entity,
        grn_item_entity: priorityCfg.inbound.grn_item_entity,
      },
      cycle_counting: {
        enabled: this._isPackEnabled(priorityCfg.cycleCounting),
        session_entity: priorityCfg.cycleCounting.session_entity,
        line_entity: priorityCfg.cycleCounting.line_entity,
      },
    };

    // Generate optional runtime config for the backend entrypoint (scheduler, etc.)
    const systemConfig = {
      modules: {
        inventory_priority_a: inventoryPriority,
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
      systemConfig.modules.inventory_priority_a.cycle_counting.enabled === true;

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
