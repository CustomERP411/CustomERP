function toBoolYes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).toLowerCase()).includes('yes');
  }
  return String(value || '').trim().toLowerCase() === 'yes';
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeKey(value, fallback) {
  const cleaned = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) return fallback;
  return cleaned;
}

function slugifyLabel(value, fallback) {
  const cleaned = normalizeKey(value, '');
  if (!cleaned) return fallback;
  return cleaned.endsWith('s') ? cleaned : `${cleaned}s`;
}

function titleCase(value) {
  return String(value || '')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
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

function parseDailyHours(value) {
  const direct = toNumber(value, NaN);
  if (Number.isFinite(direct)) return direct;

  const match = String(value || '').match(/-?\d+(\.\d+)?/);
  if (match && match[0]) {
    return toNumber(match[0], 8);
  }
  return 8;
}

function normalizeWorkDays(value) {
  const allowed = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const aliasToCanonical = {
    monday: 'Mon',
    mon: 'Mon',
    tuesday: 'Tue',
    tue: 'Tue',
    wednesday: 'Wed',
    wed: 'Wed',
    thursday: 'Thu',
    thu: 'Thu',
    friday: 'Fri',
    fri: 'Fri',
    saturday: 'Sat',
    sat: 'Sat',
    sunday: 'Sun',
    sun: 'Sun',
  };

  const normalized = parseMultiChoice(value)
    .map((entry) => aliasToCanonical[String(entry || '').trim().toLowerCase()] || null)
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  return unique.length ? unique : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
}

function resolveEntityIdentity({ useDefaultNames, customValue, fallbackSlug, fallbackDisplayName }) {
  if (useDefaultNames) {
    return {
      slug: fallbackSlug,
      displayName: fallbackDisplayName,
    };
  }

  const rawCustom = String(customValue || '').trim();
  if (!rawCustom) {
    return {
      slug: fallbackSlug,
      displayName: fallbackDisplayName,
    };
  }

  return {
    slug: slugifyLabel(rawCustom, fallbackSlug),
    displayName: titleCase(rawCustom),
  };
}

function buildInventoryEntities(answers) {
  const itemLabel = answers.inv_item_label || 'Products';
  const itemSlug = slugifyLabel(itemLabel, 'products');
  const itemDisplayName = titleCase(itemLabel || 'Products');

  const productFields = [
    { name: 'name', type: 'string', required: true },
    { name: 'sku', type: 'string', unique: true },
    { name: 'quantity', type: 'integer', required: true },
    { name: 'reorder_point', type: 'integer' },
  ];

  if (toBoolYes(answers.inv_use_categories)) {
    productFields.push({ name: 'category', type: 'string' });
  }

  if (toBoolYes(answers.inv_need_expiry_tracking)) {
    productFields.push({ name: 'expiry_date', type: 'date' });
  }

  if (toBoolYes(answers.inv_need_batch_tracking)) {
    productFields.push({ name: 'batch_number', type: 'string' });
  }

  if (toBoolYes(answers.inv_need_serial_tracking)) {
    productFields.push({ name: 'serial_number', type: 'string', unique: true });
  }

  const entities = [
    {
      slug: itemSlug,
      display_name: itemDisplayName,
      module: 'inventory',
      fields: productFields,
      inventory_ops: {
        enabled: true,
        receive: { enabled: toBoolYes(answers.inv_track_incoming) },
        issue: { enabled: toBoolYes(answers.inv_track_outgoing), label: answers.inv_outgoing_label || 'Issue' },
        adjust: { enabled: toBoolYes(answers.inv_enable_adjustments) },
      },
      features: {
        low_stock_alerts: toBoolYes(answers.inv_need_low_stock_alerts),
        costing: toBoolYes(answers.inv_need_costing),
      },
    },
  ];

  if (toBoolYes(answers.inv_use_locations)) {
    entities.push({
      slug: 'locations',
      display_name: 'Locations',
      module: 'inventory',
      fields: [
        { name: 'name', type: 'string', required: true },
        { name: 'code', type: 'string', unique: true },
      ],
    });

    entities[0].fields.push({
      name: 'location_id',
      type: 'reference',
      reference_entity: 'locations',
    });
  }

  if (
    toBoolYes(answers.inv_track_incoming) ||
    toBoolYes(answers.inv_track_outgoing) ||
    toBoolYes(answers.inv_enable_adjustments)
  ) {
    entities.push({
      slug: 'stock_movements',
      display_name: 'Stock Movements',
      module: 'inventory',
      fields: [
        { name: 'item_id', type: 'reference', reference_entity: itemSlug, required: true },
        { name: 'movement_type', type: 'string', required: true, options: ['Receive', 'Issue', 'Adjust', 'Transfer'] },
        { name: 'quantity', type: 'integer', required: true },
        { name: 'movement_date', type: 'date', required: true },
      ],
    });
  }

  return entities;
}

function buildInvoicePrefill(answers) {
  const invoiceEnabled = toBoolYes(answers.invoice_enable_module);

  const transactionsEnabled = invoiceEnabled && toBoolYes(answers.invoice_enable_transactions_pack);
  const paymentsEnabled =
    invoiceEnabled && (toBoolYes(answers.invoice_enable_payments_pack) || toBoolYes(answers.invoice_partial_payments));
  const notesEnabled =
    invoiceEnabled && (toBoolYes(answers.invoice_enable_notes_pack) || toBoolYes(answers.invoice_use_credit_notes));
  const lifecycleEnabled =
    invoiceEnabled &&
    (toBoolYes(answers.invoice_enable_lifecycle_pack) ||
      String(answers.invoice_status_policy || '').toLowerCase().includes('strict'));
  const calcEngineEnabled = invoiceEnabled && toBoolYes(answers.invoice_enable_calc_engine_pack);

  const useDefaultEntityNames = String(answers.invoice_use_default_entity_names || 'yes').trim().toLowerCase() !== 'no';
  const invoiceEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.invoice_entity_name,
    fallbackSlug: 'invoices',
    fallbackDisplayName: 'Invoices',
  });
  const itemEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.invoice_item_entity_name,
    fallbackSlug: 'invoice_items',
    fallbackDisplayName: 'Invoice Items',
  });
  const customerEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.invoice_customer_entity_name,
    fallbackSlug: 'customers',
    fallbackDisplayName: 'Customers',
  });
  const paymentEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.invoice_payment_entity_name,
    fallbackSlug: 'invoice_payments',
    fallbackDisplayName: 'Invoice Payments',
  });
  const allocationEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.invoice_allocation_entity_name,
    fallbackSlug: 'invoice_payment_allocations',
    fallbackDisplayName: 'Invoice Payment Allocations',
  });
  const noteEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.invoice_note_entity_name,
    fallbackSlug: 'invoice_notes',
    fallbackDisplayName: 'Invoice Notes',
  });

  const useDefaultStatusField =
    String(answers.invoice_lifecycle_use_default_status_field || 'yes').trim().toLowerCase() !== 'no';
  const statusField = useDefaultStatusField
    ? 'status'
    : normalizeKey(answers.invoice_status_field_name_custom, 'status');

  const useDefaultItemFieldNames =
    String(answers.invoice_use_default_item_field_names || 'yes').trim().toLowerCase() !== 'no';
  const itemQuantityField = useDefaultItemFieldNames
    ? 'quantity'
    : normalizeKey(answers.invoice_item_quantity_field_name, 'quantity');
  const itemUnitPriceField = useDefaultItemFieldNames
    ? 'unit_price'
    : normalizeKey(answers.invoice_item_unit_price_field_name, 'unit_price');
  const itemTaxTotalField = useDefaultItemFieldNames
    ? 'line_tax_total'
    : normalizeKey(answers.invoice_item_tax_total_field_name, 'line_tax_total');
  const itemLineTotalField = useDefaultItemFieldNames
    ? 'line_total'
    : normalizeKey(answers.invoice_item_line_total_field_name, 'line_total');

  const prefix = String(answers.invoice_prefix || answers.invoice_number_prefix || 'INV-').trim() || 'INV-';

  const moduleConfig = {
    enabled: invoiceEnabled,
    currency: normalizeCurrency(answers.invoice_currency || answers.invoice_default_currency),
    tax_rate: toNumber(answers.invoice_default_tax_rate, 0),
    prefix,
    invoice_entity: invoiceEntity.slug,
    invoice_item_entity: itemEntity.slug,
    customer_entity: customerEntity.slug,
    transactions: {
      enabled: transactionsEnabled,
      invoice_entity: invoiceEntity.slug,
      invoice_item_entity: itemEntity.slug,
      invoice_number_field: 'invoice_number',
      idempotency_field: 'idempotency_key',
      posted_at_field: 'posted_at',
    },
    payments: {
      enabled: paymentsEnabled,
      payment_entity: paymentEntity.slug,
      allocation_entity: allocationEntity.slug,
    },
    notes: {
      enabled: notesEnabled,
      note_entity: noteEntity.slug,
    },
    lifecycle: {
      enabled: lifecycleEnabled,
      status_field: statusField,
      statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
      enforce_transitions: toBoolYes(answers.invoice_enforce_transitions),
    },
    calculation_engine: {
      enabled: calcEngineEnabled,
      invoice_item_entity: itemEntity.slug,
      item_quantity_field: itemQuantityField,
      item_unit_price_field: itemUnitPriceField,
      item_tax_total_field: itemTaxTotalField,
      item_line_total_field: itemLineTotalField,
    },
  };

  if (!invoiceEnabled) {
    return {
      moduleConfig,
      entities: [],
    };
  }

  const entities = [
    {
      slug: customerEntity.slug,
      display_name: customerEntity.displayName,
      module: 'shared',
      fields: [
        { name: 'company_name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'phone', type: 'string' },
        { name: 'address', type: 'text' },
      ],
    },
    {
      slug: invoiceEntity.slug,
      display_name: invoiceEntity.displayName,
      module: 'invoice',
      fields: [
        { name: 'invoice_number', type: 'string', required: true, unique: true },
        { name: 'customer_id', type: 'reference', reference_entity: customerEntity.slug, required: true },
        { name: 'issue_date', type: 'date', required: true },
        { name: 'due_date', type: 'date', required: true },
        { name: statusField, type: 'string', required: true, options: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'] },
        { name: 'subtotal', type: 'decimal', required: true },
        { name: 'tax_total', type: 'decimal', required: true },
        { name: 'discount_total', type: 'decimal', required: true },
        { name: 'additional_charges_total', type: 'decimal', required: true },
        { name: 'grand_total', type: 'decimal', required: true },
        { name: 'paid_total', type: 'decimal' },
        { name: 'outstanding_balance', type: 'decimal', required: true },
        { name: 'idempotency_key', type: 'string' },
        { name: 'posted_at', type: 'datetime' },
        { name: 'cancelled_at', type: 'datetime' },
      ],
    },
  ];

  const itemFields = [];
  const seen = new Set();
  const addField = (field) => {
    const key = String(field?.name || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    itemFields.push(field);
  };

  addField({ name: 'invoice_id', type: 'reference', reference_entity: invoiceEntity.slug, required: true });
  addField({ name: 'description', type: 'string', required: true });
  addField({ name: itemQuantityField, type: 'decimal', required: true });
  addField({ name: itemUnitPriceField, type: 'decimal', required: true });
  addField({ name: 'line_subtotal', type: 'decimal', required: true });
  addField({ name: 'line_discount_type', type: 'string' });
  addField({ name: 'line_discount_value', type: 'decimal', required: true });
  addField({ name: 'line_discount_total', type: 'decimal', required: true });
  addField({ name: 'line_tax_rate', type: 'decimal', required: true });
  addField({ name: itemTaxTotalField, type: 'decimal', required: true });
  addField({ name: 'line_additional_charge', type: 'decimal', required: true });
  addField({ name: itemLineTotalField, type: 'decimal', required: true });

  entities.push({
    slug: itemEntity.slug,
    display_name: itemEntity.displayName,
    module: 'invoice',
    fields: itemFields,
  });

  if (paymentsEnabled) {
    entities.push(
      {
        slug: paymentEntity.slug,
        display_name: paymentEntity.displayName,
        module: 'invoice',
        fields: [
          { name: 'payment_number', type: 'string', required: true, unique: true },
          { name: 'customer_id', type: 'reference', reference_entity: customerEntity.slug, required: true },
          { name: 'payment_date', type: 'date', required: true },
          { name: 'payment_method', type: 'string' },
          { name: 'amount', type: 'decimal', required: true },
          { name: 'unallocated_amount', type: 'decimal', required: true },
          { name: 'status', type: 'string', required: true },
        ],
      },
      {
        slug: allocationEntity.slug,
        display_name: allocationEntity.displayName,
        module: 'invoice',
        fields: [
          { name: 'payment_id', type: 'reference', reference_entity: paymentEntity.slug, required: true },
          { name: 'invoice_id', type: 'reference', reference_entity: invoiceEntity.slug, required: true },
          { name: 'amount', type: 'decimal', required: true },
          { name: 'allocated_at', type: 'datetime' },
        ],
      }
    );
  }

  if (notesEnabled) {
    entities.push({
      slug: noteEntity.slug,
      display_name: noteEntity.displayName,
      module: 'invoice',
      fields: [
        { name: 'note_number', type: 'string', required: true, unique: true },
        { name: 'source_invoice_id', type: 'reference', reference_entity: invoiceEntity.slug, required: true },
        { name: 'note_type', type: 'string', required: true, options: ['Credit', 'Debit'] },
        { name: 'status', type: 'string', required: true },
        { name: 'amount', type: 'decimal', required: true },
        { name: 'tax_total', type: 'decimal' },
        { name: 'grand_total', type: 'decimal' },
        { name: 'posted_at', type: 'datetime' },
      ],
    });
  }

  return {
    moduleConfig,
    entities,
  };
}

function buildHrPrefill(answers) {
  const hrEnabled = toBoolYes(answers.hr_enable_module);
  const leaveEngineEnabled = hrEnabled && toBoolYes(answers.hr_enable_leave_engine_pack);
  const leaveApprovalsEnabled = hrEnabled && toBoolYes(answers.hr_enable_leave_approvals_pack);
  const attendanceTimeEnabled = hrEnabled && toBoolYes(answers.hr_enable_attendance_time_pack);
  const compensationLedgerEnabled = hrEnabled && toBoolYes(answers.hr_enable_compensation_ledger_pack);
  const useDefaultEntityNames = String(answers.hr_use_default_entity_names || 'yes').trim().toLowerCase() !== 'no';

  const employeeEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_employee_entity_name,
    fallbackSlug: 'employees',
    fallbackDisplayName: 'Employees',
  });
  const departmentEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_department_entity_name,
    fallbackSlug: 'departments',
    fallbackDisplayName: 'Departments',
  });
  const leaveEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_leave_entity_name,
    fallbackSlug: 'leaves',
    fallbackDisplayName: 'Leaves',
  });
  const leaveBalanceEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_leave_engine_entity_name,
    fallbackSlug: 'leave_balances',
    fallbackDisplayName: 'Leave Balances',
  });
  const attendanceEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_attendance_entity_name,
    fallbackSlug: 'attendance_entries',
    fallbackDisplayName: 'Attendance Entries',
  });
  const shiftEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_shift_entity_name,
    fallbackSlug: 'shift_assignments',
    fallbackDisplayName: 'Shift Assignments',
  });
  const timesheetEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_timesheet_entity_name,
    fallbackSlug: 'timesheet_entries',
    fallbackDisplayName: 'Timesheet Entries',
  });
  const compensationLedgerEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_compensation_ledger_entity_name,
    fallbackSlug: 'compensation_ledger',
    fallbackDisplayName: 'Compensation Ledger',
  });
  const compensationSnapshotEntity = resolveEntityIdentity({
    useDefaultNames: useDefaultEntityNames,
    customValue: answers.hr_compensation_snapshot_entity_name,
    fallbackSlug: 'compensation_snapshots',
    fallbackDisplayName: 'Compensation Snapshots',
  });

  const useDefaultStatusField = String(answers.hr_leave_use_default_status_field || 'yes').trim().toLowerCase() !== 'no';
  const leaveStatusField = useDefaultStatusField
    ? 'status'
    : normalizeKey(answers.hr_leave_status_field_name_custom, 'status');

  const moduleConfig = {
    enabled: hrEnabled,
    work_days: normalizeWorkDays(answers.hr_work_days),
    daily_hours: parseDailyHours(answers.hr_daily_hours),
    employee_entity: employeeEntity.slug,
    department_entity: departmentEntity.slug,
    leave_entity: leaveEntity.slug,
    leave_enabled: leaveEngineEnabled || leaveApprovalsEnabled,
    attendance_enabled: attendanceTimeEnabled,
    leave_engine: {
      enabled: leaveEngineEnabled,
      leave_entity: leaveEntity.slug,
      balance_entity: leaveBalanceEntity.slug,
      status_field: leaveStatusField,
    },
    leave_approvals: {
      enabled: leaveApprovalsEnabled,
      leave_entity: leaveEntity.slug,
      status_field: leaveStatusField,
      enforce_transitions: toBoolYes(answers.hr_leave_approval_strict_transitions),
    },
    attendance_time: {
      enabled: attendanceTimeEnabled,
      attendance_entity: attendanceEntity.slug,
      shift_entity: shiftEntity.slug,
      timesheet_entity: timesheetEntity.slug,
    },
    compensation_ledger: {
      enabled: compensationLedgerEnabled,
      ledger_entity: compensationLedgerEntity.slug,
      snapshot_entity: compensationSnapshotEntity.slug,
    },
  };

  if (!hrEnabled) {
    return {
      moduleConfig,
      entities: [],
    };
  }

  const entities = [
    {
      slug: departmentEntity.slug,
      display_name: departmentEntity.displayName,
      module: 'hr',
      fields: [
        { name: 'name', type: 'string', required: true, unique: true },
        { name: 'location', type: 'string' },
      ],
    },
    {
      slug: employeeEntity.slug,
      display_name: employeeEntity.displayName,
      module: 'hr',
      fields: [
        { name: 'first_name', type: 'string', required: true },
        { name: 'last_name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true, unique: true },
        { name: 'job_title', type: 'string', required: true },
        { name: 'hire_date', type: 'date', required: true },
        { name: 'status', type: 'string', required: true, options: ['Active', 'On Leave', 'Terminated'] },
        {
          name: 'department_id',
          type: 'reference',
          reference_entity: departmentEntity.slug,
          required: true,
        },
      ],
    },
  ];

  if (leaveEngineEnabled || leaveApprovalsEnabled) {
    entities.push({
      slug: leaveEntity.slug,
      display_name: leaveEntity.displayName,
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
        { name: 'leave_type', type: 'string', required: true },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: leaveStatusField, type: 'string', required: true, options: ['Pending', 'Approved', 'Rejected'] },
        { name: 'approver_id', type: 'reference', reference_entity: employeeEntity.slug },
        { name: 'approved_at', type: 'datetime' },
        { name: 'rejected_at', type: 'datetime' },
      ],
    });
  }

  if (leaveEngineEnabled) {
    entities.push({
      slug: leaveBalanceEntity.slug,
      display_name: leaveBalanceEntity.displayName,
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
        { name: 'leave_type', type: 'string', required: true },
        { name: 'annual_entitlement', type: 'decimal', required: true },
        { name: 'accrued_days', type: 'decimal', required: true },
        { name: 'consumed_days', type: 'decimal', required: true },
        { name: 'carry_forward_days', type: 'decimal', required: true },
        { name: 'available_days', type: 'decimal', required: true },
        { name: 'year', type: 'integer', required: true },
      ],
    });
  }

  if (attendanceTimeEnabled) {
    entities.push(
      {
        slug: attendanceEntity.slug,
        display_name: attendanceEntity.displayName,
        module: 'hr',
        fields: [
          { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
          { name: 'work_date', type: 'date', required: true },
          { name: 'check_in_at', type: 'datetime', required: true },
          { name: 'check_out_at', type: 'datetime', required: true },
          { name: 'worked_hours', type: 'decimal', required: true },
          { name: 'status', type: 'string', required: true },
        ],
      },
      {
        slug: shiftEntity.slug,
        display_name: shiftEntity.displayName,
        module: 'hr',
        fields: [
          { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
          { name: 'start_time', type: 'datetime', required: true },
          { name: 'end_time', type: 'datetime', required: true },
          { name: 'work_days', type: 'string[]' },
          { name: 'status', type: 'string', required: true },
        ],
      },
      {
        slug: timesheetEntity.slug,
        display_name: timesheetEntity.displayName,
        module: 'hr',
        fields: [
          { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
          { name: 'work_date', type: 'date', required: true },
          { name: 'regular_hours', type: 'decimal', required: true },
          { name: 'overtime_hours', type: 'decimal', required: true },
          { name: 'status', type: 'string', required: true },
          { name: 'attendance_id', type: 'reference', reference_entity: attendanceEntity.slug },
        ],
      }
    );
  }

  if (compensationLedgerEnabled) {
    entities.push(
      {
        slug: compensationLedgerEntity.slug,
        display_name: compensationLedgerEntity.displayName,
        module: 'hr',
        fields: [
          { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
          { name: 'pay_period', type: 'string', required: true },
          { name: 'component', type: 'string', required: true },
          { name: 'component_type', type: 'string', required: true, options: ['Earning', 'Deduction'] },
          { name: 'amount', type: 'decimal', required: true },
          { name: 'status', type: 'string', required: true },
        ],
      },
      {
        slug: compensationSnapshotEntity.slug,
        display_name: compensationSnapshotEntity.displayName,
        module: 'hr',
        fields: [
          { name: 'employee_id', type: 'reference', reference_entity: employeeEntity.slug, required: true },
          { name: 'pay_period', type: 'string', required: true },
          { name: 'gross_amount', type: 'decimal', required: true },
          { name: 'deduction_amount', type: 'decimal', required: true },
          { name: 'net_amount', type: 'decimal', required: true },
          { name: 'status', type: 'string', required: true },
        ],
      }
    );
  }

  return {
    moduleConfig,
    entities,
  };
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
    sdf.modules.inventory = {
      enabled: true,
      allow_negative_stock: toBoolYes(answers.inv_allow_negative_stock),
      costing_enabled: toBoolYes(answers.inv_need_costing),
      inventory_dashboard: {
        low_stock: { enabled: toBoolYes(answers.inv_need_low_stock_alerts) },
        expiry: { enabled: toBoolYes(answers.inv_need_expiry_tracking) },
      },
    };
    sdf.entities.push(...inventoryEntities);
  }

  if (selectedModules.includes('invoice')) {
    const invoicePrefill = buildInvoicePrefill(answers);
    sdf.modules.invoice = invoicePrefill.moduleConfig;
    sdf.entities.push(...invoicePrefill.entities);
  }

  if (selectedModules.includes('hr')) {
    const hrPrefill = buildHrPrefill(answers);
    sdf.modules.hr = hrPrefill.moduleConfig;
    sdf.entities.push(...hrPrefill.entities);
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
