// HR Priority A config resolution & validation – extracted from ProjectAssembler
module.exports = {
  _getHRPriorityAConfig(sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const hr = (modules.hr && typeof modules.hr === 'object') ? modules.hr : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const leaveEngine = normalizePack(
      hr.leave_engine || hr.leaveEngine || hr.leave_policy || hr.leavePolicy,
      {
        leave_entity: 'leaves',
        balance_entity: 'leave_balances',
        employee_field: 'employee_id',
        leave_type_field: 'leave_type',
        start_date_field: 'start_date',
        end_date_field: 'end_date',
        days_field: 'leave_days',
        status_field: 'status',
        entitlement_field: 'annual_entitlement',
        accrued_field: 'accrued_days',
        consumed_field: 'consumed_days',
        carry_forward_field: 'carry_forward_days',
        available_field: 'available_days',
        fiscal_year_field: 'year',
        last_accrual_at_field: 'last_accrual_at',
        default_entitlement: 18,
        auto_create_balance: true,
      }
    );
    const leaveApprovals = normalizePack(
      hr.leave_approvals ||
      hr.leaveApprovals ||
      hr.leave_approval ||
      hr.leaveApproval ||
      hr.approval_workflow ||
      hr.approvalWorkflow,
      {
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
      }
    );
    const attendanceTime = normalizePack(
      hr.attendance_time || hr.attendanceTime || hr.attendance || hr.time_tracking || hr.timeTracking,
      {
        attendance_entity: 'attendance_entries',
        shift_entity: 'shift_assignments',
        timesheet_entity: 'timesheet_entries',
        attendance_employee_field: 'employee_id',
        attendance_date_field: 'work_date',
        check_in_field: 'check_in_at',
        check_out_field: 'check_out_at',
        worked_hours_field: 'worked_hours',
        attendance_status_field: 'status',
        shift_employee_field: 'employee_id',
        shift_start_field: 'start_time',
        shift_end_field: 'end_time',
        shift_days_field: 'work_days',
        shift_status_field: 'status',
        timesheet_employee_field: 'employee_id',
        timesheet_date_field: 'work_date',
        timesheet_hours_field: 'regular_hours',
        timesheet_overtime_field: 'overtime_hours',
        timesheet_status_field: 'status',
        timesheet_attendance_field: 'attendance_id',
      }
    );
    const compensationLedger = normalizePack(
      hr.compensation_ledger || hr.compensationLedger || hr.payroll_ledger || hr.payrollLedger,
      {
        ledger_entity: 'compensation_ledger',
        snapshot_entity: 'compensation_snapshots',
        ledger_employee_field: 'employee_id',
        ledger_period_field: 'pay_period',
        ledger_component_field: 'component',
        ledger_type_field: 'component_type',
        ledger_amount_field: 'amount',
        ledger_status_field: 'status',
        snapshot_employee_field: 'employee_id',
        snapshot_period_field: 'pay_period',
        snapshot_gross_field: 'gross_amount',
        snapshot_deduction_field: 'deduction_amount',
        snapshot_net_field: 'net_amount',
        snapshot_status_field: 'status',
        snapshot_posted_at_field: 'posted_at',
      }
    );

    const employeeEntity = this._pickFirstString(
      hr.employee_entity,
      hr.employeeEntity,
      leaveEngine.employee_entity,
      leaveEngine.employeeEntity,
      attendanceTime.employee_entity,
      attendanceTime.employeeEntity,
      compensationLedger.employee_entity,
      compensationLedger.employeeEntity,
      'employees'
    );
    const departmentEntity = this._pickFirstString(
      hr.department_entity,
      hr.departmentEntity,
      'departments'
    );
    const leaveEntity = this._pickFirstString(
      hr.leave_entity,
      hr.leaveEntity,
      leaveEngine.leave_entity,
      leaveEngine.leaveEntity,
      leaveApprovals.leave_entity,
      leaveApprovals.leaveEntity,
      'leaves'
    );

    leaveEngine.leave_entity = this._pickFirstString(
      leaveEngine.leave_entity,
      leaveEngine.leaveEntity,
      leaveEntity
    );
    leaveEngine.balance_entity = this._pickFirstString(
      leaveEngine.balance_entity,
      leaveEngine.balanceEntity,
      'leave_balances'
    );
    leaveEngine.employee_field = this._pickFirstString(
      leaveEngine.employee_field,
      leaveEngine.employeeField,
      'employee_id'
    );
    leaveEngine.leave_type_field = this._pickFirstString(
      leaveEngine.leave_type_field,
      leaveEngine.leaveTypeField,
      'leave_type'
    );
    leaveEngine.start_date_field = this._pickFirstString(
      leaveEngine.start_date_field,
      leaveEngine.startDateField,
      'start_date'
    );
    leaveEngine.end_date_field = this._pickFirstString(
      leaveEngine.end_date_field,
      leaveEngine.endDateField,
      'end_date'
    );
    leaveEngine.days_field = this._pickFirstString(
      leaveEngine.days_field,
      leaveEngine.daysField,
      'leave_days'
    );
    leaveEngine.status_field = this._pickFirstString(
      leaveEngine.status_field,
      leaveEngine.statusField,
      'status'
    );
    leaveEngine.entitlement_field = this._pickFirstString(
      leaveEngine.entitlement_field,
      leaveEngine.entitlementField,
      'annual_entitlement'
    );
    leaveEngine.accrued_field = this._pickFirstString(
      leaveEngine.accrued_field,
      leaveEngine.accruedField,
      'accrued_days'
    );
    leaveEngine.consumed_field = this._pickFirstString(
      leaveEngine.consumed_field,
      leaveEngine.consumedField,
      'consumed_days'
    );
    leaveEngine.carry_forward_field = this._pickFirstString(
      leaveEngine.carry_forward_field,
      leaveEngine.carryForwardField,
      'carry_forward_days'
    );
    leaveEngine.available_field = this._pickFirstString(
      leaveEngine.available_field,
      leaveEngine.availableField,
      'available_days'
    );
    leaveEngine.fiscal_year_field = this._pickFirstString(
      leaveEngine.fiscal_year_field,
      leaveEngine.fiscalYearField,
      'year'
    );
    leaveEngine.last_accrual_at_field = this._pickFirstString(
      leaveEngine.last_accrual_at_field,
      leaveEngine.lastAccrualAtField,
      'last_accrual_at'
    );
    leaveEngine.default_entitlement = Number(leaveEngine.default_entitlement || leaveEngine.defaultEntitlement || 18);
    if (!Number.isFinite(leaveEngine.default_entitlement) || leaveEngine.default_entitlement < 0) {
      leaveEngine.default_entitlement = 18;
    }
    leaveEngine.auto_create_balance =
      leaveEngine.auto_create_balance !== false &&
      leaveEngine.autoCreateBalance !== false;

    leaveApprovals.leave_entity = this._pickFirstString(
      leaveApprovals.leave_entity,
      leaveApprovals.leaveEntity,
      leaveEntity
    );
    leaveApprovals.status_field = this._pickFirstString(
      leaveApprovals.status_field,
      leaveApprovals.statusField,
      leaveEngine.status_field
    );
    leaveApprovals.approver_field = this._pickFirstString(
      leaveApprovals.approver_field,
      leaveApprovals.approverField,
      'approver_id'
    );
    leaveApprovals.approved_at_field = this._pickFirstString(
      leaveApprovals.approved_at_field,
      leaveApprovals.approvedAtField,
      'approved_at'
    );
    leaveApprovals.rejected_at_field = this._pickFirstString(
      leaveApprovals.rejected_at_field,
      leaveApprovals.rejectedAtField,
      'rejected_at'
    );
    leaveApprovals.cancelled_at_field = this._pickFirstString(
      leaveApprovals.cancelled_at_field,
      leaveApprovals.cancelledAtField,
      'cancelled_at'
    );
    leaveApprovals.rejection_reason_field = this._pickFirstString(
      leaveApprovals.rejection_reason_field,
      leaveApprovals.rejectionReasonField,
      'rejection_reason'
    );
    leaveApprovals.decision_key_field = this._pickFirstString(
      leaveApprovals.decision_key_field,
      leaveApprovals.decisionKeyField,
      'decision_key'
    );
    leaveApprovals.statuses = Array.isArray(leaveApprovals.statuses) && leaveApprovals.statuses.length
      ? leaveApprovals.statuses
      : ['Pending', 'Approved', 'Rejected', 'Cancelled'];
    leaveApprovals.enforce_transitions =
      leaveApprovals.enforce_transitions !== false &&
      leaveApprovals.enforceTransitions !== false;
    leaveApprovals.consume_on_approval =
      leaveApprovals.consume_on_approval !== false &&
      leaveApprovals.consumeOnApproval !== false;

    attendanceTime.attendance_entity = this._pickFirstString(
      attendanceTime.attendance_entity,
      attendanceTime.attendanceEntity,
      'attendance_entries'
    );
    attendanceTime.shift_entity = this._pickFirstString(
      attendanceTime.shift_entity,
      attendanceTime.shiftEntity,
      'shift_assignments'
    );
    attendanceTime.timesheet_entity = this._pickFirstString(
      attendanceTime.timesheet_entity,
      attendanceTime.timesheetEntity,
      'timesheet_entries'
    );
    attendanceTime.attendance_employee_field = this._pickFirstString(
      attendanceTime.attendance_employee_field,
      attendanceTime.attendanceEmployeeField,
      'employee_id'
    );
    attendanceTime.attendance_date_field = this._pickFirstString(
      attendanceTime.attendance_date_field,
      attendanceTime.attendanceDateField,
      'work_date'
    );
    attendanceTime.check_in_field = this._pickFirstString(
      attendanceTime.check_in_field,
      attendanceTime.checkInField,
      'check_in_at'
    );
    attendanceTime.check_out_field = this._pickFirstString(
      attendanceTime.check_out_field,
      attendanceTime.checkOutField,
      'check_out_at'
    );
    attendanceTime.worked_hours_field = this._pickFirstString(
      attendanceTime.worked_hours_field,
      attendanceTime.workedHoursField,
      'worked_hours'
    );
    attendanceTime.attendance_status_field = this._pickFirstString(
      attendanceTime.attendance_status_field,
      attendanceTime.attendanceStatusField,
      'status'
    );
    attendanceTime.shift_employee_field = this._pickFirstString(
      attendanceTime.shift_employee_field,
      attendanceTime.shiftEmployeeField,
      'employee_id'
    );
    attendanceTime.shift_start_field = this._pickFirstString(
      attendanceTime.shift_start_field,
      attendanceTime.shiftStartField,
      'start_time'
    );
    attendanceTime.shift_end_field = this._pickFirstString(
      attendanceTime.shift_end_field,
      attendanceTime.shiftEndField,
      'end_time'
    );
    attendanceTime.shift_days_field = this._pickFirstString(
      attendanceTime.shift_days_field,
      attendanceTime.shiftDaysField,
      'work_days'
    );
    attendanceTime.shift_status_field = this._pickFirstString(
      attendanceTime.shift_status_field,
      attendanceTime.shiftStatusField,
      'status'
    );
    attendanceTime.timesheet_employee_field = this._pickFirstString(
      attendanceTime.timesheet_employee_field,
      attendanceTime.timesheetEmployeeField,
      'employee_id'
    );
    attendanceTime.timesheet_date_field = this._pickFirstString(
      attendanceTime.timesheet_date_field,
      attendanceTime.timesheetDateField,
      'work_date'
    );
    attendanceTime.timesheet_hours_field = this._pickFirstString(
      attendanceTime.timesheet_hours_field,
      attendanceTime.timesheetHoursField,
      'regular_hours'
    );
    attendanceTime.timesheet_overtime_field = this._pickFirstString(
      attendanceTime.timesheet_overtime_field,
      attendanceTime.timesheetOvertimeField,
      'overtime_hours'
    );
    attendanceTime.timesheet_status_field = this._pickFirstString(
      attendanceTime.timesheet_status_field,
      attendanceTime.timesheetStatusField,
      'status'
    );
    attendanceTime.timesheet_attendance_field = this._pickFirstString(
      attendanceTime.timesheet_attendance_field,
      attendanceTime.timesheetAttendanceField,
      'attendance_id'
    );
    attendanceTime.work_days = Array.isArray(attendanceTime.work_days)
      ? attendanceTime.work_days
      : (Array.isArray(attendanceTime.workDays) ? attendanceTime.workDays : null);
    if (!Array.isArray(attendanceTime.work_days) || !attendanceTime.work_days.length) {
      attendanceTime.work_days = Array.isArray(hr.work_days) && hr.work_days.length
        ? hr.work_days
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    }
    attendanceTime.daily_hours = Number(attendanceTime.daily_hours || attendanceTime.dailyHours || hr.daily_hours || hr.dailyHours || 8);
    if (!Number.isFinite(attendanceTime.daily_hours) || attendanceTime.daily_hours <= 0) {
      attendanceTime.daily_hours = 8;
    }

    compensationLedger.ledger_entity = this._pickFirstString(
      compensationLedger.ledger_entity,
      compensationLedger.ledgerEntity,
      'compensation_ledger'
    );
    compensationLedger.snapshot_entity = this._pickFirstString(
      compensationLedger.snapshot_entity,
      compensationLedger.snapshotEntity,
      'compensation_snapshots'
    );
    compensationLedger.ledger_employee_field = this._pickFirstString(
      compensationLedger.ledger_employee_field,
      compensationLedger.ledgerEmployeeField,
      'employee_id'
    );
    compensationLedger.ledger_period_field = this._pickFirstString(
      compensationLedger.ledger_period_field,
      compensationLedger.ledgerPeriodField,
      'pay_period'
    );
    compensationLedger.ledger_component_field = this._pickFirstString(
      compensationLedger.ledger_component_field,
      compensationLedger.ledgerComponentField,
      'component'
    );
    compensationLedger.ledger_type_field = this._pickFirstString(
      compensationLedger.ledger_type_field,
      compensationLedger.ledgerTypeField,
      'component_type'
    );
    compensationLedger.ledger_amount_field = this._pickFirstString(
      compensationLedger.ledger_amount_field,
      compensationLedger.ledgerAmountField,
      'amount'
    );
    compensationLedger.ledger_status_field = this._pickFirstString(
      compensationLedger.ledger_status_field,
      compensationLedger.ledgerStatusField,
      'status'
    );
    compensationLedger.snapshot_employee_field = this._pickFirstString(
      compensationLedger.snapshot_employee_field,
      compensationLedger.snapshotEmployeeField,
      'employee_id'
    );
    compensationLedger.snapshot_period_field = this._pickFirstString(
      compensationLedger.snapshot_period_field,
      compensationLedger.snapshotPeriodField,
      'pay_period'
    );
    compensationLedger.snapshot_gross_field = this._pickFirstString(
      compensationLedger.snapshot_gross_field,
      compensationLedger.snapshotGrossField,
      'gross_amount'
    );
    compensationLedger.snapshot_deduction_field = this._pickFirstString(
      compensationLedger.snapshot_deduction_field,
      compensationLedger.snapshotDeductionField,
      'deduction_amount'
    );
    compensationLedger.snapshot_net_field = this._pickFirstString(
      compensationLedger.snapshot_net_field,
      compensationLedger.snapshotNetField,
      'net_amount'
    );
    compensationLedger.snapshot_status_field = this._pickFirstString(
      compensationLedger.snapshot_status_field,
      compensationLedger.snapshotStatusField,
      'status'
    );
    compensationLedger.snapshot_posted_at_field = this._pickFirstString(
      compensationLedger.snapshot_posted_at_field,
      compensationLedger.snapshotPostedAtField,
      'posted_at'
    );

    return {
      employeeEntity,
      departmentEntity,
      leaveEntity,
      leaveEngine,
      leaveApprovals,
      attendanceTime,
      compensationLedger,
    };
  },

  _validateHRPriorityAConfig({
    sdf,
    enabledSet,
    hasErpConfig,
    allBySlug,
    requireEntity,
    ensureFields,
  }) {
    const cfg = this._getHRPriorityAConfig(sdf);
    const packsEnabled =
      this._isPackEnabled(cfg.leaveEngine) ||
      this._isPackEnabled(cfg.leaveApprovals) ||
      this._isPackEnabled(cfg.attendanceTime) ||
      this._isPackEnabled(cfg.compensationLedger);

    if (!packsEnabled) return;

    if (!enabledSet.has('hr')) {
      throw new Error(
        'SDF Validation Error: HR Priority A capability packs require module \'hr\' to be enabled.'
      );
    }

    const employeeEntity = requireEntity(cfg.employeeEntity, 'hr employee master');
    const employeeModule = this._normalizeEntityModule(employeeEntity, { hasErpConfig });
    if (employeeModule !== 'hr' && employeeModule !== 'shared') {
      throw new Error(
        `SDF Validation Error: HR employee entity '${cfg.employeeEntity}' must be in module 'hr' or 'shared'.`
      );
    }

    if (this._isPackEnabled(cfg.leaveEngine) || this._isPackEnabled(cfg.leaveApprovals)) {
      const leaveEntity = requireEntity(cfg.leaveEntity, 'hr leave requests');
      const leaveModule = this._normalizeEntityModule(leaveEntity, { hasErpConfig });
      if (leaveModule !== 'hr') {
        throw new Error(
          `SDF Validation Error: HR leave entity '${cfg.leaveEntity}' must be in module 'hr'.`
        );
      }
      ensureFields(
        leaveEntity,
        [
          cfg.leaveEngine.employee_field,
          cfg.leaveEngine.leave_type_field,
          cfg.leaveEngine.start_date_field,
          cfg.leaveEngine.end_date_field,
          cfg.leaveEngine.status_field,
        ],
        cfg.leaveEntity
      );
    }

    if (this._isPackEnabled(cfg.leaveEngine)) {
      const balanceEntity = requireEntity(cfg.leaveEngine.balance_entity, 'hr leave balances');
      const balanceModule = this._normalizeEntityModule(balanceEntity, { hasErpConfig });
      if (balanceModule !== 'hr') {
        throw new Error(
          `SDF Validation Error: HR leave balance entity '${cfg.leaveEngine.balance_entity}' must be in module 'hr'.`
        );
      }
      ensureFields(
        balanceEntity,
        [
          cfg.leaveEngine.employee_field,
          cfg.leaveEngine.leave_type_field,
          cfg.leaveEngine.entitlement_field,
          cfg.leaveEngine.accrued_field,
          cfg.leaveEngine.consumed_field,
          cfg.leaveEngine.carry_forward_field,
          cfg.leaveEngine.available_field,
          cfg.leaveEngine.fiscal_year_field,
        ],
        cfg.leaveEngine.balance_entity
      );
    }

    if (this._isPackEnabled(cfg.leaveApprovals)) {
      const leaveEntity = requireEntity(cfg.leaveEntity, 'hr leave approvals');
      ensureFields(
        leaveEntity,
        [
          cfg.leaveApprovals.status_field,
          cfg.leaveApprovals.approver_field,
          cfg.leaveApprovals.approved_at_field,
          cfg.leaveApprovals.rejected_at_field,
        ],
        cfg.leaveEntity
      );
    }

    if (this._isPackEnabled(cfg.attendanceTime)) {
      const attendanceEntity = requireEntity(cfg.attendanceTime.attendance_entity, 'hr attendance entries');
      const shiftEntity = requireEntity(cfg.attendanceTime.shift_entity, 'hr shift assignments');
      const timesheetEntity = requireEntity(cfg.attendanceTime.timesheet_entity, 'hr timesheets');

      [attendanceEntity, shiftEntity, timesheetEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'hr') {
          throw new Error(
            `SDF Validation Error: HR attendance/time entity '${entity.slug}' must be in module 'hr'.`
          );
        }
      });

      ensureFields(
        attendanceEntity,
        [
          cfg.attendanceTime.attendance_employee_field,
          cfg.attendanceTime.attendance_date_field,
          cfg.attendanceTime.check_in_field,
          cfg.attendanceTime.check_out_field,
          cfg.attendanceTime.worked_hours_field,
          cfg.attendanceTime.attendance_status_field,
        ],
        cfg.attendanceTime.attendance_entity
      );
      ensureFields(
        shiftEntity,
        [
          cfg.attendanceTime.shift_employee_field,
          cfg.attendanceTime.shift_start_field,
          cfg.attendanceTime.shift_end_field,
          cfg.attendanceTime.shift_status_field,
        ],
        cfg.attendanceTime.shift_entity
      );
      ensureFields(
        timesheetEntity,
        [
          cfg.attendanceTime.timesheet_employee_field,
          cfg.attendanceTime.timesheet_date_field,
          cfg.attendanceTime.timesheet_hours_field,
          cfg.attendanceTime.timesheet_overtime_field,
          cfg.attendanceTime.timesheet_status_field,
        ],
        cfg.attendanceTime.timesheet_entity
      );
    }

    if (this._isPackEnabled(cfg.compensationLedger)) {
      const ledgerEntity = requireEntity(cfg.compensationLedger.ledger_entity, 'hr compensation ledger');
      const snapshotEntity = requireEntity(cfg.compensationLedger.snapshot_entity, 'hr compensation snapshots');

      [ledgerEntity, snapshotEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'hr') {
          throw new Error(
            `SDF Validation Error: HR compensation entity '${entity.slug}' must be in module 'hr'.`
          );
        }
      });

      ensureFields(
        ledgerEntity,
        [
          cfg.compensationLedger.ledger_employee_field,
          cfg.compensationLedger.ledger_period_field,
          cfg.compensationLedger.ledger_component_field,
          cfg.compensationLedger.ledger_type_field,
          cfg.compensationLedger.ledger_amount_field,
          cfg.compensationLedger.ledger_status_field,
        ],
        cfg.compensationLedger.ledger_entity
      );
      ensureFields(
        snapshotEntity,
        [
          cfg.compensationLedger.snapshot_employee_field,
          cfg.compensationLedger.snapshot_period_field,
          cfg.compensationLedger.snapshot_gross_field,
          cfg.compensationLedger.snapshot_deduction_field,
          cfg.compensationLedger.snapshot_net_field,
          cfg.compensationLedger.snapshot_status_field,
        ],
        cfg.compensationLedger.snapshot_entity
      );
    }

    // Keep unused helper warning clean for strict lint configs.
    void allBySlug;
  },
};
