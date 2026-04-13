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
from typing import Optional, Dict, Any, List, Callable

from src.config import settings
from src.services.base_client import BaseAIClient, GenerationResult
from src.services.gemini_client import GeminiClient
from src.services.azure_client import AzureOpenAIClient
from src.schemas.multi_agent import (
    AgentStepLog,
    ClarificationQuestion,
    DistributorOutput,
    ModuleContext,
    ModuleGeneratorOutput,
    PipelineResult,
)
from src.prompts.sdf_generation import (
    get_distributor_prompt,
    get_hr_generator_prompt,
    get_invoice_generator_prompt,
    get_inventory_generator_prompt,
    get_fix_json_prompt,
)
from src.services.sdf.integrator import merge_module_outputs

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


class MultiAgentService:
    """Orchestrates the multi-agent SDF generation pipeline."""

    def __init__(
        self,
        distributor_client: Optional[BaseAIClient] = None,
        hr_client: Optional[BaseAIClient] = None,
        invoice_client: Optional[BaseAIClient] = None,
        inventory_client: Optional[BaseAIClient] = None,
    ):
        self.distributor_client = distributor_client or self._create_client("distributor")
        self.hr_client = hr_client or self._create_client("hr")
        self.invoice_client = invoice_client or self._create_client("invoice")
        self.inventory_client = inventory_client or self._create_client("inventory")

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
        prompt_text: str = "",
    ) -> AgentStepLog:
        config = settings.get_agent_config(agent_name)
        model_str = config.model or getattr(client, "model_name", "") or getattr(client, "deployment", "") or ""
        return AgentStepLog(
            agent=agent_name,
            model=model_str,
            temperature=config.temperature,
            prompt_text=prompt_text[:30000],
            input_summary=input_summary,
            output_parsed=output_parsed,
            raw_response=result.text[:10000],
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
        on_progress: Optional[Callable] = None,
    ) -> PipelineResult:
        errors: List[str] = []
        warnings: List[str] = []
        token_usage = self._empty_token_usage()
        step_logs: List[AgentStepLog] = []

        def _progress(step: str, pct: int, detail: str = ""):
            if on_progress:
                on_progress(step, pct, detail)

        # Step 1: Distributor
        _progress("distributor", 10, "Analyzing your business requirements")
        print("[MultiAgentService] Step 1: Running distributor...")
        t0 = time.monotonic()
        try:
            distributor_output, dist_tokens, dist_prompt = await self._run_distributor(
                business_description,
                default_question_answers or {},
                prefilled_sdf or {},
            )
            dist_ms = int((time.monotonic() - t0) * 1000)
            self._add_tokens(token_usage, "distributor", dist_tokens)
            warnings.extend(distributor_output.warnings)
            step_logs.append(self._build_step_log(
                "distributor", self.distributor_client,
                {
                    "business_description": business_description,
                    "default_question_answers": default_question_answers or {},
                    "prefilled_sdf_keys": list((prefilled_sdf or {}).get("modules", {}).keys()),
                },
                distributor_output.model_dump(exclude_none=True),
                dist_tokens, dist_ms,
                prompt_text=dist_prompt,
            ))
        except Exception as e:
            print(f"[MultiAgentService] Distributor failed: {e}")
            return PipelineResult(
                success=False,
                errors=[f"Distributor agent failed: {str(e)}"],
                token_usage=token_usage,
                step_logs=step_logs,
            )

        # ── Gatekeeper: parse distributor clarifications & unsupported features ──
        dist_clarifications = self._parse_clarifications(
            [q.model_dump() if hasattr(q, "model_dump") else q for q in distributor_output.clarifications_needed],
            "distributor",
        ) if distributor_output.clarifications_needed else []
        unsupported = list(distributor_output.unsupported_features or [])

        if unsupported:
            print(f"[MultiAgentService] Unsupported features detected: {unsupported}")

        if dist_clarifications:
            print(f"[MultiAgentService] Distributor returned {len(dist_clarifications)} clarification(s) — stopping pipeline early")
            _progress("clarifications", 20, "Waiting for your answers")
            return PipelineResult(
                success=True,
                sdf=None,
                sdf_complete=False,
                distributor_output=distributor_output,
                clarifications_needed=dist_clarifications,
                unsupported_features=unsupported,
                token_usage=token_usage,
                step_logs=step_logs,
                warnings=warnings,
            )

        modules_needed = distributor_output.modules_needed
        print(f"[MultiAgentService] Modules needed: {modules_needed}")

        # Determine which modules actually need regeneration vs. carry-forward
        context_for = {
            "hr": distributor_output.hr_context,
            "invoice": distributor_output.invoice_context,
            "inventory": distributor_output.inventory_context,
        }
        skipped_modules: Dict[str, Any] = {}
        modules_to_generate = []
        for mod in modules_needed:
            ctx = context_for.get(mod)
            if ctx and not ctx.changed and prefilled_sdf:
                skipped_modules[mod] = True
                print(f"[MultiAgentService] Skipping {mod.upper()} generator (unchanged in change request)")
            else:
                modules_to_generate.append(mod)

        module_labels = ", ".join(m.upper() for m in modules_to_generate) if modules_to_generate else "modules"
        _progress("generators", 25, f"Generating {module_labels} configurations")
        print(f"[MultiAgentService] Step 2: Running module generators for: {modules_to_generate}")
        module_outputs: Dict[str, ModuleGeneratorOutput] = {}
        generator_tasks = []

        answers = default_question_answers or {}
        pre_sdf = prefilled_sdf or {}
        if "hr" in modules_to_generate:
            generator_tasks.append(("hr", self._run_hr_generator(
                business_description, distributor_output.hr_context, distributor_output.shared_entities, answers, pre_sdf,
            )))
        if "invoice" in modules_to_generate:
            generator_tasks.append(("invoice", self._run_invoice_generator(
                business_description, distributor_output.invoice_context, distributor_output.shared_entities, answers, pre_sdf,
            )))
        if "inventory" in modules_to_generate:
            generator_tasks.append(("inventory", self._run_inventory_generator(
                business_description, distributor_output.inventory_context, distributor_output.shared_entities, answers, pre_sdf,
            )))

        if generator_tasks:
            coros = [t[1] for t in generator_tasks]
            names = [t[0] for t in generator_tasks]
            gen_start = time.monotonic()
            results = await asyncio.gather(*coros, return_exceptions=True)
            gen_elapsed_ms = int((time.monotonic() - gen_start) * 1000)

            context_map = {
                "hr": distributor_output.hr_context,
                "invoice": distributor_output.invoice_context,
                "inventory": distributor_output.inventory_context,
            }

            for name, result in zip(names, results):
                if isinstance(result, Exception):
                    errors.append(f"Module generator ({name}) failed: {str(result)}")
                else:
                    output, gen_tokens, gen_prompt = result
                    module_outputs[output.module] = output
                    warnings.extend(output.warnings)
                    self._add_tokens(token_usage, name, gen_tokens)
                    client_map = {"hr": self.hr_client, "invoice": self.invoice_client, "inventory": self.inventory_client}
                    ctx = context_map.get(name)
                    step_logs.append(self._build_step_log(
                        f"{name}_generator", client_map.get(name, self.hr_client),
                        {
                            "business_description": business_description,
                            "module": name,
                            "module_context": ctx.model_dump(exclude_none=True) if ctx else {},
                            "shared_entities": distributor_output.shared_entities,
                        },
                        output.model_dump(exclude_none=True),
                        gen_tokens, gen_elapsed_ms,
                        prompt_text=gen_prompt,
                    ))

        # Carry forward skipped modules from prefilled SDF as synthetic outputs
        for mod_name in skipped_modules:
            mod_config = (pre_sdf.get("modules") or {}).get(mod_name, {})
            mod_entities = [
                e for e in (pre_sdf.get("entities") or [])
                if mod_name in (e.get("belongs_to") if isinstance(e.get("belongs_to"), list) else [e.get("belongs_to", "")])
                or e.get("module") == mod_name
            ]
            module_outputs[mod_name] = ModuleGeneratorOutput(
                module=mod_name,
                entities=mod_entities,
                module_config=mod_config,
                sdf_complete=True,
                warnings=[],
            )
            print(f"[MultiAgentService] Carried forward {len(mod_entities)} entities for skipped {mod_name.upper()}")

        if not module_outputs:
            return PipelineResult(
                success=False,
                distributor_output=distributor_output,
                errors=errors or ["No module outputs generated"],
                warnings=warnings,
                token_usage=token_usage,
                step_logs=step_logs,
            )

        # Step 3: Deterministic merge (replaces LLM integrator)
        _progress("integrator", 60, "Combining modules into your ERP")
        print("[MultiAgentService] Step 3: Merging module outputs (deterministic)...")
        t_integ = time.monotonic()

        final_sdf = merge_module_outputs(
            project_name=distributor_output.project_name,
            module_outputs=module_outputs,
            shared_entity_hints=distributor_output.shared_entities,
            prefilled_sdf=prefilled_sdf or {},
        )
        integ_ms = int((time.monotonic() - t_integ) * 1000)
        print(f"[MultiAgentService] Merge completed in {integ_ms}ms — "
              f"{len(final_sdf.get('entities', []))} entities, "
              f"{len(final_sdf.get('modules', {}))} modules")

        step_logs.append(AgentStepLog(
            agent="integrator",
            model="deterministic",
            temperature=0.0,
            prompt_text="",
            input_summary={
                "modules": list(module_outputs.keys()),
                "project_name": distributor_output.project_name,
                "shared_entities": distributor_output.shared_entities,
                "method": "code_merge",
            },
            output_parsed=final_sdf,
            raw_response=json.dumps(final_sdf, default=str)[:10000],
            tokens_in=0,
            tokens_out=0,
            duration_ms=integ_ms,
        ))

        if isinstance(final_sdf.get("warnings"), list):
            warnings.extend(final_sdf["warnings"])

        _progress("finalizing", 80, "Checking for follow-up questions")
        aggregated_clarifications = self._aggregate_clarifications(module_outputs, [])

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
            unsupported_features=unsupported,
            token_usage=token_usage,
            step_logs=step_logs,
            errors=errors,
            warnings=warnings,
        )

    # ── individual agents ───────────────────────────────────────

    @staticmethod
    def _build_existing_modules_summary(prefilled_sdf: Dict[str, Any]) -> str:
        """Build a lightweight text summary of which modules/entities exist in the prefilled SDF.
        Includes display names so the distributor can map user's colloquial names to actual slugs."""
        if not prefilled_sdf:
            return "No existing ERP — this is a fresh generation."
        modules = prefilled_sdf.get("modules") or {}
        entities = prefilled_sdf.get("entities") or []

        lines = []
        enabled = [m for m, cfg in modules.items() if isinstance(cfg, dict) and cfg.get("enabled", True)]
        if enabled:
            lines.append(f"Enabled modules: {', '.join(enabled)}")

        by_module: Dict[str, list] = {}
        for e in entities:
            if not isinstance(e, dict):
                continue
            mod = e.get("module", "unknown")
            slug = e.get("slug", "?")
            display = e.get("display_name", "")
            label = f"{slug} (\"{display}\")" if display and display.lower().replace(" ", "_") != slug else slug
            by_module.setdefault(mod, []).append(label)

        for mod, slugs in sorted(by_module.items()):
            lines.append(f"{mod.upper()} entities: {', '.join(slugs)}")

        return "\n".join(lines) if lines else "No existing ERP — this is a fresh generation."

    async def _run_distributor(
        self, business_description: str,
        default_question_answers: Dict[str, Any],
        prefilled_sdf: Dict[str, Any],
    ) -> tuple[DistributorOutput, GenerationResult, str]:
        default_questions_str = json.dumps(default_question_answers, indent=2) if default_question_answers else ""
        existing_modules_str = self._build_existing_modules_summary(prefilled_sdf)

        prompt = get_distributor_prompt(business_description, default_questions_str, existing_modules_str)
        result = await self.distributor_client.generate_with_retry(
            prompt, temperature=self.distributor_client.get_temperature(), response_schema=DistributorOutput,
        )
        data = await self._parse_json_with_repair(result.text, "distributor")

        raw_clarifications = data.get("clarifications_needed", [])
        parsed_clarifications = []
        if isinstance(raw_clarifications, list):
            for q in raw_clarifications:
                if isinstance(q, dict):
                    try:
                        parsed_clarifications.append(ClarificationQuestion(**q))
                    except Exception:
                        pass

        output = DistributorOutput(
            project_name=data.get("project_name", "CustomERP Project"),
            modules_needed=data.get("modules_needed", []),
            shared_entities=data.get("shared_entities", []),
            hr_context=ModuleContext(**data["hr_context"]) if data.get("hr_context") else ModuleContext(),
            invoice_context=ModuleContext(**data["invoice_context"]) if data.get("invoice_context") else ModuleContext(),
            inventory_context=ModuleContext(**data["inventory_context"]) if data.get("inventory_context") else ModuleContext(),
            clarifications_needed=parsed_clarifications,
            unsupported_features=data.get("unsupported_features", []),
            warnings=data.get("warnings", []),
        )
        return output, result, prompt

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
    ) -> tuple[ModuleGeneratorOutput, GenerationResult, str]:
        print("[MultiAgentService] Generating HR module...")
        hr_answers = {k: v for k, v in (default_question_answers or {}).items() if k.startswith("hr_")}
        prompt = get_hr_generator_prompt(
            business_description=business_description,
            hr_description=hr_context.description,
            hr_features=", ".join(hr_context.features),
            shared_entities=", ".join(shared_entities),
            default_answers=json.dumps(hr_answers, indent=2) if hr_answers else "",
            prefilled_module_sdf=self._extract_module_prefilled(prefilled_sdf or {}, "hr"),
            change_instructions=hr_context.change_instructions,
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
        return output, result, prompt

    async def _run_invoice_generator(
        self, business_description: str, invoice_context: ModuleContext, shared_entities: List[str],
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> tuple[ModuleGeneratorOutput, GenerationResult, str]:
        print("[MultiAgentService] Generating Invoice module...")
        inv_answers = {k: v for k, v in (default_question_answers or {}).items() if k.startswith("invoice_")}
        prompt = get_invoice_generator_prompt(
            business_description=business_description,
            invoice_description=invoice_context.description,
            invoice_features=", ".join(invoice_context.features),
            shared_entities=", ".join(shared_entities),
            default_answers=json.dumps(inv_answers, indent=2) if inv_answers else "",
            prefilled_module_sdf=self._extract_module_prefilled(prefilled_sdf or {}, "invoice"),
            change_instructions=invoice_context.change_instructions,
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
        return output, result, prompt

    async def _run_inventory_generator(
        self, business_description: str, inventory_context: ModuleContext, shared_entities: List[str],
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> tuple[ModuleGeneratorOutput, GenerationResult, str]:
        print("[MultiAgentService] Generating Inventory module...")
        stock_answers = {k: v for k, v in (default_question_answers or {}).items() if k.startswith("inv_")}
        prompt = get_inventory_generator_prompt(
            business_description=business_description,
            inventory_description=inventory_context.description,
            inventory_features=", ".join(inventory_context.features),
            shared_entities=", ".join(shared_entities),
            default_answers=json.dumps(stock_answers, indent=2) if stock_answers else "",
            prefilled_module_sdf=self._extract_module_prefilled(prefilled_sdf or {}, "inventory"),
            change_instructions=inventory_context.change_instructions,
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
        return output, result, prompt

    # ── JSON parsing ────────────────────────────────────────────

    async def _repair_json(self, malformed_json: str) -> GenerationResult:
        fix_prompt = get_fix_json_prompt(malformed_json)
        return await self.distributor_client.generate_with_retry(
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
