"""
Unit tests for the SDFService
"""

import pytest
import json
from unittest.mock import MagicMock

from pydantic import ValidationError

from src.services.sdf_service import SDFService
from src.schemas.sdf import (
    DerivedFieldRelation,
    Entity,
    EntityField,
    InvariantRelation,
    PermissionScopeRelation,
    ReferenceContractRelation,
    StatusPropagationRelation,
    SystemDefinitionFile,
)

# Mark all tests in this file as asyncio
pytestmark = pytest.mark.asyncio


@pytest.fixture
def sample_business_description() -> str:
    return "I need an inventory system for my small electronics shop."


@pytest.fixture
def valid_sdf_json() -> str:
    """A valid SDF JSON string that the mock AI will return."""
    data = {
        "project_name": "Electronics Shop Inventory",
        "modules": {
            "activity_log": {"enabled": True}
        },
        "entities": [
            {
                "slug": "products",
                "display_name": "Products",
                "display_field": "name",
                "ui": {"search": True, "csv_import": True, "csv_export": True, "print": True},
                "list": {"columns": ["name"]},
                "fields": [
                    {
                        "name": "name",
                        "type": "string",
                        "required": True,
                        "label": "Name",
                        "min_length": 2
                    }
                ]
            }
        ],
        "clarifications_needed": []
    }
    return json.dumps(data)


async def test_generate_sdf_success(
    mock_gemini_client: MagicMock,
    sample_business_description: str,
    valid_sdf_json: str
):
    """Test the success case where the AI returns a valid and complete SDF."""
    # Arrange: Configure the mock client to return the valid JSON
    mock_gemini_client.generate_with_retry.return_value = valid_sdf_json
    sdf_service = SDFService(gemini_client=mock_gemini_client)

    # Act: Call the service method
    result = await sdf_service.generate_sdf_from_description(sample_business_description)

    # Assert: Check that the result is a valid, parsed Pydantic model
    assert isinstance(result, SystemDefinitionFile)
    assert result.project_name == "Electronics Shop Inventory"
    assert len(result.entities) == 1
    assert result.entities[0].slug == "products"
    mock_gemini_client.generate_with_retry.assert_awaited_once()


async def test_generate_sdf_invalid_json_response(
    mock_gemini_client: MagicMock,
    sample_business_description: str
):
    """Test the failure case where the AI returns a non-JSON string."""
    # Arrange: Configure the mock client to return malformed JSON
    mock_gemini_client.generate_with_retry.return_value = "This is not valid JSON."
    sdf_service = SDFService(gemini_client=mock_gemini_client)

    # Act & Assert: Expect a ValueError because of the JSON decoding error
    with pytest.raises(ValueError, match="AI returned an invalid JSON format."):
        await sdf_service.generate_sdf_from_description(sample_business_description)
    
    mock_gemini_client.generate_with_retry.assert_awaited_once()


async def test_generate_sdf_schema_validation_error(
    mock_gemini_client: MagicMock,
    sample_business_description: str
):
    """Test the failure case where the AI returns valid JSON that fails schema validation."""
    # Arrange: JSON is valid, but 'schema_name' (a required field) is missing
    invalid_schema_data = {
        "entities": [
            {
                "slug": "products",
                "fields": []
            }
        ]
    }
    mock_gemini_client.generate_with_retry.return_value = json.dumps(invalid_schema_data)
    sdf_service = SDFService(gemini_client=mock_gemini_client)

    # Act & Assert: Expect a ValueError because of the Pydantic validation error
    with pytest.raises(ValueError, match="AI response did not match the required SDF schema"):
        await sdf_service.generate_sdf_from_description(sample_business_description)

    mock_gemini_client.generate_with_retry.assert_awaited_once()


def test_normalize_generator_sdf_auto_adds_hr_employees_when_missing():
    sdf_service = SDFService(gemini_client=MagicMock())
    data = {
        "project_name": "HR Incomplete",
        "modules": {"hr": {"enabled": True}},
        "entities": [
            {"slug": "departments", "fields": []}
        ],
    }

    out = sdf_service._normalize_generator_sdf(data, request_text="")
    assert out["modules"]["hr"]["enabled"] is True
    slugs = {e.get("slug") for e in out.get("entities", []) if isinstance(e, dict)}
    assert "employees" in slugs
    warnings = out.get("warnings", [])
    assert any("hr" in w and "Auto-added" in w for w in warnings)


