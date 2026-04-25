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
  jest.spyOn(console, 'log').mockImplementation(noop);
  jest.spyOn(console, 'info').mockImplementation(noop);
  jest.spyOn(console, 'warn').mockImplementation(noop);
  jest.spyOn(console, 'error').mockImplementation(noop);
  jest.spyOn(console, 'debug').mockImplementation(noop);
}
