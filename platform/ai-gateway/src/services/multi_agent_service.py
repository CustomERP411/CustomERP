"""
Multi-Agent SDF Generation Service

Orchestrates the multi-agent pipeline for SDF generation:
1. Distributor  - Routes user input to appropriate modules
2. Module Generators (HR, Invoice, Inventory) - Generate partial SDFs
3. Integrator   - Combines partial SDFs into final SDF

Each agent can use a different provider / model / configuration,
enabling per-domain fine-tuning in the future.
"""

import json
import asyncio
import re
import time
from typing import Optional, Dict, Any, List

from src.config import settings
from src.services.base_client import BaseAIClient, GenerationResult
from src.services.gemini_client import GeminiClient
from src.services.azure_client import AzureOpenAIClient
from src.schemas.multi_agent import (
    AgentStepLog,
    ClarificationQuestion,
    DistributorOutput,
    IntegratorOutput,
    ModuleContext,
    ModuleGeneratorOutput,
    PipelineResult,
)
from src.prompts.sdf_generation import (
    get_distributor_prompt,
    get_hr_generator_prompt,
    get_invoice_generator_prompt,
    get_inventory_generator_prompt,
    get_integrator_prompt,
    get_fix_json_prompt,
)

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


class MultiAgentService:
    """Orchestrates the multi-agent SDF generation pipeline."""

    def __init__(
        self,
        distributor_client: Optional[BaseAIClient] = None,
        hr_client: Optional[BaseAIClient] = None,
        invoice_client: Optional[BaseAIClient] = None,
        inventory_client: Optional[BaseAIClient] = None,
        integrator_client: Optional[BaseAIClient] = None,
    ):
        self.distributor_client = distributor_client or self._create_client("distributor")
        self.hr_client = hr_client or self._create_client("hr")
        self.invoice_client = invoice_client or self._create_client("invoice")
        self.inventory_client = inventory_client or self._create_client("inventory")
        self.integrator_client = integrator_client or self._create_client("integrator")

    # ── client factory ──────────────────────────────────────────

    @staticmethod
    def _create_client(agent_name: str) -> BaseAIClient:
        """Create the right AI client based on the agent's configured provider."""
        config = settings.get_agent_config(agent_name)
        if config.provider == "azure_openai":
            try:
                return AzureOpenAIClient(agent_config=config)
            except Exception as e:
                print(f"[MultiAgentService] Azure client init failed for {agent_name}: {e}")
                if settings.GOOGLE_AI_API_KEY:
                    print(f"[MultiAgentService] Falling back to Gemini for {agent_name}")
                    config.provider = "gemini"
                    return GeminiClient(agent_config=config)
                raise
        return GeminiClient(agent_config=config)

    # ── token helpers ───────────────────────────────────────────

    @staticmethod
    def _empty_token_usage() -> Dict[str, Any]:
        return {
            "distributor": {"prompt": 0, "completion": 0, "total": 0},
            "hr": {"prompt": 0, "completion": 0, "total": 0},
            "invoice": {"prompt": 0, "completion": 0, "total": 0},
            "inventory": {"prompt": 0, "completion": 0, "total": 0},
            "integrator": {"prompt": 0, "completion": 0, "total": 0},
            "json_repair": {"prompt": 0, "completion": 0, "total": 0},
            "total": {"prompt": 0, "completion": 0, "total": 0},
        }

    @staticmethod
    def _add_tokens(usage: Dict[str, Any], agent: str, result: GenerationResult) -> None:
        bucket = usage.setdefault(agent, {"prompt": 0, "completion": 0, "total": 0})
        bucket["prompt"] += result.prompt_tokens
        bucket["completion"] += result.completion_tokens
        bucket["total"] += result.total_tokens
        total = usage["total"]
        total["prompt"] += result.prompt_tokens
        total["completion"] += result.completion_tokens
        total["total"] += result.total_tokens

    # ── step-log helper ────────────────────────────────────────

    def _build_step_log(
        self,
        agent_name: str,
        client: BaseAIClient,
        input_summary: Dict[str, Any],
        output_parsed: Dict[str, Any],
        result: GenerationResult,
        duration_ms: int,
    ) -> AgentStepLog:
        config = settings.get_agent_config(agent_name)
        return AgentStepLog(
            agent=agent_name,
            model=config.model,
            temperature=config.temperature,
            input_summary=input_summary,
            output_parsed=output_parsed,
            raw_response=result.text[:5000],
            tokens_in=result.prompt_tokens,
            tokens_out=result.completion_tokens,
            duration_ms=duration_ms,
        )

    # ── main pipeline ───────────────────────────────────────────

    async def generate_sdf(
        self,
        business_description: str,
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> PipelineResult:
        errors: List[str] = []
        warnings: List[str] = []
        token_usage = self._empty_token_usage()
        step_logs: List[AgentStepLog] = []

        # Step 1: Distributor
        print("[MultiAgentService] Step 1: Running distributor...")
        t0 = time.monotonic()
        try:
            distributor_output, dist_tokens = await self._run_distributor(
                business_description,
                default_question_answers or {},
                prefilled_sdf or {},
            )
            dist_ms = int((time.monotonic() - t0) * 1000)
            self._add_tokens(token_usage, "distributor", dist_tokens)
            warnings.extend(distributor_output.warnings)
            step_logs.append(self._build_step_log(
                "distributor", self.distributor_client,
                {"business_description": business_description[:500]},
                distributor_output.model_dump(exclude_none=True),
                dist_tokens, dist_ms,
            ))
        except Exception as e:
            print(f"[MultiAgentService] Distributor failed: {e}")
            return PipelineResult(
                success=False,
                errors=[f"Distributor agent failed: {str(e)}"],
                token_usage=token_usage,
                step_logs=step_logs,
            )

        print(f"[MultiAgentService] Modules needed: {distributor_output.modules_needed}")

        # Step 2: Module generators (parallel)
        print("[MultiAgentService] Step 2: Running module generators...")
        module_outputs: Dict[str, ModuleGeneratorOutput] = {}
        generator_tasks = []

        answers = default_question_answers or {}
        pre_sdf = prefilled_sdf or {}
        if "hr" in distributor_output.modules_needed:
            generator_tasks.append(("hr", self._run_hr_generator(
                business_description, distributor_output.hr_context, distributor_output.shared_entities, answers, pre_sdf,
            )))
        if "invoice" in distributor_output.modules_needed:
            generator_tasks.append(("invoice", self._run_invoice_generator(
                business_description, distributor_output.invoice_context, distributor_output.shared_entities, answers, pre_sdf,
            )))
        if "inventory" in distributor_output.modules_needed:
            generator_tasks.append(("inventory", self._run_inventory_generator(
                business_description, distributor_output.inventory_context, distributor_output.shared_entities, answers, pre_sdf,
            )))

        if generator_tasks:
            coros = [t[1] for t in generator_tasks]
            names = [t[0] for t in generator_tasks]
            gen_start = time.monotonic()
            results = await asyncio.gather(*coros, return_exceptions=True)
            gen_elapsed_ms = int((time.monotonic() - gen_start) * 1000)

            for name, result in zip(names, results):
                if isinstance(result, Exception):
                    errors.append(f"Module generator ({name}) failed: {str(result)}")
                else:
                    output, gen_tokens = result
                    module_outputs[output.module] = output
                    warnings.extend(output.warnings)
                    self._add_tokens(token_usage, name, gen_tokens)
                    client_map = {"hr": self.hr_client, "invoice": self.invoice_client, "inventory": self.inventory_client}
                    step_logs.append(self._build_step_log(
                        f"{name}_generator", client_map.get(name, self.hr_client),
                        {"business_description": business_description[:300], "module": name},
                        output.model_dump(exclude_none=True),
                        gen_tokens, gen_elapsed_ms,
                    ))

        if not module_outputs:
            return PipelineResult(
                success=False,
                distributor_output=distributor_output,
                errors=errors or ["No module outputs generated"],
                warnings=warnings,
                token_usage=token_usage,
                step_logs=step_logs,
            )

        # Step 3: Integrator
        print("[MultiAgentService] Step 3: Running integrator...")
        t_integ = time.monotonic()
        try:
            final_sdf, integ_tokens = await self._run_integrator(
                project_name=distributor_output.project_name,
                business_description=business_description,
                shared_entities=distributor_output.shared_entities,
                hr_output=module_outputs.get("hr"),
                invoice_output=module_outputs.get("invoice"),
                inventory_output=module_outputs.get("inventory"),
                default_question_answers=default_question_answers or {},
                prefilled_sdf=prefilled_sdf or {},
            )
            integ_ms = int((time.monotonic() - t_integ) * 1000)
            self._add_tokens(token_usage, "integrator", integ_tokens)

            step_logs.append(self._build_step_log(
                "integrator", self.integrator_client,
                {"modules": list(module_outputs.keys())},
                {"project_name": final_sdf.get("project_name", ""), "entity_count": len(final_sdf.get("entities", []))},
                integ_tokens, integ_ms,
            ))

            if isinstance(final_sdf.get("warnings"), list):
                warnings.extend(final_sdf["warnings"])

            # Step 4: Aggregate clarifications (grouped by module, sorted by priority)
            integrator_clarifications = final_sdf.get("clarifications_needed", [])
            aggregated_clarifications = self._aggregate_clarifications(
                module_outputs, integrator_clarifications,
            )

            # Step 5: Termination check
            all_modules_complete = all(
                output.sdf_complete for output in module_outputs.values()
            )
            pipeline_complete = all_modules_complete and len(aggregated_clarifications) == 0

            return PipelineResult(
                success=True,
                sdf=final_sdf,
                sdf_complete=pipeline_complete,
                distributor_output=distributor_output,
                module_outputs=module_outputs,
                clarifications_needed=aggregated_clarifications,
                token_usage=token_usage,
                step_logs=step_logs,
                errors=errors,
                warnings=warnings,
            )
        except Exception as e:
            print(f"[MultiAgentService] Integrator failed: {e}")
            partial_clarifications = self._aggregate_clarifications(module_outputs, [])
            return PipelineResult(
                success=False,
                distributor_output=distributor_output,
                module_outputs=module_outputs,
                clarifications_needed=partial_clarifications,
                token_usage=token_usage,
                step_logs=step_logs,
                errors=errors + [f"Integrator agent failed: {str(e)}"],
                warnings=warnings,
            )

    # ── individual agents ───────────────────────────────────────

    async def _run_distributor(
        self, business_description: str,
        default_question_answers: Dict[str, Any],
        prefilled_sdf: Dict[str, Any],
    ) -> tuple[DistributorOutput, GenerationResult]:
        default_questions_str = json.dumps(default_question_answers, indent=2) if default_question_answers else ""
        prefilled_sdf_str = json.dumps(prefilled_sdf, indent=2) if prefilled_sdf else ""

        prompt = get_distributor_prompt(business_description, default_questions_str, prefilled_sdf_str)
        result = await self.distributor_client.generate_with_retry(
            prompt, temperature=self.distributor_client.get_temperature(), response_schema=DistributorOutput,
        )
        data = await self._parse_json_with_repair(result.text, "distributor")

        parsed_default_answers = data.get("default_question_answers", {})
        if not isinstance(parsed_default_answers, dict):
            parsed_default_answers = {}
        parsed_prefilled_sdf = data.get("prefilled_sdf", {})
        if not isinstance(parsed_prefilled_sdf, dict):
            parsed_prefilled_sdf = {}

        output = DistributorOutput(
            project_name=data.get("project_name", "CustomERP Project"),
            modules_needed=data.get("modules_needed", []),
            shared_entities=data.get("shared_entities", []),
            hr_context=ModuleContext(**data["hr_context"]) if data.get("hr_context") else ModuleContext(),
            invoice_context=ModuleContext(**data["invoice_context"]) if data.get("invoice_context") else ModuleContext(),
            inventory_context=ModuleContext(**data["inventory_context"]) if data.get("inventory_context") else ModuleContext(),
            default_question_answers=parsed_default_answers,
            prefilled_sdf=parsed_prefilled_sdf,
            warnings=data.get("warnings", []),
        )
        return output, result

    @staticmethod
    def _extract_module_prefilled(prefilled_sdf: Dict[str, Any], module_name: str) -> str:
        """Extract the module-specific config + entities from the prefilled SDF."""
        if not prefilled_sdf:
            return ""
        mod_cfg = (prefilled_sdf.get("modules") or {}).get(module_name)
        entities = [
            e for e in (prefilled_sdf.get("entities") or [])
            if isinstance(e, dict) and e.get("module") in (module_name, "shared")
        ]
        if not mod_cfg and not entities:
            return ""
        snippet = {}
        if mod_cfg:
            snippet["module_config"] = mod_cfg
        if entities:
            snippet["entities"] = entities
        return json.dumps(snippet, indent=2)

    async def _run_hr_generator(
        self, business_description: str, hr_context: ModuleContext, shared_entities: List[str],
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> tuple[ModuleGeneratorOutput, GenerationResult]:
        print("[MultiAgentService] Generating HR module...")
        hr_answers = {k: v for k, v in (default_question_answers or {}).items() if k.startswith("hr_")}
        prompt = get_hr_generator_prompt(
            business_description=business_description,
            hr_description=hr_context.description,
            hr_features=", ".join(hr_context.features),
            shared_entities=", ".join(shared_entities),
            default_answers=json.dumps(hr_answers, indent=2) if hr_answers else "",
            prefilled_module_sdf=self._extract_module_prefilled(prefilled_sdf or {}, "hr"),
        )
        result = await self.hr_client.generate_with_retry(
            prompt, temperature=self.hr_client.get_temperature(), response_schema=ModuleGeneratorOutput,
        )
        data = await self._parse_json_with_repair(result.text, "hr")
        clarifications = self._parse_clarifications(data.get("clarifications_needed", []), "hr")
        output = ModuleGeneratorOutput(
            module="hr",
            entities=data.get("entities", []),
            module_config=data.get("module_config", {"enabled": True}),
            clarifications_needed=clarifications,
            sdf_complete=bool(data.get("sdf_complete", False)),
            warnings=data.get("warnings", []),
        )
        return output, result

    async def _run_invoice_generator(
        self, business_description: str, invoice_context: ModuleContext, shared_entities: List[str],
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> tuple[ModuleGeneratorOutput, GenerationResult]:
        print("[MultiAgentService] Generating Invoice module...")
        inv_answers = {k: v for k, v in (default_question_answers or {}).items() if k.startswith("invoice_")}
        prompt = get_invoice_generator_prompt(
            business_description=business_description,
            invoice_description=invoice_context.description,
            invoice_features=", ".join(invoice_context.features),
            shared_entities=", ".join(shared_entities),
            default_answers=json.dumps(inv_answers, indent=2) if inv_answers else "",
            prefilled_module_sdf=self._extract_module_prefilled(prefilled_sdf or {}, "invoice"),
        )
        result = await self.invoice_client.generate_with_retry(
            prompt, temperature=self.invoice_client.get_temperature(), response_schema=ModuleGeneratorOutput,
        )
        data = await self._parse_json_with_repair(result.text, "invoice")
        clarifications = self._parse_clarifications(data.get("clarifications_needed", []), "invoice")
        output = ModuleGeneratorOutput(
            module="invoice",
            entities=data.get("entities", []),
            module_config=data.get("module_config", {"enabled": True, "tax_rate": 0, "currency": "USD"}),
            clarifications_needed=clarifications,
            sdf_complete=bool(data.get("sdf_complete", False)),
            warnings=data.get("warnings", []),
        )
        return output, result

    async def _run_inventory_generator(
        self, business_description: str, inventory_context: ModuleContext, shared_entities: List[str],
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> tuple[ModuleGeneratorOutput, GenerationResult]:
        print("[MultiAgentService] Generating Inventory module...")
        stock_answers = {k: v for k, v in (default_question_answers or {}).items() if k.startswith("inv_")}
        prompt = get_inventory_generator_prompt(
            business_description=business_description,
            inventory_description=inventory_context.description,
            inventory_features=", ".join(inventory_context.features),
            shared_entities=", ".join(shared_entities),
            default_answers=json.dumps(stock_answers, indent=2) if stock_answers else "",
            prefilled_module_sdf=self._extract_module_prefilled(prefilled_sdf or {}, "inventory"),
        )
        result = await self.inventory_client.generate_with_retry(
            prompt, temperature=self.inventory_client.get_temperature(), response_schema=ModuleGeneratorOutput,
        )
        data = await self._parse_json_with_repair(result.text, "inventory")
        clarifications = self._parse_clarifications(data.get("clarifications_needed", []), "inventory")
        output = ModuleGeneratorOutput(
            module="inventory",
            entities=data.get("entities", []),
            module_config=data.get("module_config", {}),
            clarifications_needed=clarifications,
            sdf_complete=bool(data.get("sdf_complete", False)),
            warnings=data.get("warnings", []),
        )
        return output, result

    async def _run_integrator(
        self,
        project_name: str,
        business_description: str,
        shared_entities: List[str],
        hr_output: Optional[ModuleGeneratorOutput],
        invoice_output: Optional[ModuleGeneratorOutput],
        inventory_output: Optional[ModuleGeneratorOutput],
        default_question_answers: Dict[str, Any],
        prefilled_sdf: Dict[str, Any],
    ) -> tuple[Dict[str, Any], GenerationResult]:
        hr_json = json.dumps(hr_output.model_dump(), indent=2) if hr_output else "null"
        invoice_json = json.dumps(invoice_output.model_dump(), indent=2) if invoice_output else "null"
        inventory_json = json.dumps(inventory_output.model_dump(), indent=2) if inventory_output else "null"
        mandatory_answers_json = json.dumps(default_question_answers or {}, indent=2)
        prefilled_sdf_json = json.dumps(prefilled_sdf or {}, indent=2)

        prompt = get_integrator_prompt(
            project_name=project_name,
            business_description=business_description,
            shared_entities=", ".join(shared_entities),
            hr_output=hr_json,
            invoice_output=invoice_json,
            inventory_output=inventory_json,
            default_question_answers=mandatory_answers_json,
            prefilled_sdf=prefilled_sdf_json,
        )
        result = await self.integrator_client.generate_with_retry(
            prompt, temperature=self.integrator_client.get_temperature(), response_schema=IntegratorOutput,
        )
        data = await self._parse_json_with_repair(result.text, "integrator")
        return data, result

    # ── JSON parsing ────────────────────────────────────────────

    async def _repair_json(self, malformed_json: str) -> GenerationResult:
        fix_prompt = get_fix_json_prompt(malformed_json)
        return await self.integrator_client.generate_with_retry(
            fix_prompt, temperature=0.0, json_mode=True,
        )

    async def _parse_json_with_repair(self, response: str, agent_name: str) -> Dict[str, Any]:
        try:
            return self._parse_json(response)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"[MultiAgentService] {agent_name} JSON malformed, attempting AI repair...")
            try:
                repair_result = await self._repair_json(response)
                return self._parse_json(repair_result.text)
            except Exception as repair_error:
                print(f"[MultiAgentService] AI repair also failed: {repair_error}")
                raise e

    def _parse_json(self, response: str) -> Dict[str, Any]:
        start = response.find('{')
        end = response.rfind('}')
        if start == -1 or end == -1:
            raise ValueError("No JSON object found in response")

        json_str = response[start:end + 1]
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass

        # Pass 1: strip trailing commas + control chars
        fixed_json = json_str
        fixed_json = re.sub(r',\s*([}\]])', r'\1', fixed_json)
        fixed_json = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', fixed_json)

        try:
            return json.loads(fixed_json)
        except json.JSONDecodeError:
            pass

        # Pass 2: bracket-balance truncated JSON
        balanced = self._balance_json(fixed_json)
        try:
            return json.loads(balanced)
        except json.JSONDecodeError as e:
            print(f"[MultiAgentService] JSON parse error at position {e.pos}: {e.msg}")
            print(f"[MultiAgentService] Context: ...{json_str[max(0, e.pos-50):e.pos+50]}...")
            raise

    @staticmethod
    def _balance_json(json_str: str) -> str:
        """Close unclosed brackets/braces to salvage truncated JSON."""
        stack: list[str] = []
        in_string = False
        escape = False
        for ch in json_str:
            if escape:
                escape = False
                continue
            if ch == '\\' and in_string:
                escape = True
                continue
            if ch == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in ('{', '['):
                stack.append(ch)
            elif ch == '}' and stack and stack[-1] == '{':
                stack.pop()
            elif ch == ']' and stack and stack[-1] == '[':
                stack.pop()

        # Strip any trailing partial key/value (after last comma or opening bracket)
        trimmed = json_str.rstrip()
        if trimmed and trimmed[-1] not in ('}', ']', '"', 't', 'e', 'l', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'):
            # Truncated mid-value — find last complete value
            last_comma = trimmed.rfind(',')
            last_open = max(trimmed.rfind('{'), trimmed.rfind('['))
            cut = max(last_comma, last_open)
            if cut > 0:
                trimmed = trimmed[:cut] if trimmed[cut] == ',' else trimmed[:cut + 1]

        # Close unclosed brackets
        closing = ''
        for opener in reversed(stack):
            closing += ']' if opener == '[' else '}'
        return trimmed + closing

    # ── clarification helpers ───────────────────────────────────

    def _parse_clarifications(
        self, raw_clarifications: List[Any], module: str,
    ) -> List[ClarificationQuestion]:
        clarifications = []
        for item in raw_clarifications:
            if isinstance(item, dict):
                try:
                    item["module"] = item.get("module") or module
                    if "priority" not in item:
                        item["priority"] = "medium"
                    clarifications.append(ClarificationQuestion(**item))
                except Exception as e:
                    print(f"[MultiAgentService] Failed to parse clarification: {item}, error: {e}")
            elif isinstance(item, ClarificationQuestion):
                if not item.module:
                    item.module = module
                clarifications.append(item)
        return clarifications

    def _aggregate_clarifications(
        self,
        module_outputs: Dict[str, ModuleGeneratorOutput],
        integrator_clarifications: List[Any],
    ) -> List[ClarificationQuestion]:
        seen_ids: set = set()
        aggregated: List[ClarificationQuestion] = []

        for module_name, output in module_outputs.items():
            for clarification in output.clarifications_needed:
                if clarification.id not in seen_ids:
                    seen_ids.add(clarification.id)
                    aggregated.append(clarification)

        for item in integrator_clarifications:
            if isinstance(item, dict):
                q_id = item.get("id", "")
                if q_id and q_id not in seen_ids:
                    seen_ids.add(q_id)
                    try:
                        if "priority" not in item:
                            item["priority"] = "medium"
                        aggregated.append(ClarificationQuestion(**item))
                    except Exception as e:
                        print(f"[MultiAgentService] Failed to parse integrator clarification: {item}, error: {e}")
            elif isinstance(item, ClarificationQuestion):
                if item.id not in seen_ids:
                    seen_ids.add(item.id)
                    aggregated.append(item)

        aggregated.sort(key=lambda q: PRIORITY_ORDER.get(q.priority, 1))
        print(f"[MultiAgentService] Aggregated {len(aggregated)} clarification questions (deduplicated, sorted)")
        return aggregated
