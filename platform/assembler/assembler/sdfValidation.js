// SDF validation – extracted from ProjectAssembler
const ERP_MODULE_KEYS = ['inventory', 'invoice', 'hr'];

module.exports = {
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
        const explicit = field.reference_entity || field.referenceEntity || (field.reference && field.reference.entity);
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
  },
};
