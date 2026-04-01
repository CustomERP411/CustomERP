module.exports = {
  dependencies: ['InventoryMixin'],

  methods: `
  _invTxnConfig() {
    const cfg =
      this.mixinConfig?.inventory_transaction_safety ||
      this.mixinConfig?.inventoryTransactionSafety ||
      this.mixinConfig?.inventory_transactions ||
      this.mixinConfig?.inventoryTransactions ||
      {};
    const fields = cfg.fields && typeof cfg.fields === 'object' ? cfg.fields : {};
    const movementTypes = cfg.movement_types && typeof cfg.movement_types === 'object'
      ? cfg.movement_types
      : (cfg.movementTypes && typeof cfg.movementTypes === 'object' ? cfg.movementTypes : {});
    return {
      stock_entity: cfg.stock_entity || cfg.stockEntity || this.slug,
      quantity_field: cfg.quantity_field || cfg.quantityField || 'quantity',
      quantity_mode: String(cfg.quantity_mode || cfg.quantityMode || 'change').toLowerCase() === 'absolute' ? 'absolute' : 'change',
      movement_entity: cfg.movement_entity || cfg.movementEntity || 'stock_movements',
      allow_negative_stock:
        cfg.allow_negative_stock === true ||
        cfg.allowNegativeStock === true,
      log_movements: cfg.log_movements !== false && cfg.logMovements !== false,
      fields: {
        item_ref: fields.item_ref || fields.itemRef || 'item_id',
        qty: fields.qty || 'quantity',
        type: fields.type || 'movement_type',
        location: fields.location || fields.location_id || fields.locationId || 'location_id',
        reason: fields.reason || 'reason',
        reference_number: fields.reference_number || fields.referenceNumber || 'reference_number',
        date: fields.date || fields.movement_date || fields.movementDate || 'movement_date',
        from_location: fields.from_location || fields.fromLocation || fields.from_location_id || fields.fromLocationId || 'from_location_id',
        to_location: fields.to_location || fields.toLocation || fields.to_location_id || fields.toLocationId || 'to_location_id',
      },
      movement_types: {
        receive: movementTypes.receive || movementTypes.in || 'IN',
        issue: movementTypes.issue || movementTypes.out || 'OUT',
        adjust: movementTypes.adjust || 'ADJUSTMENT',
        transfer_out: movementTypes.transfer_out || movementTypes.transferOut || 'TRANSFER_OUT',
        transfer_in: movementTypes.transfer_in || movementTypes.transferIn || 'TRANSFER_IN',
      },
    };
  }

  _invTxnError(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invTxnPositiveNumber(raw, fieldName) {
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      throw this._invTxnError(\`\${fieldName} must be greater than zero\`, 400);
    }
    return num;
  }

  _invTxnMovementQuantity(mode, operation, quantity, delta) {
    if (mode === 'absolute') {
      return Math.abs(quantity);
    }
    if (operation === 'adjust') return delta;
    if (operation === 'issue') return -Math.abs(quantity);
    if (operation === 'receive') return Math.abs(quantity);
    return quantity;
  }

  _invTxnBuildMovementRow(cfg, operation, itemId, payload, movementQty, movementType, locationOverride = null) {
    const row = {};
    row[cfg.fields.item_ref] = itemId;
    row[cfg.fields.type] = movementType;
    row[cfg.fields.qty] = movementQty;

    const locationValue = locationOverride === null
      ? (payload.location_id || payload.locationId || payload[cfg.fields.location])
      : locationOverride;
    if (locationValue !== undefined && locationValue !== null && locationValue !== '') {
      row[cfg.fields.location] = locationValue;
    }

    const movementDate =
      payload.movement_date ||
      payload.movementDate ||
      payload.date ||
      payload[cfg.fields.date] ||
      new Date().toISOString();
    row[cfg.fields.date] = movementDate;

    const reason = payload.reason || payload.note || payload[cfg.fields.reason];
    if (reason !== undefined && reason !== null && reason !== '') {
      row[cfg.fields.reason] = reason;
    }

    const ref =
      payload.reference_number ||
      payload.referenceNumber ||
      payload[cfg.fields.reference_number];
    if (ref !== undefined && ref !== null && ref !== '') {
      row[cfg.fields.reference_number] = ref;
    }

    const fromLocation = payload.from_location_id || payload.fromLocationId || payload[cfg.fields.from_location];
    if (fromLocation !== undefined && fromLocation !== null && fromLocation !== '') {
      row[cfg.fields.from_location] = fromLocation;
    }
    const toLocation = payload.to_location_id || payload.toLocationId || payload[cfg.fields.to_location];
    if (toLocation !== undefined && toLocation !== null && toLocation !== '') {
      row[cfg.fields.to_location] = toLocation;
    }

    return row;
  }

  async _invTxnCreateMovements(client, cfg, rows) {
    if (!cfg.log_movements || !cfg.movement_entity) return;
    for (const row of rows) {
      await this.repository.createWithClient(cfg.movement_entity, row, client);
    }
  }

  async _invTxnApplyStockOperation(itemId, operation, payload = {}) {
    const cfg = this._invTxnConfig();
    const stockSlug = cfg.stock_entity || this.slug;
    if (stockSlug !== this.slug) {
      throw this._invTxnError(
        \`Workflow can only run on '\${stockSlug}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    let qty = 0;
    let delta = 0;

    if (operation === 'adjust') {
      const deltaRaw = payload.delta ?? payload.quantity ?? payload.qty ?? payload[cfg.fields.qty];
      const parsedDelta = Number(deltaRaw);
      if (!Number.isFinite(parsedDelta) || parsedDelta === 0) {
        throw this._invTxnError('delta must be a non-zero number for adjust operation', 400);
      }
      delta = parsedDelta;
      qty = Math.abs(parsedDelta);
    } else if (operation === 'receive' || operation === 'issue') {
      const qtyRaw =
        payload.quantity ??
        payload.qty ??
        payload[cfg.fields.qty];
      qty = this._invTxnPositiveNumber(qtyRaw, 'quantity');
      delta = operation === 'receive' ? qty : -qty;
    } else if (operation === 'transfer') {
      const qtyRaw =
        payload.quantity ??
        payload.qty ??
        payload[cfg.fields.qty];
      qty = this._invTxnPositiveNumber(qtyRaw, 'quantity');
      delta = 0;
      const fromLocation = payload.from_location_id || payload.fromLocationId || payload[cfg.fields.from_location];
      const toLocation = payload.to_location_id || payload.toLocationId || payload[cfg.fields.to_location];
      if (!fromLocation || !toLocation) {
        throw this._invTxnError('transfer requires both from and to locations', 400);
      }
      if (String(fromLocation) === String(toLocation)) {
        throw this._invTxnError('from and to locations must be different for transfer', 400);
      }
    } else {
      throw this._invTxnError(\`Unsupported stock operation '\${operation}'\`, 400);
    }

    return this.repository.withTransaction(async (client) => {
      let updatedItem;
      if (delta !== 0) {
        updatedItem = await this.repository.atomicAdjustQuantity(
          this.slug,
          itemId,
          delta,
          {
            quantityField: cfg.quantity_field,
            allow_negative_stock: cfg.allow_negative_stock,
          },
          client
        );
      } else {
        updatedItem = await this.repository.findByIdForUpdate(this.slug, itemId, client);
        if (!updatedItem) throw this._invTxnError('Item not found', 404);
      }

      const movementRows = [];
      if (operation === 'transfer') {
        const outQty = cfg.quantity_mode === 'absolute' ? Math.abs(qty) : -Math.abs(qty);
        const inQty = cfg.quantity_mode === 'absolute' ? Math.abs(qty) : Math.abs(qty);
        movementRows.push(
          this._invTxnBuildMovementRow(
            cfg,
            operation,
            itemId,
            payload,
            outQty,
            cfg.movement_types.transfer_out,
            payload.from_location_id || payload.fromLocationId || payload[cfg.fields.from_location]
          )
        );
        movementRows.push(
          this._invTxnBuildMovementRow(
            cfg,
            operation,
            itemId,
            payload,
            inQty,
            cfg.movement_types.transfer_in,
            payload.to_location_id || payload.toLocationId || payload[cfg.fields.to_location]
          )
        );
      } else {
        const movementType =
          operation === 'receive'
            ? cfg.movement_types.receive
            : operation === 'issue'
              ? cfg.movement_types.issue
              : cfg.movement_types.adjust;
        const movementQty = this._invTxnMovementQuantity(cfg.quantity_mode, operation, qty, delta);
        movementRows.push(
          this._invTxnBuildMovementRow(cfg, operation, itemId, payload, movementQty, movementType)
        );
      }

      await this._invTxnCreateMovements(client, cfg, movementRows);

      return {
        operation,
        item: updatedItem,
        delta,
        movement_count: movementRows.length,
      };
    });
  }

  async applyStockReceive(itemId, payload = {}) {
    return this._invTxnApplyStockOperation(itemId, 'receive', payload);
  }

  async applyStockIssue(itemId, payload = {}) {
    return this._invTxnApplyStockOperation(itemId, 'issue', payload);
  }

  async applyStockAdjust(itemId, payload = {}) {
    return this._invTxnApplyStockOperation(itemId, 'adjust', payload);
  }

  async applyStockTransfer(itemId, payload = {}) {
    return this._invTxnApplyStockOperation(itemId, 'transfer', payload);
  }
  `,
};
