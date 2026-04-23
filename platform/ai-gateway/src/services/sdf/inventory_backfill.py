"""
Re-inject inventory entities required by modules.inventory when the merged SDF
drops them (e.g. LLM replaced PO/GRN with unrelated entities). Mirrors assembler
inventory pack defaults in inventoryConfig.js.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Set


def _is_pack_enabled(raw: Any) -> bool:
    if raw is True:
        return True
    if raw is False or raw is None:
        return False
    if isinstance(raw, dict):
        return raw.get("enabled") is not False
    return False


def _pick_first_string(*values: Any) -> str:
    for val in values:
        s = str(val or "").strip()
        if s:
            return s
    return ""


def _normalize_pack(raw: Any, defaults: Dict[str, Any]) -> Dict[str, Any]:
    if raw is True:
        return {**defaults, "enabled": True}
    if raw is False or raw is None:
        return {**defaults, "enabled": False}
    if isinstance(raw, dict):
        return {**defaults, **raw, "enabled": raw.get("enabled", True) is not False}
    return {**defaults, "enabled": False}


def _get_inventory_pack_config(modules: Dict[str, Any]) -> Dict[str, Any]:
    inv = modules.get("inventory") if isinstance(modules, dict) else None
    if not isinstance(inv, dict):
        inv = {}

    reservations = _normalize_pack(
        inv.get("reservations") or inv.get("reservation"),
        {
            "reservation_entity": "stock_reservations",
            "stock_entity": "products",
        },
    )
    transactions = _normalize_pack(
        inv.get("transactions")
        or inv.get("transaction")
        or inv.get("stock_transactions")
        or inv.get("stockTransactions"),
        {"stock_entity": "products"},
    )
    inbound = _normalize_pack(
        inv.get("inbound") or inv.get("receiving"),
        {
            "purchase_order_entity": "purchase_orders",
            "purchase_order_item_entity": "purchase_order_items",
            "grn_entity": "goods_receipts",
            "grn_item_entity": "goods_receipt_items",
            "stock_entity": "products",
        },
    )
    cycle_counting = _normalize_pack(
        inv.get("cycle_counting")
        or inv.get("cycleCounting")
        or inv.get("cycle_counts")
        or inv.get("cycleCounts"),
        {
            "session_entity": "cycle_count_sessions",
            "line_entity": "cycle_count_lines",
            "stock_entity": "products",
        },
    )

    reservations["reservation_entity"] = _pick_first_string(
        reservations.get("reservation_entity"),
        reservations.get("reservationEntity"),
        "stock_reservations",
    )
    inbound["purchase_order_entity"] = _pick_first_string(
        inbound.get("purchase_order_entity"),
        inbound.get("purchaseOrderEntity"),
        "purchase_orders",
    )
    inbound["purchase_order_item_entity"] = _pick_first_string(
        inbound.get("purchase_order_item_entity"),
        inbound.get("purchaseOrderItemEntity"),
        "purchase_order_items",
    )
    inbound["grn_entity"] = _pick_first_string(
        inbound.get("grn_entity"), inbound.get("grnEntity"), "goods_receipts"
    )
    inbound["grn_item_entity"] = _pick_first_string(
        inbound.get("grn_item_entity"), inbound.get("grnItemEntity"), "goods_receipt_items"
    )
    cycle_counting["session_entity"] = _pick_first_string(
        cycle_counting.get("session_entity"),
        cycle_counting.get("sessionEntity"),
        "cycle_count_sessions",
    )
    cycle_counting["line_entity"] = _pick_first_string(
        cycle_counting.get("line_entity"),
        cycle_counting.get("lineEntity"),
        "cycle_count_lines",
    )

    stock_entity = _pick_first_string(
        inv.get("stock_entity"),
        inv.get("stockEntity"),
        reservations.get("stock_entity"),
        reservations.get("stockEntity"),
        transactions.get("stock_entity"),
        transactions.get("stockEntity"),
        inbound.get("stock_entity"),
        inbound.get("stockEntity"),
        cycle_counting.get("stock_entity"),
        cycle_counting.get("stockEntity"),
        "products",
    )

    return {
        "reservations": reservations,
        "transactions": transactions,
        "inbound": inbound,
        "cycle_counting": cycle_counting,
        "stock_entity": stock_entity,
        "reservation_entity": reservations["reservation_entity"],
    }


def collect_required_inventory_entity_slugs(modules: Dict[str, Any]) -> Set[str]:
    """Entity slugs that assembler validation requires when inventory packs are on."""
    if not isinstance(modules, dict):
        return set()

    cfg = _get_inventory_pack_config(modules)
    packs_on = (
        _is_pack_enabled(cfg["reservations"])
        or _is_pack_enabled(cfg["transactions"])
        or _is_pack_enabled(cfg["inbound"])
        or _is_pack_enabled(cfg["cycle_counting"])
    )
    if not packs_on:
        return set()

    slugs: Set[str] = set()
    stock = cfg["stock_entity"] or "products"
    if stock:
        slugs.add(stock)

    if _is_pack_enabled(cfg["reservations"]):
        re = cfg["reservation_entity"] or "stock_reservations"
        if re:
            slugs.add(re)

    if _is_pack_enabled(cfg["inbound"]):
        ib = cfg["inbound"]
        for key in (
            "purchase_order_entity",
            "purchase_order_item_entity",
            "grn_entity",
            "grn_item_entity",
        ):
            s = _pick_first_string(ib.get(key))
            if s:
                slugs.add(s)

    if _is_pack_enabled(cfg["cycle_counting"]):
        cc = cfg["cycle_counting"]
        for key in ("session_entity", "line_entity"):
            s = _pick_first_string(cc.get(key))
            if s:
                slugs.add(s)

    return slugs


def backfill_inventory_entities_from_prefilled(
    data: Dict[str, Any], prefilled_sdf: Dict[str, Any] | None
) -> Dict[str, Any]:
    """
    Mutates and returns `data`. For each required inventory slug missing from
    data['entities'], deep-copies the entity from prefilled_sdf['entities'].
    """
    if not prefilled_sdf or not isinstance(prefilled_sdf, dict):
        return data

    modules = data.get("modules")
    if not isinstance(modules, dict):
        return data

    required = collect_required_inventory_entity_slugs(modules)
    if not required:
        return data

    entities = data.get("entities")
    if not isinstance(entities, list):
        entities = []
        data["entities"] = entities

    present: Set[str] = set()
    for ent in entities:
        if isinstance(ent, dict):
            slug = str(ent.get("slug") or "").strip()
            if slug:
                present.add(slug)

    prefilled_entities = prefilled_sdf.get("entities")
    if not isinstance(prefilled_entities, list):
        return data

    prefilled_by_slug: Dict[str, Dict[str, Any]] = {}
    for ent in prefilled_entities:
        if isinstance(ent, dict):
            slug = str(ent.get("slug") or "").strip()
            if slug:
                prefilled_by_slug[slug] = ent

    restored_slugs: List[str] = []
    for slug in sorted(required):
        if slug in present:
            continue
        donor = prefilled_by_slug.get(slug)
        if not donor:
            continue
        entities.append(deepcopy(donor))
        present.add(slug)
        restored_slugs.append(slug)

    if restored_slugs:
        print(
            f"[inventory_backfill] Restored {len(restored_slugs)} inventory "
            f"entit(y/ies) from prefilled SDF: {restored_slugs}"
        )

    return data
