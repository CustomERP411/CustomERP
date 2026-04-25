"""
Pydantic models for the multi-agent SDF generation pipeline.
"""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class ModuleContext(BaseModel):
    """Context extracted for a specific module by the distributor."""
    enabled: bool = False
    changed: bool = True
    description: str = ""
    change_instructions: str = Field(
        default="",
        description="Explicit instructions for what the generator should add, modify, or remove (change mode only)",
    )
    entities_hint: List[str] = Field(default_factory=list)
    features: List[str] = Field(default_factory=list)


class DistributorOutput(BaseModel):
    project_name: str
    modules_needed: List[str] = Field(default_factory=list)
    shared_entities: List[str] = Field(default_factory=list)
    hr_context: ModuleContext = Field(default_factory=ModuleContext)
    invoice_context: ModuleContext = Field(default_factory=ModuleContext)
    inventory_context: ModuleContext = Field(default_factory=ModuleContext)
    clarifications_needed: List["ClarificationQuestion"] = Field(default_factory=list)
    unsupported_features: List[str] = Field(
        default_factory=list,
        description="Plain-English names of features the platform cannot provide",
    )
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


class AnswerIssue(BaseModel):
    """A single issue detected by the answer reviewer."""
    kind: Literal[
        "gibberish",
        "too_short",
        "all_basics_empty",
        "mismatch",
        "unsupported_feature",
    ] = Field(..., description="Category of issue detected")
    severity: Literal["block", "acknowledgeable"] = Field(
        ...,
        description="'block' issues must be fixed; 'acknowledgeable' can be accepted by the user",
    )
    question_id: Optional[str] = Field(
        default=None,
        description="ID of the offending business question (e.g. what_business). None for cross-cutting issues",
    )
    message: str = Field(
        ...,
        description="User-facing explanation in the project's language",
    )
    suggested_fix: Optional[str] = Field(
        default=None,
        description="Concrete suggestion for how the user can resolve the issue",
    )
    related_feature: Optional[str] = Field(
        default=None,
        description="Plain-English feature name when kind=unsupported_feature",
    )


class AnswerReview(BaseModel):
    """Output of the pre-distributor answer reviewer agent."""
    is_clear_to_proceed: bool = Field(
        default=True,
        description="True when no blocking issues remain (acknowledgeable issues may still exist if pre-acknowledged)",
    )
    issues: List[AnswerIssue] = Field(default_factory=list)
    summary: str = Field(default="", description="Short overall summary of the review in the project language")


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


class AgentStepLog(BaseModel):
    """Captured input/output for a single agent call in the pipeline."""
    agent: str
    model: str = ""
    temperature: float = 0.0
    prompt_text: str = Field(default="", description="Full prompt sent to the AI model")
    input_summary: Dict[str, Any] = Field(default_factory=dict)
    output_parsed: Dict[str, Any] = Field(default_factory=dict)
    raw_response: str = Field(default="", description="Truncated raw AI response text")
    tokens_in: int = 0
    tokens_out: int = 0
    duration_ms: int = 0


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
    step_logs: List[AgentStepLog] = Field(
        default_factory=list,
        description="Per-agent step logs for training data collection"
    )
    unsupported_features: List[str] = Field(default_factory=list)
    answer_review: Optional[AnswerReview] = Field(
        default=None,
        description="Output of the pre-distributor answer reviewer agent, when run",
    )
    halted_reason: Optional[Literal["answer_review", "clarifications"]] = Field(
        default=None,
        description="When the pipeline stops early, indicates which gate halted it",
    )
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
