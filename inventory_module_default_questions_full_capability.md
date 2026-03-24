# Inventory Module Default Questions (SDF-Impact Only)

## Purpose

This questionnaire includes only questions that directly change generated SDF for inventory capabilities we currently support.

If an answer does not affect SDF output, it is intentionally excluded.

---

## Scope Covered (Current Capabilities)

- Core inventory item + stock operations
- Priority A inventory packs:
  - reservations
  - transaction safety
  - inbound PO/GRN
  - cycle counting
- Optional naming customization for generated entities

---

## Question Flow

1. Ask core inventory questions.
2. Ask only enabled capability packs.
3. Ask naming/customization only when user wants custom names.
4. Build prefilled SDF from these answers before AI generation.

---

## Core Questions (Always Ask)

### Q1
- ID: `inv_enable_module`
- User question: "Do you want Inventory in your ERP?"
- Input: `yes_no`
- SDF mapping: `modules.inventory.enabled`

### Q2
- ID: `inv_stock_name`
- User question: "What should we call your stock records?"
- Input: `choice + custom`
- Options: `Products`, `Items`, `Materials`, `Stock`, `Custom`
- SDF mapping: `modules.inventory.stock_entity` (slug form, e.g. `products`)

### Q3
- ID: `inv_multi_location`
- User question: "Do you store stock in more than one location?"
- Input: `yes_no`
- SDF mapping:
  - `entities.<stock_entity>.features.multi_location`
  - adds/uses `locations` entity in prefilled SDF

### Q4
- ID: `inv_enable_ops`
- User question: "Do you want stock actions (Receive, Issue, Adjust, Transfer) on item pages?"
- Input: `yes_no`
- SDF mapping: `entities.<stock_entity>.inventory_ops.enabled`

### Q5
- ID: `inv_allow_negative_stock`
- User question: "If stock is not enough, should Issue still be allowed?"
- Input: `yes_no`
- Condition: ask when Q4 = yes
- SDF mapping: `entities.<stock_entity>.inventory_ops.issue.allow_negative_stock`

### Q6
- ID: `inv_enable_transactions_pack`
- User question: "Do you want transaction-safe stock updates (recommended)?"
- Input: `yes_no`
- SDF mapping: `modules.inventory.transactions.enabled`

### Q7
- ID: `inv_enable_reservations_pack`
- User question: "Do you want reservation/allocation (reserve stock before confirming)?"
- Input: `yes_no`
- SDF mapping: `modules.inventory.reservations.enabled`

### Q8
- ID: `inv_enable_inbound_pack`
- User question: "Do you want purchase receiving workflow (PO + Goods Receipt)?"
- Input: `yes_no`
- SDF mapping: `modules.inventory.inbound.enabled`

### Q9
- ID: `inv_enable_cycle_counting_pack`
- User question: "Do you want cycle count sessions for stock verification?"
- Input: `yes_no`
- SDF mapping: `modules.inventory.cycle_counting.enabled`

---

## Naming Questions (Only If User Wants Custom Names)

### Q10
- ID: `inv_use_default_pack_names`
- User question: "Use default workflow names (Stock Reservations, Purchase Orders, Goods Receipts, Cycle Count Sessions)?"
- Input: `yes_no`
- If `yes`: keep defaults.
- If `no`: ask Q11-Q14.

### Q11
- ID: `inv_reservation_entity_name`
- User question: "What should we call reservation records?"
- Input: `text`
- Condition: Q7 = yes and Q10 = no
- SDF mapping: `modules.inventory.reservations.reservation_entity`

### Q12
- ID: `inv_inbound_entity_names`
- User question: "What should we call inbound records?"
- Input: `group_text`
- Fields:
  - `purchase_order_entity`
  - `purchase_order_item_entity`
  - `grn_entity`
  - `grn_item_entity`
- Condition: Q8 = yes and Q10 = no
- SDF mapping:
  - `modules.inventory.inbound.purchase_order_entity`
  - `modules.inventory.inbound.purchase_order_item_entity`
  - `modules.inventory.inbound.grn_entity`
  - `modules.inventory.inbound.grn_item_entity`

### Q13
- ID: `inv_cycle_entity_names`
- User question: "What should we call cycle count records?"
- Input: `group_text`
- Fields:
  - `session_entity`
  - `line_entity`
- Condition: Q9 = yes and Q10 = no
- SDF mapping:
  - `modules.inventory.cycle_counting.session_entity`
  - `modules.inventory.cycle_counting.line_entity`

