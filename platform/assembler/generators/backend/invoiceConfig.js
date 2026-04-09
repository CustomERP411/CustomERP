// Invoice module configuration extraction (split from BackendGenerator)
module.exports = {
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
};
