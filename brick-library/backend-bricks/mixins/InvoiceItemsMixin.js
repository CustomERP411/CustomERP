module.exports = (config = {}) => {
  const defaults = {
    tax_rate: 0,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };
  const invoiceConfig = {
    tax_rate: Number(merged.tax_rate ?? defaults.tax_rate),
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_VALIDATION: `
      const qty = Number(data.quantity);
      const price = Number(data.unit_price);
      if (isNaN(qty) || isNaN(price)) {
        throw new Error('Quantity and unit price must be numbers');
      }
    `,
      BEFORE_CREATE_TRANSFORMATION: `
      const qty = Number(data.quantity);
      const price = Number(data.unit_price);
      data.line_total = Number((qty * price).toFixed(2));
    `,
      BEFORE_UPDATE_VALIDATION: `
      const existing = await this.repository.findById(this.slug, id);
      this._invoiceUpdatePrevId = existing?.invoice_id;
      if (data.quantity !== undefined || data.unit_price !== undefined) {
        const qty = Number(data.quantity ?? existing?.quantity ?? 0);
        const price = Number(data.unit_price ?? existing?.unit_price ?? 0);
        if (isNaN(qty) || isNaN(price)) {
          throw new Error('Quantity and unit price must be numbers');
        }
        data.line_total = Number((qty * price).toFixed(2));
      }
    `,
      BEFORE_DELETE_VALIDATION: `
      const existing = await this.repository.findById(this.slug, id);
      this._invoiceDeleteId = existing?.invoice_id;
    `,
      AFTER_CREATE_LOGGING: `
      await this._recalculateInvoiceTotals(data.invoice_id);
    `,
      AFTER_UPDATE_LOGGING: `
      const nextInvoiceId = data.invoice_id || this._invoiceUpdatePrevId;
      await this._recalculateInvoiceTotals(nextInvoiceId);
      if (data.invoice_id && this._invoiceUpdatePrevId && data.invoice_id !== this._invoiceUpdatePrevId) {
        await this._recalculateInvoiceTotals(this._invoiceUpdatePrevId);
      }
    `,
      AFTER_DELETE_LOGGING: `
      await this._recalculateInvoiceTotals(this._invoiceDeleteId);
    `,
    },
    methods: `
  async _recalculateInvoiceTotals(invoiceId) {
    if (!invoiceId) return;
    const items = await this.repository.findAll('invoice_items', { invoice_id: invoiceId });
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = Number(item?.line_total ?? (Number(item?.quantity) * Number(item?.unit_price)) ?? 0);
      return sum + (isNaN(lineTotal) ? 0 : lineTotal);
    }, 0);

    const INVOICE_CFG = ${JSON.stringify(invoiceConfig)};
    const taxRate = Number(INVOICE_CFG.tax_rate ?? 0) || 0;
    const taxTotal = Number(((subtotal * taxRate) / 100).toFixed(2));
    const grandTotal = Number((subtotal + taxTotal).toFixed(2));

    await this.repository.update('invoices', invoiceId, {
      subtotal: Number(subtotal.toFixed(2)),
      tax_total: taxTotal,
      grand_total: grandTotal,
    });
  }
    `,
  };
};
