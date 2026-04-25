/**
 * Global Jest setup.
 *
 * - Forces a deterministic JWT secret so token generation is stable across
 *   test runs and machines.
 * - Silences low-level console noise from the backend logger without
 *   swallowing assertions or failures.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.NODE_ENV = 'test';

const noop = () => {};
if (!process.env.JEST_SHOW_LOGS) {
  // Direct assignment (not jest.spyOn) so `restoreMocks: true` in
  // jest.config.js cannot restore the noisy backend logger between tests.
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
}

function preview(value) {
  try {
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return JSON.stringify(value);
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

global.tcLog = (tcId, { input, expected, got, note }) => {
  const parts = [`[${tcId}]`];
  if (input !== undefined) parts.push(`input=${preview(input)}`);
  if (expected !== undefined) parts.push(`expected=${preview(expected)}`);
  if (got !== undefined) parts.push(`got=${preview(got)}`);
  if (note) parts.push(`note=${note}`);
  process.stdout.write(parts.join(' | ') + '\n');
};
