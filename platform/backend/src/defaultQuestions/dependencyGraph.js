// Plan C — Wizard Wiring (follow-up #3)
//
// Single source of truth for cross-pack wizard rules. Used by:
//   - moduleQuestionnaireService (server-side answer coercion)
//   - prefilledSdfService       (writes the new link toggles into the SDF)
//   - projectCrudController     (ships the graph down to the frontend)
//   - components/project/dependencyMirror.ts (TS mirror, fed by the API graph)
//
// Five primitives:
//   HARD_REQUIRES   — downstream key requires upstream key. Bi-directional coercion.
//   FEEDS_HINTS     — soft "this would be nice with that" hint, no coercion.
//   LINK_TOGGLES    — new yes/no questions that appear when both ends are on
//                     and write into modules.<module>.<link>.enabled.
//   ACTOR_DRIVEN_PACKS — capability keys that imply access_control must be on.
//   MODULE_PRESENCE_KEYS — pseudo-keys (HR_MODULE / INVOICE_MODULE / INVENTORY_MODULE)
//                     that an evaluator can resolve against the selected modules
//                     list rather than against an answer.
//
// Everything in this file is pure data + pure functions. No I/O, no service imports.

const MODULE_PRESENCE_KEYS = {
  HR_MODULE: 'hr',
  INVOICE_MODULE: 'invoice',
  INVENTORY_MODULE: 'inventory',
};

// Forward auto-enable (downstream yes -> upstream forced yes) AND
// backward cascade-off (upstream not-yes -> downstream forced no) both fire
// from this same edge list.
const HARD_REQUIRES = [
  {
    downstream: 'hr_enable_leave_approvals',
    upstream: 'hr_enable_leave_engine',
    reason_key: 'wizard.dep.leave_approvals_requires_leave_engine',
    reason_default_en:
      'Leave approvals require the leave-tracking engine — turning approvals on enables leave tracking too.',
    reason_default_tr:
      'İzin onayları için izin takibi gerekir — onayları açınca izin takibi de açılır.',
  },
];

// "Feeds" hints are advisory. Selecting one capability surfaces a hint pointing
// at another that would amplify it; it does NOT force either side. The frontend
// renders these next to the relevant questions.
const FEEDS_HINTS = [
  {
    from: 'hr_enable_compensation_ledger',
    to: 'hr_enable_attendance_time',
    hint_key: 'wizard.hint.compensation_ledger_feeds_attendance',
    default_en:
      'Tip: turning on time tracking lets payroll auto-calculate overtime from attendance.',
    default_tr:
      'İpucu: zaman takibini açarsanız bordro, mesai saatlerini puantaj kayıtlarından otomatik hesaplar.',
  },
  {
    from: 'hr_enable_leave_engine',
    to: 'hr_enable_attendance_time',
    hint_key: 'wizard.hint.leave_engine_feeds_attendance',
    default_en:
      'Tip: turning on time tracking lets approved leave automatically mark attendance as "On Leave".',
    default_tr:
      'İpucu: zaman takibini açarsanız onaylanan izinler puantajda otomatik olarak "İzinli" işaretlenir.',
  },
  {
    from: 'invoice_enable_payments',
    to: 'invoice_enable_calc_engine',
    hint_key: 'wizard.hint.payments_feeds_calc_engine',
    default_en:
      'Tip: per-line discounts and charges keep payment math accurate when partial payments come in.',
    default_tr:
      'İpucu: satır bazlı iskonto ve ücretler kısmi ödemelerde hesaplamayı doğru tutar.',
  },
];

