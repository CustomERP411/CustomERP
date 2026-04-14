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

module.exports = {
  async generateEntityPage(outputDir, entity, allEntities, sdf = {}) {
    const moduleKey = this._getModuleKey(entity);
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

    const fieldDefs = this._generateFieldDefinitions(fields, entity.features || {}, allEntities);

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
      'Sell';
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
        const label = this._escapeJsString(defField && defField.label ? String(defField.label) : this._formatLabel(colName));
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
        })
      : isLeaveEntity
      ? buildLeaveListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
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
          const label = this._escapeJsString(defField && defField.label ? String(defField.label) : this._formatLabel(colName));
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
          allEntities
        );

        childSections.push({
          childSlug,
          foreignKey,
          label: String(ch.label || childEntity.display_name || this._formatLabel(childSlug)),
          columns: columnDefs,
          formFields: childFormFields,
        });
      }
    }

    const formPageContent = buildEntityFormPage({
      entity,
      entityName,
      fieldDefs,
      childSections,
      escapeJsString: (s) => this._escapeJsString(s),
      importBase,
      invoiceConfig: isInvoiceEntity ? invoiceConfig : null,
      enablePrintInvoice,
      statusTransitions,
      hasReservationFields,
      approvalConfig,
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
        const receivePageContent = buildReceivePage({ entity, entityName, invCfg, entityLocationField, importBase });
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
        });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}IssuePage.tsx`), issuePageContent);
      }

      if (enableAdjust) {
        const adjustPageContent = buildAdjustPage({ entity, entityName, invCfg, importBase });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}AdjustPage.tsx`), adjustPageContent);
      }

      if (canTransfer) {
        const transferPageContent = buildTransferPage({ entity, entityName, invCfg, entityLocationField, importBase });
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

      const labelsPageContent = buildLabelsPage({ entity, entityName, labelsCfg, importBase });

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
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ReservationsPage.tsx`), reservationsPageContent);
    }

    if (isGrnHost) {
      const postingPageContent = buildGrnPostingPage({
        entity,
        entityName,
        importBase,
        inboundCfg: priorityCfg.inbound,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}PostingPage.tsx`), postingPageContent);
    }

    if (isCycleSessionHost) {
      const workflowPageContent = buildCycleWorkflowPage({
        entity,
        entityName,
        importBase,
        cycleCfg: priorityCfg.cycleCounting,
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
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
    if (isInvoiceHost && invoicePaymentsEnabled) {
      const paymentsPageContent = buildInvoicePaymentsPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}PaymentsPage.tsx`), paymentsPageContent);
    }
    if (isInvoiceHost && invoiceNotesEnabled) {
      const notesPageContent = buildInvoiceNotesPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}NotesPage.tsx`), notesPageContent);
    }
    if (isPaymentHost && invoicePaymentsEnabled) {
      const workflowPageContent = buildPaymentWorkflowPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
    if (isNoteHost && invoiceNotesEnabled) {
      const workflowPageContent = buildNoteWorkflowPage({
        entity,
        entityName,
        importBase,
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
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ApprovalsPage.tsx`), approvalsPageContent);
    }
    if (isLeaveBalanceHost) {
      const balancesPageContent = buildLeaveBalancesPage({
        entity,
        entityName,
        importBase,
        leaveCfg: hrPriorityCfg.leaveEngine,
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
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}AttendancePage.tsx`), attendancePageContent);
    }
  },
};
