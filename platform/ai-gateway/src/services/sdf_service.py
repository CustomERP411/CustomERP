"""
Service for generating and validating the System Definition File (SDF)

Supports two generation modes:
1. Legacy single-prompt mode (generate_sdf_from_description)
2. Multi-agent pipeline mode (generate_sdf_multi_agent)

The multi-agent mode uses separate AI agents for:
- Distributor: Routes user input to appropriate modules
- HR Generator: Generates HR-related SDF entities
- Invoice Generator: Generates Invoice-related SDF entities
- Inventory Generator: Generates Inventory-related SDF entities
- Integrator: Combines all module outputs into final SDF
"""

import json
from typing import Optional, Dict, Any
from pydantic import ValidationError

from .gemini_client import GeminiClient
from .multi_agent_service import MultiAgentService

from src.prompts.sdf_generation import get_sdf_prompt, get_clarify_prompt, get_fix_json_prompt, get_edit_prompt, get_finalize_prompt
from src.schemas.sdf import SystemDefinitionFile
from src.schemas.clarify import ClarificationAnswer
from src.schemas.multi_agent import PipelineResult

from .sdf.filtering import (
    DEFAULT_QUESTION_KEYS,
    DUPLICATE_KEYWORDS,
    filter_duplicate_questions,
    enforce_prefilled_sdf,
)
from .sdf.merge import parse_and_clean_json, merge_edit_patch
from .sdf.normalization import normalize_generator_sdf


