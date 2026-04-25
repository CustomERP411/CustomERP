/**
 * Manual mock for the `uuid` package.
 *
 * The real `uuid` shipped with the backend is ESM-only and blows up
 * Jest's CommonJS loader. Unit tests don't care about real UUID
 * generation — they only need `v4()` to return a string — so we stub
 * it here. Wired in via `moduleNameMapper` in jest.config.js so the
 * redirect applies no matter where the SUT lives on disk.
 */
let counter = 0;
module.exports = {
  v4: () => `test-uuid-${++counter}`,
};