### Q14
- ID: `inv_quantity_field_name`
- User question: "Use default quantity field name 'quantity'?"
- Input: `yes_no + custom`
- Condition: Q6 = yes and Q10 = no
- SDF mapping: `modules.inventory.transactions.quantity_field`

---

## Internal Mapping Checklist (System Side)

Map only these keys from answers:

- `modules.inventory.enabled`
- `modules.inventory.stock_entity`
- `modules.inventory.transactions.*`
- `modules.inventory.reservations.*`
- `modules.inventory.inbound.*`
- `modules.inventory.cycle_counting.*`
- `entities.<stock_entity>.inventory_ops.*`
- `entities.<stock_entity>.features.multi_location`

If a question does not map to one of these, remove it.

---

## Validation Gates Before AI Call

- Do not call AI if Q1 is unanswered.
- Do not call AI if any enabled pack has missing required naming answers.
- Do not call AI until prefilled SDF is generated and confirmed.

---

## Minimal Example Handoff

```json
{
  "module": "inventory",
  "mandatory_answers": {
    "inv_enable_module": "yes",
    "inv_stock_name": "Products",
    "inv_enable_transactions_pack": "yes",
    "inv_enable_reservations_pack": "yes",
    "inv_enable_inbound_pack": "yes",
    "inv_enable_cycle_counting_pack": "yes"
  },
  "prefilled_sdf": {
    "modules": {
      "inventory": {
        "enabled": true,
        "stock_entity": "products",
        "transactions": { "enabled": true },
        "reservations": { "enabled": true },
        "inbound": { "enabled": true },
        "cycle_counting": { "enabled": true }
      }
    }
  }
}
```
# Inventory Module Default Questions (SMB-Friendly, Full-Capability Target)

## Purpose

This document defines inventory default questions for non-technical SMB users.

It is intentionally broader than current implementation and assumes we want to support most inventory capabilities from `inventory_module_capability_research_and_gap_analysis.md`.

Users see simple business questions only.
System converts answers into structured configuration and prefilled SDF before AI generation.

---

## Design Rules

- Ask in plain language (no developer terms).
- Use branching so users only answer relevant sections.
- Keep core questions short and required.
- Ask advanced questions only after user enables that capability.
- Treat these answers as hard constraints during AI generation.

---

## User Flow

1. User selects Inventory module.
2. System asks Core Questions (always required).
3. System asks only the enabled Advanced Packs.
4. System generates prefilled SDF/config from answers.
5. User reviews and confirms.
6. System sends `mandatory_answers + prefilled_sdf + business_description` to AI.
7. Final AI output is validated against mandatory answers.

---

## Core Questions (Always Required)

### Q1
- ID: `inv_business_type`
- User question: "What best describes your business?"
- Input: `choice`
- Options: `Retail store`, `Wholesaler/distributor`, `Manufacturer`, `Service business with stock`, `Other`

### Q2
- ID: `inv_item_label`
- User question: "What do you call the things you keep in stock?"
- Input: `choice + custom`
- Options: `Products`, `Items`, `Materials`, `Stock`, `Custom`

### Q3
- ID: `inv_identifier_style`
- User question: "How do you identify each item?"
- Input: `choice`
- Options: `SKU code`, `Barcode`, `Item name only`, `Code + name`

### Q4
- ID: `inv_uom_mode`
- User question: "Do you need one unit only or multiple units (for example piece/box/carton)?"
- Input: `choice`
- Options: `One unit only`, `Multiple units with conversion`

### Q5
- ID: `inv_use_categories`
- User question: "Do you want item categories (for example Electronics, Food, Office)?"
- Input: `yes_no`

### Q6
- ID: `inv_use_variants`
- User question: "Do your items have variants (for example size/color)?"
- Input: `yes_no`

### Q7
- ID: `inv_use_locations`
- User question: "Do you keep stock in more than one place (warehouse/store/shelf)?"
- Input: `yes_no`

### Q8
- ID: `inv_track_incoming`
- User question: "Do you want to record stock coming in (receiving/purchases)?"
- Input: `yes_no`

### Q9
- ID: `inv_track_outgoing`
- User question: "Do you want to record stock going out (sales/usage)?"
- Input: `yes_no`

### Q10
- ID: `inv_outgoing_label`
- User question: "What should we call stock going out in the app?"
- Input: `choice`
- Options: `Sell`, `Issue`, `Dispatch`, `Use`
- Condition: ask only when Q9 = yes

### Q11
- ID: `inv_allow_negative_stock`
- User question: "If stock is not enough, should the system still allow outgoing transactions?"
- Input: `yes_no`
- Condition: ask only when Q9 = yes

