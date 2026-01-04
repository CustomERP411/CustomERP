"""
Service for generating and validating the System Definition File (SDF)
"""

import json
from pydantic import ValidationError

from .gemini_client import GeminiClient
import json

from src.prompts.sdf_generation import get_sdf_prompt, get_clarify_prompt
from src.schemas.sdf import SystemDefinitionFile
from src.schemas.clarify import ClarificationAnswer

class SDFService:
    """Orchestrates the generation and validation of the SDF"""

    def __init__(self, gemini_client: GeminiClient):
        self.gemini_client = gemini_client

    async def generate_sdf_from_description(self, business_description: str) -> SystemDefinitionFile:
        """
        Generates, validates, and returns a SystemDefinitionFile from a business description.

        Args:
            business_description: The user's natural language input.

        Returns:
            A validated SystemDefinitionFile object.

        Raises:
            ValueError: If the AI response is not valid JSON or does not match the SDF schema.
        """
        print("[SDFService] Generating SDF for business description...")

        # 1. Get the full prompt
        prompt = get_sdf_prompt(business_description)

        # 2. Call the AI to get the JSON response
        json_response = await self.gemini_client.generate_with_retry(
            prompt,
            temperature=0.2,
            json_mode=True
        )

        # Log the raw response for debugging
        print("="*20 + " RAW AI RESPONSE " + "="*20)
        print(json_response)
        print("="*57)

        # 3. Clean and parse the JSON response
        try:
            start = json_response.find('{')
            end = json_response.rfind('}')
            if start == -1 or end == -1:
                raise json.JSONDecodeError("Could not find JSON object in response", json_response, 0)
            
            cleaned_json = json_response[start:end+1]
            data = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            print(f"[SDFService] JSON Decode Error: {e}")
            print(f"[SDFService] Raw AI Response:\n{json_response}")
            raise ValueError("AI returned an invalid JSON format.") from e

        # 4. Validate the data against the Pydantic schema
        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e

    async def clarify_sdf(
        self, 
        business_description: str, 
        partial_sdf: SystemDefinitionFile, 
        answers: list[ClarificationAnswer]
    ) -> SystemDefinitionFile:
        """Refines an SDF based on user answers to clarification questions."""
        print("[SDFService] Refining SDF with user answers...")

        # 1. Format the context for the prompt
        partial_sdf_json = partial_sdf.model_dump_json(indent=2)
        answers_formatted = "\n".join([f"- Q: {ans.question_id}\n  A: {ans.answer}" for ans in answers])

        # 2. Get the full prompt
        prompt = get_clarify_prompt(
            business_description=business_description,
            partial_sdf=partial_sdf_json,
            answers=answers_formatted
        )

        # 3. Call the AI to get the refined JSON response
        json_response = await self.gemini_client.generate_with_retry(
            prompt,
            temperature=0.2,
            json_mode=True
        )

        # 4. Clean, parse, and validate the response (reusing the same logic)
        try:
            start = json_response.find('{')
            end = json_response.rfind('}')
            if start == -1 or end == -1:
                raise json.JSONDecodeError("Could not find JSON object in response", json_response, 0)
            
            cleaned_json = json_response[start:end+1]
            data = json.loads(cleaned_json)
        except json.JSONDecodeError as e:
            print(f"[SDFService] JSON Decode Error: {e}")
            print(f"[SDFService] Raw AI Response:\n{json_response}")
            raise ValueError("AI returned an invalid JSON format.") from e

        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Refined SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Refined SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e
