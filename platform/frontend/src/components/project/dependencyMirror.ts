// Plan C — wizard wiring. TS mirror of platform/backend/src/defaultQuestions/dependencyGraph.js
// applyDependencyCoercion. The same scenarios run against this mirror in
// tests/UnitTests/UC-7/UC-7.5/dependencyMirror.unit.test.js to keep the two
// in lockstep.
//
// The mirror is pure and fed by the dependency graph the API ships down on
// every state response — it never hardcodes rules. If the backend graph
// changes, the frontend picks it up automatically.
import type {
  DependencyGraph,
  CoercedAnswer,
} from '../../types/defaultQuestions';

export type AnswerMap = Record<string, string | string[] | boolean | null | undefined>;

function isYes(value: AnswerMap[string]): boolean {
  if (Array.isArray(value)) return false;
  if (typeof value === 'boolean') return value === true;
  if (value === null || value === undefined) return false;
  return String(value).trim().toLowerCase() === 'yes';
}

function isExplicitNo(value: AnswerMap[string]): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'boolean') return value === false;
  return String(value).trim().toLowerCase() === 'no';
}

export interface CoercionResult {
  answers: AnswerMap;
  coerced: CoercedAnswer[];
}

export function applyDependencyCoercion(
  graph: DependencyGraph | null | undefined,
  answers: AnswerMap,
  modules: string[],
): CoercionResult {
  if (!graph) return { answers: { ...(answers || {}) }, coerced: [] };

  const out: AnswerMap = { ...(answers || {}) };
  const moduleSet = new Set(
    (Array.isArray(modules) ? modules : []).map((m) => String(m || '').trim().toLowerCase()),
  );
  const coerced: CoercedAnswer[] = [];
  const presence = graph.module_presence_keys || {};

  const tokenSatisfied = (token: string): boolean => {
    if (Object.prototype.hasOwnProperty.call(presence, token)) {
      return moduleSet.has(presence[token]);
    }
    return isYes(out[token]);
  };

  const maxIterations = Math.max(8, (graph.hard_requires?.length || 0) * 4);
  for (let i = 0; i < maxIterations; i += 1) {
    let changed = false;

    for (const edge of graph.hard_requires || []) {
      const downstreamYes = isYes(out[edge.downstream]);
      const upstreamYes = isYes(out[edge.upstream]);
      const upstreamExplicitNo = isExplicitNo(out[edge.upstream]);

      if (downstreamYes && upstreamExplicitNo) {
        const was = out[edge.downstream];
        out[edge.downstream] = 'no';
        coerced.push({
          key: edge.downstream,
          was: (was === undefined ? null : (was as string | string[] | null)),
          now: 'no',
          direction: 'cascade_off',
          driver: edge.upstream,
          reason_key: edge.reason_key,
        });
        changed = true;
        continue;
      }

      if (downstreamYes && !upstreamYes && !upstreamExplicitNo) {
        const was = out[edge.upstream];
        out[edge.upstream] = 'yes';
        coerced.push({
          key: edge.upstream,
          was: (was === undefined ? null : (was as string | string[] | null)),
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

  for (const link of graph.link_toggles || []) {
    const bothOn = (link.requires_both || []).every(tokenSatisfied);
    if (!bothOn) continue;
    const current = out[link.key];
    const explicit = isYes(current) || isExplicitNo(current);
    if (explicit) continue;
    out[link.key] = link.default_on ? 'yes' : 'no';
  }

  return { answers: out, coerced };
}

// True if `key` is an upstream forced ON by some downstream that is currently yes.
// Used to render the "auto-enabled / locked" badge in DefaultQuestions.
export function isAutoEnabledByDownstream(
  graph: DependencyGraph | null | undefined,
  key: string,
  answers: AnswerMap,
): { driverKey: string; reasonKey: string } | null {
  if (!graph) return null;
  for (const edge of graph.hard_requires || []) {
    if (edge.upstream === key && isYes(answers[edge.downstream])) {
      return { driverKey: edge.downstream, reasonKey: edge.reason_key };
    }
  }
  return null;
}

export function feedsHintsFor(
  graph: DependencyGraph | null | undefined,
  key: string,
  answers: AnswerMap,
): Array<{ to: string; default_en?: string; default_tr?: string; hint_key: string }> {
  if (!graph) return [];
  const hints: Array<{ to: string; default_en?: string; default_tr?: string; hint_key: string }> = [];
  for (const edge of graph.feeds_hints || []) {
    // Show the hint on the source question when it is yes AND the target
    // is not yet yes — that is, "you turned on X, here's something you might
    // want to turn on too".
    if (edge.from !== key) continue;
    if (!isYes(answers[edge.from])) continue;
    if (isYes(answers[edge.to])) continue;
    hints.push({
      to: edge.to,
      default_en: edge.default_en,
      default_tr: edge.default_tr,
      hint_key: edge.hint_key,
    });
  }
  return hints;
}
