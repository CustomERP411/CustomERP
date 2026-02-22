
import pytest
from unittest.mock import MagicMock, AsyncMock
from src.services.sdf_service import SDFService
from src.schemas.sdf import SystemDefinitionFile, ClarificationQuestion
from src.schemas.clarify import ClarificationAnswer

# Mark all tests in this file as asyncio
pytestmark = pytest.mark.asyncio

@pytest.fixture
def mock_gemini_client():
    client = MagicMock()
    client.generate_with_retry = AsyncMock()
    return client

@pytest.fixture
def sdf_service(mock_gemini_client):
    return SDFService(gemini_client=mock_gemini_client)

async def test_finalize_sdf_merges_answers(sdf_service, mock_gemini_client):
    # Arrange
    business_description = "A simple inventory system."
    partial_sdf = SystemDefinitionFile(
        project_name="Test Project",
        entities=[],
        clarifications_needed=[
            ClarificationQuestion(id="q1", question="Track serials?", type="yes_no")
        ]
    )
    answers = [ClarificationAnswer(question_id="q1", answer="yes")]

    # Mock AI response (finalized SDF)
    final_sdf_json = """
    {
        "project_name": "Test Project",
        "modules": {},
        "entities": [
            {
                "slug": "items", 
                "fields": [
                    {"name": "serial", "type": "string"}
                ],
                "features": {"serial_tracking": true}
            }
        ],
        "clarifications_needed": []
    }
    """
    mock_gemini_client.generate_with_retry.return_value = final_sdf_json

    # Act
    result = await sdf_service.finalize_sdf(business_description, partial_sdf, answers)

    # Assert
    assert isinstance(result, SystemDefinitionFile)
    assert result.project_name == "Test Project"
    assert result.clarifications_needed == []
    # Check if features were applied (simulating AI using the answer)
    assert result.entities[0].features['serial_tracking'] is True

async def test_finalize_sdf_clears_clarifications_if_ai_forgets(sdf_service, mock_gemini_client):
    # Arrange
    business_description = "A simple inventory system."
    partial_sdf = SystemDefinitionFile(
        project_name="Test Project", 
        entities=[],
        clarifications_needed=[ClarificationQuestion(id="q1", question="?", type="text")]
    )
    answers = [ClarificationAnswer(question_id="q1", answer="answer")]

    # Mock AI response that ACCIDENTALLY includes clarifications
    bad_final_sdf_json = """
    {
        "project_name": "Test Project",
        "entities": [],
        "clarifications_needed": [{"id": "q2", "question": "New question?", "type": "text"}]
    }
    """
    mock_gemini_client.generate_with_retry.return_value = bad_final_sdf_json

    # Act
    result = await sdf_service.finalize_sdf(business_description, partial_sdf, answers)

    # Assert
    # The service should forcefully clear clarifications_needed
    assert result.clarifications_needed == []

async def test_finalize_sdf_handles_invalid_json_and_repairs(sdf_service, mock_gemini_client):
    # Arrange
    business_description = "Test."
    partial_sdf = SystemDefinitionFile(project_name="Test", entities=[])
    answers = []

    # First call returns bad JSON, second call (repair) returns good JSON
    mock_gemini_client.generate_with_retry.side_effect = [
        "INVALID JSON {", 
        """
        {
            "project_name": "Repaired Project",
            "entities": []
        }
        """
    ]

    # Act
    result = await sdf_service.finalize_sdf(business_description, partial_sdf, answers)

    # Assert
    assert result.project_name == "Repaired Project"
    # Verify generate_with_retry was called twice (initial + fix)
    assert mock_gemini_client.generate_with_retry.call_count == 2
