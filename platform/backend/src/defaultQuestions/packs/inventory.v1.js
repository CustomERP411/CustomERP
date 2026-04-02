const INVENTORY_V2_QUESTIONS = [
  {
    key: 'inv_multi_location',
    prompt: 'Do you keep stock in more than one place (warehouse, store, shelf)?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Setup',
    question_number: 1,
    sdf_mapping: { target: 'entities.products.features.multi_location' },
    sdf_impact_notes:
      'Sets features.multi_location on stock entity. Creates locations entity. ' +
      'Adds location_id reference field to stock entity. ' +
      'Adds location_id, from_location_id, to_location_id to stock_movements. ' +
      'Enables inventory_ops.transfer on stock entity.',
    order_index: 0,
  },
  {
    key: 'inv_allow_negative_stock',
    prompt: 'If stock runs out, should the system still allow sending stock out?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Setup',
    question_number: 2,
    sdf_mapping: { target: 'entities.products.inventory_ops.issue.allow_negative_stock' },
    sdf_impact_notes:
      'Sets allow_negative_stock on the issue operation of the stock entity.',
    order_index: 1,
  },
  {
    key: 'inv_enable_reservations',
    prompt: 'Do you want to reserve stock for orders before confirming?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Capabilities',
    question_number: 3,
    sdf_mapping: { target: 'modules.inventory.reservations.enabled' },
    sdf_impact_notes:
      'Enables reservations pack with entity slug references. ' +
      'Adds reserved_quantity, committed_quantity, available_quantity fields to stock entity. ' +
      'Creates stock_reservations entity (reservation_number, item_id, quantity, status, source_reference, note, reserved_at). ' +
      'Triggers InventoryReservationMixin and InventoryReservationWorkflowMixin on backend.',
    order_index: 2,
  },
  {
    key: 'inv_enable_inbound',
    prompt: 'Do you buy from suppliers and want to track what you ordered vs what you received?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Capabilities',
    question_number: 4,
    sdf_mapping: { target: 'modules.inventory.inbound.enabled' },
    sdf_impact_notes:
      'Enables inbound pack with entity slug references. ' +
      'Creates purchase_orders entity (po_number, supplier_name, status, order_date). ' +
      'Creates purchase_order_items entity (purchase_order_id, item_id, ordered_quantity, received_quantity, status). ' +
      'Creates goods_receipts entity (grn_number, purchase_order_id, status, received_at, posted_at). ' +
      'Creates goods_receipt_items entity (goods_receipt_id, purchase_order_item_id, item_id, received_quantity, accepted_quantity). ' +
      'Triggers InventoryInboundWorkflowMixin on the goods_receipts service.',
    order_index: 3,
  },
  {
    key: 'inv_enable_cycle_counting',
    prompt: 'Do you want to do stock counts to check if system matches reality?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Capabilities',
    question_number: 5,
    sdf_mapping: { target: 'modules.inventory.cycle_counting.enabled' },
    sdf_impact_notes:
      'Enables cycle counting pack with entity slug references. ' +
      'Creates cycle_count_sessions entity (session_number, status, started_at, approved_at, approved_by, posted_at, note). ' +
      'Creates cycle_count_lines entity (cycle_count_session_id, item_id, expected_quantity, counted_quantity, variance_quantity, status). ' +
      'Triggers InventoryCycleCountWorkflowMixin on cycle_count_sessions service ' +
      'and InventoryCycleCountLineMixin on cycle_count_lines service.',
    order_index: 4,
  },
  {
    key: 'inv_batch_tracking',
    prompt: 'Do you track items by batch or lot number? (common for food, medicine, chemicals)',
    type: 'yes_no',
    required: true,
    section: 'Inventory Tracking',
    question_number: 6,
    sdf_mapping: { target: 'entities.products.features.batch_tracking' },
    sdf_impact_notes:
      'Sets features.batch_tracking on stock entity. ' +
      'Adds batch_number field to stock entity. ' +
      'Adds batch_number field to stock_movements entity. ' +
      'Triggers BatchTrackingMixin on backend (batch validation, findByBatch, getExpiredItems).',
    order_index: 5,
  },
  {
    key: 'inv_serial_tracking',
    prompt: 'Do you track individual items by serial number? (common for electronics, equipment)',
    type: 'yes_no',
    required: true,
    section: 'Inventory Tracking',
    question_number: 7,
    sdf_mapping: { target: 'entities.products.features.serial_tracking' },
    sdf_impact_notes:
      'Sets features.serial_tracking on stock entity. ' +
      'Adds serial_number (unique) field to stock entity. ' +
      'Adds serial_number field to stock_movements entity. ' +
      'Triggers SerialTrackingMixin on backend (serial uniqueness enforcement, quantity fixed to 1).',
    order_index: 6,
  },
  {
    key: 'inv_expiry_tracking',
    prompt: 'Do your products have expiry dates?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Tracking',
    question_number: 8,
    sdf_mapping: { target: 'modules.inventory_dashboard.expiry.enabled' },
    sdf_impact_notes:
      'Sets features.expiry_tracking on stock entity. ' +
      'Adds expiry_date field to stock entity. ' +
      'Enables expiry alert card on dashboard (modules.inventory_dashboard.expiry.enabled).',
    order_index: 7,
  },
  {
    key: 'inv_low_stock_alerts',
    prompt: 'Do you want to be warned when stock is running low?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Extras',
    question_number: 9,
    sdf_mapping: { target: 'modules.inventory_dashboard.low_stock.enabled' },
    sdf_impact_notes:
      'Enables low stock alert card on dashboard (modules.inventory_dashboard.low_stock.enabled). ' +
      'Uses reorder_point field on stock entity to determine threshold.',
    order_index: 8,
  },
  {
    key: 'inv_costing_method',
    prompt: 'How do you want to calculate the cost of your stock?',
    type: 'choice',
    options: ['FIFO (first items in are first out)', 'Weighted Average (average cost of all items)', 'No costing needed'],
    required: true,
    section: 'Inventory Setup',
    question_number: 10,
    sdf_mapping: { target: 'modules.inventory.costing_method' },
    sdf_impact_notes:
      'Sets modules.inventory.costing_method ("fifo" | "weighted_average" | null). ' +
      'Adds cost_price and total_value fields to stock entity when enabled. ' +
      'Triggers InventoryCostingMixin on backend for cost recalculation on receive/issue.',
    order_index: 9,
  },
  {
    key: 'inv_qr_labels',
    prompt: 'Do you want to print QR code labels for your products?',
    type: 'yes_no',
    required: true,
    section: 'Inventory Extras',
    question_number: 11,
    sdf_mapping: { target: 'entities.products.labels.enabled' },
    sdf_impact_notes:
      'Sets labels = { enabled: true, type: "qrcode" } on stock entity. ' +
      'Generates QR label page with print capability in generated ERP.',
    order_index: 10,
  },
];

module.exports = {
  module: 'inventory',
  version: 'inventory.v2',
  template_type: 'sdf_impact_only',
  source_path: null,
  getQuestions() {
    return JSON.parse(JSON.stringify(INVENTORY_V2_QUESTIONS));
  },
};