// Each link toggle ships as a wizard question that only appears when both ends
// are on. It maps to an entry under `modules.<module>.<link>.enabled` in the SDF.
// The new questions are added inside the relevant module's pack (so the existing
// multi-pack registry handles ordering / completion accounting), and the SDF
// target is consumed by prefilledSdfService.
const LINK_TOGGLES = [
  {
    key: 'hr_leave_attendance_link',
    pack_module: 'hr',
    requires_both: ['hr_enable_leave_engine', 'hr_enable_attendance_time'],
    sdf_target: 'modules.hr.leave_attendance_link.enabled',
    default_on: true,
  },
  {
    key: 'hr_leave_payroll_link',
    pack_module: 'hr',
    requires_both: ['hr_enable_leave_engine', 'hr_enable_compensation_ledger'],
    sdf_target: 'modules.hr.leave_payroll_link.enabled',
    default_on: true,
  },
  {
    key: 'hr_timesheet_payroll_link',
    pack_module: 'hr',
    requires_both: ['hr_enable_attendance_time', 'hr_enable_compensation_ledger'],
    sdf_target: 'modules.hr.timesheet_payroll_link.enabled',
    default_on: false,
  },
  {
    key: 'invoice_stock_link',
    pack_module: 'invoice',
    requires_both: ['INVOICE_MODULE', 'INVENTORY_MODULE'],
    sdf_target: 'modules.invoice.stock_link.enabled',
    default_on: false,
  },
  {
    key: 'invoice_ap_link',
    pack_module: 'invoice',
    requires_both: ['invoice_enable_payments', 'inv_enable_inbound'],
    sdf_target: 'modules.invoice.ap_link.enabled',
    default_on: false,
  },
];

// Any of these answers being yes means modules.access_control.enabled = true
// must be written into the prefilled SDF (the design doc Section 3.1 list).
const ACTOR_DRIVEN_PACKS = [
  'hr_enable_leave_engine',
  'hr_enable_leave_approvals',
  'hr_enable_attendance_time',
  'hr_enable_compensation_ledger',
  'invoice_enable_payments',
  'invoice_enable_calc_engine',
  'inv_enable_reservations',
  'inv_enable_inbound',
  'inv_enable_cycle_counting',
];

function _normalizeAnswerYes(value) {
  if (Array.isArray(value)) return false;
  if (typeof value === 'boolean') return value === true;
  if (value === null || value === undefined) return false;
  return String(value).trim().toLowerCase() === 'yes';
}

function _isYes(value) {
  return _normalizeAnswerYes(value);
}

function _isExplicitNo(value) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return value === false;
  return String(value).trim().toLowerCase() === 'no';
}

