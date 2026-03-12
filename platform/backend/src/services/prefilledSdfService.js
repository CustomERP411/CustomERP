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

function slugifyLabel(value, fallback) {
  const cleaned = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

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
  if (!raw || raw === 'CUSTOM') return 'USD';
  return raw;
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

function buildInvoiceEntities(answers) {
  const statusPolicy = String(answers.invoice_status_policy || '').toLowerCase();
  const statusOptions = statusPolicy.includes('strict')
    ? ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']
    : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Void'];

  const entities = [
    {
      slug: 'customers',
      display_name: 'Customers',
      module: 'shared',
      fields: [
        { name: 'company_name', type: 'string', required: true },
        { name: 'email', type: 'string', required: true },
        { name: 'phone', type: 'string' },
        { name: 'address', type: 'text' },
      ],
    },
    {
      slug: 'invoices',
      display_name: 'Invoices',
      module: 'invoice',
      fields: [
        { name: 'invoice_number', type: 'string', required: true, unique: true },
        { name: 'customer_id', type: 'reference', reference_entity: 'customers', required: true },
        { name: 'issue_date', type: 'date', required: true },
        { name: 'due_date', type: 'date', required: true },
        { name: 'status', type: 'string', required: true, options: statusOptions },
        { name: 'subtotal', type: 'decimal' },
        { name: 'tax_total', type: 'decimal' },
        { name: 'grand_total', type: 'decimal' },
      ],
      features: {
        partial_payments: toBoolYes(answers.invoice_partial_payments),
        credit_notes: toBoolYes(answers.invoice_use_credit_notes),
      },
    },
    {
      slug: 'invoice_items',
      display_name: 'Invoice Items',
      module: 'invoice',
      fields: [
        { name: 'invoice_id', type: 'reference', reference_entity: 'invoices', required: true },
        { name: 'description', type: 'string', required: true },
        { name: 'quantity', type: 'decimal', required: true },
        { name: 'unit_price', type: 'decimal', required: true },
        { name: 'line_total', type: 'decimal' },
      ],
    },
  ];

  return entities;
}

function buildHrEntities(answers) {
  const employeeStatuses = parseMultiChoice(answers.hr_employee_statuses);
  const leaveTypes = parseMultiChoice(answers.hr_leave_types);

  const entities = [];

  if (toBoolYes(answers.hr_use_departments)) {
    entities.push({
      slug: 'departments',
      display_name: 'Departments',
      module: 'hr',
      fields: [
        { name: 'name', type: 'string', required: true, unique: true },
        { name: 'location', type: 'string' },
      ],
    });
  }

  const employeeFields = [
    { name: 'first_name', type: 'string', required: true },
    { name: 'last_name', type: 'string', required: true },
    { name: 'email', type: 'string', required: true, unique: true },
    { name: 'job_title', type: 'string', required: true },
    { name: 'hire_date', type: 'date', required: true },
    {
      name: 'status',
      type: 'string',
      required: true,
      options: employeeStatuses.length ? employeeStatuses : ['Active', 'On Leave', 'Terminated'],
    },
  ];

  if (toBoolYes(answers.hr_use_departments)) {
    employeeFields.push({
      name: 'department_id',
      type: 'reference',
      reference_entity: 'departments',
      required: true,
    });
  }

  if (toBoolYes(answers.hr_require_manager_link)) {
    employeeFields.push({
      name: 'manager_id',
      type: 'reference',
      reference_entity: 'employees',
    });
  }

  if (toBoolYes(answers.hr_collect_salary)) {
    employeeFields.push({ name: 'salary', type: 'decimal' });
  }

  entities.push({
    slug: 'employees',
    display_name: 'Employees',
    module: 'hr',
    fields: employeeFields,
    features: {
      onboarding_checklist: toBoolYes(answers.hr_onboarding_checklist),
    },
  });

  if (toBoolYes(answers.hr_track_leave)) {
    entities.push({
      slug: 'leaves',
      display_name: 'Leaves',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        {
          name: 'leave_type',
          type: 'string',
          required: true,
          options: leaveTypes.length ? leaveTypes : ['Sick', 'Vacation', 'Unpaid'],
        },
        { name: 'start_date', type: 'date', required: true },
        { name: 'end_date', type: 'date', required: true },
        { name: 'status', type: 'string', required: true, options: ['Pending', 'Approved', 'Rejected'] },
      ],
      features: {
        approval_required: toBoolYes(answers.hr_leave_approval_flow),
      },
    });
  }

  if (toBoolYes(answers.hr_track_attendance)) {
    entities.push({
      slug: 'attendance',
      display_name: 'Attendance',
      module: 'hr',
      fields: [
        { name: 'employee_id', type: 'reference', reference_entity: 'employees', required: true },
        { name: 'attendance_date', type: 'date', required: true },
        { name: 'check_in', type: 'datetime' },
        { name: 'check_out', type: 'datetime' },
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
    const invoiceEntities = buildInvoiceEntities(answers);
    sdf.modules.invoice = {
      enabled: true,
      currency: normalizeCurrency(answers.invoice_default_currency),
      tax_rate: toNumber(answers.invoice_default_tax_rate, 0),
      numbering: {
        prefix: String(answers.invoice_number_prefix || 'INV'),
        reset: String(answers.invoice_number_reset || 'Never'),
      },
    };
    sdf.entities.push(...invoiceEntities);
  }

  if (selectedModules.includes('hr')) {
    const hrEntities = buildHrEntities(answers);
    sdf.modules.hr = {
      enabled: true,
      attendance_enabled: toBoolYes(answers.hr_track_attendance),
      leave_enabled: toBoolYes(answers.hr_track_leave),
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
