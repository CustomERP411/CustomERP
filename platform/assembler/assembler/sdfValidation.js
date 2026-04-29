// SDF validation – extracted from ProjectAssembler
const { lintSdfLocalization } = require('./sdfLocalizationLint');
const { parseRelationRule } = require('../../../brick-library/backend-bricks/mixins/relationRuleParser');

const ERP_MODULE_KEYS = ['inventory', 'invoice', 'hr'];

// System entity slugs the AI / SDF authors may reference from `relations[]`
// even when access control is not yet enabled (the assembler injects them
// later when the capability turns on; see Plan B follow-up #5).
const SYSTEM_ENTITY_TARGETS = new Set([
  '__erp_users',
  '__erp_groups',
  '__erp_permissions',
  '__erp_user_groups',
  '__erp_group_permissions',
  '__erp_dashboard_preferences',
  '__audit_logs',
  '__reports',
]);

const RELATION_KINDS = new Set([
  'reference_contract',
  'status_propagation',
  'derived_field',
  'invariant',
  'permission_scope',
]);

const RELATION_SCOPES = new Set([
  'self',
  'department',
  'manager_chain',
  'module',
  'all',
]);

const RELATION_SEVERITIES = new Set(['block', 'warn']);

// Plan G D1/D2 — supported comparator operators on field.visibility_when.
// Mirrors EntityField._VISIBILITY_OPERATORS in the Pydantic schema. The
// frontend's `isFieldVisible` and the server-side `_relInv_conditional_required`
// invariant both interpret the same operator set.
const VISIBILITY_OPERATORS = new Set([
  'equals',
  'not_equals',
  'in',
  'not_in',
  'is_set',
  'is_unset',
]);

// `when` clauses use `modules.<path>.enabled`. Path segments are lowercase
// snake_case identifiers separated by dots. Validation is shape-only here;
// runtime evaluates the toggle.
const WHEN_CLAUSE_RE = /^modules(\.[a-z_][a-z0-9_]*)+\.enabled$/;

function pushWarning(sdf, message) {
  if (!sdf || typeof sdf !== 'object') return;
  if (!Array.isArray(sdf.warnings)) sdf.warnings = [];
  if (!sdf.warnings.includes(message)) sdf.warnings.push(message);
}