function _detectHardRequireCycle(edges) {
  // Tarjan-lite: build adjacency (downstream -> upstream) and DFS for cycles.
  const adj = new Map();
  for (const edge of edges) {
    if (!adj.has(edge.downstream)) adj.set(edge.downstream, []);
    adj.get(edge.downstream).push(edge.upstream);
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();
  for (const node of adj.keys()) color.set(node, WHITE);
  const cycle = [];
  function dfs(node, stack) {
    color.set(node, GRAY);
    stack.push(node);
    const neighbours = adj.get(node) || [];
    for (const next of neighbours) {
      const c = color.get(next);
      if (c === GRAY) {
        const startIdx = stack.indexOf(next);
        cycle.push(...stack.slice(startIdx), next);
        return true;
      }
      if (c === undefined) color.set(next, WHITE);
      if (color.get(next) === WHITE && dfs(next, stack)) return true;
    }
    stack.pop();
    color.set(node, BLACK);
    return false;
  }
  for (const node of adj.keys()) {
    if (color.get(node) === WHITE) {
      if (dfs(node, [])) return cycle;
    }
  }
  return null;
}

// Run once at module load. The graph is small and authored in this file, so a
// cycle here is a programmer bug we want to catch immediately.
(function _validateGraphAtLoad() {
  const cycle = _detectHardRequireCycle(HARD_REQUIRES);
  if (cycle && cycle.length) {
    throw new Error(
      `[dependencyGraph] HARD_REQUIRES cycle detected: ${cycle.join(' -> ')}`
    );
  }
}());

// Apply forward auto-enable + backward cascade-off + link-toggle defaults to a
// flat answers-by-key map. Returns the new map plus a list of coerced events.
//
// `answers` keys are wizard question `key` (not row id). Values match the
// stored shape: 'yes' / 'no' / array (multi_choice) / scalar string. We never
// touch keys that don't appear in HARD_REQUIRES or LINK_TOGGLES. Idempotent.
function applyDependencyCoercion(answers, modules) {
  const out = { ...(answers || {}) };
  const moduleSet = new Set(
    (Array.isArray(modules) ? modules : []).map((m) => String(m || '').trim().toLowerCase())
  );
  const coerced = [];

  // Helper: is a `requires_both` token currently satisfied?
  function tokenSatisfied(token) {
    if (Object.prototype.hasOwnProperty.call(MODULE_PRESENCE_KEYS, token)) {
      return moduleSet.has(MODULE_PRESENCE_KEYS[token]);
    }
    return _isYes(out[token]);
  }

  // Fixed-point loop over HARD_REQUIRES: at most edges*2 iterations because
  // each pass can flip at most one new edge in each direction.
  const maxIterations = Math.max(8, HARD_REQUIRES.length * 4);
  for (let i = 0; i < maxIterations; i += 1) {
    let changed = false;

    for (const edge of HARD_REQUIRES) {
      const downstreamYes = _isYes(out[edge.downstream]);
      const upstreamYes = _isYes(out[edge.upstream]);
      const upstreamExplicitNo = _isExplicitNo(out[edge.upstream]);

      // Cascade-off wins when there's an explicit conflict: the user said NO
      // to upstream while downstream is yes. The user picked cascade_off as
      // the conflict-resolution policy, so we respect their explicit no on
      // upstream and turn downstream off.
      if (downstreamYes && upstreamExplicitNo) {
        const was = out[edge.downstream];
        out[edge.downstream] = 'no';
        coerced.push({
          key: edge.downstream,
          was: was === undefined ? null : was,
          now: 'no',
          direction: 'cascade_off',
          driver: edge.upstream,
          reason_key: edge.reason_key,
        });
        changed = true;
        continue;
      }

      // Forward auto-enable: downstream is yes and upstream is not yet yes
      // AND not explicitly no — implicit/undefined gets promoted to yes.
      if (downstreamYes && !upstreamYes && !upstreamExplicitNo) {
        const was = out[edge.upstream];
        out[edge.upstream] = 'yes';
        coerced.push({
          key: edge.upstream,
          was: was === undefined ? null : was,
          now: 'yes',
          direction: 'auto_enable',
          driver: edge.downstream,
          reason_key: edge.reason_key,
        });
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Link-toggle defaults. When both ends are on but the user hasn't answered
  // the link question yet, seed it with the design-doc default. Never override
  // an explicit user answer, never force when ends aren't both on.
  for (const link of LINK_TOGGLES) {
    const bothOn = link.requires_both.every(tokenSatisfied);
    if (!bothOn) continue;
    const current = out[link.key];
    const explicit = _isYes(current) || _isExplicitNo(current);
    if (explicit) continue;
    out[link.key] = link.default_on ? 'yes' : 'no';
  }

  return { answers: out, coerced };
}

// API-facing serialization. The frontend mirror reads from this exact shape
// to render hints / badges / instant coercion.
function serializeForApi() {
  return {
    hard_requires: HARD_REQUIRES.map((edge) => ({
      downstream: edge.downstream,
      upstream: edge.upstream,
      reason_key: edge.reason_key,
      reason_default_en: edge.reason_default_en,
      reason_default_tr: edge.reason_default_tr,
    })),
    feeds_hints: FEEDS_HINTS.map((edge) => ({
      from: edge.from,
      to: edge.to,
      hint_key: edge.hint_key,
      default_en: edge.default_en,
      default_tr: edge.default_tr,
    })),
    link_toggles: LINK_TOGGLES.map((link) => ({
      key: link.key,
      pack_module: link.pack_module,
      requires_both: link.requires_both.slice(),
      sdf_target: link.sdf_target,
      default_on: link.default_on === true,
    })),
    actor_driven_packs: ACTOR_DRIVEN_PACKS.slice(),
    module_presence_keys: { ...MODULE_PRESENCE_KEYS },
  };
}

module.exports = {
  HARD_REQUIRES,
  FEEDS_HINTS,
  LINK_TOGGLES,
  ACTOR_DRIVEN_PACKS,
  MODULE_PRESENCE_KEYS,
  applyDependencyCoercion,
  serializeForApi,
};
