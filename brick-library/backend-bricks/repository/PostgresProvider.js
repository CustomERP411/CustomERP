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
}

module.exports = PostgresProvider;
