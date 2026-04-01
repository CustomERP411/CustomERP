module.exports = (config = {}) => {
  const defaults = {
    tax_rate: 0,
    invoice_entity: 'invoices',
    item_entity: 'invoice_items',
    invoice_id_field: 'invoice_id',
    subtotal_field: 'subtotal',
    tax_total_field: 'tax_total',
    grand_total_field: 'grand_total',
    paid_total_field: 'paid_total',
    outstanding_field: 'outstanding_balance',
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };
  const invoiceConfig = {
    tax_rate: Number(merged.tax_rate ?? defaults.tax_rate),
    invoice_entity: merged.invoice_entity || merged.invoiceEntity || defaults.invoice_entity,
    item_entity: merged.item_entity || merged.itemEntity || defaults.item_entity,
    invoice_id_field: merged.invoice_id_field || merged.invoiceIdField || defaults.invoice_id_field,
    subtotal_field: merged.subtotal_field || merged.subtotalField || defaults.subtotal_field,
    tax_total_field: merged.tax_total_field || merged.taxTotalField || defaults.tax_total_field,
    grand_total_field: merged.grand_total_field || merged.grandTotalField || defaults.grand_total_field,
    paid_total_field: merged.paid_total_field || merged.paidTotalField || defaults.paid_total_field,
    outstanding_field: merged.outstanding_field || merged.outstandingField || defaults.outstanding_field,
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
      if (qty < 0) {
        throw new Error('Quantity cannot be negative');
      }
      if (price < 0) {
        throw new Error('Unit price cannot be negative');
      }
    `,
      BEFORE_CREATE_TRANSFORMATION: `
      const qty = Number(data.quantity);
      const price = Number(data.unit_price);
      data.line_total = Number((qty * price).toFixed(2));
    `,
      BEFORE_UPDATE_VALIDATION: `
      const existing = await this.repository.findById(this.slug, id);
      this._invoiceUpdatePrevId = existing?.${JSON.stringify(invoiceConfig.invoice_id_field).slice(1, -1)};
      if (data.quantity !== undefined || data.unit_price !== undefined) {
        const qty = Number(data.quantity ?? existing?.quantity ?? 0);
        const price = Number(data.unit_price ?? existing?.unit_price ?? 0);
        if (isNaN(qty) || isNaN(price)) {
          throw new Error('Quantity and unit price must be numbers');
        }
        if (qty < 0) {
          throw new Error('Quantity cannot be negative');
        }
        if (price < 0) {
          throw new Error('Unit price cannot be negative');
        }
        data.line_total = Number((qty * price).toFixed(2));
      }
    `,
      BEFORE_DELETE_VALIDATION: `
      const existing = await this.repository.findById(this.slug, id);
      this._invoiceDeleteId = existing?.${JSON.stringify(invoiceConfig.invoice_id_field).slice(1, -1)};
    `,
      AFTER_CREATE_LOGGING: `
      await this._recalculateInvoiceTotals(data.${invoiceConfig.invoice_id_field});
    `,
      AFTER_UPDATE_LOGGING: `
      const nextInvoiceId = data.${invoiceConfig.invoice_id_field} || this._invoiceUpdatePrevId;
      await this._recalculateInvoiceTotals(nextInvoiceId);
      if (data.${invoiceConfig.invoice_id_field} && this._invoiceUpdatePrevId && data.${invoiceConfig.invoice_id_field} !== this._invoiceUpdatePrevId) {
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
    const INVOICE_CFG = ${JSON.stringify(invoiceConfig)};
    const items = await this.repository.findAll(INVOICE_CFG.item_entity, { [INVOICE_CFG.invoice_id_field]: invoiceId });
    const subtotal = items.reduce((sum, item) => {
      const lineTotal = Number(item?.line_total ?? (Number(item?.quantity) * Number(item?.unit_price)) ?? 0);
      return sum + (isNaN(lineTotal) ? 0 : lineTotal);
    }, 0);

    const taxRate = Number(INVOICE_CFG.tax_rate ?? 0) || 0;
    const taxTotal = Number(((subtotal * taxRate) / 100).toFixed(2));
    const grandTotal = Number((subtotal + taxTotal).toFixed(2));

    const existing = await this.repository.findById(INVOICE_CFG.invoice_entity, invoiceId);
    const paid = Number(existing?.[INVOICE_CFG.paid_total_field] ?? 0) || 0;
    const outstanding = Number(Math.max(grandTotal - paid, 0).toFixed(2));

    await this.repository.update(INVOICE_CFG.invoice_entity, invoiceId, {
      [INVOICE_CFG.subtotal_field]: Number(subtotal.toFixed(2)),
      [INVOICE_CFG.tax_total_field]: taxTotal,
      [INVOICE_CFG.grand_total_field]: grandTotal,
      [INVOICE_CFG.outstanding_field]: outstanding,
    });
  }
    `,
  };
};
