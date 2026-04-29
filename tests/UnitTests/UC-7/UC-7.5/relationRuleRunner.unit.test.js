/**
 * UC-7.5 / Plan B follow-up #2 — RelationRuleRunnerMixin runtime tests.
 *
 * SUT: brick-library/backend-bricks/mixins/RelationRuleRunnerMixin.js
 *      brick-library/backend-bricks/mixins/relationRuleLibrary.js
 *
 * The runner is a factory mixin that contributes class methods + lifecycle
 * hooks. We exercise it by:
 *   1. Building a real class from `mixin.methods` (mirrors what the
 *      assembler does at codegen time).
 *   2. Instantiating with a stub `repository` + a `mixinConfig` that mimics
 *      the assembler-built configuration.
 *   3. Calling the orchestrator methods directly.
 *
 * Coverage:
 *   1. _relWhenActive returns true on toggle hit, false otherwise
 *   2. derived_field formula populates data[computed_field]
 *   3. invariant blocks the operation by throwing (no_overlap_with)
 *   4. status_propagation matching trigger calls action
 *   5. status_propagation reverse trigger calls reverse action
 *   6. Unknown invariant name -> warn + skip (no throw)
 *   7. Unknown formula name  -> warn + skip
 *   8. Unknown action name   -> warn + skip in after-hook
 *   9. permission_scope relations are ignored by the runner
 *   10. Empty entity.relations[] -> orchestrator no-ops cleanly
 */

const RelationRuleRunnerMixinFactory = require(
  '../../../../brick-library/backend-bricks/mixins/RelationRuleRunnerMixin'
);

function buildRunnerClass() {
  const mixin = RelationRuleRunnerMixinFactory({});
  const code = `class RelationRuleService {
    constructor(repo, mixinConfig) {
      this.repository = repo;
      this.mixinConfig = mixinConfig || {};
      this.slug = 'leaves';
      this._relPrevState = null;
    }
    ${mixin.methods}
  }
  return RelationRuleService;`;
  // eslint-disable-next-line no-new-func
  return new Function(code)();
}

function buildRepoStub(seed = {}) {
  const data = JSON.parse(JSON.stringify(seed));
  return {
    findAll: jest.fn(async (slug, filter = {}) => {
      const rows = data[slug] || [];
      return rows.filter((row) => {
        for (const [k, v] of Object.entries(filter)) {
          if (String(row[k]) !== String(v)) return false;
        }
        return true;
      });
    }),
    findById: jest.fn(async (slug, id) => {
      const rows = data[slug] || [];
      return rows.find((r) => String(r.id) === String(id)) || null;
    }),
    create: jest.fn(async (slug, row) => {
      data[slug] = data[slug] || [];
      const created = { id: data[slug].length + 1, ...row };
      data[slug].push(created);
      return created;
    }),
    delete: jest.fn(async (slug, id) => {
      data[slug] = (data[slug] || []).filter((r) => String(r.id) !== String(id));
      return true;
    }),
    _data: data,
  };
}

let RunnerClass;
beforeAll(() => {
  RunnerClass = buildRunnerClass();
});

