// platform/assembler/generators/BackendGenerator.js
const fs = require('fs').promises;
const path = require('path');
const CodeWeaver = require('../CodeWeaver');
const TemplateEngine = require('../TemplateEngine');
const MixinRegistry = require('../MixinRegistry');

class BackendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
    this.modules = {};
    this.moduleMap = {};
    this._moduleDirs = new Set();
    this._standalone = false;
    const customMixinsPath =
      process.env.CUSTOM_MIXINS_PATH ||
      path.resolve(this.brickRepo.libraryPath, '..', 'custom_mixins');
    this.mixinRegistry = new MixinRegistry({
      brickLibraryPath: this.brickRepo.libraryPath,
      customMixinsPath,
    });
  }

  setModules(modules) {
    this.modules = modules && typeof modules === 'object' ? modules : {};
  }

  setModuleMap(moduleMap) {
    this.moduleMap = moduleMap && typeof moduleMap === 'object' ? moduleMap : {};
  }

  _getModuleKey(entity) {
    const raw = entity && (entity.module || entity.module_slug || entity.moduleSlug);
    const cleaned = String(raw || 'inventory').trim().toLowerCase();
    return cleaned || 'inventory';
  }

  _pickFirstString(...values) {
    for (const value of values) {
      const str = String(value || '').trim();
      if (str) return str;
    }
    return '';
  }

  _isPackEnabled(packCfg) {
    if (packCfg === true) return true;
    if (packCfg === false || packCfg === null || packCfg === undefined) return false;
    if (typeof packCfg === 'object') return packCfg.enabled !== false;
    return false;
  }

  _getInventoryPriorityAConfig() {
    const inventory =
      this.modules && this.modules.inventory && typeof this.modules.inventory === 'object'
        ? this.modules.inventory
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
        purchase_order_entity: 'purchase_orders',
        purchase_order_item_entity: 'purchase_order_items',
        grn_entity: 'goods_receipts',
        grn_item_entity: 'goods_receipt_items',
        po_item_parent_field: 'purchase_order_id',
        po_item_item_field: 'item_id',
        po_item_ordered_field: 'ordered_quantity',
        po_item_received_field: 'received_quantity',
        po_item_status_field: 'status',
        po_status_field: 'status',
        grn_parent_field: 'purchase_order_id',
        grn_item_parent_field: 'goods_receipt_id',
        grn_item_po_item_field: 'purchase_order_item_id',
        grn_item_item_field: 'item_id',
        grn_item_received_field: 'received_quantity',
        grn_item_accepted_field: 'accepted_quantity',
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
        session_status_field: 'status',
      }
    );

    const stockEntity = this._pickFirstString(
      inventory.stock_entity,
      inventory.stockEntity,
      reservations.stock_entity,
      reservations.stockEntity,
      transactions.stock_entity,
      transactions.stockEntity,
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
      reservations.reservation_quantity_field,
      reservations.reservationQuantityField,
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

    inbound.purchase_order_entity = this._pickFirstString(
      inbound.purchase_order_entity,
      inbound.purchaseOrderEntity,
      'purchase_orders'
    );
    inbound.purchase_order_item_entity = this._pickFirstString(
      inbound.purchase_order_item_entity,
      inbound.purchaseOrderItemEntity,
      'purchase_order_items'
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
    inbound.po_item_parent_field = this._pickFirstString(
      inbound.po_item_parent_field,
      inbound.poItemParentField,
      'purchase_order_id'
    );
    inbound.po_item_item_field = this._pickFirstString(
      inbound.po_item_item_field,
      inbound.poItemItemField,
      'item_id'
    );
    inbound.po_item_ordered_field = this._pickFirstString(
      inbound.po_item_ordered_field,
      inbound.poItemOrderedField,
      'ordered_quantity'
    );
    inbound.po_item_received_field = this._pickFirstString(
      inbound.po_item_received_field,
      inbound.poItemReceivedField,
      'received_quantity'
    );
    inbound.po_item_status_field = this._pickFirstString(
      inbound.po_item_status_field,
      inbound.poItemStatusField,
      'status'
    );
    inbound.po_status_field = this._pickFirstString(
      inbound.po_status_field,
      inbound.poStatusField,
      'status'
    );
    inbound.grn_parent_field = this._pickFirstString(
      inbound.grn_parent_field,
      inbound.grnParentField,
      'purchase_order_id'
    );
    inbound.grn_item_parent_field = this._pickFirstString(
      inbound.grn_item_parent_field,
      inbound.grnItemParentField,
      'goods_receipt_id'
    );
    inbound.grn_item_po_item_field = this._pickFirstString(
      inbound.grn_item_po_item_field,
      inbound.grnItemPoItemField,
      'purchase_order_item_id'
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
    inbound.grn_item_accepted_field = this._pickFirstString(
      inbound.grn_item_accepted_field,
      inbound.grnItemAcceptedField,
      'accepted_quantity'
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
    cycleCounting.session_status_field = this._pickFirstString(
      cycleCounting.session_status_field,
      cycleCounting.sessionStatusField,
      'status'
    );

    return {
      stockEntity,
      reservations,
      transactions,
      inbound,
      cycleCounting,
      reservationEntity: reservations.reservation_entity,
    };
  }

  _getInvoicePriorityAConfig() {
    const invoice =
      this.modules && this.modules.invoice && typeof this.modules.invoice === 'object'
        ? this.modules.invoice
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
        invoice_item_entity: 'invoice_items',
        invoice_number_field: 'invoice_number',
        idempotency_field: 'idempotency_key',
        posted_at_field: 'posted_at',
      }
    );
    const payments = normalizePack(
      invoice.payments || invoice.payment,
      {
        payment_entity: 'invoice_payments',
        allocation_entity: 'invoice_payment_allocations',
        payment_number_field: 'payment_number',
        payment_customer_field: 'customer_id',
        payment_date_field: 'payment_date',
        payment_method_field: 'payment_method',
        amount_field: 'amount',
        unallocated_field: 'unallocated_amount',
        status_field: 'status',
        allocation_payment_field: 'payment_id',
        allocation_invoice_field: 'invoice_id',
        allocation_amount_field: 'amount',
        allocation_date_field: 'allocated_at',
      }
    );
    const notes = normalizePack(
      invoice.notes || invoice.credit_debit_notes || invoice.creditDebitNotes,
      {
        note_entity: 'invoice_notes',
        note_number_field: 'note_number',
        note_invoice_field: 'source_invoice_id',
        note_type_field: 'note_type',
        note_status_field: 'status',
        note_amount_field: 'amount',
        note_tax_total_field: 'tax_total',
        note_grand_total_field: 'grand_total',
        note_posted_at_field: 'posted_at',
      }
    );
    const lifecycle = normalizePack(
      invoice.lifecycle || invoice.invoice_lifecycle || invoice.invoiceLifecycle,
      {
        status_field: 'status',
        statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
        enforce_transitions: true,
      }
    );
    const calculationEngine = normalizePack(
      invoice.calculation_engine || invoice.calculationEngine || invoice.pricing_engine || invoice.pricingEngine,
      {
        invoice_item_entity: 'invoice_items',
        item_invoice_field: 'invoice_id',
        item_quantity_field: 'quantity',
        item_unit_price_field: 'unit_price',
        item_line_subtotal_field: 'line_subtotal',
        item_discount_type_field: 'line_discount_type',
        item_discount_value_field: 'line_discount_value',
        item_discount_total_field: 'line_discount_total',
        item_tax_rate_field: 'line_tax_rate',
        item_tax_total_field: 'line_tax_total',
        item_additional_charge_field: 'line_additional_charge',
        item_line_total_field: 'line_total',
        subtotal_field: 'subtotal',
        tax_total_field: 'tax_total',
        discount_total_field: 'discount_total',
        additional_charges_field: 'additional_charges_total',
        grand_total_field: 'grand_total',
      }
    );

    const invoiceEntity = this._pickFirstString(
      invoice.invoice_entity,
      invoice.invoiceEntity,
      transactions.invoice_entity,
      transactions.invoiceEntity,
      'invoices'
    );
    const itemEntity = this._pickFirstString(
      invoice.invoice_item_entity,
      invoice.invoiceItemEntity,
      transactions.invoice_item_entity,
      transactions.invoiceItemEntity,
      calculationEngine.invoice_item_entity,
      calculationEngine.invoiceItemEntity,
      'invoice_items'
    );

    const statusField = this._pickFirstString(
      lifecycle.status_field,
      lifecycle.statusField,
      'status'
    );
    const grandTotalField = this._pickFirstString(
      calculationEngine.grand_total_field,
      calculationEngine.grandTotalField,
      'grand_total'
    );
    const paidTotalField = this._pickFirstString(
      invoice.paid_total_field,
      invoice.paidTotalField,
      'paid_total'
    );
    const outstandingField = this._pickFirstString(
      invoice.outstanding_balance_field,
      invoice.outstandingBalanceField,
      'outstanding_balance'
    );

    transactions.invoice_entity = this._pickFirstString(
      transactions.invoice_entity,
      transactions.invoiceEntity,
      invoiceEntity
    );
    transactions.invoice_item_entity = this._pickFirstString(
      transactions.invoice_item_entity,
      transactions.invoiceItemEntity,
      itemEntity
    );
    transactions.invoice_number_field = this._pickFirstString(
      transactions.invoice_number_field,
      transactions.invoiceNumberField,
      'invoice_number'
    );
    transactions.idempotency_field = this._pickFirstString(
      transactions.idempotency_field,
      transactions.idempotencyField,
      'idempotency_key'
    );
    transactions.posted_at_field = this._pickFirstString(
      transactions.posted_at_field,
      transactions.postedAtField,
      'posted_at'
    );
    transactions.status_field = this._pickFirstString(
      transactions.status_field,
      transactions.statusField,
      statusField
    );
    transactions.grand_total_field = this._pickFirstString(
      transactions.grand_total_field,
      transactions.grandTotalField,
      grandTotalField
    );
    transactions.paid_total_field = this._pickFirstString(
      transactions.paid_total_field,
      transactions.paidTotalField,
      paidTotalField
    );
    transactions.outstanding_field = this._pickFirstString(
      transactions.outstanding_field,
      transactions.outstandingField,
      outstandingField
    );

    payments.payment_entity = this._pickFirstString(
      payments.payment_entity,
      payments.paymentEntity,
      'invoice_payments'
    );
    payments.allocation_entity = this._pickFirstString(
      payments.allocation_entity,
      payments.allocationEntity,
      'invoice_payment_allocations'
    );
    payments.payment_number_field = this._pickFirstString(
      payments.payment_number_field,
      payments.paymentNumberField,
      'payment_number'
    );
    payments.payment_customer_field = this._pickFirstString(
      payments.payment_customer_field,
      payments.paymentCustomerField,
      'customer_id'
    );
    payments.payment_date_field = this._pickFirstString(
      payments.payment_date_field,
      payments.paymentDateField,
      'payment_date'
    );
    payments.payment_method_field = this._pickFirstString(
      payments.payment_method_field,
      payments.paymentMethodField,
      'payment_method'
    );
    payments.amount_field = this._pickFirstString(
      payments.amount_field,
      payments.amountField,
      'amount'
    );
    payments.unallocated_field = this._pickFirstString(
      payments.unallocated_field,
      payments.unallocatedField,
      'unallocated_amount'
    );
    payments.status_field = this._pickFirstString(
      payments.status_field,
      payments.statusField,
      'status'
    );
    payments.allocation_payment_field = this._pickFirstString(
      payments.allocation_payment_field,
      payments.allocationPaymentField,
      'payment_id'
    );
    payments.allocation_invoice_field = this._pickFirstString(
      payments.allocation_invoice_field,
      payments.allocationInvoiceField,
      'invoice_id'
    );
    payments.allocation_amount_field = this._pickFirstString(
      payments.allocation_amount_field,
      payments.allocationAmountField,
      'amount'
    );
    payments.allocation_date_field = this._pickFirstString(
      payments.allocation_date_field,
      payments.allocationDateField,
      'allocated_at'
    );

    notes.note_entity = this._pickFirstString(
      notes.note_entity,
      notes.noteEntity,
      'invoice_notes'
    );
    notes.note_number_field = this._pickFirstString(
      notes.note_number_field,
      notes.noteNumberField,
      'note_number'
    );
    notes.note_invoice_field = this._pickFirstString(
      notes.note_invoice_field,
      notes.noteInvoiceField,
      'source_invoice_id'
    );
    notes.note_type_field = this._pickFirstString(
      notes.note_type_field,
      notes.noteTypeField,
      'note_type'
    );
    notes.note_status_field = this._pickFirstString(
      notes.note_status_field,
      notes.noteStatusField,
      'status'
    );
    notes.note_amount_field = this._pickFirstString(
      notes.note_amount_field,
      notes.noteAmountField,
      'amount'
    );
    notes.note_tax_total_field = this._pickFirstString(
      notes.note_tax_total_field,
      notes.noteTaxTotalField,
      'tax_total'
    );
    notes.note_grand_total_field = this._pickFirstString(
      notes.note_grand_total_field,
      notes.noteGrandTotalField,
      'grand_total'
    );
    notes.note_posted_at_field = this._pickFirstString(
      notes.note_posted_at_field,
      notes.notePostedAtField,
      'posted_at'
    );

    lifecycle.status_field = statusField;
    lifecycle.statuses = Array.isArray(lifecycle.statuses) && lifecycle.statuses.length
      ? lifecycle.statuses
      : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
    lifecycle.enforce_transitions =
      lifecycle.enforce_transitions !== false &&
      lifecycle.enforceTransitions !== false;
    lifecycle.transitions =
      lifecycle.transitions && typeof lifecycle.transitions === 'object'
        ? lifecycle.transitions
        : {
            Draft: ['Sent', 'Cancelled'],
            Sent: ['Paid', 'Overdue', 'Cancelled'],
            Overdue: ['Paid', 'Cancelled'],
            Paid: [],
            Cancelled: [],
          };

    calculationEngine.invoice_item_entity = this._pickFirstString(
      calculationEngine.invoice_item_entity,
      calculationEngine.invoiceItemEntity,
      itemEntity
    );
    calculationEngine.item_invoice_field = this._pickFirstString(
      calculationEngine.item_invoice_field,
      calculationEngine.itemInvoiceField,
      'invoice_id'
    );
    calculationEngine.item_quantity_field = this._pickFirstString(
      calculationEngine.item_quantity_field,
      calculationEngine.itemQuantityField,
      'quantity'
    );
    calculationEngine.item_unit_price_field = this._pickFirstString(
      calculationEngine.item_unit_price_field,
      calculationEngine.itemUnitPriceField,
      'unit_price'
    );
    calculationEngine.item_line_subtotal_field = this._pickFirstString(
      calculationEngine.item_line_subtotal_field,
      calculationEngine.itemLineSubtotalField,
      'line_subtotal'
    );
    calculationEngine.item_discount_type_field = this._pickFirstString(
      calculationEngine.item_discount_type_field,
      calculationEngine.itemDiscountTypeField,
      'line_discount_type'
    );
    calculationEngine.item_discount_value_field = this._pickFirstString(
      calculationEngine.item_discount_value_field,
      calculationEngine.itemDiscountValueField,
      'line_discount_value'
    );
    calculationEngine.item_discount_total_field = this._pickFirstString(
      calculationEngine.item_discount_total_field,
      calculationEngine.itemDiscountTotalField,
      'line_discount_total'
    );
    calculationEngine.item_tax_rate_field = this._pickFirstString(
      calculationEngine.item_tax_rate_field,
      calculationEngine.itemTaxRateField,
      'line_tax_rate'
    );
    calculationEngine.item_tax_total_field = this._pickFirstString(
      calculationEngine.item_tax_total_field,
      calculationEngine.itemTaxTotalField,
      'line_tax_total'
    );
    calculationEngine.item_additional_charge_field = this._pickFirstString(
      calculationEngine.item_additional_charge_field,
      calculationEngine.itemAdditionalChargeField,
      'line_additional_charge'
    );
    calculationEngine.item_line_total_field = this._pickFirstString(
      calculationEngine.item_line_total_field,
      calculationEngine.itemLineTotalField,
      'line_total'
    );
    calculationEngine.subtotal_field = this._pickFirstString(
      calculationEngine.subtotal_field,
      calculationEngine.subtotalField,
      'subtotal'
    );
    calculationEngine.tax_total_field = this._pickFirstString(
      calculationEngine.tax_total_field,
      calculationEngine.taxTotalField,
      'tax_total'
    );
    calculationEngine.discount_total_field = this._pickFirstString(
      calculationEngine.discount_total_field,
      calculationEngine.discountTotalField,
      'discount_total'
    );
    calculationEngine.additional_charges_field = this._pickFirstString(
      calculationEngine.additional_charges_field,
      calculationEngine.additionalChargesField,
      'additional_charges_total'
    );
    calculationEngine.grand_total_field = this._pickFirstString(
      calculationEngine.grand_total_field,
      calculationEngine.grandTotalField,
      grandTotalField
    );

    return {
      invoiceEntity,
      itemEntity,
      statusField,
      grandTotalField,
      paidTotalField,
      outstandingField,
      transactions,
      payments,
      notes,
      lifecycle,
      calculationEngine,
    };
  }

  _getHRPriorityAConfig() {
    const hr =
      this.modules && this.modules.hr && typeof this.modules.hr === 'object'
        ? this.modules.hr
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
    leaveApprovals.transitions =
      leaveApprovals.transitions && typeof leaveApprovals.transitions === 'object'
        ? leaveApprovals.transitions
        : {
            Pending: ['Approved', 'Rejected', 'Cancelled'],
            Approved: ['Cancelled'],
            Rejected: [],
            Cancelled: [],
          };

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
  }

  async _ensureModuleDirs(outputDir, moduleKey) {
    if (this._moduleDirs.has(moduleKey)) return;

    const moduleRoot = path.join(outputDir, 'modules', moduleKey);
    const dirs = [
      'src/controllers',
      'src/routes',
      'src/services',
      'src/repository',
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(moduleRoot, dir), { recursive: true });
    }

    if (this._standalone) {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/SQLiteProvider.js',
        path.join(moduleRoot, 'src/repository/SQLiteProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/sqliteDb.js',
        path.join(moduleRoot, 'src/repository/sqliteDb.js')
      );
    } else {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/PostgresProvider.js',
        path.join(moduleRoot, 'src/repository/PostgresProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/db.js',
        path.join(moduleRoot, 'src/repository/db.js')
      );
    }

    this._moduleDirs.add(moduleKey);
  }

  async scaffold(outputDir, projectId, options = {}) {
    this._moduleDirs = new Set();
    this._standalone = !!options.standalone;

    const dirs = [
      'src/controllers',
      'src/routes',
      'src/services',
      'src/repository',
      'modules'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(outputDir, dir), { recursive: true });
    }

    await this._generateBaseFiles(outputDir, projectId);

    if (this._standalone) {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/SQLiteProvider.js',
        path.join(outputDir, 'src/repository/SQLiteProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/sqliteDb.js',
        path.join(outputDir, 'src/repository/sqliteDb.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/runSQLiteMigrations.js',
        path.join(outputDir, 'src/repository/runSQLiteMigrations.js')
      );
    } else {
      await this.brickRepo.copyFile(
        'backend-bricks/repository/PostgresProvider.js',
        path.join(outputDir, 'src/repository/PostgresProvider.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/db.js',
        path.join(outputDir, 'src/repository/db.js')
      );
      await this.brickRepo.copyFile(
        'backend-bricks/repository/runMigrations.js',
        path.join(outputDir, 'src/repository/runMigrations.js')
      );
    }
  }

  async _generateBaseFiles(outputDir, projectId) {
    console.log(`  Using ${this._standalone ? 'standalone' : 'docker'} templates`);
    const files = this._standalone
      ? [
          { template: 'standalone/package.json.template', dest: 'package.json' },
        ]
      : [
          { template: 'package.json.template', dest: 'package.json' },
          { template: 'Dockerfile.template', dest: 'Dockerfile' },
          { template: 'docker-compose.template.yml', dest: 'docker-compose.yml' },
          { template: 'README.template.md', dest: 'README.md' },
        ];

    for (const file of files) {
      const template = await this.brickRepo.getTemplate(file.template);
      const content = TemplateEngine.render(template, { projectId });
      await fs.writeFile(path.join(outputDir, file.dest), content);
    }

    if (this._standalone) {
      await fs.writeFile(path.join(outputDir, '.standalone'), 'true\n');
    }
  }

  async generateEntity(outputDir, entity, allEntities = []) {
    const moduleKey = this._getModuleKey(entity);
    await this._ensureModuleDirs(outputDir, moduleKey);
    const moduleRoot = path.join(outputDir, 'modules', moduleKey);
    const moduleSrcDir = path.join(moduleRoot, 'src');

    const mixinsToApply = await this._resolveMixins(entity, allEntities);
    const effectiveMixinConfig = this._buildEffectiveMixinConfig(entity, mixinsToApply);

    const context = {
      EntityName: this._capitalize(entity.slug),
      entitySlug: entity.slug,
      mixinConfig: JSON.stringify(effectiveMixinConfig),
      ProviderName: this._standalone ? 'SQLiteProvider' : 'PostgresProvider',
    };

    // 1. Generate Controller (Using BaseController template)
    const controllerTemplate = await this.brickRepo.getTemplate('BaseController.js.hbs');
    // Note: We use TemplateEngine here because Controller structure is simpler and mostly static replacements
    // CodeWeaver is primarily for Service logic injection
    const controllerContent = TemplateEngine.render(controllerTemplate, context);
    await fs.writeFile(
      path.join(moduleSrcDir, `controllers/${context.EntityName}Controller.js`),
      controllerContent
    );

    // 2. Generate Service (The complex part with Mixins)
    await this._generateService(moduleSrcDir, entity, context, allEntities, mixinsToApply);

    // 3. Generate Route File
    await this._generateEntityRoute(moduleSrcDir, entity, context);
  }

  async _generateService(moduleSrcDir, entity, context, allEntities = [], mixinsToApply = null) {
    // Load BaseService template
    const serviceTemplate = await this.brickRepo.getTemplate('BaseService.js.hbs');

    // Initialize CodeWeaver with the template
    const weaver = new CodeWeaver(serviceTemplate);

    // Determine Mixins to apply based on features
    const resolvedMixins = Array.isArray(mixinsToApply)
      ? mixinsToApply
      : await this._resolveMixins(entity, allEntities);

    // Apply Mixins
    for (const mixinEntry of resolvedMixins) {
      await this._applyMixin(weaver, mixinEntry, { entity, allEntities });
    }

    // Inject schema-driven validation and reference integrity rules
    this._injectSchemaValidations(weaver, entity, allEntities);

    // Render placeholders (EntityName, entitySlug) AFTER weaving logic
    let finalContent = weaver.getContent();
    finalContent = TemplateEngine.render(finalContent, context);

    await fs.writeFile(
      path.join(moduleSrcDir, `services/${context.EntityName}Service.js`),
      finalContent
    );
  }

  async _resolveMixins(entity, allEntities = []) {
    const features = entity.features || {};
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    const moduleKey = this._getModuleKey(entity);
    const slug = String(entity && entity.slug ? entity.slug : '');
    const inventoryCfg = this._getInventoryPriorityAConfig();
    const transactionsCfg = this._buildInventoryTransactionMixinConfig(entity, inventoryCfg);
    const reservationsCfg = this._buildInventoryReservationMixinConfig(inventoryCfg, transactionsCfg);
    const inboundCfg = this._buildInventoryInboundMixinConfig(inventoryCfg, transactionsCfg);
    const cycleCfg = this._buildInventoryCycleMixinConfig(inventoryCfg, transactionsCfg);
    const stockSlug = String(inventoryCfg.stockEntity || '');
    const reservationSlug = String(inventoryCfg.reservationEntity || '');
    const inboundGrnSlug = String(inventoryCfg.inbound?.grn_entity || '');
    const cycleSessionSlug = String(inventoryCfg.cycleCounting?.session_entity || '');
    const cycleLineSlug = String(inventoryCfg.cycleCounting?.line_entity || '');

    const hasConfiguredQuantityField = fields.some(
      (f) => f && f.name === transactionsCfg.quantity_field
    );

    // IMPORTANT: Mixins must be optional.
    // We only apply InventoryMixin when the entity actually has inventory-like behavior,
    // otherwise we would accidentally add "quantity" to unrelated entities (e.g., Categories).
    const hasQuantityField = fields.some(f => f && f.name === 'quantity');
    const wantsInventoryBehavior =
      moduleKey === 'inventory' &&
      (!!hasQuantityField ||
        !!hasConfiguredQuantityField ||
        !!features.inventory ||
        !!features.stock_tracking ||
        !!features.batch_tracking ||
        !!features.serial_tracking ||
        !!features.multi_location);

    const mixins = new Map();

    const addMixin = (name, config = {}, source = 'features') => {
      const resolved = this.mixinRegistry.resolveName(name);
      const existing = mixins.get(resolved);
      if (!existing) {
        mixins.set(resolved, { name: resolved, config, source, enabled: true });
        return;
      }
      mixins.set(resolved, {
        ...existing,
        config: { ...existing.config, ...config },
      });
    };

    const removeMixin = (name) => {
      const resolved = this.mixinRegistry.resolveName(name);
      mixins.delete(resolved);
    };

    if (wantsInventoryBehavior) addMixin('InventoryMixin');

    if (features.batch_tracking) addMixin('BatchTrackingMixin');
    if (features.serial_tracking) addMixin('SerialTrackingMixin');
    // Audit trail:
    // - If entity.features.audit_trail is explicitly set (true/false), respect it.
    // - Otherwise, if modules.activity_log.enabled is true, audit ALL non-system entities by default
    //   (or only the listed entity slugs if modules.activity_log.entities is provided).
    const isSystemEntity = slug.startsWith('__') || (entity && entity.system && entity.system.hidden);

    let auditEnabled = false;
    if (!isSystemEntity) {
      const hasAuditFlag = Object.prototype.hasOwnProperty.call(features, 'audit_trail');
      if (hasAuditFlag) {
        auditEnabled = features.audit_trail === true;
      } else {
        const activity = (this.modules && (this.modules.activity_log || this.modules.activityLog)) || {};
        if (activity.enabled === true) {
          const list = Array.isArray(activity.entities) ? activity.entities : [];
          auditEnabled = list.length ? list.includes(slug) : true;
        }
      }
    }

    if (auditEnabled) addMixin('AuditMixin');
    if (features.multi_location) addMixin('LocationMixin');

    if (moduleKey === 'inventory') {
      addMixin('InventoryLifecycleMixin');
      const reservationsEnabled = this._isPackEnabled(inventoryCfg.reservations);
      const transactionsEnabled = this._isPackEnabled(inventoryCfg.transactions);
      const inboundEnabled = this._isPackEnabled(inventoryCfg.inbound);
      const cycleEnabled = this._isPackEnabled(inventoryCfg.cycleCounting);

      const hasReservationFields = fields.some((f) => {
        const fieldName = String((f && f.name) || '');
        return (
          fieldName === reservationsCfg.reserved_field ||
          fieldName === reservationsCfg.committed_field ||
          fieldName === reservationsCfg.available_field
        );
      });

      if (reservationsEnabled || hasReservationFields) {
        addMixin('InventoryReservationMixin', reservationsCfg, 'modules');
      }

      if (transactionsEnabled && slug === stockSlug) {
        addMixin('InventoryTransactionSafetyMixin', transactionsCfg, 'modules');
      }

      if (reservationsEnabled && slug === stockSlug) {
        addMixin('InventoryReservationWorkflowMixin', reservationsCfg, 'modules');
      }

      if (inboundEnabled && slug === inboundGrnSlug) {
        addMixin('InventoryInboundWorkflowMixin', inboundCfg, 'modules');
      }

      if (cycleEnabled && slug === cycleSessionSlug) {
        addMixin('InventoryCycleCountWorkflowMixin', cycleCfg, 'modules');
      }

      if (cycleEnabled && slug === cycleLineSlug) {
        addMixin('InventoryCycleCountLineMixin', cycleCfg, 'modules');
      }

      if (slug === reservationSlug && reservationsEnabled) {
        addMixin('InventoryLifecycleMixin', {
          status_field: reservationsCfg.status_field,
          statuses: ['Pending', 'Released', 'Committed', 'Cancelled'],
          enforce_transitions: true,
          transitions: {
            Pending: ['Released', 'Committed', 'Cancelled'],
            Released: [],
            Committed: [],
            Cancelled: [],
          },
        }, 'modules');
      }
    }

    const invoiceModuleConfig = (this.modules && this.modules.invoice && typeof this.modules.invoice === 'object')
      ? this.modules.invoice
      : {};
    const invoicePriorityCfg = this._getInvoicePriorityAConfig();
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);
    const invoiceLifecycleEnabled = this._isPackEnabled(invoicePriorityCfg.lifecycle);
    const invoiceCalcEnabled = this._isPackEnabled(invoicePriorityCfg.calculationEngine);
    const invoiceTxnCfg = this._buildInvoiceTransactionMixinConfig(invoicePriorityCfg, invoiceModuleConfig);
    const invoicePaymentCfg = this._buildInvoicePaymentMixinConfig(invoicePriorityCfg, invoiceTxnCfg);
    const invoiceNoteCfg = this._buildInvoiceNoteMixinConfig(invoicePriorityCfg, invoiceTxnCfg);
    const invoiceCalcCfg = this._buildInvoiceCalculationMixinConfig(invoicePriorityCfg);
    const invoiceLifecycleCfg = this._buildInvoiceLifecycleMixinConfig(invoicePriorityCfg);
    const invoiceSlug = String(invoicePriorityCfg.invoiceEntity || 'invoices');
    const invoiceItemSlug = String(invoicePriorityCfg.itemEntity || 'invoice_items');
    const invoicePaymentSlug = String(invoicePriorityCfg.payments?.payment_entity || 'invoice_payments');
    const invoiceNoteSlug = String(invoicePriorityCfg.notes?.note_entity || 'invoice_notes');
    const hrPriorityCfg = this._getHRPriorityAConfig();
    const hrLeaveEngineEnabled = this._isPackEnabled(hrPriorityCfg.leaveEngine);
    const hrLeaveApprovalsEnabled = this._isPackEnabled(hrPriorityCfg.leaveApprovals);
    const hrAttendanceEnabled = this._isPackEnabled(hrPriorityCfg.attendanceTime);
    const hrCompensationEnabled = this._isPackEnabled(hrPriorityCfg.compensationLedger);
    const hrEmployeeSlug = String(hrPriorityCfg.employeeEntity || 'employees');
    const hrDepartmentSlug = String(hrPriorityCfg.departmentEntity || 'departments');
    const hrLeaveSlug = String(hrPriorityCfg.leaveEntity || 'leaves');
    const hrLeaveBalanceSlug = String(hrPriorityCfg.leaveEngine?.balance_entity || 'leave_balances');
    const hrAttendanceSlug = String(hrPriorityCfg.attendanceTime?.attendance_entity || 'attendance_entries');
    const hrShiftSlug = String(hrPriorityCfg.attendanceTime?.shift_entity || 'shift_assignments');
    const hrTimesheetSlug = String(hrPriorityCfg.attendanceTime?.timesheet_entity || 'timesheet_entries');
    const hrLedgerSlug = String(hrPriorityCfg.compensationLedger?.ledger_entity || 'compensation_ledger');
    const hrSnapshotSlug = String(hrPriorityCfg.compensationLedger?.snapshot_entity || 'compensation_snapshots');
    const hrEmployeeStatusCfg = this._buildHREmployeeStatusMixinConfig(hrPriorityCfg);
    const hrLeaveBalanceCfg = this._buildHRLeaveBalanceMixinConfig(hrPriorityCfg);
    const hrLeaveApprovalCfg = this._buildHRLeaveApprovalMixinConfig(hrPriorityCfg, hrLeaveBalanceCfg);
    const hrAttendanceCfg = this._buildHRAttendanceTimesheetMixinConfig(hrPriorityCfg);
    const hrCompensationCfg = this._buildHRCompensationLedgerMixinConfig(hrPriorityCfg);

    if (moduleKey === 'invoice' && slug === invoiceSlug) {
      addMixin(
        'InvoiceMixin',
        {
          ...invoiceModuleConfig,
          use_calculation_engine: invoiceCalcEnabled,
          calculation_engine_enabled: invoiceCalcEnabled,
          auto_number_mode: invoiceTransactionsEnabled ? 'workflow' : 'create',
          status_field: invoiceLifecycleCfg.status_field,
          statuses: invoiceLifecycleCfg.statuses,
        },
        'modules'
      );
      addMixin(
        'InvoiceLifecycleMixin',
        invoiceLifecycleEnabled ? invoiceLifecycleCfg : {},
        'modules'
      );
      if (invoiceTransactionsEnabled) {
        addMixin('InvoiceTransactionSafetyMixin', invoiceTxnCfg, 'modules');
      }
      if (invoicePaymentsEnabled) {
        addMixin('InvoicePaymentWorkflowMixin', invoicePaymentCfg, 'modules');
      }
      if (invoiceNotesEnabled) {
        addMixin('InvoiceNoteWorkflowMixin', invoiceNoteCfg, 'modules');
      }
    }
    if (moduleKey === 'invoice' && slug === invoiceItemSlug) {
      if (invoiceCalcEnabled) {
        addMixin('InvoiceCalculationEngineMixin', invoiceCalcCfg, 'modules');
      } else {
        addMixin('InvoiceItemsMixin', invoiceModuleConfig, 'modules');
      }
    }
    if (moduleKey === 'invoice' && slug === invoicePaymentSlug && invoicePaymentsEnabled) {
      addMixin('InvoicePaymentWorkflowMixin', invoicePaymentCfg, 'modules');
    }
    if (moduleKey === 'invoice' && slug === invoiceNoteSlug && invoiceNotesEnabled) {
      addMixin('InvoiceNoteWorkflowMixin', invoiceNoteCfg, 'modules');
    }

    const isHrModule = moduleKey === 'hr' || moduleKey === 'shared';
    if (isHrModule && slug === hrEmployeeSlug) {
      addMixin('HREmployeeMixin', hrEmployeeStatusCfg, 'modules');
      addMixin('HREmployeeStatusMixin', hrEmployeeStatusCfg, 'modules');
      if (hrLeaveEngineEnabled) {
        addMixin('HRLeaveBalanceMixin', hrLeaveBalanceCfg, 'modules');
      }
    }
    if (moduleKey === 'hr' && slug === hrDepartmentSlug) {
      addMixin('HRDepartmentMixin', {}, 'modules');
    }
    if (moduleKey === 'hr' && slug === hrLeaveSlug) {
      addMixin('HRLeaveMixin', hrLeaveBalanceCfg, 'modules');
      if (hrLeaveEngineEnabled) {
        addMixin('HRLeaveBalanceMixin', hrLeaveBalanceCfg, 'modules');
      }
      if (hrLeaveApprovalsEnabled) {
        addMixin('HRLeaveApprovalMixin', hrLeaveApprovalCfg, 'modules');
      }
    }
    if (moduleKey === 'hr' && hrLeaveEngineEnabled && slug === hrLeaveBalanceSlug) {
      addMixin('HRLeaveBalanceMixin', hrLeaveBalanceCfg, 'modules');
    }
    if (moduleKey === 'hr' && hrAttendanceEnabled && (slug === hrAttendanceSlug || slug === hrShiftSlug || slug === hrTimesheetSlug)) {
      addMixin('HRAttendanceTimesheetMixin', hrAttendanceCfg, 'modules');
    }
    if (moduleKey === 'hr' && hrCompensationEnabled && (slug === hrLedgerSlug || slug === hrSnapshotSlug)) {
      addMixin('HRCompensationLedgerMixin', hrCompensationCfg, 'modules');
    }

    const explicitMixins = this._normalizeExplicitMixins(entity);
    for (const entry of explicitMixins) {
      if (entry.enabled === false) {
        removeMixin(entry.name);
        continue;
      }
      addMixin(entry.name, entry.config, 'explicit');
    }

    const ordered = await this._orderMixins(Array.from(mixins.values()), { entity, allEntities });
    return ordered;
  }

  async _applyMixin(weaver, mixinEntry, { entity, allEntities }) {
    const mixinName = mixinEntry.name;
    const context = {
      entity,
      allEntities,
      modules: this.modules,
      mixinName,
    };

    try {
      const mixin = await this.mixinRegistry.loadMixin(mixinName, mixinEntry.config || {}, context);

      if (mixin.hooks) {
        for (const [hookName, code] of Object.entries(mixin.hooks)) {
          weaver.inject(hookName, this._wrapHookCode(code));
        }
      }

      if (mixin.methods) {
        const content = weaver.getContent();
        if (content.includes('// @HOOK: ADDITIONAL_METHODS')) {
          weaver.inject('ADDITIONAL_METHODS', mixin.methods);
        } else {
          const lastBraceIndex = content.lastIndexOf('}');
          if (lastBraceIndex !== -1) {
            const newContent = content.substring(0, lastBraceIndex) +
              `\n  ${mixin.methods}\n` +
              content.substring(lastBraceIndex);
            weaver.content = newContent;
          }
        }
      }
    } catch (err) {
      throw new Error(`Failed to apply mixin ${mixinName}: ${err.message || err}`);
    }
  }

  _normalizeExplicitMixins(entity) {
    const raw = entity && entity.mixins;
    if (!raw) return [];

    const normalizeEntry = (name, cfg) => {
      const config = typeof cfg === 'object' && cfg !== null ? { ...cfg } : {};
      const enabled = cfg === false ? false : (config.enabled !== false);
      delete config.enabled;
      return { name, config, enabled };
    };

    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          if (typeof item === 'string') return normalizeEntry(item, {});
          if (item && typeof item === 'object') {
            const name = item.name || item.mixin || item.id;
            if (!name) return null;
            return normalizeEntry(name, item);
          }
          return null;
        })
        .filter(Boolean);
    }

    if (raw && typeof raw === 'object') {
      return Object.entries(raw).map(([name, cfg]) => normalizeEntry(name, cfg));
    }

    return [];
  }

  _wrapHookCode(code) {
    const raw = String(code || '').replace(/\r\n/g, '\n').trim();
    if (!raw) return '';
    const body = raw
      .split('\n')
      .map((line) => `      ${line}`)
      .join('\n');
    return `\n      {\n${body}\n      }\n`;
  }

  _buildEffectiveMixinConfig(entity, mixinsToApply = []) {
    const out = {};
    const raw = entity && entity.mixins ? entity.mixins : null;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [key, value] of Object.entries(raw)) {
        if (!key) continue;
        if (value === false) continue;
        if (value && typeof value === 'object') {
          const cfg = { ...value };
          delete cfg.enabled;
          out[key] = cfg;
        } else {
          out[key] = {};
        }
      }
    }

    for (const entry of mixinsToApply || []) {
      if (!entry || !entry.name) continue;
      const name = String(entry.name);
      const cfg = entry.config && typeof entry.config === 'object' ? entry.config : {};
      const compact = name.replace(/Mixin$/i, '');
      const snake = compact.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      const camel = snake.replace(/_([a-z])/g, (_, chr) => chr.toUpperCase());

      out[name] = { ...cfg };
      out[snake] = { ...cfg };
      out[camel] = { ...cfg };
    }

    return out;
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  async _orderMixins(entries, { entity, allEntities }) {
    const baseOrder = [
      'InventoryMixin',
      'InventoryLifecycleMixin',
      'InventoryReservationMixin',
      'InventoryTransactionSafetyMixin',
      'InventoryReservationWorkflowMixin',
      'InventoryInboundWorkflowMixin',
      'InventoryCycleCountLineMixin',
      'InventoryCycleCountWorkflowMixin',
      'BatchTrackingMixin',
      'SerialTrackingMixin',
      'AuditMixin',
      'LocationMixin',
      'InvoiceTransactionSafetyMixin',
      'InvoiceMixin',
      'InvoiceCalculationEngineMixin',
      'InvoiceItemsMixin',
      'InvoicePaymentWorkflowMixin',
      'InvoiceNoteWorkflowMixin',
      'InvoiceLifecycleMixin',
      'HREmployeeMixin',
      'HREmployeeStatusMixin',
      'HRDepartmentMixin',
      'HRLeaveMixin',
      'HRLeaveApprovalMixin',
      'HRLeaveBalanceMixin',
      'HRAttendanceTimesheetMixin',
      'HRCompensationLedgerMixin',
    ];

    const byName = new Map();
    const orderIndex = new Map();

    entries.forEach((entry, idx) => {
      byName.set(entry.name, entry);
      orderIndex.set(entry.name, idx);
    });

    const defCache = new Map();
    const resolveDef = async (name) => {
      if (defCache.has(name)) return defCache.get(name);
      const entry = byName.get(name) || { name, config: {} };
      const def = await this.mixinRegistry.loadMixin(name, entry.config || {}, { entity, allEntities, modules: this.modules, mixinName: name });
      defCache.set(name, def);
      return def;
    };

    // Ensure all dependencies are included
    const queue = Array.from(byName.keys());
    while (queue.length) {
      const current = queue.shift();
      const def = await resolveDef(current);
      const deps = Array.isArray(def.dependencies) ? def.dependencies : [];
      for (const rawDep of deps) {
        const dep = this.mixinRegistry.resolveName(rawDep);
        if (!byName.has(dep)) {
          const idx = byName.size + 100;
          byName.set(dep, { name: dep, config: {}, source: 'dependency' });
          orderIndex.set(dep, idx);
          queue.push(dep);
        }
      }
    }

    // Build graph
    const indegree = new Map();
    const edges = new Map();
    for (const name of byName.keys()) {
      indegree.set(name, 0);
      edges.set(name, []);
    }

    for (const name of byName.keys()) {
      const def = await resolveDef(name);
      const deps = Array.isArray(def.dependencies) ? def.dependencies : [];
      for (const rawDep of deps) {
        const dep = this.mixinRegistry.resolveName(rawDep);
        if (!byName.has(dep)) continue;
        edges.get(dep).push(name);
        indegree.set(name, (indegree.get(name) || 0) + 1);
      }
    }

    const sortKey = (name) => {
      const baseRank = baseOrder.includes(name) ? baseOrder.indexOf(name) : 999;
      const idx = orderIndex.has(name) ? orderIndex.get(name) : 9999;
      return [baseRank, idx];
    };

    const available = Array.from(byName.keys()).filter((n) => indegree.get(n) === 0);
    available.sort((a, b) => {
      const [ar, ai] = sortKey(a);
      const [br, bi] = sortKey(b);
      if (ar !== br) return ar - br;
      return ai - bi;
    });

    const result = [];
    while (available.length) {
      const next = available.shift();
      result.push(byName.get(next));
      for (const neighbor of edges.get(next)) {
        indegree.set(neighbor, indegree.get(neighbor) - 1);
        if (indegree.get(neighbor) === 0) {
          available.push(neighbor);
          available.sort((a, b) => {
            const [ar, ai] = sortKey(a);
            const [br, bi] = sortKey(b);
            if (ar !== br) return ar - br;
            return ai - bi;
          });
        }
      }
    }

    if (result.length !== byName.size) {
      throw new Error('Mixin dependency cycle detected. Resolve mixin dependencies.');
    }

    return result;
  }

  async _generateEntityRoute(moduleSrcDir, entity, context) {
    const workflowRoutes = this._buildWorkflowRouteDefinitions(entity);
    const routeTemplate = `
const express = require('express');
const router = express.Router();
const {{EntityName}}Controller = require('../controllers/{{EntityName}}Controller');

const controller = new {{EntityName}}Controller();

router.get('/', (req, res) => controller.getAll(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.post('/', (req, res) => controller.create(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));
${workflowRoutes ? `\n${workflowRoutes}\n` : ''}

module.exports = router;
`;
    const content = TemplateEngine.render(routeTemplate, context);
    await fs.writeFile(
      path.join(moduleSrcDir, `routes/${entity.slug}Routes.js`),
      content
    );
  }

  _buildWorkflowRouteDefinitions(entity) {
    const moduleKey = this._getModuleKey(entity);
    if (moduleKey !== 'inventory' && moduleKey !== 'invoice' && moduleKey !== 'hr' && moduleKey !== 'shared') return '';

    const slug = String(entity && entity.slug ? entity.slug : '');
    if (!slug) return '';

    const routes = [];

    if (moduleKey === 'inventory') {
      const cfg = this._getInventoryPriorityAConfig();

      if (this._isPackEnabled(cfg.transactions) && slug === cfg.stockEntity) {
        routes.push(
          `router.post('/:id/inventory/receive', (req, res) => controller.runAction(req, res, 'applyStockReceive', req.params.id, req.body || {}));`,
          `router.post('/:id/inventory/issue', (req, res) => controller.runAction(req, res, 'applyStockIssue', req.params.id, req.body || {}));`,
          `router.post('/:id/inventory/adjust', (req, res) => controller.runAction(req, res, 'applyStockAdjust', req.params.id, req.body || {}));`,
          `router.post('/:id/inventory/transfer', (req, res) => controller.runAction(req, res, 'applyStockTransfer', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.reservations) && slug === cfg.stockEntity) {
        routes.push(
          `router.get('/:id/reservations', (req, res) => controller.runAction(req, res, 'listReservations', req.params.id, req.query || {}));`,
          `router.post('/:id/reservations', (req, res) => controller.runAction(req, res, 'reserveStock', req.params.id, req.body || {}));`,
          `router.post('/:id/reservations/:reservationId/release', (req, res) => controller.runAction(req, res, 'releaseReservation', req.params.id, req.params.reservationId, req.body || {}));`,
          `router.post('/:id/reservations/:reservationId/commit', (req, res) => controller.runAction(req, res, 'commitReservation', req.params.id, req.params.reservationId, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.inbound) && slug === cfg.inbound.grn_entity) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postGoodsReceipt', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelGoodsReceipt', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.cycleCounting) && slug === cfg.cycleCounting.session_entity) {
        routes.push(
          `router.post('/:id/start', (req, res) => controller.runAction(req, res, 'startCycleSession', req.params.id, req.body || {}));`,
          `router.post('/:id/recalculate', (req, res) => controller.runAction(req, res, 'recalculateCycleCount', req.params.id, req.body || {}));`,
          `router.post('/:id/approve', (req, res) => controller.runAction(req, res, 'approveCycleSession', req.params.id, req.body || {}));`,
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postCycleSession', req.params.id, req.body || {}));`
        );
      }
    }

    if (moduleKey === 'invoice') {
      const cfg = this._getInvoicePriorityAConfig();
      const invoiceSlug = String(cfg.invoiceEntity || 'invoices');
      const paymentSlug = String(cfg.payments?.payment_entity || 'invoice_payments');
      const noteSlug = String(cfg.notes?.note_entity || 'invoice_notes');

      if (this._isPackEnabled(cfg.transactions) && slug === invoiceSlug) {
        routes.push(
          `router.post('/:id/issue', (req, res) => controller.runAction(req, res, 'issueInvoice', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelInvoice', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.payments) && slug === invoiceSlug) {
        routes.push(
          `router.get('/:id/payments', (req, res) => controller.runAction(req, res, 'listInvoicePayments', req.params.id, req.query || {}));`,
          `router.post('/:id/payments', (req, res) => controller.runAction(req, res, 'recordInvoicePayment', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.notes) && slug === invoiceSlug) {
        routes.push(
          `router.get('/:id/notes', (req, res) => controller.runAction(req, res, 'listInvoiceNotes', req.params.id, req.query || {}));`,
          `router.post('/:id/notes', (req, res) => controller.runAction(req, res, 'createInvoiceNote', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.payments) && slug === paymentSlug) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postPayment', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelPayment', req.params.id, req.body || {}));`
        );
      }

      if (this._isPackEnabled(cfg.notes) && slug === noteSlug) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postInvoiceNote', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelInvoiceNote', req.params.id, req.body || {}));`
        );
      }
    }

    if (moduleKey === 'hr' || moduleKey === 'shared') {
      const cfg = this._getHRPriorityAConfig();
      const leaveSlug = String(cfg.leaveEntity || 'leaves');
      const employeeSlug = String(cfg.employeeEntity || 'employees');
      const attendanceSlug = String(cfg.attendanceTime?.attendance_entity || 'attendance_entries');
      const timesheetSlug = String(cfg.attendanceTime?.timesheet_entity || 'timesheet_entries');
      const ledgerSlug = String(cfg.compensationLedger?.ledger_entity || 'compensation_ledger');
      const snapshotSlug = String(cfg.compensationLedger?.snapshot_entity || 'compensation_snapshots');

      if (this._isPackEnabled(cfg.leaveApprovals) && slug === leaveSlug) {
        routes.push(
          `router.get('/approvals/pending', (req, res) => controller.runAction(req, res, 'listPendingLeaveApprovals', req.query || {}));`,
          `router.post('/:id/approve', (req, res) => controller.runAction(req, res, 'approveLeaveRequest', req.params.id, req.body || {}));`,
          `router.post('/:id/reject', (req, res) => controller.runAction(req, res, 'rejectLeaveRequest', req.params.id, req.body || {}));`,
          `router.post('/:id/cancel', (req, res) => controller.runAction(req, res, 'cancelLeaveRequest', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.leaveEngine) && slug === leaveSlug) {
        routes.push(
          `router.post('/:id/recalculate-days', (req, res) => controller.runAction(req, res, 'recalculateLeaveDays', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.leaveEngine) && slug === employeeSlug) {
        routes.push(
          `router.get('/:id/leave-balance', (req, res) => controller.runAction(req, res, 'getEmployeeLeaveBalance', req.params.id, req.query || {}));`,
          `router.post('/:id/leave-balance/accrue', (req, res) => controller.runAction(req, res, 'accrueLeaveBalance', req.params.id, req.body || {}));`,
          `router.post('/:id/leave-balance/adjust', (req, res) => controller.runAction(req, res, 'adjustLeaveBalance', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.attendanceTime) && slug === attendanceSlug) {
        routes.push(
          `router.post('/record', (req, res) => controller.runAction(req, res, 'recordAttendance', req.body || {}));`,
          `router.post('/:id/recalculate', (req, res) => controller.runAction(req, res, 'recalculateAttendance', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.attendanceTime) && slug === timesheetSlug) {
        routes.push(
          `router.post('/sync', (req, res) => controller.runAction(req, res, 'syncTimesheetWindow', req.body || {}));`,
          `router.post('/:id/approve', (req, res) => controller.runAction(req, res, 'approveTimesheetEntry', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.compensationLedger) && slug === ledgerSlug) {
        routes.push(
          `router.post('/snapshot', (req, res) => controller.runAction(req, res, 'createCompensationSnapshot', req.body || {}));`,
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postCompensationLedger', req.params.id, req.body || {}));`
        );
      }
      if (this._isPackEnabled(cfg.compensationLedger) && slug === snapshotSlug) {
        routes.push(
          `router.post('/:id/post', (req, res) => controller.runAction(req, res, 'postCompensationSnapshot', req.params.id, req.body || {}));`
        );
      }
    }

    return routes.join('\n');
  }

  async generateRoutesIndex(outputDir, entities) {
    let imports = '';
    let mappings = '';

    entities.forEach(entity => {
      const slug = entity.slug;
      const moduleKey = this._getModuleKey(entity);
      imports += `const ${slug}Router = require('../../modules/${moduleKey}/src/routes/${slug}Routes');\n`;
      mappings += `router.use('/${slug}', ${slug}Router);\n`;
    });

    const template = `
const express = require('express');
const router = express.Router();

${imports}

${mappings}

module.exports = router;
`;
    await fs.writeFile(path.join(outputDir, 'src/routes/index.js'), template);
  }

  async generateDatabaseArtifacts(outputDir, entities = []) {
    const repoDir = path.join(outputDir, 'src/repository');
    const migrationsDir = path.join(repoDir, 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });
    const sql = this._standalone
      ? this._buildSQLiteSchemaSql(entities)
      : this._buildDatabaseSchemaSql(entities);
    await fs.writeFile(path.join(migrationsDir, '001_initial_schema.sql'), sql);
  }

  async generateMainEntry(outputDir) {
    const templateName = this._standalone
      ? 'standalone/index.js.template'
      : 'index.js.template';
    const template = await this.brickRepo.getTemplate(templateName);
    await fs.writeFile(path.join(outputDir, 'src/index.js'), template);
  }

  _injectSchemaValidations(weaver, entity, allEntities) {
    const createSnippet = this._buildCreateValidationSnippet(entity, allEntities);
    const updateSnippet = this._buildUpdateValidationSnippet(entity, allEntities);
    const deleteSnippet = this._buildDeleteRestrictionSnippet(entity, allEntities);

    if (createSnippet) weaver.inject('BEFORE_CREATE_VALIDATION', createSnippet);
    if (updateSnippet) weaver.inject('BEFORE_UPDATE_VALIDATION', updateSnippet);
    if (deleteSnippet) weaver.inject('BEFORE_DELETE_VALIDATION', deleteSnippet);
  }

  _buildCreateValidationSnippet(entity, allEntities) {
    const rules = this._getFieldRules(entity, allEntities);
    if (rules.length === 0) return '';

    const uniqueFields = rules.filter((r) => r.unique);
    const referenceFields = rules.filter((r) => r.referenceEntity);

    let code = `
      // Schema-driven validation (generated)
      const fieldErrors = {};
      const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const isMissingNonString = (v) => v === undefined || v === null;
`;

    if (uniqueFields.length) {
      code += `
      const existingItems = await this.repository.findAll(this.slug);
`;
    }

    if (referenceFields.length) {
      code += `
      const __refIdSets = {};
      const getRefIdSet = async (slug) => {
        if (__refIdSets[slug]) return __refIdSets[slug];
        const all = await this.repository.findAll(slug);
        __refIdSets[slug] = new Set(all.map((x) => x.id));
        return __refIdSets[slug];
      };
`;
    }

    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `data['${fieldKey}']`;

      // required
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!Array.isArray(${accessor}) || ${accessor}.length === 0) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else {
          code += `
      if (isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${label} must be at least ${r.minLength} characters';
`;
      }
      if (typeof r.maxLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${label} must be at most ${r.maxLength} characters';
`;
      }
      if (Array.isArray(r.options) && r.options.length) {
        const varName = `__allowed_${String(r.name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const list = r.options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        const preview = this._escapeJsString(r.options.slice(0, 10).join(', '));
        code += `
      const ${varName} = [${list}];
      if (!isMissing(${accessor}) && !${varName}.includes(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} must be one of: ${preview}';
`;
      }
      if (typeof r.pattern === 'string' && r.pattern.length) {
        code += `
      if (!isMissing(${accessor})) {
        try {
          const re = new RegExp('${this._escapeJsString(r.pattern)}');
          if (!re.test(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} is invalid';
        } catch (e) {}
      }
`;
      }

      // numeric rules
      const isNumeric = ['integer', 'decimal', 'number'].includes(r.type);
      if (isNumeric || typeof r.min === 'number' || typeof r.max === 'number') {
        code += `
      if (!isMissing(${accessor})) {
        const num = typeof ${accessor} === 'number' ? ${accessor} : Number(${accessor});
        if (Number.isNaN(num)) {
          fieldErrors['${fieldKey}'] = '${label} must be a number';
        } else {
`;
        if (r.type === 'integer') {
          code += `
          if (!Number.isInteger(num)) fieldErrors['${fieldKey}'] = '${label} must be an integer';
`;
        }
        if (typeof r.min === 'number') {
          code += `
          if (num < ${r.min}) fieldErrors['${fieldKey}'] = '${label} must be ≥ ${r.min}';
`;
        }
        if (typeof r.max === 'number') {
          code += `
          if (num > ${r.max}) fieldErrors['${fieldKey}'] = '${label} must be ≤ ${r.max}';
`;
        }
        code += `
        }
      }
`;
      }

      // unique
      if (r.unique) {
        code += `
      if (!isMissing(${accessor}) && existingItems.some((it) => String(it['${fieldKey}']) === String(${accessor}))) {
        fieldErrors['${fieldKey}'] = '${label} must be unique';
      }
`;
      }

      // reference exists
      if (r.referenceEntity) {
        const refSlug = this._escapeJsString(r.referenceEntity);
        if (r.multiple) {
          code += `
      if (!isMissing(${accessor})) {
        if (!Array.isArray(${accessor})) {
          fieldErrors['${fieldKey}'] = '${label} must be a list of IDs';
        } else {
          const ids = await getRefIdSet('${refSlug}');
          const bad = ${accessor}.find((v) => !ids.has(String(v)));
          if (bad !== undefined) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
        }
      }
`;
        } else {
          code += `
      if (!isMissing(${accessor})) {
        const ids = await getRefIdSet('${refSlug}');
        if (!ids.has(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
      }
`;
        }
      }
    }

    code += `
      if (Object.keys(fieldErrors).length) {
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.fieldErrors = fieldErrors;
        throw err;
      }
`;
    return code;
  }

  _buildUpdateValidationSnippet(entity, allEntities) {
    const rules = this._getFieldRules(entity, allEntities);
    if (rules.length === 0) return '';

    const uniqueFields = rules.filter((r) => r.unique);
    const referenceFields = rules.filter((r) => r.referenceEntity);

    let code = `
      // Schema-driven validation (generated)
      const existing = await this.repository.findById(this.slug, id);
      if (!existing) return null;
      const merged = { ...existing, ...data };

      const fieldErrors = {};
      const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const isMissingNonString = (v) => v === undefined || v === null;
`;

    if (uniqueFields.length) {
      code += `
      const existingItems = await this.repository.findAll(this.slug);
`;
    }

    if (referenceFields.length) {
      code += `
      const __refIdSets = {};
      const getRefIdSet = async (slug) => {
        if (__refIdSets[slug]) return __refIdSets[slug];
        const all = await this.repository.findAll(slug);
        __refIdSets[slug] = new Set(all.map((x) => x.id));
        return __refIdSets[slug];
      };
`;
    }

    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `merged['${fieldKey}']`;

      // required
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!Array.isArray(${accessor}) || ${accessor}.length === 0) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else {
          code += `
      if (isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${label} must be at least ${r.minLength} characters';
`;
      }
      if (typeof r.maxLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${label} must be at most ${r.maxLength} characters';
`;
      }
      if (Array.isArray(r.options) && r.options.length) {
        const varName = `__allowed_${String(r.name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const list = r.options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        const preview = this._escapeJsString(r.options.slice(0, 10).join(', '));
        code += `
      const ${varName} = [${list}];
      if (!isMissing(${accessor}) && !${varName}.includes(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} must be one of: ${preview}';
`;
      }
      if (typeof r.pattern === 'string' && r.pattern.length) {
        code += `
      if (!isMissing(${accessor})) {
        try {
          const re = new RegExp('${this._escapeJsString(r.pattern)}');
          if (!re.test(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} is invalid';
        } catch (e) {}
      }
`;
      }

      // numeric rules
      const isNumeric = ['integer', 'decimal', 'number'].includes(r.type);
      if (isNumeric || typeof r.min === 'number' || typeof r.max === 'number') {
        code += `
      if (!isMissing(${accessor})) {
        const num = typeof ${accessor} === 'number' ? ${accessor} : Number(${accessor});
        if (Number.isNaN(num)) {
          fieldErrors['${fieldKey}'] = '${label} must be a number';
        } else {
`;
        if (r.type === 'integer') {
          code += `
          if (!Number.isInteger(num)) fieldErrors['${fieldKey}'] = '${label} must be an integer';
`;
        }
        if (typeof r.min === 'number') {
          code += `
          if (num < ${r.min}) fieldErrors['${fieldKey}'] = '${label} must be ≥ ${r.min}';
`;
        }
        if (typeof r.max === 'number') {
          code += `
          if (num > ${r.max}) fieldErrors['${fieldKey}'] = '${label} must be ≤ ${r.max}';
`;
        }
        code += `
        }
      }
`;
      }

      // unique
      if (r.unique) {
        code += `
      if (!isMissing(${accessor}) && existingItems.some((it) => it.id !== id && String(it['${fieldKey}']) === String(${accessor}))) {
        fieldErrors['${fieldKey}'] = '${label} must be unique';
      }
`;
      }

      // reference exists
      if (r.referenceEntity) {
        const refSlug = this._escapeJsString(r.referenceEntity);
        if (r.multiple) {
          code += `
      if (!isMissing(${accessor})) {
        if (!Array.isArray(${accessor})) {
          fieldErrors['${fieldKey}'] = '${label} must be a list of IDs';
        } else {
          const ids = await getRefIdSet('${refSlug}');
          const bad = ${accessor}.find((v) => !ids.has(String(v)));
          if (bad !== undefined) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
        }
      }
`;
        } else {
          code += `
      if (!isMissing(${accessor})) {
        const ids = await getRefIdSet('${refSlug}');
        if (!ids.has(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
      }
`;
        }
      }
    }

    code += `
      if (Object.keys(fieldErrors).length) {
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.fieldErrors = fieldErrors;
        throw err;
      }
`;
    return code;
  }

  _buildDeleteRestrictionSnippet(entity, allEntities) {
    const dependentsByEntity = new Map();

    for (const other of allEntities) {
      if (!other || other.slug === entity.slug) continue;
      const otherFields = Array.isArray(other.fields) ? other.fields : [];

      const referencingFields = otherFields
        .map((f) => {
          const ref = this._resolveReferenceEntitySlug(f, allEntities);
          if (ref !== entity.slug) return null;
          return {
            name: f.name,
            multiple: this._isFieldMultiple(f),
          };
        })
        .filter(Boolean);

      if (referencingFields.length) {
        dependentsByEntity.set(other.slug, { entity: other, fields: referencingFields });
      }
    }

    if (dependentsByEntity.size === 0) return '';

    let code = `
      // Delete protection (generated): prevent deleting a record that is referenced by others
      const dependents = [];
`;

    for (const [otherSlug, info] of dependentsByEntity.entries()) {
      const otherEntity = info.entity;
      const displayField = this._guessDisplayField(otherEntity);
      const displayFieldEsc = this._escapeJsString(displayField);

      // Build per-row match condition across all referencing fields
      const checks = info.fields.map((f) => {
        const key = this._escapeJsString(f.name);
        if (f.multiple) {
          return `(Array.isArray(row['${key}']) && row['${key}'].some((v) => String(v) === String(id)))`;
        }
        return `String(row['${key}'] ?? '') === String(id)`;
      });
      const matchExpr = checks.join(' || ') || 'false';

      const viaFields = info.fields.map((f) => `'${this._escapeJsString(f.name)}'`).join(', ');

      code += `
      {
        const rows = await this.repository.findAll('${this._escapeJsString(otherSlug)}');
        const matches = rows.filter((row) => ${matchExpr});
        if (matches.length) {
          dependents.push({
            entity: '${this._escapeJsString(otherSlug)}',
            via: [${viaFields}],
            count: matches.length,
            preview: matches.slice(0, 10).map((r) => ({ id: r.id, display: r['${displayFieldEsc}'] || r.id })),
          });
        }
      }
`;
    }

    code += `
      if (dependents.length) {
        const err = new Error('Cannot delete: this record is referenced by other records');
        err.statusCode = 409;
        err.dependents = dependents;
        throw err;
      }
`;

    return code;
  }

  _getFieldRules(entity, allEntities) {
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    return fields
      .filter((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name))
      .map((f) => {
        const type = String(f.type || 'string');
        const label = f.label ? String(f.label) : this._formatLabel(f.name);
        const rawOptions = f.options ?? f.enum ?? f.allowed_values ?? f.allowedValues;
        const options = Array.isArray(rawOptions)
          ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
          : undefined;
        const rule = {
          name: f.name,
          type,
          label,
          required: !!f.required,
          unique: !!f.unique,
          minLength: typeof f.min_length === 'number' ? f.min_length : (typeof f.minLength === 'number' ? f.minLength : undefined),
          maxLength: typeof f.max_length === 'number' ? f.max_length : (typeof f.maxLength === 'number' ? f.maxLength : undefined),
          min: typeof f.min === 'number' ? f.min : (typeof f.min_value === 'number' ? f.min_value : (typeof f.minValue === 'number' ? f.minValue : undefined)),
          max: typeof f.max === 'number' ? f.max : (typeof f.max_value === 'number' ? f.max_value : (typeof f.maxValue === 'number' ? f.maxValue : undefined)),
          pattern: typeof f.pattern === 'string' ? f.pattern : (typeof f.regex === 'string' ? f.regex : undefined),
          options,
          referenceEntity: this._resolveReferenceEntitySlug(f, allEntities),
          multiple: this._isFieldMultiple(f),
        };

        // If the field isn't a reference, clear referenceEntity so we don't accidentally validate it.
        const isReferenceish = type === 'reference' || f.name.endsWith('_id') || f.name.endsWith('_ids') || !!(f.reference_entity || f.referenceEntity);
        if (!isReferenceish) {
          rule.referenceEntity = null;
          rule.multiple = false;
        }

        return rule;
      });
  }

  _isFieldMultiple(field) {
    return field && (field.multiple === true || field.is_array === true || String(field.name || '').endsWith('_ids'));
  }

  _resolveReferenceEntitySlug(field, allEntities) {
    if (!field) return null;

    const explicit = field.reference_entity || field.referenceEntity;
    const name = String(field.name || '');
    const inferredBase = name.replace(/_ids?$/, '');
    const baseName = String(explicit || inferredBase);

    if (!baseName) return null;

    const entities = Array.isArray(allEntities) ? allEntities : [];
    const target = entities.find((e) =>
      e.slug === baseName ||
      e.slug === baseName + 's' ||
      e.slug === baseName + 'es' ||
      (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
      e.slug.startsWith(baseName)
    );

    return target ? target.slug : (explicit ? String(explicit) : null);
  }

  _guessDisplayField(entity) {
    if (!entity) return 'id';
    if (entity.display_field) return String(entity.display_field);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    if (fields.some((f) => f && f.name === 'name')) return 'name';
    if (fields.some((f) => f && f.name === 'sku')) return 'sku';
    const first = fields.find((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name));
    return first ? String(first.name) : 'id';
  }

  _escapeJsString(str) {
    // Escape a string for safe inclusion inside single-quoted JS string literals.
    // Important for generated code (regex patterns can include `$`/backslashes/newlines/etc).
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/'/g, "\\'");
  }

  _formatLabel(str) {
    return String(str).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _quoteSqlIdentifier(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
  }

  _toPostgresType(field) {
    if (this._isFieldMultiple(field)) return 'JSONB';

    const type = String(field && field.type ? field.type : 'string').toLowerCase();
    switch (type) {
      case 'integer':
        return 'INTEGER';
      case 'decimal':
        return 'NUMERIC(18,6)';
      case 'number':
        return 'DOUBLE PRECISION';
      case 'boolean':
        return 'BOOLEAN';
      case 'date':
        return 'DATE';
      case 'datetime':
        return 'TIMESTAMPTZ';
      case 'text':
        return 'TEXT';
      case 'reference':
        return 'TEXT';
      case 'string':
      default:
        return 'TEXT';
    }
  }

  _buildDatabaseSchemaSql(entities = []) {
    const allEntities = Array.isArray(entities) ? entities : [];
    const bySlug = new Map();
    for (const entity of allEntities) {
      if (!entity || !entity.slug) continue;
      if (!bySlug.has(entity.slug)) {
        bySlug.set(entity.slug, entity);
      }
    }
    const deferredForeignKeys = [];

    const lines = [
      '-- Generated by CustomERP assembler',
      '-- Database schema for generated ERP entities',
      '',
    ];

    for (const entity of bySlug.values()) {
      const slug = String(entity.slug || '').trim();
      if (!slug) continue;
      const fields = Array.isArray(entity.fields) ? entity.fields : [];
      const table = this._quoteSqlIdentifier(slug);
      const columns = [
        `${this._quoteSqlIdentifier('id')} TEXT PRIMARY KEY`,
        `${this._quoteSqlIdentifier('created_at')} TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
        `${this._quoteSqlIdentifier('updated_at')} TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
      ];

      const seen = new Set(['id', 'created_at', 'updated_at']);
      for (const field of fields) {
        if (!field || !field.name) continue;
        const fieldName = String(field.name);
        if (!fieldName || seen.has(fieldName)) continue;
        seen.add(fieldName);

        const pgType = this._toPostgresType(field);
        const notNull = field.required ? ' NOT NULL' : '';
        const defaultClause = this._isFieldMultiple(field) ? ` DEFAULT '[]'::jsonb` : '';
        columns.push(`${this._quoteSqlIdentifier(fieldName)} ${pgType}${notNull}${defaultClause}`);

        const fieldType = String(field.type || '').toLowerCase();
        const referenceEntity = this._pickFirstString(
          field.reference_entity,
          field.referenceEntity
        );
        if (
          fieldType === 'reference' &&
          referenceEntity &&
          bySlug.has(referenceEntity) &&
          !this._isFieldMultiple(field)
        ) {
          const constraintName = `fk_${slug}_${fieldName}`
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .slice(0, 60);
          deferredForeignKeys.push({
            tableSlug: slug,
            fieldName,
            referenceEntity,
            constraintName,
          });
        }
      }

      lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
      lines.push(`  ${columns.join(',\n  ')}`);
      lines.push(');');
      lines.push('');

      for (const field of fields) {
        if (!field || !field.name || !field.unique || this._isFieldMultiple(field)) continue;
        const fieldName = String(field.name);
        if (!fieldName || ['id', 'created_at', 'updated_at'].includes(fieldName)) continue;
        const safeIndexName = `ux_${slug}_${fieldName}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60);
        lines.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${this._quoteSqlIdentifier(safeIndexName)} ON ${table} (${this._quoteSqlIdentifier(fieldName)}) WHERE ${this._quoteSqlIdentifier(fieldName)} IS NOT NULL;`
        );
      }

      const fieldNames = new Set(
        fields
          .map((f) => (f && f.name ? String(f.name) : ''))
          .filter(Boolean)
      );
      const emittedIndexes = new Set();
      const emitIndex = (rawName, columnsSql) => {
        const safe = String(rawName || '')
          .replace(/[^a-zA-Z0-9_]/g, '_')
          .slice(0, 60);
        if (!safe || emittedIndexes.has(safe)) return;
        emittedIndexes.add(safe);
        lines.push(`CREATE INDEX IF NOT EXISTS ${this._quoteSqlIdentifier(safe)} ON ${table} (${columnsSql});`);
      };

      for (const field of fields) {
        if (!field || !field.name || this._isFieldMultiple(field)) continue;
        const fieldName = String(field.name);
        if (!fieldName || ['id', 'created_at', 'updated_at'].includes(fieldName)) continue;
        const fieldType = String(field.type || '').toLowerCase();
        const looksReference = fieldType === 'reference' || fieldName.endsWith('_id');
        const looksStatus = fieldName === 'status';
        const looksNumber = fieldType === 'integer' || fieldType === 'decimal' || fieldType === 'number';

        if (looksReference || looksStatus || looksNumber) {
          emitIndex(`ix_${slug}_${fieldName}`, this._quoteSqlIdentifier(fieldName));
        }
      }

      if (fieldNames.has('status')) {
        for (const fieldName of fieldNames) {
          if (!fieldName.endsWith('_id')) continue;
          const compositeCols = `${this._quoteSqlIdentifier(fieldName)}, ${this._quoteSqlIdentifier('status')}`;
          emitIndex(`ix_${slug}_${fieldName}_status`, compositeCols);
        }
      }
      lines.push('');
    }

    const emittedGlobalIndexes = new Set();
    const emitGlobalIndex = (tableSlug, rawName, columns, unique = false) => {
      const tableEntity = bySlug.get(tableSlug);
      if (!tableEntity) return;
      const fieldNames = new Set(
        (Array.isArray(tableEntity.fields) ? tableEntity.fields : [])
          .map((f) => (f && f.name ? String(f.name) : ''))
          .filter(Boolean)
      );
      const normalizedColumns = (Array.isArray(columns) ? columns : [])
        .map((col) => String(col || '').trim())
        .filter(Boolean);
      if (!normalizedColumns.length) return;
      if (normalizedColumns.some((col) => !fieldNames.has(col))) return;

      const safe = String(rawName || '')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 60);
      if (!safe || emittedGlobalIndexes.has(safe)) return;
      emittedGlobalIndexes.add(safe);

      const table = this._quoteSqlIdentifier(tableSlug);
      const columnsSql = normalizedColumns.map((col) => this._quoteSqlIdentifier(col)).join(', ');
      if (unique) {
        lines.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${this._quoteSqlIdentifier(safe)} ON ${table} (${columnsSql});`
        );
      } else {
        lines.push(`CREATE INDEX IF NOT EXISTS ${this._quoteSqlIdentifier(safe)} ON ${table} (${columnsSql});`);
      }
    };

    const invoiceCfg = this._getInvoicePriorityAConfig();
    if (this._isPackEnabled(invoiceCfg.payments)) {
      emitGlobalIndex(
        invoiceCfg.payments.payment_entity,
        `ix_${invoiceCfg.payments.payment_entity}_${invoiceCfg.payments.payment_date_field}_status`,
        [invoiceCfg.payments.payment_date_field, invoiceCfg.payments.status_field]
      );
      emitGlobalIndex(
        invoiceCfg.payments.allocation_entity,
        `ix_${invoiceCfg.payments.allocation_entity}_${invoiceCfg.payments.allocation_invoice_field}_${invoiceCfg.payments.allocation_payment_field}`,
        [invoiceCfg.payments.allocation_invoice_field, invoiceCfg.payments.allocation_payment_field]
      );
      emitGlobalIndex(
        invoiceCfg.payments.allocation_entity,
        `ix_${invoiceCfg.payments.allocation_entity}_${invoiceCfg.payments.allocation_payment_field}_${invoiceCfg.payments.allocation_invoice_field}`,
        [invoiceCfg.payments.allocation_payment_field, invoiceCfg.payments.allocation_invoice_field]
      );
    }
    if (this._isPackEnabled(invoiceCfg.notes)) {
      emitGlobalIndex(
        invoiceCfg.notes.note_entity,
        `ix_${invoiceCfg.notes.note_entity}_${invoiceCfg.notes.note_type_field}_${invoiceCfg.notes.note_status_field}`,
        [invoiceCfg.notes.note_type_field, invoiceCfg.notes.note_status_field]
      );
    }
    if (this._isPackEnabled(invoiceCfg.transactions)) {
      emitGlobalIndex(
        invoiceCfg.invoiceEntity,
        `ix_${invoiceCfg.invoiceEntity}_${invoiceCfg.statusField}_${invoiceCfg.transactions.posted_at_field}`,
        [invoiceCfg.statusField, invoiceCfg.transactions.posted_at_field]
      );
    }

    const hrCfg = this._getHRPriorityAConfig();
    if (this._isPackEnabled(hrCfg.leaveEngine)) {
      emitGlobalIndex(
        hrCfg.leaveEngine.balance_entity,
        `ux_${hrCfg.leaveEngine.balance_entity}_${hrCfg.leaveEngine.employee_field}_${hrCfg.leaveEngine.leave_type_field}_${hrCfg.leaveEngine.fiscal_year_field}`,
        [
          hrCfg.leaveEngine.employee_field,
          hrCfg.leaveEngine.leave_type_field,
          hrCfg.leaveEngine.fiscal_year_field,
        ],
        true
      );
      emitGlobalIndex(
        hrCfg.leaveEntity,
        `ix_${hrCfg.leaveEntity}_${hrCfg.leaveEngine.employee_field}_${hrCfg.leaveEngine.status_field}_${hrCfg.leaveEngine.start_date_field}`,
        [
          hrCfg.leaveEngine.employee_field,
          hrCfg.leaveEngine.status_field,
          hrCfg.leaveEngine.start_date_field,
        ]
      );
    }
    if (this._isPackEnabled(hrCfg.leaveApprovals)) {
      emitGlobalIndex(
        hrCfg.leaveEntity,
        `ix_${hrCfg.leaveEntity}_${hrCfg.leaveApprovals.status_field}_${hrCfg.leaveApprovals.approver_field}`,
        [hrCfg.leaveApprovals.status_field, hrCfg.leaveApprovals.approver_field]
      );
    }
    if (this._isPackEnabled(hrCfg.attendanceTime)) {
      emitGlobalIndex(
        hrCfg.attendanceTime.attendance_entity,
        `ux_${hrCfg.attendanceTime.attendance_entity}_${hrCfg.attendanceTime.attendance_employee_field}_${hrCfg.attendanceTime.attendance_date_field}`,
        [hrCfg.attendanceTime.attendance_employee_field, hrCfg.attendanceTime.attendance_date_field],
        true
      );
      emitGlobalIndex(
        hrCfg.attendanceTime.timesheet_entity,
        `ux_${hrCfg.attendanceTime.timesheet_entity}_${hrCfg.attendanceTime.timesheet_employee_field}_${hrCfg.attendanceTime.timesheet_date_field}`,
        [hrCfg.attendanceTime.timesheet_employee_field, hrCfg.attendanceTime.timesheet_date_field],
        true
      );
      emitGlobalIndex(
        hrCfg.attendanceTime.shift_entity,
        `ix_${hrCfg.attendanceTime.shift_entity}_${hrCfg.attendanceTime.shift_employee_field}_${hrCfg.attendanceTime.shift_status_field}`,
        [hrCfg.attendanceTime.shift_employee_field, hrCfg.attendanceTime.shift_status_field]
      );
    }
    if (this._isPackEnabled(hrCfg.compensationLedger)) {
      emitGlobalIndex(
        hrCfg.compensationLedger.ledger_entity,
        `ix_${hrCfg.compensationLedger.ledger_entity}_${hrCfg.compensationLedger.ledger_employee_field}_${hrCfg.compensationLedger.ledger_period_field}`,
        [hrCfg.compensationLedger.ledger_employee_field, hrCfg.compensationLedger.ledger_period_field]
      );
      emitGlobalIndex(
        hrCfg.compensationLedger.ledger_entity,
        `ix_${hrCfg.compensationLedger.ledger_entity}_${hrCfg.compensationLedger.ledger_period_field}_${hrCfg.compensationLedger.ledger_status_field}`,
        [hrCfg.compensationLedger.ledger_period_field, hrCfg.compensationLedger.ledger_status_field]
      );
      emitGlobalIndex(
        hrCfg.compensationLedger.snapshot_entity,
        `ux_${hrCfg.compensationLedger.snapshot_entity}_${hrCfg.compensationLedger.snapshot_employee_field}_${hrCfg.compensationLedger.snapshot_period_field}`,
        [hrCfg.compensationLedger.snapshot_employee_field, hrCfg.compensationLedger.snapshot_period_field],
        true
      );
      emitGlobalIndex(
        hrCfg.compensationLedger.snapshot_entity,
        `ix_${hrCfg.compensationLedger.snapshot_entity}_${hrCfg.compensationLedger.snapshot_period_field}_${hrCfg.compensationLedger.snapshot_status_field}`,
        [hrCfg.compensationLedger.snapshot_period_field, hrCfg.compensationLedger.snapshot_status_field]
      );
    }

    if (deferredForeignKeys.length) {
      lines.push('-- Foreign key constraints');
      for (const fk of deferredForeignKeys) {
        const table = this._quoteSqlIdentifier(fk.tableSlug);
        const refTable = this._quoteSqlIdentifier(fk.referenceEntity);
        const field = this._quoteSqlIdentifier(fk.fieldName);
        const constraint = this._quoteSqlIdentifier(fk.constraintName);
        const constraintLiteral = String(fk.constraintName).replace(/'/g, "''");
        lines.push(`DO $$`);
        lines.push(`BEGIN`);
        lines.push(`  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintLiteral}') THEN`);
        lines.push(`    ALTER TABLE ${table}`);
        lines.push(`      ADD CONSTRAINT ${constraint}`);
        lines.push(`      FOREIGN KEY (${field}) REFERENCES ${refTable} (${this._quoteSqlIdentifier('id')})`);
        lines.push(`      ON UPDATE CASCADE ON DELETE RESTRICT;`);
        lines.push(`  END IF;`);
        lines.push(`END $$;`);
      }
      lines.push('');
    }

    if (lines.length <= 3) {
      lines.push('-- No entities available to generate schema.');
      lines.push('');
    }

    return `${lines.join('\n').trim()}\n`;
  }

  /* ------------------------------------------------------------------
   *  SQLite schema generation (standalone mode)
   * ------------------------------------------------------------------ */

  _toSqliteType(field) {
    if (this._isFieldMultiple(field)) return 'TEXT';
    const type = String(field && field.type ? field.type : 'string').toLowerCase();
    switch (type) {
      case 'integer': return 'INTEGER';
      case 'decimal':
      case 'number': return 'REAL';
      case 'boolean': return 'INTEGER';
      case 'date':
      case 'datetime': return 'TEXT';
      case 'text':
      case 'reference':
      case 'string':
      default: return 'TEXT';
    }
  }

  _buildSQLiteSchemaSql(entities = []) {
    const allEntities = Array.isArray(entities) ? entities : [];
    const bySlug = new Map();
    for (const entity of allEntities) {
      if (!entity || !entity.slug) continue;
      if (!bySlug.has(entity.slug)) bySlug.set(entity.slug, entity);
    }

    const lines = [
      '-- Generated by CustomERP assembler (SQLite)',
      '-- Database schema for generated ERP entities',
      '',
    ];

    for (const entity of bySlug.values()) {
      const slug = String(entity.slug || '').trim();
      if (!slug) continue;
      const fields = Array.isArray(entity.fields) ? entity.fields : [];
      const table = this._quoteSqlIdentifier(slug);
      const columns = [
        `${this._quoteSqlIdentifier('id')} TEXT PRIMARY KEY`,
        `${this._quoteSqlIdentifier('created_at')} TEXT NOT NULL DEFAULT (datetime('now'))`,
        `${this._quoteSqlIdentifier('updated_at')} TEXT NOT NULL DEFAULT (datetime('now'))`,
      ];

      const seen = new Set(['id', 'created_at', 'updated_at']);
      for (const field of fields) {
        if (!field || !field.name) continue;
        const fieldName = String(field.name);
        if (!fieldName || seen.has(fieldName)) continue;
        seen.add(fieldName);

        const sqliteType = this._toSqliteType(field);
        const notNull = field.required ? ' NOT NULL' : '';
        const defaultClause = this._isFieldMultiple(field) ? ` DEFAULT '[]'` : '';

        const fieldType = String(field.type || '').toLowerCase();
        const referenceEntity = this._pickFirstString(field.reference_entity, field.referenceEntity);
        let refClause = '';
        if (
          fieldType === 'reference' &&
          referenceEntity &&
          bySlug.has(referenceEntity) &&
          !this._isFieldMultiple(field)
        ) {
          refClause = ` REFERENCES ${this._quoteSqlIdentifier(referenceEntity)}(${this._quoteSqlIdentifier('id')}) ON UPDATE CASCADE ON DELETE RESTRICT`;
        }

        columns.push(`${this._quoteSqlIdentifier(fieldName)} ${sqliteType}${notNull}${defaultClause}${refClause}`);
      }

      lines.push(`CREATE TABLE IF NOT EXISTS ${table} (`);
      lines.push(`  ${columns.join(',\n  ')}`);
      lines.push(');');
      lines.push('');

      for (const field of fields) {
        if (!field || !field.name || !field.unique || this._isFieldMultiple(field)) continue;
        const fieldName = String(field.name);
        if (!fieldName || ['id', 'created_at', 'updated_at'].includes(fieldName)) continue;
        const safeIndexName = `ux_${slug}_${fieldName}`.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60);
        lines.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${this._quoteSqlIdentifier(safeIndexName)} ON ${table} (${this._quoteSqlIdentifier(fieldName)}) WHERE ${this._quoteSqlIdentifier(fieldName)} IS NOT NULL;`
        );
      }

      const fieldNames = new Set(fields.map((f) => (f && f.name ? String(f.name) : '')).filter(Boolean));
      const emittedIndexes = new Set();
      const emitIndex = (rawName, columnsSql) => {
        const safe = String(rawName || '').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60);
        if (!safe || emittedIndexes.has(safe)) return;
        emittedIndexes.add(safe);
        lines.push(`CREATE INDEX IF NOT EXISTS ${this._quoteSqlIdentifier(safe)} ON ${table} (${columnsSql});`);
      };

      for (const field of fields) {
        if (!field || !field.name || this._isFieldMultiple(field)) continue;
        const fieldName = String(field.name);
        if (!fieldName || ['id', 'created_at', 'updated_at'].includes(fieldName)) continue;
        const fieldType = String(field.type || '').toLowerCase();
        const looksReference = fieldType === 'reference' || fieldName.endsWith('_id');
        const looksStatus = fieldName === 'status';
        const looksNumber = fieldType === 'integer' || fieldType === 'decimal' || fieldType === 'number';
        if (looksReference || looksStatus || looksNumber) {
          emitIndex(`ix_${slug}_${fieldName}`, this._quoteSqlIdentifier(fieldName));
        }
      }

      if (fieldNames.has('status')) {
        for (const fieldName of fieldNames) {
          if (!fieldName.endsWith('_id')) continue;
          const compositeCols = `${this._quoteSqlIdentifier(fieldName)}, ${this._quoteSqlIdentifier('status')}`;
          emitIndex(`ix_${slug}_${fieldName}_status`, compositeCols);
        }
      }
      lines.push('');
    }

    if (lines.length <= 3) {
      lines.push('-- No entities available to generate schema.');
      lines.push('');
    }

    return `${lines.join('\n').trim()}\n`;
  }
}

module.exports = BackendGenerator;


