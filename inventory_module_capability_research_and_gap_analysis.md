# Inventory Module ERP Capability Research and Gap Analysis

## Purpose

This document lists what a full ERP inventory module typically needs, then compares that list against the current CustomERP generated inventory implementation.

Goal:
- define the complete capability scope,
- identify what is already implemented,
- identify what is partial,
- identify what is missing and should be added as backlog.

Assessment source:
- code in `platform/assembler/**`,
- mixins in `brick-library/backend-bricks/mixins/**`,
- SDF contract in `SDF_REFERENCE.md`,
- current sprint/project docs.

Status legend:
- `Implemented` = present and usable now.
- `Partial` = some support exists, but important parts are still missing.
- `Missing` = not currently present in generated ERP.

---

## Complete Inventory Capability Catalog (What a full ERP inventory module may require)

## 1) Core Item and Master Data
- Item/SKU master (code, name, type, status)
- UoM management and unit conversions
- Product variants (size/color/style matrix)
- Item categories and hierarchies
- Brands and manufacturer info
- Supplier master and supplier-item mapping
- Barcode and alternate item codes
- Item lifecycle states (draft/active/obsolete)
- Item attributes (custom fields/specifications)
- Packaging details (case/pack/pallet)

## 2) Stock Ledger and Transactions
- Real-time on-hand quantity
- Available quantity vs reserved quantity
- In-transit quantity
- Committed quantity (sales allocations)
- Stock movement ledger (all in/out/adjust/transfer events)
- Movement reason codes and references
- Backdated transactions with proper recalculation policy
- Transaction reversal/correction flow
- Freeze period / closed-period controls

## 3) Warehouse, Location, Bin, and Multi-site
- Multi-warehouse support
- Multi-location/bin support inside warehouse
- Zone/aisle/rack/bin structure
- Bin capacity and constraints
- Putaway strategy
- Picking strategy (FIFO bin, nearest bin, fixed bin, etc.)
- Inter-warehouse transfer with in-transit state
- Transfer receipt confirmation

## 4) Lot/Batch/Serial/Expiry/Traceability
- Batch tracking
- Serial tracking
- Expiry date tracking
- Shelf-life controls and alerts
- FEFO/FIFO issue policy support
- Full lot genealogy (forward and backward trace)
- Recall workflow support

## 5) Inbound Operations (Procurement Receiving)
- Purchase order receiving
- Partial receipts and over-receipt rules
- Goods receipt note (GRN)
- Putaway confirmation
- Supplier return flow
- Receiving discrepancy workflow (short/extra/damaged)

## 6) Outbound Operations (Fulfillment/Issue)
- Issue/dispatch against order
- Pick list generation
- Pick/pack/ship workflow
- Partial shipment handling
- Backorder handling
- Customer returns and restocking rules

## 7) Inventory Planning and Replenishment
- Reorder point and safety stock
- Min/max replenishment
- Demand forecasting integration
- Suggested replenishment orders
- Supplier lead-time aware planning
- Multi-echelon replenishment rules

## 8) Count, Audit, and Control
- Cycle count plans
- Physical count sessions
- Blind count workflow
- Variance approval workflow
- Auto-adjust posting from approved counts
- Audit trail of stock-impacting actions

## 9) Costing and Valuation
- Cost methods (FIFO, LIFO, weighted average, standard)
- Inventory valuation by warehouse/location
- Landed cost allocation
- Cost revaluation
- Margin visibility (cost vs sell price)
- GL/accounting integration for stock value posting

## 10) Manufacturing/Kitting Integration (when needed)
- BOM support
- Kit and bundle explosion/consumption
- Material issue to production
- WIP and finished goods receipt
- Co/by-product handling

## 11) Quality and Compliance
- Quarantine stock status
- Hold/release flow
- QC inspection during receive/dispatch
- Non-conformance tracking
- Regulatory traceability and retention

## 12) Reporting and Analytics
- Stock aging
- Low-stock and stockout risk
- Expiry risk report
- Slow/fast moving analysis
- Inventory turnover
- Fill rate and service-level metrics
- Movement history and drill-down

## 13) Security, Access, and Governance
- Action-level authorization hooks for inventory operations
- Segregation of duties (approve vs execute)
- Approval workflow for high-risk actions

## 14) Integration, API, and Automation
- API for external systems (ecommerce, POS, WMS, accounting)
- Import/export pipelines
- Event/webhook support
- Scheduled jobs
- Rule-based automations and alerts

## 15) Non-functional Requirements
- Concurrency safety (avoid stock race conditions)
- Idempotency for transaction APIs
- Performance at scale
- Observability (logs/metrics/traces)
- Backup/restore and disaster recovery

---

## Current Coverage vs Missing Capabilities