let warnSpy;
let errorSpy;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('RelationRuleRunnerMixin', () => {
  test('1. _relWhenActive consults moduleToggles map', () => {
    const svc = new RunnerClass(buildRepoStub(), {
      RelationRuleRunnerMixin: {
        relations: [],
        moduleToggles: { 'modules.invoice.stock_link.enabled': true, 'modules.hr.enabled': false },
      },
    });
    expect(svc._relWhenActive('modules.invoice.stock_link.enabled')).toBe(true);
    expect(svc._relWhenActive('modules.hr.enabled')).toBe(false);
    expect(svc._relWhenActive('modules.unknown')).toBe(false);
    expect(svc._relWhenActive(null)).toBe(true);
    expect(svc._relWhenActive('')).toBe(true);
  });

  test('2. derived_field formula populates data[computed_field]', async () => {
    const relation = {
      kind: 'derived_field',
      computed_field: 'leave_days',
      formula: 'working_days(start_date, end_date)',
    };
    const svc = new RunnerClass(buildRepoStub(), {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {}, workDays: [1, 2, 3, 4, 5] },
    });
    const data = { start_date: '2026-04-13', end_date: '2026-04-17' };
    await svc._relRunBeforePersist('create', data, {}, null);
    expect(data.leave_days).toBe(5);
  });

  test('3. invariant no_overlap_with blocks when an overlapping row exists', async () => {
    const relation = {
      kind: 'invariant',
      rule: 'no_overlap_with(entity=leaves, group_by=employee_id, status_in=[Pending, Approved])',
    };
    const repo = buildRepoStub({
      leaves: [
        { id: 1, employee_id: 'EMP1', status: 'Approved', start_date: '2026-04-10', end_date: '2026-04-20' },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    const data = { employee_id: 'EMP1', status: 'Pending', start_date: '2026-04-15', end_date: '2026-04-18' };
    await expect(svc._relRunBeforePersist('create', data, {}, null)).rejects.toThrow(/Overlap detected/);
  });

  test('3b. invariant no_overlap_with passes when no overlap', async () => {
    const relation = {
      kind: 'invariant',
      rule: 'no_overlap_with(entity=leaves, group_by=employee_id, status_in=[Pending, Approved])',
    };
    const repo = buildRepoStub({
      leaves: [
        { id: 1, employee_id: 'EMP1', status: 'Approved', start_date: '2026-04-01', end_date: '2026-04-05' },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    const data = { employee_id: 'EMP1', status: 'Pending', start_date: '2026-04-15', end_date: '2026-04-18' };
    await expect(svc._relRunBeforePersist('create', data, {}, null)).resolves.toBeUndefined();
  });

  test('4. status_propagation forward trigger fires action on matching transition', async () => {
    const relation = {
      kind: 'status_propagation',
      on: { field: 'status', from: 'Pending', to: 'Approved' },
      effect: {
        action: 'create_per_work_day',
        target_entity: 'attendance_entries',
        owner_field: 'employee_id',
        origin_field: 'origin_ref',
      },
    };
    const repo = buildRepoStub();
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {}, workDays: [1, 2, 3, 4, 5] },
    });
    const data = { status: 'Approved' };
    const result = { id: 42, employee_id: 'EMP1', status: 'Approved', start_date: '2026-04-13', end_date: '2026-04-15' };
    const prevState = { id: 42, status: 'Pending' };
    await svc._relRunAfterPersist('update', data, result, prevState);
    expect(repo.create).toHaveBeenCalled();
    const created = repo._data.attendance_entries || [];
    expect(created.length).toBeGreaterThan(0);
    expect(created[0].origin_ref).toBe('leaves:42');
    expect(created[0].employee_id).toBe('EMP1');
  });

  test('5. status_propagation reverse trigger fires reverse action', async () => {
    const relation = {
      kind: 'status_propagation',
      on: { field: 'status', from: 'Pending', to: 'Approved' },
      effect: {
        action: 'create_per_work_day',
        target_entity: 'attendance_entries',
        origin_field: 'origin_ref',
      },
      reverse: {
        on: { field: 'status', from: 'Approved', to: 'Cancelled' },
        action: 'remove_emitted_rows',
      },
    };
    const repo = buildRepoStub({
      attendance_entries: [
        { id: 7, origin_ref: 'leaves:42', work_date: '2026-04-13' },
        { id: 8, origin_ref: 'leaves:42', work_date: '2026-04-14' },
        { id: 9, origin_ref: 'leaves:99', work_date: '2026-04-13' },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    const data = { status: 'Cancelled' };
    const result = { id: 42, status: 'Cancelled' };
    const prevState = { id: 42, status: 'Approved' };
    await svc._relRunAfterPersist('update', data, result, prevState);
    expect(repo.delete).toHaveBeenCalledWith('attendance_entries', 7);
    expect(repo.delete).toHaveBeenCalledWith('attendance_entries', 8);
    expect(repo.delete).not.toHaveBeenCalledWith('attendance_entries', 9);
  });

  test('6. Unknown invariant name -> warn + skip', async () => {
    const relation = { kind: 'invariant', rule: 'never_heard_of_it(foo)' };
    const svc = new RunnerClass(buildRepoStub(), {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    await expect(svc._relRunBeforePersist('create', {}, {}, null)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown invariant'));
  });

  test('7. Unknown formula name -> warn + skip', async () => {
    const relation = {
      kind: 'derived_field',
      computed_field: 'whatever',
      formula: 'mystery_formula(a, b)',
    };
    const svc = new RunnerClass(buildRepoStub(), {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    await expect(svc._relRunBeforePersist('create', {}, {}, null)).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown formula'));
  });

  test('8. Unknown forward action name -> warn + skip', async () => {
    const relation = {
      kind: 'status_propagation',
      on: { field: 'status', from: 'A', to: 'B' },
      effect: { action: 'phantom_action', target_entity: 'whatever' },
    };
    const svc = new RunnerClass(buildRepoStub(), {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    await svc._relRunAfterPersist(
      'update',
      { status: 'B' },
      { id: 1, status: 'B' },
      { id: 1, status: 'A' }
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown forward action'));
  });

  test('9. permission_scope relations are ignored by the runner', async () => {
    const relation = {
      kind: 'permission_scope',
      permission: 'hr.leaves.approve',
      scope: 'manager_chain',
    };
    const repo = buildRepoStub();
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: { relations: [relation], moduleToggles: {} },
    });
    await svc._relRunBeforePersist('create', {}, {}, null);
    await svc._relRunAfterPersist('create', {}, { id: 1 }, null);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  test('10. Empty entity.relations[] is a clean no-op', async () => {
    const repo = buildRepoStub();
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: { relations: [], moduleToggles: {} },
    });
    await svc._relRunBeforePersist('create', { foo: 1 }, {}, null);
    await svc._relRunAfterPersist('create', { foo: 1 }, { id: 1, foo: 1 }, null);
    expect(repo.create).not.toHaveBeenCalled();
  });

  test('when-clause gates a rule off when toggle is false', async () => {
    const relation = {
      kind: 'invariant',
      rule: 'no_overlap_with(entity=leaves, group_by=employee_id)',
      when: 'modules.hr.leave_engine.enabled',
    };
    const repo = buildRepoStub({
      leaves: [
        { id: 1, employee_id: 'EMP1', start_date: '2026-04-10', end_date: '2026-04-20' },
      ],
    });
    const svc = new RunnerClass(repo, {
      RelationRuleRunnerMixin: {
        relations: [relation],
        moduleToggles: { 'modules.hr.leave_engine.enabled': false },
      },
    });
    const data = { employee_id: 'EMP1', start_date: '2026-04-15', end_date: '2026-04-18' };
    await expect(svc._relRunBeforePersist('create', data, {}, null)).resolves.toBeUndefined();
  });

  test('mixin factory exports hooks for all five lifecycle slots', () => {
    const mixin = RelationRuleRunnerMixinFactory({});
    expect(mixin.hooks.BEFORE_CREATE_VALIDATION).toContain('_relRunBeforePersist');
    expect(mixin.hooks.BEFORE_UPDATE_VALIDATION).toContain('_relRunBeforePersist');
    expect(mixin.hooks.AFTER_CREATE_LOGGING).toContain('_relRunAfterPersist');
    expect(mixin.hooks.AFTER_UPDATE_LOGGING).toContain('_relRunAfterPersist');
    expect(mixin.hooks.BEFORE_DELETE_VALIDATION).toContain('_relPrevState');
  });
});
