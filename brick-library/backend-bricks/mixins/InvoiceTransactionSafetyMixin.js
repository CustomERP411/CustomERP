module.exports = (config = {}) => {
  const defaults = {
    invoice_entity: 'invoices',
    invoice_number_field: 'invoice_number',
    status_field: 'status',
    grand_total_field: 'grand_total',
    paid_total_field: 'paid_total',
    outstanding_field: 'outstanding_balance',
    idempotency_field: 'idempotency_key',
    posted_at_field: 'posted_at',
    cancelled_at_field: 'cancelled_at',
    number_prefix: 'INV-',
    number_padding: 6,
    issue_status: 'Sent',
    cancelled_status: 'Cancelled',
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const __cfg = this._invTxnCfg();
      if (this.slug === __cfg.invoice_entity) {
        if (data[__cfg.status_field] === undefined || data[__cfg.status_field] === null || data[__cfg.status_field] === '') {
          data[__cfg.status_field] = 'Draft';
        }
        const __grand = Number(data[__cfg.grand_total_field] || 0);
        const __paid = Number(data[__cfg.paid_total_field] || 0);
        if (!Number.isFinite(__paid) || __paid < 0) {
          data[__cfg.paid_total_field] = 0;
        }
        const __safeGrand = Number.isFinite(__grand) ? __grand : 0;
        const __safePaid = Number(data[__cfg.paid_total_field] || 0);
        if (data[__cfg.outstanding_field] === undefined || data[__cfg.outstanding_field] === null || data[__cfg.outstanding_field] === '') {
          data[__cfg.outstanding_field] = Number(Math.max(__safeGrand - __safePaid, 0).toFixed(2));
        }
        if (!data[__cfg.invoice_number_field]) {
          data[__cfg.invoice_number_field] = 'DRAFT-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        }
        if (__cfg.idempotency_field && !data[__cfg.idempotency_field]) {
          data[__cfg.idempotency_field] = 'inv-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        }
      }
    `,
      BEFORE_UPDATE_VALIDATION: `
      const __cfg = this._invTxnCfg();
      if (this.slug === __cfg.invoice_entity) {
        const __existing = await this.repository.findById(this.slug, id);
        if (__existing) {
          const __status = String(__existing[__cfg.status_field] || 'Draft');
          const __lockedStatuses = ['Paid', 'Cancelled'];
          if (__lockedStatuses.includes(__status)) {
            const __forbidden = [
              __cfg.grand_total_field,
              __cfg.paid_total_field,
              __cfg.outstanding_field,
            ];
            const __hasForbiddenPatch = __forbidden.some((k) => Object.prototype.hasOwnProperty.call(data, k));
            if (__hasForbiddenPatch) {
              throw new Error('Paid or cancelled invoices cannot be financially modified');
            }
          }
        }
      }
    `,
    },
    methods: `
  _invTxnCfg() {
    const cfg =
      this.mixinConfig?.invoice_transaction_safety ||
      this.mixinConfig?.invoiceTransactionSafety ||
      this.mixinConfig?.invoice_transactions ||
      this.mixinConfig?.invoiceTransactions ||
      {};
    const lifecycle =
      this.mixinConfig?.invoice_lifecycle ||
      this.mixinConfig?.invoiceLifecycle ||
      {};
    return {
      invoice_entity: cfg.invoice_entity || cfg.invoiceEntity || '${merged.invoice_entity}',
      invoice_number_field: cfg.invoice_number_field || cfg.invoiceNumberField || '${merged.invoice_number_field}',
      status_field: cfg.status_field || cfg.statusField || lifecycle.status_field || lifecycle.statusField || '${merged.status_field}',
      grand_total_field: cfg.grand_total_field || cfg.grandTotalField || '${merged.grand_total_field}',
      paid_total_field: cfg.paid_total_field || cfg.paidTotalField || '${merged.paid_total_field}',
      outstanding_field: cfg.outstanding_field || cfg.outstandingField || '${merged.outstanding_field}',
      idempotency_field: cfg.idempotency_field || cfg.idempotencyField || '${merged.idempotency_field}',
      posted_at_field: cfg.posted_at_field || cfg.postedAtField || '${merged.posted_at_field}',
      cancelled_at_field: cfg.cancelled_at_field || cfg.cancelledAtField || '${merged.cancelled_at_field}',
      number_prefix: cfg.number_prefix || cfg.numberPrefix || '${merged.number_prefix}',
      number_padding: Number(cfg.number_padding || cfg.numberPadding || ${merged.number_padding}) || ${merged.number_padding},
      issue_status: cfg.issue_status || cfg.issueStatus || '${merged.issue_status}',
      cancelled_status: cfg.cancelled_status || cfg.cancelledStatus || '${merged.cancelled_status}',
      transitions:
        lifecycle.transitions && typeof lifecycle.transitions === 'object'
          ? lifecycle.transitions
          : {
              Draft: ['Sent', 'Cancelled'],
              Sent: ['Paid', 'Overdue', 'Cancelled'],
              Overdue: ['Paid', 'Cancelled'],
              Paid: [],
              Cancelled: [],
            },
      enforce_transitions:
        lifecycle.enforce_transitions !== false &&
        lifecycle.enforceTransitions !== false,
    };
  }

  _invTxnErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invTxnNowIso() {
    return new Date().toISOString();
  }

  _invTxnRound(rawValue) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  _invTxnAssertTransition(currentStatus, nextStatus, cfg) {
    if (!cfg.enforce_transitions) return;
    if (!currentStatus || !nextStatus || String(currentStatus) === String(nextStatus)) return;
    const map = cfg.transitions && typeof cfg.transitions === 'object' ? cfg.transitions : {};
    const allowed = Array.isArray(map[currentStatus]) ? map[currentStatus] : [];
    if (!allowed.includes(nextStatus)) {
      throw this._invTxnErr(\`Invalid status transition: \${currentStatus} -> \${nextStatus}\`, 409);
    }
  }

  async _invTxnAllocateNumber(cfg, client, invoice) {
    const current = invoice ? String(invoice[cfg.invoice_number_field] || '') : '';
    if (current && !current.startsWith('DRAFT-')) {
      return current;
    }

    if (this.repository && typeof this.repository.allocatePrefixedNumber === 'function') {
      return this.repository.allocatePrefixedNumber(
        cfg.invoice_entity,
        cfg.invoice_number_field,
        cfg.number_prefix,
        { padding: cfg.number_padding },
        client
      );
    }

    const rows = await this.repository.findAllWithClient(cfg.invoice_entity, {}, client);
    let max = 0;
    for (const row of rows || []) {
      const raw = String(row && row[cfg.invoice_number_field] ? row[cfg.invoice_number_field] : '');
      if (!raw.startsWith(cfg.number_prefix)) continue;
      const suffix = raw.slice(cfg.number_prefix.length);
      const parsed = parseInt(suffix, 10);
      if (!Number.isNaN(parsed)) {
        max = Math.max(max, parsed);
      }
    }
    const next = max + 1;
    return cfg.number_prefix + String(next).padStart(cfg.number_padding, '0');
  }

  async issueInvoice(invoiceId, payload = {}) {
    const cfg = this._invTxnCfg();
    if (this.slug !== cfg.invoice_entity) {
      throw this._invTxnErr(
        \`Invoice issue workflow can only run on '\${cfg.invoice_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const invoice = await this.repository.findByIdForUpdate(this.slug, invoiceId, client);
      if (!invoice) throw this._invTxnErr('Invoice not found', 404);

      const currentStatus = String(invoice[cfg.status_field] || 'Draft');
      const nextStatus = String(payload.status || cfg.issue_status || 'Sent');
      this._invTxnAssertTransition(currentStatus, nextStatus, cfg);

      const invoiceNumber = await this._invTxnAllocateNumber(cfg, client, invoice);
      const grandTotal = this._invTxnRound(invoice[cfg.grand_total_field] || 0);
      const paidTotal = this._invTxnRound(invoice[cfg.paid_total_field] || 0);
      const outstanding = this._invTxnRound(Math.max(grandTotal - paidTotal, 0));

      const patch = {
        [cfg.invoice_number_field]: invoiceNumber,
        [cfg.status_field]: nextStatus,
        [cfg.posted_at_field]: this._invTxnNowIso(),
        [cfg.outstanding_field]: outstanding,
        [cfg.paid_total_field]: paidTotal,
      };
      if (cfg.idempotency_field && payload.idempotency_key) {
        patch[cfg.idempotency_field] = String(payload.idempotency_key);
      }

      const updated = await this.repository.updateWithClient(this.slug, invoiceId, patch, client);
      return {
        invoice: updated,
        operation: 'issue',
      };
    });
  }

  async cancelInvoice(invoiceId, payload = {}) {
    const cfg = this._invTxnCfg();
    if (this.slug !== cfg.invoice_entity) {
      throw this._invTxnErr(
        \`Invoice cancel workflow can only run on '\${cfg.invoice_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const invoice = await this.repository.findByIdForUpdate(this.slug, invoiceId, client);
      if (!invoice) throw this._invTxnErr('Invoice not found', 404);

      const currentStatus = String(invoice[cfg.status_field] || 'Draft');
      const nextStatus = String(payload.status || cfg.cancelled_status || 'Cancelled');
      this._invTxnAssertTransition(currentStatus, nextStatus, cfg);

      const patch = {
        [cfg.status_field]: nextStatus,
        [cfg.cancelled_at_field]: this._invTxnNowIso(),
      };
      const updated = await this.repository.updateWithClient(this.slug, invoiceId, patch, client);
      return {
        invoice: updated,
        operation: 'cancel',
      };
    });
  }
    `,
  };
};
