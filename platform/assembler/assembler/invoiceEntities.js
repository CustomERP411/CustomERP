// Invoice Priority A entity enrichment – extracted from ProjectAssembler
module.exports = {
  _withInvoicePriorityAEntities(entities, sdf) {
    const cfg = this._getInvoicePriorityAConfig(sdf);
    const { enabledModules } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const invoiceEnabled = enabledSet.has('invoice');
    const packsEnabled =
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.payments) ||
      this._isPackEnabled(cfg.notes) ||
      this._isPackEnabled(cfg.lifecycle) ||
      this._isPackEnabled(cfg.calculationEngine);

    if (!invoiceEnabled || !packsEnabled) return;

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

    const customerEntity = ensureEntity(cfg.customerEntity, 'shared', () => ({
      slug: cfg.customerEntity,
      display_name: 'Customers',
      display_field: 'name',
      module: 'shared',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['name', 'email'] },
      fields: [],
      features: {},
    }));
    ensureField(customerEntity, { name: 'name', type: 'string', label: 'Name', required: true });
    ensureField(customerEntity, { name: 'email', type: 'string', label: 'Email', required: false });
    ensureField(customerEntity, { name: 'phone', type: 'string', label: 'Phone', required: false });

    const invoiceEntity = ensureEntity(cfg.invoiceEntity, 'invoice', () => ({
      slug: cfg.invoiceEntity,
      display_name: 'Invoices',
      display_field: cfg.invoice_number_field,
      module: 'invoice',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: [cfg.invoice_number_field, cfg.customer_field, cfg.status_field, cfg.grand_total_field, cfg.outstanding_field] },
      fields: [],
      features: { print_invoice: true },
    }));

    const statusOptions = Array.from(
      new Set(
        (Array.isArray(cfg.lifecycle.statuses) && cfg.lifecycle.statuses.length
          ? cfg.lifecycle.statuses
          : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled']).map((s) => String(s))
      )
    );

    ensureField(invoiceEntity, { name: cfg.invoice_number_field, type: 'string', label: 'Invoice Number', required: true, unique: true });
    ensureField(invoiceEntity, {
      name: cfg.customer_field,
      type: 'reference',
      label: 'Customer',
      required: true,
      reference_entity: cfg.customerEntity,
    });
    ensureField(invoiceEntity, { name: 'issue_date', type: 'date', label: 'Issue Date', required: true });
    ensureField(invoiceEntity, { name: 'due_date', type: 'date', label: 'Due Date', required: true });
    ensureField(invoiceEntity, {
      name: cfg.status_field,
      type: 'string',
      label: 'Status',
      required: true,
      options: statusOptions,
    });
    ensureField(invoiceEntity, { name: cfg.subtotal_field, type: 'decimal', label: 'Subtotal', required: true, min: 0 });
    ensureField(invoiceEntity, { name: cfg.tax_total_field, type: 'decimal', label: 'Tax Total', required: true, min: 0 });
    ensureField(invoiceEntity, { name: cfg.grand_total_field, type: 'decimal', label: 'Grand Total', required: true, min: 0 });
    ensureField(invoiceEntity, { name: cfg.paid_total_field, type: 'decimal', label: 'Paid Total', required: false, min: 0 });
    ensureField(invoiceEntity, { name: cfg.outstanding_field, type: 'decimal', label: 'Outstanding Balance', required: false, min: 0 });
    ensureField(invoiceEntity, { name: 'currency', type: 'string', label: 'Currency', required: false });

    if (this._isPackEnabled(cfg.transactions)) {
      ensureField(invoiceEntity, { name: cfg.idempotency_field, type: 'string', label: 'Idempotency Key', required: false, unique: true });
      ensureField(invoiceEntity, { name: cfg.posted_at_field, type: 'datetime', label: 'Posted At', required: false });
      ensureField(invoiceEntity, { name: cfg.cancelled_at_field, type: 'datetime', label: 'Cancelled At', required: false });
    }

    if (this._isPackEnabled(cfg.calculationEngine)) {
      ensureField(invoiceEntity, { name: cfg.discount_total_field, type: 'decimal', label: 'Discount Total', required: false, min: 0 });
      ensureField(invoiceEntity, { name: cfg.additional_charges_field, type: 'decimal', label: 'Additional Charges', required: false, min: 0 });

      const itemEntity = ensureEntity(cfg.itemEntity, 'invoice', () => ({
        slug: cfg.itemEntity,
        display_name: 'Invoice Items',
        display_field: 'description',
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.item_invoice_field,
            'description',
            cfg.item_quantity_field,
            cfg.item_unit_price_field,
            cfg.item_line_total_field,
          ],
        },
        fields: [],
        features: {},
      }));

      ensureField(itemEntity, {
        name: cfg.item_invoice_field,
        type: 'reference',
        label: 'Invoice',
        required: true,
        reference_entity: cfg.invoiceEntity,
      });
      ensureField(itemEntity, { name: 'description', type: 'string', label: 'Description', required: true });
      ensureField(itemEntity, { name: cfg.item_quantity_field, type: 'decimal', label: 'Quantity', required: true, min: 0 });
      ensureField(itemEntity, { name: cfg.item_unit_price_field, type: 'decimal', label: 'Unit Price', required: true, min: 0 });
      ensureField(itemEntity, { name: cfg.item_line_subtotal_field, type: 'decimal', label: 'Line Subtotal', required: false, min: 0 });
      ensureField(itemEntity, {
        name: cfg.item_discount_type_field,
        type: 'string',
        label: 'Discount Type',
        required: false,
        options: ['Amount', 'Percent'],
      });
      ensureField(itemEntity, { name: cfg.item_discount_value_field, type: 'decimal', label: 'Discount Value', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_discount_total_field, type: 'decimal', label: 'Discount Total', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_tax_rate_field, type: 'decimal', label: 'Tax Rate', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_tax_total_field, type: 'decimal', label: 'Tax Total', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_additional_charge_field, type: 'decimal', label: 'Additional Charge', required: false, min: 0 });
      ensureField(itemEntity, { name: cfg.item_line_total_field, type: 'decimal', label: 'Line Total', required: false, min: 0 });

      ensureChild(invoiceEntity, {
        entity: cfg.itemEntity,
        foreign_key: cfg.item_invoice_field,
        label: 'Invoice Items',
        columns: ['description', cfg.item_quantity_field, cfg.item_unit_price_field, cfg.item_line_total_field],
      });
    }

    if (this._isPackEnabled(cfg.payments)) {
      const paymentEntity = ensureEntity(cfg.payments.payment_entity, 'invoice', () => ({
        slug: cfg.payments.payment_entity,
        display_name: 'Invoice Payments',
        display_field: cfg.payments.payment_number_field,
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.payments.payment_number_field,
            cfg.payments.payment_customer_field,
            cfg.payments.payment_date_field,
            cfg.payments.amount_field,
            cfg.payments.unallocated_field,
            cfg.payments.status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(paymentEntity, { name: cfg.payments.payment_number_field, type: 'string', label: 'Payment Number', required: true, unique: true });
      ensureField(paymentEntity, {
        name: cfg.payments.payment_customer_field,
        type: 'reference',
        label: 'Customer',
        required: false,
        reference_entity: cfg.customerEntity,
      });
      ensureField(paymentEntity, { name: cfg.payments.payment_date_field, type: 'date', label: 'Payment Date', required: true });
      ensureField(paymentEntity, { name: cfg.payments.payment_method_field, type: 'string', label: 'Payment Method', required: false });
      ensureField(paymentEntity, { name: cfg.payments.amount_field, type: 'decimal', label: 'Amount', required: true, min: 0 });
      ensureField(paymentEntity, { name: cfg.payments.unallocated_field, type: 'decimal', label: 'Unallocated Amount', required: false, min: 0 });
      ensureField(paymentEntity, {
        name: cfg.payments.status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(paymentEntity, { name: 'reference_number', type: 'string', label: 'Reference Number', required: false });
      ensureField(paymentEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(paymentEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });

      const allocationEntity = ensureEntity(cfg.payments.allocation_entity, 'invoice', () => ({
        slug: cfg.payments.allocation_entity,
        display_name: 'Payment Allocations',
        display_field: cfg.payments.allocation_invoice_field,
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.payments.allocation_payment_field,
            cfg.payments.allocation_invoice_field,
            cfg.payments.allocation_amount_field,
            cfg.payments.allocation_date_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_payment_field,
        type: 'reference',
        label: 'Payment',
        required: true,
        reference_entity: cfg.payments.payment_entity,
      });
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_invoice_field,
        type: 'reference',
        label: 'Invoice',
        required: true,
        reference_entity: cfg.invoiceEntity,
      });
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_amount_field,
        type: 'decimal',
        label: 'Allocated Amount',
        required: true,
        min: 0,
      });
      ensureField(allocationEntity, {
        name: cfg.payments.allocation_date_field,
        type: 'datetime',
        label: 'Allocated At',
        required: false,
      });
      ensureField(allocationEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      ensureChild(paymentEntity, {
        entity: cfg.payments.allocation_entity,
        foreign_key: cfg.payments.allocation_payment_field,
        label: 'Allocations',
        columns: [
          cfg.payments.allocation_invoice_field,
          cfg.payments.allocation_amount_field,
          cfg.payments.allocation_date_field,
        ],
      });
    }

    if (this._isPackEnabled(cfg.notes)) {
      const noteEntity = ensureEntity(cfg.notes.note_entity, 'invoice', () => ({
        slug: cfg.notes.note_entity,
        display_name: 'Invoice Notes',
        display_field: cfg.notes.note_number_field,
        module: 'invoice',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.notes.note_number_field,
            cfg.notes.note_invoice_field,
            cfg.notes.note_type_field,
            cfg.notes.note_status_field,
            cfg.notes.note_grand_total_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(noteEntity, { name: cfg.notes.note_number_field, type: 'string', label: 'Note Number', required: true, unique: true });
      ensureField(noteEntity, {
        name: cfg.notes.note_invoice_field,
        type: 'reference',
        label: 'Source Invoice',
        required: true,
        reference_entity: cfg.invoiceEntity,
      });
      ensureField(noteEntity, {
        name: cfg.notes.note_type_field,
        type: 'string',
        label: 'Note Type',
        required: true,
        options: ['Credit', 'Debit'],
      });
      ensureField(noteEntity, {
        name: cfg.notes.note_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(noteEntity, { name: 'issue_date', type: 'date', label: 'Issue Date', required: true });
      ensureField(noteEntity, { name: 'reason', type: 'text', label: 'Reason', required: false });
      ensureField(noteEntity, { name: cfg.notes.note_amount_field, type: 'decimal', label: 'Amount', required: true, min: 0 });
      ensureField(noteEntity, { name: cfg.notes.note_tax_total_field, type: 'decimal', label: 'Tax Total', required: false, min: 0 });
      ensureField(noteEntity, { name: cfg.notes.note_grand_total_field, type: 'decimal', label: 'Grand Total', required: false, min: 0 });
      ensureField(noteEntity, { name: cfg.notes.note_posted_at_field, type: 'datetime', label: 'Posted At', required: false });
      ensureField(noteEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      ensureChild(invoiceEntity, {
        entity: cfg.notes.note_entity,
        foreign_key: cfg.notes.note_invoice_field,
        label: 'Notes',
        columns: [
          cfg.notes.note_number_field,
          cfg.notes.note_type_field,
          cfg.notes.note_status_field,
          cfg.notes.note_grand_total_field,
        ],
      });
    }
  },
};
