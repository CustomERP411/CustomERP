/**
 * relationRuleLibrary
 *
 * Plan B follow-up #2 — runtime evaluators for entity.relations[] primitives.
 *
 * Every implementation here is written as a method on a flat prototype
 * (`LIBRARY_PROTO`). Methods reference each other via `this.<name>`. This
 * shape lets us:
 *
 *   - Unit-test by binding a stub `self` and calling `LIBRARY_PROTO.<fn>.call(self, ctx)`.
 *   - Embed into the generated service file by serializing each method via
 *     `fn.toString()` and pasting the result inside the `class XService { ... }`
 *     body — no body rewriting required, because `this` already refers to
 *     the service instance.
 *
 * Naming convention (also the dispatch convention the runner uses):
 *
 *   _relInv_<name>   invariant handler   (kind: 'invariant')
 *   _relForm_<name>  derived-field handler (kind: 'derived_field')
 *   _relAct_<name>   status-action handler (kind: 'status_propagation')
 *   _relUtil_<name>  internal helper
 *
 * Every handler is `async (ctx)` where:
 *
 *   ctx = {
 *     rel,         // the relation entry from entity.relations[]
 *     parsedRule,  // for invariants/formulas: parseRelationRule output
 *     data,        // create/update payload
 *     prevState,   // pre-update record (null on create)
 *     result,      // post-persist record (after-hooks only)
 *     op,          // 'create' | 'update'
 *   }
 *
 * Invariants throw to block. Formulas mutate `data[rel.computed_field]`.
 * Actions perform side effects via `this.repository`.
 */

