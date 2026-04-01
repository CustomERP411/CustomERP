const { v4: uuid } = require('uuid');
const { getDb } = require('./sqliteDb');

class SQLiteProvider {
  constructor() {
    this._columnsCache = new Map();
    this._inTransaction = false;
  }

  _buildError(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _quoteIdent(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
  }

  _normalizeSlug(entitySlug) {
    const slug = String(entitySlug || '').trim();
    if (!slug) throw new Error('Entity slug is required');
    return slug;
  }

  /* ------------------------------------------------------------------ */
  /*  Column introspection (mirrors PostgresProvider._getColumns shape)  */
  /* ------------------------------------------------------------------ */

  async _getColumns(entitySlug) {
    const slug = this._normalizeSlug(entitySlug);
    if (this._columnsCache.has(slug)) return this._columnsCache.get(slug);

    const db = getDb();
    const rows = db.prepare(`PRAGMA table_info(${this._quoteIdent(slug)})`).all();
    if (!rows.length) {
      throw new Error(`Table '${slug}' does not exist. Did you run migrations?`);
    }

    const columns = rows.map((r) => {
      const raw = String(r.type || '').toUpperCase();
      let dataType = 'text';
      if (raw.includes('INT')) dataType = 'integer';
      else if (
        raw.includes('REAL') ||
        raw.includes('DOUBLE') ||
        raw.includes('FLOAT') ||
        raw.includes('NUMERIC')
      )
        dataType = 'real';
      return { column_name: r.name, data_type: dataType };
    });

    this._columnsCache.set(slug, columns);
    return columns;
  }

  _columnsMap(columns) {
    const out = new Map();
    for (const col of columns || []) out.set(col.column_name, col);
    return out;
  }

  /* ------------------------------------------------------------------ */
  /*  Value preparation / row normalisation                              */
  /* ------------------------------------------------------------------ */

  _prepareValue(raw, columnDef) {
    if (!columnDef) {
      if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
      return raw;
    }
    if (raw === undefined) return undefined;
    if (raw === null) return null;

    const t = String(columnDef.data_type || '').toLowerCase();

    if (raw === '' && t !== 'text') return null;

    if (t === 'integer') {
      if (typeof raw === 'boolean') return raw ? 1 : 0;
      const v = String(raw).trim().toLowerCase();
      if (['true', 'yes', 'y'].includes(v)) return 1;
      if (['false', 'no', 'n'].includes(v)) return 0;
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid integer value for '${columnDef.column_name}'`);
      return Math.round(n);
    }

    if (t === 'real' || t === 'numeric' || t === 'double precision') {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid numeric value for '${columnDef.column_name}'`);
      return n;
    }

    if (typeof raw === 'object' && raw !== null) return JSON.stringify(raw);
    return raw;
  }

