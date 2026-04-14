"""
Deterministic SDF integration — replaces the LLM integrator agent.

Merges partial module outputs (HR, Invoice, Inventory) into a single
coherent SDF dict. All logic is mechanical: entity dedup by slug,
field union, module config nesting, reference validation.
"""

from typing import Any, Dict, List
from copy import deepcopy


MODULE_ORDER = ["shared", "hr", "invoice", "inventory"]


def merge_module_outputs(
    project_name: str,
    module_outputs: Dict[str, Any],
    shared_entity_hints: List[str],
    prefilled_sdf: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Combine partial SDF outputs from module generators into one SDF dict.

    Returns a dict matching the IntegratorOutput / SystemDefinitionFile shape:
      { project_name, modules, entities, clarifications_needed, warnings }
    """
    warnings: List[str] = []

    # ── 1. Collect all entities from all module outputs ──────────
    entities_by_slug: Dict[str, Dict[str, Any]] = {}
    slug_sources: Dict[str, set] = {}
    hint_set = set(s.lower().strip() for s in shared_entity_hints)

    for mod_name, output in module_outputs.items():
        mod_entities = output.entities if hasattr(output, "entities") else output.get("entities", [])
        for ent in mod_entities:
            if not isinstance(ent, dict):
                continue
            slug = (ent.get("slug") or "").strip()
            if not slug:
                continue

            if slug not in entities_by_slug:
                entities_by_slug[slug] = deepcopy(ent)
                slug_sources[slug] = {mod_name}
            else:
                slug_sources[slug].add(mod_name)
                _merge_entity(entities_by_slug[slug], ent)

    # Carry forward shared entities from prefilled SDF that no generator produced.
    # During change requests, shared entities (e.g. "customers") can be orphaned
    # because the carry-forward loop only matches module-specific entities.
    for pre_ent in (prefilled_sdf.get("entities") or []):
        if not isinstance(pre_ent, dict):
            continue
        if (pre_ent.get("module") or "").lower() != "shared":
            continue
        slug = (pre_ent.get("slug") or "").strip()
        if slug and slug not in entities_by_slug:
            entities_by_slug[slug] = deepcopy(pre_ent)
            slug_sources[slug] = {"_prefilled"}

    # Mark shared entities
    for slug, sources in slug_sources.items():
        already_shared = (entities_by_slug[slug].get("module") or "").lower() == "shared"
        from_hint = slug.lower() in hint_set
        from_multiple = len(sources) > 1
        if already_shared or from_hint or from_multiple:
            entities_by_slug[slug]["module"] = "shared"

    # ── 2. Order entities: shared first, then by module order ───
    def _sort_key(slug: str) -> tuple:
        ent = entities_by_slug[slug]
        mod = (ent.get("module") or "").lower()
        try:
            idx = MODULE_ORDER.index(mod)
        except ValueError:
            idx = len(MODULE_ORDER)
        return (idx, slug)

    ordered_slugs = sorted(entities_by_slug.keys(), key=_sort_key)
    entities = [entities_by_slug[s] for s in ordered_slugs]

    # ── 3. Build modules config ─────────────────────────────────
    modules: Dict[str, Any] = {}

    # Carry forward non-generator module configs from prefilled SDF
    preserved_keys = {"access_control", "activity_log", "inventory_dashboard", "scheduled_reports"}
    prefilled_modules = prefilled_sdf.get("modules") if isinstance(prefilled_sdf.get("modules"), dict) else {}
    for key in preserved_keys:
        if key in prefilled_modules:
            modules[key] = deepcopy(prefilled_modules[key])

    for mod_name, output in module_outputs.items():
        mod_config = output.module_config if hasattr(output, "module_config") else output.get("module_config", {})
        if isinstance(mod_config, dict) and mod_config:
            modules[mod_name] = deepcopy(mod_config)
        elif mod_name in prefilled_modules:
            modules[mod_name] = deepcopy(prefilled_modules[mod_name])
        else:
            modules[mod_name] = {"enabled": True}

    # ── 4. Auto-detect parent-child relationships ────────────────
    _ensure_children(entities_by_slug)

    # ── 5. Validate entity references ───────────────────────────
    all_slugs = set(entities_by_slug.keys())
    for ent in entities:
        ent_slug = ent.get("slug", "?")
        for field in (ent.get("fields") or []):
            if not isinstance(field, dict):
                continue
            ref = field.get("reference_entity")
            if ref and isinstance(ref, str) and ref not in all_slugs:
                warnings.append(
                    f"Entity '{ent_slug}' field '{field.get('name', '?')}' references "
                    f"'{ref}' which does not exist in the merged SDF"
                )

    # ── 6. Collect & deduplicate clarifications ─────────────────
    seen_q_ids: set = set()
    clarifications: List[Dict[str, Any]] = []
    for output in module_outputs.values():
        mod_clarifications = (
            output.clarifications_needed
            if hasattr(output, "clarifications_needed")
            else output.get("clarifications_needed", [])
        )
        for q in mod_clarifications:
            q_dict = q.model_dump(exclude_none=True) if hasattr(q, "model_dump") else (q if isinstance(q, dict) else {})
            qid = q_dict.get("id", "")
            if qid and qid not in seen_q_ids:
                seen_q_ids.add(qid)
                clarifications.append(q_dict)

    # ── 7. Collect warnings from module outputs ─────────────────
    for output in module_outputs.values():
        mod_warnings = output.warnings if hasattr(output, "warnings") else output.get("warnings", [])
        if isinstance(mod_warnings, list):
            warnings.extend(mod_warnings)

    return {
        "project_name": project_name,
        "modules": modules,
        "entities": entities,
        "clarifications_needed": clarifications,
        "warnings": warnings,
    }


_CHILD_SUFFIXES = ("_items", "_lines")


def _ensure_children(entities_by_slug: Dict[str, Dict[str, Any]]) -> None:
    """Auto-detect parent-child entity relationships and add ``children``
    config on parent entities.  This ensures line-item entities like
    ``invoice_items``, ``goods_receipt_items``, ``cycle_count_lines`` etc.
    are rendered as embedded rows inside the parent form rather than as
    standalone sidebar pages.

    Detection heuristic: for every entity whose slug ends with a known
    suffix (``_items``, ``_lines``), look for a reference field whose
    ``reference_entity`` points to another entity in the SDF.  If found
    and the parent doesn't already list this child, add a ``children``
    entry automatically.
    """
    all_slugs = set(entities_by_slug.keys())

    for child_slug, child_ent in list(entities_by_slug.items()):
        matched_suffix = None
        for suffix in _CHILD_SUFFIXES:
            if child_slug.endswith(suffix):
                matched_suffix = suffix
                break
        if not matched_suffix:
            continue

        child_fields = child_ent.get("fields") or []
        if not isinstance(child_fields, list):
            continue

        for field in child_fields:
            if not isinstance(field, dict):
                continue
            ref = field.get("reference_entity")
            fk_name = field.get("name")
            if not ref or ref not in all_slugs or not fk_name:
                continue

            parent_ent = entities_by_slug[ref]
            existing_children = parent_ent.get("children")
            if not isinstance(existing_children, list):
                existing_children = []
                parent_ent["children"] = existing_children

            already_registered = any(
                isinstance(ch, dict) and ch.get("entity") == child_slug
                for ch in existing_children
            )
            if already_registered:
                continue

            visible_cols = [
                f["name"] for f in child_fields
                if isinstance(f, dict)
                and f.get("name")
                and f["name"] != fk_name
                and f.get("type") != "reference"
            ][:6]

            child_display = child_ent.get("display_name") or child_slug.replace("_", " ").title()

            existing_children.append({
                "entity": child_slug,
                "foreign_key": fk_name,
                "label": child_display,
                "columns": visible_cols,
            })
            break


def _merge_entity(base: Dict[str, Any], incoming: Dict[str, Any]) -> None:
    """Merge an incoming entity definition into an existing base (same slug)."""
    # Merge top-level dict properties (features, inventory_ops, ui, labels, etc.)
    dict_keys = ("features", "inventory_ops", "ui", "labels", "list", "bulk_actions")
    for key in dict_keys:
        base_val = base.get(key)
        inc_val = incoming.get(key)
        if isinstance(inc_val, dict):
            if isinstance(base_val, dict):
                merged = {**base_val, **inc_val}
                base[key] = merged
            else:
                base[key] = deepcopy(inc_val)

    # Preserve display_name / display_field from whichever has it
    for key in ("display_name", "display_field"):
        if not base.get(key) and incoming.get(key):
            base[key] = incoming[key]

    # Merge fields by name (union, prefer the more complete definition)
    base_fields = base.get("fields") if isinstance(base.get("fields"), list) else []
    inc_fields = incoming.get("fields") if isinstance(incoming.get("fields"), list) else []

    field_by_name: Dict[str, Dict[str, Any]] = {}
    for f in base_fields:
        if isinstance(f, dict) and f.get("name"):
            field_by_name[f["name"]] = f
    for f in inc_fields:
        if isinstance(f, dict) and f.get("name"):
            name = f["name"]
            if name in field_by_name:
                existing = field_by_name[name]
                merged_field = {**existing, **f}
                # Keep the more restrictive required flag
                if existing.get("required") or f.get("required"):
                    merged_field["required"] = True
                if existing.get("unique") or f.get("unique"):
                    merged_field["unique"] = True
                field_by_name[name] = merged_field
            else:
                field_by_name[name] = deepcopy(f)

    base["fields"] = list(field_by_name.values())
