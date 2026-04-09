// Inventory Priority A config resolution & validation – extracted from ProjectAssembler
module.exports = {
  _getInventoryPriorityAConfig(sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const inventory = (modules.inventory && typeof modules.inventory === 'object') ? modules.inventory : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const reservations = normalizePack(
      inventory.reservations || inventory.reservation,
      {
        reservation_entity: 'stock_reservations',
        item_field: 'item_id',
        quantity_field: 'quantity',
        status_field: 'status',
        reserved_field: 'reserved_quantity',
        committed_field: 'committed_quantity',
        available_field: 'available_quantity',
      }
    );

    const transactions = normalizePack(
      inventory.transactions || inventory.transaction || inventory.stock_transactions || inventory.stockTransactions,
      {
        quantity_field: reservations.quantity_field || 'quantity',
      }
    );

    const inbound = normalizePack(
      inventory.inbound || inventory.receiving,
      {
        purchase_order_entity: 'purchase_orders',
        purchase_order_item_entity: 'purchase_order_items',
        grn_entity: 'goods_receipts',
        grn_item_entity: 'goods_receipt_items',
        po_item_parent_field: 'purchase_order_id',
        po_item_item_field: 'item_id',
        po_item_ordered_field: 'ordered_quantity',
        po_item_received_field: 'received_quantity',
        po_item_status_field: 'status',
        grn_parent_field: 'purchase_order_id',
        grn_item_parent_field: 'goods_receipt_id',
        grn_item_po_item_field: 'purchase_order_item_id',
        grn_item_item_field: 'item_id',
        grn_item_received_field: 'received_quantity',
        grn_item_accepted_field: 'accepted_quantity',
        grn_status_field: 'status',
      }
    );

    const cycleCounting = normalizePack(
      inventory.cycle_counting || inventory.cycleCounting || inventory.cycle_counts || inventory.cycleCounts,
      {
        session_entity: 'cycle_count_sessions',
        line_entity: 'cycle_count_lines',
        line_session_field: 'cycle_count_session_id',
        line_item_field: 'item_id',
        line_expected_field: 'expected_quantity',
        line_counted_field: 'counted_quantity',
        line_variance_field: 'variance_quantity',
        session_status_field: 'status',
      }
    );

    const stockEntity = this._pickFirstString(
      inventory.stock_entity,
      inventory.stockEntity,
      reservations.stock_entity,
      reservations.stockEntity,
      transactions.stock_entity,
      transactions.stockEntity,
      inbound.stock_entity,
      inbound.stockEntity,
      cycleCounting.stock_entity,
      cycleCounting.stockEntity,
      'products'
    );

    reservations.reservation_entity = this._pickFirstString(
      reservations.reservation_entity,
      reservations.reservationEntity,
      'stock_reservations'
    );
    reservations.item_field = this._pickFirstString(
      reservations.item_field,
      reservations.itemField,
      reservations.item_ref_field,
      reservations.itemRefField,
      'item_id'
    );
    reservations.quantity_field = this._pickFirstString(
      reservations.quantity_field,
      reservations.quantityField,
      reservations.reservation_quantity_field,
      reservations.reservationQuantityField,
      'quantity'
    );
    reservations.status_field = this._pickFirstString(
      reservations.status_field,
      reservations.statusField,
      'status'
    );
    reservations.reserved_field = this._pickFirstString(
      reservations.reserved_field,
      reservations.reservedField,
      'reserved_quantity'
    );
    reservations.committed_field = this._pickFirstString(
      reservations.committed_field,
      reservations.committedField,
      'committed_quantity'
    );
    reservations.available_field = this._pickFirstString(
      reservations.available_field,
      reservations.availableField,
      'available_quantity'
    );

    transactions.quantity_field = this._pickFirstString(
      transactions.quantity_field,
      transactions.quantityField,
      reservations.quantity_field,
      'quantity'
    );

    inbound.purchase_order_entity = this._pickFirstString(
      inbound.purchase_order_entity,
      inbound.purchaseOrderEntity,
      'purchase_orders'
    );
    inbound.purchase_order_item_entity = this._pickFirstString(
      inbound.purchase_order_item_entity,
      inbound.purchaseOrderItemEntity,
      'purchase_order_items'
    );
    inbound.grn_entity = this._pickFirstString(
      inbound.grn_entity,
      inbound.grnEntity,
      'goods_receipts'
    );
    inbound.grn_item_entity = this._pickFirstString(
      inbound.grn_item_entity,
      inbound.grnItemEntity,
      'goods_receipt_items'
    );
    inbound.po_item_parent_field = this._pickFirstString(
      inbound.po_item_parent_field,
      inbound.poItemParentField,
      'purchase_order_id'
    );
    inbound.po_item_item_field = this._pickFirstString(
      inbound.po_item_item_field,
      inbound.poItemItemField,
      'item_id'
    );
    inbound.po_item_ordered_field = this._pickFirstString(
      inbound.po_item_ordered_field,
      inbound.poItemOrderedField,
      'ordered_quantity'
    );
    inbound.po_item_received_field = this._pickFirstString(
      inbound.po_item_received_field,
      inbound.poItemReceivedField,
      'received_quantity'
    );
    inbound.po_item_status_field = this._pickFirstString(
      inbound.po_item_status_field,
      inbound.poItemStatusField,
      'status'
    );
    inbound.grn_parent_field = this._pickFirstString(
      inbound.grn_parent_field,
      inbound.grnParentField,
      'purchase_order_id'
    );
    inbound.grn_item_parent_field = this._pickFirstString(
      inbound.grn_item_parent_field,
      inbound.grnItemParentField,
      'goods_receipt_id'
    );
    inbound.grn_item_po_item_field = this._pickFirstString(
      inbound.grn_item_po_item_field,
      inbound.grnItemPoItemField,
      'purchase_order_item_id'
    );
    inbound.grn_item_item_field = this._pickFirstString(
      inbound.grn_item_item_field,
      inbound.grnItemItemField,
      'item_id'
    );
    inbound.grn_item_received_field = this._pickFirstString(
      inbound.grn_item_received_field,
      inbound.grnItemReceivedField,
      'received_quantity'
    );
    inbound.grn_item_accepted_field = this._pickFirstString(
      inbound.grn_item_accepted_field,
      inbound.grnItemAcceptedField,
      'accepted_quantity'
    );
    inbound.grn_status_field = this._pickFirstString(
      inbound.grn_status_field,
      inbound.grnStatusField,
      'status'
    );

    cycleCounting.session_entity = this._pickFirstString(
      cycleCounting.session_entity,
      cycleCounting.sessionEntity,
      'cycle_count_sessions'
    );
    cycleCounting.line_entity = this._pickFirstString(
      cycleCounting.line_entity,
      cycleCounting.lineEntity,
      'cycle_count_lines'
    );
    cycleCounting.line_session_field = this._pickFirstString(
      cycleCounting.line_session_field,
      cycleCounting.lineSessionField,
      'cycle_count_session_id'
    );
    cycleCounting.line_item_field = this._pickFirstString(
      cycleCounting.line_item_field,
      cycleCounting.lineItemField,
      'item_id'
    );
    cycleCounting.line_expected_field = this._pickFirstString(
      cycleCounting.line_expected_field,
      cycleCounting.lineExpectedField,
      'expected_quantity'
    );
    cycleCounting.line_counted_field = this._pickFirstString(
      cycleCounting.line_counted_field,
      cycleCounting.lineCountedField,
      'counted_quantity'
    );
    cycleCounting.line_variance_field = this._pickFirstString(
      cycleCounting.line_variance_field,
      cycleCounting.lineVarianceField,
      'variance_quantity'
    );
    cycleCounting.session_status_field = this._pickFirstString(
      cycleCounting.session_status_field,
      cycleCounting.sessionStatusField,
      'status'
    );

    return {
      stockEntity,
      reservations,
      transactions,
      inbound,
      cycleCounting,
      reservationEntity: reservations.reservation_entity,
    };
  },

  _validateInventoryPriorityAConfig({
    sdf,
    enabledSet,
    hasErpConfig,
    allBySlug,
    requireEntity,
    ensureFields,
  }) {
    const cfg = this._getInventoryPriorityAConfig(sdf);
    const packsEnabled =
      this._isPackEnabled(cfg.reservations) ||
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.inbound) ||
      this._isPackEnabled(cfg.cycleCounting);

    if (!packsEnabled) return;

    const inventoryEnabled = enabledSet.has('inventory');
    if (!inventoryEnabled) {
      throw new Error(
        'SDF Validation Error: Inventory Priority A capability packs require module \'inventory\' to be enabled.'
      );
    }

    const stockEntity = requireEntity(cfg.stockEntity, 'inventory stock');
    const stockModule = this._normalizeEntityModule(stockEntity, { hasErpConfig });
    if (stockModule !== 'inventory' && stockModule !== 'shared') {
      throw new Error(
        `SDF Validation Error: Inventory stock entity '${cfg.stockEntity}' must be in module 'inventory' or 'shared'.`
      );
    }

    if (this._isPackEnabled(cfg.reservations) || this._isPackEnabled(cfg.transactions)) {
      const qtyField = this._pickFirstString(
        cfg.transactions.quantity_field,
        cfg.transactions.quantityField,
        cfg.reservations.quantity_field,
        cfg.reservations.quantityField,
        'quantity'
      );
      const reservedField = this._pickFirstString(
        cfg.reservations.reserved_field,
        cfg.reservations.reservedField,
        'reserved_quantity'
      );
      const committedField = this._pickFirstString(
        cfg.reservations.committed_field,
        cfg.reservations.committedField,
        'committed_quantity'
      );
      const availableField = this._pickFirstString(
        cfg.reservations.available_field,
        cfg.reservations.availableField,
        'available_quantity'
      );
      ensureFields(stockEntity, [qtyField, reservedField, committedField, availableField], cfg.stockEntity);
    }

    if (this._isPackEnabled(cfg.reservations)) {
      const reservationEntity = requireEntity(cfg.reservationEntity, 'inventory reservation workflow');
      const reservationModule = this._normalizeEntityModule(reservationEntity, { hasErpConfig });
      if (reservationModule !== 'inventory') {
        throw new Error(
          `SDF Validation Error: Reservation entity '${cfg.reservationEntity}' must be in module 'inventory'.`
        );
      }
      ensureFields(
        reservationEntity,
        [
          cfg.reservations.item_field,
          cfg.reservations.quantity_field,
          cfg.reservations.status_field,
        ],
        cfg.reservationEntity
      );
    }

    if (this._isPackEnabled(cfg.inbound)) {
      const poEntity = requireEntity(cfg.inbound.purchase_order_entity, 'purchase order header');
      const poItemEntity = requireEntity(cfg.inbound.purchase_order_item_entity, 'purchase order lines');
      const grnEntity = requireEntity(cfg.inbound.grn_entity, 'goods receipt');
      const grnItemEntity = requireEntity(cfg.inbound.grn_item_entity, 'goods receipt lines');

      [poEntity, poItemEntity, grnEntity, grnItemEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'inventory') {
          throw new Error(
            `SDF Validation Error: Inbound workflow entity '${entity.slug}' must be in module 'inventory'.`
          );
        }
      });

      ensureFields(
        poItemEntity,
        [
          cfg.inbound.po_item_parent_field,
          cfg.inbound.po_item_item_field,
          cfg.inbound.po_item_ordered_field,
          cfg.inbound.po_item_received_field,
        ],
        cfg.inbound.purchase_order_item_entity
      );
      ensureFields(
        grnItemEntity,
        [
          cfg.inbound.grn_item_parent_field,
          cfg.inbound.grn_item_po_item_field,
          cfg.inbound.grn_item_item_field,
          cfg.inbound.grn_item_received_field,
        ],
        cfg.inbound.grn_item_entity
      );
    }

    if (this._isPackEnabled(cfg.cycleCounting)) {
      const sessionEntity = requireEntity(cfg.cycleCounting.session_entity, 'cycle count session');
      const lineEntity = requireEntity(cfg.cycleCounting.line_entity, 'cycle count lines');

      [sessionEntity, lineEntity].forEach((entity) => {
        const mod = this._normalizeEntityModule(entity, { hasErpConfig });
        if (mod !== 'inventory') {
          throw new Error(
            `SDF Validation Error: Cycle counting entity '${entity.slug}' must be in module 'inventory'.`
          );
        }
      });

      ensureFields(
        lineEntity,
        [
          cfg.cycleCounting.line_session_field,
          cfg.cycleCounting.line_item_field,
          cfg.cycleCounting.line_expected_field,
          cfg.cycleCounting.line_counted_field,
          cfg.cycleCounting.line_variance_field,
        ],
        cfg.cycleCounting.line_entity
      );
    }

    // Keep unused helper warning clean for strict lint configs.
    void allBySlug;
  },
};
