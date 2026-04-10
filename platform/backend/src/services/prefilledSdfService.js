function toBoolYes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).toLowerCase()).includes('yes');
  }
  return String(value || '').trim().toLowerCase() === 'yes';
}

function toBatchTrackingEnabled(value) {
  const normalized = String(Array.isArray(value) ? value.join(',') : (value || ''))
    .trim()
    .toLowerCase();

  if (!normalized) return false;
  if (normalized === 'yes') return true;

  if (
    normalized.includes('no traceability') ||
    normalized === 'no' ||
    normalized.includes('none')
  ) {
    return false;
  }

  return normalized.includes('batch') || normalized.includes('lot');
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseMultiChoice(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const raw = String(value || '').trim();
  if (!raw) return [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function normalizeCurrency(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw || raw === 'CUSTOM' || raw === 'OTHER') return 'USD';
  return raw;
}

function buildInventoryEntities(answers) {
  const stockSlug = 'products';
  const stockDisplay = 'Products';

  const multiLocation = toBoolYes(answers.inv_multi_location);
  const batchTracking = toBatchTrackingEnabled(answers.inv_batch_tracking);
  const serialTracking = toBoolYes(answers.inv_serial_tracking);
  const expiryTracking = toBoolYes(answers.inv_expiry_tracking);
  const reservationsEnabled = toBoolYes(answers.inv_enable_reservations);
  const inboundEnabled = toBoolYes(answers.inv_enable_inbound);
  const cycleCountEnabled = toBoolYes(answers.inv_enable_cycle_counting);
  const costingRaw = String(answers.inv_costing_method || '').trim().toLowerCase();
  const hasCostingMethod = costingRaw.startsWith('fifo') || costingRaw.startsWith('weighted');

  const productFields = [
    { name: 'name', type: 'string', required: true },
    { name: 'sku', type: 'string', unique: true },
    { name: 'quantity', type: 'integer', required: true },
    { name: 'reorder_point', type: 'integer' },
  ];

  if (hasCostingMethod) {
    productFields.push({ name: 'cost_price', type: 'decimal' });
    productFields.push({ name: 'total_value', type: 'decimal' });
  }

  if (reservationsEnabled) {
    productFields.push({ name: 'reserved_quantity', type: 'integer' });
    productFields.push({ name: 'committed_quantity', type: 'integer' });
    productFields.push({ name: 'available_quantity', type: 'integer' });
  }

  if (batchTracking) {
    productFields.push({ name: 'batch_number', type: 'string' });
  }
  if (serialTracking) {
    productFields.push({ name: 'serial_number', type: 'string', unique: true });
  }
  if (expiryTracking) {
    productFields.push({ name: 'expiry_date', type: 'date' });
  }

  const features = {
    multi_location: multiLocation,
    batch_tracking: batchTracking,
    serial_tracking: serialTracking,
  };
  if (expiryTracking) {
    features.expiry_tracking = true;
  }

  const inventoryOps = {
    enabled: true,
    receive: { enabled: true },
    issue: {
      enabled: true,
      allow_negative_stock: toBoolYes(answers.inv_allow_negative_stock),
    },
    adjust: { enabled: true },
  };
  if (multiLocation) {
    inventoryOps.transfer = { enabled: true };
  }

  const productEntity = {
    slug: stockSlug,
    display_name: stockDisplay,
    module: 'inventory',
    fields: productFields,
    inventory_ops: inventoryOps,
    features,
  };

  if (toBoolYes(answers.inv_qr_labels)) {
    productEntity.labels = { enabled: true, type: 'qrcode' };
  }

  const entities = [productEntity];

  if (multiLocation) {
    entities.push({
      slug: 'locations',
      display_name: 'Locations',
      module: 'inventory',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'code', type: 'string', unique: true },
      ],
    });

    productEntity.fields.push({
      name: 'location_id',
      type: 'reference',
      reference_entity: 'locations',
    });
  }

  const movementFields = [
    { name: 'item_id', type: 'reference', reference_entity: stockSlug, required: true },
    { name: 'movement_type', type: 'string', required: true, options: ['Receive', 'Issue', 'Adjust', 'Transfer'] },
    { name: 'quantity', type: 'integer', required: true },
    { name: 'movement_date', type: 'date', required: true },
    { name: 'reason', type: 'string' },
    { name: 'reference_number', type: 'string' },
  ];
  if (multiLocation) {
    movementFields.push({ name: 'location_id', type: 'reference', reference_entity: 'locations' });
    movementFields.push({ name: 'from_location_id', type: 'string' });
    movementFields.push({ name: 'to_location_id', type: 'string' });
  }
  if (batchTracking) {
    movementFields.push({ name: 'batch_number', type: 'string' });
  }
  if (serialTracking) {
    movementFields.push({ name: 'serial_number', type: 'string' });
  }
  entities.push({
    slug: 'stock_movements',
    display_name: 'Stock Movements',
    module: 'inventory',
    fields: movementFields,
  });

  if (reservationsEnabled) {
    entities.push({
      slug: 'stock_reservations',
      display_name: 'Stock Reservations',
      module: 'inventory',
      fields: [
        { name: 'reservation_number', type: 'string', unique: true },
        { name: 'item_id', type: 'reference', reference_entity: stockSlug, required: true },
        { name: 'quantity', type: 'integer', required: true },
        { name: 'status', type: 'string', required: true, options: ['Pending', 'Released', 'Committed'] },
        { name: 'source_reference', type: 'string' },
        { name: 'note', type: 'text' },
        { name: 'reserved_at', type: 'datetime' },
      ],
    });
  }

  if (inboundEnabled) {
    entities.push({
      slug: 'purchase_orders',
      display_name: 'Purchase Orders',
      module: 'inventory',
      fields: [
        { name: 'po_number', type: 'string', required: true, unique: true },
        { name: 'supplier_name', type: 'string', required: true },
        { name: 'status', type: 'string', required: true, options: ['Open', 'Partial', 'Received', 'Cancelled'] },
        { name: 'order_date', type: 'date', required: true },
        { name: 'notes', type: 'text' },
      ],
    });
    entities.push({
      slug: 'purchase_order_items',
      display_name: 'Purchase Order Items',
      module: 'inventory',
      fields: [
        { name: 'purchase_order_id', type: 'reference', reference_entity: 'purchase_orders', required: true },
        { name: 'item_id', type: 'reference', reference_entity: stockSlug, required: true },
        { name: 'ordered_quantity', type: 'integer', required: true },
        { name: 'received_quantity', type: 'integer' },
        { name: 'status', type: 'string', options: ['Open', 'Partial', 'Received'] },
      ],
    });
    entities.push({
      slug: 'goods_receipts',
      display_name: 'Goods Receipts',
      module: 'inventory',
      fields: [
        { name: 'grn_number', type: 'string', unique: true },
        { name: 'purchase_order_id', type: 'reference', reference_entity: 'purchase_orders' },
        { name: 'status', type: 'string', required: true, options: ['Draft', 'Posted', 'Cancelled'] },
        { name: 'received_at', type: 'datetime' },
        { name: 'posted_at', type: 'datetime' },
        { name: 'cancelled_at', type: 'datetime' },
        { name: 'note', type: 'text' },
      ],
    });
    entities.push({
      slug: 'goods_receipt_items',
      display_name: 'Goods Receipt Items',
      module: 'inventory',
      fields: [
        { name: 'goods_receipt_id', type: 'reference', reference_entity: 'goods_receipts', required: true },
        { name: 'purchase_order_item_id', type: 'reference', reference_entity: 'purchase_order_items' },
        { name: 'item_id', type: 'reference', reference_entity: stockSlug, required: true },
        { name: 'received_quantity', type: 'integer', required: true },
        { name: 'accepted_quantity', type: 'integer' },
      ],
    });
  }

  if (cycleCountEnabled) {
    entities.push({
      slug: 'cycle_count_sessions',
      display_name: 'Cycle Count Sessions',
      module: 'inventory',
      fields: [
        { name: 'session_number', type: 'string', unique: true },
        { name: 'status', type: 'string', required: true, options: ['Draft', 'InProgress', 'PendingApproval', 'Approved', 'Posted'] },
        { name: 'started_at', type: 'datetime' },
        { name: 'approved_at', type: 'datetime' },
        { name: 'approved_by', type: 'string' },
        { name: 'posted_at', type: 'datetime' },
        { name: 'note', type: 'text' },
      ],
    });
    entities.push({
      slug: 'cycle_count_lines',
      display_name: 'Cycle Count Lines',
      module: 'inventory',
      fields: [
        { name: 'cycle_count_session_id', type: 'reference', reference_entity: 'cycle_count_sessions', required: true },
        { name: 'item_id', type: 'reference', reference_entity: stockSlug, required: true },
        { name: 'expected_quantity', type: 'integer' },
        { name: 'counted_quantity', type: 'integer' },
        { name: 'variance_quantity', type: 'integer' },
        { name: 'status', type: 'string', options: ['Pending', 'Counted', 'Posted'] },
      ],
    });
  }

  return entities;
}

