"""UI Sections — `entity.ui.sections` Pydantic acceptance + rejections.

Mirrors the cross-reference checks in `_validate_ui_sections` on the
`Entity` model. Pydantic guards SDFs flowing out of the AI gateway; the
JS-side `sdfValidation._validateUiSections` mirrors the same rules for
prefilled / uploaded SDFs (covered separately in
`tests/UnitTests/UC-7/UC-7.5/uiSectionsSdfValidation.unit.test.js`).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.schemas.sdf import Entity, EntityField


def _entity(ui_sections, *, with_children=True):
    children = [{"entity": "invoice_items", "foreign_key": "invoice_id"}] if with_children else None
    kwargs = {
        "slug": "invoices",
        "display_name": "Invoice",
        "fields": [
            EntityField(name="customer_id", type="reference"),
            EntityField(name="status", type="string", options=["Draft", "Sent"]),
            EntityField(name="notes", type="text"),
        ],
        "ui": {"sections": ui_sections},
    }
    if children is not None:
        kwargs["children"] = children
    return Entity(**kwargs)


def test_accepts_undefined_ui_sections():
    entity = Entity(
        slug="invoices",
        display_name="Invoice",
        fields=[EntityField(name="x", type="string")],
    )
    assert entity.ui is None


def test_accepts_empty_sections_list():
    entity = _entity([])
    assert entity.ui["sections"] == []


def test_accepts_full_invoice_layout():
    entity = _entity([
        {"kind": "fields", "id": "identity", "heading": "form.sections.identity",
         "fields": ["customer_id", "status"]},
        {"kind": "line_items", "child": "invoice_items"},
        {"kind": "fields", "id": "details", "heading": "form.sections.details",
         "fields": ["notes"]},
        {"kind": "totals"},
        {"kind": "rollups"},
    ])
    sections = entity.ui["sections"]
    assert len(sections) == 5
    assert sections[0]["kind"] == "fields"
    assert sections[1]["child"] == "invoice_items"


def test_accepts_marker_sections_without_extras():
    entity = _entity([
        {"kind": "fields", "fields": ["customer_id"]},
        {"kind": "rollups"},
        {"kind": "stock_availability"},
        {"kind": "companion_user"},
    ])
    assert entity.ui["sections"][1]["kind"] == "rollups"


def test_rejects_unknown_kind():
    with pytest.raises(ValidationError):
        _entity([{"kind": "totally_made_up", "fields": ["customer_id"]}])


def test_rejects_field_referencing_nonexistent_field():
    with pytest.raises(ValidationError) as excinfo:
        _entity([{"kind": "fields", "fields": ["does_not_exist"]}])
    assert "does_not_exist" in str(excinfo.value)


def test_rejects_field_appearing_in_two_sections():
    with pytest.raises(ValidationError) as excinfo:
        _entity([
            {"kind": "fields", "fields": ["customer_id", "status"]},
            {"kind": "fields", "fields": ["status", "notes"]},
        ])
    assert "status" in str(excinfo.value)
    assert "at most one" in str(excinfo.value)


def test_rejects_empty_fields_section():
    with pytest.raises(ValidationError) as excinfo:
        _entity([{"kind": "fields", "fields": []}])
    assert "at least one field" in str(excinfo.value)


def test_rejects_line_items_with_unknown_child():
    with pytest.raises(ValidationError) as excinfo:
        _entity([
            {"kind": "fields", "fields": ["customer_id"]},
            {"kind": "line_items", "child": "phantom_items"},
        ])
    assert "phantom_items" in str(excinfo.value)


def test_rejects_line_items_when_no_children_declared():
    with pytest.raises(ValidationError):
        _entity(
            [
                {"kind": "fields", "fields": ["customer_id"]},
                {"kind": "line_items", "child": "invoice_items"},
            ],
            with_children=False,
        )


def test_rejects_raw_english_heading():
    with pytest.raises(ValidationError) as excinfo:
        _entity([
            {"kind": "fields", "heading": "Identity", "fields": ["customer_id"]},
        ])
    assert "i18n dot-key" in str(excinfo.value)


def test_accepts_dot_keyed_heading_on_line_items():
    entity = _entity([
        {"kind": "fields", "fields": ["customer_id"]},
        {"kind": "line_items", "child": "invoice_items", "heading": "form.sections.lineItems"},
    ])
    assert entity.ui["sections"][1]["heading"] == "form.sections.lineItems"


def test_rejects_non_list_sections():
    with pytest.raises(ValidationError) as excinfo:
        Entity(
            slug="invoices",
            display_name="Invoice",
            fields=[EntityField(name="x", type="string")],
            ui={"sections": "not-a-list"},
        )
    assert "must be a list" in str(excinfo.value)


def test_round_trip_full_layout():
    entity = _entity([
        {"kind": "fields", "id": "identity", "heading": "form.sections.identity",
         "fields": ["customer_id"]},
        {"kind": "line_items", "child": "invoice_items"},
        {"kind": "totals"},
    ])
    payload = entity.model_dump()
    assert payload["ui"]["sections"][0]["fields"] == ["customer_id"]
    assert payload["ui"]["sections"][1]["child"] == "invoice_items"
    assert payload["ui"]["sections"][2]["kind"] == "totals"
