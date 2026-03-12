const INVENTORY_V1_QUESTIONS_PART_1 = [
  {
    "key": "inv_business_type",
    "prompt": "What best describes your business?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 1,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_business_type"
    },
    "options": [
      "Retail store",
      "Wholesaler/distributor",
      "Manufacturer",
      "Service business with stock",
      "Other"
    ],
    "order_index": 0
  },
  {
    "key": "inv_item_label",
    "prompt": "What do you call the things you keep in stock?",
    "type": "choice",
    "allow_custom": true,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 2,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_item_label"
    },
    "options": [
      "Products",
      "Items",
      "Materials",
      "Stock",
      "Custom"
    ],
    "order_index": 1
  },
  {
    "key": "inv_identifier_style",
    "prompt": "How do you identify each item?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 3,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_identifier_style"
    },
    "options": [
      "SKU code",
      "Barcode",
      "Item name only",
      "Code + name"
    ],
    "order_index": 2
  },
  {
    "key": "inv_uom_mode",
    "prompt": "Do you need one unit only or multiple units (for example piece/box/carton)?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 4,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_uom_mode"
    },
    "options": [
      "One unit only",
      "Multiple units with conversion"
    ],
    "order_index": 3
  },
  {
    "key": "inv_use_categories",
    "prompt": "Do you want item categories (for example Electronics, Food, Office)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 5,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_categories"
    },
    "order_index": 4
  },
  {
    "key": "inv_use_variants",
    "prompt": "Do your items have variants (for example size/color)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 6,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_variants"
    },
    "order_index": 5
  },
  {
    "key": "inv_use_locations",
    "prompt": "Do you keep stock in more than one place (warehouse/store/shelf)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 7,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_locations"
    },
    "order_index": 6
  },
  {
    "key": "inv_track_incoming",
    "prompt": "Do you want to record stock coming in (receiving/purchases)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 8,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_track_incoming"
    },
    "order_index": 7
  },
  {
    "key": "inv_track_outgoing",
    "prompt": "Do you want to record stock going out (sales/usage)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 9,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_track_outgoing"
    },
    "order_index": 8
  },
  {
    "key": "inv_outgoing_label",
    "prompt": "What should we call stock going out in the app?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 10,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_outgoing_label"
    },
    "options": [
      "Sell",
      "Issue",
      "Dispatch",
      "Use"
    ],
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 9
  },
  {
    "key": "inv_allow_negative_stock",
    "prompt": "If stock is not enough, should the system still allow outgoing transactions?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 11,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_allow_negative_stock"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 10
  },
  {
    "key": "inv_enable_adjustments",
    "prompt": "Do you want stock correction (damage, loss, count difference)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 12,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_enable_adjustments"
    },
    "order_index": 11
  },
  {
    "key": "inv_need_low_stock_alerts",
    "prompt": "Do you want low-stock alerts?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 13,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_low_stock_alerts"
    },
    "order_index": 12
  },
  {
    "key": "inv_need_expiry_tracking",
    "prompt": "Do your items have expiry dates?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 14,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_expiry_tracking"
    },
    "order_index": 13
  },
  {
    "key": "inv_need_batch_tracking",
    "prompt": "Do you track batch/lot numbers?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 15,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_batch_tracking"
    },
    "order_index": 14
  },
  {
    "key": "inv_need_serial_tracking",
    "prompt": "Do you track serial number per individual unit?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 16,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_serial_tracking"
    },
    "order_index": 15
  },
  {
    "key": "inv_need_cycle_counts",
    "prompt": "Do you want cycle counting and stock count sessions?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 17,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_cycle_counts"
    },
    "order_index": 16
  },
  {
    "key": "inv_need_costing",
    "prompt": "Do you need inventory costing and valuation reports?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 18,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_costing"
    },
    "order_index": 17
  },
  {
    "key": "inv_need_returns",
    "prompt": "Do you need return workflows (customer return or supplier return)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 19,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_returns"
    },
    "order_index": 18
  },
  {
    "key": "inv_need_integrations",
    "prompt": "Do you need integrations with other systems (POS, ecommerce, accounting)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Core Questions (Always Required)",
    "question_number": 20,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_integrations"
    },
    "order_index": 19
  },
  {
    "key": "inv_item_statuses",
    "prompt": "Do you want item statuses such as Draft, Active, and Obsolete?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack A: Item Master and Catalog",
    "question_number": 21,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_item_statuses"
    },
    "order_index": 20
  },
  {
    "key": "inv_use_brands",
    "prompt": "Do you want to track brand/manufacturer for items?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack A: Item Master and Catalog",
    "question_number": 22,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_brands"
    },
    "order_index": 21
  },
  {
    "key": "inv_use_supplier_item_mapping",
    "prompt": "Should one item be linked to one or more suppliers?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack A: Item Master and Catalog",
    "question_number": 23,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_supplier_item_mapping"
    },
    "order_index": 22
  },
  {
    "key": "inv_use_packaging_levels",
    "prompt": "Do you want packaging levels (for example inner pack, case, pallet)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack A: Item Master and Catalog",
    "question_number": 24,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_packaging_levels"
    },
    "order_index": 23
  },
  {
    "key": "inv_use_custom_attributes",
    "prompt": "Do you need custom extra fields for items?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack A: Item Master and Catalog",
    "question_number": 25,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_custom_attributes"
    },
    "order_index": 24
  },
  {
    "key": "inv_location_label",
    "prompt": "What should we call your stock places?",
    "type": "choice",
    "allow_custom": true,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 26,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_location_label"
    },
    "options": [
      "Warehouses",
      "Stores",
      "Locations",
      "Bins/Shelves",
      "Custom"
    ],
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_locations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 25
  }
];

