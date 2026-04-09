// Mixin configuration builders (split from BackendGenerator)
module.exports = {
  _buildInventoryTransactionMixinConfig(entity, inventoryCfg) {
    const invOps = (entity && (entity.inventory_ops || entity.inventoryOps)) || {};
    const issueCfg = invOps.issue || invOps.sell || invOps.issue_stock || invOps.issueStock || {};
    const fields = invOps.fields || {};
    const movementTypes = invOps.movement_types || invOps.movementTypes || {};

    const quantityField = this._pickFirstString(
      inventoryCfg?.transactions?.quantity_field,
      inventoryCfg?.transactions?.quantityField,
      inventoryCfg?.reservations?.quantity_field,
      inventoryCfg?.reservations?.quantityField,
      invOps.quantity_field,
      invOps.quantityField,
      'quantity'
    );

    return {
      ...(inventoryCfg?.transactions || {}),
      stock_entity: inventoryCfg?.stockEntity || 'products',
      quantity_field: quantityField,
      movement_entity: this._pickFirstString(
        invOps.movement_entity,
        invOps.movementEntity,
        'stock_movements'
      ),
      allow_negative_stock:
        issueCfg.allow_negative_stock === true ||
        issueCfg.allowNegativeStock === true ||
        inventoryCfg?.transactions?.allow_negative_stock === true ||
        inventoryCfg?.transactions?.allowNegativeStock === true,
      fields: {
        item_ref: this._pickFirstString(fields.item_ref, fields.itemRef, 'item_id'),
        qty: this._pickFirstString(fields.qty, 'quantity'),
        type: this._pickFirstString(fields.type, 'movement_type'),
        location: this._pickFirstString(fields.location, fields.location_id, fields.locationId, 'location_id'),
        reason: this._pickFirstString(fields.reason, 'reason'),
        reference_number: this._pickFirstString(fields.reference_number, fields.referenceNumber, 'reference_number'),
        date: this._pickFirstString(fields.date, fields.movement_date, fields.movementDate, 'movement_date'),
        from_location: this._pickFirstString(fields.from_location, fields.fromLocation, fields.from_location_id, fields.fromLocationId, 'from_location_id'),
        to_location: this._pickFirstString(fields.to_location, fields.toLocation, fields.to_location_id, fields.toLocationId, 'to_location_id'),
      },
      movement_types: {
        receive: this._pickFirstString(movementTypes.receive, movementTypes.in, 'IN'),
        issue: this._pickFirstString(movementTypes.issue, movementTypes.out, 'OUT'),
        adjust: this._pickFirstString(movementTypes.adjust, 'ADJUSTMENT'),
        transfer_out: this._pickFirstString(movementTypes.transfer_out, movementTypes.transferOut, 'TRANSFER_OUT'),
        transfer_in: this._pickFirstString(movementTypes.transfer_in, movementTypes.transferIn, 'TRANSFER_IN'),
      },
    };
  },

  _buildInventoryReservationMixinConfig(inventoryCfg, transactionCfg) {
    return {
      ...(inventoryCfg?.reservations || {}),
      stock_entity: inventoryCfg?.stockEntity || 'products',
      reservation_entity: inventoryCfg?.reservationEntity || 'stock_reservations',
      item_field: this._pickFirstString(
        inventoryCfg?.reservations?.item_field,
        inventoryCfg?.reservations?.itemField,
        inventoryCfg?.reservations?.item_ref_field,
        inventoryCfg?.reservations?.itemRefField,
        'item_id'
      ),
      quantity_field: this._pickFirstString(
        inventoryCfg?.reservations?.quantity_field,
        inventoryCfg?.reservations?.quantityField,
        'quantity'
      ),
      status_field: this._pickFirstString(
        inventoryCfg?.reservations?.status_field,
        inventoryCfg?.reservations?.statusField,
        'status'
      ),
      reserved_field: this._pickFirstString(
        inventoryCfg?.reservations?.reserved_field,
        inventoryCfg?.reservations?.reservedField,
        'reserved_quantity'
      ),
      committed_field: this._pickFirstString(
        inventoryCfg?.reservations?.committed_field,
        inventoryCfg?.reservations?.committedField,
        'committed_quantity'
      ),
      available_field: this._pickFirstString(
        inventoryCfg?.reservations?.available_field,
        inventoryCfg?.reservations?.availableField,
        'available_quantity'
      ),
      stock_quantity_field: this._pickFirstString(
        transactionCfg?.quantity_field,
        transactionCfg?.quantityField,
        'quantity'
      ),
    };
  },

  _buildInventoryInboundMixinConfig(inventoryCfg, transactionCfg) {
    return {
      ...(inventoryCfg?.inbound || {}),
      stock_entity: inventoryCfg?.stockEntity || 'products',
      quantity_field: this._pickFirstString(
        transactionCfg?.quantity_field,
        transactionCfg?.quantityField,
        'quantity'
      ),
    };
  },

  _buildInventoryCycleMixinConfig(inventoryCfg, transactionCfg) {
    return {
      ...(inventoryCfg?.cycleCounting || {}),
      stock_entity: inventoryCfg?.stockEntity || 'products',
      quantity_field: this._pickFirstString(
        inventoryCfg?.cycleCounting?.quantity_field,
        inventoryCfg?.cycleCounting?.quantityField,
        transactionCfg?.quantity_field,
        transactionCfg?.quantityField,
        'quantity'
      ),
    };
  },

  _buildInvoiceTransactionMixinConfig(invoiceCfg, moduleInvoiceCfg = {}) {
    return {
      ...(moduleInvoiceCfg || {}),
      ...(invoiceCfg?.transactions || {}),
      invoice_entity: invoiceCfg?.invoiceEntity || 'invoices',
      invoice_number_field: invoiceCfg?.transactions?.invoice_number_field || 'invoice_number',
      idempotency_field: invoiceCfg?.transactions?.idempotency_field || 'idempotency_key',
      posted_at_field: invoiceCfg?.transactions?.posted_at_field || 'posted_at',
      status_field: invoiceCfg?.statusField || 'status',
      grand_total_field: invoiceCfg?.grandTotalField || 'grand_total',
      paid_total_field: invoiceCfg?.paidTotalField || 'paid_total',
      outstanding_field: invoiceCfg?.outstandingField || 'outstanding_balance',
      number_prefix: this._pickFirstString(
        moduleInvoiceCfg.prefix,
        moduleInvoiceCfg.invoice_prefix,
        moduleInvoiceCfg.invoicePrefix,
        'INV-'
      ),
      number_padding: Number(
        this._pickFirstString(
          invoiceCfg?.transactions?.number_padding,
          invoiceCfg?.transactions?.numberPadding,
          '6'
        )
      ) || 6,
    };
  },

  _buildInvoicePaymentMixinConfig(invoiceCfg, transactionCfg = {}) {
    return {
      ...(invoiceCfg?.payments || {}),
      invoice_entity: invoiceCfg?.invoiceEntity || 'invoices',
      payment_entity: invoiceCfg?.payments?.payment_entity || 'invoice_payments',
      allocation_entity: invoiceCfg?.payments?.allocation_entity || 'invoice_payment_allocations',
      invoice_status_field: transactionCfg.status_field || invoiceCfg?.statusField || 'status',
      invoice_grand_total_field: transactionCfg.grand_total_field || invoiceCfg?.grandTotalField || 'grand_total',
      invoice_paid_total_field: transactionCfg.paid_total_field || invoiceCfg?.paidTotalField || 'paid_total',
      invoice_outstanding_field: transactionCfg.outstanding_field || invoiceCfg?.outstandingField || 'outstanding_balance',
      payment_number_field: invoiceCfg?.payments?.payment_number_field || 'payment_number',
      payment_customer_field: invoiceCfg?.payments?.payment_customer_field || 'customer_id',
      payment_date_field: invoiceCfg?.payments?.payment_date_field || 'payment_date',
      payment_method_field: invoiceCfg?.payments?.payment_method_field || 'payment_method',
      payment_amount_field: invoiceCfg?.payments?.amount_field || 'amount',
      payment_unallocated_field: invoiceCfg?.payments?.unallocated_field || 'unallocated_amount',
      payment_status_field: invoiceCfg?.payments?.status_field || 'status',
      allocation_payment_field: invoiceCfg?.payments?.allocation_payment_field || 'payment_id',
      allocation_invoice_field: invoiceCfg?.payments?.allocation_invoice_field || 'invoice_id',
      allocation_amount_field: invoiceCfg?.payments?.allocation_amount_field || 'amount',
      allocation_date_field: invoiceCfg?.payments?.allocation_date_field || 'allocated_at',
      payment_number_prefix: this._pickFirstString(
        invoiceCfg?.payments?.payment_number_prefix,
        invoiceCfg?.payments?.paymentNumberPrefix,
        'PAY-'
      ),
      payment_number_padding: Number(
        this._pickFirstString(
          invoiceCfg?.payments?.payment_number_padding,
          invoiceCfg?.payments?.paymentNumberPadding,
          '6'
        )
      ) || 6,
    };
  },

  _buildInvoiceNoteMixinConfig(invoiceCfg, transactionCfg = {}) {
    return {
      ...(invoiceCfg?.notes || {}),
      invoice_entity: invoiceCfg?.invoiceEntity || 'invoices',
      note_entity: invoiceCfg?.notes?.note_entity || 'invoice_notes',
      invoice_status_field: transactionCfg.status_field || invoiceCfg?.statusField || 'status',
      invoice_grand_total_field: transactionCfg.grand_total_field || invoiceCfg?.grandTotalField || 'grand_total',
      invoice_paid_total_field: transactionCfg.paid_total_field || invoiceCfg?.paidTotalField || 'paid_total',
      invoice_outstanding_field: transactionCfg.outstanding_field || invoiceCfg?.outstandingField || 'outstanding_balance',
      note_number_field: invoiceCfg?.notes?.note_number_field || 'note_number',
      note_invoice_field: invoiceCfg?.notes?.note_invoice_field || 'source_invoice_id',
      note_type_field: invoiceCfg?.notes?.note_type_field || 'note_type',
      note_status_field: invoiceCfg?.notes?.note_status_field || 'status',
      note_amount_field: invoiceCfg?.notes?.note_amount_field || 'amount',
      note_tax_total_field: invoiceCfg?.notes?.note_tax_total_field || 'tax_total',
      note_grand_total_field: invoiceCfg?.notes?.note_grand_total_field || 'grand_total',
      note_posted_at_field: invoiceCfg?.notes?.note_posted_at_field || 'posted_at',
      note_number_credit_prefix: this._pickFirstString(
        invoiceCfg?.notes?.note_number_credit_prefix,
        invoiceCfg?.notes?.noteNumberCreditPrefix,
        'CN-'
      ),
      note_number_debit_prefix: this._pickFirstString(
        invoiceCfg?.notes?.note_number_debit_prefix,
        invoiceCfg?.notes?.noteNumberDebitPrefix,
        'DN-'
      ),
      note_number_padding: Number(
        this._pickFirstString(
          invoiceCfg?.notes?.note_number_padding,
          invoiceCfg?.notes?.noteNumberPadding,
          '6'
        )
      ) || 6,
    };
  },

  _buildInvoiceCalculationMixinConfig(invoiceCfg) {
    return {
      ...(invoiceCfg?.calculationEngine || {}),
      invoice_entity: invoiceCfg?.invoiceEntity || 'invoices',
      invoice_item_entity: invoiceCfg?.itemEntity || 'invoice_items',
      item_invoice_field: invoiceCfg?.calculationEngine?.item_invoice_field || 'invoice_id',
      item_quantity_field: invoiceCfg?.calculationEngine?.item_quantity_field || 'quantity',
      item_unit_price_field: invoiceCfg?.calculationEngine?.item_unit_price_field || 'unit_price',
      item_line_subtotal_field: invoiceCfg?.calculationEngine?.item_line_subtotal_field || 'line_subtotal',
      item_discount_type_field: invoiceCfg?.calculationEngine?.item_discount_type_field || 'line_discount_type',
      item_discount_value_field: invoiceCfg?.calculationEngine?.item_discount_value_field || 'line_discount_value',
      item_discount_total_field: invoiceCfg?.calculationEngine?.item_discount_total_field || 'line_discount_total',
      item_tax_rate_field: invoiceCfg?.calculationEngine?.item_tax_rate_field || 'line_tax_rate',
      item_tax_total_field: invoiceCfg?.calculationEngine?.item_tax_total_field || 'line_tax_total',
      item_additional_charge_field: invoiceCfg?.calculationEngine?.item_additional_charge_field || 'line_additional_charge',
      item_line_total_field: invoiceCfg?.calculationEngine?.item_line_total_field || 'line_total',
      subtotal_field: invoiceCfg?.calculationEngine?.subtotal_field || 'subtotal',
      tax_total_field: invoiceCfg?.calculationEngine?.tax_total_field || 'tax_total',
      discount_total_field: invoiceCfg?.calculationEngine?.discount_total_field || 'discount_total',
      additional_charges_field: invoiceCfg?.calculationEngine?.additional_charges_field || 'additional_charges_total',
      grand_total_field: invoiceCfg?.calculationEngine?.grand_total_field || 'grand_total',
      paid_total_field: invoiceCfg?.paidTotalField || 'paid_total',
      outstanding_field: invoiceCfg?.outstandingField || 'outstanding_balance',
    };
  },

  _buildInvoiceLifecycleMixinConfig(invoiceCfg) {
    return {
      ...(invoiceCfg?.lifecycle || {}),
      status_field: invoiceCfg?.statusField || 'status',
      statuses:
        (Array.isArray(invoiceCfg?.lifecycle?.statuses) && invoiceCfg.lifecycle.statuses.length
          ? invoiceCfg.lifecycle.statuses
          : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']),
      enforce_transitions:
        invoiceCfg?.lifecycle?.enforce_transitions !== false &&
        invoiceCfg?.lifecycle?.enforceTransitions !== false,
      transitions:
        (invoiceCfg?.lifecycle?.transitions && typeof invoiceCfg.lifecycle.transitions === 'object')
          ? invoiceCfg.lifecycle.transitions
          : {
              Draft: ['Sent', 'Cancelled'],
              Sent: ['Paid', 'Overdue', 'Cancelled'],
              Overdue: ['Paid', 'Cancelled'],
              Paid: [],
              Cancelled: [],
            },
    };
  },

  _buildHREmployeeStatusMixinConfig(hrCfg) {
    return {
      status_field: this._pickFirstString(
        hrCfg?.employeeStatus?.status_field,
        hrCfg?.employeeStatus?.statusField,
        'status'
      ),
      default_status: this._pickFirstString(
        hrCfg?.employeeStatus?.default_status,
        hrCfg?.employeeStatus?.defaultStatus,
        'Active'
      ),
      statuses:
        (Array.isArray(hrCfg?.employeeStatus?.statuses) && hrCfg.employeeStatus.statuses.length
          ? hrCfg.employeeStatus.statuses
          : ['Active', 'On Leave', 'Terminated']),
      enforce_transitions:
        hrCfg?.employeeStatus?.enforce_transitions !== false &&
        hrCfg?.employeeStatus?.enforceTransitions !== false,
      transitions:
        (hrCfg?.employeeStatus?.transitions && typeof hrCfg.employeeStatus.transitions === 'object')
          ? hrCfg.employeeStatus.transitions
          : {
              Active: ['On Leave', 'Terminated'],
              'On Leave': ['Active', 'Terminated'],
              Terminated: [],
            },
    };
  },

  _buildHRLeaveBalanceMixinConfig(hrCfg) {
    return {
      ...(hrCfg?.leaveEngine || {}),
      employee_entity: hrCfg?.employeeEntity || 'employees',
      leave_entity: hrCfg?.leaveEntity || 'leaves',
      balance_entity: hrCfg?.leaveEngine?.balance_entity || 'leave_balances',
      employee_field: hrCfg?.leaveEngine?.employee_field || 'employee_id',
      leave_type_field: hrCfg?.leaveEngine?.leave_type_field || 'leave_type',
      start_date_field: hrCfg?.leaveEngine?.start_date_field || 'start_date',
      end_date_field: hrCfg?.leaveEngine?.end_date_field || 'end_date',
      days_field: hrCfg?.leaveEngine?.days_field || 'leave_days',
      status_field: hrCfg?.leaveEngine?.status_field || 'status',
      entitlement_field: hrCfg?.leaveEngine?.entitlement_field || 'annual_entitlement',
      accrued_field: hrCfg?.leaveEngine?.accrued_field || 'accrued_days',
      consumed_field: hrCfg?.leaveEngine?.consumed_field || 'consumed_days',
      carry_forward_field: hrCfg?.leaveEngine?.carry_forward_field || 'carry_forward_days',
      available_field: hrCfg?.leaveEngine?.available_field || 'available_days',
      fiscal_year_field: hrCfg?.leaveEngine?.fiscal_year_field || 'year',
      last_accrual_at_field: hrCfg?.leaveEngine?.last_accrual_at_field || 'last_accrual_at',
      default_entitlement: Number(hrCfg?.leaveEngine?.default_entitlement || 18) || 18,
      auto_create_balance:
        hrCfg?.leaveEngine?.auto_create_balance !== false &&
        hrCfg?.leaveEngine?.autoCreateBalance !== false,
    };
  },

  _buildHRLeaveApprovalMixinConfig(hrCfg, leaveBalanceCfg = {}) {
    return {
      ...(hrCfg?.leaveApprovals || {}),
      ...(leaveBalanceCfg || {}),
      leave_entity: hrCfg?.leaveEntity || 'leaves',
      status_field: hrCfg?.leaveApprovals?.status_field || leaveBalanceCfg.status_field || 'status',
      approver_field: hrCfg?.leaveApprovals?.approver_field || 'approver_id',
      approved_at_field: hrCfg?.leaveApprovals?.approved_at_field || 'approved_at',
      rejected_at_field: hrCfg?.leaveApprovals?.rejected_at_field || 'rejected_at',
      cancelled_at_field: hrCfg?.leaveApprovals?.cancelled_at_field || 'cancelled_at',
      rejection_reason_field: hrCfg?.leaveApprovals?.rejection_reason_field || 'rejection_reason',
      decision_key_field: hrCfg?.leaveApprovals?.decision_key_field || 'decision_key',
      statuses:
        (Array.isArray(hrCfg?.leaveApprovals?.statuses) && hrCfg.leaveApprovals.statuses.length
          ? hrCfg.leaveApprovals.statuses
          : ['Pending', 'Approved', 'Rejected', 'Cancelled']),
      enforce_transitions:
        hrCfg?.leaveApprovals?.enforce_transitions !== false &&
        hrCfg?.leaveApprovals?.enforceTransitions !== false,
      consume_on_approval:
        hrCfg?.leaveApprovals?.consume_on_approval !== false &&
        hrCfg?.leaveApprovals?.consumeOnApproval !== false &&
        this._isPackEnabled(hrCfg?.leaveEngine),
      transitions:
        (hrCfg?.leaveApprovals?.transitions && typeof hrCfg.leaveApprovals.transitions === 'object')
          ? hrCfg.leaveApprovals.transitions
          : {
              Pending: ['Approved', 'Rejected', 'Cancelled'],
              Approved: ['Cancelled'],
              Rejected: [],
              Cancelled: [],
            },
    };
  },

  _buildHRAttendanceTimesheetMixinConfig(hrCfg) {
    return {
      ...(hrCfg?.attendanceTime || {}),
      employee_entity: hrCfg?.employeeEntity || 'employees',
      attendance_entity: hrCfg?.attendanceTime?.attendance_entity || 'attendance_entries',
      shift_entity: hrCfg?.attendanceTime?.shift_entity || 'shift_assignments',
      timesheet_entity: hrCfg?.attendanceTime?.timesheet_entity || 'timesheet_entries',
      attendance_employee_field: hrCfg?.attendanceTime?.attendance_employee_field || 'employee_id',
      attendance_date_field: hrCfg?.attendanceTime?.attendance_date_field || 'work_date',
      check_in_field: hrCfg?.attendanceTime?.check_in_field || 'check_in_at',
      check_out_field: hrCfg?.attendanceTime?.check_out_field || 'check_out_at',
      worked_hours_field: hrCfg?.attendanceTime?.worked_hours_field || 'worked_hours',
      attendance_status_field: hrCfg?.attendanceTime?.attendance_status_field || 'status',
      shift_employee_field: hrCfg?.attendanceTime?.shift_employee_field || 'employee_id',
      shift_start_field: hrCfg?.attendanceTime?.shift_start_field || 'start_time',
      shift_end_field: hrCfg?.attendanceTime?.shift_end_field || 'end_time',
      shift_days_field: hrCfg?.attendanceTime?.shift_days_field || 'work_days',
      shift_status_field: hrCfg?.attendanceTime?.shift_status_field || 'status',
      timesheet_employee_field: hrCfg?.attendanceTime?.timesheet_employee_field || 'employee_id',
      timesheet_date_field: hrCfg?.attendanceTime?.timesheet_date_field || 'work_date',
      timesheet_hours_field: hrCfg?.attendanceTime?.timesheet_hours_field || 'regular_hours',
      timesheet_overtime_field: hrCfg?.attendanceTime?.timesheet_overtime_field || 'overtime_hours',
      timesheet_status_field: hrCfg?.attendanceTime?.timesheet_status_field || 'status',
      timesheet_attendance_field: hrCfg?.attendanceTime?.timesheet_attendance_field || 'attendance_id',
      work_days: Array.isArray(hrCfg?.attendanceTime?.work_days) && hrCfg.attendanceTime.work_days.length
        ? hrCfg.attendanceTime.work_days
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      daily_hours: Number(hrCfg?.attendanceTime?.daily_hours || 8) || 8,
    };
  },

  _buildHRCompensationLedgerMixinConfig(hrCfg) {
    return {
      ...(hrCfg?.compensationLedger || {}),
      employee_entity: hrCfg?.employeeEntity || 'employees',
      ledger_entity: hrCfg?.compensationLedger?.ledger_entity || 'compensation_ledger',
      snapshot_entity: hrCfg?.compensationLedger?.snapshot_entity || 'compensation_snapshots',
      ledger_employee_field: hrCfg?.compensationLedger?.ledger_employee_field || 'employee_id',
      ledger_period_field: hrCfg?.compensationLedger?.ledger_period_field || 'pay_period',
      ledger_component_field: hrCfg?.compensationLedger?.ledger_component_field || 'component',
      ledger_type_field: hrCfg?.compensationLedger?.ledger_type_field || 'component_type',
      ledger_amount_field: hrCfg?.compensationLedger?.ledger_amount_field || 'amount',
      ledger_status_field: hrCfg?.compensationLedger?.ledger_status_field || 'status',
      snapshot_employee_field: hrCfg?.compensationLedger?.snapshot_employee_field || 'employee_id',
      snapshot_period_field: hrCfg?.compensationLedger?.snapshot_period_field || 'pay_period',
      snapshot_gross_field: hrCfg?.compensationLedger?.snapshot_gross_field || 'gross_amount',
      snapshot_deduction_field: hrCfg?.compensationLedger?.snapshot_deduction_field || 'deduction_amount',
      snapshot_net_field: hrCfg?.compensationLedger?.snapshot_net_field || 'net_amount',
      snapshot_status_field: hrCfg?.compensationLedger?.snapshot_status_field || 'status',
      snapshot_posted_at_field: hrCfg?.compensationLedger?.snapshot_posted_at_field || 'posted_at',
    };
  },
};
