
import asyncio
from src.schemas.sdf import SystemDefinitionFile, ClarificationQuestion, Entity, EntityField
from src.schemas.clarify import ClarificationAnswer, ClarifyRequest
from src.main import finalize_sdf_endpoint
from src.services.sdf_service import SDFService
from src.services.gemini_client import GeminiClient

# Mock Gemini Client to avoid real API calls
class MockGeminiClient(GeminiClient):
    def __init__(self):
        pass
    
    async def generate_with_retry(self, prompt, temperature, json_mode):
        # Return a dummy response simulating AI merging answers
        return """
        {
            "project_name": "Finalized Project",
            "entities": [
                {
                    "slug": "test_entity",
                    "fields": [
                        {"name": "name", "type": "string"}
                    ]
                }
            ],
            "clarifications_needed": [] 
        }
        """
    
    @classmethod
    def get_instance(cls):
        return cls()

# Mock get_sdf_service
def mock_get_sdf_service():
    return SDFService(MockGeminiClient())

async def test_finalize():
    # Scenario 1: Finalize with ClarifyRequest (answers provided)
    partial_sdf = SystemDefinitionFile(
        project_name="Test Project",
        entities=[],
        clarifications_needed=[
            ClarificationQuestion(id="q1", question="Is this a test?", type="yes_no")
        ]
    )
    
    answers = [
        ClarificationAnswer(question_id="q1", answer="yes")
    ]
    
    request = ClarifyRequest(
        business_description="A test project",
        partial_sdf=partial_sdf,
        answers=answers
    )
    
    print("Testing finalize_sdf_endpoint with ClarifyRequest...")
    # In the current implementation, this just returns payload.partial_sdf
    result = await finalize_sdf_endpoint(request)
    print(f"Result type: {type(result)}")
    print(f"Result project_name: {result.project_name}")
    print(f"Clarifications needed (should be empty if finalized): {result.clarifications_needed}")

if __name__ == "__main__":
    asyncio.run(test_finalize())