const INVENTORY_V1_QUESTIONS_PART_2 = [
  {
    "key": "inv_track_bins",
    "prompt": "Do you need bin/shelf-level stock tracking?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 27,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_track_bins"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_locations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 26
  },
  {
    "key": "inv_use_zone_rack_bin_structure",
    "prompt": "Do you want location hierarchy (Zone > Aisle > Rack > Bin)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 28,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_zone_rack_bin_structure"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_locations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 27
  },
  {
    "key": "inv_enable_transfers",
    "prompt": "Do you want transfer between locations?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 29,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_enable_transfers"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_locations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 28
  },
  {
    "key": "inv_transfer_with_intransit_state",
    "prompt": "For transfers, should items go to 'In Transit' first and then be received?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 30,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_transfer_with_intransit_state"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_enable_transfers",
          "equals": "yes"
        }
      ]
    },
    "order_index": 29
  },
  {
    "key": "inv_use_putaway_rules",
    "prompt": "Do you want automatic putaway suggestions after receiving?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 31,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_putaway_rules"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_locations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 30
  },
  {
    "key": "inv_picking_strategy",
    "prompt": "How should picking choose stock location first?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack B: Warehouse, Bin, and Transfer",
    "question_number": 32,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_picking_strategy"
    },
    "options": [
      "Nearest location",
      "FIFO bin order",
      "Fixed bin",
      "Manual choice"
    ],
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_locations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 31
  },
  {
    "key": "inv_use_purchase_orders",
    "prompt": "Do you want purchase order based receiving?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack C: Inbound (Procurement Receiving)",
    "question_number": 33,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_purchase_orders"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_incoming",
          "equals": "yes"
        }
      ]
    },
    "order_index": 32
  },
  {
    "key": "inv_allow_partial_receipts",
    "prompt": "Should partial receiving be allowed?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack C: Inbound (Procurement Receiving)",
    "question_number": 34,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_allow_partial_receipts"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_purchase_orders",
          "equals": "yes"
        }
      ]
    },
    "order_index": 33
  },
  {
    "key": "inv_allow_over_receipt",
    "prompt": "Should receiving more than ordered be allowed?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack C: Inbound (Procurement Receiving)",
    "question_number": 35,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_allow_over_receipt"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_use_purchase_orders",
          "equals": "yes"
        }
      ]
    },
    "order_index": 34
  },
  {
    "key": "inv_generate_grn",
    "prompt": "Do you want a Goods Receipt Note (GRN) record?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack C: Inbound (Procurement Receiving)",
    "question_number": 36,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_generate_grn"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_incoming",
          "equals": "yes"
        }
      ]
    },
    "order_index": 35
  },
  {
    "key": "inv_receiving_discrepancy_flow",
    "prompt": "Do you want discrepancy handling for short/extra/damaged receipt?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack C: Inbound (Procurement Receiving)",
    "question_number": 37,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_receiving_discrepancy_flow"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_incoming",
          "equals": "yes"
        }
      ]
    },
    "order_index": 36
  },
  {
    "key": "inv_need_supplier_returns",
    "prompt": "Do you need supplier return workflow?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack C: Inbound (Procurement Receiving)",
    "question_number": 38,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_supplier_returns"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_incoming",
          "equals": "yes"
        }
      ]
    },
    "order_index": 37
  },
  {
    "key": "inv_use_reservations",
    "prompt": "Do you want stock reservation/allocation for orders?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack D: Outbound (Fulfillment)",
    "question_number": 39,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_reservations"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 38
  },
  {
    "key": "inv_use_pick_list",
    "prompt": "Do you want pick list generation?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack D: Outbound (Fulfillment)",
    "question_number": 40,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_pick_list"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 39
  },
  {
    "key": "inv_use_pick_pack_ship_steps",
    "prompt": "Do you want separate Pick, Pack, and Ship steps?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack D: Outbound (Fulfillment)",
    "question_number": 41,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_pick_pack_ship_steps"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 40
  },
  {
    "key": "inv_allow_partial_shipments",
    "prompt": "Should partial shipments and backorders be supported?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack D: Outbound (Fulfillment)",
    "question_number": 42,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_allow_partial_shipments"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 41
  },
  {
    "key": "inv_need_customer_returns",
    "prompt": "Do you need customer return workflow?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack D: Outbound (Fulfillment)",
    "question_number": 43,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_customer_returns"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_track_outgoing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 42
  },
  {
    "key": "inv_replenishment_policy",
    "prompt": "Which replenishment method do you want?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack E: Planning and Replenishment",
    "question_number": 44,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_replenishment_policy"
    },
    "options": [
      "Reorder point",
      "Min/Max",
      "Both",
      "Not sure"
    ],
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_low_stock_alerts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 43
  },
  {
    "key": "inv_use_safety_stock",
    "prompt": "Do you want safety stock levels?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack E: Planning and Replenishment",
    "question_number": 45,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_safety_stock"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_low_stock_alerts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 44
  },
  {
    "key": "inv_use_supplier_lead_time",
    "prompt": "Should supplier lead times be used in replenishment suggestions?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack E: Planning and Replenishment",
    "question_number": 46,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_supplier_lead_time"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_low_stock_alerts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 45
  },
  {
    "key": "inv_auto_replenishment_suggestions",
    "prompt": "Do you want automatic replenishment suggestions?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack E: Planning and Replenishment",
    "question_number": 47,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_auto_replenishment_suggestions"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_low_stock_alerts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 46
  },
  {
    "key": "inv_use_blind_count",
    "prompt": "Should counters hide system quantity during count (blind count)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack F: Counting, Audit, and Control",
    "question_number": 48,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_blind_count"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_cycle_counts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 47
  },
  {
    "key": "inv_variance_approval_required",
    "prompt": "Should stock count differences require approval before posting?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack F: Counting, Audit, and Control",
    "question_number": 49,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_variance_approval_required"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_cycle_counts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 48
  },
  {
    "key": "inv_auto_post_count_adjustments",
    "prompt": "After approval, should count adjustments post automatically?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack F: Counting, Audit, and Control",
    "question_number": 50,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_auto_post_count_adjustments"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_cycle_counts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 49
  },
  {
    "key": "inv_freeze_closed_period",
    "prompt": "Do you want to lock old periods to prevent backdated stock edits?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack F: Counting, Audit, and Control",
    "question_number": 51,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_freeze_closed_period"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_cycle_counts",
          "equals": "yes"
        }
      ]
    },
    "order_index": 50
  },
  {
    "key": "inv_cost_method",
    "prompt": "Which costing method should be default?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack G: Costing and Valuation",
    "question_number": 52,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_cost_method"
    },
    "options": [
      "Weighted average",
      "FIFO",
      "Standard cost",
      "Not sure"
    ],
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_costing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 51
  }
];