### Q12
- ID: `inv_enable_adjustments`
- User question: "Do you want stock correction (damage, loss, count difference)?"
- Input: `yes_no`

### Q13
- ID: `inv_need_low_stock_alerts`
- User question: "Do you want low-stock alerts?"
- Input: `yes_no`

### Q14
- ID: `inv_need_expiry_tracking`
- User question: "Do your items have expiry dates?"
- Input: `yes_no`

### Q15
- ID: `inv_need_batch_tracking`
- User question: "Do you track batch/lot numbers?"
- Input: `yes_no`

### Q16
- ID: `inv_need_serial_tracking`
- User question: "Do you track serial number per individual unit?"
- Input: `yes_no`

### Q17
- ID: `inv_need_cycle_counts`
- User question: "Do you want cycle counting and stock count sessions?"
- Input: `yes_no`

### Q18
- ID: `inv_need_costing`
- User question: "Do you need inventory costing and valuation reports?"
- Input: `yes_no`

### Q19
- ID: `inv_need_returns`
- User question: "Do you need return workflows (customer return or supplier return)?"
- Input: `yes_no`

### Q20
- ID: `inv_need_integrations`
- User question: "Do you need integrations with other systems (POS, ecommerce, accounting)?"
- Input: `yes_no`

---

## Advanced Pack A: Item Master and Catalog

Ask this pack for all users.

### Q21
- ID: `inv_item_statuses`
- User question: "Do you want item statuses such as Draft, Active, and Obsolete?"
- Input: `yes_no`

### Q22
- ID: `inv_use_brands`
- User question: "Do you want to track brand/manufacturer for items?"
- Input: `yes_no`

### Q23
- ID: `inv_use_supplier_item_mapping`
- User question: "Should one item be linked to one or more suppliers?"
- Input: `yes_no`

### Q24
- ID: `inv_use_packaging_levels`
- User question: "Do you want packaging levels (for example inner pack, case, pallet)?"
- Input: `yes_no`

### Q25
- ID: `inv_use_custom_attributes`
- User question: "Do you need custom extra fields for items?"
- Input: `yes_no`

---

## Advanced Pack B: Warehouse, Bin, and Transfer

Ask when Q7 = yes.

### Q26
- ID: `inv_location_label`
- User question: "What should we call your stock places?"
- Input: `choice + custom`
- Options: `Warehouses`, `Stores`, `Locations`, `Bins/Shelves`, `Custom`

### Q27
- ID: `inv_track_bins`
- User question: "Do you need bin/shelf-level stock tracking?"
- Input: `yes_no`

### Q28
- ID: `inv_use_zone_rack_bin_structure`
- User question: "Do you want location hierarchy (Zone > Aisle > Rack > Bin)?"
- Input: `yes_no`

### Q29
- ID: `inv_enable_transfers`
- User question: "Do you want transfer between locations?"
- Input: `yes_no`

### Q30
- ID: `inv_transfer_with_intransit_state`
- User question: "For transfers, should items go to 'In Transit' first and then be received?"
- Input: `yes_no`
- Condition: ask only when Q29 = yes

### Q31
- ID: `inv_use_putaway_rules`
- User question: "Do you want automatic putaway suggestions after receiving?"
- Input: `yes_no`

### Q32
- ID: `inv_picking_strategy`
- User question: "How should picking choose stock location first?"
- Input: `choice`
- Options: `Nearest location`, `FIFO bin order`, `Fixed bin`, `Manual choice`

---

## Advanced Pack C: Inbound (Procurement Receiving)

Ask when Q8 = yes.

### Q33
- ID: `inv_use_purchase_orders`
- User question: "Do you want purchase order based receiving?"
- Input: `yes_no`

### Q34
- ID: `inv_allow_partial_receipts`
- User question: "Should partial receiving be allowed?"
- Input: `yes_no`
- Condition: ask only when Q33 = yes

### Q35
- ID: `inv_allow_over_receipt`
- User question: "Should receiving more than ordered be allowed?"
- Input: `yes_no`
- Condition: ask only when Q33 = yes

### Q36
- ID: `inv_generate_grn`
- User question: "Do you want a Goods Receipt Note (GRN) record?"
- Input: `yes_no`

### Q37
- ID: `inv_receiving_discrepancy_flow`
- User question: "Do you want discrepancy handling for short/extra/damaged receipt?"
- Input: `yes_no`

### Q38
- ID: `inv_need_supplier_returns`
- User question: "Do you need supplier return workflow?"
- Input: `yes_no`