function buildInvoiceEntities(answers) {
  const paymentsOn = toBoolYes(answers.invoice_enable_payments);
  const notesOn = toBoolYes(answers.invoice_enable_notes);
  const calcEngineOn = toBoolYes(answers.invoice_enable_calc_engine);

  const invoiceFields = [
    { name: 'invoice_number', type: 'string', required: true, unique: true },
    { name: 'customer_id', type: 'reference', reference_entity: 'customers', required: true },
    { name: 'issue_date', type: 'date', required: true },
    { name: 'due_date', type: 'date', required: true },
    { name: 'status', type: 'string', required: true, options: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'] },
    { name: 'subtotal', type: 'decimal' },
    { name: 'tax_total', type: 'decimal' },
    { name: 'grand_total', type: 'decimal' },
    { name: 'paid_total', type: 'decimal' },
    { name: 'outstanding_balance', type: 'decimal' },
    { name: 'idempotency_key', type: 'string' },
    { name: 'posted_at', type: 'datetime' },
    { name: 'cancelled_at', type: 'datetime' },
  ];

  if (calcEngineOn) {
    invoiceFields.push({ name: 'discount_total', type: 'decimal' });
    invoiceFields.push({ name: 'additional_charges_total', type: 'decimal' });
  }

  const invoiceEntity = {
    slug: 'invoices',
    display_name: 'Invoices',
    module: 'invoice',
    fields: invoiceFields,
  };

  if (toBoolYes(answers.invoice_print)) {
    invoiceEntity.features = { print_invoice: true };
  }

  const itemFields = [
    { name: 'invoice_id', type: 'reference', reference_entity: 'invoices', required: true },
    { name: 'description', type: 'string', required: true },
    { name: 'quantity', type: 'decimal', required: true },
    { name: 'unit_price', type: 'decimal', required: true },
    { name: 'line_total', type: 'decimal' },
  ];

  if (calcEngineOn) {
    itemFields.push({ name: 'line_subtotal', type: 'decimal' });
    itemFields.push({ name: 'line_discount_type', type: 'string', options: ['Percent', 'Fixed'] });
    itemFields.push({ name: 'line_discount_value', type: 'decimal' });
    itemFields.push({ name: 'line_discount_amount', type: 'decimal' });
    itemFields.push({ name: 'line_tax_rate', type: 'decimal' });
    itemFields.push({ name: 'line_tax_amount', type: 'decimal' });
    itemFields.push({ name: 'line_charges', type: 'decimal' });
  }

  const entities = [
    {
      slug: 'customers',
      display_name: 'Customers',
      module: 'shared',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'company_name', type: 'string' },
        { name: 'email', type: 'string', required: true },
        { name: 'phone', type: 'string' },
        { name: 'address', type: 'text' },
      ],
    },
    invoiceEntity,
    {
      slug: 'invoice_items',
      display_name: 'Invoice Items',
      module: 'invoice',
      fields: itemFields,
    },
  ];

  if (paymentsOn) {
    entities.push({
      slug: 'invoice_payments',
      display_name: 'Invoice Payments',
      module: 'invoice',
      fields: [
        { name: 'payment_number', type: 'string', unique: true },
        { name: 'invoice_id', type: 'reference', reference_entity: 'invoices', required: true },
        { name: 'amount', type: 'decimal', required: true },
        { name: 'payment_date', type: 'date', required: true },
        { name: 'payment_method', type: 'string' },
        { name: 'status', type: 'string', options: ['Draft', 'Posted', 'Cancelled'] },
        { name: 'reference_number', type: 'string' },
        { name: 'posted_at', type: 'datetime' },
        { name: 'cancelled_at', type: 'datetime' },
        { name: 'cancel_reason', type: 'text' },
        { name: 'note', type: 'text' },
      ],
    });
    entities.push({
      slug: 'invoice_payment_allocations',
      display_name: 'Invoice Payment Allocations',
      module: 'invoice',
      fields: [
        { name: 'payment_id', type: 'reference', reference_entity: 'invoice_payments', required: true },
        { name: 'invoice_id', type: 'reference', reference_entity: 'invoices', required: true },
        { name: 'amount', type: 'decimal', required: true },
      ],
    });
  }

  if (notesOn) {
    entities.push({
      slug: 'invoice_notes',
      display_name: 'Invoice Notes',
      module: 'invoice',
      fields: [
        { name: 'note_number', type: 'string', unique: true },
        { name: 'source_invoice_id', type: 'reference', reference_entity: 'invoices', required: true },
        { name: 'note_type', type: 'string', required: true, options: ['Credit', 'Debit'] },
        { name: 'amount', type: 'decimal', required: true },
        { name: 'tax_total', type: 'decimal' },
        { name: 'grand_total', type: 'decimal' },
        { name: 'status', type: 'string', options: ['Draft', 'Posted', 'Cancelled'] },
        { name: 'issue_date', type: 'date' },
        { name: 'reason', type: 'text' },
        { name: 'post_reference', type: 'string' },
        { name: 'posted_at', type: 'datetime' },
        { name: 'cancelled_at', type: 'datetime' },
        { name: 'cancel_reason', type: 'text' },
        { name: 'note', type: 'text' },
      ],
    });
  }

  return entities;
}

