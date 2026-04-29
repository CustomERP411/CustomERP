/**
 * relationRuleParser
 *
 * Plan B follow-up #2 — parser for the tiny DSL used by entity.relations[]
 * `rule` strings (invariants), `formula` strings (derived fields), and
 * `effect.action` strings (status propagation).
 *
 * Grammar (intentionally minimal):
 *
 *   working_days(start_date, end_date)
 *   no_overlap_with(entity=leaves, group_by=employee_id, status_in=[Pending, Approved])
 *   qty_minus_reserved_committed(quantity, reserved_quantity, committed_quantity)
 *   create_per_work_day(target_entity=attendance_entries)
 *
 * Output shape:
 *   {
 *     name: 'no_overlap_with',
 *     args: { entity: 'leaves', group_by: 'employee_id', status_in: ['Pending','Approved'] },
 *     positional: ['start_date','end_date']  // tokens without `=`
 *   }
 *
 * Returns `null` on parse failure — callers must handle that gracefully.
 *
 * Methods are written as a flat prototype with `this.<helper>` references so
 * the RelationRuleRunnerMixin can serialize each method via `fn.toString()`
 * and paste them into the generated service class body verbatim.
 */

const PARSER_PROTO = {
  _relParseRule(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    if (!trimmed) return null;

    const headMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([\s\S]*)\)\s*$/);
    if (!headMatch) return null;
    const name = headMatch[1];
    const body = headMatch[2];

    const tokens = this._relParse_splitTopLevelCommas(body);
    const args = {};
    const positional = [];

    for (const rawToken of tokens) {
      const token = rawToken.trim();
      if (!token) continue;
      const eqIdx = this._relParse_findTopLevelEquals(token);
      if (eqIdx === -1) {
        positional.push(token);
        continue;
      }
      const key = token.slice(0, eqIdx).trim();
      const valueRaw = token.slice(eqIdx + 1).trim();
      if (!key) return null;
      args[key] = this._relParse_parseValue(valueRaw);
    }

    return { name, args, positional };
  },

  _relParse_splitTopLevelCommas(text) {
    const parts = [];
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
  },

  _relParse_findTopLevelEquals(text) {
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '[' || ch === '(' || ch === '{') depth++;
      else if (ch === ']' || ch === ')' || ch === '}') depth = Math.max(0, depth - 1);
      else if (ch === '=' && depth === 0) return i;
    }
    return -1;
  },

  _relParse_parseValue(text) {
    const trimmed = text.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1);
      const items = this._relParse_splitTopLevelCommas(inner)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      return items;
    }
    return trimmed;
  },
};

// Standalone function for direct test use (matches PARSER_PROTO._relParseRule).
function parseRelationRule(text) {
  return PARSER_PROTO._relParseRule.call(PARSER_PROTO, text);
}

function buildParserSource() {
  const ordered = [
    '_relParseRule',
    '_relParse_splitTopLevelCommas',
    '_relParse_findTopLevelEquals',
    '_relParse_parseValue',
  ];
  return ordered
    .map((name) => {
      const fn = PARSER_PROTO[name];
      return typeof fn === 'function' ? fn.toString() : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

module.exports = {
  parseRelationRule,
  PARSER_PROTO,
  buildParserSource,
};
