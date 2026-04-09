// Inventory module configuration extraction (split from BackendGenerator)
module.exports = {
  _getInventoryPriorityAConfig() {
    const inventory =
      this.modules && this.modules.inventory && typeof this.modules.inventory === 'object'
        ? this.modules.inventory
        : {};

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
        po_status_field: 'status',
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
    inbound.po_status_field = this._pickFirstString(
      inbound.po_status_field,
      inbound.poStatusField,
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
  }
};
