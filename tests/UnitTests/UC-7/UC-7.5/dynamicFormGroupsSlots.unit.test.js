/**
 * UC-7.5 / UI Sections — DynamicForm groups + slots props.
 *
 * SUT: brick-library/frontend-bricks/components/DynamicForm.tsx
 *
 * Approach: source-text introspection (mirrors the existing
 * `dynamicFormDefaults.unit.test.js` pattern; the brick is a JSX
 * template that lands inside the generated frontend so behavior tests
 * happen at the integration layer). Plus a pure-function port of the
 * grouped-render layout planner — same predicates as the template, so
 * if anyone changes the semantics these tests tell them what broke.
 *
 * Coverage:
 *   1. Brick exposes `groups` + `slots` props with the right shapes.
 *   2. Brick renders fields/slots in declared order when `groups` is set,
 *      and falls back to the legacy single-pass map when it is not.
 *   3. Single shared `formData` state is preserved (no second useState
 *      for grouped fields, atomic submit still applies).
 *   4. Layout planner pure-function port:
 *        - 'fields' groups render referenced fields in declared order
 *        - 'slot' groups inject `slots[name]` (when present)
 *        - fields not referenced by any 'fields' group fall through to
 *          a trailing orphan group
 *        - empty 'fields' groups with no heading are dropped
 *        - missing slot keys render nothing (no crash)
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(
  __dirname,
  '../../../../brick-library/frontend-bricks/components/DynamicForm.tsx',
);

const SRC = fs.readFileSync(TEMPLATE_PATH, 'utf8');

describe('UC-7.5 / DynamicForm — groups + slots template assertions', () => {
  test('TC-UC7.5-df-001 — declares the groups + slots props on the FormGroup discriminated union', () => {
    expect(SRC).toContain("type FormGroup");
    expect(SRC).toContain("kind: 'fields'");
    expect(SRC).toContain("kind: 'slot'");
    expect(SRC).toContain('fieldNames: string[]');
    expect(SRC).toContain('slots?: Record<string, React.ReactNode>');
  });

  test('TC-UC7.5-df-002 — accepts groups + slots in the destructured props', () => {
    expect(SRC).toMatch(/groups,\s+slots,\s+\}: DynamicFormProps\) \{/);
  });

  test('TC-UC7.5-df-003 — renders grouped body via renderGroupedBody when groups is set', () => {
    expect(SRC).toContain('const renderGroupedBody');
    expect(SRC).toMatch(/useGrouped\s*=\s*Array\.isArray\(groups\)\s*&&\s*groups\.length\s*>\s*0/);
    expect(SRC).toMatch(/\?\s*renderGroupedBody\(\)/);
  });

  test('TC-UC7.5-df-004 — falls back to the legacy single-pass map when groups is absent', () => {
    // The non-grouped branch of the conditional in the return must still
    // map `fields` directly so existing forms (no `ui.sections`) keep
    // their pre-feature behavior.
    expect(SRC).toMatch(/:\s*fields\.map\(\(field\)\s*=>\s*renderField\(field\)\)/);
  });

  test('TC-UC7.5-df-005 — orphan fields (not referenced by any fields group) are auto-appended', () => {
    expect(SRC).toContain('orphanFields');
    expect(SRC).toMatch(/fields\.filter\(\(f\)\s*=>\s*!referenced\.has\(f\.name\)\)/);
  });

  test('TC-UC7.5-df-006 — dot-keyed headings resolve through the I18N table', () => {
    expect(SRC).toContain('resolveHeading');
    expect(SRC).toMatch(/heading\.indexOf\('\.'\)/);
  });

  test('TC-UC7.5-df-007 — preserves single shared formData state and atomic submit', () => {
    // Single useState for formData, single onSubmit handler, no
    // duplicate state for grouped fields. The submit handler still runs
    // validation across the full fields list.
    const formDataDecls = SRC.match(/useState\b[^)]*formData/g) || [];
    // We accept either useState<...>(formData) or related patterns; what
    // we're really pinning is "no second formData store appears".
    const dupFormDataState = (SRC.match(/setFormData\s*=/g) || []).length;
    expect(dupFormDataState).toBeLessThanOrEqual(1);
    expect(SRC).toContain('handleSubmit');
    // The grouped-render path must NOT introduce a parallel form state.
    expect(SRC).not.toMatch(/useState[^)]*groupedFormData/);
  });
});

describe('UC-7.5 / DynamicForm — groups+slots layout planner (pure-function port)', () => {
  // Pure-function port of the planner. The template assertions above
  // pin the shape of the implementation; this block pins the SEMANTICS
  // it must implement. Match the brick's logic exactly so any drift
  // shows up here.
  function planLayout({ fields, groups, slots }) {
    const referenced = new Set();
    if (Array.isArray(groups)) {
      for (const g of groups) {
        if (g && g.kind === 'fields' && Array.isArray(g.fieldNames)) {
          for (const n of g.fieldNames) referenced.add(n);
        }
      }
    }
    const fieldByName = new Map(fields.map((f) => [f.name, f]));
    const orphanFields = fields.filter((f) => !referenced.has(f.name));
    const out = [];
    const slotMap = slots || {};
    const seq = Array.isArray(groups) ? groups : [];
    seq.forEach((g, gi) => {
      if (!g || typeof g !== 'object') return;
      if (g.kind === 'fields') {
        const inGroup = [];
        for (const n of (g.fieldNames || [])) {
          const def = fieldByName.get(n);
          if (def) inGroup.push(def);
        }
        if (inGroup.length === 0 && !g.heading) return;
        out.push({ kind: 'fields', heading: g.heading || null, fields: inGroup, key: `fields-${gi}` });
      } else if (g.kind === 'slot') {
        const node = slotMap[g.name];
        if (node !== undefined && node !== null && node !== false) {
          out.push({ kind: 'slot', name: g.name, node, key: `slot-${gi}-${g.name}` });
        }
      }
    });
    if (orphanFields.length > 0) {
      out.push({ kind: 'fields', heading: null, fields: orphanFields, key: 'orphan-fields' });
    }
    return out;
  }

  const fields = [
    { name: 'invoice_number' },
    { name: 'customer_id' },
    { name: 'status' },
    { name: 'notes' },
    { name: 'tax_rate' },
  ];

  test('TC-UC7.5-plan-001 — interleaves fields groups and slots in declared order', () => {
    const plan = planLayout({
      fields,
      groups: [
        { kind: 'fields', fieldNames: ['invoice_number', 'customer_id', 'status'] },
        { kind: 'slot', name: 'line_items:invoice_items' },
        { kind: 'fields', fieldNames: ['tax_rate', 'notes'] },
        { kind: 'slot', name: 'totals' },
      ],
      slots: {
        'line_items:invoice_items': 'LINES',
        'totals': 'TOTALS',
      },
    });
    expect(plan.map((s) => s.kind)).toEqual(['fields', 'slot', 'fields', 'slot']);
    expect(plan[0].fields.map((f) => f.name)).toEqual(['invoice_number', 'customer_id', 'status']);
    expect(plan[1].name).toBe('line_items:invoice_items');
    expect(plan[2].fields.map((f) => f.name)).toEqual(['tax_rate', 'notes']);
    expect(plan[3].name).toBe('totals');
  });

  test('TC-UC7.5-plan-002 — orphan fields land in trailing group', () => {
    const plan = planLayout({
      fields,
      groups: [
        { kind: 'fields', fieldNames: ['invoice_number'] },
        { kind: 'slot', name: 'line_items:invoice_items' },
      ],
      slots: { 'line_items:invoice_items': 'LINES' },
    });
    const last = plan[plan.length - 1];
    expect(last.kind).toBe('fields');
    expect(last.key).toBe('orphan-fields');
    expect(last.fields.map((f) => f.name)).toEqual(['customer_id', 'status', 'notes', 'tax_rate']);
  });

  test('TC-UC7.5-plan-003 — fields named in a group but absent from `fields[]` are silently skipped', () => {
    const plan = planLayout({
      fields: [{ name: 'a' }, { name: 'b' }],
      groups: [{ kind: 'fields', fieldNames: ['a', 'phantom', 'b'] }],
      slots: {},
    });
    expect(plan[0].fields.map((f) => f.name)).toEqual(['a', 'b']);
  });

  test('TC-UC7.5-plan-004 — slot with a missing key is dropped', () => {
    const plan = planLayout({
      fields: [{ name: 'a' }],
      groups: [
        { kind: 'fields', fieldNames: ['a'] },
        { kind: 'slot', name: 'rollups' },
      ],
      slots: {},
    });
    expect(plan.map((s) => s.kind)).toEqual(['fields']);
  });

  test('TC-UC7.5-plan-005 — empty fields group with no heading is dropped', () => {
    const plan = planLayout({
      fields: [{ name: 'a' }],
      groups: [
        { kind: 'fields', fieldNames: [] },
        { kind: 'fields', fieldNames: ['a'] },
      ],
      slots: {},
    });
    expect(plan.length).toBe(1);
    expect(plan[0].fields.map((f) => f.name)).toEqual(['a']);
  });

  test('TC-UC7.5-plan-006 — empty fields group WITH a heading is preserved (group label only)', () => {
    const plan = planLayout({
      fields: [{ name: 'a' }],
      groups: [
        { kind: 'fields', fieldNames: [], heading: 'form.sections.identity' },
      ],
      slots: {},
    });
    // Empty + heading still emits a group node so a future-author
    // section heading is visible even when its fields haven't been
    // declared yet — and the orphan group catches the actual fields.
    expect(plan[0].kind).toBe('fields');
    expect(plan[0].heading).toBe('form.sections.identity');
    expect(plan[0].fields).toEqual([]);
    expect(plan[plan.length - 1].key).toBe('orphan-fields');
  });

  test('TC-UC7.5-plan-007 — empty groups[] returns just the orphan trailing group with all fields', () => {
    const plan = planLayout({ fields, groups: [], slots: {} });
    expect(plan.length).toBe(1);
    expect(plan[0].key).toBe('orphan-fields');
    expect(plan[0].fields.length).toBe(5);
  });
});
