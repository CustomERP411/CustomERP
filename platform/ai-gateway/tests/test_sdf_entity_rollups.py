"""Plan H F4 — Entity model round-trips `rollups` + rejects bad shapes.

Verifies the additive Pydantic schema addition in
`platform/ai-gateway/src/schemas/sdf.py` accepts the new
`Entity.rollups` mapping (per-entity overrides for the auto-derived
detail-page rollup sections), and rejects every malformed shape the
JS-side `_validateRollupOverrides` mirror also rejects (so client and
server stay in lockstep).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.schemas.sdf import Entity, EntityField


def make_entity(rollups):
    return Entity(
        slug="customers",
        display_name="Customer",
        fields=[EntityField(name="name", type="string", required=True)],
        rollups=rollups,
    )


def test_entity_accepts_undefined_rollups():
    entity = Entity(
        slug="customers",
        display_name="Customer",
        fields=[EntityField(name="name", type="string")],
    )
    assert entity.rollups is None


def test_entity_accepts_empty_rollups_dict():
    entity = make_entity({})
    assert entity.rollups == {}


def test_entity_accepts_false_to_suppress():
    entity = make_entity({"invoices": False})
    assert entity.rollups == {"invoices": False}


def test_entity_accepts_partial_override_columns_only():
    entity = make_entity({"invoices": {"columns": ["invoice_number", "grand_total"]}})
    assert entity.rollups["invoices"]["columns"] == ["invoice_number", "grand_total"]


def test_entity_accepts_full_override():
    entity = make_entity({
        "invoices": {
            "label": "Sales invoices",
            "columns": ["invoice_number", "issue_date", "status", "grand_total"],
            "foreign_key": "customer_id",
        }
    })
    assert entity.rollups["invoices"]["label"] == "Sales invoices"
    assert entity.rollups["invoices"]["foreign_key"] == "customer_id"


def test_entity_rollups_round_trip():
    entity = make_entity({
        "invoices": {"columns": ["invoice_number"]},
        "leads": False,
    })
    payload = entity.model_dump()
    assert payload["rollups"]["invoices"]["columns"] == ["invoice_number"]
    assert payload["rollups"]["leads"] is False


def test_entity_rejects_true_value():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": True})
    assert "`true` is not a valid value" in str(excinfo.value)


def test_entity_rejects_non_dict_non_bool_value():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": "yes"})
    assert "must be `false` or an object" in str(excinfo.value)


def test_entity_rejects_empty_string_key():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"": False})
    assert "keys must be non-empty strings" in str(excinfo.value)


def test_entity_rejects_unsupported_override_keys():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": {"tooltip": "x", "columns": ["invoice_number"]}})
    assert "unsupported keys" in str(excinfo.value)


def test_entity_rejects_label_non_string():
    with pytest.raises(ValidationError):
        make_entity({"invoices": {"label": 42}})


def test_entity_rejects_label_empty_string():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": {"label": "   "}})
    assert "label" in str(excinfo.value)


def test_entity_rejects_foreign_key_non_string():
    with pytest.raises(ValidationError):
        make_entity({"invoices": {"foreign_key": 0}})


def test_entity_rejects_foreign_key_empty_string():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": {"foreign_key": ""}})
    assert "foreign_key" in str(excinfo.value)


def test_entity_rejects_columns_empty_list():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": {"columns": []}})
    assert "columns" in str(excinfo.value)


def test_entity_rejects_columns_non_list():
    with pytest.raises(ValidationError):
        make_entity({"invoices": {"columns": "name"}})


def test_entity_rejects_columns_non_string_entries():
    with pytest.raises(ValidationError) as excinfo:
        make_entity({"invoices": {"columns": [""]}})
    assert "columns" in str(excinfo.value)


def test_entity_accepts_multiple_source_entries():
    entity = make_entity({
        "invoices": {"columns": ["invoice_number"]},
        "credit_notes": False,
        "support_tickets": {"label": "Tickets"},
    })
    assert len(entity.rollups) == 3
