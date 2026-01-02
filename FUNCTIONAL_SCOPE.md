# Functional Scope for CustomERP (Increment 1 & 2)

This document defines the universe of features the CustomERP Assembler should be capable of generating. The goal is to support these dynamically based on the user's business description.

## 1. Item Master Data (The Core)
*   **Dynamic Attributes:** AI-defined custom fields (e.g., "Wattage" for electronics, "Thread Count" for textiles).
*   **SKU Management:** Automatic generation of human-readable IDs.
*   **Unit of Measure (UOM):** Handling pieces, kg, liters, boxes.
*   **Categorization:** Hierarchical categories (Category -> Sub-category).
*   **Multimedia:** Support for image URLs/attachments per item.

## 2. Tracking & Identification
*   **Serial Number Tracking:** Optional trait for high-value items (one-to-one tracking).
*   **Batch/Lot Control:** Optional trait for perishables/chemicals (one-to-many tracking).
    *   *Implies:* Expiry date tracking.
*   **Barcoding Ready:** Fields for storing EAN/UPC codes.

## 3. Warehouse Hierarchy (Storage)
*   **Multi-Location Logic:** Even if just 1 warehouse, support `Site -> Zone -> Bin` hierarchy.
*   **Stock Levels per Location:** Tracking "How many at Bin A1?" vs "How many total?".

## 4. Inventory Operations
*   **Adjustments:** Manual corrections (shrinkage, damage) with reason codes.
*   **Transfers:** Moving stock between internal locations (Bin A -> Bin B).
*   **Kitting (Basic):** Defining a "Bundle" that is composed of other items (auto-deduct components when bundle is sold).

## 5. Replenishment & Planning
*   **Low Stock Alerts:** Configurable thresholds per item.
*   **Reorder Points:** "Min" levels that trigger a "To Buy" report.

## 6. Financial Valuation (Simplified)
*   **Average Cost:** Tracking the moving average cost of inventory.
*   **Transaction History:** A rigid, immutable ledger of every stock movement (+/-) to reconstruct value at any point in time.

## 7. Audit & Control
*   **Audit Trail:** User stamps on every record modification.
*   **Cycle Counting:** Flagging items that haven't been counted in X days.

---

## Omitted for Increment 1 (Too Niche/Complex)
*   *Catch Weight Management* (requires dual-unit tracking).
*   *Bonded Warehouse / Customs* (legal complexity).
*   *Cross-Docking / Wave Picking* (logistics optimization, not core ERP).
*   *LIFO/Specific Identification* (complex accounting).
*   *3PL Portals / EDI* (external integration).
*   *AR/VR / Voice Picking* (hardware dependencies).

