// Inventory Priority A entity enrichment – extracted from ProjectAssembler
module.exports = {
  _withInventoryPriorityAEntities(entities, sdf) {
    const cfg = this._getInventoryPriorityAConfig(sdf);
    const { enabledModules } = this._resolveErpModules(sdf);
    const enabledSet = new Set(enabledModules || []);
    const inventoryEnabled = enabledSet.has('inventory');
    const packsEnabled =
      this._isPackEnabled(cfg.reservations) ||
      this._isPackEnabled(cfg.transactions) ||
      this._isPackEnabled(cfg.inbound) ||
      this._isPackEnabled(cfg.cycleCounting);

    if (!inventoryEnabled || !packsEnabled) return;

    const bySlug = new Map();
    for (const entity of entities) {
      if (!entity || !entity.slug) continue;
      bySlug.set(entity.slug, entity);
    }

    const ensureEntity = (slug, factory) => {
      if (bySlug.has(slug)) {
        const existing = bySlug.get(slug);
        if (!existing.module) existing.module = 'inventory';
        return existing;
      }
      const created = factory();
      entities.push(created);
      bySlug.set(slug, created);
      return created;
    };

    const ensureField = (entity, field) => {
      if (!entity || !field || !field.name) return;
      if (!Array.isArray(entity.fields)) entity.fields = [];
      if (entity.fields.some((f) => f && f.name === field.name)) return;
      entity.fields.push({ ...field });
    };

    const ensureChild = (entity, childCfg) => {
      if (!entity || !childCfg || !childCfg.entity || !childCfg.foreign_key) return;
      if (!Array.isArray(entity.children)) entity.children = [];
      const exists = entity.children.some((c) => {
        const childSlug = c && (c.entity || c.slug);
        const fk = c && (c.foreign_key || c.foreignKey);
        return childSlug === childCfg.entity && fk === childCfg.foreign_key;
      });
      if (!exists) {
        entity.children.push({ ...childCfg });
      }
    };

    const stockSlug = cfg.stockEntity;
    const stockEntity = ensureEntity(stockSlug, () => ({
      slug: stockSlug,
      display_name: this._formatAutoName(stockSlug),
      display_field: 'name',
      module: 'inventory',
      ui: { search: true, csv_import: true, csv_export: true, print: true },
      list: { columns: ['name', 'quantity'] },
      fields: [
        { name: 'name', type: 'string', label: 'Name', required: true },
        { name: 'quantity', type: 'decimal', label: 'Quantity', required: true, min: 0 },
      ],
      features: { inventory: true },
    }));

    const stockQtyField = this._pickFirstString(
      cfg.transactions.quantity_field,
      cfg.transactions.quantityField,
      cfg.reservations.quantity_field,
      cfg.reservations.quantityField,
      'quantity'
    );
    ensureField(stockEntity, { name: stockQtyField, type: 'decimal', label: this._formatAutoName(stockQtyField), required: true, min: 0 });

    if (this._isPackEnabled(cfg.reservations) || this._isPackEnabled(cfg.transactions)) {
      ensureField(stockEntity, {
        name: cfg.reservations.reserved_field,
        type: 'decimal',
        label: this._formatAutoName(cfg.reservations.reserved_field),
        required: true,
        min: 0,
      });
      ensureField(stockEntity, {
        name: cfg.reservations.committed_field,
        type: 'decimal',
        label: this._formatAutoName(cfg.reservations.committed_field),
        required: true,
        min: 0,
      });
      ensureField(stockEntity, {
        name: cfg.reservations.available_field,
        type: 'decimal',
        label: this._formatAutoName(cfg.reservations.available_field),
        required: true,
        min: 0,
      });
    }

    if (this._isPackEnabled(cfg.reservations)) {
      const reservationEntity = ensureEntity(cfg.reservationEntity, () => ({
        slug: cfg.reservationEntity,
        display_name: 'Stock Reservations',
        display_field: 'reservation_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['reservation_number', cfg.reservations.item_field, cfg.reservations.quantity_field, cfg.reservations.status_field] },
        fields: [],
        features: {},
      }));

      ensureField(reservationEntity, {
        name: 'reservation_number',
        type: 'string',
        label: 'Reservation Number',
        required: true,
        unique: true,
      });
      ensureField(reservationEntity, {
        name: cfg.reservations.item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(reservationEntity, {
        name: cfg.reservations.quantity_field,
        type: 'decimal',
        label: 'Quantity',
        required: true,
        min: 0,
      });
      ensureField(reservationEntity, {
        name: cfg.reservations.status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Pending', 'Released', 'Committed', 'Cancelled'],
      });
      ensureField(reservationEntity, { name: 'source_reference', type: 'string', label: 'Source Reference', required: false });
      ensureField(reservationEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(reservationEntity, { name: 'reserved_at', type: 'datetime', label: 'Reserved At', required: false });
      ensureField(reservationEntity, { name: 'released_at', type: 'datetime', label: 'Released At', required: false });
      ensureField(reservationEntity, { name: 'committed_at', type: 'datetime', label: 'Committed At', required: false });
      ensureChild(stockEntity, {
        entity: cfg.reservationEntity,
        foreign_key: cfg.reservations.item_field,
        label: 'Reservations',
        columns: ['reservation_number', cfg.reservations.quantity_field, cfg.reservations.status_field],
      });
    }

    if (this._isPackEnabled(cfg.inbound)) {
      const poEntity = ensureEntity(cfg.inbound.purchase_order_entity, () => ({
        slug: cfg.inbound.purchase_order_entity,
        display_name: 'Purchase Orders',
        display_field: 'po_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['po_number', 'order_date', 'expected_date', 'status'] },
        fields: [],
        features: {},
      }));
      ensureField(poEntity, { name: 'po_number', type: 'string', label: 'PO Number', required: true, unique: true });
      ensureField(poEntity, { name: 'supplier_name', type: 'string', label: 'Supplier', required: false });
      ensureField(poEntity, {
        name: 'status',
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Open', 'Partial', 'Received', 'Cancelled'],
      });
      ensureField(poEntity, { name: 'order_date', type: 'date', label: 'Order Date', required: true });
      ensureField(poEntity, { name: 'expected_date', type: 'date', label: 'Expected Date', required: false });
      ensureField(poEntity, { name: 'allow_over_receipt', type: 'boolean', label: 'Allow Over Receipt', required: false });
      ensureField(poEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      const poItemEntity = ensureEntity(cfg.inbound.purchase_order_item_entity, () => ({
        slug: cfg.inbound.purchase_order_item_entity,
        display_name: 'Purchase Order Items',
        display_field: cfg.inbound.po_item_item_field,
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.inbound.po_item_parent_field,
            cfg.inbound.po_item_item_field,
            cfg.inbound.po_item_ordered_field,
            cfg.inbound.po_item_received_field,
            cfg.inbound.po_item_status_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_parent_field,
        type: 'reference',
        label: 'Purchase Order',
        required: true,
        reference_entity: cfg.inbound.purchase_order_entity,
      });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_ordered_field,
        type: 'decimal',
        label: 'Ordered Quantity',
        required: true,
        min: 0,
      });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_received_field,
        type: 'decimal',
        label: 'Received Quantity',
        required: true,
        min: 0,
      });
      ensureField(poItemEntity, { name: 'unit_cost', type: 'decimal', label: 'Unit Cost', required: false, min: 0 });
      ensureField(poItemEntity, {
        name: cfg.inbound.po_item_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Open', 'Partial', 'Received', 'Cancelled'],
      });

      const grnEntity = ensureEntity(cfg.inbound.grn_entity, () => ({
        slug: cfg.inbound.grn_entity,
        display_name: 'Goods Receipts',
        display_field: 'grn_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['grn_number', cfg.inbound.grn_parent_field, cfg.inbound.grn_status_field, 'received_at'] },
        fields: [],
        features: {},
      }));
      ensureField(grnEntity, { name: 'grn_number', type: 'string', label: 'GRN Number', required: true, unique: true });
      ensureField(grnEntity, {
        name: cfg.inbound.grn_parent_field,
        type: 'reference',
        label: 'Purchase Order',
        required: true,
        reference_entity: cfg.inbound.purchase_order_entity,
      });
      ensureField(grnEntity, {
        name: cfg.inbound.grn_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'Posted', 'Cancelled'],
      });
      ensureField(grnEntity, { name: 'received_at', type: 'datetime', label: 'Received At', required: false });
      ensureField(grnEntity, { name: 'note', type: 'text', label: 'Note', required: false });
      ensureField(grnEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });

      const grnItemEntity = ensureEntity(cfg.inbound.grn_item_entity, () => ({
        slug: cfg.inbound.grn_item_entity,
        display_name: 'Goods Receipt Items',
        display_field: cfg.inbound.grn_item_item_field,
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.inbound.grn_item_parent_field,
            cfg.inbound.grn_item_po_item_field,
            cfg.inbound.grn_item_item_field,
            cfg.inbound.grn_item_received_field,
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_parent_field,
        type: 'reference',
        label: 'Goods Receipt',
        required: true,
        reference_entity: cfg.inbound.grn_entity,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_po_item_field,
        type: 'reference',
        label: 'PO Item',
        required: true,
        reference_entity: cfg.inbound.purchase_order_item_entity,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_received_field,
        type: 'decimal',
        label: 'Received Quantity',
        required: true,
        min: 0,
      });
      ensureField(grnItemEntity, {
        name: cfg.inbound.grn_item_accepted_field,
        type: 'decimal',
        label: 'Accepted Quantity',
        required: false,
        min: 0,
      });
      ensureField(grnItemEntity, { name: 'rejected_quantity', type: 'decimal', label: 'Rejected Quantity', required: false, min: 0 });
      ensureField(grnItemEntity, { name: 'discrepancy_reason', type: 'text', label: 'Discrepancy Reason', required: false });

      ensureChild(poEntity, {
        entity: cfg.inbound.purchase_order_item_entity,
        foreign_key: cfg.inbound.po_item_parent_field,
        label: 'PO Items',
        columns: [
          cfg.inbound.po_item_item_field,
          cfg.inbound.po_item_ordered_field,
          cfg.inbound.po_item_received_field,
          cfg.inbound.po_item_status_field,
        ],
      });
      ensureChild(grnEntity, {
        entity: cfg.inbound.grn_item_entity,
        foreign_key: cfg.inbound.grn_item_parent_field,
        label: 'Receipt Lines',
        columns: [
          cfg.inbound.grn_item_po_item_field,
          cfg.inbound.grn_item_item_field,
          cfg.inbound.grn_item_received_field,
          cfg.inbound.grn_item_accepted_field,
        ],
      });
    }

    if (this._isPackEnabled(cfg.cycleCounting)) {
      const sessionEntity = ensureEntity(cfg.cycleCounting.session_entity, () => ({
        slug: cfg.cycleCounting.session_entity,
        display_name: 'Cycle Count Sessions',
        display_field: 'session_number',
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: { columns: ['session_number', cfg.cycleCounting.session_status_field, 'planned_at', 'posted_at'] },
        fields: [],
        features: {},
      }));
      ensureField(sessionEntity, { name: 'session_number', type: 'string', label: 'Session Number', required: true, unique: true });
      ensureField(sessionEntity, {
        name: cfg.cycleCounting.session_status_field,
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Draft', 'InProgress', 'PendingApproval', 'Approved', 'Posted', 'Cancelled'],
      });
      ensureField(sessionEntity, { name: 'planned_at', type: 'date', label: 'Planned At', required: false });
      ensureField(sessionEntity, { name: 'started_at', type: 'datetime', label: 'Started At', required: false });
      ensureField(sessionEntity, { name: 'approved_at', type: 'datetime', label: 'Approved At', required: false });
      ensureField(sessionEntity, { name: 'posted_at', type: 'datetime', label: 'Posted At', required: false });
      ensureField(sessionEntity, { name: 'blind_count', type: 'boolean', label: 'Blind Count', required: false });
      ensureField(sessionEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      const lineEntity = ensureEntity(cfg.cycleCounting.line_entity, () => ({
        slug: cfg.cycleCounting.line_entity,
        display_name: 'Cycle Count Lines',
        display_field: cfg.cycleCounting.line_item_field,
        module: 'inventory',
        ui: { search: true, csv_import: true, csv_export: true, print: true },
        list: {
          columns: [
            cfg.cycleCounting.line_session_field,
            cfg.cycleCounting.line_item_field,
            cfg.cycleCounting.line_expected_field,
            cfg.cycleCounting.line_counted_field,
            cfg.cycleCounting.line_variance_field,
            'status',
          ],
        },
        fields: [],
        features: {},
      }));
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_session_field,
        type: 'reference',
        label: 'Cycle Session',
        required: true,
        reference_entity: cfg.cycleCounting.session_entity,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_item_field,
        type: 'reference',
        label: 'Item',
        required: true,
        reference_entity: stockSlug,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_expected_field,
        type: 'decimal',
        label: 'Expected Quantity',
        required: true,
        min: 0,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_counted_field,
        type: 'decimal',
        label: 'Counted Quantity',
        required: false,
        min: 0,
      });
      ensureField(lineEntity, {
        name: cfg.cycleCounting.line_variance_field,
        type: 'decimal',
        label: 'Variance Quantity',
        required: false,
      });
      ensureField(lineEntity, {
        name: 'status',
        type: 'string',
        label: 'Status',
        required: true,
        options: ['Pending', 'Counted', 'Posted'],
      });
      ensureField(lineEntity, { name: 'note', type: 'text', label: 'Note', required: false });

      ensureChild(sessionEntity, {
        entity: cfg.cycleCounting.line_entity,
        foreign_key: cfg.cycleCounting.line_session_field,
        label: 'Cycle Count Lines',
        columns: [
          cfg.cycleCounting.line_item_field,
          cfg.cycleCounting.line_expected_field,
          cfg.cycleCounting.line_counted_field,
          cfg.cycleCounting.line_variance_field,
          'status',
        ],
      });
    }
  },
};
