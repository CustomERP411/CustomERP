module.exports = (config = {}) => {
  const defaults = {
    prefix: 'INV-',
    tax_rate: 0,
    payment_terms: 30,
    statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
    invoice_number_field: 'invoice_number',
    status_field: 'status',
    subtotal_field: 'subtotal',
    tax_total_field: 'tax_total',
    grand_total_field: 'grand_total',
    discount_total_field: 'discount_total',
    additional_charges_field: 'additional_charges_total',
    paid_total_field: 'paid_total',
    outstanding_field: 'outstanding_balance',
    auto_number_mode: 'create',
    use_calculation_engine: false,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };
  const invoiceConfig = {
    prefix: typeof merged.prefix === 'string' && merged.prefix.length ? merged.prefix : defaults.prefix,
    tax_rate: Number(merged.tax_rate ?? defaults.tax_rate),
    payment_terms: Number(merged.payment_terms ?? defaults.payment_terms),
    statuses: Array.isArray(merged.statuses) && merged.statuses.length ? merged.statuses : defaults.statuses,
    invoice_number_field: merged.invoice_number_field || merged.invoiceNumberField || defaults.invoice_number_field,
    status_field: merged.status_field || merged.statusField || defaults.status_field,
    subtotal_field: merged.subtotal_field || merged.subtotalField || defaults.subtotal_field,
    tax_total_field: merged.tax_total_field || merged.taxTotalField || defaults.tax_total_field,
    grand_total_field: merged.grand_total_field || merged.grandTotalField || defaults.grand_total_field,
    discount_total_field: merged.discount_total_field || merged.discountTotalField || defaults.discount_total_field,
    additional_charges_field: merged.additional_charges_field || merged.additionalChargesField || defaults.additional_charges_field,
    paid_total_field: merged.paid_total_field || merged.paidTotalField || defaults.paid_total_field,
    outstanding_field: merged.outstanding_field || merged.outstandingField || defaults.outstanding_field,
    auto_number_mode: String(merged.auto_number_mode || merged.autoNumberMode || defaults.auto_number_mode),
    use_calculation_engine:
      merged.use_calculation_engine === true ||
      merged.useCalculationEngine === true ||
      merged.calculation_engine_enabled === true ||
      merged.calculationEngineEnabled === true,
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const INVOICE_CFG = ${JSON.stringify(invoiceConfig)};
      const allowedStatuses = Array.isArray(INVOICE_CFG.statuses) ? INVOICE_CFG.statuses : ['Draft', 'Sent', 'Paid', 'Overdue'];
      const statusField = INVOICE_CFG.status_field || 'status';
      const numberField = INVOICE_CFG.invoice_number_field || 'invoice_number';
      const subtotalField = INVOICE_CFG.subtotal_field || 'subtotal';
      const taxTotalField = INVOICE_CFG.tax_total_field || 'tax_total';
      const grandTotalField = INVOICE_CFG.grand_total_field || 'grand_total';
      const discountTotalField = INVOICE_CFG.discount_total_field || 'discount_total';
      const chargesField = INVOICE_CFG.additional_charges_field || 'additional_charges_total';
      const paidField = INVOICE_CFG.paid_total_field || 'paid_total';
      const outstandingField = INVOICE_CFG.outstanding_field || 'outstanding_balance';
      const useCalcEngine = INVOICE_CFG.use_calculation_engine === true;
      const autoNumberMode = String(INVOICE_CFG.auto_number_mode || 'create').toLowerCase();
      const round2 = (raw) => {
        const num = Number(raw);
        if (!Number.isFinite(num)) return 0;
        return Number(num.toFixed(2));
      };

      if (!data[statusField]) {
        data[statusField] = allowedStatuses[0] || 'Draft';
      }
      if (!allowedStatuses.includes(data[statusField])) {
        throw new Error('Invalid invoice status');
      }

      const prefix = String(INVOICE_CFG.prefix || 'INV-');
      if (!data[numberField]) {
        if (autoNumberMode === 'workflow') {
          data[numberField] = 'DRAFT-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        } else {
          const existing = await this.repository.findAll(this.slug, {});
          let max = 0;
          for (const row of existing) {
            const raw = String(row?.[numberField] || '');
            if (!raw.startsWith(prefix)) continue;
            const suffix = raw.slice(prefix.length);
            const num = parseInt(suffix, 10);
            if (!isNaN(num)) max = Math.max(max, num);
          }
          const next = max + 1;
          data[numberField] = prefix + String(next).padStart(6, '0');
        }
      } else {
        const existing = await this.repository.findAll(this.slug, {});
        const duplicate = existing.find((row) => String(row?.[numberField] || '') === String(data[numberField] || ''));
        if (duplicate) {
          throw new Error('Invoice number must be unique');
        }
      }

      if (!data.issue_date) {
        data.issue_date = new Date().toISOString().slice(0, 10);
      }
      if (!data.due_date) {
        const base = new Date(data.issue_date);
        const offset = Number(INVOICE_CFG.payment_terms ?? 30) || 30;
        if (!isNaN(base.getTime())) {
          base.setDate(base.getDate() + offset);
          data.due_date = base.toISOString().slice(0, 10);
        }
      }

      if (!useCalcEngine) {
        const subtotal = Number(data[subtotalField] ?? 0) || 0;
        const taxRate = Number(INVOICE_CFG.tax_rate ?? 0) || 0;
        const taxTotal = Number(((subtotal * taxRate) / 100).toFixed(2));
        const grandTotal = Number((subtotal + taxTotal).toFixed(2));
        data[subtotalField] = subtotal;
        data[taxTotalField] = taxTotal;
        data[grandTotalField] = grandTotal;
      } else {
        data[subtotalField] = round2(data[subtotalField] ?? 0);
        data[discountTotalField] = round2(data[discountTotalField] ?? 0);
        data[chargesField] = round2(data[chargesField] ?? 0);
        data[taxTotalField] = round2(data[taxTotalField] ?? 0);
        data[grandTotalField] = round2(data[grandTotalField] ?? 0);
      }

      data[paidField] = round2(data[paidField] ?? 0);
      const outstanding = round2(Math.max((data[grandTotalField] || 0) - (data[paidField] || 0), 0));
      if (data[outstandingField] === undefined || data[outstandingField] === null || data[outstandingField] === '') {
        data[outstandingField] = outstanding;
      } else {
        data[outstandingField] = round2(data[outstandingField]);
      }
    `,
      BEFORE_UPDATE_VALIDATION: `
      const INVOICE_CFG = ${JSON.stringify(invoiceConfig)};
      const allowedStatuses = Array.isArray(INVOICE_CFG.statuses) ? INVOICE_CFG.statuses : ['Draft', 'Sent', 'Paid', 'Overdue'];
      const statusField = INVOICE_CFG.status_field || 'status';
      const numberField = INVOICE_CFG.invoice_number_field || 'invoice_number';
      const subtotalField = INVOICE_CFG.subtotal_field || 'subtotal';
      const taxTotalField = INVOICE_CFG.tax_total_field || 'tax_total';
      const grandTotalField = INVOICE_CFG.grand_total_field || 'grand_total';
      const paidField = INVOICE_CFG.paid_total_field || 'paid_total';
      const outstandingField = INVOICE_CFG.outstanding_field || 'outstanding_balance';
      const useCalcEngine = INVOICE_CFG.use_calculation_engine === true;
      const round2 = (raw) => {
        const num = Number(raw);
        if (!Number.isFinite(num)) return 0;
        return Number(num.toFixed(2));
      };

      if (data[statusField] && !allowedStatuses.includes(data[statusField])) {
        throw new Error('Invalid invoice status');
      }

      if (data[numberField]) {
        const existing = await this.repository.findAll(this.slug, {});
        const duplicate = existing.find((row) =>
          String(row?.[numberField] || '') === String(data[numberField] || '') && String(row?.id || '') !== String(id || '')
        );
        if (duplicate) {
          throw new Error('Invoice number must be unique');
        }
      }

      if (!useCalcEngine && (data[subtotalField] !== undefined || data[taxTotalField] !== undefined || data[grandTotalField] !== undefined)) {
        const subtotal = Number(data[subtotalField] ?? 0) || 0;
        const taxRate = Number(INVOICE_CFG.tax_rate ?? 0) || 0;
        const taxTotal = Number(((subtotal * taxRate) / 100).toFixed(2));
        const grandTotal = Number((subtotal + taxTotal).toFixed(2));

        data[subtotalField] = subtotal;
        data[taxTotalField] = taxTotal;
        data[grandTotalField] = grandTotal;
      }

      if (data[paidField] !== undefined || data[grandTotalField] !== undefined || data[outstandingField] !== undefined) {
        const existingInvoice = await this.repository.findById(this.slug, id);
        const grand = round2(data[grandTotalField] !== undefined ? data[grandTotalField] : existingInvoice?.[grandTotalField]);
        const paid = round2(data[paidField] !== undefined ? data[paidField] : existingInvoice?.[paidField]);
        if (paid < 0) {
          throw new Error('Paid total cannot be negative');
        }
        if (paid > grand + 0.0001) {
          throw new Error('Paid total cannot exceed grand total');
        }
        data[paidField] = paid;
        data[outstandingField] = round2(Math.max(grand - paid, 0));
      }
    `,
    },
  };
};
