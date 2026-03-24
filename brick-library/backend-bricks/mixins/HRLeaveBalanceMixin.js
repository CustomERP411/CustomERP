module.exports = (config = {}) => {
  const defaults = {
    employee_entity: 'employees',
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
    work_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const __cfg = this._hrLeaveCfg();
      if (this.slug === __cfg.leave_entity && data) {
        const __start = data[__cfg.start_date_field];
        const __end = data[__cfg.end_date_field];
        if ((__start || __end) && data[__cfg.days_field] === undefined) {
          const __days = this._hrLeaveCalcDays(__start, __end, __cfg);
          if (__days !== null) data[__cfg.days_field] = __days;
        }
        if (data[__cfg.status_field] === undefined || data[__cfg.status_field] === null || data[__cfg.status_field] === '') {
          data[__cfg.status_field] = 'Pending';
        }
      }
      if (this.slug === __cfg.balance_entity && data) {
        const __entitlement = this._hrLeaveRound(data[__cfg.entitlement_field] ?? __cfg.default_entitlement);
        const __accrued = this._hrLeaveRound(data[__cfg.accrued_field] ?? __entitlement);
        const __consumed = this._hrLeaveRound(data[__cfg.consumed_field] ?? 0);
        const __carry = this._hrLeaveRound(data[__cfg.carry_forward_field] ?? 0);
        const __available = this._hrLeaveRound(
          data[__cfg.available_field] !== undefined
            ? data[__cfg.available_field]
            : (__entitlement + __accrued + __carry - __consumed)
        );
        data[__cfg.entitlement_field] = __entitlement;
        data[__cfg.accrued_field] = __accrued;
        data[__cfg.consumed_field] = __consumed;
        data[__cfg.carry_forward_field] = __carry;
        data[__cfg.available_field] = __available;
        if (!data[__cfg.fiscal_year_field]) data[__cfg.fiscal_year_field] = String(new Date().getFullYear());
      }
    `,
      BEFORE_UPDATE_VALIDATION: `
      const __cfg = this._hrLeaveCfg();
      if (this.slug === __cfg.leave_entity && data) {
        const __hasStart = Object.prototype.hasOwnProperty.call(data, __cfg.start_date_field);
        const __hasEnd = Object.prototype.hasOwnProperty.call(data, __cfg.end_date_field);
        if (__hasStart || __hasEnd) {
          const __existing = await this.repository.findById(this.slug, id);
          const __start = __hasStart ? data[__cfg.start_date_field] : (__existing ? __existing[__cfg.start_date_field] : null);
          const __end = __hasEnd ? data[__cfg.end_date_field] : (__existing ? __existing[__cfg.end_date_field] : null);
          const __days = this._hrLeaveCalcDays(__start, __end, __cfg);
          if (__days !== null) data[__cfg.days_field] = __days;
        }
      }
    `,
    },
    methods: `
  _hrLeaveCfg() {
    const cfg =
      this.mixinConfig?.hr_leave_balance ||
      this.mixinConfig?.hrLeaveBalance ||
      this.mixinConfig?.hr_leave_engine ||
      this.mixinConfig?.hrLeaveEngine ||
      {};
    return {
      employee_entity: cfg.employee_entity || cfg.employeeEntity || '${merged.employee_entity}',
      leave_entity: cfg.leave_entity || cfg.leaveEntity || '${merged.leave_entity}',
      balance_entity: cfg.balance_entity || cfg.balanceEntity || '${merged.balance_entity}',
      employee_field: cfg.employee_field || cfg.employeeField || '${merged.employee_field}',
      leave_type_field: cfg.leave_type_field || cfg.leaveTypeField || '${merged.leave_type_field}',
      start_date_field: cfg.start_date_field || cfg.startDateField || '${merged.start_date_field}',
      end_date_field: cfg.end_date_field || cfg.endDateField || '${merged.end_date_field}',
      days_field: cfg.days_field || cfg.daysField || '${merged.days_field}',
      status_field: cfg.status_field || cfg.statusField || '${merged.status_field}',
      entitlement_field: cfg.entitlement_field || cfg.entitlementField || '${merged.entitlement_field}',
      accrued_field: cfg.accrued_field || cfg.accruedField || '${merged.accrued_field}',
      consumed_field: cfg.consumed_field || cfg.consumedField || '${merged.consumed_field}',
      carry_forward_field: cfg.carry_forward_field || cfg.carryForwardField || '${merged.carry_forward_field}',
      available_field: cfg.available_field || cfg.availableField || '${merged.available_field}',
      fiscal_year_field: cfg.fiscal_year_field || cfg.fiscalYearField || '${merged.fiscal_year_field}',
      last_accrual_at_field: cfg.last_accrual_at_field || cfg.lastAccrualAtField || '${merged.last_accrual_at_field}',
      default_entitlement: Number(cfg.default_entitlement || cfg.defaultEntitlement || ${Number(merged.default_entitlement) || 18}) || ${Number(merged.default_entitlement) || 18},
      auto_create_balance:
        cfg.auto_create_balance !== false &&
        cfg.autoCreateBalance !== false,
      work_days:
        (Array.isArray(cfg.work_days) && cfg.work_days.length ? cfg.work_days : null) ||
        (Array.isArray(cfg.workDays) && cfg.workDays.length ? cfg.workDays : null) ||
        ${JSON.stringify(Array.isArray(merged.work_days) ? merged.work_days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])},
    };
  }

  _hrLeaveErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _hrLeaveRound(rawValue) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  _hrLeaveWeekdayToken(dateObj) {
    const idx = dateObj.getUTCDay();
    const map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return map[idx] || 'Mon';
  }

  _hrLeaveCalcDays(startRaw, endRaw, cfg) {
    if (!startRaw || !endRaw) return null;
    const start = new Date(startRaw);
    const end = new Date(endRaw);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      throw this._hrLeaveErr('Invalid leave date range', 400);
    }
    if (end.getTime() < start.getTime()) {
      throw this._hrLeaveErr('Leave end date must be on or after start date', 400);
    }
    const allowed = new Set((Array.isArray(cfg.work_days) ? cfg.work_days : []).map((x) => String(x)));
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const stop = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    let total = 0;
    while (cursor.getTime() <= stop.getTime()) {
      const token = this._hrLeaveWeekdayToken(cursor);
      if (!allowed.size || allowed.has(token)) total += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return total;
  }

  _hrLeaveYearFromDates(startRaw, endRaw) {
    const start = startRaw ? new Date(startRaw) : null;
    const end = endRaw ? new Date(endRaw) : null;
    if (start && Number.isFinite(start.getTime())) return String(start.getUTCFullYear());
    if (end && Number.isFinite(end.getTime())) return String(end.getUTCFullYear());
    return String(new Date().getUTCFullYear());
  }

  async recalculateLeaveDays(leaveId, payload = {}) {
    const cfg = this._hrLeaveCfg();
    if (this.slug !== cfg.leave_entity) {
      throw this._hrLeaveErr(
        \`Leave day recalculation can only run on '\${cfg.leave_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const row = await this.repository.findByIdForUpdate(cfg.leave_entity, leaveId, client);
      if (!row) throw this._hrLeaveErr('Leave request not found', 404);

      const start = payload[cfg.start_date_field] ?? row[cfg.start_date_field];
      const end = payload[cfg.end_date_field] ?? row[cfg.end_date_field];
      const days = this._hrLeaveCalcDays(start, end, cfg);
      const updated = await this.repository.updateWithClient(cfg.leave_entity, leaveId, {
        [cfg.days_field]: days,
      }, client);
      return {
        leave: updated,
        operation: 'recalculate_days',
      };
    });
  }

  async _hrLeaveFindOrCreateBalance(client, cfg, employeeId, leaveType, fiscalYear, seed = {}) {
    const existing = await this.repository.findAllWithClient(cfg.balance_entity, {
      [cfg.employee_field]: employeeId,
      [cfg.leave_type_field]: leaveType,
      [cfg.fiscal_year_field]: fiscalYear,
    }, client);
    if (Array.isArray(existing) && existing.length > 0) {
      return existing[0];
    }

    if (!cfg.auto_create_balance) {
      throw this._hrLeaveErr('Leave balance record is missing and auto-create is disabled', 404);
    }

    const entitlement = this._hrLeaveRound(seed[cfg.entitlement_field] ?? cfg.default_entitlement);
    const accrued = this._hrLeaveRound(seed[cfg.accrued_field] ?? entitlement);
    const consumed = this._hrLeaveRound(seed[cfg.consumed_field] ?? 0);
    const carryForward = this._hrLeaveRound(seed[cfg.carry_forward_field] ?? 0);
    const available = this._hrLeaveRound(
      seed[cfg.available_field] !== undefined
        ? seed[cfg.available_field]
        : (entitlement + accrued + carryForward - consumed)
    );

    return this.repository.createWithClient(cfg.balance_entity, {
      [cfg.employee_field]: employeeId,
      [cfg.leave_type_field]: leaveType,
      [cfg.fiscal_year_field]: fiscalYear,
      [cfg.entitlement_field]: entitlement,
      [cfg.accrued_field]: accrued,
      [cfg.consumed_field]: consumed,
      [cfg.carry_forward_field]: carryForward,
      [cfg.available_field]: available,
      [cfg.last_accrual_at_field]: new Date().toISOString(),
      note: seed.note || null,
    }, client);
  }

  async getEmployeeLeaveBalance(employeeId, filter = {}) {
    const cfg = this._hrLeaveCfg();
    if (this.slug !== cfg.employee_entity && this.slug !== cfg.leave_entity) {
      throw this._hrLeaveErr(
        \`Leave balance query can run on '\${cfg.employee_entity}' or '\${cfg.leave_entity}'. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    const where = {
      [cfg.employee_field]: employeeId,
    };
    if (filter && filter.leave_type) where[cfg.leave_type_field] = filter.leave_type;
    if (filter && filter[cfg.leave_type_field]) where[cfg.leave_type_field] = filter[cfg.leave_type_field];
    if (filter && filter.year) where[cfg.fiscal_year_field] = String(filter.year);
    if (filter && filter[cfg.fiscal_year_field]) where[cfg.fiscal_year_field] = String(filter[cfg.fiscal_year_field]);
    return this.repository.findAll(cfg.balance_entity, where);
  }

  async _hrLeaveApplyBalanceChange(employeeId, payload = {}, mode = 'accrue') {
    const cfg = this._hrLeaveCfg();
    const leaveType = String(
      payload.leave_type ||
      payload.leaveType ||
      payload[cfg.leave_type_field] ||
      'Annual'
    ).trim();
    if (!leaveType) throw this._hrLeaveErr('leave_type is required', 400);
    const fiscalYear = String(
      payload.year ||
      payload.fiscal_year ||
      payload.fiscalYear ||
      payload[cfg.fiscal_year_field] ||
      new Date().getUTCFullYear()
    );
    const amount = Number(
      payload.amount ??
      payload.delta ??
      payload.accrued_delta ??
      payload.available_delta
    );
    if (!Number.isFinite(amount) || amount === 0) {
      throw this._hrLeaveErr('amount must be non-zero', 400);
    }

    return this.repository.withTransaction(async (client) => {
      await this._hrLeaveFindOrCreateBalance(client, cfg, employeeId, leaveType, fiscalYear, payload);

      if (this.repository && typeof this.repository.atomicAdjustLeaveBalance === 'function') {
        const adjusted = await this.repository.atomicAdjustLeaveBalance(
          cfg.balance_entity,
          {
            [cfg.employee_field]: employeeId,
            [cfg.leave_type_field]: leaveType,
            [cfg.fiscal_year_field]: fiscalYear,
          },
          {
            employee_field: cfg.employee_field,
            leave_type_field: cfg.leave_type_field,
            fiscal_year_field: cfg.fiscal_year_field,
            entitlement_field: cfg.entitlement_field,
            accrued_field: cfg.accrued_field,
            consumed_field: cfg.consumed_field,
            carry_forward_field: cfg.carry_forward_field,
            available_field: cfg.available_field,
            entitlement_delta: mode === 'accrue' ? 0 : 0,
            accrued_delta: mode === 'accrue' ? amount : 0,
            available_delta: mode === 'adjust' ? amount : 0,
            last_accrual_at_field: cfg.last_accrual_at_field,
            create_if_missing: true,
            default_entitlement: cfg.default_entitlement,
            note: payload.note || null,
          },
          client
        );
        return {
          balance: adjusted,
          operation: mode,
        };
      }

      const matches = await this.repository.findAllWithClient(cfg.balance_entity, {
        [cfg.employee_field]: employeeId,
        [cfg.leave_type_field]: leaveType,
        [cfg.fiscal_year_field]: fiscalYear,
      }, client);
      const balance = Array.isArray(matches) && matches.length ? matches[0] : null;
      if (!balance) throw this._hrLeaveErr('Leave balance not found', 404);

      const accrued = this._hrLeaveRound(balance[cfg.accrued_field] || 0);
      const available = this._hrLeaveRound(balance[cfg.available_field] || 0);
      const patch = {
        [cfg.last_accrual_at_field]: new Date().toISOString(),
      };
      if (mode === 'accrue') {
        patch[cfg.accrued_field] = this._hrLeaveRound(accrued + amount);
      }
      if (mode === 'adjust') {
        patch[cfg.available_field] = this._hrLeaveRound(available + amount);
      }
      const updated = await this.repository.updateWithClient(cfg.balance_entity, balance.id, patch, client);
      return {
        balance: updated,
        operation: mode,
      };
    });
  }

  async accrueLeaveBalance(employeeId, payload = {}) {
    const cfg = this._hrLeaveCfg();
    if (this.slug !== cfg.employee_entity) {
      throw this._hrLeaveErr(
        \`Leave accrual can only run on '\${cfg.employee_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    return this._hrLeaveApplyBalanceChange(employeeId, payload, 'accrue');
  }

  async adjustLeaveBalance(employeeId, payload = {}) {
    const cfg = this._hrLeaveCfg();
    if (this.slug !== cfg.employee_entity) {
      throw this._hrLeaveErr(
        \`Leave adjustment can only run on '\${cfg.employee_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    return this._hrLeaveApplyBalanceChange(employeeId, payload, 'adjust');
  }

  async applyLeaveConsumption(leaveId, payload = {}) {
    const cfg = this._hrLeaveCfg();
    if (this.slug !== cfg.leave_entity) {
      throw this._hrLeaveErr(
        \`Leave consumption can only run on '\${cfg.leave_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const leave = await this.repository.findByIdForUpdate(cfg.leave_entity, leaveId, client);
      if (!leave) throw this._hrLeaveErr('Leave request not found', 404);

      const employeeId = leave[cfg.employee_field];
      if (!employeeId) throw this._hrLeaveErr('Leave request is missing employee reference', 400);

      const leaveType = String(leave[cfg.leave_type_field] || '').trim();
      if (!leaveType) throw this._hrLeaveErr('Leave request is missing leave type', 400);

      const start = payload[cfg.start_date_field] ?? leave[cfg.start_date_field];
      const end = payload[cfg.end_date_field] ?? leave[cfg.end_date_field];
      const leaveDays = this._hrLeaveRound(
        payload[cfg.days_field] ??
        leave[cfg.days_field] ??
        this._hrLeaveCalcDays(start, end, cfg)
      );
      if (!Number.isFinite(leaveDays) || leaveDays <= 0) {
        throw this._hrLeaveErr('Leave days must be greater than zero', 400);
      }

      const fiscalYear = String(
        payload[cfg.fiscal_year_field] ||
        this._hrLeaveYearFromDates(start, end)
      );

      await this._hrLeaveFindOrCreateBalance(client, cfg, employeeId, leaveType, fiscalYear, payload);
      let balance;
      if (this.repository && typeof this.repository.atomicAdjustLeaveBalance === 'function') {
        balance = await this.repository.atomicAdjustLeaveBalance(
          cfg.balance_entity,
          {
            [cfg.employee_field]: employeeId,
            [cfg.leave_type_field]: leaveType,
            [cfg.fiscal_year_field]: fiscalYear,
          },
          {
            employee_field: cfg.employee_field,
            leave_type_field: cfg.leave_type_field,
            fiscal_year_field: cfg.fiscal_year_field,
            entitlement_field: cfg.entitlement_field,
            accrued_field: cfg.accrued_field,
            consumed_field: cfg.consumed_field,
            carry_forward_field: cfg.carry_forward_field,
            available_field: cfg.available_field,
            consumed_delta: leaveDays,
            available_delta: -leaveDays,
            create_if_missing: true,
            default_entitlement: cfg.default_entitlement,
          },
          client
        );
      }

      const updatedLeave = await this.repository.updateWithClient(cfg.leave_entity, leaveId, {
        [cfg.days_field]: leaveDays,
      }, client);

      return {
        leave: updatedLeave,
        balance: balance || null,
      };
    });
  }
    `,
  };
};