const INVENTORY_V1_QUESTIONS_PART_3 = [
  {
    "key": "inv_valuation_by_location",
    "prompt": "Do you want inventory valuation by location?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack G: Costing and Valuation",
    "question_number": 53,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_valuation_by_location"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_costing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 52
  },
  {
    "key": "inv_use_landed_cost",
    "prompt": "Do you want landed cost allocation (freight/tax/other costs into item cost)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack G: Costing and Valuation",
    "question_number": 54,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_landed_cost"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_costing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 53
  },
  {
    "key": "inv_enable_revaluation",
    "prompt": "Do you need stock revaluation entries?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack G: Costing and Valuation",
    "question_number": 55,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_enable_revaluation"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_costing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 54
  },
  {
    "key": "inv_need_margin_visibility",
    "prompt": "Do you want margin view (cost vs selling price)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack G: Costing and Valuation",
    "question_number": 56,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_margin_visibility"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_costing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 55
  },
  {
    "key": "inv_accounting_integration",
    "prompt": "Do you need accounting postings for stock value movements?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack G: Costing and Valuation",
    "question_number": 57,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_accounting_integration"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_costing",
          "equals": "yes"
        }
      ]
    },
    "order_index": 56
  },
  {
    "key": "inv_enable_quarantine_stock",
    "prompt": "Do you need quarantine/hold/release stock status?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack H: Quality, Compliance, and Traceability",
    "question_number": 58,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_enable_quarantine_stock"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_expiry_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_batch_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_serial_tracking",
          "equals": "yes"
        }
      ]
    },
    "order_index": 57
  },
  {
    "key": "inv_qc_on_receive",
    "prompt": "Do you need quality checks during receiving?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack H: Quality, Compliance, and Traceability",
    "question_number": 59,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_qc_on_receive"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_expiry_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_batch_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_serial_tracking",
          "equals": "yes"
        }
      ]
    },
    "order_index": 58
  },
  {
    "key": "inv_qc_on_dispatch",
    "prompt": "Do you need quality checks during dispatch?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack H: Quality, Compliance, and Traceability",
    "question_number": 60,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_qc_on_dispatch"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_expiry_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_batch_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_serial_tracking",
          "equals": "yes"
        }
      ]
    },
    "order_index": 59
  },
  {
    "key": "inv_use_fefo_fifo_issue_policy",
    "prompt": "Should outgoing stock follow FEFO/FIFO rule automatically?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack H: Quality, Compliance, and Traceability",
    "question_number": 61,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_fefo_fifo_issue_policy"
    },
    "options": [
      "FEFO",
      "FIFO",
      "Manual",
      "Not needed"
    ],
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_expiry_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_batch_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_serial_tracking",
          "equals": "yes"
        }
      ]
    },
    "order_index": 60
  },
  {
    "key": "inv_need_lot_genealogy",
    "prompt": "Do you need full lot trace (where each lot came from and where it went)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack H: Quality, Compliance, and Traceability",
    "question_number": 62,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_lot_genealogy"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_expiry_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_batch_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_serial_tracking",
          "equals": "yes"
        }
      ]
    },
    "order_index": 61
  },
  {
    "key": "inv_need_recall_workflow",
    "prompt": "Do you need product recall workflow?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack H: Quality, Compliance, and Traceability",
    "question_number": 63,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_recall_workflow"
    },
    "condition": {
      "op": "any",
      "rules": [
        {
          "question_key": "inv_need_expiry_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_batch_tracking",
          "equals": "yes"
        },
        {
          "question_key": "inv_need_serial_tracking",
          "equals": "yes"
        }
      ]
    },
    "order_index": 62
  },
  {
    "key": "inv_report_set",
    "prompt": "Which reports do you want? (Select all)",
    "type": "multi_choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack I: Reporting and Analytics",
    "question_number": 64,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_report_set"
    },
    "options": [
      "Stock aging",
      "Low-stock risk",
      "Expiry risk",
      "Slow/fast moving",
      "Inventory turnover",
      "Movement history",
      "Fill rate / service level"
    ],
    "order_index": 63
  },
  {
    "key": "inv_dashboard_cards",
    "prompt": "Which dashboard cards do you want? (Select all)",
    "type": "multi_choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack I: Reporting and Analytics",
    "question_number": 65,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_dashboard_cards"
    },
    "options": [
      "Low stock",
      "Expiry",
      "Inventory value",
      "Recent movements"
    ],
    "order_index": 64
  },
  {
    "key": "inv_scheduled_reports",
    "prompt": "Do you want scheduled report generation?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack I: Reporting and Analytics",
    "question_number": 66,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_scheduled_reports"
    },
    "order_index": 65
  },
  {
    "key": "inv_external_integrations",
    "prompt": "Which systems should inventory connect to? (Select all)",
    "type": "multi_choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack J: Integration and Automation",
    "question_number": 67,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_external_integrations"
    },
    "options": [
      "POS",
      "Ecommerce",
      "WMS",
      "Accounting",
      "Other"
    ],
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_integrations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 66
  },
  {
    "key": "inv_need_webhooks",
    "prompt": "Do you want real-time event/webhook notifications?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack J: Integration and Automation",
    "question_number": 68,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_webhooks"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_integrations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 67
  },
  {
    "key": "inv_need_import_export_pipelines",
    "prompt": "Do you need import/export pipelines for bulk data?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack J: Integration and Automation",
    "question_number": 69,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_import_export_pipelines"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_integrations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 68
  },
  {
    "key": "inv_use_rule_automations",
    "prompt": "Do you want rule-based automation (alerts, auto-tasks)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack J: Integration and Automation",
    "question_number": 70,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_use_rule_automations"
    },
    "condition": {
      "op": "all",
      "rules": [
        {
          "question_key": "inv_need_integrations",
          "equals": "yes"
        }
      ]
    },
    "order_index": 69
  },
  {
    "key": "inv_high_risk_actions_need_approval",
    "prompt": "Should high-risk actions require approval (for example large adjustments)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack K: Access and Governance",
    "question_number": 71,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_high_risk_actions_need_approval"
    },
    "order_index": 70
  },
  {
    "key": "inv_separation_of_duties",
    "prompt": "Should approving and executing stock changes be separated between different users?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack K: Access and Governance",
    "question_number": 72,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_separation_of_duties"
    },
    "order_index": 71
  },
  {
    "key": "inv_action_level_permissions",
    "prompt": "Do you need action-level permissions (view, receive, issue, adjust, approve)?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack K: Access and Governance",
    "question_number": 73,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_action_level_permissions"
    },
    "order_index": 72
  },
  {
    "key": "inv_expected_daily_transactions",
    "prompt": "How many stock transactions do you expect per day?",
    "type": "choice",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack L: Performance and Reliability",
    "question_number": 74,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_expected_daily_transactions"
    },
    "options": [
      "Under 100",
      "100-1,000",
      "1,000-10,000",
      "Over 10,000"
    ],
    "order_index": 73
  },
  {
    "key": "inv_need_strict_duplicate_protection",
    "prompt": "Should repeated submit clicks be protected so the same movement is not posted twice?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack L: Performance and Reliability",
    "question_number": 75,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_strict_duplicate_protection"
    },
    "order_index": 74
  },
  {
    "key": "inv_need_backup_restore_policy",
    "prompt": "Do you need backup and restore policy setup?",
    "type": "yes_no",
    "allow_custom": false,
    "required": true,
    "section": "Advanced Pack L: Performance and Reliability",
    "question_number": 76,
    "sdf_mapping": {
      "target": "constraints.inventory.inv_need_backup_restore_policy"
    },
    "order_index": 75
  }
];

const INVENTORY_V1_QUESTIONS = [
  ...INVENTORY_V1_QUESTIONS_PART_1,
  ...INVENTORY_V1_QUESTIONS_PART_2,
  ...INVENTORY_V1_QUESTIONS_PART_3,
];

module.exports = {
  module: 'inventory',
  version: 'inventory.v1',
  template_type: 'full_capability',
  source_path: null,
  getQuestions() {
    return JSON.parse(JSON.stringify(INVENTORY_V1_QUESTIONS));
  },
};
