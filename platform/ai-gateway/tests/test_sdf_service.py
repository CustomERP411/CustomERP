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
        "schema_name": "Electronics Shop Inventory",
        "entities": [
            {
                "slug": "products",
                "display_name": "Product",
                "description": "Represents an item in the inventory.",
                "fields": [
                    {
                        "name": "id",
                        "type": "uuid",
                        "required": True,
                        "description": "Unique identifier for the product.",
                        "is_primary_key": True
                    },
                    {
                        "name": "name",
                        "type": "string",
                        "required": True,
                        "description": "The name of the product."
                    }
                ]
            }
        ],
        "relations": []
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
    assert result.schema_name == "Electronics Shop Inventory"
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
                "display_name": "Product",
                "description": "Represents an item in the inventory.",
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
