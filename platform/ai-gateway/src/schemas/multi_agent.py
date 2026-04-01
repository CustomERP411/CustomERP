"""
Pydantic models for the multi-agent SDF generation pipeline.

These models define the intermediate data structures passed between agents:
- Distributor output (routing decision)
- Module generator outputs (partial SDFs)
- Integrator input/output (combined SDF)
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ModuleContext(BaseModel):
    """Context extracted for a specific module by the distributor."""
    enabled: bool = False
    description: str = ""
    entities_hint: List[str] = Field(default_factory=list)
    features: List[str] = Field(default_factory=list)


class DistributorOutput(BaseModel):
    """Output from the Distributor agent.
    
    Contains routing decisions and extracted context for each module.
    """
    project_name: str
    modules_needed: List[str] = Field(default_factory=list)
    shared_entities: List[str] = Field(default_factory=list)
    hr_context: ModuleContext = Field(default_factory=ModuleContext)
    invoice_context: ModuleContext = Field(default_factory=ModuleContext)
    inventory_context: ModuleContext = Field(default_factory=ModuleContext)
    default_question_answers: Dict[str, Any] = Field(default_factory=dict)
    prefilled_sdf: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)


class ClarificationQuestion(BaseModel):
    """A clarification question to ask the user."""
    id: str = Field(..., description="Unique identifier for the question")
    question: str = Field(..., description="The question text")
    type: Literal["yes_no", "choice", "text"] = Field(..., description="Question type")
    options: Optional[List[str]] = Field(default=None, description="Options for choice questions")
    module: Optional[str] = Field(default=None, description="Source module (hr, invoice, inventory)")


class ModuleGeneratorOutput(BaseModel):
    """Output from a module-specific generator (HR, Invoice, or Inventory).
    
    Contains partial SDF with only that module's entities.
    """
    module: Literal["hr", "invoice", "inventory"]
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    module_config: Dict[str, Any] = Field(default_factory=dict)
    clarifications_needed: List[ClarificationQuestion] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class IntegratorInput(BaseModel):
    """Input to the Integrator agent.
    
    Contains all the information needed to produce the final SDF.
    """
    project_name: str
    business_description: str
    shared_entities: List[str] = Field(default_factory=list)
    hr_output: Optional[ModuleGeneratorOutput] = None
    invoice_output: Optional[ModuleGeneratorOutput] = None
    inventory_output: Optional[ModuleGeneratorOutput] = None


class IntegratorOutput(BaseModel):
    """Output from the Integrator agent - the final merged SDF.
    
    This schema is used for strict JSON enforcement on Gemini API calls.
    """
    project_name: str = Field(..., description="Name of the ERP project")
    modules: Dict[str, Any] = Field(default_factory=dict, description="Module configurations")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="All merged entities")
    clarifications_needed: List[ClarificationQuestion] = Field(
        default_factory=list, 
        description="Aggregated clarification questions from all modules"
    )
    warnings: List[str] = Field(default_factory=list, description="Combined warnings")


class PipelineResult(BaseModel):
    """Result of the complete multi-agent pipeline.
    
    Contains the final SDF and metadata about the generation process.
    """
    success: bool
    sdf: Optional[Dict[str, Any]] = None
    distributor_output: Optional[DistributorOutput] = None
    module_outputs: Dict[str, ModuleGeneratorOutput] = Field(default_factory=dict)
    clarifications_needed: List[ClarificationQuestion] = Field(
        default_factory=list,
        description="Aggregated and deduplicated clarification questions from all modules"
    )
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