| Capability Area | Current Status | Evidence in Current Code | Gap / Missing |
| --- | --- | --- | --- |
| Basic entity CRUD generation | Implemented | `platform/assembler/generators/BackendGenerator.js`, `brick-library/backend-bricks/core/BaseService.js.hbs` | No approval workflow on CRUD |
| Quantity field initialization and numeric validation | Implemented | `brick-library/backend-bricks/mixins/InventoryMixin.js` | No transaction-locking/concurrency controls |
| Negative stock guard | Implemented | `InventoryMixin` + issue wizard logic in `platform/assembler/generators/frontend/entityPages.js` | Policy granularity per warehouse/item missing |
| Stock adjustment operation | Implemented | `adjustStock()` in `InventoryMixin`, Adjust page builder in `entityPages.js` | No approval workflow for adjustments |
| Receive / Issue / Adjust / Transfer wizards | Implemented | `buildReceivePage`, `buildIssuePage`, `buildAdjustPage`, `buildTransferPage` in `entityPages.js` | No advanced warehouse task workflow |
| Movement entity mapping (`inventory_ops`) | Implemented | `SDF_REFERENCE.md`, `FrontendGenerator.js`, `entityPages.js` | No strong server-side transaction orchestration |
| Quick actions on list rows | Implemented | `entityPages.js` quick action routes/buttons | Limited to receive/issue shortcuts |
| Batch tracking baseline | Implemented | `BatchTrackingMixin.js` | No full lot genealogy/recall workflow |
| Serial tracking baseline | Implemented | `SerialTrackingMixin.js` | No serial lifecycle states/warranty flow |
| Multi-location baseline | Partial | `LocationMixin.js`, transfer wizard in `entityPages.js` | No dedicated stock-quant model per location/bin |
| QR labels + scan helper | Implemented | `buildLabelsPage` in `entityPages.js`, `labels` config in `SDF_REFERENCE.md` | Not full barcode operations stack (GS1, scanners, etc.) |
| Low stock dashboard card | Implemented | `platform/assembler/generators/frontend/dashboardHome.js` | No procurement auto-replenishment action |
| Expiry alert dashboard card | Implemented | `dashboardHome.js` | No FEFO enforcement across picks/issues |
| Audit logging support | Implemented | activity module hooks and `__audit_logs` generation path in `ProjectAssembler.js` / docs | No fine-grained stock approval trails |
| Schema/reference validation before generation | Implemented | `ProjectAssembler._validateSdf()` | Not a runtime business-approval engine |
| CSV tooling for entities | Implemented | frontend bricks import/export support + generated entity pages | No controlled ETL jobs/quality gates |
| Reorder suggestion logic | Partial | low-stock suggestion in `dashboardHome.js` | No reorder execution, PO generation, lead-time logic |
| Warehouse/bin structure management | Partial | generic entity support can model warehouses | No native bin capacity/putaway/pick strategy engine |
| PO/GRN receiving workflow | Missing | No dedicated PO/GRN module flow in generator bricks | Needs procurement + receiving process model |
| Reservation/allocation/ATP | Missing | No reservation/commitment model in generated backend | Needs order allocation and availability engine |
| Pick-pack-ship workflow | Missing | No warehouse operation workflow pages/mixins | Needs outbound execution features |
| Customer return/RMA inventory flow | Missing | No RMA flow in generator | Needs reverse logistics workflow |
| Supplier return flow | Missing | No supplier return workflow | Needs return authorization and stock impact rules |
| Cycle count session workflow | Partial | adjust operation exists | No count sessions, blind counts, variance approvals |
| Valuation/costing methods (FIFO/LIFO/WA) | Missing | Current model is quantity-focused with flat-file data | Needs costing engine and accounting mapping |
| Landed cost allocation | Missing | Not present | Needs inbound cost distribution logic |
| GL/accounting posting integration | Missing | No accounting integration in generated ERP | Needs posting rules and chart mapping |
| Quarantine/quality hold/release | Missing | Not present | Needs stock status and QC workflow |
| Concurrency-safe stock transactions | Missing | Flat-file provider (`FlatFileProvider.js`) with no transactional DB semantics | Needs DB-backed transactional model |
| Idempotency for movement APIs | Missing | Not present in generated service template | Needs request-id/idempotency-key strategy |

---

## Missing Capability Backlog (Prioritized for Inventory Module Maturity)

## Priority A (must-have for production-grade inventory)
- Implement DB-backed stock transaction model (replace flat-file runtime persistence for inventory). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement reservation/commitment/available quantity model. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement concurrency-safe stock updates with transactional guarantees. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement PO receiving + GRN workflow for inbound stock. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement cycle count session workflow (plan, count, variance, approve, post). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]

## Priority B (important business capability expansion)
- Implement native warehouse/bin model with putaway and picking strategies. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement customer return and supplier return stock workflows. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement valuation methods (weighted average first, then FIFO). (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement inventory analytics pages (aging, turnover, slow/fast movers, stockout risk). (EA) [Allowed files: `platform/assembler/generators/FrontendGenerator.js`, `platform/assembler/generators/frontend/**`, `brick-library/frontend-bricks/components/modules/inventory/**`, `brick-library/frontend-bricks/components/**`]

## Priority C (advanced/enterprise)
- Implement full lot genealogy and recall workflow. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement landed-cost allocation engine. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement accounting posting integration for stock valuation movements. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement quality hold/release and inspection checkpoints. (ODD) [Allowed files: `brick-library/backend-bricks/core/**`, `brick-library/backend-bricks/mixins/**`, `brick-library/backend-bricks/repository/**`, `platform/assembler/generators/BackendGenerator.js`, `platform/assembler/ProjectAssembler.js`, `platform/assembler/MixinRegistry.js`]
- Implement automation rules (alerts, replenishment suggestions to actionable tasks). (ASA)

---

## Notes for ASA Task: “Research inventory use-cases and define missing capability list”

Research output should be finalized as:
1. target customer profile (SMB, mid-market, enterprise),
2. mandatory capability set by profile,
3. phased implementation roadmap (A/B/C priorities),
4. measurable acceptance criteria per capability,
5. explicit ownership mapping (ASA/BTB/ODD/EA/TE).

This document can be used as the baseline reference for that task.
