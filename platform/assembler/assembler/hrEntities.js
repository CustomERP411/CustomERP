// HR Priority A entity enrichment – extracted from ProjectAssembler
module.exports = {
  _withHRPriorityAEntities(entities, sdf) {
    const cfg = this._getHRPriorityAConfig(sdf);
    const { enabledModules } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const hrEnabled = enabledSet.has('hr');
    const packsEnabled =
      this._isPackEnabled(cfg.leaveEngine) ||
      this._isPackEnabled(cfg.leaveApprovals) ||
      this._isPackEnabled(cfg.attendanceTime) ||
      this._isPackEnabled(cfg.compensationLedger);

    if (!hrEnabled || !packsEnabled) return;

    const bySlug = new Map();
    for (const entity of entities) {
      if (!entity || !entity.slug) continue;
      bySlug.set(entity.slug, entity);
    }

    const ensureEntity = (slug, defaultModule, factory) => {
      if (bySlug.has(slug)) {
        const existing = bySlug.get(slug);
        if (!existing.module && defaultModule) existing.module = defaultModule;
        return existing;
      }
      const created = factory();
      entities.push(created);
      bySlug.set(slug, created);
      return created;
    };

    const ensureField = (entity, field) => {
      if (!entity || !field || !field.name) return;
      if (!Array.isArray(entity.fields)) entity.fields = [];
      if (entity.fields.some((f) => f && f.name === field.name)) return;
      entity.fields.push({ ...field });
    };

    const ensureChild = (entity, childCfg) => {
      if (!entity || !childCfg || !childCfg.entity || !childCfg.foreign_key) return;
      if (!Array.isArray(entity.children)) entity.children = [];
      const exists = entity.children.some((c) => {
        const childSlug = c && (c.entity || c.slug);
        const fk = c && (c.foreign_key || c.foreignKey);
        return childSlug === childCfg.entity && fk === childCfg.foreign_key;
      });
      if (!exists) {
        entity.children.push({ ...childCfg });
      }
    };

    const employeeEntity = ensureEntity(cfg.employeeEntity, 'hr', () => ({
      slug: cfg.employeeEntity,
      display_name: 'Employees',
      display_field: 'first_name',
      module: 'hr',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['first_name', 'last_name', 'email', 'status', 'job_title'] },
      fields: [],
      features: { audit_trail: true },
    }));
    ensureField(employeeEntity, { name: 'first_name', type: 'string', label: 'First Name', required: true });
    ensureField(employeeEntity, { name: 'last_name', type: 'string', label: 'Last Name', required: true });
    ensureField(employeeEntity, { name: 'email', type: 'string', label: 'Email', required: true, unique: true });
    ensureField(employeeEntity, { name: 'job_title', type: 'string', label: 'Job Title', required: false });
    ensureField(employeeEntity, { name: 'hire_date', type: 'date', label: 'Hire Date', required: false });
    ensureField(employeeEntity, {
      name: 'status',
      type: 'string',
      label: 'Status',
      required: true,
      options: ['Active', 'On Leave', 'Terminated'],
    });

    const departmentsEntity = ensureEntity(cfg.departmentEntity, 'hr', () => ({
      slug: cfg.departmentEntity,
      display_name: 'Departments',
      display_field: 'name',
      module: 'hr',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['name', 'manager_id', 'location'] },
      fields: [],
      features: {},
    }));
    ensureField(departmentsEntity, { name: 'name', type: 'string', label: 'Department', required: true, unique: true });
    ensureField(departmentsEntity, {
      name: 'manager_id',
      type: 'reference',
      label: 'Manager',
      required: false,
      reference_entity: cfg.employeeEntity,
    });
    ensureField(departmentsEntity, { name: 'location', type: 'string', label: 'Location', required: false });
    const employeeModule = String(employeeEntity.module || 'hr').trim().toLowerCase();
    const departmentModule = String(departmentsEntity.module || 'hr').trim().toLowerCase();
    const canLinkDepartmentFromEmployee =
      employeeModule === departmentModule ||
      employeeModule === 'hr' ||
      departmentModule === 'shared';
    const canLinkEmployeeChildEntity = (childEntity) => {
      const childModule = String((childEntity && childEntity.module) || 'hr').trim().toLowerCase();
      return (
        employeeModule === childModule ||
        employeeModule === 'hr' ||
        childModule === 'shared'
      );
    };
    if (canLinkDepartmentFromEmployee) {
      ensureField(employeeEntity, {
        name: 'department_id',
        type: 'reference',
        label: 'Department',
        required: false,
        reference_entity: cfg.departmentEntity,
      });
    }

    if (this._isPackEnabled(cfg.leaveEngine) || this._isPackEnabled(cfg.leaveApprovals)) {
      const leaveEntity = ensureEntity(cfg.leaveEntity, 'hr', () => ({
        slug: cfg.leaveEntity,
        display_name: 'Leave Requests',
        display_field: cfg.leaveEngine.leave_type_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.leaveEngine.employee_field,
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.start_date_field,
            cfg.leaveEngine.end_date_field,
            cfg.leaveEngine.status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(leaveEntity, {
        name: cfg.leaveEngine.employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveEngine.leave_type_field,
        type: 'string',
        label: 'Leave Type',
        required: true,
        options: ['Annual', 'Sick', 'Casual', 'Unpaid'],
      });
      ensureField(leaveEntity, { name: cfg.leaveEngine.start_date_field, type: 'date', label: 'Start Date', required: true });
      ensureField(leaveEntity, { name: cfg.leaveEngine.end_date_field, type: 'date', label: 'End Date', required: true });
      ensureField(leaveEntity, { name: cfg.leaveEngine.days_field, type: 'decimal', label: 'Leave Days', required: false, min: 0 });
      ensureField(leaveEntity, {
        name: cfg.leaveEngine.status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: cfg.leaveApprovals.statuses,
      });
      if (cfg.leaveApprovals.status_field !== cfg.leaveEngine.status_field) {
        ensureField(leaveEntity, {
          name: cfg.leaveApprovals.status_field,
          type: 'string',
          label: 'Approval Status',
          required: true,
          options: cfg.leaveApprovals.statuses,
        });
      }
      ensureField(leaveEntity, { name: 'reason', type: 'text', label: 'Reason', required: false });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.approver_field,
        type: 'reference',
        label: 'Approver',
        required: false,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.approved_at_field,
        type: 'datetime',
        label: 'Approved At',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.rejected_at_field,
        type: 'datetime',
        label: 'Rejected At',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.cancelled_at_field,
        type: 'datetime',
        label: 'Cancelled At',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.rejection_reason_field,
        type: 'text',
        label: 'Rejection Reason',
        required: false,
      });
      ensureField(leaveEntity, {
        name: cfg.leaveApprovals.decision_key_field,
        type: 'string',
        label: 'Decision Key',
        required: false,
      });

      if (canLinkEmployeeChildEntity(leaveEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.leaveEntity,
          foreign_key: cfg.leaveEngine.employee_field,
          label: 'Leave Requests',
          columns: [
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.start_date_field,
            cfg.leaveEngine.end_date_field,
            cfg.leaveEngine.status_field,
          ],
        });
      }
    }

    if (this._isPackEnabled(cfg.leaveEngine)) {
      const balanceEntity = ensureEntity(cfg.leaveEngine.balance_entity, 'hr', () => ({
        slug: cfg.leaveEngine.balance_entity,
        display_name: 'Leave Balances',
        display_field: cfg.leaveEngine.leave_type_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.leaveEngine.employee_field,
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.available_field,
            cfg.leaveEngine.fiscal_year_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.leave_type_field,
        type: 'string',
        label: 'Leave Type',
        required: true,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.entitlement_field,
        type: 'decimal',
        label: 'Entitlement',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.accrued_field,
        type: 'decimal',
        label: 'Accrued',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.consumed_field,
        type: 'decimal',
        label: 'Consumed',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.carry_forward_field,
        type: 'decimal',
        label: 'Carry Forward',
        required: true,
        min: 0,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.available_field,
        type: 'decimal',
        label: 'Available',
        required: true,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.fiscal_year_field,
        type: 'string',
        label: 'Year',
        required: true,
      });
      ensureField(balanceEntity, {
        name: cfg.leaveEngine.last_accrual_at_field,
        type: 'datetime',
        label: 'Last Accrual At',
        required: false,
      });
      ensureField(balanceEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      if (canLinkEmployeeChildEntity(balanceEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.leaveEngine.balance_entity,
          foreign_key: cfg.leaveEngine.employee_field,
          label: 'Leave Balances',
          columns: [
            cfg.leaveEngine.leave_type_field,
            cfg.leaveEngine.entitlement_field,
            cfg.leaveEngine.accrued_field,
            cfg.leaveEngine.available_field,
          ],
        });
      }
    }

    if (this._isPackEnabled(cfg.attendanceTime)) {
      const attendanceEntity = ensureEntity(cfg.attendanceTime.attendance_entity, 'hr', () => ({
        slug: cfg.attendanceTime.attendance_entity,
        display_name: 'Attendance Entries',
        display_field: cfg.attendanceTime.attendance_date_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.attendanceTime.attendance_employee_field,
            cfg.attendanceTime.attendance_date_field,
            cfg.attendanceTime.worked_hours_field,
            cfg.attendanceTime.attendance_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.attendance_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.attendance_date_field,
        type: 'date',
        label: 'Work Date',
        required: true,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.check_in_field,
        type: 'datetime',
        label: 'Check In',
        required: false,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.check_out_field,
        type: 'datetime',
        label: 'Check Out',
        required: false,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.worked_hours_field,
        type: 'decimal',
        label: 'Worked Hours',
        required: false,
        min: 0,
      });
      ensureField(attendanceEntity, {
        name: cfg.attendanceTime.attendance_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Present', 'Absent', 'Half Day', 'On Leave'],
      });
      ensureField(attendanceEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(attendanceEntity, { name: 'idempotency_key', type: 'string', label: 'Idempotency Key', required: false, unique: true });

      const shiftEntity = ensureEntity(cfg.attendanceTime.shift_entity, 'hr', () => ({
        slug: cfg.attendanceTime.shift_entity,
        display_name: 'Shift Assignments',
        display_field: 'shift_name',
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.attendanceTime.shift_employee_field,
            'shift_name',
            cfg.attendanceTime.shift_start_field,
            cfg.attendanceTime.shift_end_field,
            cfg.attendanceTime.shift_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(shiftEntity, { name: 'shift_name', type: 'string', label: 'Shift Name', required: true });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_start_field,
        type: 'string',
        label: 'Start Time',
        required: true,
      });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_end_field,
        type: 'string',
        label: 'End Time',
        required: true,
      });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_days_field,
        type: 'text',
        label: 'Work Days',
        required: false,
      });
      ensureField(shiftEntity, {
        name: cfg.attendanceTime.shift_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Active', 'Inactive'],
      });
      ensureField(shiftEntity, { name: 'effective_from', type: 'date', label: 'Effective From', required: false });
      ensureField(shiftEntity, { name: 'effective_to', type: 'date', label: 'Effective To', required: false });

      const timesheetEntity = ensureEntity(cfg.attendanceTime.timesheet_entity, 'hr', () => ({
        slug: cfg.attendanceTime.timesheet_entity,
        display_name: 'Timesheets',
        display_field: cfg.attendanceTime.timesheet_date_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.attendanceTime.timesheet_employee_field,
            cfg.attendanceTime.timesheet_date_field,
            cfg.attendanceTime.timesheet_hours_field,
            cfg.attendanceTime.timesheet_overtime_field,
            cfg.attendanceTime.timesheet_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_date_field,
        type: 'date',
        label: 'Work Date',
        required: true,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_hours_field,
        type: 'decimal',
        label: 'Regular Hours',
        required: false,
        min: 0,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_overtime_field,
        type: 'decimal',
        label: 'Overtime Hours',
        required: false,
        min: 0,
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Submitted', 'Approved', 'Rejected'],
      });
      ensureField(timesheetEntity, {
        name: cfg.attendanceTime.timesheet_attendance_field,
        type: 'reference',
        label: 'Attendance',
        required: false,
        reference_entity: cfg.attendanceTime.attendance_entity,
      });
      ensureField(timesheetEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      if (canLinkEmployeeChildEntity(attendanceEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.attendanceTime.attendance_entity,
          foreign_key: cfg.attendanceTime.attendance_employee_field,
          label: 'Attendance',
          columns: [
            cfg.attendanceTime.attendance_date_field,
            cfg.attendanceTime.worked_hours_field,
            cfg.attendanceTime.attendance_status_field,
          ],
        });
      }
      if (canLinkEmployeeChildEntity(timesheetEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.attendanceTime.timesheet_entity,
          foreign_key: cfg.attendanceTime.timesheet_employee_field,
          label: 'Timesheets',
          columns: [
            cfg.attendanceTime.timesheet_date_field,
            cfg.attendanceTime.timesheet_hours_field,
            cfg.attendanceTime.timesheet_overtime_field,
            cfg.attendanceTime.timesheet_status_field,
          ],
        });
      }
    }

    if (this._isPackEnabled(cfg.compensationLedger)) {
      const ledgerEntity = ensureEntity(cfg.compensationLedger.ledger_entity, 'hr', () => ({
        slug: cfg.compensationLedger.ledger_entity,
        display_name: 'Compensation Ledger',
        display_field: cfg.compensationLedger.ledger_period_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.compensationLedger.ledger_employee_field,
            cfg.compensationLedger.ledger_period_field,
            cfg.compensationLedger.ledger_component_field,
            cfg.compensationLedger.ledger_amount_field,
            cfg.compensationLedger.ledger_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_period_field,
        type: 'string',
        label: 'Pay Period',
        required: true,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_component_field,
        type: 'string',
        label: 'Component',
        required: true,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_type_field,
        type: 'string',
        label: 'Type',
        required: true,
        options: ['Earning', 'Deduction'],
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_amount_field,
        type: 'decimal',
        label: 'Amount',
        required: true,
      });
      ensureField(ledgerEntity, {
        name: cfg.compensationLedger.ledger_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(ledgerEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });
      ensureField(ledgerEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      const snapshotEntity = ensureEntity(cfg.compensationLedger.snapshot_entity, 'hr', () => ({
        slug: cfg.compensationLedger.snapshot_entity,
        display_name: 'Compensation Snapshots',
        display_field: cfg.compensationLedger.snapshot_period_field,
        module: 'hr',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.compensationLedger.snapshot_employee_field,
            cfg.compensationLedger.snapshot_period_field,
            cfg.compensationLedger.snapshot_gross_field,
            cfg.compensationLedger.snapshot_deduction_field,
            cfg.compensationLedger.snapshot_net_field,
            cfg.compensationLedger.snapshot_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_employee_field,
        type: 'reference',
        label: 'Employee',
        required: true,
        reference_entity: cfg.employeeEntity,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_period_field,
        type: 'string',
        label: 'Pay Period',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_gross_field,
        type: 'decimal',
        label: 'Gross Amount',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_deduction_field,
        type: 'decimal',
        label: 'Deduction Amount',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_net_field,
        type: 'decimal',
        label: 'Net Amount',
        required: true,
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted'],
      });
      ensureField(snapshotEntity, {
        name: cfg.compensationLedger.snapshot_posted_at_field,
        type: 'datetime',
        label: 'Posted At',
        required: false,
      });
      ensureField(snapshotEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      if (canLinkEmployeeChildEntity(ledgerEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.compensationLedger.ledger_entity,
          foreign_key: cfg.compensationLedger.ledger_employee_field,
          label: 'Compensation Ledger',
          columns: [
            cfg.compensationLedger.ledger_period_field,
            cfg.compensationLedger.ledger_component_field,
            cfg.compensationLedger.ledger_amount_field,
            cfg.compensationLedger.ledger_status_field,
          ],
        });
      }
      if (canLinkEmployeeChildEntity(snapshotEntity)) {
        ensureChild(employeeEntity, {
          entity: cfg.compensationLedger.snapshot_entity,
          foreign_key: cfg.compensationLedger.snapshot_employee_field,
          label: 'Compensation Snapshots',
          columns: [
            cfg.compensationLedger.snapshot_period_field,
            cfg.compensationLedger.snapshot_gross_field,
            cfg.compensationLedger.snapshot_deduction_field,
            cfg.compensationLedger.snapshot_net_field,
          ],
        });
      }
    }
  },
};