---

## Advanced Pack D: Outbound (Fulfillment)

Ask when Q9 = yes.

### Q39
- ID: `inv_use_reservations`
- User question: "Do you want stock reservation/allocation for orders?"
- Input: `yes_no`

### Q40
- ID: `inv_use_pick_list`
- User question: "Do you want pick list generation?"
- Input: `yes_no`

### Q41
- ID: `inv_use_pick_pack_ship_steps`
- User question: "Do you want separate Pick, Pack, and Ship steps?"
- Input: `yes_no`

### Q42
- ID: `inv_allow_partial_shipments`
- User question: "Should partial shipments and backorders be supported?"
- Input: `yes_no`

### Q43
- ID: `inv_need_customer_returns`
- User question: "Do you need customer return workflow?"
- Input: `yes_no`

---

## Advanced Pack E: Planning and Replenishment

Ask when Q13 = yes or user chooses planning features.

### Q44
- ID: `inv_replenishment_policy`
- User question: "Which replenishment method do you want?"
- Input: `choice`
- Options: `Reorder point`, `Min/Max`, `Both`, `Not sure`

### Q45
- ID: `inv_use_safety_stock`
- User question: "Do you want safety stock levels?"
- Input: `yes_no`

### Q46
- ID: `inv_use_supplier_lead_time`
- User question: "Should supplier lead times be used in replenishment suggestions?"
- Input: `yes_no`

### Q47
- ID: `inv_auto_replenishment_suggestions`
- User question: "Do you want automatic replenishment suggestions?"
- Input: `yes_no`

---

## Advanced Pack F: Counting, Audit, and Control

Ask when Q17 = yes.

### Q48
- ID: `inv_use_blind_count`
- User question: "Should counters hide system quantity during count (blind count)?"
- Input: `yes_no`

### Q49
- ID: `inv_variance_approval_required`
- User question: "Should stock count differences require approval before posting?"
- Input: `yes_no`

### Q50
- ID: `inv_auto_post_count_adjustments`
- User question: "After approval, should count adjustments post automatically?"
- Input: `yes_no`

### Q51
- ID: `inv_freeze_closed_period`
- User question: "Do you want to lock old periods to prevent backdated stock edits?"
- Input: `yes_no`

---

## Advanced Pack G: Costing and Valuation

Ask when Q18 = yes.

### Q52
- ID: `inv_cost_method`
- User question: "Which costing method should be default?"
- Input: `choice`
- Options: `Weighted average`, `FIFO`, `Standard cost`, `Not sure`

### Q53
- ID: `inv_valuation_by_location`
- User question: "Do you want inventory valuation by location?"
- Input: `yes_no`

### Q54
- ID: `inv_use_landed_cost`
- User question: "Do you want landed cost allocation (freight/tax/other costs into item cost)?"
- Input: `yes_no`

### Q55
- ID: `inv_enable_revaluation`
- User question: "Do you need stock revaluation entries?"
- Input: `yes_no`

### Q56
- ID: `inv_need_margin_visibility`
- User question: "Do you want margin view (cost vs selling price)?"
- Input: `yes_no`

### Q57
- ID: `inv_accounting_integration`
- User question: "Do you need accounting postings for stock value movements?"
- Input: `yes_no`

---

## Advanced Pack H: Quality, Compliance, and Traceability

Ask when Q14 = yes or Q15 = yes or Q16 = yes.

### Q58
- ID: `inv_enable_quarantine_stock`
- User question: "Do you need quarantine/hold/release stock status?"
- Input: `yes_no`

### Q59
- ID: `inv_qc_on_receive`
- User question: "Do you need quality checks during receiving?"
- Input: `yes_no`

### Q60
- ID: `inv_qc_on_dispatch`
- User question: "Do you need quality checks during dispatch?"
- Input: `yes_no`

### Q61
- ID: `inv_use_fefo_fifo_issue_policy`
- User question: "Should outgoing stock follow FEFO/FIFO rule automatically?"
- Input: `choice`
- Options: `FEFO`, `FIFO`, `Manual`, `Not needed`

### Q62
- ID: `inv_need_lot_genealogy`
- User question: "Do you need full lot trace (where each lot came from and where it went)?"
- Input: `yes_no`

### Q63
- ID: `inv_need_recall_workflow`
- User question: "Do you need product recall workflow?"
- Input: `yes_no`

---

## Advanced Pack I: Reporting and Analytics

Ask for all users, but allow simple selections.

