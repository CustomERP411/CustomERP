"""
Multi-Agent SDF Generation Service

Orchestrates the multi-agent pipeline for SDF generation:
1. Distributor - Routes user input to appropriate modules
2. Module Generators (HR, Invoice, Inventory) - Generate partial SDFs
3. Integrator - Combines partial SDFs into final SDF

Each agent can use a different model/configuration, enabling future fine-tuning.
"""

import json
import asyncio
from typing import Optional, Dict, Any, List

from src.config import settings, AgentConfig
from src.services.gemini_client import GeminiClient
from src.services.base_client import BaseAIClient
from src.schemas.multi_agent import (
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
    get_integrator_prompt,
    get_fix_json_prompt,
)
import re


class MultiAgentService:
    """Orchestrates the multi-agent SDF generation pipeline.
    
    The pipeline consists of:
    1. Distributor: Analyzes user input, determines which modules are needed
    2. Module Generators: Generate partial SDFs for each needed module
    3. Integrator: Combines all partial SDFs into one coherent final SDF
    
    Each agent can have its own model configuration, allowing for:
    - Different models per agent (e.g., fine-tuned models)
    - Different API keys per agent
    - Different temperatures/timeouts per agent
    """
    
    def __init__(
        self,
        distributor_client: Optional[BaseAIClient] = None,
        hr_client: Optional[BaseAIClient] = None,
        invoice_client: Optional[BaseAIClient] = None,
        inventory_client: Optional[BaseAIClient] = None,
        integrator_client: Optional[BaseAIClient] = None,
    ):
        """Initialize the multi-agent service.
        
        Args:
            distributor_client: AI client for the distributor agent.
            hr_client: AI client for the HR generator agent.
            invoice_client: AI client for the Invoice generator agent.
            inventory_client: AI client for the Inventory generator agent.
            integrator_client: AI client for the integrator agent.
            
        If any client is None, a default GeminiClient with agent-specific config is created.
        """
        self.distributor_client = distributor_client or self._create_client("distributor")
        self.hr_client = hr_client or self._create_client("hr")
        self.invoice_client = invoice_client or self._create_client("invoice")
        self.inventory_client = inventory_client or self._create_client("inventory")
        self.integrator_client = integrator_client or self._create_client("integrator")
    
    def _create_client(self, agent_name: str) -> GeminiClient:
        """Create a GeminiClient with agent-specific configuration."""
        config = settings.get_agent_config(agent_name)
        return GeminiClient(agent_config=config)
    
    async def generate_sdf(
        self,
        business_description: str,
        default_question_answers: Optional[Dict[str, Any]] = None,
        prefilled_sdf: Optional[Dict[str, Any]] = None,
    ) -> PipelineResult:
        """Run the full multi-agent pipeline to generate an SDF.
        
        Args:
            business_description: The user's natural language description.
            default_question_answers: Optional answers to mandatory pre-generation questions.
            prefilled_sdf: Optional prefilled SDF draft built from mandatory answers.
        
        Returns:
            PipelineResult containing the final SDF and metadata.
        """
        errors: List[str] = []
        warnings: List[str] = []
        
        # ─────────────────────────────────────────────────────────────
        # Step 1: Distributor - Route to appropriate modules
        # ─────────────────────────────────────────────────────────────
        print("[MultiAgentService] Step 1: Running distributor...")
        
        try:
            distributor_output = await self._run_distributor(
                business_description,
                default_question_answers or {},
                prefilled_sdf or {},
            )
            warnings.extend(distributor_output.warnings)
        except Exception as e:
            print(f"[MultiAgentService] Distributor failed: {e}")
            return PipelineResult(
                success=False,
                errors=[f"Distributor agent failed: {str(e)}"],
            )
        
        print(f"[MultiAgentService] Modules needed: {distributor_output.modules_needed}")
        print(f"[MultiAgentService] Shared entities: {distributor_output.shared_entities}")
        
        # ─────────────────────────────────────────────────────────────
        # Step 2: Module Generators - Generate partial SDFs in parallel
        # ─────────────────────────────────────────────────────────────
        print("[MultiAgentService] Step 2: Running module generators...")
        
        module_outputs: Dict[str, ModuleGeneratorOutput] = {}
        generator_tasks = []
        
        if "hr" in distributor_output.modules_needed:
            generator_tasks.append(
                self._run_hr_generator(
                    business_description,
                    distributor_output.hr_context,
                    distributor_output.shared_entities,
                )
            )
        
        if "invoice" in distributor_output.modules_needed:
            generator_tasks.append(
                self._run_invoice_generator(
                    business_description,
                    distributor_output.invoice_context,
                    distributor_output.shared_entities,
                )
            )
        
        if "inventory" in distributor_output.modules_needed:
            generator_tasks.append(
                self._run_inventory_generator(
                    business_description,
                    distributor_output.inventory_context,
                    distributor_output.shared_entities,
                )
            )
        
        if generator_tasks:
            results = await asyncio.gather(*generator_tasks, return_exceptions=True)
            
            for result in results:
                if isinstance(result, Exception):
                    errors.append(f"Module generator failed: {str(result)}")
                elif isinstance(result, ModuleGeneratorOutput):
                    module_outputs[result.module] = result
                    warnings.extend(result.warnings)
        
        if not module_outputs:
            return PipelineResult(
                success=False,
                distributor_output=distributor_output,
                errors=errors or ["No module outputs generated"],
                warnings=warnings,
            )
        
        # ─────────────────────────────────────────────────────────────
        # Step 3: Integrator - Combine partial SDFs
        # ─────────────────────────────────────────────────────────────
        print("[MultiAgentService] Step 3: Running integrator...")
        
        try:
            final_sdf = await self._run_integrator(
                project_name=distributor_output.project_name,
                business_description=business_description,
                shared_entities=distributor_output.shared_entities,
                hr_output=module_outputs.get("hr"),
                invoice_output=module_outputs.get("invoice"),
                inventory_output=module_outputs.get("inventory"),
                default_question_answers=default_question_answers or {},
                prefilled_sdf=prefilled_sdf or {},
            )
            
            # Merge any warnings from integrator output
            if isinstance(final_sdf.get("warnings"), list):
                warnings.extend(final_sdf.get("warnings", []))
            
            return PipelineResult(
                success=True,
                sdf=final_sdf,
                distributor_output=distributor_output,
                module_outputs=module_outputs,
                errors=errors,
                warnings=warnings,
            )
        except Exception as e:
            print(f"[MultiAgentService] Integrator failed: {e}")
            return PipelineResult(
                success=False,
                distributor_output=distributor_output,
                module_outputs=module_outputs,
                errors=errors + [f"Integrator agent failed: {str(e)}"],
                warnings=warnings,
            )
    
    async def _run_distributor(
        self,
        business_description: str,
        default_question_answers: Dict[str, Any],
        prefilled_sdf: Dict[str, Any],
    ) -> DistributorOutput:
        """Run the distributor agent to route user input."""
        # Format constraints for prompt injection.
        default_questions_str = ""
        if default_question_answers:
            default_questions_str = json.dumps(default_question_answers, indent=2)

        prefilled_sdf_str = ""
        if prefilled_sdf:
            prefilled_sdf_str = json.dumps(prefilled_sdf, indent=2)
        
        prompt = get_distributor_prompt(
            business_description,
            default_questions_str,
            prefilled_sdf_str,
        )
        
        response = await self.distributor_client.generate_with_retry(
            prompt,
            temperature=self.distributor_client.get_temperature(),
            json_mode=True,
        )
        
        data = self._parse_json(response)
        
        # Parse into DistributorOutput
        parsed_default_answers = data.get("default_question_answers", {})
        if not isinstance(parsed_default_answers, dict):
            parsed_default_answers = {}

        parsed_prefilled_sdf = data.get("prefilled_sdf", {})
        if not isinstance(parsed_prefilled_sdf, dict):
            parsed_prefilled_sdf = {}

        return DistributorOutput(
            project_name=data.get("project_name", "CustomERP Project"),
            modules_needed=data.get("modules_needed", []),
            shared_entities=data.get("shared_entities", []),
            hr_context=ModuleContext(**data.get("hr_context", {})) if data.get("hr_context") else ModuleContext(),
            invoice_context=ModuleContext(**data.get("invoice_context", {})) if data.get("invoice_context") else ModuleContext(),
            inventory_context=ModuleContext(**data.get("inventory_context", {})) if data.get("inventory_context") else ModuleContext(),
            default_question_answers=parsed_default_answers,
            prefilled_sdf=parsed_prefilled_sdf,
            warnings=data.get("warnings", []),
        )
    
    async def _run_hr_generator(
        self,
        business_description: str,
        hr_context: ModuleContext,
        shared_entities: List[str],
    ) -> ModuleGeneratorOutput:
        """Run the HR module generator."""
        print("[MultiAgentService] Generating HR module...")
        
        prompt = get_hr_generator_prompt(
            business_description=business_description,
            hr_description=hr_context.description,
            hr_features=", ".join(hr_context.features),
            shared_entities=", ".join(shared_entities),
        )
        
        response = await self.hr_client.generate_with_retry(
            prompt,
            temperature=self.hr_client.get_temperature(),
            json_mode=True,
        )
        
        data = self._parse_json(response)
        
        return ModuleGeneratorOutput(
            module="hr",
            entities=data.get("entities", []),
            module_config=data.get("module_config", {"enabled": True}),
            clarifications_needed=data.get("clarifications_needed", []),
            warnings=data.get("warnings", []),
        )
    
    async def _run_invoice_generator(
        self,
        business_description: str,
        invoice_context: ModuleContext,
        shared_entities: List[str],
    ) -> ModuleGeneratorOutput:
        """Run the Invoice module generator."""
        print("[MultiAgentService] Generating Invoice module...")
        
        prompt = get_invoice_generator_prompt(
            business_description=business_description,
            invoice_description=invoice_context.description,
            invoice_features=", ".join(invoice_context.features),
            shared_entities=", ".join(shared_entities),
        )
        
        response = await self.invoice_client.generate_with_retry(
            prompt,
            temperature=self.invoice_client.get_temperature(),
            json_mode=True,
        )
        
        data = self._parse_json(response)
        
        return ModuleGeneratorOutput(
            module="invoice",
            entities=data.get("entities", []),
            module_config=data.get("module_config", {"enabled": True, "tax_rate": 0, "currency": "USD"}),
            clarifications_needed=data.get("clarifications_needed", []),
            warnings=data.get("warnings", []),
        )
    
    async def _run_inventory_generator(
        self,
        business_description: str,
        inventory_context: ModuleContext,
        shared_entities: List[str],
    ) -> ModuleGeneratorOutput:
        """Run the Inventory module generator."""
        print("[MultiAgentService] Generating Inventory module...")
        
        prompt = get_inventory_generator_prompt(
            business_description=business_description,
            inventory_description=inventory_context.description,
            inventory_features=", ".join(inventory_context.features),
            shared_entities=", ".join(shared_entities),
        )
        
        response = await self.inventory_client.generate_with_retry(
            prompt,
            temperature=self.inventory_client.get_temperature(),
            json_mode=True,
        )
        
        data = self._parse_json(response)
        
        return ModuleGeneratorOutput(
            module="inventory",
            entities=data.get("entities", []),
            module_config=data.get("module_config", {}),
            clarifications_needed=data.get("clarifications_needed", []),
            warnings=data.get("warnings", []),
        )
    
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
    ) -> Dict[str, Any]:
        """Run the integrator agent to combine module outputs."""
        
        # Serialize module outputs to JSON strings
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
        
        response = await self.integrator_client.generate_with_retry(
            prompt,
            temperature=self.integrator_client.get_temperature(),
            json_mode=True,
        )
        
        # Try parsing, with AI-based repair if needed
        try:
            return self._parse_json(response)
        except json.JSONDecodeError as e:
            print(f"[MultiAgentService] Integrator JSON malformed, attempting AI repair...")
            repaired = await self._repair_json(response)
            return self._parse_json(repaired)
    
    async def _repair_json(self, malformed_json: str) -> str:
        """Use AI to repair malformed JSON."""
        fix_prompt = get_fix_json_prompt(malformed_json)
        repaired = await self.integrator_client.generate_with_retry(
            fix_prompt,
            temperature=0.0,  # Deterministic for fixing
            json_mode=True,
        )
        return repaired
    
    def _parse_json(self, response: str) -> Dict[str, Any]:
        """Parse JSON from AI response, handling markdown code blocks and common issues."""
        # Find JSON object in response
        start = response.find('{')
        end = response.rfind('}')
        
        if start == -1 or end == -1:
            raise ValueError("No JSON object found in response")
        
        json_str = response[start:end + 1]
        
        # Try direct parse first
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        # Attempt to fix common JSON issues
        fixed_json = json_str
        
        # Remove trailing commas before ] or }
        fixed_json = re.sub(r',\s*([}\]])', r'\1', fixed_json)
        
        # Remove any control characters except newlines/tabs
        fixed_json = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', fixed_json)
        
        # Try parsing the fixed JSON
        try:
            return json.loads(fixed_json)
        except json.JSONDecodeError as e:
            # Log the problematic JSON for debugging
            print(f"[MultiAgentService] JSON parse error at position {e.pos}: {e.msg}")
            print(f"[MultiAgentService] Context around error: ...{json_str[max(0, e.pos-50):e.pos+50]}...")
            raise