def test_normalize_generator_sdf_auto_adds_invoice_entities_when_missing():
    sdf_service = SDFService(gemini_client=MagicMock())
    data = {
        "project_name": "Invoice Incomplete",
        "modules": {"invoice": {"enabled": True}},
        "entities": [
            {"slug": "invoices", "fields": []}
        ],
    }

    out = sdf_service._normalize_generator_sdf(data, request_text="")
    assert out["modules"]["invoice"]["enabled"] is True
    slugs = {e.get("slug") for e in out.get("entities", []) if isinstance(e, dict)}
    assert "customers" in slugs
    warnings = out.get("warnings", [])
    assert any("invoice" in w and "Auto-added" in w for w in warnings)


def test_normalize_generator_sdf_keeps_hr_without_departments():
    sdf_service = SDFService(gemini_client=MagicMock())
    data = {
        "project_name": "HR Minimal",
        "modules": {"hr": {"enabled": True}},
        "entities": [
            {"slug": "employees", "fields": []}
        ],
    }

    out = sdf_service._normalize_generator_sdf(data, request_text="")
    assert out["modules"]["hr"]["enabled"] is True


def test_normalize_generator_sdf_keeps_invoice_without_items():
    sdf_service = SDFService(gemini_client=MagicMock())
    data = {
        "project_name": "Invoice Minimal",
        "modules": {"invoice": {"enabled": True}},
        "entities": [
            {"slug": "invoices", "fields": []},
            {"slug": "customers", "fields": []}
        ],
    }

    out = sdf_service._normalize_generator_sdf(data, request_text="")
    assert out["modules"]["invoice"]["enabled"] is True


def test_normalize_generator_sdf_enables_inventory_ops_when_config_present():
    sdf_service = SDFService(gemini_client=MagicMock())
    data = {
        "project_name": "Inventory Ops",
        "entities": [
            {
                "slug": "products",
                "fields": [],
                "inventory_ops": {
                    "sell": {"label": "Fulfill Order"}
                }
            }
        ],
    }

    out = sdf_service._normalize_generator_sdf(data, request_text="")
    inv = out["entities"][0]["inventory_ops"]
    assert inv.get("enabled") is True
    assert inv["sell"].get("enabled") is True


# ---------------------------------------------------------------------------
# Coherence layer (Plan A) — schema parsing & validator tests.
#
# These cover the five test points listed in plan_a_sdf_schema_extension:
#   1. Each `kind` parses correctly into its specific subclass.
#   2. Unknown `kind` raises ValidationError.
#   3. computed=True + required=True on EntityField raises ValidationError.
#   4. Root-level `relations` still accepted (backwards compat) and emits a
#      deprecation warning into `warnings`.
#   5. SDF without `relations` still parses.
# ---------------------------------------------------------------------------


def _entity_with_relations(relations: list) -> dict:
    """Helper: build a single-entity SDF dict with the given relations[]."""
    return {
        "project_name": "Coherence Test",
        "entities": [
            {
                "slug": "leaves",
                "fields": [
                    {"name": "approver_id", "type": "string"},
                    {"name": "status", "type": "string"},
                    {"name": "leave_days", "type": "integer", "computed": True},
                ],
                "relations": relations,
            }
        ],
    }


def test_relations_each_kind_parses_into_specific_subclass():
    """TC-coherence-001 — each of the five kinds parses into its concrete model."""
    sdf = SystemDefinitionFile.model_validate(_entity_with_relations([
        {
            "kind": "reference_contract",
            "field": "approver_id",
            "target": "__erp_users",
            "when": "modules.access_control.enabled",
        },
        {
            "kind": "status_propagation",
            "on": {"field": "status", "from": "Pending", "to": "Approved"},
            "effect": {
                "action": "create_per_work_day",
                "target_entity": "attendance_entries",
            },
        },
        {
            "kind": "derived_field",
            "computed_field": "leave_days",
            "formula": "working_days(start_date, end_date)",
        },
        {
            "kind": "invariant",
            "rule": "no_overlap_with(entity=leaves, group_by=employee_id)",
            "severity": "warn",
        },
        {
            "kind": "permission_scope",
            "permission": "hr.leaves.approve",
            "scope": "manager_chain",
            "actions": ["update.status:Approved"],
        },
    ]))

    rels = sdf.entities[0].relations
    assert rels is not None and len(rels) == 5
    assert isinstance(rels[0], ReferenceContractRelation)
    assert rels[0].target == "__erp_users"
    assert isinstance(rels[1], StatusPropagationRelation)
    assert rels[1].effect["target_entity"] == "attendance_entries"
    assert isinstance(rels[2], DerivedFieldRelation)
    assert rels[2].computed_field == "leave_days"
    assert isinstance(rels[3], InvariantRelation)
    assert rels[3].severity == "warn"
    assert isinstance(rels[4], PermissionScopeRelation)
    assert rels[4].scope == "manager_chain"
    assert rels[4].actions == ["update.status:Approved"]


