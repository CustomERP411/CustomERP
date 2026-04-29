/**
 * UC-7.5 / Plan B follow-up #6 — computed-field strict-vs-lenient mode tests.
 *
 * SUT: platform/assembler/generators/backend/validationCodegen.js
 *
 * 3 cases:
 *   1. Default ('lenient') generates a silent strip (delete data[field])
 *   2. 'strict' mode generates a 400 throw with field_errors
 *   3. No computed fields -> snippet is empty regardless of mode
 */

const path = require('path');
const codegen = require(path.resolve(
  __dirname,
  '../../../../platform/assembler/generators/backend/validationCodegen.js'
));

function makeEntity({ computed_mode } = {}) {
  return {
    slug: 'invoices',
    computed_mode,
    fields: [
      { name: 'id', type: 'uuid' },
      { name: 'subtotal', type: 'number', computed: true },
      { name: 'tax_total', type: 'number', computed: true },
      { name: 'note', type: 'string' },
    ],
  };
}

describe('computed strict-vs-lenient mode (UC-7.5)', () => {
  test('lenient (default) produces a silent strip snippet', () => {
    const snippet = codegen._buildComputedStripSnippet(makeEntity());
    expect(snippet).toContain('delete data[__cf]');
    expect(snippet).not.toContain('throw __err');
    expect(snippet).toContain('"subtotal"');
    expect(snippet).toContain('"tax_total"');
  });

  test('strict mode produces a 400-with-fieldErrors throw', () => {
    const snippet = codegen._buildComputedStripSnippet(makeEntity({ computed_mode: 'strict' }));
    expect(snippet).toContain('throw __err');
    expect(snippet).toContain('statusCode = 400');
    expect(snippet).toContain('computed_readonly');
    expect(snippet).toContain('"subtotal"');
  });

  test('no computed fields -> empty snippet regardless of mode', () => {
    const entity = {
      slug: 'departments',
      fields: [{ name: 'id', type: 'uuid' }, { name: 'name', type: 'string' }],
    };
    expect(codegen._buildComputedStripSnippet(entity)).toBe('');
    expect(codegen._buildComputedStripSnippet({ ...entity, computed_mode: 'strict' })).toBe('');
  });
});
