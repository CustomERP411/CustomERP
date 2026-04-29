"""Plan F B1 — EntityField round-trips `default_from` + rejects bad shapes.

Verifies the additive Pydantic schema addition in `platform/ai-gateway/
src/schemas/sdf.py` accepts and round-trips a `default_from` codegen-time
path, rejects fields that set BOTH `default` and `default_from`, and
rejects malformed (empty) paths.

The `default_from` resolution against the SDF modules tree happens at
codegen (assembler-side `fieldUtils._resolveConfigPath`); this test
exercises the schema-time shape contract only.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from src.schemas.sdf import EntityField


def test_entity_field_accepts_default_from():
    """`default_from` is an optional dot-path string on EntityField."""

    field = EntityField(
        name="tax_rate",
        type="decimal",
        default_from="modules.invoice.tax_rate",
    )
    assert field.default_from == "modules.invoice.tax_rate"
    assert field.default is None


def test_entity_field_default_from_round_trip():
    """model_dump preserves the path verbatim."""

    field = EntityField(
        name="tax_rate",
        type="decimal",
        default_from="modules.invoice.tax_rate",
    )
    payload = field.model_dump()
    assert payload["default_from"] == "modules.invoice.tax_rate"


def test_entity_field_default_from_omitted_by_default():
    """Field without `default_from` keeps it None (Optional)."""

    field = EntityField(name="discount", type="decimal")
    assert field.default_from is None


def test_default_and_default_from_are_mutually_exclusive():
    """Setting both `default` and `default_from` MUST raise ValidationError."""

    with pytest.raises(ValidationError) as excinfo:
        EntityField(
            name="tax_rate",
            type="decimal",
            default=18,
            default_from="modules.invoice.tax_rate",
        )
    msg = str(excinfo.value)
    assert "default" in msg
    assert "default_from" in msg


def test_default_from_must_be_non_empty_string():
    """Empty / whitespace-only `default_from` is rejected."""

    with pytest.raises(ValidationError):
        EntityField(name="tax_rate", type="decimal", default_from="")
    with pytest.raises(ValidationError):
        EntityField(name="tax_rate", type="decimal", default_from="   ")


def test_default_from_alone_is_valid_with_required_false():
    """A field can carry `default_from` with required=False — common shape."""

    field = EntityField(
        name="tax_rate",
        type="decimal",
        required=False,
        default_from="modules.invoice.tax_rate",
    )
    assert field.required is False
    assert field.default_from == "modules.invoice.tax_rate"


def test_existing_field_without_default_from_still_validates():
    """Backward-compat: existing fields without `default_from` keep working."""

    field = EntityField(name="invoice_number", type="string", required=True, unique=True)
    assert field.default_from is None
    assert field.default is None
