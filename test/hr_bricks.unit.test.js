// Basic unit-style tests for HR-related backend bricks.
// Run with: node test/hr_bricks.unit.test.js

/* eslint-disable no-console */

const assert = require('assert');

const HREmployeeMixin = require('../brick-library/backend-bricks/mixins/HREmployeeMixin');
const HRDepartmentMixin = require('../brick-library/backend-bricks/mixins/HRDepartmentMixin');
const HRLeaveMixin = require('../brick-library/backend-bricks/mixins/HRLeaveMixin');

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

runTest('HREmployeeMixin exposes normalization and validation hooks', () => {
  const mixin = typeof HREmployeeMixin === 'function' ? HREmployeeMixin({}) : HREmployeeMixin;
  assert.ok(mixin);
  assert.ok(Array.isArray(mixin.dependencies));
  assert.ok(mixin.hooks.BEFORE_CREATE_TRANSFORMATION);
  assert.ok(mixin.hooks.BEFORE_UPDATE_VALIDATION);

  const createHook = mixin.hooks.BEFORE_CREATE_TRANSFORMATION;
  const updateHook = mixin.hooks.BEFORE_UPDATE_VALIDATION;

  assert.ok(
    createHook.includes('email') && updateHook.includes('Email cannot be empty'),
    'Employee mixin should normalize and validate email'
  );

  assert.ok(typeof mixin.methods === 'string', 'Employee mixin should expose companion methods');
  assert.ok(
    mixin.methods.includes('createWithCompanionUser') && mixin.methods.includes('linkUser'),
    'Employee mixin should expose createWithCompanionUser and linkUser methods'
  );
});

runTest('HRDepartmentMixin normalizes name and location', () => {
  const mixin = HRDepartmentMixin;
  assert.ok(mixin);
  assert.ok(mixin.hooks.BEFORE_CREATE_TRANSFORMATION);
  assert.ok(mixin.hooks.BEFORE_UPDATE_VALIDATION);

  const createHook = mixin.hooks.BEFORE_CREATE_TRANSFORMATION;
  assert.ok(
    createHook.includes('data.name') && createHook.includes('data.location'),
    'Department mixin should touch name and location fields'
  );
});

runTest('HRLeaveMixin validates date ranges for leave records', () => {
  const mixin = HRLeaveMixin;
  assert.ok(mixin);
  assert.ok(mixin.hooks.BEFORE_CREATE_VALIDATION);
  assert.ok(mixin.hooks.BEFORE_UPDATE_VALIDATION);

  const createValidate = mixin.hooks.BEFORE_CREATE_VALIDATION;
  const updateValidate = mixin.hooks.BEFORE_UPDATE_VALIDATION;

  assert.ok(
    createValidate.includes('Leave end_date must be on or after start_date'),
    'Leave mixin should enforce non-negative date ranges on create'
  );
  assert.ok(
    updateValidate.includes('Leave end_date must be on or after start_date'),
    'Leave mixin should enforce non-negative date ranges on update'
  );
});

if (!process.exitCode) {
  console.log('All HR brick unit checks passed.');
}

