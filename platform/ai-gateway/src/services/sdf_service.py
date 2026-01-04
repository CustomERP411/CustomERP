"""
Service for generating and validating the System Definition File (SDF)
"""

import json
from pydantic import ValidationError

from .gemini_client import GeminiClient
import json

from src.prompts.sdf_generation import get_sdf_prompt, get_clarify_prompt, get_fix_json_prompt, get_edit_prompt
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
        data = self._normalize_generator_sdf(data)

        # 5. Validate the data against the Pydantic schema
        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e

    def _parse_and_clean_json(self, json_string: str) -> dict:
        """Finds and parses a JSON object from a string, stripping markdown."""
        # Find the start and end of the JSON object to handle markdown fences
        start = json_string.find('{')
        end = json_string.rfind('}')
        if start == -1 or end == -1:
            raise json.JSONDecodeError("Could not find JSON object in response", json_string, 0)
        
        cleaned_json = json_string[start:end+1]
        return json.loads(cleaned_json)

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
        data = self._normalize_generator_sdf(data)

        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Refined SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Refined SDF Validation Error: {e}")
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

        data = self._normalize_generator_sdf(data)
        try:
            validated_sdf = SystemDefinitionFile.model_validate(data)
            print("[SDFService] Edited SDF validation successful.")
            return validated_sdf
        except ValidationError as e:
            print(f"[SDFService] Edited SDF Validation Error: {e}")
            print(f"[SDFService] Raw AI Data:\n{data}")
            raise ValueError(f"AI response did not match the required SDF schema: {e}") from e

    def _normalize_generator_sdf(self, data: dict) -> dict:
        """
        Best-effort normalization so older AI outputs (schema_name/id/references/relations)
        become a generator SDF compatible with SDF_REFERENCE.md.
        """
        if not isinstance(data, dict):
            return data

        # Normalize clarifications_needed:
        # Some model outputs accidentally return a list of strings instead of question objects.
        # Convert strings (and partial dicts) into the required {id, question, type, options?} shape.
        cl = data.get("clarifications_needed")
        if isinstance(cl, list):
            normalized_questions = []
            for idx, q in enumerate(cl):
                qid = f"q{idx + 1}"
                if isinstance(q, str):
                    text = q.strip()
                    if not text:
                        continue
                    normalized_questions.append({"id": qid, "question": text, "type": "text"})
                    continue

                if isinstance(q, dict):
                    raw_id = q.get("id") or q.get("question_id") or q.get("questionId") or qid
                    raw_text = q.get("question") or q.get("text") or q.get("question_text") or q.get("questionText") or q.get("prompt") or ""
                    raw_type = q.get("type") or q.get("question_type") or q.get("questionType") or "text"
                    qtype = str(raw_type).strip()
                    if qtype not in ("yes_no", "choice", "text"):
                        qtype = "text"
                    out = {"id": str(raw_id), "question": str(raw_text), "type": qtype}
                    opts = q.get("options")
                    if isinstance(opts, list) and opts:
                        out["options"] = [str(o) for o in opts]
                    if out["question"].strip():
                        normalized_questions.append(out)
                    continue

                # Unknown type -> ignore
                continue

            data["clarifications_needed"] = normalized_questions

        # Old -> new: schema_name => project_name
        if "project_name" not in data and "schema_name" in data and isinstance(data.get("schema_name"), str):
            data["project_name"] = data.get("schema_name")
        # Drop old top-level keys so the returned JSON matches generator SDF shape
        data.pop("schema_name", None)
        data.pop("schemaName", None)

        entities = data.get("entities")
        if isinstance(entities, list):
            for ent in entities:
                if not isinstance(ent, dict):
                    continue

                fields = ent.get("fields")
                if not isinstance(fields, list):
                    continue

                normalized_fields = []
                for f in fields:
                    if not isinstance(f, dict):
                        continue

                    name = f.get("name")
                    if name in ("id", "created_at", "updated_at"):
                        # system-managed in generator, drop it
                        continue

                    # Old key `references` -> generator key `reference_entity`
                    if "reference_entity" not in f and "references" in f and isinstance(f.get("references"), str):
                        f["reference_entity"] = f.get("references")

                    # Normalize common type variants to generator types
                    t = f.get("type")
                    if isinstance(t, str):
                        t_norm = t.strip().lower()
                        type_map = {
                            "uuid": "string",
                            "guid": "string",
                            "int": "integer",
                            "int32": "integer",
                            "int64": "integer",
                            "float": "decimal",
                            "double": "decimal",
                            "money": "decimal",
                            "numeric": "decimal",
                            "bool": "boolean",
                            "timestamp": "datetime",
                            "date_time": "datetime",
                        }
                        f["type"] = type_map.get(t_norm, t_norm)

                    # If reference_entity is present, force type=reference
                    if isinstance(f.get("reference_entity"), str) and f.get("reference_entity").strip():
                        f["type"] = "reference"

                    # Old schema flags are ignored by pydantic (extra=allow), but keep output clean
                    f.pop("is_primary_key", None)
                    f.pop("is_foreign_key", None)

                    normalized_fields.append(f)

                ent["fields"] = normalized_fields

        # Old top-level relations list is not used by generator; keep but it will be ignored downstream.
        # Prefer to drop it so callers get a clean generator SDF.
        data.pop("relations", None)
        return data
