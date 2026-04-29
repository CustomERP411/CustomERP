/**
 * derivedFieldEvaluator
 *
 * Plan F A2 — shared client evaluator for derived-field formulas. The five
 * named handlers here mirror the server-side
 * `relationRuleLibrary.js` implementations exactly; a parity test
 * (`tests/UnitTests/UC-7/UC-7.5/relationRuleLibrary.derivedFormulas.unit.test.js`)
 * asserts identical outputs for identical inputs.
 *
 * Why a duplicate? The server is authoritative on persistence (the user can
 * never persuade the database to skip the BEFORE_CREATE rule). The client
 * evaluator exists purely so the form shows the right number AS THE USER
 * TYPES — no round-trip to the server, no flicker on save.
 *
 * Grammar (intentionally minimal — same as the server parser):
 *
 *   working_days(start_date, end_date)
 *   percent_of(subtotal, tax_rate)
 *   linear_combine(plus_fields=[a,b], minus_fields=[c])
 *   sum_lines(child_entity=invoice_items, parent_field=invoice_id, sum_field=line_total)
 *
 * `evaluate({ computed_field, formula }, ctx)` parses the formula, dispatches
 * to the matching handler, and returns the new numeric (or 0) value for
 * `computed_field`. Returns `undefined` on parse failure or unknown handler
 * so callers can leave the existing field value alone.
 */

export type DerivedRelation = {
  computed_field: string;
  formula: string;
};

export type DerivedContext = {
  formData: Record<string, any>;
  // Map of child-entity slug -> array of currently-known child rows. Only
  // sum_lines reads from this; every other handler reads `formData` only.
  childItemsBySlug?: Record<string, any[]>;
};

type ParsedFormula = {
  name: string;
  args: Record<string, any>;
  positional: string[];
};

// ---------- parser (TS port of relationRuleParser.js) ----------------------

function _splitTopLevelCommas(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '(' || ch === '{') {
      depth++;
      buf += ch;
      continue;
    }
    if (ch === ']' || ch === ')' || ch === '}') {
      depth = Math.max(0, depth - 1);
      buf += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.length > 0) parts.push(buf);
  return parts;
}

function _findTopLevelEquals(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[' || ch === '(' || ch === '{') depth++;
    else if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === '=' && depth === 0) return i;
  }
  return -1;
}

function _parseValue(text: string): any {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1);
    return _splitTopLevelCommas(inner)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return trimmed;
}

export function parseFormula(text: string): ParsedFormula | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const headMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
  if (!headMatch) return null;
  const name = headMatch[1];
  const body = headMatch[2];
  const tokens = _splitTopLevelCommas(body);
  const args: Record<string, any> = {};
  const positional: string[] = [];
  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;
    const eqIdx = _findTopLevelEquals(token);
    if (eqIdx === -1) {
      positional.push(token);
      continue;
    }
    const key = token.slice(0, eqIdx).trim();
    const valueRaw = token.slice(eqIdx + 1).trim();
    if (!key) return null;
    args[key] = _parseValue(valueRaw);
  }
  return { name, args, positional };
}

// ---------- numeric coercion shared by every handler ----------------------

function _num(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function _asArray(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

// ---------- handlers (mirror relationRuleLibrary.js semantics) ------------

function _handle_multiply_fields(
  parsed: ParsedFormula,
  formData: Record<string, any>,
): number {
  const aField = parsed.args.a_field || parsed.args.a || parsed.positional[0];
  const bField = parsed.args.b_field || parsed.args.b || parsed.positional[1];
  if (!aField || !bField) return 0;
  return _num(formData[aField]) * _num(formData[bField]);
}

function _handle_percent_of(
  parsed: ParsedFormula,
  formData: Record<string, any>,
): number {
  const valueField = parsed.args.value_field || parsed.args.value || parsed.positional[0];
  const rateField = parsed.args.rate_field || parsed.args.rate || parsed.positional[1];
  if (!valueField || !rateField) return 0;
  const denominator = Number(parsed.args.denominator);
  const denomSafe = Number.isFinite(denominator) && denominator !== 0 ? denominator : 100;
  return (_num(formData[valueField]) * _num(formData[rateField])) / denomSafe;
}

function _handle_linear_combine(
  parsed: ParsedFormula,
  formData: Record<string, any>,
): number {
  const plusFields = _asArray(parsed.args.plus_fields || parsed.args.plus);
  const minusFields = _asArray(parsed.args.minus_fields || parsed.args.minus);
  let sum = 0;
  for (const f of plusFields) {
    if (!f) continue;
    sum += _num(formData[String(f)]);
  }
  for (const f of minusFields) {
    if (!f) continue;
    sum -= _num(formData[String(f)]);
  }
  return sum;
}

function _handle_date_diff_days_inclusive(
  parsed: ParsedFormula,
  formData: Record<string, any>,
): number {
  const startField = parsed.args.start_field || parsed.positional[0] || 'start_date';
  const endField = parsed.args.end_field || parsed.positional[1] || 'end_date';
  const startRaw = formData[startField];
  const endRaw = formData[endField];
  if (!startRaw || !endRaw) return 0;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  const startMs = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const endMs = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  if (endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 86400000) + 1;
}

function _handle_sum_lines(
  parsed: ParsedFormula,
  ctx: DerivedContext,
): number {
  const childEntity = parsed.args.child_entity;
  const sumField = parsed.args.sum_field || 'line_total';
  if (!childEntity) return 0;
  const rows = (ctx.childItemsBySlug && ctx.childItemsBySlug[String(childEntity)]) || [];
  let total = 0;
  for (const row of rows) {
    if (!row) continue;
    total += _num(row[sumField]);
  }
  return total;
}

// ---------- public entry point --------------------------------------------

export function evaluate(rel: DerivedRelation, ctx: DerivedContext): any {
  if (!rel || !rel.computed_field || !rel.formula) return undefined;
  const parsed = parseFormula(rel.formula);
  if (!parsed) return undefined;
  const formData = ctx.formData || {};
  switch (parsed.name) {
    case 'multiply_fields':
      return _handle_multiply_fields(parsed, formData);
    case 'percent_of':
      return _handle_percent_of(parsed, formData);
    case 'linear_combine':
      return _handle_linear_combine(parsed, formData);
    case 'date_diff_days_inclusive':
      return _handle_date_diff_days_inclusive(parsed, formData);
    case 'sum_lines':
      return _handle_sum_lines(parsed, ctx);
    default:
      // Unknown handler — leave the current value alone so server-only
      // formulas (e.g. count_lines, qty_minus_reserved_committed) don't
      // get clobbered with 0 on the client.
      return undefined;
  }
}

// Names supported by the client evaluator; the parity test asserts this
// matches the FORMULA_NAMES intersection that BOTH sides implement.
export const CLIENT_FORMULA_NAMES = [
  'multiply_fields',
  'percent_of',
  'linear_combine',
  'date_diff_days_inclusive',
  'sum_lines',
] as const;
