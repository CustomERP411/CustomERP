module.exports = (config = {}) => {
  const defaults = {
    employee_entity: 'employees',
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
    ledger_posted_at_field: 'posted_at',
    ledger_post_reference_field: 'post_reference',
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const __cfg = this._hrCompCfg();
      if (this.slug === __cfg.ledger_entity && data) {
        if (data[__cfg.ledger_status_field] === undefined || data[__cfg.ledger_status_field] === null || data[__cfg.ledger_status_field] === '') {
          data[__cfg.ledger_status_field] = 'Draft';
        }
      }
      if (this.slug === __cfg.snapshot_entity && data) {
        if (data[__cfg.snapshot_status_field] === undefined || data[__cfg.snapshot_status_field] === null || data[__cfg.snapshot_status_field] === '') {
          data[__cfg.snapshot_status_field] = 'Draft';
        }
      }
    `,
    },
    methods: `
  _hrCompCfg() {
    const cfg =
      this.mixinConfig?.hr_compensation_ledger ||
      this.mixinConfig?.hrCompensationLedger ||
      {};
    return {
      employee_entity: cfg.employee_entity || cfg.employeeEntity || '${merged.employee_entity}',
      ledger_entity: cfg.ledger_entity || cfg.ledgerEntity || '${merged.ledger_entity}',
      snapshot_entity: cfg.snapshot_entity || cfg.snapshotEntity || '${merged.snapshot_entity}',
      ledger_employee_field: cfg.ledger_employee_field || cfg.ledgerEmployeeField || '${merged.ledger_employee_field}',
      ledger_period_field: cfg.ledger_period_field || cfg.ledgerPeriodField || '${merged.ledger_period_field}',
      ledger_component_field: cfg.ledger_component_field || cfg.ledgerComponentField || '${merged.ledger_component_field}',
      ledger_type_field: cfg.ledger_type_field || cfg.ledgerTypeField || '${merged.ledger_type_field}',
      ledger_amount_field: cfg.ledger_amount_field || cfg.ledgerAmountField || '${merged.ledger_amount_field}',
      ledger_status_field: cfg.ledger_status_field || cfg.ledgerStatusField || '${merged.ledger_status_field}',
      snapshot_employee_field: cfg.snapshot_employee_field || cfg.snapshotEmployeeField || '${merged.snapshot_employee_field}',
      snapshot_period_field: cfg.snapshot_period_field || cfg.snapshotPeriodField || '${merged.snapshot_period_field}',
      snapshot_gross_field: cfg.snapshot_gross_field || cfg.snapshotGrossField || '${merged.snapshot_gross_field}',
      snapshot_deduction_field: cfg.snapshot_deduction_field || cfg.snapshotDeductionField || '${merged.snapshot_deduction_field}',
      snapshot_net_field: cfg.snapshot_net_field || cfg.snapshotNetField || '${merged.snapshot_net_field}',
      snapshot_status_field: cfg.snapshot_status_field || cfg.snapshotStatusField || '${merged.snapshot_status_field}',
      snapshot_posted_at_field: cfg.snapshot_posted_at_field || cfg.snapshotPostedAtField || '${merged.snapshot_posted_at_field}',
      ledger_posted_at_field: cfg.ledger_posted_at_field || cfg.ledgerPostedAtField || '${merged.ledger_posted_at_field}',
      ledger_post_reference_field: cfg.ledger_post_reference_field || cfg.ledgerPostReferenceField || '${merged.ledger_post_reference_field}',
    };
  }

  _hrCompErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _hrCompRound(rawValue) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  _hrCompType(rawType) {
    const value = String(rawType || '').trim().toLowerCase();
    if (value === 'earning' || value === 'earnings') return 'Earning';
    if (value === 'deduction' || value === 'deductions') return 'Deduction';
    throw this._hrCompErr('component_type must be Earning or Deduction', 400);
  }

  async createCompensationSnapshot(payload = {}) {
    const cfg = this._hrCompCfg();
    if (this.slug !== cfg.ledger_entity) {
      throw this._hrCompErr(
        \`Compensation snapshot creation can only run on '\${cfg.ledger_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const employeeId = payload[cfg.ledger_employee_field] || payload.employee_id || payload.employeeId;
    const payPeriod = payload[cfg.ledger_period_field] || payload.pay_period || payload.payPeriod;
    if (!employeeId) throw this._hrCompErr('employee_id is required', 400);
    if (!payPeriod) throw this._hrCompErr('pay_period is required', 400);

    return this.repository.withTransaction(async (client) => {
      if (this.repository && typeof this.repository.atomicApplyCompensationSnapshot === 'function') {
        return this.repository.atomicApplyCompensationSnapshot(
          cfg.ledger_entity,
          cfg.snapshot_entity,
          {
            employee_id: employeeId,
            pay_period: payPeriod,
            ledger_employee_field: cfg.ledger_employee_field,
            ledger_period_field: cfg.ledger_period_field,
            ledger_type_field: cfg.ledger_type_field,
            ledger_amount_field: cfg.ledger_amount_field,
            ledger_status_field: cfg.ledger_status_field,
            snapshot_employee_field: cfg.snapshot_employee_field,
            snapshot_period_field: cfg.snapshot_period_field,
            snapshot_gross_field: cfg.snapshot_gross_field,
            snapshot_deduction_field: cfg.snapshot_deduction_field,
            snapshot_net_field: cfg.snapshot_net_field,
            snapshot_status_field: cfg.snapshot_status_field,
            snapshot_posted_at_field: cfg.snapshot_posted_at_field,
            include_statuses: payload.include_statuses || payload.includeStatuses || ['Draft', 'Posted'],
            snapshot_note: payload.note || null,
          },
          client
        );
      }

      const entries = await this.repository.findAllWithClient(cfg.ledger_entity, {
        [cfg.ledger_employee_field]: employeeId,
        [cfg.ledger_period_field]: payPeriod,
      }, client);
      const rows = Array.isArray(entries) ? entries : [];
      let gross = 0;
      let deductions = 0;
      for (const row of rows) {
        const amount = this._hrCompRound(row[cfg.ledger_amount_field] || 0);
        const type = this._hrCompType(row[cfg.ledger_type_field] || 'Earning');
        if (type === 'Earning') gross += amount;
        else deductions += amount;
      }
      gross = this._hrCompRound(gross);
      deductions = this._hrCompRound(deductions);
      const net = this._hrCompRound(gross - deductions);

      const existingSnapshots = await this.repository.findAllWithClient(cfg.snapshot_entity, {
        [cfg.snapshot_employee_field]: employeeId,
        [cfg.snapshot_period_field]: payPeriod,
      }, client);
      const snapshot = Array.isArray(existingSnapshots) && existingSnapshots.length ? existingSnapshots[0] : null;
      const patch = {
        [cfg.snapshot_employee_field]: employeeId,
        [cfg.snapshot_period_field]: payPeriod,
        [cfg.snapshot_gross_field]: gross,
        [cfg.snapshot_deduction_field]: deductions,
        [cfg.snapshot_net_field]: net,
        [cfg.snapshot_status_field]: 'Draft',
      };
      if (payload.note !== undefined) patch.note = payload.note;

      const updatedSnapshot = snapshot
        ? await this.repository.updateWithClient(cfg.snapshot_entity, snapshot.id, patch, client)
        : await this.repository.createWithClient(cfg.snapshot_entity, patch, client);

      return {
        snapshot: updatedSnapshot,
        totals: {
          gross_amount: gross,
          deduction_amount: deductions,
          net_amount: net,
          entry_count: rows.length,
        },
      };
    });
  }

  async postCompensationLedger(entryId, payload = {}) {
    const cfg = this._hrCompCfg();
    if (this.slug !== cfg.ledger_entity) {
      throw this._hrCompErr(
        \`Compensation ledger posting can only run on '\${cfg.ledger_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const row = await this.repository.findByIdForUpdate(cfg.ledger_entity, entryId, client);
      if (!row) throw this._hrCompErr('Ledger entry not found', 404);
      const status = String(row[cfg.ledger_status_field] || 'Draft');
      if (status === 'Cancelled') {
        throw this._hrCompErr('Cancelled ledger entry cannot be posted', 409);
      }
      const updated = await this.repository.updateWithClient(cfg.ledger_entity, entryId, {
        [cfg.ledger_status_field]: 'Posted',
        [cfg.ledger_posted_at_field]: row[cfg.ledger_posted_at_field] || new Date().toISOString(),
        [cfg.ledger_post_reference_field]: payload.post_reference || payload.postReference || payload[cfg.ledger_post_reference_field] || null,
      }, client);
      return {
        ledger_entry: updated,
      };
    });
  }

  async postCompensationSnapshot(snapshotId, payload = {}) {
    const cfg = this._hrCompCfg();
    if (this.slug !== cfg.snapshot_entity) {
      throw this._hrCompErr(
        \`Compensation snapshot posting can only run on '\${cfg.snapshot_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const snapshot = await this.repository.findByIdForUpdate(cfg.snapshot_entity, snapshotId, client);
      if (!snapshot) throw this._hrCompErr('Compensation snapshot not found', 404);
      const updatedSnapshot = await this.repository.updateWithClient(cfg.snapshot_entity, snapshotId, {
        [cfg.snapshot_status_field]: 'Posted',
        [cfg.snapshot_posted_at_field]: snapshot[cfg.snapshot_posted_at_field] || new Date().toISOString(),
        post_note: payload.note || null,
      }, client);
      return {
        snapshot: updatedSnapshot,
      };
    });
  }
    `,
  };
};