### Q64
- ID: `inv_report_set`
- User question: "Which reports do you want? (Select all)"
- Input: `multi_choice`
- Options:
  - `Stock aging`
  - `Low-stock risk`
  - `Expiry risk`
  - `Slow/fast moving`
  - `Inventory turnover`
  - `Movement history`
  - `Fill rate / service level`

### Q65
- ID: `inv_dashboard_cards`
- User question: "Which dashboard cards do you want? (Select all)"
- Input: `multi_choice`
- Options: `Low stock`, `Expiry`, `Inventory value`, `Recent movements`

### Q66
- ID: `inv_scheduled_reports`
- User question: "Do you want scheduled report generation?"
- Input: `yes_no`

---

## Advanced Pack J: Integration and Automation

Ask when Q20 = yes.

### Q67
- ID: `inv_external_integrations`
- User question: "Which systems should inventory connect to? (Select all)"
- Input: `multi_choice`
- Options: `POS`, `Ecommerce`, `WMS`, `Accounting`, `Other`

### Q68
- ID: `inv_need_webhooks`
- User question: "Do you want real-time event/webhook notifications?"
- Input: `yes_no`

### Q69
- ID: `inv_need_import_export_pipelines`
- User question: "Do you need import/export pipelines for bulk data?"
- Input: `yes_no`

### Q70
- ID: `inv_use_rule_automations`
- User question: "Do you want rule-based automation (alerts, auto-tasks)?"
- Input: `yes_no`

---

## Advanced Pack K: Access and Governance

Ask for all users (simple policy choices).

### Q71
- ID: `inv_high_risk_actions_need_approval`
- User question: "Should high-risk actions require approval (for example large adjustments)?"
- Input: `yes_no`

### Q72
- ID: `inv_separation_of_duties`
- User question: "Should approving and executing stock changes be separated between different users?"
- Input: `yes_no`

### Q73
- ID: `inv_action_level_permissions`
- User question: "Do you need action-level permissions (view, receive, issue, adjust, approve)?"
- Input: `yes_no`

---

## Advanced Pack L: Performance and Reliability

Ask for all users with simple sizing language.

### Q74
- ID: `inv_expected_daily_transactions`
- User question: "How many stock transactions do you expect per day?"
- Input: `choice`
- Options: `Under 100`, `100-1,000`, `1,000-10,000`, `Over 10,000`

### Q75
- ID: `inv_need_strict_duplicate_protection`
- User question: "Should repeated submit clicks be protected so the same movement is not posted twice?"
- Input: `yes_no`

### Q76
- ID: `inv_need_backup_restore_policy`
- User question: "Do you need backup and restore policy setup?"
- Input: `yes_no`

---

## Internal Mapping Model (System Side)

This section is internal and not shown to end users.

Answers map into these configuration blocks:

- `modules.inventory.enabled`
- `entities.products` (or user label-equivalent)
- `entities.locations` and location hierarchy settings
- `inventory_ops` (receive, issue, adjust, transfer, quick actions)
- `inventory_inbound` (PO, GRN, discrepancy, supplier return)
- `inventory_outbound` (reservation, pick/pack/ship, backorder, customer return)
- `inventory_planning` (reorder logic, safety stock, lead time)
- `inventory_counting` (cycle count, blind count, approvals, period lock)
- `inventory_costing` (method, valuation, landed cost, revaluation, margin)
- `inventory_quality` (quarantine, QC, FEFO/FIFO, recall, genealogy)
- `inventory_reporting` (dashboard cards, reports, schedule)
- `inventory_integrations` (connectors, import/export, webhook, automation)
- `inventory_governance` (approvals, duty separation, permissions)
- `inventory_non_functional` (volume profile, duplicate protection, backup/restore)

---

## Validation Gates Before AI Call

- Do not call AI if any Core Question is unanswered.
- Do not call AI if any required conditional question is missing.
- Do not call AI if outgoing is enabled but outgoing policy answers are missing.
- Do not call AI if location flow is enabled but transfer/location policy answers are missing.
- Do not call AI until user approves prefilled draft.

---

## AI Handoff Payload (Internal)

```json
{
  "module": "inventory",
  "mandatory_answers": {
    "inv_business_type": "Retail store",
    "inv_item_label": "Products",
    "inv_identifier_style": "SKU code",
    "inv_track_outgoing": "yes"
  },
  "prefilled_sdf": {
    "project_name": "Example SMB Inventory",
    "modules": {
      "inventory": { "enabled": true }
    },
    "entities": []
  },
  "user_business_description": "..."
}
```

`mandatory_answers` and `prefilled_sdf` are hard constraints for AI generation.
