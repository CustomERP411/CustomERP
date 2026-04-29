// Entity page generation (split from FrontendGenerator)
const fs = require('fs').promises;
const path = require('path');
const { buildInvoiceListPage } = require('./invoicePages');
const {
  buildEmployeeListPage,
  buildDepartmentListPage,
  buildLeaveListPage,
} = require('./hrPages');
const {
  buildEntityListPage,
  buildEntityFormPage,
  buildEntityImportPage,
  buildReceivePage,
  buildIssuePage,
  buildAdjustPage,
  buildTransferPage,
  buildLabelsPage,
} = require('./entityPages');
const { buildReservationsPage, buildGrnPostingPage, buildCycleWorkflowPage } = require('./inventoryPriorityPages');
const { buildInvoiceWorkflowPage, buildInvoicePaymentsPage, buildInvoiceNotesPage, buildPaymentWorkflowPage, buildNoteWorkflowPage } = require('./invoicePriorityPages');
const { buildLeaveApprovalsPage, buildLeaveBalancesPage, buildAttendanceEntriesPage } = require('./hrPriorityPages');
const { tFor } = require('../../i18n/labels');
const { pickTrEntityDisplayName } = require('../../i18n/glossaryI18n');
const { listAllActorSpecs } = require('../../assembler/actorRegistry');

