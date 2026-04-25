/**
 * Jest configuration for CustomERP unit tests.
 *
 * Tests live under tests/UnitTests/<UseCase>/ and import the production
 * source directly from platform/backend/src/. The SUT is imported with
 * relative paths resolved from this config's rootDir.
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.unit.test.js'],
  // Silence noisy logger output from the SUT during tests.
  setupFiles: ['<rootDir>/jest.setup.js'],
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
  // Pin 3rd-party packages that the SUT and test both depend on to a
  // SINGLE resolved path so `jest.mock('bcryptjs')` and friends
  // intercept every `require('bcryptjs')` regardless of whether it
  // originates in the test file or in platform/backend/src/**.
  // We point them at the backend's installed copy (authoritative).
  // `uuid` is additionally redirected to a CJS stub because the
  // backend ships an ESM-only version that breaks Jest's loader.
  moduleNameMapper: {
    '^uuid$': '<rootDir>/__mocks__/uuid.js',
    '^bcryptjs$': '<rootDir>/../../platform/backend/node_modules/bcryptjs',
    '^jsonwebtoken$': '<rootDir>/../../platform/backend/node_modules/jsonwebtoken',
    '^pg$': '<rootDir>/../../platform/backend/node_modules/pg',
    // archiver is a heavy native-ish dependency that we don't need the
    // real implementation of in unit tests. A tiny stub keeps
    // streamZipFromDir testable without producing a real zip.
    '^archiver$': '<rootDir>/__mocks__/archiver.js',
  },
};
