// Plan I — wizard wiring (invoice.v4)
//
// Same questions as invoice.v3 plus a new `invoice_payment_methods`
// multi-choice question that drives the `payment_method` enum on
// `invoice_payments`. Gated by `invoice_enable_payments=yes` so the
// question only appears when the payments capability is on.
//
// When "Credit Card" is among the chosen methods, the prefilled SDF
// builder also emits an `installments` integer field with a
// `visibility_when` predicate plus a paired `conditional_required`
// invariant — that machinery already exists from Plan G.
const INVOICE_V4_QUESTIONS = [
  {
    key: 'invoice_currency',
    prompt: 'What currency do you use for invoices?',
    type: 'choice',
    options: ['USD', 'EUR', 'GBP', 'TRY', 'AED', 'SAR'],
    allow_custom: true,
    required: true,
    section: 'Invoice Setup',
    question_number: 1,
    sdf_mapping: { target: 'modules.invoice.currency' },
    sdf_impact_notes: 'Sets modules.invoice.currency string. Used by InvoiceMixin for header formatting and by frontend for currency display (Intl.NumberFormat).',
    order_index: 0,
  },
  {
    key: 'invoice_tax_rate',
    prompt: 'What is your standard tax rate (%)?',
    type: 'choice',
    options: ['0', '1', '5', '8', '10', '18', '20'],
    allow_custom: true,
    required: true,
    section: 'Invoice Setup',
    question_number: 2,
    sdf_mapping: { target: 'modules.invoice.tax_rate' },
    sdf_impact_notes: 'Sets modules.invoice.tax_rate number. Used by InvoiceMixin and InvoiceItemsMixin for automatic tax_total calculation on invoice header.',
    order_index: 1,
  },
  {
    key: 'invoice_enable_payments',
    prompt: 'Want to log customer payments and see what is still due on each invoice?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Capabilities',
    question_number: 3,
    sdf_mapping: { target: 'modules.invoice.payments.enabled' },
    sdf_impact_notes: 'Enables modules.invoice.payments with entity refs (payment_entity, allocation_entity, invoice_entity). Creates invoice_payments entity (payment_number, invoice_id, amount, payment_date, payment_method, status [Draft/Posted/Cancelled], reference_number, posted_at, cancelled_at, cancel_reason, note). Creates invoice_payment_allocations entity (payment_id, invoice_id, amount). Wires InvoicePaymentWorkflowMixin for payment recording, posting, cancellation.',
    order_index: 2,
  },
  {
    key: 'invoice_enable_notes',
    prompt: 'After you send an invoice, do you sometimes need a credit or extra charge to correct it?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Capabilities',
    question_number: 4,
    sdf_mapping: { target: 'modules.invoice.notes.enabled' },
    sdf_impact_notes: 'Enables modules.invoice.notes with entity refs (note_entity, invoice_entity). Creates invoice_notes entity (note_number, source_invoice_id, note_type [Credit/Debit], amount, tax_total, grand_total, status [Draft/Posted/Cancelled], issue_date, reason, post_reference, posted_at, cancelled_at, cancel_reason, note). Wires InvoiceNoteWorkflowMixin for credit/debit note creation, posting, and invoice balance impact.',
    order_index: 3,
  },
  {
    key: 'invoice_enable_calc_engine',
    prompt: 'On each line of an invoice, do you ever need discounts or extra fees?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Capabilities',
    question_number: 5,
    sdf_mapping: { target: 'modules.invoice.calculation_engine.enabled' },
    sdf_impact_notes: 'Enables modules.invoice.calculation_engine with entity refs (invoice_entity, item_entity). Adds discount_total and additional_charges_total fields to invoices header. Adds line-level fields to invoice_items: line_subtotal, line_discount_type [Percent/Fixed], line_discount_value, line_discount_amount, line_tax_rate, line_tax_amount, line_charges. Wires InvoiceCalculationEngineMixin instead of InvoiceItemsMixin.',
    order_index: 4,
  },
  {
    key: 'invoice_payment_terms',
    prompt: 'When do your customers usually pay?',
    type: 'choice',
    options: ['Immediately', 'Within 15 days', 'Within 30 days', 'Within 60 days'],
    allow_custom: true,
    required: true,
    section: 'Invoice Setup',
    question_number: 6,
    sdf_mapping: { target: 'modules.invoice.default_payment_terms' },
    sdf_impact_notes: 'Sets modules.invoice.default_payment_terms string (e.g. "net_30"). Pre-fills the due_date on new invoices relative to issue_date.',
    order_index: 5,
  },
  {
    key: 'invoice_recurring',
    prompt: 'Do you send the same invoice to any customer every month (e.g. subscriptions, rent, retainers)?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Capabilities',
    question_number: 7,
    sdf_mapping: { target: 'modules.invoice.recurring_billing.enabled' },
    sdf_impact_notes: 'Enables modules.invoice.recurring_billing with schedule entity. Creates recurring_invoice_schedules entity (customer_id, template_invoice_id, frequency, next_run_date, status). Wires auto-generation cron logic.',
    order_index: 6,
  },
  {
    key: 'invoice_print',
    prompt: 'Do you want to print or download invoices as PDF?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Extras',
    question_number: 8,
    sdf_mapping: { target: 'entities.invoices.features.print_invoice' },
    sdf_impact_notes: 'Sets entities.invoices.features.print_invoice = true. Enables print/download button on the invoice form page in the generated frontend.',
    order_index: 7,
  },

  // Plan C — cross-pack link toggles. Visible only when both ends are on.
  {
    key: 'invoice_stock_link',
    prompt: 'When you invoice something you stock, should we lower inventory at the same time?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Capabilities',
    question_number: 9,
    sdf_mapping: { target: 'modules.invoice.stock_link.enabled' },
    sdf_impact_notes:
      'When yes, posting a line invoice creates a stock issue movement for each stocked SKU. Off by default (heavier link).',
    order_index: 8,
    condition: {
      op: 'all',
      rules: [
        { question_key: 'INVOICE_MODULE', equals: 'yes' },
        { question_key: 'INVENTORY_MODULE', equals: 'yes' },
      ],
    },
  },
  {
    key: 'invoice_ap_link',
    prompt: 'When you receive goods from a supplier, should we draft a supplier bill automatically?',
    type: 'yes_no',
    required: true,
    section: 'Invoice Capabilities',
    question_number: 10,
    sdf_mapping: { target: 'modules.invoice.ap_link.enabled' },
    sdf_impact_notes:
      'When yes, a posted goods_receipts row drafts an invoices row in AP mode using the PO supplier and line totals. Off by default.',
    order_index: 9,
    condition: {
      op: 'all',
      rules: [
        { question_key: 'invoice_enable_payments', equals: 'yes' },
        { question_key: 'inv_enable_inbound', equals: 'yes' },
      ],
    },
  },

  // Plan I — payment-method enum + installments shape (issue #8).
  // Drives entities.invoice_payments.fields.payment_method.options. The
  // prefilled SDF builder defaults to ['Cash','Credit Card','Debit Card']
  // when this answer is empty. When 'Credit Card' is among the chosen
  // methods, the builder also emits an `installments` integer field
  // (visibility_when payment_method=Credit Card) plus a paired
  // `conditional_required` invariant on invoice_payments.relations[].
  {
    key: 'invoice_payment_methods',
    prompt: 'Which payment methods do your customers use?',
    type: 'multi_choice',
    options: ['Cash', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Other'],
    allow_custom: true,
    required: true,
    section: 'Invoice Setup',
    question_number: 11,
    sdf_mapping: { target: 'entities.invoice_payments.fields.payment_method.options' },
    sdf_impact_notes:
      'Sets the options array on the payment_method field of invoice_payments. Defaults to ["Cash","Credit Card","Debit Card"] when unanswered. When "Credit Card" is in the list an `installments` integer field is emitted with visibility_when payment_method="Credit Card" plus a paired conditional_required invariant.',
    order_index: 10,
    condition: {
      op: 'all',
      rules: [{ question_key: 'invoice_enable_payments', equals: 'yes' }],
    },
  },
];

module.exports = {
  module: 'invoice',
  version: 'invoice.v4',
  template_type: 'sdf_impact_only',
  getQuestions() {
    return JSON.parse(JSON.stringify(INVOICE_V4_QUESTIONS));
  },
};
