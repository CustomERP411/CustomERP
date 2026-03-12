module.exports = (config = {}) => {
  const defaults = {
    invoice_entity: 'invoices',
    note_entity: 'invoice_notes',
    invoice_status_field: 'status',
    invoice_grand_total_field: 'grand_total',
    invoice_paid_total_field: 'paid_total',
    invoice_outstanding_field: 'outstanding_balance',
    note_number_field: 'note_number',
    note_invoice_field: 'source_invoice_id',
    note_type_field: 'note_type',
    note_status_field: 'status',
    note_amount_field: 'amount',
    note_tax_total_field: 'tax_total',
    note_grand_total_field: 'grand_total',
    note_posted_at_field: 'posted_at',
    note_number_credit_prefix: 'CN-',
    note_number_debit_prefix: 'DN-',
    note_number_padding: 6,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: ['InvoiceTransactionSafetyMixin'],
    methods: `
  _invNoteCfg() {
    const cfg =
      this.mixinConfig?.invoice_note_workflow ||
      this.mixinConfig?.invoiceNoteWorkflow ||
      this.mixinConfig?.invoice_notes ||
      this.mixinConfig?.invoiceNotes ||
      {};
    return {
      invoice_entity: cfg.invoice_entity || cfg.invoiceEntity || '${merged.invoice_entity}',
      note_entity: cfg.note_entity || cfg.noteEntity || '${merged.note_entity}',
      invoice_status_field: cfg.invoice_status_field || cfg.invoiceStatusField || '${merged.invoice_status_field}',
      invoice_grand_total_field: cfg.invoice_grand_total_field || cfg.invoiceGrandTotalField || '${merged.invoice_grand_total_field}',
      invoice_paid_total_field: cfg.invoice_paid_total_field || cfg.invoicePaidTotalField || '${merged.invoice_paid_total_field}',
      invoice_outstanding_field: cfg.invoice_outstanding_field || cfg.invoiceOutstandingField || '${merged.invoice_outstanding_field}',
      note_number_field: cfg.note_number_field || cfg.noteNumberField || '${merged.note_number_field}',
      note_invoice_field: cfg.note_invoice_field || cfg.noteInvoiceField || '${merged.note_invoice_field}',
      note_type_field: cfg.note_type_field || cfg.noteTypeField || '${merged.note_type_field}',
      note_status_field: cfg.note_status_field || cfg.noteStatusField || '${merged.note_status_field}',
      note_amount_field: cfg.note_amount_field || cfg.noteAmountField || '${merged.note_amount_field}',
      note_tax_total_field: cfg.note_tax_total_field || cfg.noteTaxTotalField || '${merged.note_tax_total_field}',
      note_grand_total_field: cfg.note_grand_total_field || cfg.noteGrandTotalField || '${merged.note_grand_total_field}',
      note_posted_at_field: cfg.note_posted_at_field || cfg.notePostedAtField || '${merged.note_posted_at_field}',
      note_number_credit_prefix: cfg.note_number_credit_prefix || cfg.noteNumberCreditPrefix || '${merged.note_number_credit_prefix}',
      note_number_debit_prefix: cfg.note_number_debit_prefix || cfg.noteNumberDebitPrefix || '${merged.note_number_debit_prefix}',
      note_number_padding: Number(cfg.note_number_padding || cfg.noteNumberPadding || ${merged.note_number_padding}) || ${merged.note_number_padding},
    };
  }

  _invNoteErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invNoteRound(rawValue) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  _invNoteType(rawType) {
    const type = String(rawType || '').toLowerCase();
    if (type === 'credit') return 'Credit';
    if (type === 'debit') return 'Debit';
    throw this._invNoteErr('note_type must be Credit or Debit', 400);
  }

  async _invNoteAllocateNumber(client, cfg, noteType) {
    const prefix = noteType === 'Credit' ? cfg.note_number_credit_prefix : cfg.note_number_debit_prefix;
    if (this.repository && typeof this.repository.allocatePrefixedNumber === 'function') {
      return this.repository.allocatePrefixedNumber(
        cfg.note_entity,
        cfg.note_number_field,
        prefix,
        { padding: cfg.note_number_padding },
        client
      );
    }
    const rows = await this.repository.findAllWithClient(cfg.note_entity, {}, client);
    let max = 0;
    for (const row of rows || []) {
      const raw = String(row && row[cfg.note_number_field] ? row[cfg.note_number_field] : '');
      if (!raw.startsWith(prefix)) continue;
      const parsed = parseInt(raw.slice(prefix.length), 10);
      if (!Number.isNaN(parsed)) max = Math.max(max, parsed);
    }
    return prefix + String(max + 1).padStart(cfg.note_number_padding, '0');
  }

  async _invNoteApplyInvoiceImpact(client, cfg, note, direction) {
    const invoiceId = note[cfg.note_invoice_field];
    const invoice = await this.repository.findByIdForUpdate(cfg.invoice_entity, invoiceId, client);
    if (!invoice) throw this._invNoteErr('Source invoice not found', 404);

    const type = this._invNoteType(note[cfg.note_type_field]);
    const noteGrand = this._invNoteRound(
      note[cfg.note_grand_total_field] !== undefined
        ? note[cfg.note_grand_total_field]
        : (this._invNoteRound(note[cfg.note_amount_field]) + this._invNoteRound(note[cfg.note_tax_total_field]))
    );
    if (noteGrand <= 0) {
      throw this._invNoteErr('Note grand total must be greater than zero', 400);
    }

    const signByType = type === 'Credit' ? -1 : 1;
    const signedDelta = noteGrand * signByType * direction;

    const currentGrand = this._invNoteRound(invoice[cfg.invoice_grand_total_field] || 0);
    const currentPaid = this._invNoteRound(invoice[cfg.invoice_paid_total_field] || 0);
    let nextGrand = this._invNoteRound(currentGrand + signedDelta);
    if (nextGrand < 0) {
      throw this._invNoteErr('Credit note exceeds invoice grand total', 409, {
        invoice_id: invoiceId,
        current_grand_total: currentGrand,
        note_impact: signedDelta,
      });
    }
    if (currentPaid > nextGrand + 0.0001) {
      throw this._invNoteErr('Invoice paid total cannot exceed adjusted grand total', 409, {
        invoice_id: invoiceId,
        paid_total: currentPaid,
        adjusted_grand_total: nextGrand,
      });
    }

    const outstanding = this._invNoteRound(Math.max(nextGrand - currentPaid, 0));
    let status = String(invoice[cfg.invoice_status_field] || 'Draft');
    if (status !== 'Cancelled') {
      if (outstanding <= 0) status = 'Paid';
      else if (status === 'Paid') status = 'Sent';
      else if (status === 'Draft') status = 'Sent';
    }

    return this.repository.updateWithClient(cfg.invoice_entity, invoiceId, {
      [cfg.invoice_grand_total_field]: nextGrand,
      [cfg.invoice_outstanding_field]: outstanding,
      [cfg.invoice_status_field]: status,
    }, client);
  }

  async listInvoiceNotes(invoiceId, filter = {}) {
    const cfg = this._invNoteCfg();
    if (this.slug !== cfg.invoice_entity) {
      throw this._invNoteErr(
        \`Invoice note listing can only run on '\${cfg.invoice_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    const where = {
      [cfg.note_invoice_field]: invoiceId,
    };
    if (filter && Object.prototype.hasOwnProperty.call(filter, cfg.note_status_field)) {
      where[cfg.note_status_field] = filter[cfg.note_status_field];
    } else if (filter && Object.prototype.hasOwnProperty.call(filter, 'status')) {
      where[cfg.note_status_field] = filter.status;
    }
    return this.repository.findAll(cfg.note_entity, where);
  }

  async createInvoiceNote(invoiceId, payload = {}) {
    const cfg = this._invNoteCfg();
    if (this.slug !== cfg.invoice_entity) {
      throw this._invNoteErr(
        \`Invoice note create can only run on '\${cfg.invoice_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const amount = this._invNoteRound(payload[cfg.note_amount_field] ?? payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw this._invNoteErr(\`\${cfg.note_amount_field} must be greater than zero\`, 400);
    }
    const taxTotal = this._invNoteRound(payload[cfg.note_tax_total_field] ?? payload.tax_total ?? 0);
    if (taxTotal < 0) {
      throw this._invNoteErr(\`\${cfg.note_tax_total_field} cannot be negative\`, 400);
    }
    const type = this._invNoteType(payload[cfg.note_type_field] ?? payload.note_type);
    const grandTotal = this._invNoteRound(
      payload[cfg.note_grand_total_field] !== undefined
        ? payload[cfg.note_grand_total_field]
        : amount + taxTotal
    );

    return this.repository.withTransaction(async (client) => {
      const sourceInvoice = await this.repository.findByIdForUpdate(cfg.invoice_entity, invoiceId, client);
      if (!sourceInvoice) throw this._invNoteErr('Source invoice not found', 404);

      const noteNumber =
        payload[cfg.note_number_field] ||
        payload.note_number ||
        payload.noteNumber ||
        await this._invNoteAllocateNumber(client, cfg, type);

      const record = {
        [cfg.note_number_field]: noteNumber,
        [cfg.note_invoice_field]: invoiceId,
        [cfg.note_type_field]: type,
        [cfg.note_status_field]: 'Draft',
        issue_date: payload.issue_date || payload.issueDate || new Date().toISOString().slice(0, 10),
        [cfg.note_amount_field]: amount,
        [cfg.note_tax_total_field]: taxTotal,
        [cfg.note_grand_total_field]: grandTotal,
      };
      if (payload.reason) record.reason = payload.reason;
      if (payload.note) record.note = payload.note;

      const note = await this.repository.createWithClient(cfg.note_entity, record, client);
      return {
        note,
        invoice: sourceInvoice,
      };
    });
  }

  async postInvoiceNote(noteId, payload = {}) {
    const cfg = this._invNoteCfg();
    if (this.slug !== cfg.note_entity) {
      throw this._invNoteErr(
        \`Invoice note post can only run on '\${cfg.note_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const note = await this.repository.findByIdForUpdate(cfg.note_entity, noteId, client);
      if (!note) throw this._invNoteErr('Invoice note not found', 404);
      const status = String(note[cfg.note_status_field] || 'Draft');
      if (status === 'Cancelled') {
        throw this._invNoteErr('Cancelled note cannot be posted', 409);
      }
      if (status !== 'Posted') {
        await this._invNoteApplyInvoiceImpact(client, cfg, note, 1);
      }

      const updatedNote = await this.repository.updateWithClient(cfg.note_entity, noteId, {
        [cfg.note_status_field]: 'Posted',
        [cfg.note_posted_at_field]: note[cfg.note_posted_at_field] || new Date().toISOString(),
        post_reference: payload.post_reference || payload.postReference || null,
      }, client);
      return {
        note: updatedNote,
      };
    });
  }

  async cancelInvoiceNote(noteId, payload = {}) {
    const cfg = this._invNoteCfg();
    if (this.slug !== cfg.note_entity) {
      throw this._invNoteErr(
        \`Invoice note cancel can only run on '\${cfg.note_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const note = await this.repository.findByIdForUpdate(cfg.note_entity, noteId, client);
      if (!note) throw this._invNoteErr('Invoice note not found', 404);
      const status = String(note[cfg.note_status_field] || 'Draft');
      if (status === 'Cancelled') {
        throw this._invNoteErr('Invoice note is already cancelled', 409);
      }

      if (status === 'Posted') {
        await this._invNoteApplyInvoiceImpact(client, cfg, note, -1);
      }

      const updatedNote = await this.repository.updateWithClient(cfg.note_entity, noteId, {
        [cfg.note_status_field]: 'Cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: payload.reason || payload.cancel_reason || payload.cancelReason || null,
      }, client);
      return {
        note: updatedNote,
      };
    });
  }
    `,
  };
};
