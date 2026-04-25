// Mixin resolution, application, and ordering (split from BackendGenerator)
module.exports = {
  async _resolveMixins(entity, allEntities = []) {
    const features = entity.features || {};
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    const moduleKey = this._getModuleKey(entity);
    const slug = String(entity && entity.slug ? entity.slug : '');
    const inventoryCfg = this._getInventoryPriorityAConfig();
    const transactionsCfg = this._buildInventoryTransactionMixinConfig(entity, inventoryCfg);
    const reservationsCfg = this._buildInventoryReservationMixinConfig(inventoryCfg, transactionsCfg);
    const inboundCfg = this._buildInventoryInboundMixinConfig(inventoryCfg, transactionsCfg);
    const cycleCfg = this._buildInventoryCycleMixinConfig(inventoryCfg, transactionsCfg);
    const stockSlug = String(inventoryCfg.stockEntity || '');
    const reservationSlug = String(inventoryCfg.reservationEntity || '');
    const inboundGrnSlug = String(inventoryCfg.inbound?.grn_entity || '');
    const cycleSessionSlug = String(inventoryCfg.cycleCounting?.session_entity || '');
    const cycleLineSlug = String(inventoryCfg.cycleCounting?.line_entity || '');

    const hasConfiguredQuantityField = fields.some(
      (f) => f && f.name === transactionsCfg.quantity_field
    );

    // IMPORTANT: Mixins must be optional.
    // We only apply InventoryMixin when the entity actually has inventory-like behavior,
    // otherwise we would accidentally add "quantity" to unrelated entities (e.g., Categories).
    const hasQuantityField = fields.some(f => f && f.name === 'quantity');
    const wantsInventoryBehavior =
      moduleKey === 'inventory' &&
      (!!hasQuantityField ||
        !!hasConfiguredQuantityField ||
        !!features.inventory ||
        !!features.stock_tracking ||
        !!features.batch_tracking ||
        !!features.serial_tracking ||
        !!features.multi_location);

    const mixins = new Map();

    const addMixin = (name, config = {}, source = 'features') => {
      const resolved = this.mixinRegistry.resolveName(name);
      const existing = mixins.get(resolved);
      if (!existing) {
        mixins.set(resolved, { name: resolved, config, source, enabled: true });
        return;
      }
      mixins.set(resolved, {
        ...existing,
        config: { ...existing.config, ...config },
      });
    };

    const removeMixin = (name) => {
      const resolved = this.mixinRegistry.resolveName(name);
      mixins.delete(resolved);
    };

    if (wantsInventoryBehavior) addMixin('InventoryMixin');

    if (features.batch_tracking) addMixin('BatchTrackingMixin');
    if (features.serial_tracking) addMixin('SerialTrackingMixin');
    // Audit trail:
    // - If entity.features.audit_trail is explicitly set (true/false), respect it.
    // - Otherwise, if modules.activity_log.enabled is true, audit ALL non-system entities by default
    //   (or only the listed entity slugs if modules.activity_log.entities is provided).
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

    if (auditEnabled) addMixin('AuditMixin');
    if (features.multi_location) addMixin('LocationMixin');

    if (moduleKey === 'inventory') {
      addMixin('InventoryLifecycleMixin');
      const reservationsEnabled = this._isPackEnabled(inventoryCfg.reservations);
      const transactionsEnabled = this._isPackEnabled(inventoryCfg.transactions);
      const inboundEnabled = this._isPackEnabled(inventoryCfg.inbound);
      const cycleEnabled = this._isPackEnabled(inventoryCfg.cycleCounting);

      const hasReservationFields = fields.some((f) => {
        const fieldName = String((f && f.name) || '');
        return (
          fieldName === reservationsCfg.reserved_field ||
          fieldName === reservationsCfg.committed_field ||
          fieldName === reservationsCfg.available_field
        );
      });

      if (reservationsEnabled || hasReservationFields) {
        addMixin('InventoryReservationMixin', reservationsCfg, 'modules');
      }

      if (transactionsEnabled && slug === stockSlug) {
        addMixin('InventoryTransactionSafetyMixin', transactionsCfg, 'modules');
      }

      if (reservationsEnabled && slug === stockSlug) {
        addMixin('InventoryReservationWorkflowMixin', reservationsCfg, 'modules');
      }

      if (inboundEnabled && slug === inboundGrnSlug) {
        addMixin('InventoryInboundWorkflowMixin', inboundCfg, 'modules');
      }

      if (cycleEnabled && slug === cycleSessionSlug) {
        addMixin('InventoryCycleCountWorkflowMixin', cycleCfg, 'modules');
      }

      if (cycleEnabled && slug === cycleLineSlug) {
        addMixin('InventoryCycleCountLineMixin', cycleCfg, 'modules');
      }

      if (slug === reservationSlug && reservationsEnabled) {
        addMixin('InventoryLifecycleMixin', {
          status_field: reservationsCfg.status_field,
          statuses: ['Pending', 'Released', 'Committed', 'Cancelled'],
          enforce_transitions: true,
          transitions: {
            Pending: ['Released', 'Committed', 'Cancelled'],
            Released: [],
            Committed: [],
            Cancelled: [],
          },
        }, 'modules');
      }

      // ──────────────────────────────────────────────────────────────
      // SalesOrderCommitmentMixin
      //
      // Attach to the sales_orders header (role: 'header') so status
      // transitions (draft→approved, approved→shipped|cancelled|closed)
      // flow through to product.committed_quantity and on_hand, and to
      // sales_order_lines (role: 'lines') so line CRUD keeps the
      // commitment in sync.
      //
      // Both entities are synthesized deterministically in
      // inventoryEntities.js whenever inventory is enabled, so their
      // slugs are safe to hardcode here.
      const allEntitySlugs = Array.isArray(allEntities)
        ? allEntities.map((e) => e && e.slug).filter(Boolean)
        : [];
      const salesOrdersSlug = allEntitySlugs.includes('sales_orders') ? 'sales_orders' : null;
      const salesOrderLinesSlug = allEntitySlugs.includes('sales_order_lines') ? 'sales_order_lines' : null;
      const hasStockMovements = allEntitySlugs.includes('stock_movements');
      const hasProducts = allEntitySlugs.includes(stockSlug || 'products');

      if (hasProducts && salesOrdersSlug && salesOrderLinesSlug) {
        const soCommonCfg = {
          header_entity: salesOrdersSlug,
          line_entity: salesOrderLinesSlug,
          stock_entity: stockSlug || 'products',
          stock_movement_entity: hasStockMovements ? 'stock_movements' : 'stock_movements',
          parent_field: 'sales_order',
          product_field: 'product',
          ordered_field: 'ordered_qty',
          shipped_field: 'shipped_qty',
          unit_price_field: 'unit_price',
          line_total_field: 'line_total',
          status_field: 'status',
          stock_quantity_field: reservationsCfg.stock_quantity_field || 'quantity',
          stock_reserved_field: reservationsCfg.reserved_field || 'reserved_quantity',
          stock_committed_field: reservationsCfg.committed_field || 'committed_quantity',
          stock_available_field: reservationsCfg.available_field || 'available_quantity',
          movement_type_field: 'movement_type',
          movement_qty_field: 'quantity',
          movement_product_field: 'product',
          movement_reference_field: 'reference',
          allow_negative_stock: false,
        };

        if (slug === salesOrdersSlug) {
          addMixin('SalesOrderCommitmentMixin', { ...soCommonCfg, role: 'header' }, 'modules');
        }
        if (slug === salesOrderLinesSlug) {
          addMixin('SalesOrderCommitmentMixin', { ...soCommonCfg, role: 'lines' }, 'modules');
        }
      }
    }

    const invoiceModuleConfig = (this.modules && this.modules.invoice && typeof this.modules.invoice === 'object')
      ? this.modules.invoice
      : {};
    const invoicePriorityCfg = this._getInvoicePriorityAConfig();
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);
    const invoiceLifecycleEnabled = this._isPackEnabled(invoicePriorityCfg.lifecycle);
    const invoiceCalcEnabled = this._isPackEnabled(invoicePriorityCfg.calculationEngine);
    const invoiceTxnCfg = this._buildInvoiceTransactionMixinConfig(invoicePriorityCfg, invoiceModuleConfig);
    const invoicePaymentCfg = this._buildInvoicePaymentMixinConfig(invoicePriorityCfg, invoiceTxnCfg);
    const invoiceNoteCfg = this._buildInvoiceNoteMixinConfig(invoicePriorityCfg, invoiceTxnCfg);
    const invoiceCalcCfg = this._buildInvoiceCalculationMixinConfig(invoicePriorityCfg);
    const invoiceLifecycleCfg = this._buildInvoiceLifecycleMixinConfig(invoicePriorityCfg);
    const invoiceSlug = String(invoicePriorityCfg.invoiceEntity || 'invoices');
    const invoiceItemSlug = String(invoicePriorityCfg.itemEntity || 'invoice_items');
    const invoicePaymentSlug = String(invoicePriorityCfg.payments?.payment_entity || 'invoice_payments');
    const invoiceNoteSlug = String(invoicePriorityCfg.notes?.note_entity || 'invoice_notes');
    const hrPriorityCfg = this._getHRPriorityAConfig();
    const hrLeaveEngineEnabled = this._isPackEnabled(hrPriorityCfg.leaveEngine);
    const hrLeaveApprovalsEnabled = this._isPackEnabled(hrPriorityCfg.leaveApprovals);
    const hrAttendanceEnabled = this._isPackEnabled(hrPriorityCfg.attendanceTime);
    const hrCompensationEnabled = this._isPackEnabled(hrPriorityCfg.compensationLedger);
    const hrEmployeeSlug = String(hrPriorityCfg.employeeEntity || 'employees');
    const hrDepartmentSlug = String(hrPriorityCfg.departmentEntity || 'departments');
    const hrLeaveSlug = String(hrPriorityCfg.leaveEntity || 'leaves');
    const hrLeaveBalanceSlug = String(hrPriorityCfg.leaveEngine?.balance_entity || 'leave_balances');
    const hrAttendanceSlug = String(hrPriorityCfg.attendanceTime?.attendance_entity || 'attendance_entries');
    const hrShiftSlug = String(hrPriorityCfg.attendanceTime?.shift_entity || 'shift_assignments');
    const hrTimesheetSlug = String(hrPriorityCfg.attendanceTime?.timesheet_entity || 'timesheet_entries');
    const hrLedgerSlug = String(hrPriorityCfg.compensationLedger?.ledger_entity || 'compensation_ledger');
    const hrSnapshotSlug = String(hrPriorityCfg.compensationLedger?.snapshot_entity || 'compensation_snapshots');
    const hrEmployeeStatusCfg = this._buildHREmployeeStatusMixinConfig(hrPriorityCfg);
    const hrLeaveBalanceCfg = this._buildHRLeaveBalanceMixinConfig(hrPriorityCfg);
    const hrLeaveApprovalCfg = this._buildHRLeaveApprovalMixinConfig(hrPriorityCfg, hrLeaveBalanceCfg);
    const hrAttendanceCfg = this._buildHRAttendanceTimesheetMixinConfig(hrPriorityCfg);
    const hrCompensationCfg = this._buildHRCompensationLedgerMixinConfig(hrPriorityCfg);

    if (moduleKey === 'invoice' && slug === invoiceSlug) {
      addMixin(
        'InvoiceMixin',
        {
          ...invoiceModuleConfig,
          use_calculation_engine: invoiceCalcEnabled,
          calculation_engine_enabled: invoiceCalcEnabled,
          auto_number_mode: invoiceTransactionsEnabled ? 'workflow' : 'create',
          status_field: invoiceLifecycleCfg.status_field,
          statuses: invoiceLifecycleCfg.statuses,
        },
        'modules'
      );
      addMixin(
        'InvoiceLifecycleMixin',
        invoiceLifecycleEnabled ? invoiceLifecycleCfg : {},
        'modules'
      );
      if (invoiceTransactionsEnabled) {
        addMixin('InvoiceTransactionSafetyMixin', invoiceTxnCfg, 'modules');
      }
      if (invoicePaymentsEnabled) {
        addMixin('InvoicePaymentWorkflowMixin', invoicePaymentCfg, 'modules');
      }
      if (invoiceNotesEnabled) {
        addMixin('InvoiceNoteWorkflowMixin', invoiceNoteCfg, 'modules');
      }
    }
    if (moduleKey === 'invoice' && slug === invoiceItemSlug) {
      if (invoiceCalcEnabled) {
        addMixin('InvoiceCalculationEngineMixin', invoiceCalcCfg, 'modules');
      } else {
        addMixin('InvoiceItemsMixin', invoiceModuleConfig, 'modules');
      }
    }
    if (moduleKey === 'invoice' && slug === invoicePaymentSlug && invoicePaymentsEnabled) {
      addMixin('InvoicePaymentWorkflowMixin', invoicePaymentCfg, 'modules');
    }
    if (moduleKey === 'invoice' && slug === invoiceNoteSlug && invoiceNotesEnabled) {
      addMixin('InvoiceNoteWorkflowMixin', invoiceNoteCfg, 'modules');
    }

    const isHrModule = moduleKey === 'hr' || moduleKey === 'shared';
    if (isHrModule && slug === hrEmployeeSlug) {
      addMixin('HREmployeeMixin', hrEmployeeStatusCfg, 'modules');
      addMixin('HREmployeeStatusMixin', hrEmployeeStatusCfg, 'modules');
      if (hrLeaveEngineEnabled) {
        addMixin('HRLeaveBalanceMixin', hrLeaveBalanceCfg, 'modules');
      }
    }
    if (moduleKey === 'hr' && slug === hrDepartmentSlug) {
      addMixin('HRDepartmentMixin', {}, 'modules');
    }
    if (moduleKey === 'hr' && slug === hrLeaveSlug) {
      addMixin('HRLeaveMixin', hrLeaveBalanceCfg, 'modules');
      if (hrLeaveEngineEnabled) {
        addMixin('HRLeaveBalanceMixin', hrLeaveBalanceCfg, 'modules');
      }
      if (hrLeaveApprovalsEnabled) {
        addMixin('HRLeaveApprovalMixin', hrLeaveApprovalCfg, 'modules');
      }
    }
    if (moduleKey === 'hr' && hrLeaveEngineEnabled && slug === hrLeaveBalanceSlug) {
      addMixin('HRLeaveBalanceMixin', hrLeaveBalanceCfg, 'modules');
    }
    if (moduleKey === 'hr' && hrAttendanceEnabled && (slug === hrAttendanceSlug || slug === hrShiftSlug || slug === hrTimesheetSlug)) {
      addMixin('HRAttendanceTimesheetMixin', hrAttendanceCfg, 'modules');
    }
    if (moduleKey === 'hr' && hrCompensationEnabled && (slug === hrLedgerSlug || slug === hrSnapshotSlug)) {
      addMixin('HRCompensationLedgerMixin', hrCompensationCfg, 'modules');
    }

    const explicitMixins = this._normalizeExplicitMixins(entity);
    for (const entry of explicitMixins) {
      if (entry.enabled === false) {
        removeMixin(entry.name);
        continue;
      }
      addMixin(entry.name, entry.config, 'explicit');
    }

    const ordered = await this._orderMixins(Array.from(mixins.values()), { entity, allEntities });
    return ordered;
  },

  async _applyMixin(weaver, mixinEntry, { entity, allEntities }) {
    const mixinName = mixinEntry.name;
    const context = {
      entity,
      allEntities,
      modules: this.modules,
      mixinName,
    };

    try {
      const mixin = await this.mixinRegistry.loadMixin(mixinName, mixinEntry.config || {}, context);

      if (mixin.hooks) {
        for (const [hookName, code] of Object.entries(mixin.hooks)) {
          weaver.inject(hookName, this._wrapHookCode(code));
        }
      }

      if (mixin.methods) {
        const content = weaver.getContent();
        if (content.includes('// @HOOK: ADDITIONAL_METHODS')) {
          weaver.inject('ADDITIONAL_METHODS', mixin.methods);
        } else {
          const lastBraceIndex = content.lastIndexOf('}');
          if (lastBraceIndex !== -1) {
            const newContent = content.substring(0, lastBraceIndex) +
              `\n  ${mixin.methods}\n` +
              content.substring(lastBraceIndex);
            weaver.content = newContent;
          }
        }
      }
    } catch (err) {
      throw new Error(`Failed to apply mixin ${mixinName}: ${err.message || err}`);
    }
  },

  _normalizeExplicitMixins(entity) {
    const raw = entity && entity.mixins;
    if (!raw) return [];

    const normalizeEntry = (name, cfg) => {
      const config = typeof cfg === 'object' && cfg !== null ? { ...cfg } : {};
      const enabled = cfg === false ? false : (config.enabled !== false);
      delete config.enabled;
      return { name, config, enabled };
    };

    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (typeof item === 'string') return normalizeEntry(item, {});
          if (item && typeof item === 'object') {
            const name = item.name || item.mixin || item.id;
            if (!name) return null;
            return normalizeEntry(name, item);
          }
          return null;
        })
        .filter(Boolean);
    }

    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([name, cfg]) => normalizeEntry(name, cfg));
    }

    return [];
  },

  _wrapHookCode(code) {
    const raw = String(code || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    const body = raw
      .split('\n')
      .map((line) => `      ${line}`)
      .join('\n');
    return `\n      {\n${body}\n      }\n`;
  },

  _buildEffectiveMixinConfig(entity, mixinsToApply = []) {
    const out = {};
    const raw = entity && entity.mixins ? entity.mixins : null;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw)) {
        if (!key) continue;
        if (value === false) continue;
        if (value && typeof value === 'object') {
          const cfg = { ...value };
          delete cfg.enabled;
          out[key] = cfg;
        } else {
          out[key] = {};
        }
      }
    }

    for (const entry of mixinsToApply || []) {
      if (!entry || !entry.name) continue;
      const name = String(entry.name);
      const cfg = entry.config && typeof entry.config === 'object' ? entry.config : {};
      const compact = name.replace(/Mixin$/i, '');
      const snake = compact.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      const camel = snake.replace(/_([a-z])/g, (_, chr) => chr.toUpperCase());

      out[name] = { ...cfg };
      out[snake] = { ...cfg };
      out[camel] = { ...cfg };
    }

    return out;
  },

  async _orderMixins(entries, { entity, allEntities }) {
    const baseOrder = [
      'InventoryMixin',
      'InventoryLifecycleMixin',
      'InventoryReservationMixin',
      'InventoryTransactionSafetyMixin',
      'InventoryReservationWorkflowMixin',
      'InventoryInboundWorkflowMixin',
      'InventoryCycleCountLineMixin',
      'InventoryCycleCountWorkflowMixin',
      'SalesOrderCommitmentMixin',
      'BatchTrackingMixin',
      'SerialTrackingMixin',
      'AuditMixin',
      'LocationMixin',
      'InvoiceTransactionSafetyMixin',
      'InvoiceMixin',
      'InvoiceCalculationEngineMixin',
      'InvoiceItemsMixin',
      'InvoicePaymentWorkflowMixin',
      'InvoiceNoteWorkflowMixin',
      'InvoiceLifecycleMixin',
      'HREmployeeMixin',
      'HREmployeeStatusMixin',
      'HRDepartmentMixin',
      'HRLeaveMixin',
      'HRLeaveApprovalMixin',
      'HRLeaveBalanceMixin',
      'HRAttendanceTimesheetMixin',
      'HRCompensationLedgerMixin',
    ];

    const byName = new Map();
    const orderIndex = new Map();

    entries.forEach((entry, idx) => {
      byName.set(entry.name, entry);
      orderIndex.set(entry.name, idx);
    });

    const defCache = new Map();
    const resolveDef = async (name) => {
      if (defCache.has(name)) return defCache.get(name);
      const entry = byName.get(name) || { name, config: {} };
      const def = await this.mixinRegistry.loadMixin(name, entry.config || {}, { entity, allEntities, modules: this.modules, mixinName: name });
      defCache.set(name, def);
      return def;
    };

    // Ensure all dependencies are included
    const queue = Array.from(byName.keys());
    while (queue.length) {
      const current = queue.shift();
      const def = await resolveDef(current);
      const deps = Array.isArray(def.dependencies) ? def.dependencies : [];
      for (const rawDep of deps) {
        const dep = this.mixinRegistry.resolveName(rawDep);
        if (!byName.has(dep)) {
          const idx = byName.size + 100;
          byName.set(dep, { name: dep, config: {}, source: 'dependency' });
          orderIndex.set(dep, idx);
          queue.push(dep);
        }
      }
    }

    // Build graph
    const indegree = new Map();
    const edges = new Map();
    for (const name of byName.keys()) {
      indegree.set(name, 0);
      edges.set(name, []);
    }

    for (const name of byName.keys()) {
      const def = await resolveDef(name);
      const deps = Array.isArray(def.dependencies) ? def.dependencies : [];
      for (const rawDep of deps) {
        const dep = this.mixinRegistry.resolveName(rawDep);
        if (!byName.has(dep)) continue;
        edges.get(dep).push(name);
        indegree.set(name, (indegree.get(name) || 0) + 1);
      }
    }

    const sortKey = (name) => {
      const baseRank = baseOrder.includes(name) ? baseOrder.indexOf(name) : 999;
      const idx = orderIndex.has(name) ? orderIndex.get(name) : 9999;
      return [baseRank, idx];
    };

    const available = Array.from(byName.keys()).filter((n) => indegree.get(n) === 0);
    available.sort((a, b) => {
      const [ar, ai] = sortKey(a);
      const [br, bi] = sortKey(b);
      if (ar !== br) return ar - br;
      return ai - bi;
    });

    const result = [];
    while (available.length) {
      const next = available.shift();
      result.push(byName.get(next));
      for (const neighbor of edges.get(next)) {
        indegree.set(neighbor, indegree.get(neighbor) - 1);
        if (indegree.get(neighbor) === 0) {
          available.push(neighbor);
          available.sort((a, b) => {
            const [ar, ai] = sortKey(a);
            const [br, bi] = sortKey(b);
            if (ar !== br) return ar - br;
            return ai - bi;
          });
        }
      }
    }

    if (result.length !== byName.size) {
      throw new Error('Mixin dependency cycle detected. Resolve mixin dependencies.');
    }

    return result;
  },
};
