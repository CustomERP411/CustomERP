// Frontend module configuration extraction (split from FrontendGenerator)
module.exports = {
  _getInventoryPriorityAConfig(sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const inventory =
      modules.inventory && typeof modules.inventory === 'object'
        ? modules.inventory
        : {};

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

    const reservations = normalizePack(
      inventory.reservations || inventory.reservation,
      {
        reservation_entity: 'stock_reservations',
        item_field: 'item_id',
        quantity_field: 'quantity',
        status_field: 'status',
        reserved_field: 'reserved_quantity',
        committed_field: 'committed_quantity',
        available_field: 'available_quantity',
      }
    );
    const transactions = normalizePack(
      inventory.transactions || inventory.transaction || inventory.stock_transactions || inventory.stockTransactions,
      {
        quantity_field: reservations.quantity_field || 'quantity',
      }
    );
    const inbound = normalizePack(
      inventory.inbound || inventory.receiving,
      {
        grn_entity: 'goods_receipts',
        grn_item_entity: 'goods_receipt_items',
        grn_item_parent_field: 'goods_receipt_id',
        grn_item_item_field: 'item_id',
        grn_item_received_field: 'received_quantity',
        grn_status_field: 'status',
      }
    );
    const cycleCounting = normalizePack(
      inventory.cycle_counting || inventory.cycleCounting || inventory.cycle_counts || inventory.cycleCounts,
      {
        session_entity: 'cycle_count_sessions',
        line_entity: 'cycle_count_lines',
        line_session_field: 'cycle_count_session_id',
        line_item_field: 'item_id',
        line_expected_field: 'expected_quantity',
        line_counted_field: 'counted_quantity',
        line_variance_field: 'variance_quantity',
      }
    );

    const stockEntity = this._pickFirstString(
      inventory.stock_entity,
      inventory.stockEntity,
      transactions.stock_entity,
      transactions.stockEntity,
      reservations.stock_entity,
      reservations.stockEntity,
      inbound.stock_entity,
      inbound.stockEntity,
      cycleCounting.stock_entity,
      cycleCounting.stockEntity,
      'products'
    );

    reservations.reservation_entity = this._pickFirstString(
      reservations.reservation_entity,
      reservations.reservationEntity,
      'stock_reservations'
    );
    reservations.item_field = this._pickFirstString(
      reservations.item_field,
      reservations.itemField,
      reservations.item_ref_field,
      reservations.itemRefField,
      'item_id'
    );
    reservations.quantity_field = this._pickFirstString(
      reservations.quantity_field,
      reservations.quantityField,
      'quantity'
    );
    reservations.status_field = this._pickFirstString(
      reservations.status_field,
      reservations.statusField,
      'status'
    );
    reservations.reserved_field = this._pickFirstString(
      reservations.reserved_field,
      reservations.reservedField,
      'reserved_quantity'
    );
    reservations.committed_field = this._pickFirstString(
      reservations.committed_field,
      reservations.committedField,
      'committed_quantity'
    );
    reservations.available_field = this._pickFirstString(
      reservations.available_field,
      reservations.availableField,
      'available_quantity'
    );

    transactions.quantity_field = this._pickFirstString(
      transactions.quantity_field,
      transactions.quantityField,
      reservations.quantity_field,
      'quantity'
    );

    inbound.grn_entity = this._pickFirstString(
      inbound.grn_entity,
      inbound.grnEntity,
      'goods_receipts'
    );
    inbound.grn_item_entity = this._pickFirstString(
      inbound.grn_item_entity,
      inbound.grnItemEntity,
      'goods_receipt_items'
    );
    inbound.grn_item_parent_field = this._pickFirstString(
      inbound.grn_item_parent_field,
      inbound.grnItemParentField,
      'goods_receipt_id'
    );
    inbound.grn_item_item_field = this._pickFirstString(
      inbound.grn_item_item_field,
      inbound.grnItemItemField,
      'item_id'
    );
    inbound.grn_item_received_field = this._pickFirstString(
      inbound.grn_item_received_field,
      inbound.grnItemReceivedField,
      'received_quantity'
    );
    inbound.grn_status_field = this._pickFirstString(
      inbound.grn_status_field,
      inbound.grnStatusField,
      'status'
    );

    cycleCounting.session_entity = this._pickFirstString(
      cycleCounting.session_entity,
      cycleCounting.sessionEntity,
      'cycle_count_sessions'
    );
    cycleCounting.line_entity = this._pickFirstString(
      cycleCounting.line_entity,
      cycleCounting.lineEntity,
      'cycle_count_lines'
    );
    cycleCounting.line_session_field = this._pickFirstString(
      cycleCounting.line_session_field,
      cycleCounting.lineSessionField,
      'cycle_count_session_id'
    );
    cycleCounting.line_item_field = this._pickFirstString(
      cycleCounting.line_item_field,
      cycleCounting.lineItemField,
      'item_id'
    );
    cycleCounting.line_expected_field = this._pickFirstString(
      cycleCounting.line_expected_field,
      cycleCounting.lineExpectedField,
      'expected_quantity'
    );
    cycleCounting.line_counted_field = this._pickFirstString(
      cycleCounting.line_counted_field,
      cycleCounting.lineCountedField,
      'counted_quantity'
    );
    cycleCounting.line_variance_field = this._pickFirstString(
      cycleCounting.line_variance_field,
      cycleCounting.lineVarianceField,
      'variance_quantity'
    );

    return {
      stockEntity,
      reservations,
      transactions,
      inbound,
      cycleCounting,
    };
  },

  _getInvoicePriorityAConfig(sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const invoice =
      modules.invoice && typeof modules.invoice === 'object'
        ? modules.invoice
        : {};

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

    const transactions = normalizePack(
      invoice.transactions || invoice.transaction,
      {
        invoice_entity: 'invoices',
      }
    );
    const payments = normalizePack(
      invoice.payments || invoice.payment,
      {
        payment_entity: 'invoice_payments',
        allocation_entity: 'invoice_payment_allocations',
      }
    );
    const notes = normalizePack(
      invoice.notes || invoice.credit_debit_notes || invoice.creditDebitNotes,
      {
        note_entity: 'invoice_notes',
      }
    );
    const lifecycle = normalizePack(
      invoice.lifecycle || invoice.invoice_lifecycle || invoice.invoiceLifecycle,
      {
        statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
      }
    );
    const calculationEngine = normalizePack(
      invoice.calculation_engine || invoice.calculationEngine || invoice.pricing_engine || invoice.pricingEngine,
      {
        invoice_item_entity: 'invoice_items',
      }
    );

    const invoiceEntity = this._pickFirstString(
      invoice.invoice_entity,
      invoice.invoiceEntity,
      transactions.invoice_entity,
      transactions.invoiceEntity,
      'invoices'
    );
    const paymentEntity = this._pickFirstString(
      payments.payment_entity,
      payments.paymentEntity,
      'invoice_payments'
    );
    const noteEntity = this._pickFirstString(
      notes.note_entity,
      notes.noteEntity,
      'invoice_notes'
    );
    const itemEntity = this._pickFirstString(
      invoice.invoice_item_entity,
      invoice.invoiceItemEntity,
      calculationEngine.invoice_item_entity,
      calculationEngine.invoiceItemEntity,
      'invoice_items'
    );
    lifecycle.statuses = Array.isArray(lifecycle.statuses) && lifecycle.statuses.length
      ? lifecycle.statuses
      : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

    return {
      invoiceEntity,
      paymentEntity,
      noteEntity,
      itemEntity,
      transactions,
      payments,
      notes,
      lifecycle,
      calculationEngine,
    };
  },

  _getHRPriorityAConfig(sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const hr =
      modules.hr && typeof modules.hr === 'object'
        ? modules.hr
        : {};

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
        available_field: 'available_days',
        fiscal_year_field: 'year',
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
        rejection_reason_field: 'rejection_reason',
        statuses: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
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
      }
    );
    const compensationLedger = normalizePack(
      hr.compensation_ledger || hr.compensationLedger || hr.payroll_ledger || hr.payrollLedger,
      {
        ledger_entity: 'compensation_ledger',
        snapshot_entity: 'compensation_snapshots',
      }
    );

    const employeeEntity = this._pickFirstString(
      hr.employee_entity,
      hr.employeeEntity,
      'employees'
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
    leaveApprovals.rejection_reason_field = this._pickFirstString(
      leaveApprovals.rejection_reason_field,
      leaveApprovals.rejectionReasonField,
      'rejection_reason'
    );
    leaveApprovals.statuses = Array.isArray(leaveApprovals.statuses) && leaveApprovals.statuses.length
      ? leaveApprovals.statuses
      : ['Pending', 'Approved', 'Rejected', 'Cancelled'];

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

    return {
      employeeEntity,
      leaveEntity,
      leaveEngine,
      leaveApprovals,
      attendanceTime,
      compensationLedger,
    };
  },
};
