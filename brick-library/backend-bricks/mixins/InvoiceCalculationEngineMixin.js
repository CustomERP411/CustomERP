module.exports = (config = {}) => {
  const defaults = {
    invoice_entity: 'invoices',
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
    paid_total_field: 'paid_total',
    outstanding_field: 'outstanding_balance',
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_VALIDATION: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        const __rawQty = data[__cfg.item_quantity_field];
        const __rawPrice = data[__cfg.item_unit_price_field];
        const __qty = Number(__rawQty);
        const __price = Number(__rawPrice);
        if (!Number.isFinite(__qty) || !Number.isFinite(__price)) {
          throw new Error('Quantity and unit price must be numbers');
        }
        if (__qty < 0 || __price < 0) {
          throw new Error('Quantity and unit price cannot be negative');
        }
      }
    `,
      BEFORE_CREATE_TRANSFORMATION: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        const __line = this._invCalcNormalizeLine(data, {});
        Object.assign(data, __line);
      }
    `,
      BEFORE_UPDATE_VALIDATION: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        const __existing = await this.repository.findById(this.slug, id);
        this._invoiceCalcPrevInvoiceId = __existing ? __existing[__cfg.item_invoice_field] : null;
        const __line = this._invCalcNormalizeLine(data, __existing || {});
        Object.assign(data, __line);
      }
    `,
      BEFORE_DELETE_VALIDATION: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        const __existing = await this.repository.findById(this.slug, id);
        this._invoiceCalcDeleteInvoiceId = __existing ? __existing[__cfg.item_invoice_field] : null;
      }
    `,
      AFTER_CREATE_LOGGING: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        await this._recalculateInvoiceFromLines(data[__cfg.item_invoice_field]);
      }
    `,
      AFTER_UPDATE_LOGGING: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        const __nextInvoiceId = data[__cfg.item_invoice_field] || this._invoiceCalcPrevInvoiceId;
        await this._recalculateInvoiceFromLines(__nextInvoiceId);
        if (data[__cfg.item_invoice_field] && this._invoiceCalcPrevInvoiceId && String(data[__cfg.item_invoice_field]) !== String(this._invoiceCalcPrevInvoiceId)) {
          await this._recalculateInvoiceFromLines(this._invoiceCalcPrevInvoiceId);
        }
      }
    `,
      AFTER_DELETE_LOGGING: `
      const __cfg = this._invCalcConfig();
      if (this.slug === __cfg.item_entity) {
        await this._recalculateInvoiceFromLines(this._invoiceCalcDeleteInvoiceId);
      }
    `,
    },
    methods: `
  _invCalcConfig() {
    const cfg =
      this.mixinConfig?.invoice_calculation_engine ||
      this.mixinConfig?.invoiceCalculationEngine ||
      this.mixinConfig?.invoice_calc ||
      this.mixinConfig?.invoiceCalc ||
      {};
    return {
      invoice_entity: cfg.invoice_entity || cfg.invoiceEntity || '${merged.invoice_entity}',
      item_entity: cfg.invoice_item_entity || cfg.invoiceItemEntity || '${merged.invoice_item_entity}',
      item_invoice_field: cfg.item_invoice_field || cfg.itemInvoiceField || '${merged.item_invoice_field}',
      item_quantity_field: cfg.item_quantity_field || cfg.itemQuantityField || '${merged.item_quantity_field}',
      item_unit_price_field: cfg.item_unit_price_field || cfg.itemUnitPriceField || '${merged.item_unit_price_field}',
      item_line_subtotal_field: cfg.item_line_subtotal_field || cfg.itemLineSubtotalField || '${merged.item_line_subtotal_field}',
      item_discount_type_field: cfg.item_discount_type_field || cfg.itemDiscountTypeField || '${merged.item_discount_type_field}',
      item_discount_value_field: cfg.item_discount_value_field || cfg.itemDiscountValueField || '${merged.item_discount_value_field}',
      item_discount_total_field: cfg.item_discount_total_field || cfg.itemDiscountTotalField || '${merged.item_discount_total_field}',
      item_tax_rate_field: cfg.item_tax_rate_field || cfg.itemTaxRateField || '${merged.item_tax_rate_field}',
      item_tax_total_field: cfg.item_tax_total_field || cfg.itemTaxTotalField || '${merged.item_tax_total_field}',
      item_additional_charge_field: cfg.item_additional_charge_field || cfg.itemAdditionalChargeField || '${merged.item_additional_charge_field}',
      item_line_total_field: cfg.item_line_total_field || cfg.itemLineTotalField || '${merged.item_line_total_field}',
      subtotal_field: cfg.subtotal_field || cfg.subtotalField || '${merged.subtotal_field}',
      tax_total_field: cfg.tax_total_field || cfg.taxTotalField || '${merged.tax_total_field}',
      discount_total_field: cfg.discount_total_field || cfg.discountTotalField || '${merged.discount_total_field}',
      additional_charges_field: cfg.additional_charges_field || cfg.additionalChargesField || '${merged.additional_charges_field}',
      grand_total_field: cfg.grand_total_field || cfg.grandTotalField || '${merged.grand_total_field}',
      paid_total_field: cfg.paid_total_field || cfg.paidTotalField || '${merged.paid_total_field}',
      outstanding_field: cfg.outstanding_field || cfg.outstandingField || '${merged.outstanding_field}',
    };
  }

  _invCalcNum(rawValue, fallback = 0) {
    const num = Number(rawValue);
    return Number.isFinite(num) ? num : fallback;
  }

  _invCalcRound(rawValue) {
    const num = this._invCalcNum(rawValue, 0);
    return Number(num.toFixed(2));
  }

  _invCalcNormalizeLine(data = {}, existing = {}) {
    const cfg = this._invCalcConfig();
    const input = data && typeof data === 'object' ? data : {};
    const prev = existing && typeof existing === 'object' ? existing : {};

    const quantity = this._invCalcNum(
      input[cfg.item_quantity_field] !== undefined ? input[cfg.item_quantity_field] : prev[cfg.item_quantity_field],
      0
    );
    const unitPrice = this._invCalcNum(
      input[cfg.item_unit_price_field] !== undefined ? input[cfg.item_unit_price_field] : prev[cfg.item_unit_price_field],
      0
    );
    if (quantity < 0 || unitPrice < 0) {
      throw new Error('Quantity and unit price cannot be negative');
    }

    const discountTypeRaw =
      input[cfg.item_discount_type_field] !== undefined
        ? input[cfg.item_discount_type_field]
        : prev[cfg.item_discount_type_field];
    const discountType = String(discountTypeRaw || 'Amount');
    const normalizedDiscountType = discountType.toLowerCase() === 'percent' ? 'Percent' : 'Amount';
    const discountValue = this._invCalcNum(
      input[cfg.item_discount_value_field] !== undefined
        ? input[cfg.item_discount_value_field]
        : prev[cfg.item_discount_value_field],
      0
    );
    if (discountValue < 0) {
      throw new Error('Discount value cannot be negative');
    }

    const taxRate = this._invCalcNum(
      input[cfg.item_tax_rate_field] !== undefined ? input[cfg.item_tax_rate_field] : prev[cfg.item_tax_rate_field],
      0
    );
    if (taxRate < 0) {
      throw new Error('Tax rate cannot be negative');
    }

    const additionalCharge = this._invCalcNum(
      input[cfg.item_additional_charge_field] !== undefined
        ? input[cfg.item_additional_charge_field]
        : prev[cfg.item_additional_charge_field],
      0
    );
    if (additionalCharge < 0) {
      throw new Error('Additional charge cannot be negative');
    }

    const lineSubtotal = this._invCalcRound(quantity * unitPrice);
    const discountBase =
      normalizedDiscountType === 'Percent'
        ? lineSubtotal * (Math.min(Math.max(discountValue, 0), 100) / 100)
        : Math.min(discountValue, lineSubtotal);
    const discountTotal = this._invCalcRound(discountBase);
    const taxableBase = this._invCalcRound(Math.max(lineSubtotal - discountTotal + additionalCharge, 0));
    const taxTotal = this._invCalcRound((taxableBase * taxRate) / 100);
    const lineTotal = this._invCalcRound(taxableBase + taxTotal);

    return {
      [cfg.item_quantity_field]: quantity,
      [cfg.item_unit_price_field]: unitPrice,
      [cfg.item_line_subtotal_field]: lineSubtotal,
      [cfg.item_discount_type_field]: normalizedDiscountType,
      [cfg.item_discount_value_field]: discountValue,
      [cfg.item_discount_total_field]: discountTotal,
      [cfg.item_tax_rate_field]: taxRate,
      [cfg.item_tax_total_field]: taxTotal,
      [cfg.item_additional_charge_field]: additionalCharge,
      [cfg.item_line_total_field]: lineTotal,
    };
  }

  async _recalculateInvoiceFromLines(invoiceId) {
    const cfg = this._invCalcConfig();
    if (!invoiceId) return null;

    const items = await this.repository.findAll(cfg.item_entity, {
      [cfg.item_invoice_field]: invoiceId,
    });
    const rows = Array.isArray(items) ? items : [];

    let subtotal = 0;
    let discountTotal = 0;
    let additionalChargesTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    for (const item of rows) {
      subtotal += this._invCalcNum(item[cfg.item_line_subtotal_field], this._invCalcNum(item[cfg.item_quantity_field], 0) * this._invCalcNum(item[cfg.item_unit_price_field], 0));
      discountTotal += this._invCalcNum(item[cfg.item_discount_total_field], 0);
      additionalChargesTotal += this._invCalcNum(item[cfg.item_additional_charge_field], 0);
      taxTotal += this._invCalcNum(item[cfg.item_tax_total_field], 0);
      grandTotal += this._invCalcNum(item[cfg.item_line_total_field], 0);
    }

    subtotal = this._invCalcRound(subtotal);
    discountTotal = this._invCalcRound(discountTotal);
    additionalChargesTotal = this._invCalcRound(additionalChargesTotal);
    taxTotal = this._invCalcRound(taxTotal);
    grandTotal = this._invCalcRound(grandTotal);

    const invoice = await this.repository.findById(cfg.invoice_entity, invoiceId);
    if (!invoice) return null;

    const paidTotal = this._invCalcRound(invoice[cfg.paid_total_field] || 0);
    const outstanding = this._invCalcRound(Math.max(grandTotal - paidTotal, 0));
    return this.repository.update(cfg.invoice_entity, invoiceId, {
      [cfg.subtotal_field]: subtotal,
      [cfg.discount_total_field]: discountTotal,
      [cfg.additional_charges_field]: additionalChargesTotal,
      [cfg.tax_total_field]: taxTotal,
      [cfg.grand_total_field]: grandTotal,
      [cfg.outstanding_field]: outstanding,
    });
  }
    `,
  };
};
