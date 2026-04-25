const { v4: uuid } = require('uuid');
const { pool, query } = require('./db');

class PostgresProvider {
  constructor() {
    this._columnsCache = new Map();
  }

  _runQuery(client, text, params) {
    if (client && typeof client.query === 'function') {
      return client.query(text, params);
    }
    return query(text, params);
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

  async _getColumns(entitySlug, client = null) {
    const slug = this._normalizeSlug(entitySlug);
    if (this._columnsCache.has(slug)) {
      return this._columnsCache.get(slug);
    }

    const res = await this._runQuery(
      client,
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [slug]
    );

    if (!res.rows.length) {
      throw new Error(`Table '${slug}' does not exist. Did you run migrations?`);
    }

    this._columnsCache.set(slug, res.rows);
    return res.rows;
  }

  _columnsMap(columns) {
    const out = new Map();
    for (const col of columns || []) {
      out.set(col.column_name, col);
    }
    return out;
  }

  _prepareValue(raw, columnDef) {
    if (!columnDef) return raw;
    if (raw === undefined) return undefined;
    if (raw === null) return null;

    const t = String(columnDef.data_type || '').toLowerCase();
    if (raw === '' && t !== 'text' && t !== 'character varying') {
      return null;
    }

    if (t === 'json' || t === 'jsonb') {
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return raw;
        }
      }
      return raw;
    }

    if (t === 'integer' || t === 'smallint' || t === 'bigint') {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error(`Invalid integer value for '${columnDef.column_name}'`);
      return n;
    }

