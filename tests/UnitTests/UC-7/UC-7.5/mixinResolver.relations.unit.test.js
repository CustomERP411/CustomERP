/**
 * UC-7.5 / Plan B follow-up #2 — mixinResolver auto-attach test for the
 * RelationRuleRunnerMixin.
 *
 * SUT: platform/assembler/generators/backend/mixinResolver.js
 *
 * Coverage:
 *   1. Entity with non-empty relations[] -> RelationRuleRunnerMixin auto-added,
 *      config carries `relations`, `moduleToggles`, `workDays`.
 *   2. Entity with no relations -> no RelationRuleRunnerMixin attached.
 *   3. Entity whose only relations are `permission_scope` -> no runner (those
 *      are consumed by RBAC, not the runner).
 *   4. _collectModuleToggles flattens nested module booleans + `enabled` keys.
 */

const path = require('path');
const mixinResolver = require(
  '../../../../platform/assembler/generators/backend/mixinResolver'
);
const MixinRegistry = require(
  '../../../../platform/assembler/MixinRegistry'
);

function buildContextForEntity(entity, modules = {}) {
  // Produce an object that exposes everything mixinResolver._resolveMixins
  // depends on via `this` — the bare minimum to exercise the new auto-attach
  // path without engaging the full BackendGenerator surface area.
  const brickLibraryPath = path.resolve(__dirname, '../../../../brick-library');
  const ctx = {
    modules,
    mixinRegistry: new MixinRegistry({ brickLibraryPath }),
    _getModuleKey: () => 'shared',
    _getInventoryPriorityAConfig: () => ({}),
    _buildInventoryTransactionMixinConfig: () => ({}),
    _buildInventoryReservationMixinConfig: () => ({}),
    _buildInventoryInboundMixinConfig: () => ({}),
    _buildInventoryCycleMixinConfig: () => ({}),
    _isPackEnabled: () => false,
    _getInvoicePriorityAConfig: () => ({}),
    _buildInvoiceTransactionMixinConfig: () => ({}),
    _buildInvoicePaymentMixinConfig: () => ({}),
    _buildInvoiceNoteMixinConfig: () => ({}),
    _buildInvoiceCalculationMixinConfig: () => ({}),
    _buildInvoiceLifecycleMixinConfig: () => ({ statuses: [], status_field: 'status' }),
    _getHRPriorityAConfig: () => ({}),
    _buildHREmployeeStatusMixinConfig: () => ({}),
    _buildHRLeaveBalanceMixinConfig: () => ({}),
    _buildHRLeaveApprovalMixinConfig: () => ({}),
    _buildHRAttendanceTimesheetMixinConfig: () => ({}),
    _buildHRCompensationLedgerMixinConfig: () => ({}),
  };
  Object.assign(ctx, mixinResolver);
  void entity;
  return ctx;
}

describe('mixinResolver — RelationRuleRunnerMixin auto-attach', () => {
  test('1. entity with relations[] -> runner attached with full config', async () => {
    const entity = {
      slug: 'leaves',
      module: 'shared',
      fields: [{ name: 'employee_id' }, { name: 'start_date' }, { name: 'end_date' }],
      features: {},
      relations: [
        {
          kind: 'invariant',
          rule: 'no_overlap_with(entity=leaves, group_by=employee_id)',
        },
        {
          kind: 'derived_field',
          computed_field: 'leave_days',
          formula: 'working_days(start_date, end_date)',
        },
      ],
    };
    const ctx = buildContextForEntity(entity, {
      hr: { enabled: true, work_days: [1, 2, 3, 4, 5] },
    });

    const ordered = await ctx._resolveMixins(entity, [entity]);
    const runner = ordered.find((m) => m.name === 'RelationRuleRunnerMixin');
    expect(runner).toBeTruthy();
    expect(Array.isArray(runner.config.relations)).toBe(true);
    expect(runner.config.relations).toHaveLength(2);
    expect(runner.config.workDays).toEqual([1, 2, 3, 4, 5]);
    expect(runner.config.moduleToggles).toBeDefined();
    expect(runner.config.moduleToggles['modules.hr.enabled']).toBe(true);

    // The runner should sort LAST in baseOrder so its hooks run after every
    // module-specific mixin's hooks.
    expect(ordered[ordered.length - 1].name).toBe('RelationRuleRunnerMixin');
  });

  test('2. entity without relations[] -> runner not attached', async () => {
    const entity = {
      slug: 'leaves',
      module: 'shared',
      fields: [{ name: 'employee_id' }],
      features: {},
    };
    const ctx = buildContextForEntity(entity);

    const ordered = await ctx._resolveMixins(entity, [entity]);
    expect(ordered.find((m) => m.name === 'RelationRuleRunnerMixin')).toBeUndefined();
  });

  test('3. entity with only permission_scope relations -> runner not attached', async () => {
    const entity = {
      slug: 'leaves',
      module: 'shared',
      fields: [{ name: 'employee_id' }],
      features: {},
      relations: [
        {
          kind: 'permission_scope',
          permission: 'hr.leaves.approve',
          scope: 'manager_chain',
        },
      ],
    };
    const ctx = buildContextForEntity(entity);
    const ordered = await ctx._resolveMixins(entity, [entity]);
    expect(ordered.find((m) => m.name === 'RelationRuleRunnerMixin')).toBeUndefined();
  });

  test('4. _collectModuleToggles flattens nested booleans + enabled flags', () => {
    const ctx = buildContextForEntity({}, {
      invoice: {
        enabled: true,
        stock_link: { enabled: true, mode: 'committed' },
      },
      hr: { enabled: false, leave_engine: { enabled: true } },
      access_control: { enabled: true },
    });
    const toggles = ctx._collectModuleToggles();
    expect(toggles['modules.invoice.enabled']).toBe(true);
    expect(toggles['modules.invoice.stock_link.enabled']).toBe(true);
    expect(toggles['modules.hr.enabled']).toBe(false);
    expect(toggles['modules.hr.leave_engine.enabled']).toBe(true);
    expect(toggles['modules.access_control.enabled']).toBe(true);
  });
});