function buildHrEntities(answers) {
  const leaveEngineOn = toBoolYes(answers.hr_enable_leave_engine);
  const leaveApprovalsOn = toBoolYes(answers.hr_enable_leave_approvals);
  const attendanceOn = toBoolYes(answers.hr_enable_attendance_time);
  const compensationOn = toBoolYes(answers.hr_enable_compensation_ledger);

  const entities = [];

  entities.push({
    slug: 'departments',
    display_name: 'Departments',
    module: 'hr',
    fields: [
      { name: 'name', type: 'string', required: true, unique: true },
      { name: 'location', type: 'string' },
    ],
  });

  const employeeFields = [
    { name: 'first_name', type: 'string', required: true },
    { name: 'last_name', type: 'string', required: true },
    { name: 'email', type: 'string', required: true, unique: true },
    { name: 'job_title', type: 'string', required: true },
    { name: 'hire_date', type: 'date', required: true },
    { name: 'status', type: 'string', required: true, options: ['Active', 'On Leave', 'Terminated'] },
    { name: 'department_id', type: 'reference', reference_entity: 'departments', required: true },
    { name: 'manager_id', type: 'reference', reference_entity: 'employees' },
  ];

  if (compensationOn) {
    employeeFields.push({ name: 'salary', type: 'decimal' });
  }

  entities.push({
    slug: 'employees',
    display_name: 'Employees',
    module: 'hr',
    fields: employeeFields,
  });

  if (leaveEngineOn || leaveApprovalsOn) {
    const userLeaveTypes = parseMultiChoice(answers.hr_leave_types);
    const leaveTypeMap = {
      'Sick Leave': 'Sick',
      'Vacation / Annual': 'Vacation',
      'Unpaid Leave': 'Unpaid',
      'Maternity / Paternity': 'Maternity',
      'Personal / Family': 'Personal',
    };
    const resolvedLeaveTypes = userLeaveTypes.length
      ? userLeaveTypes.map((t) => leaveTypeMap[t] || t)
      : ['Sick', 'Vacation', 'Unpaid'];

    const leaveFields = [
      { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
      { name: 'leave_type', type: 'string', required: true, options: resolvedLeaveTypes },
      { name: 'start_date', type: 'date', required: true },
      { name: 'end_date', type: 'date', required: true },
      { name: 'leave_days', type: 'integer' },
      { name: 'status', type: 'string', required: true, options: ['Pending', 'Approved', 'Rejected', 'Cancelled'] },
      { name: 'approver_id', type: 'string' },
      { name: 'approved_at', type: 'datetime' },
      { name: 'rejected_at', type: 'datetime' },
      { name: 'cancelled_at', type: 'datetime' },
      { name: 'rejection_reason', type: 'text' },
      { name: 'decision_key', type: 'string' },
    ];
    entities.push({
      slug: 'leaves',
      display_name: 'Leaves',
      module: 'hr',
      fields: leaveFields,
    });
  }

  if (leaveEngineOn) {
    entities.push({
      slug: 'leave_balances',
      display_name: 'Leave Balances',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'leave_type', type: 'string', required: true },
        { name: 'year', type: 'string', required: true },
        { name: 'annual_entitlement', type: 'decimal' },
        { name: 'accrued_days', type: 'decimal' },
        { name: 'consumed_days', type: 'decimal' },
        { name: 'carry_forward_days', type: 'decimal' },
        { name: 'available_days', type: 'decimal' },
        { name: 'last_accrual_at', type: 'datetime' },
        { name: 'note', type: 'text' },
      ],
    });
  }

  if (attendanceOn) {
    entities.push({
      slug: 'attendance_entries',
      display_name: 'Attendance Entries',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'work_date', type: 'date', required: true },
        { name: 'check_in_at', type: 'datetime' },
        { name: 'check_out_at', type: 'datetime' },
        { name: 'worked_hours', type: 'decimal' },
        { name: 'status', type: 'string', options: ['Present', 'Absent', 'Half Day', 'On Leave'] },
        { name: 'note', type: 'text' },
      ],
    });
    entities.push({
      slug: 'shift_assignments',
      display_name: 'Shift Assignments',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'shift_name', type: 'string', required: true },
        { name: 'start_time', type: 'string' },
        { name: 'end_time', type: 'string' },
        { name: 'work_date', type: 'date' },
      ],
    });
    entities.push({
      slug: 'timesheet_entries',
      display_name: 'Timesheet Entries',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'work_date', type: 'date', required: true },
        { name: 'attendance_id', type: 'reference', reference_entity: 'attendance_entries' },
        { name: 'regular_hours', type: 'decimal' },
        { name: 'overtime_hours', type: 'decimal' },
        { name: 'status', type: 'string', options: ['Draft', 'Approved'] },
      ],
    });
  }

  if (compensationOn) {
    entities.push({
      slug: 'compensation_ledger',
      display_name: 'Compensation Ledger',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'pay_period', type: 'string', required: true },
        { name: 'component', type: 'string', required: true },
        { name: 'component_type', type: 'string', required: true, options: ['Earning', 'Deduction'] },
        { name: 'amount', type: 'decimal', required: true },
        { name: 'status', type: 'string', options: ['Draft', 'Posted', 'Cancelled'] },
        { name: 'posted_at', type: 'datetime' },
        { name: 'post_reference', type: 'string' },
      ],
    });
    entities.push({
      slug: 'compensation_snapshots',
      display_name: 'Compensation Snapshots',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'pay_period', type: 'string', required: true },
        { name: 'gross_amount', type: 'decimal' },
        { name: 'deduction_amount', type: 'decimal' },
        { name: 'net_amount', type: 'decimal' },
        { name: 'status', type: 'string', options: ['Draft', 'Posted'] },
        { name: 'posted_at', type: 'datetime' },
        { name: 'note', type: 'text' },
      ],
    });
  }

  return entities;
}