def test_relations_unknown_kind_raises_validation_error():
    """TC-coherence-002 — an unknown kind value is rejected."""
    with pytest.raises(ValidationError):
        SystemDefinitionFile.model_validate(_entity_with_relations([
            {"kind": "totally_unknown", "anything": "goes"},
        ]))


def test_entity_field_computed_required_combination_rejected():
    """TC-coherence-003 — computed=True + required=True is rejected."""
    with pytest.raises(ValidationError) as exc_info:
        EntityField.model_validate({
            "name": "computed_thing",
            "type": "integer",
            "computed": True,
            "required": True,
        })
    assert "computed" in str(exc_info.value).lower()
    assert "required" in str(exc_info.value).lower()


def test_root_level_relations_still_accepted_with_deprecation_warning():
    """TC-coherence-004 — the legacy root-level `relations[]` still parses but
    appends a deprecation message into `warnings`."""
    sdf = SystemDefinitionFile.model_validate({
        "project_name": "Legacy Relations",
        "entities": [
            {
                "slug": "products",
                "fields": [{"name": "name", "type": "string"}],
            }
        ],
        "relations": [
            {"some": "legacy", "shape": "ignored"},
        ],
    })
    assert sdf.relations == [{"some": "legacy", "shape": "ignored"}]
    assert sdf.warnings is not None
    assert any("Deprecated" in w and "root-level" in w for w in sdf.warnings)


def test_sdf_without_relations_still_parses():
    """TC-coherence-005 — backwards compat: an entity with no relations parses fine."""
    sdf = SystemDefinitionFile.model_validate({
        "project_name": "No Relations",
        "entities": [
            {
                "slug": "products",
                "fields": [{"name": "name", "type": "string", "required": True}],
            }
        ],
    })
    assert sdf.entities[0].relations is None
    # No deprecation warning fires when there are no relations anywhere.
    assert sdf.warnings is None or not any(
        "Deprecated" in w and "root-level" in w for w in (sdf.warnings or [])
    )


# ---------------------------------------------------------------------------
# Plan B follow-up #9 — AI-generator-shaped relations parse cleanly.
#
#   1. HR generator shape: status_propagation + invariant + permission_scope
#   2. Invoice generator shape: derived_field + status_propagation
#   3. Inventory generator shape: derived_field + invariant
#   4. Prompt loader injects sdf_schema_reference.txt into every module
#      generator prompt template.
# ---------------------------------------------------------------------------


def test_hr_generator_relations_shape_parses():
    """TC-coherence-006 — sample HR-shaped relations parse correctly."""
    sdf = SystemDefinitionFile.model_validate({
        "project_name": "HR Generator Shape",
        "entities": [
            {
                "slug": "leaves",
                "display_name": "Leaves",
                "fields": [
                    {"name": "employee_id", "type": "reference", "reference_entity": "employees"},
                    {"name": "status", "type": "string"},
                    {"name": "start_date", "type": "date"},
                    {"name": "end_date", "type": "date"},
                ],
                "relations": [
                    {
                        "kind": "status_propagation",
                        "on": {"field": "status", "to": "approved"},
                        "effect": {
                            "action": "create_per_work_day(start=start_date, end=end_date)",
                            "target_entity": "attendance",
                        },
                        "reverse": {
                            "on": {"field": "status", "to": "cancelled"},
                            "effect": {
                                "action": "remove_emitted_rows()",
                                "target_entity": "attendance",
                            },
                        },
                        "when": "modules.hr.leave_engine.enabled",
                    },
                    {
                        "kind": "invariant",
                        "rule": "no_overlap_with(entity=leaves, group_by=employee_id)",
                        "severity": "block",
                    },
                    {
                        "kind": "permission_scope",
                        "permission": "hr.leaves.approve",
                        "scope": "manager_chain",
                        "actions": ["update"],
                    },
                ],
            }
        ],
    })
    rels = sdf.entities[0].relations
    assert rels is not None and len(rels) == 3
    assert isinstance(rels[0], StatusPropagationRelation)
    assert isinstance(rels[1], InvariantRelation)
    assert isinstance(rels[2], PermissionScopeRelation)


