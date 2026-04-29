/**
 * UC-7.5 / Plan C — dependencyMirror.ts vs dependencyGraph.js parity test.
 *
 * The frontend mirrors the backend's coercion logic so the wizard reflects
 * the same rules instantly. To keep the two in lockstep, this test feeds the
 * SAME scenarios into both implementations and asserts identical output.
 *
 * The TS file is transpiled on-the-fly with esbuild (already installed for
 * the frontend) so we don't need to ship a build step for tests.
 */

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const ESBUILD = require(path.join(REPO_ROOT, 'platform/frontend/node_modules/esbuild'));

const dependencyGraph = require(path.join(
  REPO_ROOT,
  'platform/backend/src/defaultQuestions/dependencyGraph.js',
));

function loadMirror() {
  const tsSource = fs.readFileSync(
    path.join(REPO_ROOT, 'platform/frontend/src/components/project/dependencyMirror.ts'),
    'utf8',
  );
  // Drop the top-level `import type` line so we don't have to resolve the
  // sibling types module — the implementation is purely structural.
  const stripped = tsSource.replace(/^import type[\s\S]*?from\s+'[^']*';\s*$/m, '');
  const out = ESBUILD.transformSync(stripped, { loader: 'ts', format: 'cjs' });
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', out.code)(mod, mod.exports);
  return mod.exports;
}

const mirror = loadMirror();

function runScenarios() {
  const graph = dependencyGraph.serializeForApi();
  const scenarios = [
    { name: 'no answers, only invoice', answers: {}, modules: ['invoice'] },
    { name: 'no answers, both modules', answers: {}, modules: ['invoice', 'inventory'] },
    {
      name: 'forward auto-enable: leave_approvals on',
      answers: { hr_enable_leave_approvals: 'yes' },
      modules: ['hr'],
    },
    {
      name: 'cascade-off: explicit no on engine, yes on approvals',
      answers: { hr_enable_leave_engine: 'no', hr_enable_leave_approvals: 'yes' },
      modules: ['hr'],
    },
    {
      name: 'link-toggle defaults: both ends on, no explicit answer',
      answers: { hr_enable_leave_engine: 'yes', hr_enable_attendance_time: 'yes' },
      modules: ['hr'],
    },
    {
      name: 'explicit user link no beats default seed',
      answers: {
        hr_enable_leave_engine: 'yes',
        hr_enable_attendance_time: 'yes',
        hr_leave_attendance_link: 'no',
      },
      modules: ['hr'],
    },
    {
      name: 'invoice_stock_link defaulted only when both modules present',
      answers: {},
      modules: ['invoice', 'inventory'],
    },
    {
      name: 'invoice_ap_link: both ends on',
      answers: { invoice_enable_payments: 'yes', inv_enable_inbound: 'yes' },
      modules: ['invoice', 'inventory'],
    },
  ];
  return { graph, scenarios };
}

describe('Plan C — dependencyMirror.ts parity with dependencyGraph.js', () => {
  test('identical output across all scenarios', () => {
    const { graph, scenarios } = runScenarios();
    for (const s of scenarios) {
      const js = dependencyGraph.applyDependencyCoercion(s.answers, s.modules);
      const ts = mirror.applyDependencyCoercion(graph, s.answers, s.modules);
      // Compare answers maps
      expect({ scenario: s.name, answers: ts.answers }).toEqual({
        scenario: s.name,
        answers: js.answers,
      });
      // Compare coerced rows by (key, direction, driver, reason_key) — order
      // and other fields like `was` should also match between mirror and source.
      const projectKeys = (rows) =>
        rows.map((r) => ({
          key: r.key,
          direction: r.direction,
          driver: r.driver,
          reason_key: r.reason_key,
          now: r.now,
        }));
      expect({ scenario: s.name, coerced: projectKeys(ts.coerced) }).toEqual({
        scenario: s.name,
        coerced: projectKeys(js.coerced),
      });
    }
  });

  test('isAutoEnabledByDownstream reports the same upstream lock as the JS', () => {
    const { graph } = runScenarios();
    const answers = { hr_enable_leave_approvals: 'yes' };
    const hit = mirror.isAutoEnabledByDownstream(graph, 'hr_enable_leave_engine', answers);
    expect(hit).toBeTruthy();
    expect(hit.driverKey).toBe('hr_enable_leave_approvals');
    // No lock when downstream is not yes.
    expect(mirror.isAutoEnabledByDownstream(graph, 'hr_enable_leave_engine', {})).toBeNull();
  });
});