function buildPrefilledSdfDraft({ projectName, modules, mandatoryAnswers, templateVersions }) {
  const selectedModules = Array.isArray(modules) ? modules : [];
  const answers = mandatoryAnswers || {};

  const sdf = {
    project_name: projectName || 'CustomERP Draft',
    modules: {},
    entities: [],
    clarifications_needed: [],
    constraints: {
      mandatory_answers: answers,
      template_versions: templateVersions || {},
    },
  };

  if (selectedModules.includes('inventory')) {
    const inventoryEntities = buildInventoryEntities(answers);
    const reservationsOn = toBoolYes(answers.inv_enable_reservations);
    const inboundOn = toBoolYes(answers.inv_enable_inbound);
    const cycleCountOn = toBoolYes(answers.inv_enable_cycle_counting);

    const costingRaw = String(answers.inv_costing_method || '').trim().toLowerCase();
    let costingMethod = null;
    if (costingRaw.startsWith('fifo')) costingMethod = 'fifo';
    else if (costingRaw.startsWith('weighted')) costingMethod = 'weighted_average';

    sdf.modules.inventory = {
      enabled: true,
      stock_entity: 'products',
      costing_method: costingMethod,
      transactions: { enabled: true, stock_entity: 'products', movement_entity: 'stock_movements' },
      reservations: reservationsOn
        ? { enabled: true, reservation_entity: 'stock_reservations', stock_entity: 'products' }
        : { enabled: false },
      inbound: inboundOn
        ? {
            enabled: true,
            stock_entity: 'products',
            purchase_order_entity: 'purchase_orders',
            purchase_order_item_entity: 'purchase_order_items',
            grn_entity: 'goods_receipts',
            grn_item_entity: 'goods_receipt_items',
          }
        : { enabled: false },
      cycle_counting: cycleCountOn
        ? {
            enabled: true,
            stock_entity: 'products',
            session_entity: 'cycle_count_sessions',
            line_entity: 'cycle_count_lines',
          }
        : { enabled: false },
    };
    if (toBoolYes(answers.inv_low_stock_alerts) || toBoolYes(answers.inv_expiry_tracking)) {
      sdf.modules.inventory_dashboard = {
        low_stock: { enabled: toBoolYes(answers.inv_low_stock_alerts) },
        expiry: { enabled: toBoolYes(answers.inv_expiry_tracking) },
      };
    }
    sdf.entities.push(...inventoryEntities);
  }

  if (selectedModules.includes('invoice')) {
    const paymentsOn = toBoolYes(answers.invoice_enable_payments);
    const notesOn = toBoolYes(answers.invoice_enable_notes);
    const calcEngineOn = toBoolYes(answers.invoice_enable_calc_engine);
    const invoiceEntities = buildInvoiceEntities(answers);

    const paymentTermsMap = {
      'Immediately': 'due_on_receipt',
      'Within 15 days': 'net_15',
      'Within 30 days': 'net_30',
      'Within 60 days': 'net_60',
    };
    const rawTerms = String(answers.invoice_payment_terms || '').trim();
    const defaultPaymentTerms = paymentTermsMap[rawTerms] || rawTerms || 'net_30';
    const recurringOn = toBoolYes(answers.invoice_recurring);

    sdf.modules.invoice = {
      enabled: true,
      currency: normalizeCurrency(answers.invoice_currency),
      tax_rate: toNumber(answers.invoice_tax_rate, 0),
      default_payment_terms: defaultPaymentTerms,
      prefix: 'INV-',
      invoice_entity: 'invoices',
      item_entity: 'invoice_items',
      customer_entity: 'customers',
      transactions: {
        enabled: true,
        invoice_entity: 'invoices',
      },
      payments: paymentsOn
        ? {
            enabled: true,
            invoice_entity: 'invoices',
            payment_entity: 'invoice_payments',
            allocation_entity: 'invoice_payment_allocations',
          }
        : { enabled: false },
      notes: notesOn
        ? {
            enabled: true,
            invoice_entity: 'invoices',
            note_entity: 'invoice_notes',
          }
        : { enabled: false },
      lifecycle: {
        enabled: true,
        enforce_transitions: true,
        statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
      },
      calculation_engine: calcEngineOn
        ? {
            enabled: true,
            invoice_entity: 'invoices',
            item_entity: 'invoice_items',
          }
        : { enabled: false },
      recurring_billing: recurringOn
        ? { enabled: true, schedule_entity: 'recurring_invoice_schedules' }
        : { enabled: false },
    };
    sdf.entities.push(...invoiceEntities);
    if (recurringOn) {
      sdf.entities.push({
        slug: 'recurring_invoice_schedules',
        display_name: 'Recurring Invoice Schedules',
        module: 'invoice',
        fields: [
          { name: 'customer_id', type: 'reference', reference_entity: 'customers', required: true },
          { name: 'template_invoice_id', type: 'reference', reference_entity: 'invoices' },
          { name: 'frequency', type: 'string', required: true, options: ['Weekly', 'Monthly', 'Quarterly', 'Yearly'] },
          { name: 'next_run_date', type: 'date', required: true },
          { name: 'status', type: 'string', options: ['Active', 'Paused', 'Cancelled'] },
          { name: 'note', type: 'text' },
        ],
      });
    }
  }

  if (selectedModules.includes('hr')) {
    const workDays = parseMultiChoice(answers.hr_work_days);
    const dailyHours = toNumber(answers.hr_daily_hours, 8);
    const resolvedWorkDays = workDays.length ? workDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const leaveEngineOn = toBoolYes(answers.hr_enable_leave_engine);
    const leaveApprovalsOn = toBoolYes(answers.hr_enable_leave_approvals);
    const attendanceOn = toBoolYes(answers.hr_enable_attendance_time);
    const compensationOn = toBoolYes(answers.hr_enable_compensation_ledger);
    const hrEntities = buildHrEntities(answers);

    sdf.modules.hr = {
      enabled: true,
      work_days: resolvedWorkDays,
      daily_hours: dailyHours,
      employee_entity: 'employees',
      department_entity: 'departments',
      leave_engine: leaveEngineOn
        ? {
            enabled: true,
            leave_entity: 'leaves',
            balance_entity: 'leave_balances',
            work_days: resolvedWorkDays,
            daily_hours: dailyHours,
            consume_on_approval: leaveApprovalsOn,
          }
        : { enabled: false },
      leave_approvals: leaveApprovalsOn
        ? {
            enabled: true,
            enforce_transitions: true,
            leave_entity: 'leaves',
            balance_entity: 'leave_balances',
            work_days: resolvedWorkDays,
            daily_hours: dailyHours,
          }
        : { enabled: false },
      attendance_time: attendanceOn
        ? {
            enabled: true,
            attendance_entity: 'attendance_entries',
            shift_entity: 'shift_assignments',
            timesheet_entity: 'timesheet_entries',
            work_days: resolvedWorkDays,
            daily_hours: dailyHours,
          }
        : { enabled: false },
      compensation_ledger: compensationOn
        ? {
            enabled: true,
            ledger_entity: 'compensation_ledger',
            snapshot_entity: 'compensation_snapshots',
          }
        : { enabled: false },
    };
    sdf.entities.push(...hrEntities);
  }

  return sdf;
}

function buildPrefilledFromQuestionnaireState({ projectName, questionnaireState }) {
  const state = questionnaireState || {};
  const modules = Array.isArray(state.modules) ? state.modules : [];
  const completion = state.completion || {};
  const mandatoryAnswers = state.mandatory_answers || {};
  const templateVersions = state.template_versions || {};

  const prefilledSdf = buildPrefilledSdfDraft({
    projectName,
    modules,
    mandatoryAnswers,
    templateVersions,
  });

  return {
    prefilled_sdf: prefilledSdf,
    validation: {
      is_complete: completion.is_complete === true,
      total_required_visible: completion.total_required_visible || 0,
      answered_required_visible: completion.answered_required_visible || 0,
      missing_required_question_ids: completion.missing_required_question_ids || [],
      missing_required_question_keys: completion.missing_required_question_keys || [],
    },
  };
}

module.exports = {
  buildPrefilledSdfDraft,
  buildPrefilledFromQuestionnaireState,
};