const LIBRARY_PROTO = {
  // ----- internal helpers --------------------------------------------------
  _relUtil_asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  },

  _relUtil_parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  },

  _relUtil_rangesOverlap(aStart, aEnd, bStart, bEnd) {
    if (!aStart || !aEnd || !bStart || !bEnd) return false;
    return aStart <= bEnd && bStart <= aEnd;
  },

  _relUtil_workDayList() {
    const cfg = (this.mixinConfig
      && this.mixinConfig.RelationRuleRunnerMixin
      && this.mixinConfig.RelationRuleRunnerMixin.workDays) || [1, 2, 3, 4, 5];
    return Array.isArray(cfg) ? cfg.map((d) => Number(d)) : [1, 2, 3, 4, 5];
  },

  _relUtil_countWorkingDays(start, end) {
    const startD = this._relUtil_parseDate(start);
    const endD = this._relUtil_parseDate(end);
    if (!startD || !endD || endD < startD) return 0;
    const set = new Set(this._relUtil_workDayList());
    let count = 0;
    const cursor = new Date(startD.getTime());
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(endD.getTime());
    last.setHours(0, 0, 0, 0);
    while (cursor <= last) {
      if (set.has(cursor.getDay())) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return count;
  },

  _relUtil_iterateWorkingDays(start, end) {
    const out = [];
    const startD = this._relUtil_parseDate(start);
    const endD = this._relUtil_parseDate(end);
    if (!startD || !endD || endD < startD) return out;
    const set = new Set(this._relUtil_workDayList());
    const cursor = new Date(startD.getTime());
    cursor.setHours(0, 0, 0, 0);
    const last = new Date(endD.getTime());
    last.setHours(0, 0, 0, 0);
    while (cursor <= last) {
      if (set.has(cursor.getDay())) {
        out.push(cursor.toISOString().slice(0, 10));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  },

  _relUtil_fieldError(field, code, message) {
    const err = new Error(message || `Validation failed for field '${field}': ${code}`);
    err.statusCode = 400;
    err.fieldErrors = { [field]: { code, message: message || code } };
    return err;
  },

  // Plan E — read a moduleToggles entry the way `_relWhenActive` does, but
  // return the raw value (not just a boolean check). Used by status-action
  // handlers that need to consult sibling-module config (e.g. issue_stock
  // honoring `modules.inventory.allow_negative_stock`). Returns `undefined`
  // when the toggle is not registered so callers can apply their own default.
  _relUtil_getModuleToggle(path) {
    if (!path) return undefined;
    const toggles = (this.mixinConfig
      && this.mixinConfig.RelationRuleRunnerMixin
      && this.mixinConfig.RelationRuleRunnerMixin.moduleToggles) || {};
    if (Object.prototype.hasOwnProperty.call(toggles, path)) {
      return toggles[path];
    }
    if (typeof this.modules === 'object' && this.modules) {
      const segs = String(path).replace(/^modules\./, '').split('.');
      let cursor = this.modules;
      for (const seg of segs) {
        if (!cursor || typeof cursor !== 'object') return undefined;
        cursor = cursor[seg];
      }
      return cursor;
    }
    return undefined;
  },

  // Plan E — today's ISO date string (yyyy-mm-dd). Centralized so the
  // serialization shape matches what InventoryTransactionSafetyMixin /
  // SalesOrderCommitmentMixin write into stock_movements.movement_date.
  _relUtil_todayIsoDate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  // Plan G D5 — predicate evaluator shared by `_relInv_conditional_required`
  // and (mirrored byte-for-byte) the client-side `isFieldVisible` helper in
  // brick-library/frontend-bricks/components/DynamicForm.tsx.
  // `predicate` shape: { field, equals|not_equals|in|not_in|is_set|is_unset }.
  // Truthiness rules:
  //  - equals / not_equals: stringified equality (matches form payloads which
  //    always carry strings; numeric callers can normalize before invoking).
  //  - in / not_in: membership test using stringified comparison.
  //  - is_set / is_unset: `empty` means undefined, null, or empty/whitespace string.
  // Returns `true` when no recognized comparator is present (forward-compat
  // with future operators rather than silent rejection).
  _relUtil_evalVisibilityPredicate(predicate, record) {
    if (!predicate || typeof predicate !== 'object') return true;
    const sourceField = predicate.field;
    if (typeof sourceField !== 'string' || !sourceField) return true;
    const sourceValue = record ? record[sourceField] : undefined;
    const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';
    if (Object.prototype.hasOwnProperty.call(predicate, 'equals')) {
      return String(sourceValue == null ? '' : sourceValue) === String(predicate.equals);
    }
    if (Object.prototype.hasOwnProperty.call(predicate, 'not_equals')) {
      return String(sourceValue == null ? '' : sourceValue) !== String(predicate.not_equals);
    }
    if (Array.isArray(predicate.in)) {
      const needle = String(sourceValue == null ? '' : sourceValue);
      return predicate.in.map((v) => String(v)).includes(needle);
    }
    if (Array.isArray(predicate.not_in)) {
      const needle = String(sourceValue == null ? '' : sourceValue);
      return !predicate.not_in.map((v) => String(v)).includes(needle);
    }
    if (typeof predicate.is_set === 'boolean') {
      return predicate.is_set ? !isEmpty(sourceValue) : isEmpty(sourceValue);
    }
    if (typeof predicate.is_unset === 'boolean') {
      return predicate.is_unset ? isEmpty(sourceValue) : !isEmpty(sourceValue);
    }
    return true;
  },

  // ----- invariants --------------------------------------------------------
  async _relInv_no_overlap_with(ctx) {
    const { parsedRule, data, prevState } = ctx;
    const args = (parsedRule && parsedRule.args) || {};
    const targetEntity = args.entity || this.slug;
    const groupBy = args.group_by;
    const statusIn = this._relUtil_asArray(args.status_in);
    const startField = args.start_field || 'start_date';
    const endField = args.end_field || 'end_date';
    const statusField = args.status_field || 'status';

    if (!groupBy) return;

    const merged = { ...(prevState || {}), ...(data || {}) };
    const groupValue = merged[groupBy];
    if (groupValue === undefined || groupValue === null || groupValue === '') return;

    const startVal = this._relUtil_parseDate(merged[startField]);
    const endVal = this._relUtil_parseDate(merged[endField]);
    if (!startVal || !endVal) return;

    let rows = [];
    try {
      rows = await this.repository.findAll(targetEntity, { [groupBy]: groupValue });
    } catch (_err) {
      rows = [];
    }
    const selfId = (prevState && prevState.id) || (data && data.id) || null;

    for (const row of rows || []) {
      if (!row) continue;
      if (selfId && String(row.id) === String(selfId)) continue;
      if (statusIn.length > 0) {
        if (!statusIn.map(String).includes(String(row[statusField]))) continue;
      }
      const otherStart = this._relUtil_parseDate(row[startField]);
      const otherEnd = this._relUtil_parseDate(row[endField]);
      if (!otherStart || !otherEnd) continue;
      if (this._relUtil_rangesOverlap(startVal, endVal, otherStart, otherEnd)) {
        const err = new Error(
          `Overlap detected on '${targetEntity}': another row for ${groupBy}=${groupValue} overlaps the requested range.`
        );
        err.statusCode = 409;
        err.fieldErrors = {
          [startField]: { code: 'overlap', message: err.message },
          [endField]: { code: 'overlap', message: err.message },
        };
        throw err;
      }
    }
  },

  async _relInv_non_negative_balance(ctx) {
    const { parsedRule, data, prevState } = ctx;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const fields = positional.length > 0
      ? positional
      : this._relUtil_asArray(args.field || args.fields);
    if (fields.length === 0) return;
    const merged = { ...(prevState || {}), ...(data || {}) };
    for (const field of fields) {
      if (!field) continue;
      const value = Number(merged[field]);
      if (Number.isFinite(value) && value < 0) {
        throw this._relUtil_fieldError(
          field,
          'non_negative_balance',
          `Field '${field}' cannot be negative.`
        );
      }
    }
  },

  async _relInv_qty_within_remaining(ctx) {
    const { parsedRule, data, prevState } = ctx;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const qtyField = args.qty_field || positional[0];
    const maxField = args.max_field || positional[1];
    if (!qtyField || !maxField) return;
    const merged = { ...(prevState || {}), ...(data || {}) };
    const qty = Number(merged[qtyField]);
    const max = Number(merged[maxField]);
    if (!Number.isFinite(qty) || !Number.isFinite(max)) return;
    if (qty > max) {
      throw this._relUtil_fieldError(
        qtyField,
        'qty_exceeds_remaining',
        `Field '${qtyField}' (${qty}) exceeds remaining '${maxField}' (${max}).`
      );
    }
  },

  // Plan G D5 — server-side mirror of DynamicForm's
  // visibility_when/required-when-visible logic. The AI emits this invariant
  // as a sibling to a field-level visibility_when so direct-API writes
  // can't bypass the form's "required when this field is shown" rule.
  //
  // DSL:
  //   conditional_required(field=<required>, when_field=<src>,
  //                        when_<op>=<value>, message=<optional>)
  //
  // `when_<op>` keys map to predicate operators (when_equals -> equals,
  // when_in -> in, ...). The predicate is evaluated against the
  // post-merge record (prevState + data). When the predicate matches AND
  // `merged[field]` is empty, throw a 400 with `field_errors[field]`.
  async _relInv_conditional_required(ctx) {
    const { parsedRule, data, prevState } = ctx;
    const args = (parsedRule && parsedRule.args) || {};
    const requiredField = args.field;
    const sourceField = args.when_field;
    if (!requiredField || !sourceField) return;

    // Map `when_<op>` arg keys back to the canonical predicate shape so
    // _relUtil_evalVisibilityPredicate can interpret it directly.
    const opKeys = ['when_equals', 'when_not_equals', 'when_in', 'when_not_in', 'when_is_set', 'when_is_unset'];
    const opKey = opKeys.find((k) => Object.prototype.hasOwnProperty.call(args, k));
    if (!opKey) return;
    const op = opKey.slice('when_'.length);
    let opValue = args[opKey];
    // The parser yields strings for scalars and arrays for `[a,b]` literals.
    // Booleans for is_set/is_unset arrive as the string 'true'/'false'.
    if (op === 'is_set' || op === 'is_unset') {
      opValue = String(opValue).toLowerCase() === 'true';
    }
    const predicate = { field: sourceField, [op]: opValue };

    const merged = { ...(prevState || {}), ...(data || {}) };
    if (!this._relUtil_evalVisibilityPredicate(predicate, merged)) return;

    const value = merged[requiredField];
    const isEmpty = value === undefined || value === null || String(value).trim() === '';
    if (!isEmpty) return;

    const message = args.message
      ? String(args.message)
      : `Field '${requiredField}' is required when '${sourceField}' ${op.replace(/_/g, ' ')} ${Array.isArray(opValue) ? opValue.join(', ') : opValue}.`;
    throw this._relUtil_fieldError(requiredField, 'conditional_required', message);
  },

  // ----- derived-field formulas --------------------------------------------
  async _relForm_working_days(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const startField = args.start_field || positional[0] || 'start_date';
    const endField = args.end_field || positional[1] || 'end_date';
    const merged = { ...(prevState || {}), ...(data || {}) };
    const days = this._relUtil_countWorkingDays(merged[startField], merged[endField]);
    if (Number.isFinite(days)) data[target] = days;
  },

  async _relForm_qty_minus_reserved_committed(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const qtyField = args.qty_field || positional[0] || 'quantity';
    const reservedField = args.reserved_field || positional[1] || 'reserved_quantity';
    const committedField = args.committed_field || positional[2] || 'committed_quantity';
    const merged = { ...(prevState || {}), ...(data || {}) };
    const qty = Number(merged[qtyField]) || 0;
    const reserved = Number(merged[reservedField]) || 0;
    const committed = Number(merged[committedField]) || 0;
    data[target] = qty - reserved - committed;
  },

  async _relForm_gross_minus_deductions(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const grossField = args.gross_field || positional[0] || 'gross_amount';
    const deductionField = args.deduction_field || positional[1] || 'deduction_amount';
    const merged = { ...(prevState || {}), ...(data || {}) };
    const gross = Number(merged[grossField]) || 0;
    const deductions = Number(merged[deductionField]) || 0;
    data[target] = gross - deductions;
  },

  // Plan F A1 — multiply two numeric fields. Targets:
  //   products.total_value     = multiply_fields(cost, quantity)
  //   invoice_items.line_total = multiply_fields(quantity, unit_price)
  // NaN-safe: missing/non-numeric values coerce to 0 so the formula never
  // throws and partially-filled forms get a sensible 0 baseline.
  async _relForm_multiply_fields(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const aField = args.a_field || args.a || positional[0];
    const bField = args.b_field || args.b || positional[1];
    if (!aField || !bField) return;
    const merged = { ...(prevState || {}), ...(data || {}) };
    const a = Number(merged[aField]);
    const b = Number(merged[bField]);
    const aSafe = Number.isFinite(a) ? a : 0;
    const bSafe = Number.isFinite(b) ? b : 0;
    data[target] = aSafe * bSafe;
  },

  // Plan F A1 — value × rate / denominator. Targets:
  //   invoices.tax_total           = percent_of(subtotal, tax_rate)
  //   invoice_items.line_tax_total = percent_of(line_subtotal, line_tax_rate)
  // The default denominator (100) treats the rate as a percentage. Override
  // with `denominator=1` if a fractional rate is being passed.
  async _relForm_percent_of(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const valueField = args.value_field || args.value || positional[0];
    const rateField = args.rate_field || args.rate || positional[1];
    if (!valueField || !rateField) return;
    const denominator = Number(args.denominator);
    const denomSafe = Number.isFinite(denominator) && denominator !== 0 ? denominator : 100;
    const merged = { ...(prevState || {}), ...(data || {}) };
    const value = Number(merged[valueField]);
    const rate = Number(merged[rateField]);
    const valueSafe = Number.isFinite(value) ? value : 0;
    const rateSafe = Number.isFinite(rate) ? rate : 0;
    data[target] = (valueSafe * rateSafe) / denomSafe;
  },

  // Plan F A1 — sum of plus_fields minus sum of minus_fields. Targets:
  //   invoices.grand_total = linear_combine(plus_fields=[subtotal, tax_total],
  //                                         minus_fields=[discount])
  // Both arg lists are arrays. Missing/non-numeric values coerce to 0.
  async _relForm_linear_combine(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const plusFields = this._relUtil_asArray(args.plus_fields || args.plus);
    const minusFields = this._relUtil_asArray(args.minus_fields || args.minus);
    if (plusFields.length === 0 && minusFields.length === 0) return;
    const merged = { ...(prevState || {}), ...(data || {}) };
    let sum = 0;
    for (const f of plusFields) {
      if (!f) continue;
      const v = Number(merged[String(f)]);
      if (Number.isFinite(v)) sum += v;
    }
    for (const f of minusFields) {
      if (!f) continue;
      const v = Number(merged[String(f)]);
      if (Number.isFinite(v)) sum -= v;
    }
    data[target] = sum;
  },

  // Plan F A1 — inclusive day-difference. Targets:
  //   leaves.leave_days = date_diff_days_inclusive(start_date, end_date)
  // Inclusive: a leave from Mon to Wed counts as 3 days, not 2. Returns 0
  // when either bound is missing or end < start (the form will display 0
  // until both ends are filled).
  async _relForm_date_diff_days_inclusive(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const positional = (parsedRule && parsedRule.positional) || [];
    const startField = args.start_field || positional[0] || 'start_date';
    const endField = args.end_field || positional[1] || 'end_date';
    const merged = { ...(prevState || {}), ...(data || {}) };
    const start = this._relUtil_parseDate(merged[startField]);
    const end = this._relUtil_parseDate(merged[endField]);
    if (!start || !end) {
      data[target] = 0;
      return;
    }
    const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    if (endMs < startMs) {
      data[target] = 0;
      return;
    }
    const days = Math.round((endMs - startMs) / 86400000) + 1;
    data[target] = days;
  },

  async _relForm_count_lines(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const childEntity = args.child_entity;
    const parentField = args.parent_field;
    if (!childEntity || !parentField) return;
    const id = (prevState && prevState.id) || (data && data.id);
    if (!id) return;
    let rows = [];
    try {
      rows = await this.repository.findAll(childEntity, { [parentField]: id });
    } catch (_err) {
      rows = [];
    }
    data[target] = Array.isArray(rows) ? rows.length : 0;
  },

  async _relForm_sum_lines(ctx) {
    const { rel, parsedRule, data, prevState } = ctx;
    const target = rel.computed_field;
    if (!target) return;
    const args = (parsedRule && parsedRule.args) || {};
    const childEntity = args.child_entity;
    const parentField = args.parent_field;
    const sumField = args.sum_field || 'line_total';
    if (!childEntity || !parentField) return;
    const id = (prevState && prevState.id) || (data && data.id);
    if (!id) return;
    let rows = [];
    try {
      rows = await this.repository.findAll(childEntity, { [parentField]: id });
    } catch (_err) {
      rows = [];
    }
    let total = 0;
    for (const row of rows || []) {
      const v = Number(row && row[sumField]);
      if (Number.isFinite(v)) total += v;
    }
    data[target] = total;
  },

  // ----- status-propagation actions ----------------------------------------
  async _relAct_create_per_work_day(ctx) {
    const { rel, data, result, prevState } = ctx;
    const targetEntity = rel.effect && rel.effect.target_entity;
    if (!targetEntity) return;
    const setFields = (rel.effect && rel.effect.set_fields) || {};
    // After-persist actions observe the post-persist record. Merge in
    // prevState first so any fields the persisted record dropped still
    // resolve, then overlay the persisted record + final data overrides.
    const merged = { ...(prevState || {}), ...(result || {}), ...(data || {}) };
    const startField = (rel.effect && rel.effect.start_field) || 'start_date';
    const endField = (rel.effect && rel.effect.end_field) || 'end_date';
    const dateField = (rel.effect && rel.effect.date_field) || 'work_date';
    const ownerField = (rel.effect && rel.effect.owner_field) || 'employee_id';
    const originField = (rel.effect && rel.effect.origin_field) || 'origin_ref';
    const days = this._relUtil_iterateWorkingDays(merged[startField], merged[endField]);
    const ownerValue = merged[ownerField];
    const sourceId = (result && result.id) || (prevState && prevState.id) || (data && data.id);
    if (!sourceId) return;
    for (const day of days) {
      const row = { ...setFields, [dateField]: day };
      if (ownerValue !== undefined) row[ownerField] = ownerValue;
      row[originField] = `${this.slug}:${sourceId}`;
      try {
        await this.repository.create(targetEntity, row);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[RelationRuleRunner] create_per_work_day failed for ${targetEntity}: ${err && err.message}`);
        }
      }
    }
  },

  async _relAct_remove_emitted_rows(ctx) {
    const { rel, prevState, result, data } = ctx;
    const targetEntity = (rel.reverse && rel.reverse.target_entity)
      || (rel.effect && rel.effect.target_entity);
    if (!targetEntity) return;
    const originField = (rel.effect && rel.effect.origin_field) || 'origin_ref';
    const sourceId = (result && result.id) || (prevState && prevState.id) || (data && data.id);
    if (!sourceId) return;
    const tag = `${this.slug}:${sourceId}`;
    let rows = [];
    try {
      rows = await this.repository.findAll(targetEntity, { [originField]: tag });
    } catch (_err) {
      rows = [];
    }
    for (const row of rows || []) {
      if (!row || !row.id) continue;
      try {
        await this.repository.delete(targetEntity, row.id);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[RelationRuleRunner] remove_emitted_rows failed for ${targetEntity}#${row.id}: ${err && err.message}`);
        }
      }
    }
  },

  async _relAct_add_ledger_line(ctx) {
    const { rel, data, result, prevState } = ctx;
    const targetEntity = rel.effect && rel.effect.target_entity;
    if (!targetEntity) return;
    const setFields = (rel.effect && rel.effect.set_fields) || {};
    const merged = { ...(prevState || {}), ...(result || {}), ...(data || {}) };
    const ownerField = (rel.effect && rel.effect.owner_field) || 'employee_id';
    const originField = (rel.effect && rel.effect.origin_field) || 'origin_ref';
    const sourceId = (result && result.id) || (prevState && prevState.id) || (data && data.id);
    if (!sourceId) return;
    const row = { ...setFields };
    if (merged[ownerField] !== undefined) row[ownerField] = merged[ownerField];
    row[originField] = `${this.slug}:${sourceId}`;
    try {
      await this.repository.create(targetEntity, row);
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[RelationRuleRunner] add_ledger_line failed for ${targetEntity}: ${err && err.message}`);
      }
    }
  },

  async _relAct_commit_reservations(ctx) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[RelationRuleRunner] commit_reservations is a stub for entity '${this.slug}'. ` +
        `Existing inventory mixins handle commitment side effects directly. ` +
        `(relation: ${JSON.stringify((ctx.rel && ctx.rel.effect) || {})})`
      );
    }
  },

  async _relAct_release_reservations(ctx) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[RelationRuleRunner] release_reservations is a stub for entity '${this.slug}'. ` +
        `Existing inventory mixins handle release side effects directly. ` +
        `(relation: ${JSON.stringify((ctx.rel && ctx.rel.effect) || {})})`
      );
    }
  },

  async _relAct_reverse_stock_movements(ctx) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(
        `[RelationRuleRunner] reverse_stock_movements is a stub for entity '${this.slug}'. ` +
        `Existing inventory mixins handle reversal side effects directly. ` +
        `(relation: ${JSON.stringify((ctx.rel && ctx.rel.effect) || {})})`
      );
    }
  },

  // Plan E — Group E (invoice -> stock).
  //
  // DSL:
  //   issue_stock(child_entity=invoice_items, parent_field=invoice_id,
  //               item_field=product_id, qty_field=quantity,
  //               location_field=location_id, stock_entity=products)
  //
  // When an `invoices` row transitions into `Posted`:
  //   1. Load every `invoice_items` row whose `invoice_id` matches the source.
  //   2. For each line that names a stocked SKU (line[item_field] is set):
  //      - Atomically decrement the product's on-hand quantity by `qty`.
  //        Honors `modules.inventory.allow_negative_stock` so the same guard
  //        the inventory_ops.issue path uses applies here too.
  //      - Append a `stock_movements` audit row tagged with
  //        `origin_ref = '<source_slug>:<source_id>'` so the reverse action
  //        can find them. The row's `movement_type` is the canonical
  //        capitalized value the prefilled SDF emits (`Issue`).
  //   3. Lines without an item ref are skipped silently — services/free-
  //      text rows on the same invoice never block stocked-line posting.
  //
  // Failures (atomic adjust throwing for negative stock, repository.create
  // failing) are NOT swallowed — they bubble up, and the runner logs them
  // through the per-call try/catch already present in `_relRunAfterPersist`'s
  // hook bodies. We DO swallow per-line errors after that the first one,
  // matching the lenient pattern in `add_ledger_line`, so a single bad line
  // can't prevent the rest of the invoice from posting cleanly.
  async _relAct_issue_stock(ctx) {
    const { rel, parsedAction, result, prevState, data } = ctx;
    const args = (parsedAction && parsedAction.args) || {};
    const childEntity = args.child_entity;
    const parentField = args.parent_field;
    const itemField = args.item_field || 'product_id';
    const qtyField = args.qty_field || 'quantity';
    const locationField = args.location_field || 'location_id';
    const stockEntity = args.stock_entity || 'products';
    const targetEntity = (rel.effect && rel.effect.target_entity) || 'stock_movements';
    if (!childEntity || !parentField) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[RelationRuleRunner] issue_stock missing child_entity/parent_field on '${this.slug}'.`);
      }
      return;
    }
    const sourceId = (result && result.id) || (prevState && prevState.id) || (data && data.id);
    if (!sourceId) return;
    const allowNegative = this._relUtil_getModuleToggle('modules.inventory.allow_negative_stock') === true;
    const movementType = (rel.effect && rel.effect.movement_type) || 'Issue';
    const referenceField = (rel.effect && rel.effect.reference_field) || 'reference_number';
    const merged = { ...(prevState || {}), ...(result || {}), ...(data || {}) };
    const referenceValue = merged.invoice_number || merged.number || merged.code;
    const today = this._relUtil_todayIsoDate();
    const tag = `${this.slug}:${sourceId}`;

    let lines = [];
    try {
      lines = await this.repository.findAll(childEntity, { [parentField]: sourceId });
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[RelationRuleRunner] issue_stock could not load lines from '${childEntity}': ${err && err.message}`);
      }
      return;
    }

    for (const line of lines || []) {
      if (!line) continue;
      const itemId = line[itemField];
      if (itemId === undefined || itemId === null || String(itemId).trim() === '') continue;
      const qtyRaw = Number(line[qtyField]);
      if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) continue;

      try {
        if (typeof this.repository.atomicAdjustQuantity === 'function') {
          await this.repository.atomicAdjustQuantity(
            stockEntity,
            itemId,
            -qtyRaw,
            { quantityField: 'quantity', allow_negative_stock: allowNegative }
          );
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[RelationRuleRunner] issue_stock adjust failed for ${stockEntity}#${itemId}: ${err && err.message}`);
        }
        continue;
      }

      const auditRow = {
        item_id: itemId,
        movement_type: movementType,
        quantity: qtyRaw,
        movement_date: today,
        origin_ref: tag,
      };
      if (line[locationField] !== undefined && line[locationField] !== null && String(line[locationField]).trim() !== '') {
        auditRow.location_id = line[locationField];
      }
      if (referenceValue !== undefined && referenceValue !== null && String(referenceValue).trim() !== '') {
        auditRow[referenceField] = String(referenceValue);
      }
      try {
        await this.repository.create(targetEntity, auditRow);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[RelationRuleRunner] issue_stock audit row failed for ${targetEntity}: ${err && err.message}`);
        }
      }
    }
  },

  // Plan E — reverse companion to issue_stock. On Cancelled (or whatever
  // reverse trigger the SDF declares), every audit row tagged with
  // `<source_slug>:<source_id>` is restored:
  //   - The product's on-hand quantity is incremented by the row's qty.
  //   - A compensating `Adjust` audit row is created tagged
  //     `<slug>:<id>:reverse` so we keep an immutable trail (we do NOT
  //     delete the original Issue row).
  // The `stock_entity` defaults to `products` but can be overridden via
  // `rel.effect.stock_entity` — the runner passes the FORWARD effect's
  // settings into reverse via `rel` so the reverse handler does not need
  // duplicate args on rel.reverse.action.
  async _relAct_reverse_issue_stock(ctx) {
    const { rel, parsedAction, result, prevState, data } = ctx;
    const args = (parsedAction && parsedAction.args) || {};
    const stockEntity = args.stock_entity
      || (rel.effect && rel.effect.stock_entity)
      || 'products';
    const targetEntity = (rel.reverse && rel.reverse.target_entity)
      || (rel.effect && rel.effect.target_entity)
      || 'stock_movements';
    const sourceId = (result && result.id) || (prevState && prevState.id) || (data && data.id);
    if (!sourceId) return;
    const allowNegative = this._relUtil_getModuleToggle('modules.inventory.allow_negative_stock') === true;
    const tag = `${this.slug}:${sourceId}`;
    const reverseTag = `${tag}:reverse`;
    const today = this._relUtil_todayIsoDate();

    let issued = [];
    try {
      issued = await this.repository.findAll(targetEntity, { origin_ref: tag });
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[RelationRuleRunner] reverse_issue_stock could not load '${targetEntity}': ${err && err.message}`);
      }
      return;
    }

    for (const row of issued || []) {
      if (!row) continue;
      const itemId = row.item_id;
      const qtyRaw = Number(row.quantity);
      if (itemId === undefined || itemId === null) continue;
      if (!Number.isFinite(qtyRaw) || qtyRaw <= 0) continue;
      // Only reverse rows we actually issued. Treat anything else (e.g. an
      // Adjust row left by an earlier reverse) as already-reversed.
      const movementType = row.movement_type;
      if (movementType !== undefined && movementType !== null && String(movementType) !== 'Issue') continue;

      try {
        if (typeof this.repository.atomicAdjustQuantity === 'function') {
          await this.repository.atomicAdjustQuantity(
            stockEntity,
            itemId,
            qtyRaw,
            { quantityField: 'quantity', allow_negative_stock: allowNegative }
          );
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[RelationRuleRunner] reverse_issue_stock adjust failed for ${stockEntity}#${itemId}: ${err && err.message}`);
        }
        continue;
      }

      const compensatingRow = {
        item_id: itemId,
        movement_type: 'Adjust',
        quantity: qtyRaw,
        movement_date: today,
        origin_ref: reverseTag,
      };
      if (row.location_id !== undefined && row.location_id !== null) {
        compensatingRow.location_id = row.location_id;
      }
      try {
        await this.repository.create(targetEntity, compensatingRow);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[RelationRuleRunner] reverse_issue_stock audit row failed for ${targetEntity}: ${err && err.message}`);
        }
      }
    }
  },
};

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

const INVARIANT_NAMES = [
  'no_overlap_with',
  'non_negative_balance',
  'qty_within_remaining',
  // Plan G D5 — server mirror of frontend visibility_when. Keep this name
  // in sync with sdfValidation._validateRelations (D6) and the AI prompt
  // directives that pair every visibility_when with a sibling
  // conditional_required invariant.
  'conditional_required',
];
const FORMULA_NAMES = [
  'working_days',
  'qty_minus_reserved_committed',
  'gross_minus_deductions',
  // Plan F A1 — generic numeric/date formulas. Mirrored exactly in the
  // shared client evaluator (`brick-library/frontend-bricks/lib/
  // derivedFieldEvaluator.ts`); a parity test pins the two implementations
  // to identical outputs for identical inputs.
  'multiply_fields',
  'percent_of',
  'linear_combine',
  'date_diff_days_inclusive',
  'count_lines',
  'sum_lines',
];
const ACTION_NAMES = [
  'create_per_work_day',
  'remove_emitted_rows',
  'commit_reservations',
  'release_reservations',
  'reverse_stock_movements',
  'add_ledger_line',
  // Plan E — Group E (invoice -> stock). issue_stock fans out per child
  // line (typically invoice_items) on Posted, calls atomicAdjustQuantity
  // against the stock entity, and emits a stock_movements audit row tagged
  // `<source_slug>:<source_id>` for reversibility. reverse_issue_stock
  // restores the quantity and writes a compensating Adjust row when the
  // source row transitions into Cancelled. Both honor
  // `modules.inventory.allow_negative_stock`.
  'issue_stock',
  'reverse_issue_stock',
];

// Serialized source: every method, in declaration order, ready to be pasted
// inside a `class XService { ... }` body. Methods reference each other via
// `this.<name>` so no body rewriting is required.
function buildLibrarySource() {
  const ordered = [
    '_relUtil_asArray',
    '_relUtil_parseDate',
    '_relUtil_rangesOverlap',
    '_relUtil_workDayList',
    '_relUtil_countWorkingDays',
    '_relUtil_iterateWorkingDays',
    '_relUtil_fieldError',
    '_relUtil_evalVisibilityPredicate',
    '_relUtil_getModuleToggle',
    '_relUtil_todayIsoDate',
    ...INVARIANT_NAMES.map((n) => `_relInv_${n}`),
    ...FORMULA_NAMES.map((n) => `_relForm_${n}`),
    ...ACTION_NAMES.map((n) => `_relAct_${n}`),
  ];
  return ordered
    .map((name) => {
      const fn = LIBRARY_PROTO[name];
      if (typeof fn !== 'function') return '';
      return fn.toString();
    })
    .filter(Boolean)
    .join('\n\n');
}

module.exports = {
  LIBRARY_PROTO,
  INVARIANT_NAMES,
  FORMULA_NAMES,
  ACTION_NAMES,
  buildLibrarySource,
};
