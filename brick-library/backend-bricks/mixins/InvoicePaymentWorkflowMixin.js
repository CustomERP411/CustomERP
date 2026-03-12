module.exports = (config = {}) => {
  const defaults = {
    invoice_entity: 'invoices',
    payment_entity: 'invoice_payments',
    allocation_entity: 'invoice_payment_allocations',
    invoice_status_field: 'status',
    invoice_grand_total_field: 'grand_total',
    invoice_paid_total_field: 'paid_total',
    invoice_outstanding_field: 'outstanding_balance',
    payment_number_field: 'payment_number',
    payment_customer_field: 'customer_id',
    payment_date_field: 'payment_date',
    payment_method_field: 'payment_method',
    payment_amount_field: 'amount',
    payment_unallocated_field: 'unallocated_amount',
    payment_status_field: 'status',
    allocation_payment_field: 'payment_id',
    allocation_invoice_field: 'invoice_id',
    allocation_amount_field: 'amount',
    allocation_date_field: 'allocated_at',
    payment_number_prefix: 'PAY-',
    payment_number_padding: 6,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: ['InvoiceTransactionSafetyMixin'],
    methods: `
  _invPayCfg() {
    const cfg =
      this.mixinConfig?.invoice_payment_workflow ||
      this.mixinConfig?.invoicePaymentWorkflow ||
      this.mixinConfig?.invoice_payments ||
      this.mixinConfig?.invoicePayments ||
      {};
    const invoiceTxn =
      this.mixinConfig?.invoice_transaction_safety ||
      this.mixinConfig?.invoiceTransactionSafety ||
      {};
    return {
      invoice_entity: cfg.invoice_entity || cfg.invoiceEntity || invoiceTxn.invoice_entity || invoiceTxn.invoiceEntity || '${merged.invoice_entity}',
      payment_entity: cfg.payment_entity || cfg.paymentEntity || '${merged.payment_entity}',
      allocation_entity: cfg.allocation_entity || cfg.allocationEntity || '${merged.allocation_entity}',
      invoice_status_field: cfg.invoice_status_field || cfg.invoiceStatusField || '${merged.invoice_status_field}',
      invoice_grand_total_field: cfg.invoice_grand_total_field || cfg.invoiceGrandTotalField || '${merged.invoice_grand_total_field}',
      invoice_paid_total_field: cfg.invoice_paid_total_field || cfg.invoicePaidTotalField || '${merged.invoice_paid_total_field}',
      invoice_outstanding_field: cfg.invoice_outstanding_field || cfg.invoiceOutstandingField || '${merged.invoice_outstanding_field}',
      payment_number_field: cfg.payment_number_field || cfg.paymentNumberField || '${merged.payment_number_field}',
      payment_customer_field: cfg.payment_customer_field || cfg.paymentCustomerField || '${merged.payment_customer_field}',
      payment_date_field: cfg.payment_date_field || cfg.paymentDateField || '${merged.payment_date_field}',
      payment_method_field: cfg.payment_method_field || cfg.paymentMethodField || '${merged.payment_method_field}',
      payment_amount_field: cfg.payment_amount_field || cfg.paymentAmountField || '${merged.payment_amount_field}',
      payment_unallocated_field: cfg.payment_unallocated_field || cfg.paymentUnallocatedField || '${merged.payment_unallocated_field}',
      payment_status_field: cfg.payment_status_field || cfg.paymentStatusField || '${merged.payment_status_field}',
      allocation_payment_field: cfg.allocation_payment_field || cfg.allocationPaymentField || '${merged.allocation_payment_field}',
      allocation_invoice_field: cfg.allocation_invoice_field || cfg.allocationInvoiceField || '${merged.allocation_invoice_field}',
      allocation_amount_field: cfg.allocation_amount_field || cfg.allocationAmountField || '${merged.allocation_amount_field}',
      allocation_date_field: cfg.allocation_date_field || cfg.allocationDateField || '${merged.allocation_date_field}',
      payment_number_prefix: cfg.payment_number_prefix || cfg.paymentNumberPrefix || '${merged.payment_number_prefix}',
      payment_number_padding: Number(cfg.payment_number_padding || cfg.paymentNumberPadding || ${merged.payment_number_padding}) || ${merged.payment_number_padding},
    };
  }

  _invPayErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invPayRound(rawValue) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  _invPayPositive(rawValue, fieldName = 'amount') {
    const value = this._invPayRound(rawValue);
    if (!Number.isFinite(value) || value <= 0) {
      throw this._invPayErr(\`\${fieldName} must be greater than zero\`, 400);
    }
    return value;
  }

  async _invPayApplyInvoiceDelta(client, cfg, invoiceId, paidDelta) {
    if (this.repository && typeof this.repository.atomicAdjustInvoiceFinancials === 'function') {
      return this.repository.atomicAdjustInvoiceFinancials(
        cfg.invoice_entity,
        invoiceId,
        {
          grandTotalField: cfg.invoice_grand_total_field,
          paidField: cfg.invoice_paid_total_field,
          outstandingField: cfg.invoice_outstanding_field,
          statusField: cfg.invoice_status_field,
          paidDelta,
          grandDelta: 0,
          autoStatus: true,
        },
        client
      );
    }

    const invoice = await this.repository.findByIdForUpdate(cfg.invoice_entity, invoiceId, client);
    if (!invoice) throw this._invPayErr('Invoice not found for allocation', 404);

    const grandTotal = this._invPayRound(invoice[cfg.invoice_grand_total_field] || 0);
    const currentPaid = this._invPayRound(invoice[cfg.invoice_paid_total_field] || 0);
    const nextPaid = this._invPayRound(currentPaid + paidDelta);
    if (nextPaid < 0) {
      throw this._invPayErr('Invoice paid total cannot go negative', 409, {
        invoice_id: invoiceId,
        current_paid: currentPaid,
        delta: paidDelta,
      });
    }
    if (nextPaid - grandTotal > 0.0001) {
      throw this._invPayErr('Payment allocation exceeds invoice grand total', 409, {
        invoice_id: invoiceId,
        grand_total: grandTotal,
        next_paid: nextPaid,
      });
    }

    const outstanding = this._invPayRound(Math.max(grandTotal - nextPaid, 0));
    let status = String(invoice[cfg.invoice_status_field] || 'Draft');
    if (status !== 'Cancelled') {
      if (outstanding <= 0) status = 'Paid';
      else if (status === 'Paid') status = 'Sent';
      else if (status === 'Draft') status = 'Sent';
    }

    return this.repository.updateWithClient(cfg.invoice_entity, invoiceId, {
      [cfg.invoice_paid_total_field]: nextPaid,
      [cfg.invoice_outstanding_field]: outstanding,
      [cfg.invoice_status_field]: status,
    }, client);
  }

  async _invPayAllocateNumber(client, cfg) {
    if (this.repository && typeof this.repository.allocatePrefixedNumber === 'function') {
      return this.repository.allocatePrefixedNumber(
        cfg.payment_entity,
        cfg.payment_number_field,
        cfg.payment_number_prefix,
        { padding: cfg.payment_number_padding },
        client
      );
    }
    const rows = await this.repository.findAllWithClient(cfg.payment_entity, {}, client);
    let max = 0;
    for (const row of rows || []) {
      const raw = String(row && row[cfg.payment_number_field] ? row[cfg.payment_number_field] : '');
      if (!raw.startsWith(cfg.payment_number_prefix)) continue;
      const parsed = parseInt(raw.slice(cfg.payment_number_prefix.length), 10);
      if (!Number.isNaN(parsed)) max = Math.max(max, parsed);
    }
    return cfg.payment_number_prefix + String(max + 1).padStart(cfg.payment_number_padding, '0');
  }

  async listInvoicePayments(invoiceId, filter = {}) {
    const cfg = this._invPayCfg();
    if (this.slug !== cfg.invoice_entity) {
      throw this._invPayErr(
        \`Invoice payment listing can only run on '\${cfg.invoice_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const allocations = await this.repository.findAll(cfg.allocation_entity, {
      [cfg.allocation_invoice_field]: invoiceId,
    });
    const paymentIds = Array.from(new Set((allocations || []).map((row) => row && row[cfg.allocation_payment_field]).filter(Boolean)));
    const payments = paymentIds.length
      ? await this.repository.findAll(cfg.payment_entity, { id: paymentIds })
      : [];
    const byPaymentId = new Map((payments || []).map((row) => [String(row.id), row]));

    const withFilter = Array.isArray(allocations) ? allocations.filter((row) => {
      if (!filter || typeof filter !== 'object') return true;
      if (Object.prototype.hasOwnProperty.call(filter, 'status')) {
        const payment = byPaymentId.get(String(row[cfg.allocation_payment_field]));
        const status = String((payment && payment[cfg.payment_status_field]) || '');
        return status.toLowerCase() === String(filter.status || '').toLowerCase();
      }
      return true;
    }) : [];

    return withFilter.map((row) => ({
      allocation: row,
      payment: byPaymentId.get(String(row[cfg.allocation_payment_field])) || null,
    }));
  }

  async recordInvoicePayment(invoiceId, payload = {}) {
    const cfg = this._invPayCfg();
    if (this.slug !== cfg.invoice_entity) {
      throw this._invPayErr(
        \`Invoice payment record can only run on '\${cfg.invoice_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const amount = this._invPayPositive(
      payload.amount ?? payload[cfg.payment_amount_field],
      cfg.payment_amount_field
    );

    return this.repository.withTransaction(async (client) => {
      const invoice = await this.repository.findByIdForUpdate(cfg.invoice_entity, invoiceId, client);
      if (!invoice) throw this._invPayErr('Invoice not found', 404);

      const outstanding = this._invPayRound(invoice[cfg.invoice_outstanding_field] || 0);
      const allocAmount = this._invPayRound(Math.min(amount, outstanding));
      const unallocated = this._invPayRound(Math.max(amount - allocAmount, 0));

      const paymentNumber = payload[cfg.payment_number_field] || payload.payment_number || payload.paymentNumber || await this._invPayAllocateNumber(client, cfg);
      const paymentPayload = {
        [cfg.payment_number_field]: paymentNumber,
        [cfg.payment_customer_field]:
          payload[cfg.payment_customer_field] ||
          payload.customer_id ||
          payload.customerId ||
          invoice.customer_id ||
          null,
        [cfg.payment_date_field]:
          payload[cfg.payment_date_field] ||
          payload.payment_date ||
          payload.paymentDate ||
          new Date().toISOString().slice(0, 10),
        [cfg.payment_method_field]:
          payload[cfg.payment_method_field] ||
          payload.payment_method ||
          payload.paymentMethod ||
          null,
        [cfg.payment_amount_field]: amount,
        [cfg.payment_unallocated_field]: unallocated,
        [cfg.payment_status_field]: 'Posted',
        posted_at: new Date().toISOString(),
      };
      if (payload.reference_number) paymentPayload.reference_number = payload.reference_number;
      if (payload.note) paymentPayload.note = payload.note;

      const payment = await this.repository.createWithClient(cfg.payment_entity, paymentPayload, client);
      let allocation = null;
      let updatedInvoice = invoice;

      if (allocAmount > 0) {
        allocation = await this.repository.createWithClient(
          cfg.allocation_entity,
          {
            [cfg.allocation_payment_field]: payment.id,
            [cfg.allocation_invoice_field]: invoiceId,
            [cfg.allocation_amount_field]: allocAmount,
            [cfg.allocation_date_field]: new Date().toISOString(),
          },
          client
        );
        updatedInvoice = await this._invPayApplyInvoiceDelta(client, cfg, invoiceId, allocAmount);
      }

      return {
        payment,
        allocation,
        invoice: updatedInvoice,
      };
    });
  }

  async postPayment(paymentId, payload = {}) {
    const cfg = this._invPayCfg();
    if (this.slug !== cfg.payment_entity) {
      throw this._invPayErr(
        \`Payment posting can only run on '\${cfg.payment_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const payment = await this.repository.findByIdForUpdate(cfg.payment_entity, paymentId, client);
      if (!payment) throw this._invPayErr('Payment not found', 404);
      const currentStatus = String(payment[cfg.payment_status_field] || 'Draft');
      if (currentStatus === 'Cancelled') {
        throw this._invPayErr('Cancelled payment cannot be posted', 409);
      }

      const allocations = await this.repository.findAllWithClient(cfg.allocation_entity, {
        [cfg.allocation_payment_field]: paymentId,
      }, client);
      if (!Array.isArray(allocations) || allocations.length === 0) {
        const invoiceId = payload.invoice_id || payload.invoiceId || payload[cfg.allocation_invoice_field];
        const requestedAmount = payload.amount ?? payload[cfg.allocation_amount_field];
        if (invoiceId && requestedAmount) {
          const allocAmount = this._invPayPositive(requestedAmount, cfg.allocation_amount_field);
          const created = await this.repository.createWithClient(
            cfg.allocation_entity,
            {
              [cfg.allocation_payment_field]: paymentId,
              [cfg.allocation_invoice_field]: invoiceId,
              [cfg.allocation_amount_field]: allocAmount,
              [cfg.allocation_date_field]: new Date().toISOString(),
            },
            client
          );
          allocations.push(created);
        }
      }

      let totalAllocated = 0;
      if (currentStatus !== 'Posted') {
        for (const allocation of allocations) {
          const invoiceId = allocation[cfg.allocation_invoice_field];
          const allocAmount = this._invPayRound(allocation[cfg.allocation_amount_field] || 0);
          if (allocAmount <= 0) continue;
          totalAllocated += allocAmount;
          await this._invPayApplyInvoiceDelta(client, cfg, invoiceId, allocAmount);
        }
      } else {
        totalAllocated = allocations.reduce((sum, row) => sum + this._invPayRound(row[cfg.allocation_amount_field] || 0), 0);
      }

      const paymentAmount = this._invPayRound(payment[cfg.payment_amount_field] || 0);
      const nextUnallocated = this._invPayRound(Math.max(paymentAmount - totalAllocated, 0));
      const updated = await this.repository.updateWithClient(cfg.payment_entity, paymentId, {
        [cfg.payment_status_field]: 'Posted',
        [cfg.payment_unallocated_field]: nextUnallocated,
        posted_at: payment.posted_at || new Date().toISOString(),
      }, client);

      return {
        payment: updated,
        allocations,
      };
    });
  }

  async cancelPayment(paymentId, payload = {}) {
    const cfg = this._invPayCfg();
    if (this.slug !== cfg.payment_entity) {
      throw this._invPayErr(
        \`Payment cancel can only run on '\${cfg.payment_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const payment = await this.repository.findByIdForUpdate(cfg.payment_entity, paymentId, client);
      if (!payment) throw this._invPayErr('Payment not found', 404);

      const currentStatus = String(payment[cfg.payment_status_field] || 'Draft');
      if (currentStatus === 'Cancelled') {
        throw this._invPayErr('Payment is already cancelled', 409);
      }

      const allocations = await this.repository.findAllWithClient(cfg.allocation_entity, {
        [cfg.allocation_payment_field]: paymentId,
      }, client);
      if (currentStatus === 'Posted') {
        for (const allocation of allocations || []) {
          const invoiceId = allocation[cfg.allocation_invoice_field];
          const allocAmount = this._invPayRound(allocation[cfg.allocation_amount_field] || 0);
          if (allocAmount <= 0) continue;
          await this._invPayApplyInvoiceDelta(client, cfg, invoiceId, -allocAmount);
        }
      }

      const updated = await this.repository.updateWithClient(cfg.payment_entity, paymentId, {
        [cfg.payment_status_field]: 'Cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: payload.reason || payload.cancel_reason || payload.cancelReason || null,
      }, client);
      return {
        payment: updated,
        allocations: allocations || [],
      };
    });
  }
    `,
  };
};