class SDFService:
    """Orchestrates the generation and validation of the SDF.
    
    Supports both legacy single-prompt generation and the new multi-agent pipeline.
    """

    def __init__(self, gemini_client: GeminiClient, multi_agent_service: Optional[MultiAgentService] = None):
        self.gemini_client = gemini_client
        self._multi_agent_service = multi_agent_service
    
    @property
    def multi_agent_service(self) -> MultiAgentService:
        """Lazy-load the multi-agent service."""
        if self._multi_agent_service is None:
            self._multi_agent_service = MultiAgentService()
        return self._multi_agent_service
    
    _DEFAULT_QUESTION_KEYS = DEFAULT_QUESTION_KEYS
    _DUPLICATE_KEYWORDS = DUPLICATE_KEYWORDS

    def _filter_duplicate_questions(
        self,
        questions: list[dict],
        default_answers: Optional[Dict[str, Any]],
    ) -> list[dict]:
        return filter_duplicate_questions(questions, default_answers)

    def _enforce_prefilled_sdf(self, ai_data: dict, prefilled: Dict[str, Any]) -> dict:
        return enforce_prefilled_sdf(ai_data, prefilled)

    def _parse_and_clean_json(self, json_string: str) -> dict:
        return parse_and_clean_json(json_string)

    def _merge_edit_patch(self, base_sdf: SystemDefinitionFile, patch: dict) -> dict:
        return merge_edit_patch(base_sdf, patch)

    def _normalize_generator_sdf(self, data: dict, request_text: str = "") -> dict:
        return normalize_generator_sdf(data, request_text)

    async def generate_sdf_multi_agent(
        self,
        business_description: str,
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> SystemDefinitionFile:
        """
        Generates an SDF using the multi-agent pipeline.
        
        Structural guarantees (independent of AI prompt adherence):
        1. Prefilled SDF (from wizard) is deep-merged so wizard choices can
           never be removed by the AI -- only added to.
        2. AI-generated clarification questions that duplicate default wizard
           topics are filtered out programmatically.
        """
        print("[SDFService] Generating SDF using multi-agent pipeline...")
        
        result: PipelineResult = await self.multi_agent_service.generate_sdf(
            business_description=business_description,
            default_question_answers=default_question_answers,
            prefilled_sdf=prefilled_sdf,
        )
        
        if not result.success:
            error_msg = "; ".join(result.errors) if result.errors else "Unknown error"
            raise ValueError(f"Multi-agent pipeline failed: {error_msg}")
        
        if not result.sdf:
            raise ValueError("Multi-agent pipeline produced no SDF output")
        
        # Normalize the SDF
        data = self._normalize_generator_sdf(result.sdf, request_text=business_description)
        
        # STRUCTURAL GUARANTEE 1: Enforce prefilled SDF
        # The wizard-built SDF is the ground truth for module configs and entities.
        # The AI can add new things but never remove what the user explicitly chose.
        if prefilled_sdf:
            data = self._enforce_prefilled_sdf(data, prefilled_sdf)
        
        # Inject aggregated clarifications from pipeline into normalized SDF
        if result.clarifications_needed:
            raw_questions = [
                q.model_dump(exclude_none=True) for q in result.clarifications_needed
            ]
            # STRUCTURAL GUARANTEE 2: Filter duplicate questions
            filtered_questions = self._filter_duplicate_questions(raw_questions, default_question_answers)
            data["clarifications_needed"] = filtered_questions
            print(f"[SDFService] Injected {len(filtered_questions)} clarification questions into SDF (from {len(raw_questions)} raw)")
        
        # Inject pipeline metadata
        data["sdf_complete"] = result.sdf_complete
        if result.token_usage:
            data["token_usage"] = result.token_usage
        
        # Validate against schema
        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Multi-agent SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Multi-agent SDF Validation Error: {e}")
            print(f"[SDFService] Raw Data:\n{data}")
            raise ValueError(f"Multi-agent pipeline output did not match the required SDF schema: {e}") from e

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
            data = self._parse_and_clean_json(json_response)
        except json.JSONDecodeError as e:
            print(f"[SDFService] Initial JSON parsing failed: {e}. Attempting self-healing...")
            # Attempt to fix the JSON by re-prompting the AI
            fix_prompt = get_fix_json_prompt(json_response)
            repaired_json_response = await self.gemini_client.generate_with_retry(
                fix_prompt,
                temperature=0.0, # Be deterministic for fixing
                json_mode=True
            )
            print(f"[SDFService] AI response after repair attempt:\n{repaired_json_response}")
            try:
                data = self._parse_and_clean_json(repaired_json_response)
                print("[SDFService] JSON self-healing successful.")
            except json.JSONDecodeError as final_e:
                print(f"[SDFService] Self-healing failed. Final JSON Decode Error: {final_e}")
                raise ValueError("AI returned an invalid JSON format, and self-healing failed.") from final_e

        # 4. Normalize towards generator SDF shape (backwards-compatible)
        data = self._normalize_generator_sdf(data, request_text=business_description)

        # 5. Validate the data against the Pydantic schema
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
            data = self._parse_and_clean_json(json_response)
        except json.JSONDecodeError as e:
            print(f"[SDFService] Clarify JSON parsing failed: {e}. Attempting self-healing...")
            fix_prompt = get_fix_json_prompt(json_response)
            repaired_json_response = await self.gemini_client.generate_with_retry(
                fix_prompt,
                temperature=0.0,
                json_mode=True
            )
            print(f"[SDFService] AI response after repair attempt:\n{repaired_json_response}")
            try:
                data = self._parse_and_clean_json(repaired_json_response)
                print("[SDFService] JSON self-healing successful.")
            except json.JSONDecodeError as final_e:
                print(f"[SDFService] Self-healing failed. Final JSON Decode Error: {final_e}")
                raise ValueError("AI returned an invalid JSON format, and self-healing failed.") from final_e

        # Normalize towards generator SDF shape (backwards-compatible)
        data = self._normalize_generator_sdf(data, request_text=business_description)

        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Refined SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Refined SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e

    async def finalize_sdf(
        self,
        business_description: str,
        partial_sdf: SystemDefinitionFile,
        answers: list[ClarificationAnswer]
    ) -> SystemDefinitionFile:
        """
        Produces a final, clean SDF by merging the partial SDF with user answers.
        Ensures no clarification questions remain.
        """
        print("[SDFService] Finalizing SDF with user answers...")

        # 1. Format the context for the prompt
        partial_sdf_json = partial_sdf.model_dump_json(indent=2)
        answers_formatted = "\n".join([f"- Q: {ans.question_id}\n  A: {ans.answer}" for ans in answers])

        # 2. Get the full prompt
        prompt = get_finalize_prompt(
            business_description=business_description,
            partial_sdf=partial_sdf_json,
            answers=answers_formatted
        )

        # 3. Call the AI to get the JSON response
        json_response = await self.gemini_client.generate_with_retry(
            prompt,
            temperature=0.2,
            json_mode=True
        )

        # 4. Clean, parse, and validate the response
        try:
            data = self._parse_and_clean_json(json_response)
        except json.JSONDecodeError as e:
            print(f"[SDFService] Finalize JSON parsing failed: {e}. Attempting self-healing...")
            fix_prompt = get_fix_json_prompt(json_response)
            repaired_json_response = await self.gemini_client.generate_with_retry(
                fix_prompt,
                temperature=0.0,
                json_mode=True
            )
            try:
                data = self._parse_and_clean_json(repaired_json_response)
                print("[SDFService] JSON self-healing successful.")
            except json.JSONDecodeError as final_e:
                print(f"[SDFService] Self-healing failed. Final JSON Decode Error: {final_e}")
                raise ValueError("AI returned an invalid JSON format, and self-healing failed.") from final_e

        # Normalize towards generator SDF shape
        data = self._normalize_generator_sdf(data, request_text=business_description)

        # Explicitly clear clarifications if the AI failed to do so (guardrail)
        if "clarifications_needed" in data:
            data["clarifications_needed"] = []

        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Final SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Final SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e

    async def edit_sdf(
        self,
        business_description: str,
        current_sdf: SystemDefinitionFile,
        instructions: str
    ) -> SystemDefinitionFile:
        """Apply a change request to an existing generator SDF."""
        print("[SDFService] Editing SDF with user instructions...")

        current_json = current_sdf.model_dump_json(indent=2)
        prompt = get_edit_prompt(
            business_description=business_description or "",
            current_sdf=current_json,
            instructions=instructions
        )

        json_response = await self.gemini_client.generate_with_retry(
            prompt,
            temperature=0.2,
            json_mode=True
        )

        try:
            data = self._parse_and_clean_json(json_response)
        except json.JSONDecodeError as e:
            print(f"[SDFService] Edit JSON parsing failed: {e}. Attempting self-healing...")
            fix_prompt = get_fix_json_prompt(json_response)
            repaired_json_response = await self.gemini_client.generate_with_retry(
                fix_prompt,
                temperature=0.0,
                json_mode=True
            )
            print(f"[SDFService] AI response after repair attempt:\n{repaired_json_response}")
            try:
                data = self._parse_and_clean_json(repaired_json_response)
                print("[SDFService] JSON self-healing successful.")
            except json.JSONDecodeError as final_e:
                print(f"[SDFService] Self-healing failed. Final JSON Decode Error: {final_e}")
                raise ValueError("AI returned an invalid JSON format, and self-healing failed.") from final_e

        data = self._normalize_generator_sdf(data, request_text=(business_description or "") + "\n" + (instructions or ""))
        # Some model outputs only include the changed parts (partial SDF).
        # Merge onto the current SDF to produce a complete generator SDF.
        data = self._merge_edit_patch(current_sdf, data)
        data = self._normalize_generator_sdf(data, request_text=(business_description or "") + "\n" + (instructions or ""))
        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Edited SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Edited SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e
