/**
 * UC-7.5 / Plan B follow-up #2 — relationRuleParser unit tests.
 *
 * SUT: brick-library/backend-bricks/mixins/relationRuleParser.js
 *
 * The parser turns 'name(arg1=val, arg2=[a,b])' into { name, args, positional }.
 * Tests cover:
 *   1. Bare positional args
 *   2. Mixed positional + keyword args
 *   3. List values with brackets
 *   4. Trailing whitespace tolerance
 *   5. Malformed input returns null
 *   6. Empty parens (no args)
 */

const { parseRelationRule, buildParserSource, PARSER_PROTO } = require(
  '../../../../brick-library/backend-bricks/mixins/relationRuleParser'
);

describe('relationRuleParser.parseRelationRule', () => {
  test('1. parses bare positional args', () => {
    const result = parseRelationRule('working_days(start_date, end_date)');
    expect(result).toEqual({
      name: 'working_days',
      args: {},
      positional: ['start_date', 'end_date'],
    });
  });

  test('2. parses mixed positional + keyword args', () => {
    const result = parseRelationRule(
      'qty_within_remaining(quantity, max_field=available_quantity)'
    );
    expect(result.name).toBe('qty_within_remaining');
    expect(result.positional).toEqual(['quantity']);
    expect(result.args).toEqual({ max_field: 'available_quantity' });
  });

  test('3. parses list values with brackets', () => {
    const result = parseRelationRule(
      'no_overlap_with(entity=leaves, group_by=employee_id, status_in=[Pending, Approved])'
    );
    expect(result.name).toBe('no_overlap_with');
    expect(result.args.entity).toBe('leaves');
    expect(result.args.group_by).toBe('employee_id');
    expect(result.args.status_in).toEqual(['Pending', 'Approved']);
  });

  test('4. tolerates leading/trailing whitespace and inner padding', () => {
    const result = parseRelationRule(
      '   sum_lines(  child_entity = invoice_items , parent_field=invoice_id ,sum_field= line_total )  '
    );
    expect(result.name).toBe('sum_lines');
    expect(result.args).toEqual({
      child_entity: 'invoice_items',
      parent_field: 'invoice_id',
      sum_field: 'line_total',
    });
    expect(result.positional).toEqual([]);
  });

  test('5. malformed input returns null', () => {
    expect(parseRelationRule('')).toBeNull();
    expect(parseRelationRule(null)).toBeNull();
    expect(parseRelationRule(undefined)).toBeNull();
    expect(parseRelationRule('not a function call')).toBeNull();
    expect(parseRelationRule('foo(bar')).toBeNull();
    expect(parseRelationRule('(noNameJustParens)')).toBeNull();
    // empty key
    expect(parseRelationRule('foo(=value)')).toBeNull();
  });

  test('6. empty parens parses with no args', () => {
    const result = parseRelationRule('snapshot_now()');
    expect(result).toEqual({ name: 'snapshot_now', args: {}, positional: [] });
  });

  test('PARSER_PROTO methods are class-method-shorthand serializable', () => {
    const src = buildParserSource();
    expect(src).toContain('_relParseRule(text)');
    expect(src).toContain('_relParse_splitTopLevelCommas(text)');
    expect(src).toContain('_relParse_findTopLevelEquals(text)');
    expect(src).toContain('_relParse_parseValue(text)');
    // Source must NOT start with 'function ' — it must be class-method shape.
    expect(src.startsWith('function ')).toBe(false);
    // Sanity-check: the source pastes cleanly inside a class body.
    const code = `class T { ${src} } return new T()._relParseRule('foo(a, b)');`;
    // eslint-disable-next-line no-new-func
    const result = new Function(code)();
    expect(result.name).toBe('foo');
    expect(result.positional).toEqual(['a', 'b']);
  });

  test('PARSER_PROTO is callable directly via .call(stub)', () => {
    const stub = {};
    Object.assign(stub, PARSER_PROTO);
    const out = stub._relParseRule('a(b)');
    expect(out).toEqual({ name: 'a', args: {}, positional: ['b'] });
  });
});
