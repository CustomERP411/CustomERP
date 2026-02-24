"""
Unit tests for the SDFService
"""

import pytest
import json
from unittest.mock import MagicMock

from src.services.sdf_service import SDFService
from src.schemas.sdf import SystemDefinitionFile

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
