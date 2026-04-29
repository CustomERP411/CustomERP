"""Plan E G3 — EntityField round-trips `visibility_when` and friends.

Verifies the additive Pydantic schema additions in `platform/ai-gateway/
src/schemas/sdf.py` accept and round-trip:

  * `visibility_when` (the conditional-render predicate, only `equals` is
    interpreted by the assembler in Plan E)
  * `default` (used by the salary trio's TRY/Monthly defaults)
  * `help`     (rendered under the salary input when the compensation
    ledger is enabled)

These three additions are forward-compatible — existing SDFs without them
must still validate cleanly and serialize without empty fields leaking
into the wire format.
"""

from __future__ import annotations

import pytest

from src.schemas.sdf import EntityField


def test_entity_field_accepts_visibility_when():
    """`visibility_when` is an optional dict on EntityField."""

    field = EntityField(
        name="termination_date",
        type="date",
        visibility_when={"field": "status", "equals": "Terminated"},
    )
    assert field.visibility_when == {"field": "status", "equals": "Terminated"}


def test_entity_field_visibility_when_round_trip():
    """model_dump preserves the predicate verbatim."""

    field = EntityField(
        name="termination_date",
        type="date",
        visibility_when={"field": "status", "equals": "Terminated"},
    )
    dumped = field.model_dump(exclude_none=True)
    assert dumped["visibility_when"] == {"field": "status", "equals": "Terminated"}


def test_entity_field_visibility_when_omitted_by_default():
    """Fields without `visibility_when` must NOT leak the key into the
    payload (otherwise downstream consumers see noisy `null` values)."""

    field = EntityField(name="first_name", type="string")
    dumped = field.model_dump(exclude_none=True)
    assert "visibility_when" not in dumped


def test_entity_field_accepts_default_value():
    """`default` carries through for the salary trio's TRY/Monthly bases."""

    field = EntityField(
        name="salary_currency",
        type="string",
        options=["TRY", "USD", "EUR"],
        default="TRY",
    )
    assert field.default == "TRY"
    dumped = field.model_dump(exclude_none=True)
    assert dumped["default"] == "TRY"


def test_entity_field_accepts_help_text():
    """`help` carries through for inline guidance under inputs."""

    field = EntityField(
        name="salary",
        type="decimal",
        help="Current rate; the compensation ledger is the authoritative history.",
    )
    assert field.help is not None
    assert "compensation ledger" in field.help


def test_entity_field_in_visibility_operator_is_accepted():
    """Plan G D1 — `in` is now a first-class operator; non-empty list values
    round-trip cleanly."""

    field = EntityField(
        name="cancel_reason",
        type="text",
        visibility_when={"field": "status", "in": ["Cancelled", "Voided"]},
    )
    assert field.visibility_when["in"] == ["Cancelled", "Voided"]


def test_entity_field_unknown_visibility_operator_is_rejected():
    """Plan G D1 — operator set is closed. Unknown comparator keys (e.g.
    `matches`, `gte`) are rejected at schema-validation time so AI typos
    surface early instead of producing silently-broken forms."""

    with pytest.raises(ValueError, match="unknown comparator"):
        EntityField(
            name="cancel_reason",
            type="text",
            visibility_when={"field": "status", "matches": "Cancelled"},
        )


def test_entity_field_visibility_when_rejects_extra_keys_alongside_comparator():
    """Plan G D1 — exactly one comparator key per predicate. Free-form
    annotations (`comment`, `note`, ...) alongside a comparator are
    rejected so the predicate's intent stays unambiguous."""

    with pytest.raises(ValueError, match="multiple comparators"):
        EntityField(
            name="termination_date",
            type="date",
            visibility_when={
                "field": "status",
                "equals": "Terminated",
                "comment": "shown only after offboarding starts",
            },
        )


# Plan G D1 — full operator parity with the JS visibilityWhenSchema test.
# Each operator round-trips when well-formed and is rejected per the
# per-operator value-type rules.

def test_entity_field_not_equals_round_trip():
    field = EntityField(
        name="reactivation_date",
        type="date",
        visibility_when={"field": "status", "not_equals": "Active"},
    )
    assert field.visibility_when == {"field": "status", "not_equals": "Active"}


def test_entity_field_not_in_round_trip():
    field = EntityField(
        name="reschedule_date",
        type="date",
        visibility_when={"field": "status", "not_in": ["Done", "Closed"]},
    )
    assert field.visibility_when["not_in"] == ["Done", "Closed"]


def test_entity_field_is_set_round_trip():
    field = EntityField(
        name="follow_up_note",
        type="text",
        visibility_when={"field": "follow_up_at", "is_set": True},
    )
    assert field.visibility_when == {"field": "follow_up_at", "is_set": True}


def test_entity_field_is_unset_round_trip():
    field = EntityField(
        name="pending_note",
        type="text",
        visibility_when={"field": "resolved_at", "is_unset": True},
    )
    assert field.visibility_when == {"field": "resolved_at", "is_unset": True}


def test_entity_field_visibility_when_missing_field_key_is_rejected():
    with pytest.raises(ValueError, match="non-empty string `field`"):
        EntityField(
            name="termination_date",
            type="date",
            visibility_when={"equals": "Terminated"},
        )


def test_entity_field_visibility_when_no_comparator_is_rejected():
    with pytest.raises(ValueError, match="exactly one comparator"):
        EntityField(
            name="termination_date",
            type="date",
            visibility_when={"field": "status"},
        )


def test_entity_field_visibility_when_in_must_be_non_empty_list():
    with pytest.raises(ValueError, match="non-empty list"):
        EntityField(
            name="cancel_reason",
            type="text",
            visibility_when={"field": "status", "in": "Cancelled"},
        )
    with pytest.raises(ValueError, match="non-empty list"):
        EntityField(
            name="cancel_reason",
            type="text",
            visibility_when={"field": "status", "in": []},
        )


def test_entity_field_visibility_when_is_set_must_be_boolean():
    with pytest.raises(ValueError, match="must be a boolean"):
        EntityField(
            name="follow_up_note",
            type="text",
            visibility_when={"field": "follow_up_at", "is_set": "yes"},
        )


def test_entity_field_visibility_when_equals_must_be_scalar():
    with pytest.raises(ValueError, match="must be a scalar"):
        EntityField(
            name="cancel_reason",
            type="text",
            visibility_when={"field": "status", "equals": ["Pending", "Approved"]},
        )
