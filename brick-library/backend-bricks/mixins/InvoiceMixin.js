module.exports = (config = {}) => {
  const defaults = {
    prefix: 'INV-',
    tax_rate: 0,
    payment_terms: 30,
    statuses: ['Draft', 'Sent', 'Paid', 'Overdue'],
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
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const INVOICE_CFG = ${JSON.stringify(invoiceConfig)};
      const allowedStatuses = Array.isArray(INVOICE_CFG.statuses) ? INVOICE_CFG.statuses : ['Draft', 'Sent', 'Paid', 'Overdue'];

      if (!data.status) {
        data.status = allowedStatuses[0] || 'Draft';
      }
      if (!allowedStatuses.includes(data.status)) {
        throw new Error('Invalid invoice status');
      }

      const prefix = String(INVOICE_CFG.prefix || 'INV-');
      if (!data.invoice_number) {
        const existing = await this.repository.findAll(this.slug, {});
        let max = 0;
        for (const row of existing) {
          const raw = String(row?.invoice_number || '');
          if (!raw.startsWith(prefix)) continue;
          const suffix = raw.slice(prefix.length);
          const num = parseInt(suffix, 10);
          if (!isNaN(num)) max = Math.max(max, num);
        }
        const next = max + 1;
        data.invoice_number = prefix + String(next).padStart(6, '0');
      } else {
        const existing = await this.repository.findAll(this.slug, {});
        const duplicate = existing.find((row) => String(row?.invoice_number || '') === String(data.invoice_number || ''));
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

      const subtotal = Number(data.subtotal ?? 0) || 0;
      const taxRate = Number(INVOICE_CFG.tax_rate ?? 0) || 0;
      const taxTotal = Number(((subtotal * taxRate) / 100).toFixed(2));
      const grandTotal = Number((subtotal + taxTotal).toFixed(2));

      data.subtotal = subtotal;
      data.tax_total = taxTotal;
      data.grand_total = grandTotal;
    `,
      BEFORE_UPDATE_VALIDATION: `
      const INVOICE_CFG = ${JSON.stringify(invoiceConfig)};
      const allowedStatuses = Array.isArray(INVOICE_CFG.statuses) ? INVOICE_CFG.statuses : ['Draft', 'Sent', 'Paid', 'Overdue'];

      if (data.status && !allowedStatuses.includes(data.status)) {
        throw new Error('Invalid invoice status');
      }

      if (data.invoice_number) {
        const existing = await this.repository.findAll(this.slug, {});
        const duplicate = existing.find((row) =>
          String(row?.invoice_number || '') === String(data.invoice_number || '') && String(row?.id || '') !== String(id || '')
        );
        if (duplicate) {
          throw new Error('Invoice number must be unique');
        }
      }

      if (data.subtotal !== undefined || data.tax_total !== undefined || data.grand_total !== undefined) {
        const subtotal = Number(data.subtotal ?? 0) || 0;
        const taxRate = Number(INVOICE_CFG.tax_rate ?? 0) || 0;
        const taxTotal = Number(((subtotal * taxRate) / 100).toFixed(2));
        const grandTotal = Number((subtotal + taxTotal).toFixed(2));

        data.subtotal = subtotal;
        data.tax_total = taxTotal;
        data.grand_total = grandTotal;
      }
    `,
    },
  };
};