module.exports = {
  _validateSdf(sdf, options = {}) {
    if (!sdf || typeof sdf !== 'object') {
      throw new Error('SDF Validation Error: Invalid SDF object.');
    }
    // Localization lint runs FIRST so translation gaps are reported even when
    // structural validation later throws. The lint itself never throws — it
    // returns findings with severity. `block` findings (non-English projects)
    // are converted to a single error after the structural pass below; `warn`
    // findings (English projects) are pushed onto sdf.warnings.
    const localizationLanguage = options.language
      || (sdf && (sdf.language || sdf.locale))
      || 'en';
    const localizationReport = lintSdfLocalization(sdf, {
      language: String(localizationLanguage).toLowerCase(),
    });
    if (localizationReport.findings.length > 0) {
      const sample = localizationReport.findings.slice(0, 5).map((f) => `${f.path} -> ${f.suggestedKey}`).join('; ');
      const summary = `SDF Localization Lint: ${localizationReport.unkeyedCount} unkeyed user-facing string(s) under '${localizationReport.language}' (severity=${localizationReport.severity}). Examples: ${sample}`;
      if (localizationReport.severity === 'warn') {
        pushWarning(sdf, summary);
      } else {
        // Defer the throw so structural validation findings (which are more
        // actionable) surface first. We attach the error to the sdf here and
        // raise it at the end.
        sdf.__pendingLocalizationError = summary;
      }
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
      const siblingFieldNames = new Set(fields.map((f) => f && f.name).filter(Boolean));
      fields.forEach((field) => {
        if (!field) return;

        // Plan G D2 — visibility_when shape + sibling-field cross-check.
        // Pydantic rejects malformed predicates at the field level; this
        // pass additionally verifies the referenced sibling exists on the
        // same entity (Pydantic doesn't have access to peer fields). A
        // missing sibling silently breaks the form, so fail loud here.
        const visibilityWhen = field.visibility_when || field.visibilityWhen;
        if (visibilityWhen !== undefined && visibilityWhen !== null) {
          this._validateVisibilityWhen(visibilityWhen, ent.slug, field.name, siblingFieldNames);
        }

        // Computed-field constraints (Plan A foundation).
        // A server-maintained field cannot be required as user input.
        const isComputed = field.computed === true;
        const isRequired = field.required === true;
        const isUnique = field.unique === true;
        if (isComputed && isRequired) {
          throw new Error(
            `SDF Validation Error: Field '${ent.slug}.${field.name}' has computed=true and required=true; computed (server-maintained) fields cannot be marked required.`
          );
        }
        if (isComputed && isUnique) {
          pushWarning(
            sdf,
            `SDF Validation Warning: Field '${ent.slug}.${field.name}' has computed=true and unique=true; uniqueness on derived values is risky and may produce drift.`
          );
        }

        // Plan F B1 — `default` and `default_from` are mutually exclusive
        // and `default_from` must be a non-empty dot-separated path.
        // Resolution against the SDF modules tree happens at codegen
        // (fieldUtils._resolveConfigPath); SDF-time we only check shape +
        // emit a warning when the path doesn't resolve so dropouts surface.
        const hasDefault = field.default !== undefined && field.default !== null;
        const defaultFrom = field.default_from !== undefined && field.default_from !== null
          ? field.default_from
          : (field.defaultFrom !== undefined && field.defaultFrom !== null ? field.defaultFrom : null);
        if (hasDefault && defaultFrom !== null) {
          throw new Error(
            `SDF Validation Error: Field '${ent.slug}.${field.name}' has both 'default' and 'default_from'; set exactly one.`
          );
        }
        if (defaultFrom !== null) {
          if (typeof defaultFrom !== 'string' || !defaultFrom.trim()) {
            throw new Error(
              `SDF Validation Error: Field '${ent.slug}.${field.name}' has invalid 'default_from'; expected a non-empty dot-path string (e.g. 'modules.invoice.tax_rate').`
            );
          }
          if (!/^modules(\.[A-Za-z_][A-Za-z0-9_]*)+$/.test(defaultFrom.trim())) {
            throw new Error(
              `SDF Validation Error: Field '${ent.slug}.${field.name}' has malformed 'default_from'='${defaultFrom}'; expected 'modules.<module>.<key>[.<subkey>...]'.`
            );
          }
          // Walk the modules tree; warn when the path is unresolved at SDF
          // time. Codegen will fall through gracefully but the user usually
          // wants to know.
          const parts = defaultFrom.trim().split('.').slice(1);
          let cursor = sdf && sdf.modules;
          let resolved = true;
          for (const seg of parts) {
            if (cursor && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, seg)) {
              cursor = cursor[seg];
            } else {
              resolved = false;
              break;
            }
          }
          if (!resolved || cursor === undefined || cursor === null) {
            pushWarning(
              sdf,
              `SDF Validation Warning: Field '${ent.slug}.${field.name}' default_from='${defaultFrom}' did not resolve in the current SDF modules tree; the field will have no default until the path is populated.`
            );
          }
        }

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
                else if (SYSTEM_ENTITY_TARGETS.has(baseName)) targetSlug = baseName;
            }

            // If we found a target, check if it exists in SDF
            // If we didn't find a target but it was explicitly marked as reference, that's an error.
            // If it was just inferred from name (e.g. 'external_id') and not found, we might warn or ignore.
            // For now, strict mode: if explicit or type=reference, it MUST exist.
            if ((field.type === 'reference' || explicit) && !targetSlug) {
                 throw new Error(`SDF Validation Error: Field '${ent.slug}.${field.name}' is a reference but target entity could not be resolved.`);
            }

            // System entity targets (`__erp_users`, etc.) are accepted even if the
            // entity is not yet present in this SDF — the assembler injects them
            // when the access-control capability turns on (Plan B follow-up #5).
            const isSystemTarget = targetSlug && SYSTEM_ENTITY_TARGETS.has(targetSlug);

            if (targetSlug && !entitySlugs.has(targetSlug) && !isSystemTarget) {
                 // Allow referencing system entities that might be added later? 
                 // For now, we only check against user entities + known system ones if added before validation.
                 // But validation happens BEFORE _withSystemEntities.
                 // We should allow standard system entities if we want to be safe, or just fail.
                 // Let's fail for now to catch typos.
                 throw new Error(`SDF Validation Error: Field '${ent.slug}.${field.name}' references non-existent entity '${targetSlug}'.`);
            }

            if (targetSlug && !isSystemTarget) {
              const targetEntity = allBySlug.get(targetSlug);
              const targetModule = this._normalizeEntityModule(targetEntity, { hasErpConfig });
              const sourceModule = this._normalizeEntityModule(ent, { hasErpConfig });
              const targetEnabled = targetModule === 'shared' ? enabledSet.size > 0 : enabledSet.has(targetModule);

              if (!targetEnabled) {
                throw new Error(
                  `SDF Validation Error: Field '${ent.slug}.${field.name}' references entity '${targetSlug}' from disabled module '${targetModule}'.`
                );
              }

              // Enforce module boundary: same module, shared, or shared→enabled module
              if (sourceModule !== targetModule) {
                if (sourceModule !== 'shared' && targetModule !== 'shared') {
                  throw new Error(
                    `SDF Validation Error: Field '${ent.slug}.${field.name}' must reference an entity in the same module or marked shared.`
                  );
                }
              }
            }
        }
      });

      // Coherence-layer relations validation (Plan A foundation).
      this._validateRelations(ent, entitySlugs, allBySlug);

      // Plan H F4 — per-entity rollup overrides shape check. Mirrors
      // Pydantic's Entity._validate_rollups; we additionally soft-warn when
      // a rollup key references an unknown entity slug so AI drift is
      // visible without breaking generation.
      if (ent.rollups !== undefined && ent.rollups !== null) {
        this._validateRollupOverrides(ent, entitySlugs, sdf);
      }

      // Plan UI Sections — validate `entity.ui.sections` cross-references
      // (each `fields[*]` resolves to a real entity field, no field appears
      // twice, each `line_items.child` matches an entry in `children[]`).
      // Mirrors the Pydantic Entity._validate_ui_sections; runs here so
      // prefilled SDFs / uploads that bypass the AI gateway also get
      // checked.
      if (ent.ui && typeof ent.ui === 'object' && ent.ui.sections !== undefined && ent.ui.sections !== null) {
        this._validateUiSections(ent);
      }

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
              if (sourceModule !== 'shared' && childModule !== 'shared') {
                throw new Error(
                  `SDF Validation Error: Child entity '${childSlug}' must be in the same module or marked shared.`
                );
              }
            }
        });
      }
    });

    // Raise deferred localization error after structural validation has
    // surfaced its (more actionable) errors. Only fires for non-English
    // projects per `lintSdfLocalization`.
    if (sdf.__pendingLocalizationError) {
      const message = sdf.__pendingLocalizationError;
      delete sdf.__pendingLocalizationError;
      throw new Error(message);
    }
  },

  // -------------------------------------------------------------------------
  // Coherence-layer relations validation (Plan A foundation).
  //
  // Each entity may declare `relations[]` — entries that express cross-feature
  // rules. SDF-time validation only checks the *shape* of each entry; the
  // *semantics* are interpreted by the runtime mixin layer (Plan B follow-up
  // #2). See SDF_REFERENCE.md "Coherence layer" for the reference.
  //
  // Throws on shape violations. Caller passes `entitySlugs` so we can resolve
  // cross-entity references (e.g. status_propagation.effect.target_entity).
  // -------------------------------------------------------------------------
  _validateRelations(ent, entitySlugs, allBySlug) {
    if (!ent || !Array.isArray(ent.relations)) return;
    if (ent.relations.length === 0) return;
    const slugLookup = allBySlug instanceof Map ? allBySlug : new Map();

    const fieldNames = new Set(
      (Array.isArray(ent.fields) ? ent.fields : [])
        .map((f) => f && f.name)
        .filter(Boolean)
    );
    const fieldByName = new Map(
      (Array.isArray(ent.fields) ? ent.fields : [])
        .filter((f) => f && f.name)
        .map((f) => [f.name, f])
    );

    const slugLabel = ent.slug || '<unknown>';

    ent.relations.forEach((rel, index) => {
      if (!rel || typeof rel !== 'object') {
        throw new Error(
          `SDF Validation Error: Entity '${slugLabel}' relations[${index}] must be an object.`
        );
      }

      const kind = rel.kind;
      if (!RELATION_KINDS.has(kind)) {
        throw new Error(
          `SDF Validation Error: Entity '${slugLabel}' relations[${index}] has unknown kind '${kind}'. Expected one of: ${Array.from(RELATION_KINDS).join(', ')}.`
        );
      }

      // Optional `when` clause: shape `modules.<path>.enabled`.
      if (rel.when !== undefined && rel.when !== null) {
        if (typeof rel.when !== 'string' || !WHEN_CLAUSE_RE.test(rel.when)) {
          throw new Error(
            `SDF Validation Error: Entity '${slugLabel}' relations[${index}].when must match shape 'modules.<path>.enabled'; got '${rel.when}'.`
          );
        }
      }

      switch (kind) {
        case 'reference_contract': {
          if (typeof rel.field !== 'string' || !rel.field) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (reference_contract) requires a non-empty 'field'.`
            );
          }
          if (!fieldNames.has(rel.field)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (reference_contract) field '${rel.field}' does not exist on entity '${slugLabel}'.`
            );
          }
          if (typeof rel.target !== 'string' || !rel.target) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (reference_contract) requires a non-empty 'target'.`
            );
          }
          const isSystemTarget = SYSTEM_ENTITY_TARGETS.has(rel.target);
          if (!isSystemTarget && !entitySlugs.has(rel.target)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (reference_contract) target '${rel.target}' is not a known entity slug.`
            );
          }
          break;
        }

        case 'status_propagation': {
          if (!rel.on || typeof rel.on !== 'object') {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) requires an 'on' object.`
            );
          }
          // 'on.field' defaults to 'status' when omitted; if provided, must exist.
          const triggerField = typeof rel.on.field === 'string' && rel.on.field
            ? rel.on.field
            : 'status';
          if (!fieldNames.has(triggerField)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) on.field '${triggerField}' does not exist on entity '${slugLabel}'.`
            );
          }
          if (!rel.effect || typeof rel.effect !== 'object') {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) requires an 'effect' object.`
            );
          }
          if (typeof rel.effect.action !== 'string' || !rel.effect.action) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) effect.action must be a non-empty string.`
            );
          }
          if (typeof rel.effect.target_entity !== 'string' || !rel.effect.target_entity) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) effect.target_entity must be a non-empty string.`
            );
          }
          const targetEnt = rel.effect.target_entity;
          const isSystemTarget = SYSTEM_ENTITY_TARGETS.has(targetEnt);
          if (!isSystemTarget && !entitySlugs.has(targetEnt)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) effect.target_entity '${targetEnt}' is not a known entity slug.`
            );
          }
          if (rel.reverse !== undefined && rel.reverse !== null) {
            if (typeof rel.reverse !== 'object') {
              throw new Error(
                `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (status_propagation) reverse must be an object when present.`
              );
            }
          }
          // Plan E — Group E (invoice -> stock). When the action parses as
          // `issue_stock(...)`, validate that its child_entity / parent_field
          // / item_field / qty_field args resolve to real fields on a real
          // child entity. Catches AI drift (typo'd field names, wrong
          // child entity slug) at SDF time instead of letting the runtime
          // silently no-op. The reverse_issue_stock action takes no args
          // (it reads its config from rel.effect), so it does not need
          // arg validation here.
          const parsedAction = parseRelationRule(rel.effect.action);
          if (parsedAction && parsedAction.name === 'issue_stock') {
            this._validateIssueStockArgs(parsedAction, slugLabel, index, entitySlugs, slugLookup);
          }
          break;
        }

        case 'derived_field': {
          if (typeof rel.computed_field !== 'string' || !rel.computed_field) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (derived_field) requires a non-empty 'computed_field'.`
            );
          }
          if (!fieldNames.has(rel.computed_field)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (derived_field) computed_field '${rel.computed_field}' does not exist on entity '${slugLabel}'.`
            );
          }
          const targetField = fieldByName.get(rel.computed_field);
          if (!targetField || targetField.computed !== true) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (derived_field) computed_field '${rel.computed_field}' must have computed=true.`
            );
          }
          if (typeof rel.formula !== 'string' || !rel.formula.trim()) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (derived_field) requires a non-empty 'formula'.`
            );
          }
          break;
        }

        case 'invariant': {
          if (typeof rel.rule !== 'string' || !rel.rule.trim()) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (invariant) requires a non-empty 'rule'.`
            );
          }
          if (rel.severity !== undefined && rel.severity !== null) {
            if (!RELATION_SEVERITIES.has(rel.severity)) {
              throw new Error(
                `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (invariant) severity must be 'block' or 'warn'; got '${rel.severity}'.`
              );
            }
          }
          // Plan G D6 — `conditional_required` ships with the runtime
          // mirror of visibility_when. Validate its args here so SDF
          // authors get a precise message instead of a silent runtime
          // no-op when keys are typoed. Other invariant names continue to
          // pass with only the non-empty-rule check.
          const parsed = parseRelationRule(rel.rule);
          if (parsed && parsed.name === 'conditional_required') {
            this._validateConditionalRequired(parsed, slugLabel, index, fieldNames);
          }
          break;
        }

        case 'permission_scope': {
          if (typeof rel.permission !== 'string' || !rel.permission) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (permission_scope) requires a non-empty 'permission'.`
            );
          }
          if (!RELATION_SCOPES.has(rel.scope)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (permission_scope) scope must be one of: ${Array.from(RELATION_SCOPES).join(', ')}; got '${rel.scope}'.`
            );
          }
          if (rel.actions !== undefined && rel.actions !== null) {
            if (!Array.isArray(rel.actions)) {
              throw new Error(
                `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (permission_scope) actions must be an array of strings.`
              );
            }
            for (const action of rel.actions) {
              if (typeof action !== 'string' || !action) {
                throw new Error(
                  `SDF Validation Error: Entity '${slugLabel}' relations[${index}] (permission_scope) actions[*] must be non-empty strings.`
                );
              }
            }
          }
          break;
        }

        // RELATION_KINDS gate above prevents reaching here, but keep the
        // exhaustiveness explicit for future maintainers.
        /* istanbul ignore next */
        default: {
          throw new Error(
            `SDF Validation Error: Entity '${slugLabel}' relations[${index}] kind '${kind}' is not handled.`
          );
        }
      }
    });
  },

  // -------------------------------------------------------------------------
  // Plan G D2 — visibility_when shape + sibling-field validation.
  //
  // Pydantic enforces the shape rules at the field level (D1); this pass
  // mirrors those checks AND adds the cross-field check ("does the sibling
  // referenced by visibility_when.field actually exist on the entity?")
  // because the field-level Pydantic validator has no peer context.
  //
  // Throws an SDF Validation Error on any shape violation. Caller passes
  // `siblingFieldNames` (a Set) collected from the entity's fields[].
  // -------------------------------------------------------------------------
  _validateVisibilityWhen(predicate, entitySlug, fieldName, siblingFieldNames) {
    const path = `Field '${entitySlug}.${fieldName}' visibility_when`;
    if (!predicate || typeof predicate !== 'object' || Array.isArray(predicate)) {
      throw new Error(`SDF Validation Error: ${path} must be an object.`);
    }
    const sourceField = predicate.field;
    if (typeof sourceField !== 'string' || !sourceField.trim()) {
      throw new Error(
        `SDF Validation Error: ${path} must contain a non-empty string 'field' naming the sibling to compare.`
      );
    }
    const comparators = Object.keys(predicate).filter((k) => k !== 'field');
    if (comparators.length === 0) {
      throw new Error(
        `SDF Validation Error: ${path} must contain exactly one comparator key (equals, not_equals, in, not_in, is_set, is_unset).`
      );
    }
    if (comparators.length > 1) {
      throw new Error(
        `SDF Validation Error: ${path} has multiple comparators (${comparators.join(', ')}); use exactly one.`
      );
    }
    const comparator = comparators[0];
    if (!VISIBILITY_OPERATORS.has(comparator)) {
      throw new Error(
        `SDF Validation Error: ${path} uses unknown comparator '${comparator}'; supported: ${Array.from(VISIBILITY_OPERATORS).join(', ')}.`
      );
    }
    const value = predicate[comparator];
    if (comparator === 'equals' || comparator === 'not_equals') {
      if (value === null || value === undefined || Array.isArray(value) || typeof value === 'object') {
        throw new Error(
          `SDF Validation Error: ${path} '${comparator}' value must be a scalar (string, number, or boolean).`
        );
      }
    } else if (comparator === 'in' || comparator === 'not_in') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(
          `SDF Validation Error: ${path} '${comparator}' value must be a non-empty list.`
        );
      }
    } else if (comparator === 'is_set' || comparator === 'is_unset') {
      if (typeof value !== 'boolean') {
        throw new Error(
          `SDF Validation Error: ${path} '${comparator}' value must be a boolean.`
        );
      }
    }
    // Cross-entity sibling check — fail loud if the predicate references a
    // field that doesn't exist on the same entity. Without this guard the
    // generated form silently treats the predicate as never-satisfied,
    // producing always-hidden inputs.
    if (siblingFieldNames && !siblingFieldNames.has(sourceField)) {
      throw new Error(
        `SDF Validation Error: ${path}.field references sibling '${sourceField}' which does not exist on entity '${entitySlug}'.`
      );
    }
  },

  // -------------------------------------------------------------------------
  // Plan G D6 — `conditional_required(field=X, when_field=Y, when_<op>=Z)`
  // shape validation. Mirrors the operator set + value-type rules used by
  // visibility_when (D1/D2) so the form predicate and the API guard agree.
  //
  // Throws on shape violations (missing field, missing when_field, no /
  // multiple comparators, malformed value, references-to-missing-fields).
  // Caller passes the parsed rule (`{ name, args, positional }`) and the
  // entity's field-name set so we can verify both the gated and the
  // gate-source fields exist.
  // -------------------------------------------------------------------------
  _validateConditionalRequired(parsed, entitySlug, relIndex, fieldNames) {
    const path = `Entity '${entitySlug}' relations[${relIndex}] (invariant: conditional_required)`;
    const args = parsed.args || {};
    const requiredField = args.field;
    if (typeof requiredField !== 'string' || !requiredField.trim()) {
      throw new Error(`SDF Validation Error: ${path} requires a non-empty 'field' arg naming the required column.`);
    }
    if (fieldNames && !fieldNames.has(requiredField)) {
      throw new Error(`SDF Validation Error: ${path} field '${requiredField}' does not exist on entity '${entitySlug}'.`);
    }
    const sourceField = args.when_field;
    if (typeof sourceField !== 'string' || !sourceField.trim()) {
      throw new Error(`SDF Validation Error: ${path} requires a non-empty 'when_field' arg naming the gate field.`);
    }
    if (fieldNames && !fieldNames.has(sourceField)) {
      throw new Error(`SDF Validation Error: ${path} when_field '${sourceField}' does not exist on entity '${entitySlug}'.`);
    }
    const comparatorKeys = ['when_equals', 'when_not_equals', 'when_in', 'when_not_in', 'when_is_set', 'when_is_unset'];
    const present = comparatorKeys.filter((k) => Object.prototype.hasOwnProperty.call(args, k));
    if (present.length === 0) {
      throw new Error(
        `SDF Validation Error: ${path} requires exactly one comparator arg (when_equals, when_not_equals, when_in, when_not_in, when_is_set, when_is_unset).`
      );
    }
    if (present.length > 1) {
      throw new Error(
        `SDF Validation Error: ${path} has multiple comparators (${present.join(', ')}); use exactly one.`
      );
    }
    const comparator = present[0];
    const value = args[comparator];
    if (comparator === 'when_in' || comparator === 'when_not_in') {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error(`SDF Validation Error: ${path} '${comparator}' value must be a non-empty list (e.g. [Pending, Approved]).`);
      }
    } else if (comparator === 'when_is_set' || comparator === 'when_is_unset') {
      const lowered = String(value).toLowerCase();
      if (lowered !== 'true' && lowered !== 'false') {
        throw new Error(`SDF Validation Error: ${path} '${comparator}' value must be 'true' or 'false'.`);
      }
    } else {
      // when_equals / when_not_equals: scalar string. The DSL parser only
      // emits strings or arrays; reject arrays here.
      if (Array.isArray(value)) {
        throw new Error(`SDF Validation Error: ${path} '${comparator}' value must be a scalar (use when_in for lists).`);
      }
      if (value === undefined || value === null || String(value).trim() === '') {
        throw new Error(`SDF Validation Error: ${path} '${comparator}' value must be non-empty.`);
      }
    }
  },

  // -------------------------------------------------------------------------
  // Plan E — `issue_stock(...)` arg-shape validation.
  //
  // The runtime _relAct_issue_stock fans out per child line of the source
  // row (typically `invoice_items` of an `invoices` row), reads the FK
  // / qty / location field names from the action args, and creates
  // stock_movements + atomic stock adjustments. Drift in any of those
  // arg names silently produces a no-op at runtime, which is the worst
  // failure mode (no error, no stock movement). Validate at SDF time so
  // the regression is loud.
  //
  // Required args: `child_entity`, `parent_field`, `item_field`,
  //                `qty_field`. `location_field` and `stock_entity` are
  // optional (the runtime defaults them).
  //
  // Checks: child_entity exists, parent_field/item_field/qty_field/
  // location_field (when set) exist on the child entity, stock_entity
  // (when set) exists.
  // -------------------------------------------------------------------------
  _validateIssueStockArgs(parsedAction, entitySlug, relIndex, entitySlugs, allBySlug) {
    const path = `Entity '${entitySlug}' relations[${relIndex}] (status_propagation: issue_stock)`;
    const args = (parsedAction && parsedAction.args) || {};
    const requiredArgs = ['child_entity', 'parent_field', 'item_field', 'qty_field'];
    for (const argName of requiredArgs) {
      const v = args[argName];
      if (typeof v !== 'string' || !v.trim()) {
        throw new Error(`SDF Validation Error: ${path} requires a non-empty '${argName}' arg.`);
      }
    }
    const childSlug = args.child_entity;
    const knownSlugs = entitySlugs instanceof Set ? entitySlugs : new Set(entitySlugs || []);
    if (!knownSlugs.has(childSlug)) {
      throw new Error(
        `SDF Validation Error: ${path} child_entity '${childSlug}' is not a known entity slug.`
      );
    }
    const childEntity = (allBySlug instanceof Map) ? allBySlug.get(childSlug) : null;
    const childFieldNames = childEntity && Array.isArray(childEntity.fields)
      ? new Set(childEntity.fields.map((f) => f && f.name).filter(Boolean))
      : null;
    if (childFieldNames) {
      const fieldArgs = ['parent_field', 'item_field', 'qty_field'];
      for (const argName of fieldArgs) {
        const fieldName = args[argName];
        if (!childFieldNames.has(fieldName)) {
          throw new Error(
            `SDF Validation Error: ${path} ${argName} '${fieldName}' does not exist on child entity '${childSlug}'.`
          );
        }
      }
      if (typeof args.location_field === 'string' && args.location_field.trim()) {
        if (!childFieldNames.has(args.location_field)) {
          throw new Error(
            `SDF Validation Error: ${path} location_field '${args.location_field}' does not exist on child entity '${childSlug}'.`
          );
        }
      }
    }
    if (typeof args.stock_entity === 'string' && args.stock_entity.trim()) {
      if (!knownSlugs.has(args.stock_entity)) {
        throw new Error(
          `SDF Validation Error: ${path} stock_entity '${args.stock_entity}' is not a known entity slug.`
        );
      }
    }
  },

  // -------------------------------------------------------------------------
  // Plan H F4 — `entity.rollups` shape validation. Mirrors the Pydantic
  // model_validator on Entity._validate_rollups but additionally soft-warns
  // when an override key isn't a known entity slug (the AI may emit them
  // speculatively for unenabled modules; we don't want to block generation
  // on speculative drift, but we DO want it visible in `sdf.warnings`).
  //
  // Throws on:
  //   - non-mapping value
  //   - non-string / empty key
  //   - value that is `true`
  //   - value that is neither `false` nor an object
  //   - object with unknown keys (allowed: label, columns, foreign_key)
  //   - object with malformed value types
  //
  // Soft-warns (sdf.warnings) on:
  //   - key that is a valid string but doesn't match any known entity slug
  // -------------------------------------------------------------------------
  _validateRollupOverrides(entity, entitySlugs, sdf) {
    const slugLabel = entity && entity.slug ? entity.slug : '<unknown>';
    const rollups = entity && entity.rollups;
    if (rollups === undefined || rollups === null) return;
    if (typeof rollups !== 'object' || Array.isArray(rollups)) {
      throw new Error(
        `SDF Validation Error: Entity '${slugLabel}' rollups must be an object keyed by source-entity slug.`
      );
    }
    const allowedKeys = new Set(['label', 'columns', 'foreign_key']);
    const knownSlugs = entitySlugs instanceof Set ? entitySlugs : new Set(entitySlugs || []);
    for (const [rawKey, rawValue] of Object.entries(rollups)) {
      if (typeof rawKey !== 'string' || !rawKey.trim()) {
        throw new Error(
          `SDF Validation Error: Entity '${slugLabel}' rollups keys must be non-empty strings.`
        );
      }
      if (!knownSlugs.has(rawKey)) {
        pushWarning(
          sdf,
          `SDF Validation Warning: Entity '${slugLabel}' rollups['${rawKey}'] references an unknown entity slug; the override will be ignored at codegen.`
        );
      }
      if (rawValue === false) continue;
      if (rawValue === true) {
        throw new Error(
          `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'] must be false to suppress or an object; true is not a valid value.`
        );
      }
      if (rawValue === null || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
        throw new Error(
          `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'] must be false or an object.`
        );
      }
      const extras = Object.keys(rawValue).filter((k) => !allowedKeys.has(k));
      if (extras.length) {
        throw new Error(
          `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'] has unsupported keys [${extras.sort().join(', ')}]; allowed keys are [columns, foreign_key, label].`
        );
      }
      if (Object.prototype.hasOwnProperty.call(rawValue, 'label')) {
        const lbl = rawValue.label;
        if (typeof lbl !== 'string' || !lbl.trim()) {
          throw new Error(
            `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'].label must be a non-empty string.`
          );
        }
      }
      if (Object.prototype.hasOwnProperty.call(rawValue, 'foreign_key')) {
        const fk = rawValue.foreign_key;
        if (typeof fk !== 'string' || !fk.trim()) {
          throw new Error(
            `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'].foreign_key must be a non-empty string.`
          );
        }
      }
      if (Object.prototype.hasOwnProperty.call(rawValue, 'columns')) {
        const cols = rawValue.columns;
        if (!Array.isArray(cols) || cols.length === 0) {
          throw new Error(
            `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'].columns must be a non-empty list of strings.`
          );
        }
        for (const c of cols) {
          if (typeof c !== 'string' || !c.trim()) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' rollups['${rawKey}'].columns entries must be non-empty strings.`
            );
          }
        }
      }
    }
  },

  // -------------------------------------------------------------------------
  // UI Sections — `entity.ui.sections` shape + cross-reference validation.
  //
  // Mirrors the Pydantic Entity._validate_ui_sections. Pydantic guards SDFs
  // produced by the AI gateway; this pass guards prefilled SDFs and direct
  // uploads. Both layers must agree on the rejection rules.
  //
  // Section kinds (discriminated by `kind`):
  //   - fields:             { id?, kind, heading?, fields: [string, ...] }
  //   - line_items:         { id?, kind, child: string, heading? }
  //   - rollups:            { id?, kind }
  //   - totals:             { id?, kind }
  //   - stock_availability: { id?, kind }
  //   - companion_user:     { id?, kind }
  //
  // Rules:
  //   - `fields[*]` entries must resolve to a real entity field name.
  //   - No field may appear in more than one `fields` section.
  //   - Each `line_items.child` must match an entry in `entity.children[]`.
  //   - When `heading` is present, it must be a dot-keyed i18n key
  //     (lowercase identifiers separated by dots) so non-EN projects don't
  //     leak raw English; the localization lint pins this end-to-end.
  // -------------------------------------------------------------------------
  _validateUiSections(entity) {
    const slugLabel = entity && entity.slug ? entity.slug : '<unknown>';
    const ui = entity && entity.ui;
    if (!ui || typeof ui !== 'object' || Array.isArray(ui)) return;
    const sections = ui.sections;
    if (sections === undefined || sections === null) return;
    if (!Array.isArray(sections)) {
      throw new Error(
        `SDF Validation Error: Entity '${slugLabel}' ui.sections must be a list when present.`
      );
    }

    const KNOWN_KINDS = new Set([
      'fields',
      'line_items',
      'rollups',
      'totals',
      'stock_availability',
      'companion_user',
    ]);
    // Case-insensitive to match dictionary keys like `form.sections.lineItems`,
    // identical to the regex in sdfLocalizationLint.
    const HEADING_DOT_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
    const fieldNames = new Set(
      (Array.isArray(entity.fields) ? entity.fields : [])
        .map((f) => f && f.name)
        .filter(Boolean)
    );
    const childSlugs = new Set();
    if (Array.isArray(entity.children)) {
      for (const ch of entity.children) {
        if (!ch || typeof ch !== 'object') continue;
        const slug = ch.entity || ch.slug;
        if (typeof slug === 'string' && slug.trim()) childSlugs.add(slug.trim());
      }
    }

    const seenFields = new Map();
    sections.forEach((section, idx) => {
      const path = `Entity '${slugLabel}' ui.sections[${idx}]`;
      if (!section || typeof section !== 'object' || Array.isArray(section)) {
        throw new Error(`SDF Validation Error: ${path} must be an object.`);
      }
      const kind = section.kind;
      if (typeof kind !== 'string' || !kind.trim()) {
        throw new Error(
          `SDF Validation Error: ${path} must have a string 'kind' (one of: ${Array.from(KNOWN_KINDS).sort().join(', ')}).`
        );
      }
      if (!KNOWN_KINDS.has(kind)) {
        throw new Error(
          `SDF Validation Error: ${path} has unknown kind '${kind}'. Expected one of: ${Array.from(KNOWN_KINDS).sort().join(', ')}.`
        );
      }
      if (Object.prototype.hasOwnProperty.call(section, 'id')) {
        const id = section.id;
        if (id !== null && id !== undefined && (typeof id !== 'string' || !id.trim())) {
          throw new Error(
            `SDF Validation Error: ${path}.id must be a non-empty string when present.`
          );
        }
      }

      if (kind === 'fields') {
        const fields = section.fields;
        if (!Array.isArray(fields) || fields.length === 0) {
          throw new Error(
            `SDF Validation Error: ${path} (fields) must list at least one field.`
          );
        }
        for (const fname of fields) {
          if (typeof fname !== 'string' || !fname.trim()) {
            throw new Error(
              `SDF Validation Error: ${path}.fields entries must be non-empty strings.`
            );
          }
          if (!fieldNames.has(fname)) {
            throw new Error(
              `SDF Validation Error: ${path} references field '${fname}' that is not declared on entity '${slugLabel}'.`
            );
          }
          if (seenFields.has(fname)) {
            throw new Error(
              `SDF Validation Error: Entity '${slugLabel}' field '${fname}' appears in ui.sections[${seenFields.get(fname)}] and ui.sections[${idx}]; each field can be placed in at most one section.`
            );
          }
          seenFields.set(fname, idx);
        }
        if (Object.prototype.hasOwnProperty.call(section, 'heading')) {
          const heading = section.heading;
          if (heading !== null && heading !== undefined) {
            if (typeof heading !== 'string' || !heading.trim()) {
              throw new Error(
                `SDF Validation Error: ${path}.heading must be a non-empty string when present.`
              );
            }
            if (!HEADING_DOT_KEY_RE.test(heading)) {
              throw new Error(
                `SDF Validation Error: ${path}.heading must be an i18n dot-key (e.g. 'form.sections.identity'); got '${heading}'.`
              );
            }
          }
        }
      } else if (kind === 'line_items') {
        const child = section.child;
        if (typeof child !== 'string' || !child.trim()) {
          throw new Error(
            `SDF Validation Error: ${path} (line_items) requires a non-empty 'child' slug.`
          );
        }
        if (!childSlugs.has(child)) {
          throw new Error(
            `SDF Validation Error: ${path} references child '${child}' but no entry in entity '${slugLabel}'.children[] declares that slug.`
          );
        }
        if (Object.prototype.hasOwnProperty.call(section, 'heading')) {
          const heading = section.heading;
          if (heading !== null && heading !== undefined) {
            if (typeof heading !== 'string' || !heading.trim()) {
              throw new Error(
                `SDF Validation Error: ${path}.heading must be a non-empty string when present.`
              );
            }
            if (!HEADING_DOT_KEY_RE.test(heading)) {
              throw new Error(
                `SDF Validation Error: ${path}.heading must be an i18n dot-key; got '${heading}'.`
              );
            }
          }
        }
      }
      // 'rollups' / 'totals' / 'stock_availability' / 'companion_user' are
      // marker kinds with no extra payload; nothing else to check.
    });
  },
};