def test_invoice_generator_relations_shape_parses():
    """TC-coherence-007 — sample invoice-shaped relations parse correctly."""
    sdf = SystemDefinitionFile.model_validate({
        "project_name": "Invoice Generator Shape",
        "entities": [
            {
                "slug": "invoices",
                "display_name": "Invoices",
                "fields": [
                    {"name": "status", "type": "string"},
                    {"name": "grand_total", "type": "decimal"},
                    {"name": "outstanding_balance", "type": "decimal", "computed": True},
                ],
                "relations": [
                    {
                        "kind": "derived_field",
                        "computed_field": "outstanding_balance",
                        "formula": "gross_minus_deductions(gross=grand_total, deductions=invoice_payment_allocations.amount)",
                        "when": "modules.invoice.payments.enabled",
                    },
                    {
                        "kind": "status_propagation",
                        "on": {"field": "status", "to": "Posted"},
                        "effect": {
                            "action": "add_ledger_line(direction=out, qty_field=quantity)",
                            "target_entity": "inventory_movements",
                        },
                    },
                ],
            }
        ],
    })
    rels = sdf.entities[0].relations
    assert rels is not None and len(rels) == 2
    assert isinstance(rels[0], DerivedFieldRelation)
    assert isinstance(rels[1], StatusPropagationRelation)


def test_inventory_generator_relations_shape_parses():
    """TC-coherence-008 — sample inventory-shaped relations parse correctly."""
    sdf = SystemDefinitionFile.model_validate({
        "project_name": "Inventory Generator Shape",
        "entities": [
            {
                "slug": "inventory_items",
                "display_name": "Inventory Items",
                "fields": [
                    {"name": "quantity", "type": "decimal"},
                    {"name": "reserved_quantity", "type": "decimal", "computed": True},
                    {"name": "committed_quantity", "type": "decimal", "computed": True},
                    {"name": "available_quantity", "type": "decimal", "computed": True},
                ],
                "relations": [
                    {
                        "kind": "derived_field",
                        "computed_field": "available_quantity",
                        "formula": "qty_minus_reserved_committed(on_hand=quantity, reserved=reserved_quantity, committed=committed_quantity)",
                        "when": "modules.inventory.reservations.enabled",
                    },
                    {
                        "kind": "invariant",
                        "rule": "non_negative_balance(field=available_quantity)",
                        "severity": "block",
                        "when": "modules.inventory.reservations.enabled",
                    },
                ],
            }
        ],
    })
    rels = sdf.entities[0].relations
    assert rels is not None and len(rels) == 2
    assert isinstance(rels[0], DerivedFieldRelation)
    assert isinstance(rels[1], InvariantRelation)


def test_prompt_loader_injects_sdf_schema_reference_into_module_generators():
    """TC-coherence-009 — the prompt loader must inject sdf_schema_reference.txt
    content into every module generator prompt so the AI sees the coherence
    layer documentation. Regression for the schema-reference wiring."""
    from src.prompts.sdf_generation import (
        get_hr_generator_prompt,
        get_invoice_generator_prompt,
        get_inventory_generator_prompt,
        _get_sdf_schema_reference,
    )

    # Sentinel substring that lives only in the schema reference file.
    schema_ref = _get_sdf_schema_reference()
    assert "Coherence layer" in schema_ref
    sentinel = "Coherence layer: entity.relations[]"

    hr_prompt = get_hr_generator_prompt(
        business_description="biz",
        hr_description="desc",
        hr_features="",
        shared_entities="",
        prefilled_module_sdf="{}",
        default_answers="{}",
        change_instructions="",
    )
    inv_prompt = get_invoice_generator_prompt(
        business_description="biz",
        invoice_description="desc",
        invoice_features="",
        shared_entities="",
        prefilled_module_sdf="{}",
        default_answers="{}",
        change_instructions="",
    )
    invent_prompt = get_inventory_generator_prompt(
        business_description="biz",
        inventory_description="desc",
        inventory_features="",
        shared_entities="",
        prefilled_module_sdf="{}",
        default_answers="{}",
        change_instructions="",
    )

    assert sentinel in hr_prompt
    assert sentinel in inv_prompt
    assert sentinel in invent_prompt