  _normalizeRow(row, columns) {
    if (!row) return row;
    const normalized = { ...row };
    for (const col of columns || []) {
      const key = col.column_name;
      if (normalized[key] === null || normalized[key] === undefined) continue;

      const t = String(col.data_type || '').toLowerCase();
      if (t === 'integer' || t === 'real' || t === 'numeric') {
        const n = Number(normalized[key]);
        normalized[key] = Number.isFinite(n) ? n : normalized[key];
      } else if (t === 'text' && typeof normalized[key] === 'string') {
        const s = normalized[key].trim();
        if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
          try { normalized[key] = JSON.parse(s); } catch (_) { /* keep string */ }
        }
      }
    }
    return normalized;
  }

  /* ------------------------------------------------------------------ */
  /*  Core CRUD                                                          */
  /* ------------------------------------------------------------------ */

  async findAll(entitySlug, filter = {}) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug);
    const columnsMap = this._columnsMap(columns);
    const table = this._quoteIdent(slug);
    const db = getDb();

    const where = [];
    const params = [];

    for (const [rawKey, rawVal] of Object.entries(filter || {})) {
      const key = String(rawKey || '').trim();
      if (!key) continue;
      if (!columnsMap.has(key)) return [];

      if (Array.isArray(rawVal)) {
        if (rawVal.length === 0) return [];
        const placeholders = rawVal.map(() => '?').join(', ');
        where.push(`CAST(${this._quoteIdent(key)} AS TEXT) IN (${placeholders})`);
        for (const v of rawVal) params.push(String(v));
      } else {
        params.push(String(rawVal));
        where.push(`CAST(${this._quoteIdent(key)} AS TEXT) = ?`);
      }
    }

    let sql = `SELECT * FROM ${table}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${this._quoteIdent('created_at')} ASC`;

    const rows = db.prepare(sql).all(...params);
    return rows.map((r) => this._normalizeRow(r, columns));
  }

  async findById(entitySlug, id) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug);
    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent('id')} = ? LIMIT 1`)
      .get(String(id));
    if (!row) return null;
    return this._normalizeRow(row, columns);
  }

  async create(entitySlug, data) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug);
    const columnsMap = this._columnsMap(columns);
    const table = this._quoteIdent(slug);
    const db = getDb();

    const now = new Date().toISOString();
    const payload = {
      ...(data && typeof data === 'object' ? data : {}),
      id: uuid(),
      created_at: now,
      updated_at: now,
    };
    delete payload.__proto__;
    delete payload.constructor;

    const keys = Object.keys(payload).filter((k) => columnsMap.has(k));
    const values = [];
    for (const key of keys) {
      const prepared = this._prepareValue(payload[key], columnsMap.get(key));
      values.push(prepared);
    }

    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${keys.map((k) => this._quoteIdent(k)).join(', ')})
      VALUES (${placeholders})
      RETURNING *`;
    const row = db.prepare(sql).get(...values);
    return this._normalizeRow(row, columns);
  }

  async update(entitySlug, id, data) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug);
    const columnsMap = this._columnsMap(columns);
    const table = this._quoteIdent(slug);
    const db = getDb();
    const payload = data && typeof data === 'object' ? { ...data } : {};

    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.__proto__;
    delete payload.constructor;

    const sets = [];
    const values = [];
    for (const [key, raw] of Object.entries(payload)) {
      if (!columnsMap.has(key)) continue;
      values.push(this._prepareValue(raw, columnsMap.get(key)));
      sets.push(`${this._quoteIdent(key)} = ?`);
    }
    if (columnsMap.has('updated_at')) {
      values.push(new Date().toISOString());
      sets.push(`${this._quoteIdent('updated_at')} = ?`);
    }
    if (!sets.length) return this.findById(slug, id);

    values.push(String(id));
    const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${this._quoteIdent('id')} = ? RETURNING *`;
    const row = db.prepare(sql).get(...values);
    if (!row) return null;
    return this._normalizeRow(row, columns);
  }

  async delete(entitySlug, id) {
    const slug = this._normalizeSlug(entitySlug);
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent('id')} = ?`)
      .run(String(id));
    return result.changes > 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Transactions                                                       */
  /* ------------------------------------------------------------------ */

  async withTransaction(callback) {
    if (typeof callback !== 'function') {
      throw this._buildError('Transaction callback is required');
    }
    if (this._inTransaction) return callback('tx');

    const db = getDb();
    this._inTransaction = true;
    try {
      db.exec('BEGIN IMMEDIATE');
      const result = await callback('tx');
      db.exec('COMMIT');
      return result;
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch (_) { /* keep original error */ }
      throw error;
    } finally {
      this._inTransaction = false;
    }
  }

  /* *WithClient variants – client param kept for API compat, ignored */
  async findAllWithClient(entitySlug, filter) { return this.findAll(entitySlug, filter); }
  async findByIdWithClient(entitySlug, id) { return this.findById(entitySlug, id); }
  async createWithClient(entitySlug, data) { return this.create(entitySlug, data); }
  async updateWithClient(entitySlug, id, data) { return this.update(entitySlug, id, data); }
  async deleteWithClient(entitySlug, id) { return this.delete(entitySlug, id); }

  /* SQLite uses file-level locking – FOR UPDATE is a no-op */
  async findByIdForUpdate(entitySlug, id, client) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() => this.findByIdForUpdate(entitySlug, id, 'tx'));
    }
    return this.findById(entitySlug, id);
  }

  async findOneByFieldForUpdate(entitySlug, fieldName, value, client) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.findOneByFieldForUpdate(entitySlug, fieldName, value, 'tx')
      );
    }
    const slug = this._normalizeSlug(entitySlug);
    const field = String(fieldName || '').trim();
    if (!field) throw this._buildError('Field name is required for row lock lookup');
    const columns = await this._getColumns(slug);
    const columnsMap = this._columnsMap(columns);
    if (!columnsMap.has(field))
      throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);

    const db = getDb();
    const row = db
      .prepare(`SELECT * FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent(field)} = ? LIMIT 1`)
      .get(value);
    if (!row) return null;
    return this._normalizeRow(row, columns);
  }

  /* ------------------------------------------------------------------ */
  /*  Specialised atomic helpers (same logic, no FOR UPDATE)             */
  /* ------------------------------------------------------------------ */

  async allocatePrefixedNumber(entitySlug, fieldName, prefix = '', options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.allocatePrefixedNumber(entitySlug, fieldName, prefix, options, 'tx')
      );
    }

    const slug = this._normalizeSlug(entitySlug);
    const field = String(fieldName || '').trim();
    if (!field) throw this._buildError('Field name is required for prefixed number allocation');
    const pad = Number(options.padding || options.pad || 6) || 6;
    const safePrefix = String(prefix || '');

    const columns = await this._getColumns(slug);
    if (!this._columnsMap(columns).has(field))
      throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);

    const db = getDb();
    const row = db
      .prepare(
        `SELECT ${this._quoteIdent(field)} AS value FROM ${this._quoteIdent(slug)}
         WHERE ${this._quoteIdent(field)} LIKE ? ORDER BY ${this._quoteIdent(field)} DESC LIMIT 1`
      )
      .get(`${safePrefix}%`);

    const lastValue = row ? String(row.value || '') : '';
    const suffix = lastValue.startsWith(safePrefix) ? lastValue.slice(safePrefix.length) : '';
    const parsed = parseInt(suffix, 10);
    const next = Number.isNaN(parsed) ? 1 : parsed + 1;
    return safePrefix + String(next).padStart(pad, '0');
  }

  async atomicAdjustInvoiceFinancials(entitySlug, id, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.atomicAdjustInvoiceFinancials(entitySlug, id, options, 'tx')
      );
    }

    const grandField = String(options.grandTotalField || options.grand_total_field || 'grand_total');
    const paidField = String(options.paidField || options.paid_field || 'paid_total');
    const outstandingField = String(options.outstandingField || options.outstanding_field || 'outstanding_balance');
    const statusField = String(options.statusField || options.status_field || 'status');
    const grandDelta = Number(options.grandDelta || options.grand_delta || 0);
    const paidDelta = Number(options.paidDelta || options.paid_delta || 0);
    if (!Number.isFinite(grandDelta) || !Number.isFinite(paidDelta))
      throw this._buildError('Invoice delta values must be numeric', 400);

    const locked = await this.findById(entitySlug, id);
    if (!locked) throw this._buildError('Invoice not found', 404);

    const num = (r) => { const n = Number(r); return Number.isFinite(n) ? n : 0; };
    const round = (r) => Number(num(r).toFixed(2));

    const nextGrand = round(num(locked[grandField]) + grandDelta);
    const nextPaid = round(num(locked[paidField]) + paidDelta);
    if (nextGrand < 0)
      throw this._buildError('Invoice grand total cannot be negative', 409, { grand_total: nextGrand });
    if (nextPaid < 0)
      throw this._buildError('Invoice paid total cannot be negative', 409, { paid_total: nextPaid });
    if (nextPaid > nextGrand + 0.0001)
      throw this._buildError('Invoice paid total cannot exceed invoice grand total', 409, { paid_total: nextPaid, grand_total: nextGrand });

    const nextOutstanding = round(Math.max(nextGrand - nextPaid, 0));
    const patch = { [grandField]: nextGrand, [paidField]: nextPaid, [outstandingField]: nextOutstanding };

    if (options.autoStatus === true || options.auto_status === true) {
      const cur = String(locked[statusField] || 'Draft');
      if (cur !== 'Cancelled') {
        patch[statusField] = nextOutstanding <= 0 ? 'Paid' : (cur === 'Draft' || cur === 'Paid' ? 'Sent' : cur);
      }
    }
    if (options.extraPatch && typeof options.extraPatch === 'object') Object.assign(patch, options.extraPatch);
    return this.update(entitySlug, id, patch);
  }

  async atomicAdjustQuantity(entitySlug, id, delta, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.atomicAdjustQuantity(entitySlug, id, delta, options, 'tx')
      );
    }

    const quantityField = String(options.quantityField || options.quantity_field || 'quantity');
    const allowNegative = options.allowNegativeStock === true || options.allow_negative_stock === true;
    const extraPatch = options.extraPatch && typeof options.extraPatch === 'object' ? { ...options.extraPatch } : {};
    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta))
      throw this._buildError(`Invalid stock delta for '${quantityField}'`, 400);

    const locked = await this.findById(entitySlug, id);
    if (!locked) throw this._buildError('Item not found', 404);

    const currentQty = Number(locked[quantityField] || 0);
    if (!Number.isFinite(currentQty))
      throw this._buildError(`Current value of '${quantityField}' is not numeric`, 400);

    const nextQty = currentQty + numericDelta;
    if (!allowNegative && nextQty < 0)
      throw this._buildError('Insufficient stock for requested operation', 409, {
        quantity_field: quantityField, current: currentQty, delta: numericDelta, next: nextQty,
      });

    return this.update(entitySlug, id, { ...extraPatch, [quantityField]: nextQty });
  }

  async atomicAdjustReservation(entitySlug, id, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.atomicAdjustReservation(entitySlug, id, options, 'tx')
      );
    }

    const quantityField = String(options.quantityField || options.quantity_field || 'quantity');
    const reservedField = String(options.reservedField || options.reserved_field || 'reserved_quantity');
    const committedField = String(options.committedField || options.committed_field || 'committed_quantity');
    const availableField = String(options.availableField || options.available_field || 'available_quantity');
    const quantityDelta = Number(options.quantityDelta || options.quantity_delta || 0);
    const reservedDelta = Number(options.reservedDelta || options.reserved_delta || 0);
    const committedDelta = Number(options.committedDelta || options.committed_delta || 0);
    const allowNegative = options.allowNegativeStock === true || options.allow_negative_stock === true;

    if (!Number.isFinite(quantityDelta) || !Number.isFinite(reservedDelta) || !Number.isFinite(committedDelta))
      throw this._buildError('Reservation delta values must be numeric', 400);

    const locked = await this.findById(entitySlug, id);
    if (!locked) throw this._buildError('Item not found', 404);

    const num = (v) => { const p = Number(v); return Number.isFinite(p) ? p : 0; };
    const nextQty = num(locked[quantityField]) + quantityDelta;
    const nextReserved = num(locked[reservedField]) + reservedDelta;
    const nextCommitted = num(locked[committedField]) + committedDelta;

    if (nextReserved < 0 || nextCommitted < 0)
      throw this._buildError('Reserved and committed quantities cannot be negative', 400, { reserved: nextReserved, committed: nextCommitted });
    if (!allowNegative && nextQty < 0)
      throw this._buildError('Stock quantity cannot go negative', 409, { quantity: nextQty });
    if (nextReserved + nextCommitted > nextQty)
      throw this._buildError('Reserved + committed quantities cannot exceed on-hand quantity', 409, { quantity: nextQty, reserved: nextReserved, committed: nextCommitted });

    const patch = { [quantityField]: nextQty, [reservedField]: nextReserved, [committedField]: nextCommitted };
    if (availableField) patch[availableField] = nextQty - nextReserved - nextCommitted;
    return this.update(entitySlug, id, patch);
  }

  async atomicAdjustLeaveBalance(entitySlug, lookup = {}, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.atomicAdjustLeaveBalance(entitySlug, lookup, options, 'tx')
      );
    }

    const slug = this._normalizeSlug(entitySlug);
    const employeeField = String(options.employee_field || options.employeeField || 'employee_id');
    const leaveTypeField = String(options.leave_type_field || options.leaveTypeField || 'leave_type');
    const fiscalYearField = String(options.fiscal_year_field || options.fiscalYearField || 'year');
    const entitlementField = String(options.entitlement_field || options.entitlementField || 'annual_entitlement');
    const accruedField = String(options.accrued_field || options.accruedField || 'accrued_days');
    const consumedField = String(options.consumed_field || options.consumedField || 'consumed_days');
    const carryForwardField = String(options.carry_forward_field || options.carryForwardField || 'carry_forward_days');
    const availableField = String(options.available_field || options.availableField || 'available_days');
    const lastAccrualAtField = String(options.last_accrual_at_field || options.lastAccrualAtField || 'last_accrual_at');

    const employeeId = lookup[employeeField] ?? lookup.employee_id ?? lookup.employeeId ?? null;
    const leaveType = lookup[leaveTypeField] ?? lookup.leave_type ?? lookup.leaveType ?? null;
    const fiscalYear = lookup[fiscalYearField] ?? lookup.fiscal_year ?? lookup.fiscalYear ?? null;
    if (!employeeId) throw this._buildError('employee_id is required for leave balance updates');
    if (!leaveType) throw this._buildError('leave_type is required for leave balance updates');
    if (!fiscalYear) throw this._buildError('fiscal_year is required for leave balance updates');

    const entitlementDelta = Number(options.entitlement_delta || options.entitlementDelta || 0);
    const accruedDelta = Number(options.accrued_delta || options.accruedDelta || 0);
    const consumedDelta = Number(options.consumed_delta || options.consumedDelta || 0);
    const carryForwardDelta = Number(options.carry_forward_delta || options.carryForwardDelta || 0);
    const availableDeltaRaw = options.available_delta ?? options.availableDelta;
    const hasAvailableDelta = availableDeltaRaw !== undefined && availableDeltaRaw !== null && availableDeltaRaw !== '';
    const availableDelta = hasAvailableDelta ? Number(availableDeltaRaw) : 0;
    if (
      !Number.isFinite(entitlementDelta) || !Number.isFinite(accruedDelta) ||
      !Number.isFinite(consumedDelta) || !Number.isFinite(carryForwardDelta) ||
      !Number.isFinite(availableDelta)
    ) throw this._buildError('Leave balance delta values must be numeric', 400);

    const columns = await this._getColumns(slug);
    const columnsMap = this._columnsMap(columns);
    for (const f of [employeeField, leaveTypeField, fiscalYearField, entitlementField, accruedField, consumedField, carryForwardField, availableField]) {
      if (!columnsMap.has(f)) throw this._buildError(`Field '${f}' does not exist on entity '${slug}'`, 400);
    }

    const db = getDb();
    let row = db
      .prepare(
        `SELECT * FROM ${this._quoteIdent(slug)}
         WHERE ${this._quoteIdent(employeeField)} = ?
           AND ${this._quoteIdent(leaveTypeField)} = ?
           AND ${this._quoteIdent(fiscalYearField)} = ?
         LIMIT 1`
      )
      .get(String(employeeId), String(leaveType), String(fiscalYear));
    row = row ? this._normalizeRow(row, columns) : null;

    if (!row && (options.create_if_missing === true || options.createIfMissing === true)) {
      const defaultEntitlement = Number(options.default_entitlement || options.defaultEntitlement || 0);
      const base = Number.isFinite(defaultEntitlement) ? defaultEntitlement : 0;
      const created = await this.create(slug, {
        [employeeField]: employeeId,
        [leaveTypeField]: leaveType,
        [fiscalYearField]: String(fiscalYear),
        [entitlementField]: base,
        [accruedField]: base,
        [consumedField]: 0,
        [carryForwardField]: 0,
        [availableField]: base,
        ...(columnsMap.has(lastAccrualAtField) ? { [lastAccrualAtField]: new Date().toISOString() } : {}),
      });
      row = await this.findById(slug, created.id);
    }
    if (!row) throw this._buildError('Leave balance record not found', 404);

    const num = (v) => { const p = Number(v); return Number.isFinite(p) ? p : 0; };
    const round = (v) => Number(num(v).toFixed(2));

    const nextEntitlement = round(num(row[entitlementField]) + entitlementDelta);
    const nextAccrued = round(num(row[accruedField]) + accruedDelta);
    const nextConsumed = round(num(row[consumedField]) + consumedDelta);
    const nextCarryForward = round(num(row[carryForwardField]) + carryForwardDelta);
    const recomputed = round(nextEntitlement + nextAccrued + nextCarryForward - nextConsumed);
    const nextAvailable = hasAvailableDelta ? round(num(row[availableField]) + availableDelta) : recomputed;

    if (nextEntitlement < 0 || nextAccrued < 0 || nextConsumed < 0 || nextCarryForward < 0)
      throw this._buildError('Leave balance component values cannot be negative', 409, {
        entitlement: nextEntitlement, accrued: nextAccrued, consumed: nextConsumed, carry_forward: nextCarryForward,
      });
    if (!(options.allow_negative_available === true || options.allowNegativeAvailable === true) && nextAvailable < 0)
      throw this._buildError('Leave available balance cannot go negative', 409, { available: nextAvailable });

    const patch = {
      [entitlementField]: nextEntitlement, [accruedField]: nextAccrued, [consumedField]: nextConsumed,
      [carryForwardField]: nextCarryForward, [availableField]: nextAvailable,
    };
    if (columnsMap.has(lastAccrualAtField)) patch[lastAccrualAtField] = new Date().toISOString();
    if (options.note !== undefined && columnsMap.has('note')) patch.note = options.note;
    return this.update(slug, row.id, patch);
  }

  async applyLeaveDecisionIdempotent(entitySlug, id, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.applyLeaveDecisionIdempotent(entitySlug, id, options, 'tx')
      );
    }

    const slug = this._normalizeSlug(entitySlug);
    const statusField = String(options.status_field || options.statusField || 'status');
    const approverField = String(options.approver_field || options.approverField || 'approver_id');
    const approvedAtField = String(options.approved_at_field || options.approvedAtField || 'approved_at');
    const rejectedAtField = String(options.rejected_at_field || options.rejectedAtField || 'rejected_at');
    const cancelledAtField = String(options.cancelled_at_field || options.cancelledAtField || 'cancelled_at');
    const rejectionReasonField = String(options.rejection_reason_field || options.rejectionReasonField || 'rejection_reason');
    const decisionKeyField = String(options.decision_key_field || options.decisionKeyField || 'decision_key');

    const targetStatus = String(options.target_status || options.targetStatus || '').trim();
    if (!targetStatus) throw this._buildError('target_status is required for leave decision');

    const leave = await this.findById(slug, id);
    if (!leave) throw this._buildError('Leave request not found', 404);

    const currentStatus = String(leave[statusField] || 'Pending');
    const decisionKey = options.decision_key || options.decisionKey || null;
    const existingKey = String(leave[decisionKeyField] || '');
    if (decisionKey && existingKey && existingKey === String(decisionKey) && currentStatus === targetStatus)
      return { leave, balance: null, idempotent: true };

    const enforceTransitions = options.enforce_transitions !== false && options.enforceTransitions !== false;
    const transitions = options.transitions && typeof options.transitions === 'object'
      ? options.transitions
      : { Pending: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Cancelled'], Rejected: [], Cancelled: [] };
    if (enforceTransitions && currentStatus !== targetStatus) {
      const allowed = Array.isArray(transitions[currentStatus]) ? transitions[currentStatus] : [];
      if (!allowed.includes(targetStatus))
        throw this._buildError(`Invalid leave status transition: ${currentStatus} -> ${targetStatus}`, 409);
    }

    const patch = { [statusField]: targetStatus };
    if (decisionKey) patch[decisionKeyField] = String(decisionKey);
    const approverId = options.approver_id || options.approverId || options[approverField] || null;
    if (approverId) patch[approverField] = approverId;
    const reason = options.reason || options[rejectionReasonField] || null;
    const nowIso = new Date().toISOString();
    if (targetStatus === 'Approved') patch[approvedAtField] = nowIso;
    if (targetStatus === 'Rejected') { patch[rejectedAtField] = nowIso; if (reason !== null) patch[rejectionReasonField] = reason; }
    if (targetStatus === 'Cancelled') patch[cancelledAtField] = nowIso;

    let balance = null;
    const consumeOnApproval = options.consume_on_approval !== false && options.consumeOnApproval !== false;
    const revertOnUnapprove = options.revert_consumption_on_unapprove === true || options.revertConsumptionOnUnapprove === true;
    const employeeField = String(options.employee_field || options.employeeField || 'employee_id');
    const leaveTypeField = String(options.leave_type_field || options.leaveTypeField || 'leave_type');
    const daysField = String(options.days_field || options.daysField || 'leave_days');
    const startDateField = String(options.start_date_field || options.startDateField || 'start_date');
    const endDateField = String(options.end_date_field || options.endDateField || 'end_date');
    const balanceEntity = String(options.balance_entity || options.balanceEntity || '');
    const fiscalYearField = String(options.fiscal_year_field || options.fiscalYearField || 'year');

    const computeDays = () => {
      const explicit = Number(options.leave_days ?? options.leaveDays ?? leave[daysField]);
      if (Number.isFinite(explicit) && explicit > 0) return Number(explicit.toFixed(2));
      const s = new Date(leave[startDateField]);
      const e = new Date(leave[endDateField]);
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return 0;
      const diff = Math.floor((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      return diff < 0 ? 0 : Number((diff + 1).toFixed(2));
    };
    const resolveFY = () => {
      const explicit = options[fiscalYearField] || options.fiscal_year || options.fiscalYear;
      if (explicit) return String(explicit);
      const s = new Date(leave[startDateField]);
      return Number.isFinite(s.getTime()) ? String(s.getUTCFullYear()) : String(new Date().getUTCFullYear());
    };

    if (balanceEntity) {
      const empId = leave[employeeField];
      const lt = leave[leaveTypeField];
      const days = computeDays();
      const fy = resolveFY();
      const balOpts = {
        employee_field: employeeField, leave_type_field: leaveTypeField, fiscal_year_field: fiscalYearField,
        entitlement_field: options.entitlement_field, accrued_field: options.accrued_field,
        consumed_field: options.consumed_field, carry_forward_field: options.carry_forward_field,
        available_field: options.available_field, create_if_missing: true,
        default_entitlement: options.default_entitlement || options.defaultEntitlement || 0,
      };
      if (targetStatus === 'Approved' && currentStatus !== 'Approved' && consumeOnApproval && days > 0) {
        balance = await this.atomicAdjustLeaveBalance(
          balanceEntity,
          { [employeeField]: empId, [leaveTypeField]: lt, [fiscalYearField]: fy },
          { ...balOpts, consumed_delta: days, available_delta: -days },
          'tx'
        );
      }
      if (currentStatus === 'Approved' && targetStatus !== 'Approved' && revertOnUnapprove && days > 0) {
        balance = await this.atomicAdjustLeaveBalance(
          balanceEntity,
          { [employeeField]: empId, [leaveTypeField]: lt, [fiscalYearField]: fy },
          { ...balOpts, consumed_delta: -days, available_delta: days },
          'tx'
        );
      }
    }

    const updatedLeave = await this.update(slug, id, patch);
    return { leave: updatedLeave, balance, idempotent: false };
  }

  async atomicUpsertAttendanceTimesheet(attendanceEntitySlug, timesheetEntitySlug, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.atomicUpsertAttendanceTimesheet(attendanceEntitySlug, timesheetEntitySlug, options, 'tx')
      );
    }

    const attendanceSlug = this._normalizeSlug(attendanceEntitySlug);
    const timesheetSlug = this._normalizeSlug(timesheetEntitySlug);
    const aEmpF = String(options.attendance_employee_field || options.attendanceEmployeeField || 'employee_id');
    const aDateF = String(options.attendance_date_field || options.attendanceDateField || 'work_date');
    const ciF = String(options.check_in_field || options.checkInField || 'check_in_at');
    const coF = String(options.check_out_field || options.checkOutField || 'check_out_at');
    const whF = String(options.worked_hours_field || options.workedHoursField || 'worked_hours');
    const aStatusF = String(options.attendance_status_field || options.attendanceStatusField || 'status');
    const tEmpF = String(options.timesheet_employee_field || options.timesheetEmployeeField || 'employee_id');
    const tDateF = String(options.timesheet_date_field || options.timesheetDateField || 'work_date');
    const tHoursF = String(options.timesheet_hours_field || options.timesheetHoursField || 'regular_hours');
    const tOtF = String(options.timesheet_overtime_field || options.timesheetOvertimeField || 'overtime_hours');
    const tStatusF = String(options.timesheet_status_field || options.timesheetStatusField || 'status');
    const tAttF = String(options.timesheet_attendance_field || options.timesheetAttendanceField || 'attendance_id');

    const employeeId = options.employee_id || options.employeeId || options[aEmpF];
    const workDate = options.work_date || options.workDate || options[aDateF];
    if (!employeeId) throw this._buildError('employee_id is required for attendance/timesheet upsert');
    if (!workDate) throw this._buildError('work_date is required for attendance/timesheet upsert');

    const aCols = await this._getColumns(attendanceSlug);
    const aCM = this._columnsMap(aCols);
    const tCols = await this._getColumns(timesheetSlug);
    const tCM = this._columnsMap(tCols);
    const reqCols = (cm, s, fs) => { for (const f of fs) if (!cm.has(f)) throw this._buildError(`Field '${f}' does not exist on entity '${s}'`, 400); };
    reqCols(aCM, attendanceSlug, [aEmpF, aDateF, whF, aStatusF]);
    reqCols(tCM, timesheetSlug, [tEmpF, tDateF, tHoursF, tOtF, tStatusF]);

    const aPatch = options.attendance_patch && typeof options.attendance_patch === 'object' ? options.attendance_patch : {};
    const checkIn = aPatch[ciF] ?? aPatch.check_in_at ?? aPatch.checkInAt ?? null;
    const checkOut = aPatch[coF] ?? aPatch.check_out_at ?? aPatch.checkOutAt ?? null;
    const whRaw = aPatch[whF] ?? aPatch.worked_hours ?? null;

    const calcWH = () => {
      if (whRaw !== null && whRaw !== undefined && whRaw !== '') {
        const v = Number(whRaw);
        if (!Number.isFinite(v) || v < 0) throw this._buildError('worked_hours must be a non-negative number', 400);
        return Number(v.toFixed(2));
      }
      if (!checkIn || !checkOut) return null;
      const ci = new Date(checkIn); const co = new Date(checkOut);
      if (!Number.isFinite(ci.getTime()) || !Number.isFinite(co.getTime()))
        throw this._buildError('Invalid check-in/check-out datetime values', 400);
      if (co.getTime() < ci.getTime())
        throw this._buildError('check_out_at must be on or after check_in_at', 400);
      return Number(((co.getTime() - ci.getTime()) / (1000 * 60 * 60)).toFixed(2));
    };

    const db = getDb();
    let attendance = null;
    if (options.attendance_id || options.attendanceId) {
      attendance = await this.findById(attendanceSlug, options.attendance_id || options.attendanceId);
    } else {
      const r = db
        .prepare(`SELECT * FROM ${this._quoteIdent(attendanceSlug)} WHERE ${this._quoteIdent(aEmpF)} = ? AND ${this._quoteIdent(aDateF)} = ? LIMIT 1`)
        .get(String(employeeId), String(workDate));
      if (r) attendance = this._normalizeRow(r, aCols);
    }

    const workedHours = calcWH();
    const aPayload = {
      [aEmpF]: employeeId, [aDateF]: String(workDate),
      [aStatusF]: aPatch[aStatusF] || aPatch.status || (attendance ? attendance[aStatusF] : null) || 'Present',
    };
    if (aCM.has(ciF)) aPayload[ciF] = checkIn || null;
    if (aCM.has(coF)) aPayload[coF] = checkOut || null;
    aPayload[whF] = workedHours !== null ? workedHours : (attendance ? attendance[whF] : 0) || 0;
    if (aPatch.note !== undefined && aCM.has('note')) aPayload.note = aPatch.note;

    const persAttendance = attendance
      ? await this.update(attendanceSlug, attendance.id, aPayload)
      : await this.create(attendanceSlug, aPayload);

    const dailyHours = Number(options.daily_hours || options.dailyHours || 8) || 8;
    const pw = Number(persAttendance[whF] || 0);
    const safeW = Number.isFinite(pw) ? pw : 0;
    const regH = Number(Math.min(safeW, dailyHours).toFixed(2));
    const otH = Number(Math.max(safeW - dailyHours, 0).toFixed(2));

    let timesheet = null;
    const tr = db
      .prepare(`SELECT * FROM ${this._quoteIdent(timesheetSlug)} WHERE ${this._quoteIdent(tEmpF)} = ? AND ${this._quoteIdent(tDateF)} = ? LIMIT 1`)
      .get(String(employeeId), String(workDate));
    if (tr) timesheet = this._normalizeRow(tr, tCols);

    const tPayload = {
      [tEmpF]: employeeId, [tDateF]: String(workDate), [tHoursF]: regH, [tOtF]: otH,
      [tStatusF]: (timesheet ? timesheet[tStatusF] : null) || options.default_timesheet_status || options.defaultTimesheetStatus || 'Draft',
    };
    if (tCM.has(tAttF)) tPayload[tAttF] = persAttendance.id;
    if (options.timesheet_note !== undefined && tCM.has('note')) tPayload.note = options.timesheet_note;

    const persTimesheet = timesheet
      ? await this.update(timesheetSlug, timesheet.id, tPayload)
      : await this.create(timesheetSlug, tPayload);

    return { attendance: persAttendance, timesheet: persTimesheet };
  }

  async atomicApplyCompensationSnapshot(ledgerEntitySlug, snapshotEntitySlug, options = {}, client = null) {
    if (!client && !this._inTransaction) {
      return this.withTransaction(() =>
        this.atomicApplyCompensationSnapshot(ledgerEntitySlug, snapshotEntitySlug, options, 'tx')
      );
    }

    const ledgerSlug = this._normalizeSlug(ledgerEntitySlug);
    const snapshotSlug = this._normalizeSlug(snapshotEntitySlug);
    const lEmpF = String(options.ledger_employee_field || options.ledgerEmployeeField || 'employee_id');
    const lPerF = String(options.ledger_period_field || options.ledgerPeriodField || 'pay_period');
    const lTypF = String(options.ledger_type_field || options.ledgerTypeField || 'component_type');
    const lAmtF = String(options.ledger_amount_field || options.ledgerAmountField || 'amount');
    const lStaF = String(options.ledger_status_field || options.ledgerStatusField || 'status');
    const sEmpF = String(options.snapshot_employee_field || options.snapshotEmployeeField || 'employee_id');
    const sPerF = String(options.snapshot_period_field || options.snapshotPeriodField || 'pay_period');
    const sGrsF = String(options.snapshot_gross_field || options.snapshotGrossField || 'gross_amount');
    const sDedF = String(options.snapshot_deduction_field || options.snapshotDeductionField || 'deduction_amount');
    const sNetF = String(options.snapshot_net_field || options.snapshotNetField || 'net_amount');
    const sStaF = String(options.snapshot_status_field || options.snapshotStatusField || 'status');
    const sPostF = String(options.snapshot_posted_at_field || options.snapshotPostedAtField || 'posted_at');

    const employeeId = options.employee_id || options.employeeId || options[lEmpF];
    const payPeriod = options.pay_period || options.payPeriod || options[lPerF];
    if (!employeeId) throw this._buildError('employee_id is required for compensation snapshot generation');
    if (!payPeriod) throw this._buildError('pay_period is required for compensation snapshot generation');

    const lCols = await this._getColumns(ledgerSlug);
    const lCM = this._columnsMap(lCols);
    const sCols = await this._getColumns(snapshotSlug);
    const sCM = this._columnsMap(sCols);
    const reqCols = (cm, s, fs) => { for (const f of fs) if (!cm.has(f)) throw this._buildError(`Field '${f}' does not exist on entity '${s}'`, 400); };
    reqCols(lCM, ledgerSlug, [lEmpF, lPerF, lTypF, lAmtF]);
    reqCols(sCM, snapshotSlug, [sEmpF, sPerF, sGrsF, sDedF, sNetF, sStaF]);

    const ledgerRows = await this.findAll(ledgerSlug, { [lEmpF]: employeeId, [lPerF]: String(payPeriod) });
    const includeStatuses = Array.isArray(options.include_statuses)
      ? options.include_statuses.map(String)
      : (Array.isArray(options.includeStatuses) ? options.includeStatuses.map(String) : ['Draft', 'Posted']);

    const filtered = (Array.isArray(ledgerRows) ? ledgerRows : []).filter((r) => {
      if (!lCM.has(lStaF)) return true;
      if (!includeStatuses.length) return true;
      return includeStatuses.includes(String(r[lStaF] || ''));
    });

    const round = (v) => { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; };
    const normalizeType = (v) => { const s = String(v || '').trim().toLowerCase(); return (s === 'deduction' || s === 'deductions') ? 'Deduction' : 'Earning'; };

    let gross = 0; let deductions = 0;
    for (const r of filtered) {
      const amt = round(r[lAmtF] || 0);
      if (normalizeType(r[lTypF]) === 'Deduction') deductions += amt; else gross += amt;
    }
    gross = round(gross); deductions = round(deductions);
    const net = round(gross - deductions);

    const db = getDb();
    const existing = db
      .prepare(`SELECT * FROM ${this._quoteIdent(snapshotSlug)} WHERE ${this._quoteIdent(sEmpF)} = ? AND ${this._quoteIdent(sPerF)} = ? LIMIT 1`)
      .get(String(employeeId), String(payPeriod));
    const existingSnapshot = existing ? this._normalizeRow(existing, sCols) : null;

    const sPayload = {
      [sEmpF]: employeeId, [sPerF]: String(payPeriod),
      [sGrsF]: gross, [sDedF]: deductions, [sNetF]: net,
      [sStaF]: options.snapshot_status || options.snapshotStatus || 'Draft',
    };
    if (options.snapshot_note !== undefined && sCM.has('note')) sPayload.note = options.snapshot_note;
    if (sCM.has(sPostF)) sPayload[sPostF] = null;

    const snapshot = existingSnapshot
      ? await this.update(snapshotSlug, existingSnapshot.id, sPayload)
      : await this.create(snapshotSlug, sPayload);

    if ((options.mark_ledger_posted === true || options.markLedgerPosted === true) && lCM.has(lStaF)) {
      for (const r of filtered) {
        if (!r || !r.id) continue;
        await this.update(ledgerSlug, r.id, {
          [lStaF]: 'Posted',
          ...(lCM.has('posted_at') ? { posted_at: new Date().toISOString() } : {}),
        });
      }
    }

    return { snapshot, totals: { gross_amount: gross, deduction_amount: deductions, net_amount: net, entry_count: filtered.length } };
  }
}

module.exports = SQLiteProvider;
