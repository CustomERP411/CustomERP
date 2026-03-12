module.exports = {
  dependencies: ['InventoryTransactionSafetyMixin'],

  methods: `
  _invResCfg() {
    const cfg =
      this.mixinConfig?.inventory_reservation_workflow ||
      this.mixinConfig?.inventoryReservationWorkflow ||
      this.mixinConfig?.inventory_reservation ||
      this.mixinConfig?.inventoryReservation ||
      {};
    return {
      stock_entity: cfg.stock_entity || cfg.stockEntity || this.slug,
      reservation_entity: cfg.reservation_entity || cfg.reservationEntity || 'stock_reservations',
      item_field: cfg.item_field || cfg.itemField || cfg.item_ref_field || cfg.itemRefField || 'item_id',
      quantity_field: cfg.quantity_field || cfg.quantityField || 'quantity',
      status_field: cfg.status_field || cfg.statusField || 'status',
      stock_quantity_field: cfg.stock_quantity_field || cfg.stockQuantityField || 'quantity',
      reserved_field: cfg.reserved_field || cfg.reservedField || 'reserved_quantity',
      committed_field: cfg.committed_field || cfg.committedField || 'committed_quantity',
      available_field: cfg.available_field || cfg.availableField || 'available_quantity',
      consume_on_commit: cfg.consume_on_commit === true || cfg.consumeOnCommit === true,
    };
  }

  _invResErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invResPositive(raw, fieldName = 'quantity') {
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      throw this._invResErr(\`\${fieldName} must be greater than zero\`, 400);
    }
    return num;
  }

  _invResNowIso() {
    return new Date().toISOString();
  }

  async listReservations(itemId, filter = {}) {
    const cfg = this._invResCfg();
    if (cfg.stock_entity !== this.slug) {
      throw this._invResErr(
        \`Reservation workflow can only run on '\${cfg.stock_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const where = {
      [cfg.item_field]: itemId,
    };

    if (filter && Object.prototype.hasOwnProperty.call(filter, cfg.status_field)) {
      where[cfg.status_field] = filter[cfg.status_field];
    } else if (filter && Object.prototype.hasOwnProperty.call(filter, 'status')) {
      where[cfg.status_field] = filter.status;
    }

    return this.repository.findAll(cfg.reservation_entity, where);
  }

  async reserveStock(itemId, payload = {}) {
    const cfg = this._invResCfg();
    if (cfg.stock_entity !== this.slug) {
      throw this._invResErr(
        \`Reservation workflow can only run on '\${cfg.stock_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const quantity = this._invResPositive(
      payload.quantity ?? payload.qty ?? payload[cfg.quantity_field],
      cfg.quantity_field
    );
    const nowIso = this._invResNowIso();

    return this.repository.withTransaction(async (client) => {
      const stock = await this.repository.atomicAdjustReservation(
        this.slug,
        itemId,
        {
          quantityField: cfg.stock_quantity_field,
          reservedField: cfg.reserved_field,
          committedField: cfg.committed_field,
          availableField: cfg.available_field,
          reservedDelta: quantity,
          committedDelta: 0,
          quantityDelta: 0,
          allow_negative_stock: false,
        },
        client
      );

      const reservationNumber =
        payload.reservation_number ||
        payload.reservationNumber ||
        payload.code ||
        \`RSV-\${Date.now()}-\${Math.floor(Math.random() * 10000)}\`;

      const record = {
        reservation_number: reservationNumber,
        [cfg.item_field]: itemId,
        [cfg.quantity_field]: quantity,
        [cfg.status_field]: 'Pending',
        reserved_at: nowIso,
      };

      const sourceReference =
        payload.source_reference ||
        payload.sourceReference ||
        payload.reference_number ||
        payload.referenceNumber ||
        null;
      if (sourceReference) record.source_reference = sourceReference;
      if (payload.note) record.note = payload.note;

      const reservation = await this.repository.createWithClient(cfg.reservation_entity, record, client);

      return {
        reservation,
        stock,
      };
    });
  }

  async releaseReservation(itemId, reservationId, payload = {}) {
    const cfg = this._invResCfg();
    if (cfg.stock_entity !== this.slug) {
      throw this._invResErr(
        \`Reservation workflow can only run on '\${cfg.stock_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const reservation = await this.repository.findByIdForUpdate(cfg.reservation_entity, reservationId, client);
      if (!reservation) throw this._invResErr('Reservation not found', 404);
      if (String(reservation[cfg.item_field]) !== String(itemId)) {
        throw this._invResErr('Reservation does not belong to this item', 400);
      }

      const currentStatus = String(reservation[cfg.status_field] || 'Pending');
      if (currentStatus !== 'Pending') {
        throw this._invResErr('Only pending reservations can be released', 409, { status: currentStatus });
      }

      const quantity = this._invResPositive(reservation[cfg.quantity_field], cfg.quantity_field);

      const stock = await this.repository.atomicAdjustReservation(
        this.slug,
        itemId,
        {
          quantityField: cfg.stock_quantity_field,
          reservedField: cfg.reserved_field,
          committedField: cfg.committed_field,
          availableField: cfg.available_field,
          reservedDelta: -quantity,
          committedDelta: 0,
          quantityDelta: 0,
          allow_negative_stock: false,
        },
        client
      );

      const updatePayload = {
        [cfg.status_field]: 'Released',
        released_at: this._invResNowIso(),
      };
      if (payload.note) updatePayload.note = payload.note;
      const updatedReservation = await this.repository.updateWithClient(
        cfg.reservation_entity,
        reservationId,
        updatePayload,
        client
      );

      return {
        reservation: updatedReservation,
        stock,
      };
    });
  }

  async commitReservation(itemId, reservationId, payload = {}) {
    const cfg = this._invResCfg();
    if (cfg.stock_entity !== this.slug) {
      throw this._invResErr(
        \`Reservation workflow can only run on '\${cfg.stock_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const reservation = await this.repository.findByIdForUpdate(cfg.reservation_entity, reservationId, client);
      if (!reservation) throw this._invResErr('Reservation not found', 404);
      if (String(reservation[cfg.item_field]) !== String(itemId)) {
        throw this._invResErr('Reservation does not belong to this item', 400);
      }

      const currentStatus = String(reservation[cfg.status_field] || 'Pending');
      if (currentStatus !== 'Pending') {
        throw this._invResErr('Only pending reservations can be committed', 409, { status: currentStatus });
      }

      const quantity = this._invResPositive(reservation[cfg.quantity_field], cfg.quantity_field);
      const stockAdjustment = cfg.consume_on_commit
        ? {
            quantityDelta: -quantity,
            reservedDelta: -quantity,
            committedDelta: 0,
          }
        : {
            quantityDelta: 0,
            reservedDelta: -quantity,
            committedDelta: quantity,
          };

      const stock = await this.repository.atomicAdjustReservation(
        this.slug,
        itemId,
        {
          quantityField: cfg.stock_quantity_field,
          reservedField: cfg.reserved_field,
          committedField: cfg.committed_field,
          availableField: cfg.available_field,
          ...stockAdjustment,
          allow_negative_stock: false,
        },
        client
      );

      const updatePayload = {
        [cfg.status_field]: 'Committed',
        committed_at: this._invResNowIso(),
      };
      if (payload.note) updatePayload.note = payload.note;
      const updatedReservation = await this.repository.updateWithClient(
        cfg.reservation_entity,
        reservationId,
        updatePayload,
        client
      );

      return {
        reservation: updatedReservation,
        stock,
      };
    });
  }
  `,
};
