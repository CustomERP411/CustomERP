"""Filtering and prefill-enforcement helpers for SDF generation."""

from copy import deepcopy
from typing import Optional, Dict, Any


DEFAULT_QUESTION_KEYS: Dict[str, list[str]] = {
    "hr": [
        "hr_work_days", "hr_daily_hours", "hr_enable_leave_engine",
        "hr_enable_leave_approvals", "hr_enable_attendance_time",
        "hr_enable_compensation_ledger", "hr_leave_types",
    ],
    "invoice": [
        "invoice_currency", "invoice_tax_rate", "invoice_enable_payments",
        "invoice_enable_notes", "invoice_enable_calc_engine",
        "invoice_payment_terms", "invoice_recurring", "invoice_print",
    ],
    "inventory": [
        "inv_multi_location", "inv_allow_negative_stock",
        "inv_enable_reservations", "inv_enable_inbound",
        "inv_enable_cycle_counting", "inv_batch_tracking",
        "inv_serial_tracking", "inv_expiry_tracking",
        "inv_low_stock_alerts", "inv_costing_method", "inv_qr_labels",
    ],
}

DUPLICATE_KEYWORDS: list[tuple[str, ...]] = [
    ("leave", "approval", "approve", "manager"),
    ("leave", "type"),
    ("salary", "compensation", "payroll", "wage"),
    ("attendance", "check-in", "check in", "clock"),
    ("work", "day", "schedule", "mon", "tue", "fri", "sat"),
    ("daily", "hour"),
    ("currency",),
    ("tax", "rate", "vat"),
    ("payment", "term", "net 15", "net 30", "net 60", "due on receipt"),
    ("partial", "payment"),
    ("credit", "debit", "note"),
    ("discount", "charge", "calc"),
    ("print", "pdf"),
    ("recurring", "subscription", "repeat"),
    ("multi", "location", "warehouse"),
    ("negative", "stock"),
    ("reservation", "reserve"),
    ("purchase", "order", "supplier", "inbound"),
    ("cycle", "count", "stock count"),
    ("batch", "lot"),
    ("serial", "number"),
    ("expiry", "expiration", "perishable"),
    ("low", "stock", "alert", "reorder"),
    ("costing", "fifo", "lifo", "weighted", "average"),
    ("qr", "label", "barcode"),
    ("user", "group", "role", "access"),
    ("permission", "authorize", "authorization"),
    ("admin", "superadmin", "administrator"),
    ("login", "authentication", "password"),
]


def filter_duplicate_questions(
    questions: list[dict],
    default_answers: Optional[Dict[str, Any]],
) -> list[dict]:
    """Remove AI-generated questions that overlap with default wizard topics."""
    if not questions:
        return questions

    answered_keys = set((default_answers or {}).keys())
    kept: list[dict] = []
    removed_count = 0

    for q in questions:
        if not isinstance(q, dict):
            kept.append(q)
            continue

        q_id = str(q.get("id", "")).lower()
        q_text = str(q.get("question", "")).lower()
        combined = q_id + " " + q_text

        if q_id in answered_keys:
            removed_count += 1
            continue

        is_duplicate = False
        for keyword_group in DUPLICATE_KEYWORDS:
            if any(kw in combined for kw in keyword_group):
                is_duplicate = True
                break

        if is_duplicate:
            removed_count += 1
            continue

        kept.append(q)

    if removed_count:
        print(f"[SDFService] Filtered {removed_count} duplicate/wizard-covered questions")
    return kept


def enforce_prefilled_sdf(ai_data: dict, prefilled: Dict[str, Any]) -> dict:
    """Deep-merge the prefilled SDF into the AI output so wizard choices
    are never lost. The prefilled SDF wins for module configs; the AI can
    only ADD new entities/fields, not remove existing ones."""
    if not prefilled or not isinstance(prefilled, dict):
        return ai_data

    # --- modules: deep-merge, prefilled wins for any key it defines ---
    pre_modules = prefilled.get("modules")
    ai_modules = ai_data.get("modules")
    if isinstance(pre_modules, dict):
        if not isinstance(ai_modules, dict):
            ai_modules = {}
        merged_modules = deepcopy(pre_modules)
        for mod_key, ai_mod_cfg in ai_modules.items():
            if mod_key not in merged_modules:
                merged_modules[mod_key] = ai_mod_cfg
            elif isinstance(merged_modules[mod_key], dict) and isinstance(ai_mod_cfg, dict):
                base = merged_modules[mod_key]
                for k, v in ai_mod_cfg.items():
                    if k not in base:
                        base[k] = v
                    elif isinstance(base[k], dict) and isinstance(v, dict):
                        for sub_k, sub_v in v.items():
                            if sub_k not in base[k]:
                                base[k][sub_k] = sub_v
        ai_data["modules"] = merged_modules

    # --- entities: keep all prefilled entities, merge AI additions ---
    pre_entities = prefilled.get("entities", [])
    ai_entities = ai_data.get("entities", [])
    if isinstance(pre_entities, list) and pre_entities:
        pre_by_slug = {}
        for e in pre_entities:
            if isinstance(e, dict) and e.get("slug"):
                pre_by_slug[e["slug"]] = deepcopy(e)

        ai_by_slug = {}
        for e in ai_entities:
            if isinstance(e, dict) and e.get("slug"):
                ai_by_slug[e["slug"]] = e

        for slug, ai_ent in ai_by_slug.items():
            if slug not in pre_by_slug:
                pre_by_slug[slug] = ai_ent
            else:
                pre_ent = pre_by_slug[slug]
                pre_field_names = {
                    f["name"] for f in pre_ent.get("fields", [])
                    if isinstance(f, dict) and f.get("name")
                }
                for ai_field in ai_ent.get("fields", []):
                    if isinstance(ai_field, dict) and ai_field.get("name") not in pre_field_names:
                        pre_ent.setdefault("fields", []).append(ai_field)
                for key in ("display_name", "display_field", "ui", "list", "children"):
                    if key in ai_ent and key not in pre_ent:
                        pre_ent[key] = ai_ent[key]

        slug_order = list(pre_by_slug.keys())
        for slug in ai_by_slug:
            if slug not in pre_by_slug:
                slug_order.append(slug)
                pre_by_slug[slug] = ai_by_slug[slug]
        ai_data["entities"] = [pre_by_slug[s] for s in slug_order if s in pre_by_slug]

    # --- constraints: keep prefilled constraints ---
    pre_constraints = prefilled.get("constraints")
    if isinstance(pre_constraints, dict):
        ai_data.setdefault("constraints", pre_constraints)

    print("[SDFService] Enforced prefilled SDF — wizard choices preserved")
    return ai_data
