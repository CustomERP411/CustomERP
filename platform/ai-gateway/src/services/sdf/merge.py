"""JSON parsing and SDF edit-patch merge utilities."""

import json

from src.schemas.sdf import SystemDefinitionFile


def parse_and_clean_json(json_string: str) -> dict:
    """Finds and parses a JSON object from a string, stripping markdown."""
    # Find the start and end of the JSON object to handle markdown fences
    start = json_string.find('{')
    end = json_string.rfind('}')
    if start == -1 or end == -1:
        raise json.JSONDecodeError("Could not find JSON object in response", json_string, 0)
    
    cleaned_json = json_string[start:end+1]
    return json.loads(cleaned_json)


def merge_edit_patch(base_sdf: SystemDefinitionFile, patch: dict) -> dict:
    """
    Merge a potentially-partial AI edit output onto the current SDF.

    This is intentionally conservative:
    - If patch omits an entity or omits entity.fields, we keep the base.
    - If patch includes entity.fields, we treat it as a field patch (merge by field name),
      so missing properties like type/required get inherited from base when possible.
    """
    if not isinstance(patch, dict):
        return base_sdf.model_dump(exclude_none=True)

    base = base_sdf.model_dump(exclude_none=True)
    out = dict(base)

    if isinstance(patch.get("project_name"), str) and patch.get("project_name").strip():
        out["project_name"] = patch["project_name"]

    if isinstance(patch.get("modules"), dict):
        out["modules"] = patch["modules"]

    if "clarifications_needed" in patch:
        out["clarifications_needed"] = patch.get("clarifications_needed")
    if "warnings" in patch:
        out["warnings"] = patch.get("warnings")

    base_entities_list = base.get("entities") if isinstance(base.get("entities"), list) else []
    patch_entities_list = patch.get("entities") if isinstance(patch.get("entities"), list) else []

    base_by_slug = {
        str(e.get("slug")): e
        for e in base_entities_list
        if isinstance(e, dict) and isinstance(e.get("slug"), str) and e.get("slug")
    }

    # Keep base order, append new entities at the end
    base_order = [str(e.get("slug")) for e in base_entities_list if isinstance(e, dict) and e.get("slug")]
    new_slugs: list[str] = []

    merged_by_slug = dict(base_by_slug)

    for pe in patch_entities_list:
        if not isinstance(pe, dict):
            continue
        slug = pe.get("slug")
        if not isinstance(slug, str) or not slug.strip():
            continue
        slug = slug.strip()

        # Explicit remove marker: delete this entity from the SDF.
        if pe.get("remove") is True or pe.get("delete") is True or pe.get("_delete") is True:
            merged_by_slug.pop(slug, None)
            continue

        be = base_by_slug.get(slug, {})
        merged_entity = dict(be)
        merged_entity.update(pe)

        # Fields merge
        be_fields = be.get("fields") if isinstance(be, dict) and isinstance(be.get("fields"), list) else []
        pe_fields = pe.get("fields") if isinstance(pe.get("fields"), list) else None

        if pe_fields is None:
            merged_entity["fields"] = be_fields
        else:
            be_field_by_name = {
                str(f.get("name")): f
                for f in be_fields
                if isinstance(f, dict) and isinstance(f.get("name"), str) and f.get("name")
            }
            merged_fields: list[dict] = []
            seen: set[str] = set()
            removed: set[str] = set()

            for pf in pe_fields:
                if not isinstance(pf, dict):
                    continue
                fname = pf.get("name")
                if not isinstance(fname, str) or not fname.strip():
                    continue
                fname = fname.strip()
                # Explicit remove marker: delete this field from the entity.
                if pf.get("remove") is True or pf.get("delete") is True or pf.get("_delete") is True:
                    removed.add(fname)
                    seen.add(fname)
                    continue
                base_field = be_field_by_name.get(fname, {})
                mf = dict(base_field)
                mf.update(pf)
                merged_fields.append(mf)
                seen.add(fname)

            # Keep base fields not mentioned in patch
            for fname, bf in be_field_by_name.items():
                if fname in seen or fname in removed:
                    continue
                merged_fields.append(bf)

            merged_entity["fields"] = merged_fields

        merged_by_slug[slug] = merged_entity
        if slug not in base_by_slug:
            new_slugs.append(slug)

    # Rebuild entity list in stable order
    ordered_slugs = [s for s in base_order if s in merged_by_slug] + [s for s in new_slugs if s in merged_by_slug]
    out["entities"] = [merged_by_slug[s] for s in ordered_slugs]

    return out
