"""
Pydantic models for the multi-agent SDF generation pipeline.
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
    priority: Literal["high", "medium", "low"] = Field(
        default="medium",
        description="Question priority — high for critical missing info, low for nice-to-have"
    )


class ModuleGeneratorOutput(BaseModel):
    """Output from a module-specific generator."""
    module: Literal["hr", "invoice", "inventory"]
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    module_config: Dict[str, Any] = Field(default_factory=dict)
    clarifications_needed: List[ClarificationQuestion] = Field(default_factory=list)
    sdf_complete: bool = Field(
        default=False,
        description="True when the module has all information needed to produce a complete SDF section"
    )
    warnings: List[str] = Field(default_factory=list)


class IntegratorInput(BaseModel):
    project_name: str
    business_description: str
    shared_entities: List[str] = Field(default_factory=list)
    hr_output: Optional[ModuleGeneratorOutput] = None
    invoice_output: Optional[ModuleGeneratorOutput] = None
    inventory_output: Optional[ModuleGeneratorOutput] = None


class IntegratorOutput(BaseModel):
    project_name: str = Field(..., description="Name of the ERP project")
    modules: Dict[str, Any] = Field(default_factory=dict)
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    clarifications_needed: List[ClarificationQuestion] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class PipelineResult(BaseModel):
    """Result of the complete multi-agent pipeline."""
    success: bool
    sdf: Optional[Dict[str, Any]] = None
    sdf_complete: bool = Field(
        default=False,
        description="True when all modules signal SDF completeness and no clarifications remain"
    )
    distributor_output: Optional[DistributorOutput] = None
    module_outputs: Dict[str, ModuleGeneratorOutput] = Field(default_factory=dict)
    clarifications_needed: List[ClarificationQuestion] = Field(default_factory=list)
    token_usage: Dict[str, Any] = Field(
        default_factory=dict,
        description="Per-agent and total token usage for this pipeline run"
    )
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
