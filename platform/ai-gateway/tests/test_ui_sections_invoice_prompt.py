"""UI Sections — invoice generator prompt smoke test.

Asserts the canonical invoice-form-layout directive is present in the
invoice generator prompt the AI gateway sends to the model. If anyone
removes the section ordering instructions or drops the worked example,
this test breaks loudly so the regression is caught before bad SDFs
land in production runs.

Pinning is string-presence only — we don't render the prompt with
template variables here, just verify the directive lives in the source.
"""

from __future__ import annotations

from pathlib import Path

PROMPT_PATH = Path(__file__).resolve().parents[1] / "src" / "prompts" / "invoice_generator_prompt.txt"
SCHEMA_REF_PATH = Path(__file__).resolve().parents[1] / "src" / "prompts" / "sdf_schema_reference.txt"


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def test_invoice_prompt_includes_ui_sections_section():
    src = _read(PROMPT_PATH)
    assert "UI SECTIONS" in src
    assert "form-page" in src.lower() or "form layout" in src.lower()


def test_invoice_prompt_lists_the_canonical_layout_order():
    src = _read(PROMPT_PATH)
    # Pull out the worked example block specifically — the surrounding
    # prose mentions "totals" and "rollups" before the canonical
    # ordering, so we anchor on the JSON example to test ordering.
    start = src.index('"sections":')
    end = src.index("Section kinds reference", start)
    example = src[start:end]
    assert "identity" in example
    assert "line_items" in example
    assert "details" in example
    assert "totals" in example
    assert "rollups" in example
    assert example.index("identity") < example.index("line_items")
    assert example.index("line_items") < example.index("details")
    assert example.index("details") < example.index("totals")
    assert example.index("totals") < example.index("rollups")


def test_invoice_prompt_includes_worked_example_with_invoice_items_child():
    src = _read(PROMPT_PATH)
    assert "ui" in src.lower()
    assert "sections" in src
    assert "invoice_items" in src
    assert '"kind": "fields"' in src
    assert '"kind": "line_items"' in src
    assert '"kind": "totals"' in src
    assert '"kind": "rollups"' in src


def test_invoice_prompt_uses_dot_keyed_headings():
    src = _read(PROMPT_PATH)
    assert "form.sections.identity" in src
    assert "form.sections.details" in src


def test_invoice_prompt_warns_against_per_field_layout_drift():
    src = _read(PROMPT_PATH)
    # The directive should explicitly say each field appears in at most
    # one section, otherwise the AI tends to duplicate fields across
    # groups.
    assert "AT MOST one" in src or "at most one" in src


def test_schema_reference_documents_ui_sections_kinds():
    src = _read(SCHEMA_REF_PATH)
    assert "UI sections" in src or "ui.sections" in src
    for kind in ("fields", "line_items", "rollups", "totals", "stock_availability", "companion_user"):
        assert kind in src, f"schema reference missing {kind!r} kind"


def test_schema_reference_lists_validation_rules():
    src = _read(SCHEMA_REF_PATH)
    # The three cross-reference rules MUST be documented for the AI to
    # stay in lockstep with the Pydantic + JS validators.
    assert "field" in src.lower()
    assert "child" in src.lower()
    assert "i18n" in src.lower() or "dot-key" in src.lower()
