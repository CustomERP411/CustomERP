// Unit tests for circular required-reference relaxation in assembler.
// Run with: node test/assembler_required_reference_cycles.unit.test.js

/* eslint-disable no-console */

const assert = require('assert');
const path = require('path');
const ProjectAssembler = require('../platform/assembler/ProjectAssembler');

function createAssembler() {
  const brickRepoStub = { libraryPath: path.resolve(__dirname, '..', 'brick-library') };
  return new ProjectAssembler(brickRepoStub, path.resolve(__dirname, '..', 'generated'));
}

function testMutualEmployeeDepartmentCycle() {
  const assembler = createAssembler();
  const entities = [
    {
      slug: 'employees',
      fields: [
        { name: 'department_id', type: 'reference', reference_entity: 'departments', required: true },
      ],
    },
    {
      slug: 'departments',
      fields: [
        { name: 'manager_id', type: 'reference', reference_entity: 'employees', required: true },
      ],
    },
  ];

  assembler._relaxCircularRequiredReferences(entities);

  const employeeDepartment = entities[0].fields[0];
  const departmentManager = entities[1].fields[0];

  assert.strictEqual(
    departmentManager.required,
    false,
    'Expected departments.manager_id to be relaxed to optional in mutual cycle'
  );
  assert.strictEqual(
    employeeDepartment.required,
    true,
    'Expected employees.department_id to remain required when manager field is preferred for relaxation'
  );
}

function testRequiredSelfReference() {
  const assembler = createAssembler();
  const entities = [
    {
      slug: 'employees',
      fields: [
        { name: 'manager_id', type: 'reference', reference_entity: 'employees', required: true },
      ],
    },
  ];

  assembler._relaxCircularRequiredReferences(entities);

  assert.strictEqual(
    entities[0].fields[0].required,
    false,
    'Expected required self-reference to be relaxed to optional'
  );
}

function main() {
  testMutualEmployeeDepartmentCycle();
  testRequiredSelfReference();
  console.log('assembler_required_reference_cycles.unit.test.js passed');
}

if (require.main === module) {
  main();
}
