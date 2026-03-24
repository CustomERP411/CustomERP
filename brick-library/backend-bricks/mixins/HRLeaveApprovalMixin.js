module.exports = (config = {}) => {
  const defaults = {
    leave_entity: 'leaves',
    status_field: 'status',
    approver_field: 'approver_id',
    approved_at_field: 'approved_at',
    rejected_at_field: 'rejected_at',
    cancelled_at_field: 'cancelled_at',
    rejection_reason_field: 'rejection_reason',
    decision_key_field: 'decision_key',
    statuses: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    enforce_transitions: true,
    consume_on_approval: true,
    transitions: {
      Pending: ['Approved', 'Rejected', 'Cancelled'],
      Approved: ['Cancelled'],
      Rejected: [],
      Cancelled: [],
    },
    employee_field: 'employee_id',
    leave_type_field: 'leave_type',
    days_field: 'leave_days',
    start_date_field: 'start_date',
    end_date_field: 'end_date',
    balance_entity: 'leave_balances',
    fiscal_year_field: 'year',
    entitlement_field: 'annual_entitlement',
    accrued_field: 'accrued_days',
    consumed_field: 'consumed_days',
    carry_forward_field: 'carry_forward_days',
    available_field: 'available_days',
    default_entitlement: 18,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: ['HRLeaveBalanceMixin'],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const __cfg = this._hrLeaveApprovalCfg();
      if (this.slug === __cfg.leave_entity && data) {
        if (data[__cfg.status_field] === undefined || data[__cfg.status_field] === null || data[__cfg.status_field] === '') {
          data[__cfg.status_field] = 'Pending';
        }
      }
    `,
      BEFORE_UPDATE_VALIDATION: `
      const __cfg = this._hrLeaveApprovalCfg();
      if (this.slug === __cfg.leave_entity && data && Object.prototype.hasOwnProperty.call(data, __cfg.status_field)) {
        const __nextStatus = String(data[__cfg.status_field] || '');
        if (!__cfg.statuses.includes(__nextStatus)) {
          throw this._hrLeaveApprovalErr(\`\${__cfg.status_field} must be one of: \${__cfg.statuses.join(', ')}\`, 400);
        }
      }
    `,
    },
    methods: `
  _hrLeaveApprovalCfg() {
    const cfg =
      this.mixinConfig?.hr_leave_approval ||
      this.mixinConfig?.hrLeaveApproval ||
      {};
    return {
      leave_entity: cfg.leave_entity || cfg.leaveEntity || '${merged.leave_entity}',
      status_field: cfg.status_field || cfg.statusField || '${merged.status_field}',
      approver_field: cfg.approver_field || cfg.approverField || '${merged.approver_field}',
      approved_at_field: cfg.approved_at_field || cfg.approvedAtField || '${merged.approved_at_field}',
      rejected_at_field: cfg.rejected_at_field || cfg.rejectedAtField || '${merged.rejected_at_field}',
      cancelled_at_field: cfg.cancelled_at_field || cfg.cancelledAtField || '${merged.cancelled_at_field}',
      rejection_reason_field: cfg.rejection_reason_field || cfg.rejectionReasonField || '${merged.rejection_reason_field}',
      decision_key_field: cfg.decision_key_field || cfg.decisionKeyField || '${merged.decision_key_field}',
      statuses:
        (Array.isArray(cfg.statuses) && cfg.statuses.length
          ? cfg.statuses
          : ${JSON.stringify(Array.isArray(merged.statuses) ? merged.statuses : ['Pending', 'Approved', 'Rejected', 'Cancelled'])}),
      enforce_transitions:
        cfg.enforce_transitions !== false &&
        cfg.enforceTransitions !== false,
      consume_on_approval:
        cfg.consume_on_approval !== false &&
        cfg.consumeOnApproval !== false,
      transitions:
        (cfg.transitions && typeof cfg.transitions === 'object')
          ? cfg.transitions
          : ${JSON.stringify(merged.transitions || defaults.transitions)},
      employee_field: cfg.employee_field || cfg.employeeField || '${merged.employee_field}',
      leave_type_field: cfg.leave_type_field || cfg.leaveTypeField || '${merged.leave_type_field}',
      days_field: cfg.days_field || cfg.daysField || '${merged.days_field}',
      start_date_field: cfg.start_date_field || cfg.startDateField || '${merged.start_date_field}',
      end_date_field: cfg.end_date_field || cfg.endDateField || '${merged.end_date_field}',
      balance_entity: cfg.balance_entity || cfg.balanceEntity || '${merged.balance_entity}',
      fiscal_year_field: cfg.fiscal_year_field || cfg.fiscalYearField || '${merged.fiscal_year_field}',
      entitlement_field: cfg.entitlement_field || cfg.entitlementField || '${merged.entitlement_field}',
      accrued_field: cfg.accrued_field || cfg.accruedField || '${merged.accrued_field}',
      consumed_field: cfg.consumed_field || cfg.consumedField || '${merged.consumed_field}',
      carry_forward_field: cfg.carry_forward_field || cfg.carryForwardField || '${merged.carry_forward_field}',
      available_field: cfg.available_field || cfg.availableField || '${merged.available_field}',
      default_entitlement: Number(cfg.default_entitlement || cfg.defaultEntitlement || ${Number(merged.default_entitlement) || 18}) || ${Number(merged.default_entitlement) || 18},
    };
  }

  _hrLeaveApprovalErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _hrLeaveApprovalAssertTransition(currentStatus, nextStatus, cfg) {
    if (!cfg.enforce_transitions) return;
    if (!currentStatus || !nextStatus || String(currentStatus) === String(nextStatus)) return;
    const transitions = cfg.transitions && typeof cfg.transitions === 'object' ? cfg.transitions : {};
    const allowed = Array.isArray(transitions[currentStatus]) ? transitions[currentStatus] : [];
    if (!allowed.includes(nextStatus)) {
      throw this._hrLeaveApprovalErr(\`Invalid leave status transition: \${currentStatus} -> \${nextStatus}\`, 409);
    }
  }

  async listPendingLeaveApprovals(filter = {}) {
    const cfg = this._hrLeaveApprovalCfg();
    if (this.slug !== cfg.leave_entity) {
      throw this._hrLeaveApprovalErr(
        \`Leave approval listing can only run on '\${cfg.leave_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    const where = {
      [cfg.status_field]: 'Pending',
    };
    if (filter && Object.prototype.hasOwnProperty.call(filter, cfg.approver_field)) {
      where[cfg.approver_field] = filter[cfg.approver_field];
    } else if (filter && Object.prototype.hasOwnProperty.call(filter, 'approver_id')) {
      where[cfg.approver_field] = filter.approver_id;
    } else if (filter && Object.prototype.hasOwnProperty.call(filter, 'approverId')) {
      where[cfg.approver_field] = filter.approverId;
    }
    return this.repository.findAll(cfg.leave_entity, where);
  }

  async _hrApplyLeaveDecision(leaveId, targetStatus, payload = {}) {
    const cfg = this._hrLeaveApprovalCfg();
    if (this.slug !== cfg.leave_entity) {
      throw this._hrLeaveApprovalErr(
        \`Leave decision can only run on '\${cfg.leave_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    if (!cfg.statuses.includes(targetStatus)) {
      throw this._hrLeaveApprovalErr(\`Unsupported target status '\${targetStatus}'\`, 400);
    }

    return this.repository.withTransaction(async (client) => {
      if (this.repository && typeof this.repository.applyLeaveDecisionIdempotent === 'function') {
        return this.repository.applyLeaveDecisionIdempotent(
          cfg.leave_entity,
          leaveId,
          {
            target_status: targetStatus,
            status_field: cfg.status_field,
            approver_field: cfg.approver_field,
            approved_at_field: cfg.approved_at_field,
            rejected_at_field: cfg.rejected_at_field,
            cancelled_at_field: cfg.cancelled_at_field,
            rejection_reason_field: cfg.rejection_reason_field,
            decision_key_field: cfg.decision_key_field,
            transitions: cfg.transitions,
            enforce_transitions: cfg.enforce_transitions,
            decision_key: payload.decision_key || payload.decisionKey || null,
            approver_id: payload[cfg.approver_field] || payload.approver_id || payload.approverId || null,
            reason: payload.reason || payload[cfg.rejection_reason_field] || null,
            consume_on_approval: cfg.consume_on_approval,
            employee_field: cfg.employee_field,
            leave_type_field: cfg.leave_type_field,
            days_field: cfg.days_field,
            start_date_field: cfg.start_date_field,
            end_date_field: cfg.end_date_field,
            balance_entity: cfg.balance_entity,
            fiscal_year_field: cfg.fiscal_year_field,
            entitlement_field: cfg.entitlement_field,
            accrued_field: cfg.accrued_field,
            consumed_field: cfg.consumed_field,
            carry_forward_field: cfg.carry_forward_field,
            available_field: cfg.available_field,
            default_entitlement: cfg.default_entitlement,
          },
          client
        );
      }

      const leave = await this.repository.findByIdForUpdate(cfg.leave_entity, leaveId, client);
      if (!leave) throw this._hrLeaveApprovalErr('Leave request not found', 404);

      const currentStatus = String(leave[cfg.status_field] || 'Pending');
      this._hrLeaveApprovalAssertTransition(currentStatus, targetStatus, cfg);
      const nowIso = new Date().toISOString();
      const patch = {
        [cfg.status_field]: targetStatus,
      };
      if (payload.decision_key || payload.decisionKey) {
        patch[cfg.decision_key_field] = payload.decision_key || payload.decisionKey;
      }
      if (payload[cfg.approver_field] || payload.approver_id || payload.approverId) {
        patch[cfg.approver_field] = payload[cfg.approver_field] || payload.approver_id || payload.approverId;
      }
      if (targetStatus === 'Approved') patch[cfg.approved_at_field] = nowIso;
      if (targetStatus === 'Rejected') {
        patch[cfg.rejected_at_field] = nowIso;
        patch[cfg.rejection_reason_field] = payload.reason || null;
      }
      if (targetStatus === 'Cancelled') patch[cfg.cancelled_at_field] = nowIso;

      const updatedLeave = await this.repository.updateWithClient(cfg.leave_entity, leaveId, patch, client);
      return {
        leave: updatedLeave,
        idempotent: false,
        balance: null,
      };
    });
  }

  async approveLeaveRequest(leaveId, payload = {}) {
    return this._hrApplyLeaveDecision(leaveId, 'Approved', payload);
  }

  async rejectLeaveRequest(leaveId, payload = {}) {
    return this._hrApplyLeaveDecision(leaveId, 'Rejected', payload);
  }

  async cancelLeaveRequest(leaveId, payload = {}) {
    return this._hrApplyLeaveDecision(leaveId, 'Cancelled', payload);
  }
    `,
  };
};
