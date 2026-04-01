module.exports = {
  dependencies: ['InventoryTransactionSafetyMixin'],

  methods: `
  _invCycleCfg() {
    const cfg =
      this.mixinConfig?.inventory_cycle_count_workflow ||
      this.mixinConfig?.inventoryCycleCountWorkflow ||
      this.mixinConfig?.inventory_cycle_count ||
      this.mixinConfig?.inventoryCycleCount ||
      {};
    return {
      stock_entity: cfg.stock_entity || cfg.stockEntity || 'products',
      quantity_field: cfg.quantity_field || cfg.quantityField || 'quantity',
      session_entity: cfg.session_entity || cfg.sessionEntity || this.slug,
      line_entity: cfg.line_entity || cfg.lineEntity || 'cycle_count_lines',
      line_session_field: cfg.line_session_field || cfg.lineSessionField || 'cycle_count_session_id',
      line_item_field: cfg.line_item_field || cfg.lineItemField || 'item_id',
      line_expected_field: cfg.line_expected_field || cfg.lineExpectedField || 'expected_quantity',
      line_counted_field: cfg.line_counted_field || cfg.lineCountedField || 'counted_quantity',
      line_variance_field: cfg.line_variance_field || cfg.lineVarianceField || 'variance_quantity',
      line_status_field: cfg.line_status_field || cfg.lineStatusField || 'status',
      session_status_field: cfg.session_status_field || cfg.sessionStatusField || 'status',
      allow_negative_stock:
        cfg.allow_negative_stock === true ||
        cfg.allowNegativeStock === true,
    };
  }

  _invCycleErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invCycleNum(raw, fallback = 0) {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  async startCycleSession(sessionId, payload = {}) {
    const cfg = this._invCycleCfg();
    if (cfg.session_entity !== this.slug) {
      throw this._invCycleErr(
        \`Cycle workflow can only run on '\${cfg.session_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const nowIso = new Date().toISOString();
    return this.repository.withTransaction(async (client) => {
      const session = await this.repository.findByIdForUpdate(this.slug, sessionId, client);
      if (!session) throw this._invCycleErr('Cycle session not found', 404);
      const status = String(session[cfg.session_status_field] || 'Draft');
      if (!['Draft', 'Pending'].includes(status)) {
        throw this._invCycleErr('Only Draft/Pending sessions can be started', 409, { status });
      }

      return this.repository.updateWithClient(
        this.slug,
        sessionId,
        {
          [cfg.session_status_field]: 'InProgress',
          started_at: nowIso,
          note: payload.note || session.note || null,
        },
        client
      );
    });
  }

  async recalculateCycleCount(sessionId, payload = {}) {
    const cfg = this._invCycleCfg();
    if (cfg.session_entity !== this.slug) {
      throw this._invCycleErr(
        \`Cycle workflow can only run on '\${cfg.session_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const session = await this.repository.findByIdForUpdate(this.slug, sessionId, client);
      if (!session) throw this._invCycleErr('Cycle session not found', 404);

      const lines = await this.repository.findAllWithClient(
        cfg.line_entity,
        { [cfg.line_session_field]: sessionId },
        client
      );
      if (!Array.isArray(lines) || lines.length === 0) {
        throw this._invCycleErr('Cycle session has no lines', 400);
      }

      let totalLines = 0;
      let varianceTotal = 0;
      let countedLines = 0;
      for (const line of lines) {
        const lineId = line.id;
        const itemId = line[cfg.line_item_field];
        if (!lineId || !itemId) continue;

        const stockItem = await this.repository.findByIdForUpdate(cfg.stock_entity, itemId, client);
        const expected = this._invCycleNum(stockItem ? stockItem[cfg.quantity_field] : 0, 0);
        const counted = this._invCycleNum(line[cfg.line_counted_field], expected);
        const variance = counted - expected;
        const lineStatus =
          line[cfg.line_counted_field] !== undefined &&
          line[cfg.line_counted_field] !== null &&
          line[cfg.line_counted_field] !== ''
            ? 'Counted'
            : 'Pending';

        await this.repository.updateWithClient(
          cfg.line_entity,
          lineId,
          {
            [cfg.line_expected_field]: expected,
            [cfg.line_variance_field]: variance,
            [cfg.line_status_field]: lineStatus,
          },
          client
        );

        totalLines += 1;
        if (lineStatus === 'Counted') countedLines += 1;
        varianceTotal += variance;
      }

      const sessionStatus = countedLines > 0 ? 'PendingApproval' : 'InProgress';
      const updatedSession = await this.repository.updateWithClient(
        this.slug,
        sessionId,
        {
          [cfg.session_status_field]: sessionStatus,
          note: payload.note || session.note || null,
        },
        client
      );

      return {
        session: updatedSession,
        totals: {
          line_count: totalLines,
          counted_line_count: countedLines,
          variance_total: varianceTotal,
        },
      };
    });
  }

  async approveCycleSession(sessionId, payload = {}) {
    const cfg = this._invCycleCfg();
    if (cfg.session_entity !== this.slug) {
      throw this._invCycleErr(
        \`Cycle workflow can only run on '\${cfg.session_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const nowIso = new Date().toISOString();
    return this.repository.withTransaction(async (client) => {
      const session = await this.repository.findByIdForUpdate(this.slug, sessionId, client);
      if (!session) throw this._invCycleErr('Cycle session not found', 404);
      const status = String(session[cfg.session_status_field] || 'Draft');
      if (status !== 'PendingApproval') {
        throw this._invCycleErr('Only PendingApproval sessions can be approved (run Recalculate first)', 409, { status });
      }

      return this.repository.updateWithClient(
        this.slug,
        sessionId,
        {
          [cfg.session_status_field]: 'Approved',
          approved_at: nowIso,
          approved_by: payload.approved_by || payload.approvedBy || session.approved_by || null,
          note: payload.note || session.note || null,
        },
        client
      );
    });
  }

  async postCycleSession(sessionId, payload = {}) {
    const cfg = this._invCycleCfg();
    if (cfg.session_entity !== this.slug) {
      throw this._invCycleErr(
        \`Cycle workflow can only run on '\${cfg.session_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const session = await this.repository.findByIdForUpdate(this.slug, sessionId, client);
      if (!session) throw this._invCycleErr('Cycle session not found', 404);

      const status = String(session[cfg.session_status_field] || 'Draft');
      if (status !== 'Approved') {
        throw this._invCycleErr('Only Approved sessions can be posted (run Approve first)', 409, { status });
      }

      const lines = await this.repository.findAllWithClient(
        cfg.line_entity,
        { [cfg.line_session_field]: sessionId },
        client
      );
      if (!Array.isArray(lines) || lines.length === 0) {
        throw this._invCycleErr('Cycle session has no lines', 400);
      }

      let postedLines = 0;
      let netAdjustment = 0;
      const stockChanges = [];
      for (const line of lines) {
        const lineId = line.id;
        const itemId = line[cfg.line_item_field];
        if (!lineId || !itemId) continue;

        let variance = this._invCycleNum(line[cfg.line_variance_field], null);
        if (variance === null) {
          const expected = this._invCycleNum(line[cfg.line_expected_field], 0);
          const counted = this._invCycleNum(line[cfg.line_counted_field], expected);
          variance = counted - expected;
        }

        if (variance !== 0) {
          const updatedStock = await this.repository.atomicAdjustQuantity(
            cfg.stock_entity,
            itemId,
            variance,
            {
              quantityField: cfg.quantity_field,
              allow_negative_stock: cfg.allow_negative_stock,
            },
            client
          );
          stockChanges.push({
            item_id: itemId,
            delta: variance,
            quantity: updatedStock ? updatedStock[cfg.quantity_field] : null,
          });
        }

        await this.repository.updateWithClient(
          cfg.line_entity,
          lineId,
          {
            [cfg.line_variance_field]: variance,
            [cfg.line_status_field]: 'Posted',
          },
          client
        );

        postedLines += 1;
        netAdjustment += variance;
      }

      const nowIso = new Date().toISOString();
      const postedSession = await this.repository.updateWithClient(
        this.slug,
        sessionId,
        {
          [cfg.session_status_field]: 'Posted',
          posted_at: nowIso,
          note: payload.note || session.note || null,
        },
        client
      );

      return {
        session: postedSession,
        totals: {
          posted_lines: postedLines,
          net_adjustment: netAdjustment,
        },
        stock_changes: stockChanges,
      };
    });
  }
  `,
};
