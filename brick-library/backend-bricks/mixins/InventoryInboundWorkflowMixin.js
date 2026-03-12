module.exports = {
  dependencies: ['InventoryTransactionSafetyMixin'],

  methods: `
  _invInboundCfg() {
    const cfg =
      this.mixinConfig?.inventory_inbound_workflow ||
      this.mixinConfig?.inventoryInboundWorkflow ||
      this.mixinConfig?.inventory_inbound ||
      this.mixinConfig?.inventoryInbound ||
      {};
    return {
      stock_entity: cfg.stock_entity || cfg.stockEntity || 'products',
      quantity_field: cfg.quantity_field || cfg.quantityField || 'quantity',
      purchase_order_entity: cfg.purchase_order_entity || cfg.purchaseOrderEntity || 'purchase_orders',
      purchase_order_item_entity: cfg.purchase_order_item_entity || cfg.purchaseOrderItemEntity || 'purchase_order_items',
      grn_entity: cfg.grn_entity || cfg.grnEntity || this.slug,
      grn_item_entity: cfg.grn_item_entity || cfg.grnItemEntity || 'goods_receipt_items',
      po_item_parent_field: cfg.po_item_parent_field || cfg.poItemParentField || 'purchase_order_id',
      po_item_item_field: cfg.po_item_item_field || cfg.poItemItemField || 'item_id',
      po_item_ordered_field: cfg.po_item_ordered_field || cfg.poItemOrderedField || 'ordered_quantity',
      po_item_received_field: cfg.po_item_received_field || cfg.poItemReceivedField || 'received_quantity',
      po_item_status_field: cfg.po_item_status_field || cfg.poItemStatusField || 'status',
      po_status_field: cfg.po_status_field || cfg.poStatusField || 'status',
      grn_parent_field: cfg.grn_parent_field || cfg.grnParentField || 'purchase_order_id',
      grn_item_parent_field: cfg.grn_item_parent_field || cfg.grnItemParentField || 'goods_receipt_id',
      grn_item_po_item_field: cfg.grn_item_po_item_field || cfg.grnItemPoItemField || 'purchase_order_item_id',
      grn_item_item_field: cfg.grn_item_item_field || cfg.grnItemItemField || 'item_id',
      grn_item_received_field: cfg.grn_item_received_field || cfg.grnItemReceivedField || 'received_quantity',
      grn_item_accepted_field: cfg.grn_item_accepted_field || cfg.grnItemAcceptedField || 'accepted_quantity',
      grn_status_field: cfg.grn_status_field || cfg.grnStatusField || 'status',
      allow_over_receipt: cfg.allow_over_receipt === true || cfg.allowOverReceipt === true,
    };
  }

  _invInboundErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _invInboundNum(raw) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  async postGoodsReceipt(grnId, payload = {}) {
    const cfg = this._invInboundCfg();
    if (cfg.grn_entity !== this.slug) {
      throw this._invInboundErr(
        \`Inbound workflow can only run on '\${cfg.grn_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const grn = await this.repository.findByIdForUpdate(this.slug, grnId, client);
      if (!grn) throw this._invInboundErr('Goods receipt not found', 404);

      const currentStatus = String(grn[cfg.grn_status_field] || 'Draft');
      if (currentStatus === 'Posted') {
        return {
          already_posted: true,
          goods_receipt: grn,
        };
      }
      if (currentStatus === 'Cancelled') {
        throw this._invInboundErr('Cancelled goods receipt cannot be posted', 409);
      }

      const grnItems = await this.repository.findAllWithClient(
        cfg.grn_item_entity,
        { [cfg.grn_item_parent_field]: grnId },
        client
      );
      if (!Array.isArray(grnItems) || grnItems.length === 0) {
        throw this._invInboundErr('Goods receipt has no lines to post', 400);
      }

      const poId = grn[cfg.grn_parent_field];
      const allowOverReceipt =
        payload.allow_over_receipt === true ||
        payload.allowOverReceipt === true ||
        cfg.allow_over_receipt === true ||
        grn.allow_over_receipt === true;

      let totalReceived = 0;
      const stockChanges = [];
      for (const line of grnItems) {
        const acceptedRaw = line[cfg.grn_item_accepted_field];
        const receivedRaw = line[cfg.grn_item_received_field];
        const lineQty = this._invInboundNum(
          acceptedRaw !== undefined && acceptedRaw !== null && acceptedRaw !== ''
            ? acceptedRaw
            : receivedRaw
        );
        if (lineQty <= 0) continue;

        const poItemId = line[cfg.grn_item_po_item_field];
        let poItem = null;
        if (poItemId) {
          poItem = await this.repository.findByIdForUpdate(cfg.purchase_order_item_entity, poItemId, client);
          if (!poItem) {
            throw this._invInboundErr(
              \`Purchase order item '\${poItemId}' linked from goods receipt line does not exist\`,
              409
            );
          }

          const orderedQty = this._invInboundNum(poItem[cfg.po_item_ordered_field]);
          const currentReceivedQty = this._invInboundNum(poItem[cfg.po_item_received_field]);
          const nextReceivedQty = currentReceivedQty + lineQty;
          if (!allowOverReceipt && orderedQty > 0 && nextReceivedQty > orderedQty) {
            throw this._invInboundErr('Received quantity exceeds ordered quantity', 409, {
              po_item_id: poItemId,
              ordered_quantity: orderedQty,
              current_received_quantity: currentReceivedQty,
              posting_quantity: lineQty,
            });
          }

          const poItemStatus = nextReceivedQty >= orderedQty && orderedQty > 0
            ? 'Received'
            : (nextReceivedQty > 0 ? 'Partial' : 'Open');
          await this.repository.updateWithClient(
            cfg.purchase_order_item_entity,
            poItemId,
            {
              [cfg.po_item_received_field]: nextReceivedQty,
              [cfg.po_item_status_field]: poItemStatus,
            },
            client
          );
        }

        const stockItemId = line[cfg.grn_item_item_field] || (poItem ? poItem[cfg.po_item_item_field] : null);
        if (stockItemId) {
          const updatedStock = await this.repository.atomicAdjustQuantity(
            cfg.stock_entity,
            stockItemId,
            lineQty,
            {
              quantityField: cfg.quantity_field,
              allow_negative_stock: false,
            },
            client
          );
          stockChanges.push({
            item_id: stockItemId,
            quantity_delta: lineQty,
            quantity: updatedStock ? updatedStock[cfg.quantity_field] : null,
          });
        }
        totalReceived += lineQty;
      }

      let purchaseOrder = null;
      if (poId) {
        purchaseOrder = await this.repository.findByIdForUpdate(cfg.purchase_order_entity, poId, client);
      }

      if (purchaseOrder) {
        const poLines = await this.repository.findAllWithClient(
          cfg.purchase_order_item_entity,
          { [cfg.po_item_parent_field]: poId },
          client
        );
        const hasLines = Array.isArray(poLines) && poLines.length > 0;
        const isReceived = hasLines && poLines.every((line) => {
          const ordered = this._invInboundNum(line[cfg.po_item_ordered_field]);
          const received = this._invInboundNum(line[cfg.po_item_received_field]);
          return ordered <= 0 ? received > 0 : received >= ordered;
        });
        const hasAnyReceived = hasLines && poLines.some((line) => this._invInboundNum(line[cfg.po_item_received_field]) > 0);
        const poStatus = isReceived ? 'Received' : (hasAnyReceived ? 'Partial' : 'Open');
        purchaseOrder = await this.repository.updateWithClient(
          cfg.purchase_order_entity,
          poId,
          { [cfg.po_status_field]: poStatus },
          client
        );
      }

      const nowIso = new Date().toISOString();
      const goodsReceipt = await this.repository.updateWithClient(
        this.slug,
        grnId,
        {
          [cfg.grn_status_field]: 'Posted',
          posted_at: nowIso,
          received_at: grn.received_at || nowIso,
        },
        client
      );

      return {
        goods_receipt: goodsReceipt,
        purchase_order: purchaseOrder,
        total_received_quantity: totalReceived,
        stock_changes: stockChanges,
      };
    });
  }

  async cancelGoodsReceipt(grnId, payload = {}) {
    const cfg = this._invInboundCfg();
    if (cfg.grn_entity !== this.slug) {
      throw this._invInboundErr(
        \`Inbound workflow can only run on '\${cfg.grn_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const grn = await this.repository.findByIdForUpdate(this.slug, grnId, client);
      if (!grn) throw this._invInboundErr('Goods receipt not found', 404);
      const currentStatus = String(grn[cfg.grn_status_field] || 'Draft');
      if (currentStatus === 'Posted') {
        throw this._invInboundErr('Posted goods receipt cannot be cancelled', 409);
      }
      if (currentStatus === 'Cancelled') {
        return {
          already_cancelled: true,
          goods_receipt: grn,
        };
      }

      const note = payload.note || payload.reason || null;
      const cancelled = await this.repository.updateWithClient(
        this.slug,
        grnId,
        {
          [cfg.grn_status_field]: 'Cancelled',
          cancelled_at: new Date().toISOString(),
          note: note || grn.note || null,
        },
        client
      );

      return {
        goods_receipt: cancelled,
      };
    });
  }
  `,
};
