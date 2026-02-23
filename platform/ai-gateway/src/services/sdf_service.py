"""
Service for generating and validating the System Definition File (SDF)
"""

import json
from pydantic import ValidationError

from .gemini_client import GeminiClient
import json

from src.prompts.sdf_generation import get_sdf_prompt, get_clarify_prompt, get_fix_json_prompt, get_edit_prompt, get_finalize_prompt
from src.schemas.sdf import SystemDefinitionFile
from src.schemas.clarify import ClarificationAnswer
import re

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

    def _merge_edit_patch(self, base_sdf: SystemDefinitionFile, patch: dict) -> dict:
        """
        Merge a potentially-partial AI edit output onto the current SDF.

        This is intentionally conservative:
        - If patch omits an entity or omits entity.fields, we keep the base.
        - If patch includes entity.fields, we treat it as a field patch (merge by field name),
          so missing properties like type/required get inherited from base when possible.
        """
        if not isinstance(patch, dict):
            return base_sdf.model_dump(exclude_none=True)

        base = base_sdf.model_dump(exclude_none=True)
        out = dict(base)

        if isinstance(patch.get("project_name"), str) and patch.get("project_name").strip():
            out["project_name"] = patch["project_name"]

        if isinstance(patch.get("modules"), dict):
            out["modules"] = patch["modules"]

        if "clarifications_needed" in patch:
            out["clarifications_needed"] = patch.get("clarifications_needed")
        if "warnings" in patch:
            out["warnings"] = patch.get("warnings")

        base_entities_list = base.get("entities") if isinstance(base.get("entities"), list) else []
        patch_entities_list = patch.get("entities") if isinstance(patch.get("entities"), list) else []

        base_by_slug = {
            str(e.get("slug")): e
            for e in base_entities_list
            if isinstance(e, dict) and isinstance(e.get("slug"), str) and e.get("slug")
        }

        # Keep base order, append new entities at the end
        base_order = [str(e.get("slug")) for e in base_entities_list if isinstance(e, dict) and e.get("slug")]
        new_slugs: list[str] = []

        merged_by_slug = dict(base_by_slug)

        for pe in patch_entities_list:
            if not isinstance(pe, dict):
                continue
            slug = pe.get("slug")
            if not isinstance(slug, str) or not slug.strip():
                continue
            slug = slug.strip()

            # Explicit remove marker: delete this entity from the SDF.
            if pe.get("remove") is True or pe.get("delete") is True or pe.get("_delete") is True:
                merged_by_slug.pop(slug, None)
                continue

            be = base_by_slug.get(slug, {})
            merged_entity = dict(be)
            merged_entity.update(pe)

            # Fields merge
            be_fields = be.get("fields") if isinstance(be, dict) and isinstance(be.get("fields"), list) else []
            pe_fields = pe.get("fields") if isinstance(pe.get("fields"), list) else None

            if pe_fields is None:
                merged_entity["fields"] = be_fields
            else:
                be_field_by_name = {
                    str(f.get("name")): f
                    for f in be_fields
                    if isinstance(f, dict) and isinstance(f.get("name"), str) and f.get("name")
                }
                merged_fields: list[dict] = []
                seen: set[str] = set()
                removed: set[str] = set()

                for pf in pe_fields:
                    if not isinstance(pf, dict):
                        continue
                    fname = pf.get("name")
                    if not isinstance(fname, str) or not fname.strip():
                        continue
                    fname = fname.strip()
                    # Explicit remove marker: delete this field from the entity.
                    if pf.get("remove") is True or pf.get("delete") is True or pf.get("_delete") is True:
                        removed.add(fname)
                        seen.add(fname)
                        continue
                    base_field = be_field_by_name.get(fname, {})
                    mf = dict(base_field)
                    mf.update(pf)
                    merged_fields.append(mf)
                    seen.add(fname)

                # Keep base fields not mentioned in patch
                for fname, bf in be_field_by_name.items():
                    if fname in seen or fname in removed:
                        continue
                    merged_fields.append(bf)

                merged_entity["fields"] = merged_fields

            merged_by_slug[slug] = merged_entity
            if slug not in base_by_slug:
                new_slugs.append(slug)

        # Rebuild entity list in stable order
        ordered_slugs = [s for s in base_order if s in merged_by_slug] + [s for s in new_slugs if s in merged_by_slug]
        out["entities"] = [merged_by_slug[s] for s in ordered_slugs]

        return out

    def _normalize_generator_sdf(self, data: dict, request_text: str = "") -> dict:
        """
        Best-effort normalization so older AI outputs (schema_name/id/references/relations)
        become a generator SDF compatible with SDF_REFERENCE.md.
        """
        if not isinstance(data, dict):
            return data

        # Collect non-blocking warnings to display to the user (platform UI).
        # Note: Pydantic will drop this unless SystemDefinitionFile includes it.
        warnings = data.get("warnings")
        normalized_warnings: list[str] = []
        if isinstance(warnings, list):
            for w in warnings:
                try:
                    ws = str(w).strip()
                except Exception:
                    ws = ""
                if ws:
                    normalized_warnings.append(ws)

        # Best-effort user-request warnings (features outside generator scope)
        req_text = str(request_text or "")
        chatbot_requested = False
        if req_text:
            chatbot_requested = bool(
                re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", req_text, flags=re.IGNORECASE)
            )
            if chatbot_requested:
                normalized_warnings.append(
                    "Chatbot requested: CustomERP currently does not generate an in-app chatbot UI/feature. "
                    "This request will be ignored (you can integrate a chatbot manually after generation)."
                )

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
                    # Do not ask clarifications about out-of-scope features we explicitly ignore (e.g., chatbot).
                    if re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", text, flags=re.IGNORECASE):
                        normalized_warnings.append(
                            "Ignored a clarification question about chatbot because chatbot is not supported by the generator."
                        )
                        continue
                    normalized_questions.append({"id": qid, "question": text, "type": "text"})
                    continue

                if isinstance(q, dict):
                    raw_id = q.get("id") or q.get("question_id") or q.get("questionId") or qid
                    raw_text = q.get("question") or q.get("text") or q.get("question_text") or q.get("questionText") or q.get("prompt") or ""
                    raw_type = q.get("type") or q.get("question_type") or q.get("questionType") or "text"
                    # Filter chatbot clarifications (unsupported)
                    if re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", str(raw_id), flags=re.IGNORECASE) or re.search(
                        r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", str(raw_text), flags=re.IGNORECASE
                    ):
                        normalized_warnings.append(
                            "Ignored a clarification question about chatbot because chatbot is not supported by the generator."
                        )
                        continue
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

        # If chatbot was requested, ensure we don't return any chatbot-related questions (even if they slipped through).
        if chatbot_requested and isinstance(data.get("clarifications_needed"), list):
            before = len(data["clarifications_needed"])
            filtered = []
            for q in data["clarifications_needed"]:
                if not isinstance(q, dict):
                    continue
                qid = str(q.get("id") or "")
                qtext = str(q.get("question") or "")
                if re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", qid, flags=re.IGNORECASE) or re.search(
                    r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", qtext, flags=re.IGNORECASE
                ):
                    continue
                filtered.append(q)
            if len(filtered) != before:
                normalized_warnings.append(
                    "Chatbot is unsupported, so chatbot clarification questions were removed."
                )
            data["clarifications_needed"] = filtered

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

                ent_slug = str(ent.get("slug") or "").strip() or "(unknown-entity)"

                # Defensive: these are defined as dicts in the SDF schema. If the model emits a wrong type,
                # drop it and warn instead of failing validation.
                dict_props = ("ui", "list", "features", "bulk_actions", "inventory_ops", "labels")
                for prop in dict_props:
                    if prop in ent and ent.get(prop) is not None and not isinstance(ent.get(prop), dict):
                        normalized_warnings.append(
                            f"Invalid `{ent_slug}.{prop}` type ({type(ent.get(prop)).__name__}); expected object. "
                            f"It will be ignored."
                        )
                        ent[prop] = None

                # Warn on (currently) unsupported inventory_ops configs that models sometimes invent.
                inv = ent.get("inventory_ops")
                if isinstance(inv, dict):
                    # If the model provided a sell/issue config object but forgot `enabled: true`,
                    # infer intent and enable it. (Issue/Sell defaults to disabled in generator config.)
                    if inv.get("enabled") is True:
                        for issue_key in ("issue", "sell"):
                            cfg = inv.get(issue_key)
                            if isinstance(cfg, dict) and "enabled" not in cfg:
                                cfg["enabled"] = True

                    for op_key in ("receive", "adjust", "transfer", "issue", "sell"):
                        op_cfg = inv.get(op_key)
                        if not isinstance(op_cfg, dict):
                            continue
                        for bad_key in ("target_quantity_field", "source_quantity_field", "product_field", "item_field"):
                            if bad_key in op_cfg:
                                normalized_warnings.append(
                                    f"Unsupported inventory_ops config: `{ent_slug}.inventory_ops.{op_key}.{bad_key}` "
                                    f"is not supported by the generator yet and will be ignored."
                                )

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
                        allowed_types = {
                            "string",
                            "text",
                            "integer",
                            "decimal",
                            "number",
                            "boolean",
                            "date",
                            "datetime",
                            "reference",
                            "uuid",
                        }
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
                            # Models sometimes emit `enum` for selectable fields.
                            # In generator SDF, selectable fields are `type: "string"` + `options: [...]`.
                            "enum": "string",
                            "select": "string",
                            "choice": "string",
                        }
                        mapped = type_map.get(t_norm, t_norm)
                        if mapped != t_norm and t_norm:
                            normalized_warnings.append(
                                f"Normalized field type `{ent_slug}.{str(name)}` from `{t_norm}` to `{mapped}`."
                            )
                        if mapped not in allowed_types:
                            normalized_warnings.append(
                                f"Unsupported field type `{mapped}` for `{ent_slug}.{str(name)}`; defaulting to `string`."
                            )
                            mapped = "string"
                        f["type"] = mapped

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

        # -------------------------------------------------------------------------
        # Scope Guardrails: Whitelist validation for Modules and Features
        # -------------------------------------------------------------------------
        ALLOWED_MODULES = {
            "activity_log",
            "inventory_dashboard",
            "scheduled_reports",
            "inventory",
            "invoice",
            "hr",
        }
        ALLOWED_FEATURES = {"audit_trail", "batch_tracking", "serial_tracking", "multi_location"}

        # 1. Validate Modules
        modules = data.get("modules")
        if isinstance(modules, dict):
            unknown_modules = [k for k in modules.keys() if k not in ALLOWED_MODULES]
            for m in unknown_modules:
                normalized_warnings.append(
                    f"Unsupported module `{m}` detected. It will be ignored. "
                    f"Supported modules: {', '.join(sorted(ALLOWED_MODULES))}."
                )
                # Remove unsupported module to prevent downstream confusion
                del modules[m]

        # 2. Validate Entity Features
        if isinstance(entities, list):
            for ent in entities:
                if not isinstance(ent, dict):
                    continue
                ent_slug = str(ent.get("slug") or "unknown")
                features = ent.get("features")
                if isinstance(features, dict):
                    unknown_features = [k for k in features.keys() if k not in ALLOWED_FEATURES]
                    for f in unknown_features:
                        normalized_warnings.append(
                            f"Unsupported feature `{f}` on entity `{ent_slug}`. It will be ignored. "
                            f"Supported features: {', '.join(sorted(ALLOWED_FEATURES))}."
                        )
                        # Remove unsupported feature
                        del features[f]

        if normalized_warnings:
            # De-duplicate while preserving order
            seen = set()
            out_warnings: list[str] = []
            for w in normalized_warnings:
                if w in seen:
                    continue
                seen.add(w)
                out_warnings.append(w)
            data["warnings"] = out_warnings

        return data
