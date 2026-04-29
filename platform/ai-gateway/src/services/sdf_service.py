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
from typing import Optional, Dict, Any, Callable, List
from pydantic import ValidationError

from .gemini_client import GeminiClient
from .multi_agent_service import MultiAgentService

from src.prompts.sdf_generation import (
    get_sdf_prompt,
    get_clarify_prompt,
    get_fix_json_prompt,
    get_edit_prompt,
    get_finalize_prompt,
    get_change_request_reviewer_prompt,
)
from src.schemas.sdf import SystemDefinitionFile
from src.schemas.clarify import ClarificationAnswer
from src.schemas.multi_agent import AnswerIssue, AnswerReview, PipelineResult

from .sdf.filtering import (
    DEFAULT_QUESTION_KEYS,
    DUPLICATE_KEYWORDS,
    filter_duplicate_questions,
    enforce_prefilled_sdf,
)
from .sdf.merge import parse_and_clean_json, merge_edit_patch
from .sdf.normalization import normalize_generator_sdf
from .sdf.inventory_backfill import backfill_inventory_entities_from_prefilled


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
        on_progress: Optional[Callable] = None,
        language: str = "en",
        selected_modules: Optional[List[str]] = None,
        business_answers: Optional[Dict[str, Dict[str, str]]] = None,
        acknowledged_unsupported_features: Optional[List[str]] = None,
    ) -> tuple["SystemDefinitionFile", "PipelineResult"]:
        """
        Generates an SDF using the multi-agent pipeline.

        Returns a tuple of (validated_sdf, pipeline_result) so callers can
        access per-agent step_logs for training data collection.

        Structural guarantees (independent of AI prompt adherence):
        1. Prefilled SDF (from wizard) is deep-merged so wizard choices can
           never be removed by the AI -- only added to.
        2. AI-generated clarification questions that duplicate default wizard
           topics are filtered out programmatically.
        """
        print("[SDFService] Generating SDF using multi-agent pipeline...")

        # Normalize selected_modules -> a clean set of lowercase strings (or empty = no clamp)
        normalized_selected: List[str] = []
        if selected_modules:
            seen = set()
            for m in selected_modules:
                if not isinstance(m, str):
                    continue
                key = m.strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    normalized_selected.append(key)

        result: PipelineResult = await self.multi_agent_service.generate_sdf(
            business_description=business_description,
            default_question_answers=default_question_answers,
            prefilled_sdf=prefilled_sdf,
            on_progress=on_progress,
            language=language,
            selected_modules=normalized_selected,
            business_answers=business_answers,
            acknowledged_unsupported_features=acknowledged_unsupported_features,
        )

        if not result.success:
            error_msg = "; ".join(result.errors) if result.errors else "Unknown error"
            raise ValueError(f"Multi-agent pipeline failed: {error_msg}")

        # Answer-review halt: reviewer flagged blocking issues OR unack'd unsupported
        # features. Return a shell SDF that carries the review payload through.
        if not result.sdf and result.halted_reason == "answer_review" and result.answer_review:
            print(
                f"[SDFService] Pipeline halted at reviewer — "
                f"{len(result.answer_review.issues)} issue(s)"
            )
            shell_data: Dict[str, Any] = {
                "project_name": "CustomERP Project",
                "entities": [],
                "sdf_complete": False,
                "token_usage": result.token_usage or {},
                "answer_review": result.answer_review.model_dump(exclude_none=True),
                "halted_reason": "answer_review",
            }
            validated_sdf = SystemDefinitionFile.model_validate(shell_data)
            return validated_sdf, result

        # Clarification-only result: distributor needs more info before generators run
        if not result.sdf and result.clarifications_needed:
            print(f"[SDFService] Pipeline stopped early — {len(result.clarifications_needed)} clarification(s) needed")
            raw_questions = [
                q.model_dump(exclude_none=True) for q in result.clarifications_needed
            ]
            filtered_questions = self._filter_duplicate_questions(raw_questions, default_question_answers)
            shell_data: Dict[str, Any] = {
                "project_name": result.distributor_output.project_name if result.distributor_output else "CustomERP Project",
                "entities": [],
                "clarifications_needed": filtered_questions,
                "sdf_complete": False,
                "token_usage": result.token_usage or {},
            }
            if result.unsupported_features:
                shell_data["unsupported_features"] = result.unsupported_features
            validated_sdf = SystemDefinitionFile.model_validate(shell_data)
            return validated_sdf, result

        if not result.sdf:
            raise ValueError("Multi-agent pipeline produced no SDF output")

        if on_progress:
            on_progress("normalizing", 85, "Validating & normalizing your ERP")
        data = self._normalize_generator_sdf(result.sdf, request_text=business_description)

        # Restore inventory pack entities (PO/GRN/cycle count, etc.) if the generator
        # dropped them while leaving module_config packs enabled — required for assembler.
        if prefilled_sdf:
            data = backfill_inventory_entities_from_prefilled(data, prefilled_sdf)

        # STRUCTURAL GUARANTEE 1: Enforce prefilled SDF
        # In change mode the pipeline's changed/unchanged module logic already
        # carries forward untouched modules.  Enforcing here would re-add
        # entities the user explicitly asked to remove.
        is_change_request = "--- CHANGE REQUEST ---" in (business_description or "")
        if prefilled_sdf and not is_change_request:
            data = self._enforce_prefilled_sdf(data, prefilled_sdf)

        # Inject aggregated clarifications from pipeline into normalized SDF
        if result.clarifications_needed:
            raw_questions = [
                q.model_dump(exclude_none=True) for q in result.clarifications_needed
            ]
            filtered_questions = self._filter_duplicate_questions(raw_questions, default_question_answers)
            data["clarifications_needed"] = filtered_questions
            print(f"[SDFService] Injected {len(filtered_questions)} clarification questions into SDF (from {len(raw_questions)} raw)")

        # Inject unsupported_features from distributor
        if result.unsupported_features:
            data["unsupported_features"] = list(result.unsupported_features)

        # Inject pipeline metadata
        data["sdf_complete"] = result.sdf_complete
        if result.token_usage:
            data["token_usage"] = result.token_usage

        # Final safety net: drop any modules or entities outside the user-selected
        # allowlist even if the orchestration clamp missed them or the LLM snuck
        # them past downstream agents. "shared" module entries are always allowed.
        if normalized_selected:
            allowed = set(normalized_selected) | {"shared"}
            modules_block = data.get("modules")
            dropped_module_keys: List[str] = []
            if isinstance(modules_block, dict):
                for key in list(modules_block.keys()):
                    if not isinstance(key, str):
                        continue
                    if key.lower() not in allowed:
                        dropped_module_keys.append(key)
                        modules_block.pop(key, None)

            entities = data.get("entities")
            dropped_entity_names: set[str] = set()
            if isinstance(entities, list):
                kept_entities = []
                for ent in entities:
                    if not isinstance(ent, dict):
                        kept_entities.append(ent)
                        continue
                    mod_val = ent.get("module")
                    mod_key = mod_val.strip().lower() if isinstance(mod_val, str) else None
                    if mod_key is not None and mod_key not in allowed:
                        name = ent.get("name") or ent.get("slug") or ent.get("display_name")
                        if isinstance(name, str) and name:
                            dropped_entity_names.add(name)
                        continue
                    kept_entities.append(ent)

                # Prune dangling `reference_entity` values that pointed at dropped entities.
                if dropped_entity_names:
                    for ent in kept_entities:
                        if not isinstance(ent, dict):
                            continue
                        fields = ent.get("fields")
                        if not isinstance(fields, list):
                            continue
                        for f in fields:
                            if not isinstance(f, dict):
                                continue
                            ref = f.get("reference_entity")
                            if isinstance(ref, str) and ref in dropped_entity_names:
                                f["reference_entity"] = None

                data["entities"] = kept_entities

            if dropped_module_keys or dropped_entity_names:
                print(
                    "[SDFService] Postfilter dropped "
                    f"modules={dropped_module_keys} entities={sorted(dropped_entity_names)} "
                    f"(not in selected_modules={sorted(normalized_selected)})"
                )

            # Plan D follow-up #8: union the orchestration clamp's drops
            # with anything we caught here in the postfilter, so the audit
            # trail is complete regardless of which guardrail tripped.
            audit_seen: set[str] = set()
            audit_drops: List[str] = []
            for src in (
                list(getattr(result, "inferred_dropped_modules", []) or []),
                [k.lower() for k in dropped_module_keys if isinstance(k, str)],
            ):
                for slug in src:
                    if slug and slug not in audit_seen:
                        audit_seen.add(slug)
                        audit_drops.append(slug)
            if audit_drops:
                # Refresh the pipeline result so callers downstream of the
                # tuple-return path also see the union.
                try:
                    result.inferred_dropped_modules = audit_drops
                except Exception:
                    pass
                data["inferred_dropped_modules"] = audit_drops

        if on_progress:
            on_progress("validating", 95, "Finalizing your ERP")
        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Multi-agent SDF validation successful.")
            return validated_sdf, result
        except ValidationError as e:
            print(f"[SDFService] Multi-agent SDF Validation Error: {e}")
            print(f"[SDFService] Raw Data:\n{data}")
            raise ValueError(f"Multi-agent pipeline output did not match the required SDF schema: {e}") from e

    async def generate_sdf_from_description(self, business_description: str, language: str = "en") -> SystemDefinitionFile:
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
        prompt = get_sdf_prompt(business_description, language=language)

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
        answers: list[ClarificationAnswer],
        language: str = "en",
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
            answers=answers_formatted,
            language=language,
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
        answers: list[ClarificationAnswer],
        language: str = "en",
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
            answers=answers_formatted,
            language=language,
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
        instructions: str,
        language: str = "en",
    ) -> SystemDefinitionFile:
        """Apply a change request to an existing generator SDF."""
        validated_sdf, _, _ = await self.edit_sdf_with_telemetry(
            business_description=business_description,
            current_sdf=current_sdf,
            instructions=instructions,
            language=language,
        )
        return validated_sdf

    def _summarize_sdf_for_review(self, current_sdf: SystemDefinitionFile) -> str:
        data = current_sdf.model_dump(exclude_none=True)
        modules = sorted((data.get("modules") or {}).keys())
        entities = []
        for ent in data.get("entities") or []:
            if not isinstance(ent, dict):
                continue
            fields = [
                str(f.get("name"))
                for f in (ent.get("fields") or [])
                if isinstance(f, dict) and f.get("name")
            ]
            entities.append({
                "slug": ent.get("slug"),
                "display_name": ent.get("display_name"),
                "module": ent.get("module"),
                "fields": fields[:20],
            })
        return json.dumps({"modules": modules, "entities": entities}, ensure_ascii=False, indent=2)

    async def review_change_request(
        self,
        business_description: str,
        current_sdf: SystemDefinitionFile,
        instructions: str,
        acknowledged_unsupported_features: Optional[List[str]] = None,
        language: str = "en",
    ) -> tuple[AnswerReview, Any, str]:
        """Review a change request before attempting an SDF edit."""
        ack_set = {
            f.strip().lower()
            for f in (acknowledged_unsupported_features or [])
            if isinstance(f, str) and f.strip()
        }
        prompt = get_change_request_reviewer_prompt(
            business_description=business_description or "",
            current_sdf_summary=self._summarize_sdf_for_review(current_sdf),
            instructions=instructions or "",
            acknowledged_unsupported_features=acknowledged_unsupported_features or [],
            language=language,
        )
        result = await self.multi_agent_service.reviewer_client.generate_with_retry(
            prompt,
            temperature=self.multi_agent_service.reviewer_client.get_temperature(),
            response_schema=AnswerReview,
        )
        data = await self.multi_agent_service._parse_json_with_repair(result.text, "change_request_reviewer")

        parsed_issues: List[AnswerIssue] = []
        for raw in data.get("issues", []) or []:
            if not isinstance(raw, dict):
                continue
            try:
                issue = AnswerIssue(**{**raw, "question_id": raw.get("question_id") or None})
            except Exception as e:
                print(f"[SDFService] Skipping malformed change reviewer issue {raw}: {e}")
                continue
            if (
                issue.kind == "unsupported_feature"
                and issue.related_feature
                and issue.related_feature.strip().lower() in ack_set
            ):
                continue
            parsed_issues.append(issue)

        review = AnswerReview(
            is_clear_to_proceed=bool(data.get("is_clear_to_proceed", True)) and not any(
                iss.severity == "block" for iss in parsed_issues
            ),
            issues=parsed_issues,
            summary=str(data.get("summary", "") or ""),
        )
        return review, result, prompt

    async def edit_sdf_with_telemetry(
        self,
        business_description: str,
        current_sdf: SystemDefinitionFile,
        instructions: str,
        language: str = "en",
    ):
        """Apply a change request and return SDF plus telemetry for training logs."""
        print("[SDFService] Editing SDF with user instructions...")

        current_json = current_sdf.model_dump_json(indent=2)
        prompt = get_edit_prompt(
            business_description=business_description or "",
            current_sdf=current_json,
            instructions=instructions,
            language=language,
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
            return validated_sdf, json_response, prompt
        except ValidationError as e:
            print(f"[SDFService] Edited SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e