module.exports = {
  async generateEntityPage(outputDir, entity, allEntities, sdf = {}) {
    const moduleKey = this._getModuleKey(entity);
    entity = { ...entity, display_name: this._localizedEntityDisplayName(entity) };
    await this._ensureModuleDirs(outputDir, moduleKey);
    const modulePagesDir = path.join(outputDir, 'modules', moduleKey, 'pages');
    const importBase = '../../../src';
    const invoicePriorityCfg = this._getInvoicePriorityAConfig(sdf);
    const hrPriorityCfg = this._getHRPriorityAConfig(sdf);
    const isInvoiceEntity =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
    const rawInvoiceConfig = sdf && sdf.modules ? sdf.modules.invoice : null;
    const invoiceConfig = rawInvoiceConfig && typeof rawInvoiceConfig === 'object' ? rawInvoiceConfig : {};
    const enablePrintInvoice =
      isInvoiceEntity &&
      ((entity.features && (entity.features.print_invoice === true || entity.features.printInvoice === true)) || false);

    // HR entity detection
    const isHrModule = moduleKey === 'hr';
    const entitySlug = String(entity.slug || '');
    const isEmployeeEntity = isHrModule && entitySlug === 'employees';
    const isDepartmentEntity = isHrModule && entitySlug === 'departments';
    const isLeaveEntity = isHrModule && (entitySlug === 'leaves' || entitySlug === 'leave_requests');
    const rawHrConfig = sdf && sdf.modules ? sdf.modules.hr : null;
    const hrConfig = rawHrConfig && typeof rawHrConfig === 'object' ? rawHrConfig : {};
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const transactionsEnabled = this._isPackEnabled(priorityCfg.transactions);
    const reservationsEnabled = this._isPackEnabled(priorityCfg.reservations);
    const inboundEnabled = this._isPackEnabled(priorityCfg.inbound);
    const cycleEnabled = this._isPackEnabled(priorityCfg.cycleCounting);
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);
    const hrLeaveEngineEnabled = this._isPackEnabled(hrPriorityCfg.leaveEngine);
    const hrLeaveApprovalsEnabled = this._isPackEnabled(hrPriorityCfg.leaveApprovals);
    const hrAttendanceEnabled = this._isPackEnabled(hrPriorityCfg.attendanceTime);

    const entityName = this._capitalize(entity.slug);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    const t = tFor(this._language || 'en');

    const fieldDefs = this._generateFieldDefinitions(fields, entity.features || {}, allEntities, sdf);

    // Plan F A6 — extract derived-field relations for this entity so the
    // form can echo computed columns (subtotal, tax_total, leave_days, ...)
    // live as the user types. Server is still authoritative on persist.
    const derivedRelations = Array.isArray(entity.relations)
      ? entity.relations
          .filter((r) => r && r.kind === 'derived_field' && r.computed_field && r.formula)
          .map((r) => ({ computed_field: String(r.computed_field), formula: String(r.formula) }))
      : [];

    const ui = entity.ui || {};
    const enableSearch = ui.search !== false;
    const enableCsvImport = ui.csv_import !== false;
    const enableCsvExport = ui.csv_export !== false;
    const enablePrint = ui.print !== false;

    // Tier 2 optional features (per-entity)
    const bulk = entity.bulk_actions || entity.bulkActions || {};
    const enableBulkActions = bulk.enabled === true;
    const enableBulkDelete = enableBulkActions && bulk.delete !== false;
    const bulkUpdateFields = Array.isArray(bulk.update_fields) ? bulk.update_fields : [];
    const enableBulkUpdate = enableBulkActions && bulkUpdateFields.length > 0;

    const inv = entity.inventory_ops || entity.inventoryOps || {};
    const enableInventoryOps = this._isInventoryOpsEnabled(inv);
    const enableReceive = enableInventoryOps && (inv.receive?.enabled !== false);
    const enableAdjust = enableInventoryOps && (inv.adjust?.enabled !== false);
    const issueCfg = inv.issue || inv.sell || inv.issue_stock || inv.issueStock || {};
    const enableIssue = enableInventoryOps && issueCfg.enabled === true;
    const issueLabel =
      issueCfg.label ||
      issueCfg.display_name ||
      issueCfg.displayName ||
      issueCfg.name ||
      t('inventoryOps.issue.sell');
    const quickCfg = inv.quick_actions || inv.quickActions || {};
    const quickAll = quickCfg === true;
    const enableQuickReceive =
      enableReceive &&
      (quickAll ||
        quickCfg.receive === true ||
        quickCfg.add === true ||
        quickCfg.in === true);
    const enableQuickIssue =
      enableIssue &&
      (quickAll ||
        quickCfg.issue === true ||
        quickCfg.sell === true ||
        quickCfg.out === true);
    const canTransfer =
      enableInventoryOps &&
      (inv.transfer?.enabled === true ||
        (inv.transfer?.enabled !== false &&
          ((entity.features && entity.features.multi_location) ||
            (fields.some((f) => f && String(f.name || '').includes('location'))))));

    const labels = entity.labels || {};
    const enableQrLabels = labels.enabled === true && labels.type === 'qrcode';

    // Detect mixin capabilities for UI support
    const mixinConfig = entity.mixins || {};
    const hasReservationMixin = fields.some((f) => 
      f && (f.name === 'reserved_quantity' || f.name === 'committed_quantity' || f.name === 'available_quantity')
    );
    const hasReservationFields = hasReservationMixin || (mixinConfig.inventory_reservation || mixinConfig.inventoryReservation);

    const hasStatusField = fields.some((f) => f && f.name === 'status');
    let statusTransitions = null;
    if (hasStatusField) {
      // Check for lifecycle mixin config
      const invLifecycle = mixinConfig.inventory_lifecycle || mixinConfig.inventoryLifecycle;
      const invoiceLifecycle = mixinConfig.invoice_lifecycle || mixinConfig.invoiceLifecycle;
      const hrEmployeeStatus = mixinConfig.hr_employee_status || mixinConfig.hrEmployeeStatus;
      const hrLeaveApproval = mixinConfig.hr_leave_approval || mixinConfig.hrLeaveApproval;

      if (invLifecycle && invLifecycle.transitions) {
        statusTransitions = invLifecycle.transitions;
      } else if (invLifecycle && invLifecycle.use_default_transitions) {
        statusTransitions = {
          Draft: ['Active', 'Obsolete'],
          Active: ['Obsolete'],
          Obsolete: [],
        };
      } else if (invoiceLifecycle) {
        const custom = invoiceLifecycle.transitions;
        statusTransitions = custom || {
          Draft: ['Sent', 'Cancelled'],
          Sent: ['Paid', 'Overdue', 'Cancelled'],
          Overdue: ['Paid', 'Cancelled'],
          Paid: [],
          Cancelled: [],
        };
      } else if (hrEmployeeStatus) {
        const custom = hrEmployeeStatus.transitions;
        statusTransitions = custom || {
          Active: ['On Leave', 'Terminated'],
          'On Leave': ['Active', 'Terminated'],
          Terminated: [],
        };
      } else if (hrLeaveApproval) {
        const custom = hrLeaveApproval.transitions;
        statusTransitions = custom || {
          Pending: ['Approved', 'Rejected'],
          Approved: [],
          Rejected: [],
        };
      }
    }

    // Check for approval workflow (HR leave requests)
    const isLeaveApprovalEntity = isLeaveEntity && hasStatusField;
    const approvalConfig = isLeaveApprovalEntity ? { statusField: 'status', actions: ['approve', 'reject'] } : null;

    const configuredColumns = Array.isArray(entity.list && entity.list.columns) ? entity.list.columns : null;
    const defaultColumns = fields.filter((f) => f && f.name !== 'id').slice(0, 5).map((f) => f.name);
    const finalColumns = (configuredColumns && configuredColumns.length ? configuredColumns : defaultColumns).filter((c) => c && c !== 'id');

    const tableColumns = finalColumns
      .map((colName) => {
        const defField = fields.find((f) => f && f.name === colName);
        const label = this._resolveColumnLabel(colName, defField, allEntities);
        return `    { key: '${colName}', label: '${label}' },`;
      })
      .join('\n');

    const listPageContent = isInvoiceEntity
      ? buildInvoiceListPage({
          entity,
          entityName,
          importBase,
          invoiceConfig,
          invoicePriorityCfg,
          enableCsvImport,
          enableCsvExport,
          fieldDefs,
          title: this._escapeJsString(entity.display_name || entityName),
          language: this._language,
          allEntities,
        })
      : isEmployeeEntity
      ? buildEmployeeListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
          enableCsvImport,
          enableCsvExport,
          fieldDefs,
          title: this._escapeJsString(entity.display_name || entityName),
          language: this._language,
        })
      : isDepartmentEntity
      ? buildDepartmentListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
          enableCsvImport,
          enableCsvExport,
          fieldDefs,
          title: this._escapeJsString(entity.display_name || entityName),
          language: this._language,
        })
      : isLeaveEntity
      ? buildLeaveListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
          language: this._language,
          enableCsvImport,
          enableCsvExport,
          fieldDefs,
          title: this._escapeJsString(entity.display_name || entityName),
        })
      : buildEntityListPage({
          entity,
          entityName,
          fieldDefs,
          tableColumns,
          enableSearch,
          enableCsvImport,
          enableCsvExport,
          enablePrint,
          enableReceive,
          enableQuickReceive,
          enableIssue,
          enableQuickIssue,
          issueLabel,
          enableAdjust,
          canTransfer,
          enableQrLabels,
          enableBulkActions,
          enableBulkDelete,
          enableBulkUpdate,
          bulkUpdateFields,
          escapeJsString: (s) => this._escapeJsString(s),
          importBase,
          hasReservationFields,
          hasStatusField,
          language: this._language,
        });

    // Optional embedded children/line-items sections (generic)
    const childSections = [];
    if (Array.isArray(entity.children) && entity.children.length) {
      for (const ch of entity.children) {
        if (!ch || typeof ch !== 'object') continue;
        const childSlug = String(ch.entity || ch.slug || '').trim();
        const foreignKey = String(ch.foreign_key || ch.foreignKey || '').trim();
        if (!childSlug || !foreignKey) continue;

        const childEntity = (allEntities || []).find((e) => e && String(e.slug) === childSlug);
        if (!childEntity) continue;

        const childFields = Array.isArray(childEntity.fields) ? childEntity.fields : [];
        const rawCols = Array.isArray(ch.columns) ? ch.columns : (Array.isArray(childEntity.list && childEntity.list.columns) ? childEntity.list.columns : null);
        const fallbackCols = childFields.filter((f) => f && f.name !== 'id' && f.name !== foreignKey).slice(0, 4).map((f) => f.name);
        const cols = (rawCols && rawCols.length ? rawCols : fallbackCols)
          .map(String)
          .filter((c) => c && c !== 'id');

        const columnDefs = cols.map((colName) => {
          const defField = childFields.find((f) => f && f.name === colName);
          const label = this._resolveColumnLabel(colName, defField, allEntities);
          const rawOptions = defField ? (defField.options ?? defField.enum ?? defField.allowed_values ?? defField.allowedValues) : null;
          const options = Array.isArray(rawOptions) ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean) : null;
          const isReference = defField && (defField.type === 'reference' || String(defField.name || '').endsWith('_id') || String(defField.name || '').endsWith('_ids'));
          let referenceEntity = null;
          if (isReference) {
            const explicitRef = defField.reference_entity || defField.referenceEntity;
            const inferredBase = String(defField.name).replace(/_ids?$/, '');
            const baseName = String(explicitRef || inferredBase);
            const targetEntity = (allEntities || []).find((e) =>
              e.slug === baseName ||
              e.slug === baseName + 's' ||
              e.slug === baseName + 'es' ||
              (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
              e.slug.startsWith(baseName)
            );
            referenceEntity = targetEntity ? targetEntity.slug : (explicitRef ? String(explicitRef) : null);
          }
          const multiple = defField && (defField.multiple === true || defField.is_array === true || String(defField.name || '').endsWith('_ids'));
          return {
            key: colName,
            label,
            referenceEntity,
            multiple,
          };
        });

        // DynamicForm field defs for child create/edit in modal (exclude FK; we'll enforce it in submit)
        const childFormFields = this._generateFieldDefinitions(
          childFields.filter((f) => f && f.name !== foreignKey),
          childEntity.features || {},
          allEntities,
          sdf
        );

        const childSectionLabel = (() => {
          if (ch.label) return String(ch.label);
          if (this._language === 'tr') {
            const picked = pickTrEntityDisplayName(childSlug, childEntity.display_name);
            if (picked) return picked;
          }
          return String(childEntity.display_name || this._formatLabel(childSlug));
        })();

        // Plan F A6 — extract derived-field relations from the child entity
        // so the row's create/edit modal can echo line_total etc. live as
        // the user types. Server is still authoritative on persist.
        const childDerivedRelations = Array.isArray(childEntity.relations)
          ? childEntity.relations
              .filter((r) => r && r.kind === 'derived_field' && r.computed_field && r.formula)
              .map((r) => ({ computed_field: String(r.computed_field), formula: String(r.formula) }))
          : [];

        childSections.push({
          childSlug,
          foreignKey,
          label: childSectionLabel,
          columns: columnDefs,
          formFields: childFormFields,
          derivedRelations: childDerivedRelations,
        });
      }
    }

    const availabilityLabels = hasReservationFields
      ? {
          title: this._t('stockAvailability.title'),
          onHand: this._t('stockAvailability.onHand'),
          reserved: this._t('stockAvailability.reserved'),
          committed: this._t('stockAvailability.committed'),
          available: this._t('stockAvailability.available'),
          reservedTooltip: this._t('stockAvailability.reservedTooltip'),
          committedTooltip: this._t('stockAvailability.committedTooltip'),
          infoIconAria: this._t('stockAvailability.infoIconAria'),
        }
      : null;

    const companionUserConfig =
      isEmployeeEntity && this._accessControlEnabled
        ? {
            labels: {
              title: this._t('companionUser.title'),
              createLogin: this._t('companionUser.createLogin'),
              username: this._t('companionUser.username'),
              email: this._t('formPage.emailLabel'),
              password: this._t('companionUser.password'),
              roles: this._t('companionUser.roles'),
              active: this._t('companionUser.active'),
              linkedUser: this._t('companionUser.linkedUser'),
              linkedUserAlready: this._t('companionUser.linkedUserAlready'),
              openInUsers: this._t('companionUser.openInUsers'),
              usernameRequired: this._t('companionUser.usernameRequired'),
              passwordTooShort: this._t('companionUser.passwordTooShort'),
            },
          }
        : null;

    // Plan H F1 — auto-derive inbound rollup sections from every other
    // entity's reference fields that point at this entity. The render block
    // (Plan H F2) is read-only, deep-links rows to the source entity's edit
    // page, and the Add button deep-links to the source's new-form page
    // with the FK pre-filled (Plan H F3).
    const rollupSections = this._buildInboundRollupSections(entity, allEntities, sdf);

    // UI Sections — opt-in per entity. When `entity.ui.sections` is a
    // non-empty array, the form-page generator emits a section-driven
    // render that interleaves field groups with named slots
    // (line items / rollups / totals / stock availability / companion
    // user). Pydantic + sdfValidation.js have already enforced shape and
    // cross-references, so we just thread the value through.
    const uiSections = entity && entity.ui && Array.isArray(entity.ui.sections) && entity.ui.sections.length > 0
      ? entity.ui.sections
      : null;

    const formPageContent = buildEntityFormPage({
      entity,
      entityName,
      fieldDefs,
      derivedRelations,
      childSections,
      rollupSections,
      escapeJsString: (s) => this._escapeJsString(s),
      importBase,
      invoiceConfig: isInvoiceEntity ? invoiceConfig : null,
      enablePrintInvoice,
      statusTransitions,
      hasReservationFields,
      approvalConfig,
      availabilityLabels,
      companionUserConfig,
      language: this._language,
      sections: uiSections,
    });

    await fs.writeFile(path.join(modulePagesDir, `${entityName}Page.tsx`), listPageContent);
    await fs.writeFile(path.join(modulePagesDir, `${entityName}FormPage.tsx`), formPageContent);

    if (enableCsvImport) {
      const importPageContent = buildEntityImportPage({
        entity,
        entityName,
        fieldDefs,
        escapeJsString: (s) => this._escapeJsString(s),
        importBase,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ImportPage.tsx`), importPageContent);
    }

    // ===================== Tier 2: Inventory ops wizards (optional) =====================
    if (enableInventoryOps) {
      const singular = String(entity.slug).endsWith('s') ? String(entity.slug).slice(0, -1) : String(entity.slug);
      const rawMode = inv.quantity_mode || inv.quantityMode || inv.movement_quantity_mode || inv.movementQuantityMode || 'delta';
      const modeStr = String(rawMode || 'delta').toLowerCase();
      const normalizedMode = (modeStr === 'absolute' || modeStr === 'abs') ? 'absolute' : 'delta';
      const invCfg = {
        movement_entity: inv.movement_entity || inv.movementEntity || 'stock_movements',
        location_entity: inv.location_entity || inv.locationEntity || 'locations',
        quantity_field: inv.quantity_field || inv.quantityField || 'quantity',
        location_ids_field: inv.location_ids_field || inv.locationIdsField || 'location_ids',
        quantity_mode: normalizedMode,
        use_workflow_api:
          transactionsEnabled &&
          String(entity.slug || '') === String(priorityCfg.stockEntity || ''),
        issue: {
          allow_negative_stock:
            issueCfg.allow_negative_stock === true ||
            issueCfg.allowNegativeStock === true ||
            false,
        },
        fields: {
          item_ref: (inv.fields && (inv.fields.item_ref || inv.fields.itemRef)) || inv.item_ref_field || inv.itemRefField || `${singular}_id`,
          qty: (inv.fields && inv.fields.qty) || inv.qty_field || inv.qtyField || 'quantity',
          type: (inv.fields && inv.fields.type) || inv.type_field || inv.typeField || 'movement_type',
          location: (inv.fields && (inv.fields.location || inv.fields.location_id || inv.fields.locationId)) || inv.location_field || inv.locationField || 'location_id',
          reason: (inv.fields && inv.fields.reason) || inv.reason_field || inv.reasonField || 'reason',
          reference_number:
            (inv.fields && (inv.fields.reference_number || inv.fields.referenceNumber)) ||
            inv.reference_number_field ||
            inv.referenceNumberField ||
            'reference_number',
          date: (inv.fields && (inv.fields.date || inv.fields.movement_date || inv.fields.movementDate)) || inv.date_field || inv.dateField || 'movement_date',
          from_location:
            (inv.fields && (inv.fields.from_location || inv.fields.fromLocation || inv.fields.from_location_id || inv.fields.fromLocationId)) ||
            inv.from_location_field ||
            inv.fromLocationField ||
            'from_location_id',
          to_location:
            (inv.fields && (inv.fields.to_location || inv.fields.toLocation || inv.fields.to_location_id || inv.fields.toLocationId)) ||
            inv.to_location_field ||
            inv.toLocationField ||
            'to_location_id',
        },
        movement_types: {
          receive: (inv.movement_types && (inv.movement_types.receive || inv.movement_types.in)) || inv.receive_type || inv.receiveType || 'IN',
          issue: (inv.movement_types && (inv.movement_types.issue || inv.movement_types.out)) || inv.issue_type || inv.issueType || 'OUT',
          adjust: (inv.movement_types && inv.movement_types.adjust) || inv.adjust_type || inv.adjustType || 'ADJUSTMENT',
          adjust_in:
            (inv.movement_types && (inv.movement_types.adjust_in || inv.movement_types.adjustIn)) ||
            inv.adjust_in_type ||
            inv.adjustInType ||
            null,
          adjust_out:
            (inv.movement_types && (inv.movement_types.adjust_out || inv.movement_types.adjustOut)) ||
            inv.adjust_out_type ||
            inv.adjustOutType ||
            null,
          transfer_out:
            (inv.movement_types && (inv.movement_types.transfer_out || inv.movement_types.transferOut)) ||
            inv.transfer_out_type ||
            inv.transferOutType ||
            'TRANSFER_OUT',
          transfer_in:
            (inv.movement_types && (inv.movement_types.transfer_in || inv.movement_types.transferIn)) ||
            inv.transfer_in_type ||
            inv.transferInType ||
            'TRANSFER_IN',
        },
        adjust: {
          reason_codes:
            (inv.adjust && (inv.adjust.reason_codes || inv.adjust.reasonCodes)) ||
            inv.reason_codes ||
            inv.reasonCodes ||
            ['COUNT', 'DAMAGED', 'EXPIRED', 'RETURN', 'OTHER'],
        },
      };

      const explicitEntityLocationField =
        inv.location_ids_field ||
        inv.locationIdsField ||
        inv.location_id_field ||
        inv.locationIdField ||
        inv.entity_location_field ||
        inv.entityLocationField ||
        null;

      const entityHasLocationIds = fields.some((f) => f && f.name === 'location_ids');
      const entityHasLocationId = fields.some((f) => f && f.name === 'location_id');
      const entityLocationField =
        explicitEntityLocationField ||
        (entityHasLocationIds ? 'location_ids' : (entityHasLocationId ? 'location_id' : null));

      if (enableReceive) {
        const receivePageContent = buildReceivePage({ entity, entityName, invCfg, entityLocationField, importBase, language: this._language });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}ReceivePage.tsx`), receivePageContent);
      }

      if (enableIssue) {
        const issuePageContent = buildIssuePage({
          entity,
          entityName,
          invCfg,
          entityLocationField,
          issueLabel,
          escapeJsString: (s) => this._escapeJsString(s),
          importBase,
          language: this._language,
        });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}IssuePage.tsx`), issuePageContent);
      }

      if (enableAdjust) {
        const adjustPageContent = buildAdjustPage({ entity, entityName, invCfg, importBase, language: this._language });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}AdjustPage.tsx`), adjustPageContent);
      }

      if (canTransfer) {
        const transferPageContent = buildTransferPage({ entity, entityName, invCfg, entityLocationField, importBase, language: this._language });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}TransferPage.tsx`), transferPageContent);
      }
    }

    // ===================== Tier 2: QR labels (optional) =====================
    if (enableQrLabels) {
      const labelsCfg = {
        enabled: labels.enabled === true,
        type: labels.type || 'qrcode',
        value_field: labels.value_field || labels.valueField || this._guessDisplayField(entity),
        text_fields: Array.isArray(labels.text_fields) ? labels.text_fields : (Array.isArray(labels.textFields) ? labels.textFields : []),
        columns: typeof labels.columns === 'number' ? labels.columns : 3,
        size: typeof labels.size === 'number' ? labels.size : 160,
        scan: labels.scan === true,
      };

      const labelsPageContent = buildLabelsPage({ entity, entityName, labelsCfg, importBase, language: this._language });

      await fs.writeFile(path.join(modulePagesDir, `${entityName}LabelsPage.tsx`), labelsPageContent);
    }

    // ===================== Inventory Priority A workflow pages =====================
    const isReservationHost =
      moduleKey === 'inventory' &&
      reservationsEnabled &&
      String(entity.slug || '') === String(priorityCfg.stockEntity || '');
    const isGrnHost =
      moduleKey === 'inventory' &&
      inboundEnabled &&
      String(entity.slug || '') === String(priorityCfg.inbound.grn_entity || '');
    const isCycleSessionHost =
      moduleKey === 'inventory' &&
      cycleEnabled &&
      String(entity.slug || '') === String(priorityCfg.cycleCounting.session_entity || '');

    if (isReservationHost) {
      const reservationsPageContent = buildReservationsPage({
        entity,
        entityName,
        importBase,
        reservationsCfg: priorityCfg.reservations,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ReservationsPage.tsx`), reservationsPageContent);
    }

    if (isGrnHost) {
      const postingPageContent = buildGrnPostingPage({
        entity,
        entityName,
        importBase,
        inboundCfg: priorityCfg.inbound,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}PostingPage.tsx`), postingPageContent);
    }

    if (isCycleSessionHost) {
      const workflowPageContent = buildCycleWorkflowPage({
        entity,
        entityName,
        importBase,
        cycleCfg: priorityCfg.cycleCounting,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }

    // ===================== Invoice Priority A workflow pages =====================
    const isInvoiceHost =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
    const isPaymentHost =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.paymentEntity || 'invoice_payments');
    const isNoteHost =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.noteEntity || 'invoice_notes');

    if (isInvoiceHost && invoiceTransactionsEnabled) {
      const workflowPageContent = buildInvoiceWorkflowPage({
        entity,
        entityName,
        importBase,
        lifecycleCfg: invoicePriorityCfg.lifecycle,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
    if (isInvoiceHost && invoicePaymentsEnabled) {
      const paymentsPageContent = buildInvoicePaymentsPage({
        entity,
        entityName,
        importBase,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}PaymentsPage.tsx`), paymentsPageContent);
    }
    if (isInvoiceHost && invoiceNotesEnabled) {
      const notesPageContent = buildInvoiceNotesPage({
        entity,
        entityName,
        importBase,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}NotesPage.tsx`), notesPageContent);
    }
    if (isPaymentHost && invoicePaymentsEnabled) {
      const workflowPageContent = buildPaymentWorkflowPage({
        entity,
        entityName,
        importBase,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
    if (isNoteHost && invoiceNotesEnabled) {
      const workflowPageContent = buildNoteWorkflowPage({
        entity,
        entityName,
        importBase,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }

    // ===================== HR Priority A workflow pages =====================
    const isLeaveApprovalHost =
      moduleKey === 'hr' &&
      hrLeaveApprovalsEnabled &&
      String(entity.slug || '') === String(hrPriorityCfg.leaveEntity || 'leaves');
    const isLeaveBalanceHost =
      (moduleKey === 'hr' || moduleKey === 'shared') &&
      hrLeaveEngineEnabled &&
      String(entity.slug || '') === String(hrPriorityCfg.employeeEntity || 'employees');
    const isAttendanceHost =
      moduleKey === 'hr' &&
      hrAttendanceEnabled &&
      String(entity.slug || '') === String(hrPriorityCfg.attendanceTime?.attendance_entity || 'attendance_entries');

    if (isLeaveApprovalHost) {
      const approvalsPageContent = buildLeaveApprovalsPage({
        entity,
        entityName,
        importBase,
        leaveCfg: hrPriorityCfg.leaveEngine,
        approvalCfg: hrPriorityCfg.leaveApprovals,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ApprovalsPage.tsx`), approvalsPageContent);
    }
    if (isLeaveBalanceHost) {
      const balancesPageContent = buildLeaveBalancesPage({
        entity,
        entityName,
        importBase,
        leaveCfg: hrPriorityCfg.leaveEngine,
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}BalancesPage.tsx`), balancesPageContent);
    }
    if (isAttendanceHost) {
      const attendancePageContent = buildAttendanceEntriesPage({
        entity,
        entityName,
        importBase,
        attendanceCfg: {
          ...hrPriorityCfg.attendanceTime,
          employee_entity: hrPriorityCfg.employeeEntity,
        },
        language: this._language,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}AttendancePage.tsx`), attendancePageContent);
    }
  },

  // Plan H F1 — return inbound rollup section descriptors for `entity`. We
  // scan every OTHER entity in `allEntities` for `field.type == 'reference'`
  // (or explicit `reference_entity`) pointing at the current entity and emit
  // one read-only section per inbound foreign key, after applying:
  //
  //   1. System-entity exclusion: never auto-rollup INTO `__erp_*` /
  //      `__audit_logs` / `__reports` detail pages, and skip source entities
  //      whose slug starts with `__erp_` or is `__audit_logs` / `__reports`.
  //   2. Actor-field exclusion: when the target is `__erp_users`, skip any
  //      source field whose name appears in the canonical actor registry
  //      (`approved_by`, `posted_by`, ...). Otherwise the user detail page
  //      would explode into a section per actor field across the SDF.
  //   3. Children-overlap exclusion: if `entity.children[]` already declares
  //      `{ entity: source.slug, foreign_key: field.name }`, the existing
  //      CHILD_SECTIONS render covers that FK — don't duplicate.
  //   4. Disabled-module exclusion: `allEntities` is already filtered to
  //      enabled modules at scaffold time (FrontendGenerator.scaffold), so
  //      iterating it implicitly drops sources whose module is off.
  //
  // Per-entity overrides at `entity.rollups[sourceSlug]`:
  //   - `false`: suppress all rollups for that source.
  //   - `{ label?, columns?, foreign_key? }`: customize. `foreign_key`
  //     narrows to a single FK (useful when one source has multiple FKs to
  //     the same target). `columns` is an explicit ordered list. `label` is
  //     the section heading.
  //
  // When two FKs from the same source target the same entity (e.g.
  // `invoices.customer_id` and `invoices.bill_to_customer_id`), the section
  // labels are disambiguated with `(<fk_label>)` so the user can tell them
  // apart.
  //
  // Returns an array of `{ sourceSlug, foreignKey, label, columns,
  // displayField, sourceModule }` descriptors — same column shape used by
  // CHILD_SECTIONS so the formPage emitter shares rendering helpers.
  _buildInboundRollupSections(entity, allEntities, sdf) {
    if (!entity || !entity.slug) return [];
    const targetSlug = String(entity.slug);
    const SYSTEM_PREFIX = '__erp_';
    const SYSTEM_SLUGS = new Set(['__audit_logs', '__reports']);
    if (targetSlug.startsWith(SYSTEM_PREFIX) || SYSTEM_SLUGS.has(targetSlug)) return [];
    if (!Array.isArray(allEntities) || allEntities.length === 0) return [];

    const childrenSet = new Set();
    if (Array.isArray(entity.children)) {
      for (const ch of entity.children) {
        if (!ch || typeof ch !== 'object') continue;
        const cSlug = String(ch.entity || ch.slug || '').trim();
        const fk = String(ch.foreign_key || ch.foreignKey || '').trim();
        if (cSlug && fk) childrenSet.add(`${cSlug}:${fk}`);
      }
    }

    const isUsersTarget = targetSlug === '__erp_users';
    let actorFieldNames = null;
    if (isUsersTarget) {
      actorFieldNames = new Set();
      try {
        for (const { spec } of listAllActorSpecs()) {
          if (spec && spec.field) actorFieldNames.add(String(spec.field));
        }
      } catch {
        actorFieldNames = new Set();
      }
    }

    const overrides = (entity.rollups && typeof entity.rollups === 'object') ? entity.rollups : {};
    const sections = [];

    for (const source of allEntities) {
      if (!source || !source.slug) continue;
      const sourceSlug = String(source.slug);
      if (sourceSlug === targetSlug) continue;
      if (sourceSlug.startsWith(SYSTEM_PREFIX) || SYSTEM_SLUGS.has(sourceSlug)) continue;

      const override = Object.prototype.hasOwnProperty.call(overrides, sourceSlug) ? overrides[sourceSlug] : undefined;
      if (override === false) continue;
      const overrideObj = (override && typeof override === 'object' && !Array.isArray(override)) ? override : null;
      const overrideFk = overrideObj && typeof overrideObj.foreign_key === 'string' && overrideObj.foreign_key.trim()
        ? overrideObj.foreign_key.trim()
        : null;

      const sourceFields = Array.isArray(source.fields) ? source.fields : [];
      const inbound = [];
      for (const field of sourceFields) {
        if (!field || !field.name) continue;
        if (!this._fieldReferencesEntity(field, targetSlug)) continue;
        if (isUsersTarget && actorFieldNames && actorFieldNames.has(String(field.name))) continue;
        if (childrenSet.has(`${sourceSlug}:${field.name}`)) continue;
        if (overrideFk && String(field.name) !== overrideFk) continue;
        inbound.push(field);
      }
      if (inbound.length === 0) continue;

      const sourceLocalizedLabel = (() => {
        if (this._language === 'tr') {
          const picked = pickTrEntityDisplayName(sourceSlug, source.display_name);
          if (picked) return String(picked);
        }
        return String(source.display_name || this._formatLabel(sourceSlug));
      })();

      const sourceDisplayField = this._guessDisplayField(source);
      const sourceModule = this._getModuleKey(source);

      for (const field of inbound) {
        const fkName = String(field.name);
        const sectionLabel = (() => {
          if (overrideObj && typeof overrideObj.label === 'string' && overrideObj.label.trim()) {
            return overrideObj.label.trim();
          }
          if (inbound.length > 1) {
            const viaText = field.label && String(field.label).trim()
              ? String(field.label).trim()
              : this._formatLabel(fkName.replace(/_ids?$/, ''));
            return `${sourceLocalizedLabel} (${viaText})`;
          }
          return sourceLocalizedLabel;
        })();

        const overrideCols = overrideObj && Array.isArray(overrideObj.columns)
          ? overrideObj.columns.map((c) => String(c || '').trim()).filter(Boolean)
          : null;

        let pickedColNames;
        if (overrideCols && overrideCols.length) {
          pickedColNames = overrideCols;
        } else {
          const candidates = sourceFields
            .filter((f) => f && f.name && !['id', 'created_at', 'updated_at'].includes(f.name) && f.name !== fkName)
            .map((f) => String(f.name));
          const ordered = [];
          const seen = new Set();
          const push = (n) => {
            if (n && !seen.has(n) && candidates.includes(n)) {
              ordered.push(n);
              seen.add(n);
            }
          };
          push(sourceDisplayField);
          push('status');
          for (const f of sourceFields) {
            if (!f || !f.name) continue;
            if (seen.has(f.name)) continue;
            if (['id', 'created_at', 'updated_at', fkName].includes(f.name)) continue;
            const t = String(f.type || '').toLowerCase();
            if (t === 'date' || t === 'datetime') { push(f.name); break; }
          }
          for (const f of sourceFields) {
            if (!f || !f.name) continue;
            if (seen.has(f.name)) continue;
            if (['id', 'created_at', 'updated_at', fkName].includes(f.name)) continue;
            const t = String(f.type || '').toLowerCase();
            if (t === 'decimal' || t === 'number' || t === 'integer' || t === 'money') { push(f.name); break; }
          }
          for (const c of candidates) {
            if (ordered.length >= 4) break;
            push(c);
          }
          pickedColNames = ordered.slice(0, 4);
        }

        const columnDefs = pickedColNames.map((colName) => {
          const defField = sourceFields.find((f) => f && f.name === colName);
          const label = this._resolveColumnLabel(colName, defField, allEntities);
          const isReference = defField && (
            defField.type === 'reference' ||
            String(defField.name || '').endsWith('_id') ||
            String(defField.name || '').endsWith('_ids')
          );
          let referenceEntity = null;
          if (isReference) {
            const explicitRef = defField.reference_entity || defField.referenceEntity;
            const inferredBase = String(defField.name).replace(/_ids?$/, '');
            const baseName = String(explicitRef || inferredBase);
            const targetEntity = (allEntities || []).find((e) =>
              e && (
                e.slug === baseName ||
                e.slug === baseName + 's' ||
                e.slug === baseName + 'es' ||
                (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
                (typeof e.slug === 'string' && e.slug.startsWith(baseName))
              )
            );
            referenceEntity = targetEntity ? targetEntity.slug : (explicitRef ? String(explicitRef) : null);
          }
          const multiple = defField && (
            defField.multiple === true ||
            defField.is_array === true ||
            String(defField.name || '').endsWith('_ids')
          );
          return { key: colName, label, referenceEntity, multiple: !!multiple };
        });

        sections.push({
          sourceSlug,
          foreignKey: fkName,
          label: sectionLabel,
          columns: columnDefs,
          displayField: sourceDisplayField,
          sourceModule,
        });
      }
    }

    return sections;
  },

  // Plan H F1 helper — strict inbound-FK check. We require either an
  // explicit `reference_entity`/`referenceEntity` matching the target slug,
  // or `type === 'reference'` with name-based inference (strip `_id`/`_ids`
  // and resolve via the same pluralization heuristics fieldUtils already
  // uses for label fallback). Loose `_id`-suffix-only matches are excluded
  // to keep auto-derive quiet on system/audit columns.
  _fieldReferencesEntity(field, targetSlug) {
    if (!field || !targetSlug) return false;
    const explicitRef = field.reference_entity || field.referenceEntity;
    if (explicitRef) return String(explicitRef) === String(targetSlug);
    if (field.type !== 'reference') return false;
    const inferredBase = String(field.name || '').replace(/_ids?$/, '');
    if (!inferredBase) return false;
    if (inferredBase === targetSlug) return true;
    if (inferredBase + 's' === targetSlug) return true;
    if (inferredBase + 'es' === targetSlug) return true;
    if (inferredBase.endsWith('y') && inferredBase.slice(0, -1) + 'ies' === targetSlug) return true;
    return false;
  },
};