    if (t === 'numeric' || t === 'double precision' || t === 'real') {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`Invalid numeric value for '${columnDef.column_name}'`);
      return n;
    }

    if (t === 'boolean') {
      if (typeof raw === 'boolean') return raw;
      const v = String(raw).trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(v)) return true;
      if (['false', '0', 'no', 'n'].includes(v)) return false;
      throw new Error(`Invalid boolean value for '${columnDef.column_name}'`);
    }

    if (t === 'date') {
      const d = new Date(raw);
      if (!Number.isFinite(d.getTime())) throw new Error(`Invalid date value for '${columnDef.column_name}'`);
      return d.toISOString().slice(0, 10);
    }

    if (t === 'timestamp with time zone' || t === 'timestamp without time zone') {
      const d = new Date(raw);
      if (!Number.isFinite(d.getTime())) throw new Error(`Invalid datetime value for '${columnDef.column_name}'`);
      return d.toISOString();
    }

    return raw;
  }

  _normalizeRow(row, columns) {
    const normalized = { ...row };
    for (const col of columns || []) {
      const key = col.column_name;
      const t = String(col.data_type || '').toLowerCase();
      if (normalized[key] === null || normalized[key] === undefined) continue;

      if (t === 'integer' || t === 'smallint' || t === 'bigint' || t === 'numeric' || t === 'double precision' || t === 'real') {
        const n = Number(normalized[key]);
        normalized[key] = Number.isFinite(n) ? n : normalized[key];
      }
    }
    return normalized;
  }

  async findAll(entitySlug, filter = {}, client = null) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug, client);
    const columnsMap = this._columnsMap(columns);
    const table = this._quoteIdent(slug);

    const where = [];
    const params = [];

    for (const [rawKey, rawVal] of Object.entries(filter || {})) {
      const key = String(rawKey || '').trim();
      if (!key) continue;
      if (!columnsMap.has(key)) return [];

      if (Array.isArray(rawVal)) {
        if (rawVal.length === 0) return [];
        params.push(rawVal.map((v) => String(v)));
        where.push(`CAST(${this._quoteIdent(key)} AS TEXT) = ANY($${params.length}::text[])`);
      } else {
        params.push(String(rawVal));
        where.push(`CAST(${this._quoteIdent(key)} AS TEXT) = $${params.length}`);
      }
    }

    let sql = `SELECT * FROM ${table}`;
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ${this._quoteIdent('created_at')} ASC`;

    const res = await this._runQuery(client, sql, params);
    return res.rows.map((row) => this._normalizeRow(row, columns));
  }

  async findById(entitySlug, id, client = null) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug, client);
    const sql = `SELECT * FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent('id')} = $1 LIMIT 1`;
    const res = await this._runQuery(client, sql, [String(id)]);
    if (!res.rows.length) return null;
    return this._normalizeRow(res.rows[0], columns);
  }

  async create(entitySlug, data, client = null) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug, client);
    const columnsMap = this._columnsMap(columns);
    const table = this._quoteIdent(slug);

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
    const placeholders = [];

    for (const key of keys) {
      const col = columnsMap.get(key);
      const prepared = this._prepareValue(payload[key], col);
      values.push(prepared);
      placeholders.push(`$${values.length}`);
    }

    const sql = `INSERT INTO ${table} (${keys.map((k) => this._quoteIdent(k)).join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *`;
    const res = await this._runQuery(client, sql, values);
    return this._normalizeRow(res.rows[0], columns);
  }

  async update(entitySlug, id, data, client = null) {
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug, client);
    const columnsMap = this._columnsMap(columns);
    const table = this._quoteIdent(slug);
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
      const col = columnsMap.get(key);
      const prepared = this._prepareValue(raw, col);
      values.push(prepared);
      sets.push(`${this._quoteIdent(key)} = $${values.length}`);
    }

    if (columnsMap.has('updated_at')) {
      values.push(new Date().toISOString());
      sets.push(`${this._quoteIdent('updated_at')} = $${values.length}`);
    }

    if (!sets.length) {
      return this.findById(slug, id, client);
    }

    values.push(String(id));
    const sql = `UPDATE ${table}
      SET ${sets.join(', ')}
      WHERE ${this._quoteIdent('id')} = $${values.length}
      RETURNING *`;
    const res = await this._runQuery(client, sql, values);
    if (!res.rows.length) return null;
    return this._normalizeRow(res.rows[0], columns);
  }

  async delete(entitySlug, id, client = null) {
    const slug = this._normalizeSlug(entitySlug);
    const sql = `DELETE FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent('id')} = $1`;
    const res = await this._runQuery(client, sql, [String(id)]);
    return res.rowCount > 0;
  }

  async withTransaction(callback) {
    if (typeof callback !== 'function') {
      throw this._buildError('Transaction callback is required');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // no-op: keep original failure
        void rollbackError;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async findAllWithClient(entitySlug, filter = {}, client) {
    return this.findAll(entitySlug, filter, client);
  }

  async findByIdWithClient(entitySlug, id, client) {
    return this.findById(entitySlug, id, client);
  }

  async createWithClient(entitySlug, data, client) {
    return this.create(entitySlug, data, client);
  }

  async updateWithClient(entitySlug, id, data, client) {
    return this.update(entitySlug, id, data, client);
  }

  async deleteWithClient(entitySlug, id, client) {
    return this.delete(entitySlug, id, client);
  }

  async findByIdForUpdate(entitySlug, id, client = null) {
    if (!client) {
      return this.withTransaction((tx) => this.findByIdForUpdate(entitySlug, id, tx));
    }
    const slug = this._normalizeSlug(entitySlug);
    const columns = await this._getColumns(slug, client);
    const sql = `SELECT * FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent('id')} = $1 LIMIT 1 FOR UPDATE`;
    const res = await this._runQuery(client, sql, [String(id)]);
    if (!res.rows.length) return null;
    return this._normalizeRow(res.rows[0], columns);
  }

  async findOneByFieldForUpdate(entitySlug, fieldName, value, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.findOneByFieldForUpdate(entitySlug, fieldName, value, tx)
      );
    }
    const slug = this._normalizeSlug(entitySlug);
    const field = String(fieldName || '').trim();
    if (!field) {
      throw this._buildError('Field name is required for row lock lookup');
    }
    const columns = await this._getColumns(slug, client);
    const columnsMap = this._columnsMap(columns);
    if (!columnsMap.has(field)) {
      throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);
    }
    const sql = `SELECT * FROM ${this._quoteIdent(slug)} WHERE ${this._quoteIdent(field)} = $1 LIMIT 1 FOR UPDATE`;
    const res = await this._runQuery(client, sql, [value]);
    if (!res.rows.length) return null;
    return this._normalizeRow(res.rows[0], columns);
  }

  async allocatePrefixedNumber(entitySlug, fieldName, prefix = '', options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.allocatePrefixedNumber(entitySlug, fieldName, prefix, options, tx)
      );
    }

    const slug = this._normalizeSlug(entitySlug);
    const field = String(fieldName || '').trim();
    if (!field) {
      throw this._buildError('Field name is required for prefixed number allocation');
    }
    const pad = Number(options.padding || options.pad || 6) || 6;
    const safePrefix = String(prefix || '');

    const columns = await this._getColumns(slug, client);
    const columnsMap = this._columnsMap(columns);
    if (!columnsMap.has(field)) {
      throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);
    }

    const sql = `SELECT ${this._quoteIdent(field)} AS value
      FROM ${this._quoteIdent(slug)}
      WHERE ${this._quoteIdent(field)} LIKE $1
      ORDER BY ${this._quoteIdent(field)} DESC
      LIMIT 1
      FOR UPDATE`;
    const res = await this._runQuery(client, sql, [`${safePrefix}%`]);
    const lastValue = res.rows.length ? String(res.rows[0].value || '') : '';
    const suffix = lastValue.startsWith(safePrefix) ? lastValue.slice(safePrefix.length) : '';
    const parsed = parseInt(suffix, 10);
    const next = Number.isNaN(parsed) ? 1 : parsed + 1;
    return safePrefix + String(next).padStart(pad, '0');
  }

  async atomicAdjustInvoiceFinancials(entitySlug, id, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicAdjustInvoiceFinancials(entitySlug, id, options, tx)
      );
    }

    const grandField = String(options.grandTotalField || options.grand_total_field || 'grand_total');
    const paidField = String(options.paidField || options.paid_field || 'paid_total');
    const outstandingField = String(options.outstandingField || options.outstanding_field || 'outstanding_balance');
    const statusField = String(options.statusField || options.status_field || 'status');

    const grandDelta = Number(options.grandDelta || options.grand_delta || 0);
    const paidDelta = Number(options.paidDelta || options.paid_delta || 0);
    if (!Number.isFinite(grandDelta) || !Number.isFinite(paidDelta)) {
      throw this._buildError('Invoice delta values must be numeric', 400);
    }

    const locked = await this.findByIdForUpdate(entitySlug, id, client);
    if (!locked) {
      throw this._buildError('Invoice not found', 404);
    }

    const num = (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    };
    const round = (raw) => Number(num(raw).toFixed(2));

    const currentGrand = num(locked[grandField]);
    const currentPaid = num(locked[paidField]);
    const nextGrand = round(currentGrand + grandDelta);
    const nextPaid = round(currentPaid + paidDelta);
    if (nextGrand < 0) {
      throw this._buildError('Invoice grand total cannot be negative', 409, {
        grand_total: nextGrand,
      });
    }
    if (nextPaid < 0) {
      throw this._buildError('Invoice paid total cannot be negative', 409, {
        paid_total: nextPaid,
      });
    }
    if (nextPaid > nextGrand + 0.0001) {
      throw this._buildError('Invoice paid total cannot exceed invoice grand total', 409, {
        paid_total: nextPaid,
        grand_total: nextGrand,
      });
    }

    const nextOutstanding = round(Math.max(nextGrand - nextPaid, 0));
    const patch = {
      [grandField]: nextGrand,
      [paidField]: nextPaid,
      [outstandingField]: nextOutstanding,
    };

    if (options.autoStatus === true || options.auto_status === true) {
      const currentStatus = String(locked[statusField] || 'Draft');
      if (currentStatus !== 'Cancelled') {
        patch[statusField] = nextOutstanding <= 0 ? 'Paid' : (currentStatus === 'Draft' || currentStatus === 'Paid' ? 'Sent' : currentStatus);
      }
    }

    if (options.extraPatch && typeof options.extraPatch === 'object') {
      Object.assign(patch, options.extraPatch);
    }

    return this.update(entitySlug, id, patch, client);
  }

  async atomicAdjustQuantity(entitySlug, id, delta, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicAdjustQuantity(entitySlug, id, delta, options, tx)
      );
    }

    const quantityField = String(options.quantityField || options.quantity_field || 'quantity');
    const allowNegative =
      options.allowNegativeStock === true || options.allow_negative_stock === true;
    const extraPatch = options.extraPatch && typeof options.extraPatch === 'object'
      ? { ...options.extraPatch }
      : {};

    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta)) {
      throw this._buildError(`Invalid stock delta for '${quantityField}'`, 400);
    }

    const locked = await this.findByIdForUpdate(entitySlug, id, client);
    if (!locked) {
      throw this._buildError('Item not found', 404);
    }

    const currentQty = Number(locked[quantityField] || 0);
    if (!Number.isFinite(currentQty)) {
      throw this._buildError(`Current value of '${quantityField}' is not numeric`, 400);
    }

    const nextQty = currentQty + numericDelta;
    if (!allowNegative && nextQty < 0) {
      throw this._buildError('Insufficient stock for requested operation', 409, {
        quantity_field: quantityField,
        current: currentQty,
        delta: numericDelta,
        next: nextQty,
      });
    }

    const patch = {
      ...extraPatch,
      [quantityField]: nextQty,
    };
    return this.update(entitySlug, id, patch, client);
  }

  async atomicAdjustReservation(entitySlug, id, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicAdjustReservation(entitySlug, id, options, tx)
      );
    }

    const quantityField = String(options.quantityField || options.quantity_field || 'quantity');
    const reservedField = String(options.reservedField || options.reserved_field || 'reserved_quantity');
    const committedField = String(options.committedField || options.committed_field || 'committed_quantity');
    const availableField = String(options.availableField || options.available_field || 'available_quantity');

    const quantityDelta = Number(options.quantityDelta || options.quantity_delta || 0);
    const reservedDelta = Number(options.reservedDelta || options.reserved_delta || 0);
    const committedDelta = Number(options.committedDelta || options.committed_delta || 0);
    const allowNegative =
      options.allowNegativeStock === true || options.allow_negative_stock === true;

    if (!Number.isFinite(quantityDelta) || !Number.isFinite(reservedDelta) || !Number.isFinite(committedDelta)) {
      throw this._buildError('Reservation delta values must be numeric', 400);
    }

    const locked = await this.findByIdForUpdate(entitySlug, id, client);
    if (!locked) {
      throw this._buildError('Item not found', 404);
    }

    const num = (val) => {
      const parsed = Number(val);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const currentQty = num(locked[quantityField]);
    const currentReserved = num(locked[reservedField]);
    const currentCommitted = num(locked[committedField]);

    const nextQty = currentQty + quantityDelta;
    const nextReserved = currentReserved + reservedDelta;
    const nextCommitted = currentCommitted + committedDelta;

    if (nextReserved < 0 || nextCommitted < 0) {
      throw this._buildError('Reserved and committed quantities cannot be negative', 400, {
        reserved: nextReserved,
        committed: nextCommitted,
      });
    }

    if (!allowNegative && nextQty < 0) {
      throw this._buildError('Stock quantity cannot go negative', 409, {
        quantity: nextQty,
      });
    }

    if (nextReserved + nextCommitted > nextQty) {
      throw this._buildError('Reserved + committed quantities cannot exceed on-hand quantity', 409, {
        quantity: nextQty,
        reserved: nextReserved,
        committed: nextCommitted,
      });
    }

    const patch = {
      [quantityField]: nextQty,
      [reservedField]: nextReserved,
      [committedField]: nextCommitted,
    };
    if (availableField) {
      patch[availableField] = nextQty - nextReserved - nextCommitted;
    }

    return this.update(entitySlug, id, patch, client);
  }

  /**
   * Transactionally adjust committed_quantity (and optionally on_hand) for a
   * stock row. Pairs with the SalesOrderCommitmentMixin:
   *
   *   - approve a sales order:  committedDelta = +ordered_qty - shipped_qty
   *   - cancel / close:         committedDelta = -remaining
   *   - ship a line:            quantityDelta = -shipped_delta, committedDelta = -shipped_delta
   *
   * Invariants enforced:
   *   - committed_quantity cannot go negative
   *   - reserved + committed cannot exceed on-hand (same rule as the
   *     reservation workflow)
   *   - on-hand cannot go negative unless `allowNegativeStock: true`
   *
   * Also recomputes available_quantity = on_hand - reserved - committed so
   * the denormalized column stays consistent.
   */
  async atomicAdjustCommitted(entitySlug, id, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicAdjustCommitted(entitySlug, id, options, tx)
      );
    }

    const quantityField = String(options.quantityField || options.quantity_field || 'quantity');
    const reservedField = String(options.reservedField || options.reserved_field || 'reserved_quantity');
    const committedField = String(options.committedField || options.committed_field || 'committed_quantity');
    const availableField = String(options.availableField || options.available_field || 'available_quantity');

    const quantityDelta = Number(options.quantityDelta || options.quantity_delta || 0);
    const committedDelta = Number(options.committedDelta || options.committed_delta || 0);
    const allowNegative =
      options.allowNegativeStock === true || options.allow_negative_stock === true;

    if (!Number.isFinite(quantityDelta) || !Number.isFinite(committedDelta)) {
      throw this._buildError('Commitment delta values must be numeric', 400);
    }

    if (quantityDelta === 0 && committedDelta === 0) {
      // Nothing to do — still return the current row so callers can chain.
      return this.findById(entitySlug, id, client);
    }

    const locked = await this.findByIdForUpdate(entitySlug, id, client);
    if (!locked) {
      throw this._buildError('Item not found', 404);
    }

    const num = (val) => {
      const parsed = Number(val);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const currentQty = num(locked[quantityField]);
    const currentReserved = num(locked[reservedField]);
    const currentCommitted = num(locked[committedField]);

    const nextQty = currentQty + quantityDelta;
    const nextCommitted = currentCommitted + committedDelta;

    if (nextCommitted < 0) {
      throw this._buildError('Committed quantity cannot be negative', 400, {
        committed: nextCommitted,
      });
    }

    if (!allowNegative && nextQty < 0) {
      throw this._buildError('Stock quantity cannot go negative', 409, {
        quantity: nextQty,
      });
    }

    if (currentReserved + nextCommitted > nextQty) {
      throw this._buildError('Reserved + committed quantities cannot exceed on-hand quantity', 409, {
        quantity: nextQty,
        reserved: currentReserved,
        committed: nextCommitted,
      });
    }

    const patch = {
      [quantityField]: nextQty,
      [committedField]: nextCommitted,
    };
    if (availableField) {
      patch[availableField] = nextQty - currentReserved - nextCommitted;
    }

    return this.update(entitySlug, id, patch, client);
  }

  async atomicAdjustLeaveBalance(entitySlug, lookup = {}, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicAdjustLeaveBalance(entitySlug, lookup, options, tx)
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

    const employeeId =
      lookup[employeeField] ??
      lookup.employee_id ??
      lookup.employeeId ??
      null;
    const leaveType =
      lookup[leaveTypeField] ??
      lookup.leave_type ??
      lookup.leaveType ??
      null;
    const fiscalYear =
      lookup[fiscalYearField] ??
      lookup.fiscal_year ??
      lookup.fiscalYear ??
      null;
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
      !Number.isFinite(entitlementDelta) ||
      !Number.isFinite(accruedDelta) ||
      !Number.isFinite(consumedDelta) ||
      !Number.isFinite(carryForwardDelta) ||
      !Number.isFinite(availableDelta)
    ) {
      throw this._buildError('Leave balance delta values must be numeric', 400);
    }

    const columns = await this._getColumns(slug, client);
    const columnsMap = this._columnsMap(columns);
    const requiredColumns = [
      employeeField,
      leaveTypeField,
      fiscalYearField,
      entitlementField,
      accruedField,
      consumedField,
      carryForwardField,
      availableField,
    ];
    for (const field of requiredColumns) {
      if (!columnsMap.has(field)) {
        throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);
      }
    }

    const table = this._quoteIdent(slug);
    const selectSql = `SELECT * FROM ${table}
      WHERE ${this._quoteIdent(employeeField)} = $1
        AND ${this._quoteIdent(leaveTypeField)} = $2
        AND ${this._quoteIdent(fiscalYearField)} = $3
      LIMIT 1
      FOR UPDATE`;
    const selectRes = await this._runQuery(client, selectSql, [
      String(employeeId),
      String(leaveType),
      String(fiscalYear),
    ]);

    let row = selectRes.rows.length ? this._normalizeRow(selectRes.rows[0], columns) : null;
    const createIfMissing =
      options.create_if_missing === true ||
      options.createIfMissing === true;
    if (!row && createIfMissing) {
      const defaultEntitlement = Number(options.default_entitlement || options.defaultEntitlement || 0);
      const baseEntitlement = Number.isFinite(defaultEntitlement) ? defaultEntitlement : 0;
      const created = await this.createWithClient(slug, {
        [employeeField]: employeeId,
        [leaveTypeField]: leaveType,
        [fiscalYearField]: String(fiscalYear),
        [entitlementField]: baseEntitlement,
        [accruedField]: baseEntitlement,
        [consumedField]: 0,
        [carryForwardField]: 0,
        [availableField]: baseEntitlement,
        ...(columnsMap.has(lastAccrualAtField) ? { [lastAccrualAtField]: new Date().toISOString() } : {}),
      }, client);
      row = await this.findByIdForUpdate(slug, created.id, client);
    }
    if (!row) {
      throw this._buildError('Leave balance record not found', 404);
    }

    const num = (val) => {
      const parsed = Number(val);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const round = (val) => Number(num(val).toFixed(2));

    const currentEntitlement = num(row[entitlementField]);
    const currentAccrued = num(row[accruedField]);
    const currentConsumed = num(row[consumedField]);
    const currentCarryForward = num(row[carryForwardField]);
    const currentAvailable = num(row[availableField]);

    const nextEntitlement = round(currentEntitlement + entitlementDelta);
    const nextAccrued = round(currentAccrued + accruedDelta);
    const nextConsumed = round(currentConsumed + consumedDelta);
    const nextCarryForward = round(currentCarryForward + carryForwardDelta);
    const recomputedAvailable = round(nextEntitlement + nextAccrued + nextCarryForward - nextConsumed);
    const nextAvailable = hasAvailableDelta
      ? round(currentAvailable + availableDelta)
      : recomputedAvailable;

    if (nextEntitlement < 0 || nextAccrued < 0 || nextConsumed < 0 || nextCarryForward < 0) {
      throw this._buildError('Leave balance component values cannot be negative', 409, {
        entitlement: nextEntitlement,
        accrued: nextAccrued,
        consumed: nextConsumed,
        carry_forward: nextCarryForward,
      });
    }
    const allowNegativeAvailable =
      options.allow_negative_available === true ||
      options.allowNegativeAvailable === true;
    if (!allowNegativeAvailable && nextAvailable < 0) {
      throw this._buildError('Leave available balance cannot go negative', 409, {
        available: nextAvailable,
      });
    }

    const patch = {
      [entitlementField]: nextEntitlement,
      [accruedField]: nextAccrued,
      [consumedField]: nextConsumed,
      [carryForwardField]: nextCarryForward,
      [availableField]: nextAvailable,
    };
    if (columnsMap.has(lastAccrualAtField)) {
      patch[lastAccrualAtField] = new Date().toISOString();
    }
    if (options.note !== undefined && columnsMap.has('note')) {
      patch.note = options.note;
    }

    return this.updateWithClient(slug, row.id, patch, client);
  }

  async applyLeaveDecisionIdempotent(entitySlug, id, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.applyLeaveDecisionIdempotent(entitySlug, id, options, tx)
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

    const leave = await this.findByIdForUpdate(slug, id, client);
    if (!leave) throw this._buildError('Leave request not found', 404);

    const currentStatus = String(leave[statusField] || 'Pending');
    const decisionKey = options.decision_key || options.decisionKey || null;
    const existingDecisionKey = String(leave[decisionKeyField] || '');
    if (decisionKey && existingDecisionKey && existingDecisionKey === String(decisionKey) && currentStatus === targetStatus) {
      return {
        leave,
        balance: null,
        idempotent: true,
      };
    }

    const enforceTransitions =
      options.enforce_transitions !== false &&
      options.enforceTransitions !== false;
    const transitions = options.transitions && typeof options.transitions === 'object'
      ? options.transitions
      : {
          Pending: ['Approved', 'Rejected', 'Cancelled'],
          Approved: ['Cancelled'],
          Rejected: [],
          Cancelled: [],
        };
    if (enforceTransitions && currentStatus !== targetStatus) {
      const allowed = Array.isArray(transitions[currentStatus]) ? transitions[currentStatus] : [];
      if (!allowed.includes(targetStatus)) {
        throw this._buildError(`Invalid leave status transition: ${currentStatus} -> ${targetStatus}`, 409);
      }
    }

    const patch = {
      [statusField]: targetStatus,
    };
    if (decisionKey) patch[decisionKeyField] = String(decisionKey);
    const approverId = options.approver_id || options.approverId || options[approverField] || null;
    if (approverId) patch[approverField] = approverId;
    const reason = options.reason || options[rejectionReasonField] || null;
    const nowIso = new Date().toISOString();
    if (targetStatus === 'Approved') patch[approvedAtField] = nowIso;
    if (targetStatus === 'Rejected') {
      patch[rejectedAtField] = nowIso;
      if (reason !== null) patch[rejectionReasonField] = reason;
    }
    if (targetStatus === 'Cancelled') patch[cancelledAtField] = nowIso;

    let balance = null;
    const consumeOnApproval =
      options.consume_on_approval !== false &&
      options.consumeOnApproval !== false;
    const revertOnUnapprove =
      options.revert_consumption_on_unapprove === true ||
      options.revertConsumptionOnUnapprove === true;

    const employeeField = String(options.employee_field || options.employeeField || 'employee_id');
    const leaveTypeField = String(options.leave_type_field || options.leaveTypeField || 'leave_type');
    const daysField = String(options.days_field || options.daysField || 'leave_days');
    const startDateField = String(options.start_date_field || options.startDateField || 'start_date');
    const endDateField = String(options.end_date_field || options.endDateField || 'end_date');
    const balanceEntity = String(options.balance_entity || options.balanceEntity || '');
    const fiscalYearField = String(options.fiscal_year_field || options.fiscalYearField || 'year');

    const computeLeaveDays = () => {
      const explicit = Number(options.leave_days ?? options.leaveDays ?? leave[daysField]);
      if (Number.isFinite(explicit) && explicit > 0) return Number(explicit.toFixed(2));
      const start = new Date(leave[startDateField]);
      const end = new Date(leave[endDateField]);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 0;
      const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) return 0;
      return Number((diff + 1).toFixed(2));
    };
    const resolveFiscalYear = () => {
      const explicit = options[fiscalYearField] || options.fiscal_year || options.fiscalYear;
      if (explicit) return String(explicit);
      const start = new Date(leave[startDateField]);
      if (Number.isFinite(start.getTime())) return String(start.getUTCFullYear());
      return String(new Date().getUTCFullYear());
    };

    if (balanceEntity) {
      const employeeId = leave[employeeField];
      const leaveType = leave[leaveTypeField];
      const leaveDays = computeLeaveDays();
      const fiscalYear = resolveFiscalYear();
      if (targetStatus === 'Approved' && currentStatus !== 'Approved' && consumeOnApproval && leaveDays > 0) {
        balance = await this.atomicAdjustLeaveBalance(
          balanceEntity,
          {
            [employeeField]: employeeId,
            [leaveTypeField]: leaveType,
            [fiscalYearField]: fiscalYear,
          },
          {
            employee_field: employeeField,
            leave_type_field: leaveTypeField,
            fiscal_year_field: fiscalYearField,
            entitlement_field: options.entitlement_field,
            accrued_field: options.accrued_field,
            consumed_field: options.consumed_field,
            carry_forward_field: options.carry_forward_field,
            available_field: options.available_field,
            consumed_delta: leaveDays,
            available_delta: -leaveDays,
            create_if_missing: true,
            default_entitlement: options.default_entitlement || options.defaultEntitlement || 0,
          },
          client
        );
      }
      if (currentStatus === 'Approved' && targetStatus !== 'Approved' && revertOnUnapprove && leaveDays > 0) {
        balance = await this.atomicAdjustLeaveBalance(
          balanceEntity,
          {
            [employeeField]: employeeId,
            [leaveTypeField]: leaveType,
            [fiscalYearField]: fiscalYear,
          },
          {
            employee_field: employeeField,
            leave_type_field: leaveTypeField,
            fiscal_year_field: fiscalYearField,
            entitlement_field: options.entitlement_field,
            accrued_field: options.accrued_field,
            consumed_field: options.consumed_field,
            carry_forward_field: options.carry_forward_field,
            available_field: options.available_field,
            consumed_delta: -leaveDays,
            available_delta: leaveDays,
            create_if_missing: true,
            default_entitlement: options.default_entitlement || options.defaultEntitlement || 0,
          },
          client
        );
      }
    }

    const updatedLeave = await this.updateWithClient(slug, id, patch, client);
    return {
      leave: updatedLeave,
      balance,
      idempotent: false,
    };
  }

  async atomicUpsertAttendanceTimesheet(attendanceEntitySlug, timesheetEntitySlug, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicUpsertAttendanceTimesheet(attendanceEntitySlug, timesheetEntitySlug, options, tx)
      );
    }

    const attendanceSlug = this._normalizeSlug(attendanceEntitySlug);
    const timesheetSlug = this._normalizeSlug(timesheetEntitySlug);

    const attendanceEmployeeField = String(options.attendance_employee_field || options.attendanceEmployeeField || 'employee_id');
    const attendanceDateField = String(options.attendance_date_field || options.attendanceDateField || 'work_date');
    const checkInField = String(options.check_in_field || options.checkInField || 'check_in_at');
    const checkOutField = String(options.check_out_field || options.checkOutField || 'check_out_at');
    const workedHoursField = String(options.worked_hours_field || options.workedHoursField || 'worked_hours');
    const attendanceStatusField = String(options.attendance_status_field || options.attendanceStatusField || 'status');

    const timesheetEmployeeField = String(options.timesheet_employee_field || options.timesheetEmployeeField || 'employee_id');
    const timesheetDateField = String(options.timesheet_date_field || options.timesheetDateField || 'work_date');
    const timesheetHoursField = String(options.timesheet_hours_field || options.timesheetHoursField || 'regular_hours');
    const timesheetOvertimeField = String(options.timesheet_overtime_field || options.timesheetOvertimeField || 'overtime_hours');
    const timesheetStatusField = String(options.timesheet_status_field || options.timesheetStatusField || 'status');
    const timesheetAttendanceField = String(options.timesheet_attendance_field || options.timesheetAttendanceField || 'attendance_id');

    const employeeId = options.employee_id || options.employeeId || options[attendanceEmployeeField];
    const workDate = options.work_date || options.workDate || options[attendanceDateField];
    if (!employeeId) throw this._buildError('employee_id is required for attendance/timesheet upsert');
    if (!workDate) throw this._buildError('work_date is required for attendance/timesheet upsert');

    const attendanceColumns = await this._getColumns(attendanceSlug, client);
    const attendanceColumnsMap = this._columnsMap(attendanceColumns);
    const timesheetColumns = await this._getColumns(timesheetSlug, client);
    const timesheetColumnsMap = this._columnsMap(timesheetColumns);
    const requireColumns = (columnsMap, slug, fields) => {
      for (const field of fields) {
        if (!columnsMap.has(field)) {
          throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);
        }
      }
    };
    requireColumns(attendanceColumnsMap, attendanceSlug, [attendanceEmployeeField, attendanceDateField, workedHoursField, attendanceStatusField]);
    requireColumns(timesheetColumnsMap, timesheetSlug, [timesheetEmployeeField, timesheetDateField, timesheetHoursField, timesheetOvertimeField, timesheetStatusField]);

    const attendancePatch = options.attendance_patch && typeof options.attendance_patch === 'object'
      ? options.attendance_patch
      : {};
    const checkIn = attendancePatch[checkInField] ?? attendancePatch.check_in_at ?? attendancePatch.checkInAt ?? null;
    const checkOut = attendancePatch[checkOutField] ?? attendancePatch.check_out_at ?? attendancePatch.checkOutAt ?? null;
    const workedHoursRaw = attendancePatch[workedHoursField] ?? attendancePatch.worked_hours ?? null;

    const calcWorkedHours = () => {
      if (workedHoursRaw !== null && workedHoursRaw !== undefined && workedHoursRaw !== '') {
        const value = Number(workedHoursRaw);
        if (!Number.isFinite(value) || value < 0) throw this._buildError('worked_hours must be a non-negative number', 400);
        return Number(value.toFixed(2));
      }
      if (!checkIn || !checkOut) return null;
      const inDate = new Date(checkIn);
      const outDate = new Date(checkOut);
      if (!Number.isFinite(inDate.getTime()) || !Number.isFinite(outDate.getTime())) {
        throw this._buildError('Invalid check-in/check-out datetime values', 400);
      }
      if (outDate.getTime() < inDate.getTime()) {
        throw this._buildError('check_out_at must be on or after check_in_at', 400);
      }
      const hours = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);
      return Number(hours.toFixed(2));
    };

    const attendanceTable = this._quoteIdent(attendanceSlug);
    let attendance = null;
    if (options.attendance_id || options.attendanceId) {
      attendance = await this.findByIdForUpdate(attendanceSlug, options.attendance_id || options.attendanceId, client);
    } else {
      const attendanceLookupSql = `SELECT * FROM ${attendanceTable}
        WHERE ${this._quoteIdent(attendanceEmployeeField)} = $1
          AND ${this._quoteIdent(attendanceDateField)} = $2
        LIMIT 1
        FOR UPDATE`;
      const attendanceLookupRes = await this._runQuery(client, attendanceLookupSql, [String(employeeId), String(workDate)]);
      if (attendanceLookupRes.rows.length) {
        attendance = this._normalizeRow(attendanceLookupRes.rows[0], attendanceColumns);
      }
    }

    const workedHours = calcWorkedHours();
    const attendancePayload = {
      [attendanceEmployeeField]: employeeId,
      [attendanceDateField]: String(workDate),
      [attendanceStatusField]:
        attendancePatch[attendanceStatusField] ||
        attendancePatch.status ||
        (attendance ? attendance[attendanceStatusField] : null) ||
        'Present',
    };
    if (attendanceColumnsMap.has(checkInField)) attendancePayload[checkInField] = checkIn || null;
    if (attendanceColumnsMap.has(checkOutField)) attendancePayload[checkOutField] = checkOut || null;
    if (workedHours !== null) {
      attendancePayload[workedHoursField] = workedHours;
    } else if (attendance && attendance[workedHoursField] !== undefined) {
      attendancePayload[workedHoursField] = attendance[workedHoursField];
    } else {
      attendancePayload[workedHoursField] = 0;
    }
    if (attendancePatch.note !== undefined && attendanceColumnsMap.has('note')) {
      attendancePayload.note = attendancePatch.note;
    }

    const persistedAttendance = attendance
      ? await this.updateWithClient(attendanceSlug, attendance.id, attendancePayload, client)
      : await this.createWithClient(attendanceSlug, attendancePayload, client);

    const dailyHours = Number(options.daily_hours || options.dailyHours || 8) || 8;
    const persistedWorked = Number(persistedAttendance[workedHoursField] || 0);
    const safeWorked = Number.isFinite(persistedWorked) ? persistedWorked : 0;
    const regularHours = Number(Math.min(safeWorked, dailyHours).toFixed(2));
    const overtimeHours = Number(Math.max(safeWorked - dailyHours, 0).toFixed(2));

    const timesheetTable = this._quoteIdent(timesheetSlug);
    const timesheetLookupSql = `SELECT * FROM ${timesheetTable}
      WHERE ${this._quoteIdent(timesheetEmployeeField)} = $1
        AND ${this._quoteIdent(timesheetDateField)} = $2
      LIMIT 1
      FOR UPDATE`;
    const timesheetLookupRes = await this._runQuery(client, timesheetLookupSql, [String(employeeId), String(workDate)]);
    const timesheet = timesheetLookupRes.rows.length
      ? this._normalizeRow(timesheetLookupRes.rows[0], timesheetColumns)
      : null;

    const timesheetPayload = {
      [timesheetEmployeeField]: employeeId,
      [timesheetDateField]: String(workDate),
      [timesheetHoursField]: regularHours,
      [timesheetOvertimeField]: overtimeHours,
      [timesheetStatusField]:
        (timesheet ? timesheet[timesheetStatusField] : null) ||
        options.default_timesheet_status ||
        options.defaultTimesheetStatus ||
        'Draft',
    };
    if (timesheetColumnsMap.has(timesheetAttendanceField)) {
      timesheetPayload[timesheetAttendanceField] = persistedAttendance.id;
    }
    if (options.timesheet_note !== undefined && timesheetColumnsMap.has('note')) {
      timesheetPayload.note = options.timesheet_note;
    }

    const persistedTimesheet = timesheet
      ? await this.updateWithClient(timesheetSlug, timesheet.id, timesheetPayload, client)
      : await this.createWithClient(timesheetSlug, timesheetPayload, client);

    return {
      attendance: persistedAttendance,
      timesheet: persistedTimesheet,
    };
  }

  async atomicApplyCompensationSnapshot(ledgerEntitySlug, snapshotEntitySlug, options = {}, client = null) {
    if (!client) {
      return this.withTransaction((tx) =>
        this.atomicApplyCompensationSnapshot(ledgerEntitySlug, snapshotEntitySlug, options, tx)
      );
    }

    const ledgerSlug = this._normalizeSlug(ledgerEntitySlug);
    const snapshotSlug = this._normalizeSlug(snapshotEntitySlug);

    const ledgerEmployeeField = String(options.ledger_employee_field || options.ledgerEmployeeField || 'employee_id');
    const ledgerPeriodField = String(options.ledger_period_field || options.ledgerPeriodField || 'pay_period');
    const ledgerTypeField = String(options.ledger_type_field || options.ledgerTypeField || 'component_type');
    const ledgerAmountField = String(options.ledger_amount_field || options.ledgerAmountField || 'amount');
    const ledgerStatusField = String(options.ledger_status_field || options.ledgerStatusField || 'status');

    const snapshotEmployeeField = String(options.snapshot_employee_field || options.snapshotEmployeeField || 'employee_id');
    const snapshotPeriodField = String(options.snapshot_period_field || options.snapshotPeriodField || 'pay_period');
    const snapshotGrossField = String(options.snapshot_gross_field || options.snapshotGrossField || 'gross_amount');
    const snapshotDeductionField = String(options.snapshot_deduction_field || options.snapshotDeductionField || 'deduction_amount');
    const snapshotNetField = String(options.snapshot_net_field || options.snapshotNetField || 'net_amount');
    const snapshotStatusField = String(options.snapshot_status_field || options.snapshotStatusField || 'status');
    const snapshotPostedAtField = String(options.snapshot_posted_at_field || options.snapshotPostedAtField || 'posted_at');

    const employeeId = options.employee_id || options.employeeId || options[ledgerEmployeeField];
    const payPeriod = options.pay_period || options.payPeriod || options[ledgerPeriodField];
    if (!employeeId) throw this._buildError('employee_id is required for compensation snapshot generation');
    if (!payPeriod) throw this._buildError('pay_period is required for compensation snapshot generation');

    const ledgerColumns = await this._getColumns(ledgerSlug, client);
    const ledgerColumnsMap = this._columnsMap(ledgerColumns);
    const snapshotColumns = await this._getColumns(snapshotSlug, client);
    const snapshotColumnsMap = this._columnsMap(snapshotColumns);

    const requireColumns = (columnsMap, slug, fields) => {
      for (const field of fields) {
        if (!columnsMap.has(field)) {
          throw this._buildError(`Field '${field}' does not exist on entity '${slug}'`, 400);
        }
      }
    };
    requireColumns(ledgerColumnsMap, ledgerSlug, [ledgerEmployeeField, ledgerPeriodField, ledgerTypeField, ledgerAmountField]);
    requireColumns(snapshotColumnsMap, snapshotSlug, [snapshotEmployeeField, snapshotPeriodField, snapshotGrossField, snapshotDeductionField, snapshotNetField, snapshotStatusField]);

    const ledgerRows = await this.findAllWithClient(ledgerSlug, {
      [ledgerEmployeeField]: employeeId,
      [ledgerPeriodField]: String(payPeriod),
    }, client);
    const includeStatuses = Array.isArray(options.include_statuses)
      ? options.include_statuses.map((s) => String(s))
      : (Array.isArray(options.includeStatuses) ? options.includeStatuses.map((s) => String(s)) : ['Draft', 'Posted']);

    const filteredRows = (Array.isArray(ledgerRows) ? ledgerRows : []).filter((row) => {
      if (!ledgerColumnsMap.has(ledgerStatusField)) return true;
      if (!includeStatuses.length) return true;
      const status = String(row[ledgerStatusField] || '');
      return includeStatuses.includes(status);
    });

    const round = (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
    };
    const normalizeType = (raw) => {
      const value = String(raw || '').trim().toLowerCase();
      if (value === 'earning' || value === 'earnings') return 'Earning';
      if (value === 'deduction' || value === 'deductions') return 'Deduction';
      return 'Earning';
    };

    let gross = 0;
    let deductions = 0;
    for (const row of filteredRows) {
      const amount = round(row[ledgerAmountField] || 0);
      const type = normalizeType(row[ledgerTypeField] || 'Earning');
      if (type === 'Deduction') deductions += amount;
      else gross += amount;
    }
    gross = round(gross);
    deductions = round(deductions);
    const net = round(gross - deductions);

    const snapshotTable = this._quoteIdent(snapshotSlug);
    const snapshotLookupSql = `SELECT * FROM ${snapshotTable}
      WHERE ${this._quoteIdent(snapshotEmployeeField)} = $1
        AND ${this._quoteIdent(snapshotPeriodField)} = $2
      LIMIT 1
      FOR UPDATE`;
    const snapshotLookupRes = await this._runQuery(client, snapshotLookupSql, [String(employeeId), String(payPeriod)]);
    const existingSnapshot = snapshotLookupRes.rows.length
      ? this._normalizeRow(snapshotLookupRes.rows[0], snapshotColumns)
      : null;

    const snapshotPayload = {
      [snapshotEmployeeField]: employeeId,
      [snapshotPeriodField]: String(payPeriod),
      [snapshotGrossField]: gross,
      [snapshotDeductionField]: deductions,
      [snapshotNetField]: net,
      [snapshotStatusField]: options.snapshot_status || options.snapshotStatus || 'Draft',
    };
    if (options.snapshot_note !== undefined && snapshotColumnsMap.has('note')) {
      snapshotPayload.note = options.snapshot_note;
    }
    if (snapshotColumnsMap.has(snapshotPostedAtField)) {
      snapshotPayload[snapshotPostedAtField] = null;
    }

    const snapshot = existingSnapshot
      ? await this.updateWithClient(snapshotSlug, existingSnapshot.id, snapshotPayload, client)
      : await this.createWithClient(snapshotSlug, snapshotPayload, client);

    const markLedgerPosted =
      options.mark_ledger_posted === true ||
      options.markLedgerPosted === true;
    if (markLedgerPosted && ledgerColumnsMap.has(ledgerStatusField)) {
      for (const row of filteredRows) {
        if (!row || !row.id) continue;
        await this.updateWithClient(ledgerSlug, row.id, {
          [ledgerStatusField]: 'Posted',
          ...(ledgerColumnsMap.has('posted_at') ? { posted_at: new Date().toISOString() } : {}),
        }, client);
      }
    }

    return {
      snapshot,
      totals: {
        gross_amount: gross,
        deduction_amount: deductions,
        net_amount: net,
        entry_count: filteredRows.length,
      },
    };
  }
}

module.exports = PostgresProvider;
