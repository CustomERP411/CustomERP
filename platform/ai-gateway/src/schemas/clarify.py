"""
Pydantic models for the /ai/clarify endpoint

Supports the stateless feedback loop where:
1. Cycle 1: POST /ai/analyze -> returns SDF + clarifications_needed
2. Cycle 2+: POST /ai/clarify -> user answers + prior SDF -> refined SDF
"""

from pydantic import BaseModel, Field, AliasChoices
from typing import Any, Dict, List, Optional

from .sdf import SystemDefinitionFile


class ClarificationAnswer(BaseModel):
    """Represents a single answer to a clarification question."""
    question_id: str
    answer: str


class ClarifyRequest(BaseModel):
    """The request body for the /ai/clarify endpoint.
    
    Implements the stateless feedback loop:
    - business_description: Original user input (for context continuity)
    - prefilled_sdf: The SDF state from the previous cycle (Cycle 1 output)
    - default_question_answers: Original wizard answers (hr_work_days, etc.)
    - prior_context: User's answers to clarifying questions (maps question_id -> answer)
    - answers: Legacy format for backwards compatibility
    """
    business_description: str = Field(
        ...,
        min_length=10,
        description="The original business description from Cycle 1."
    )
    prefilled_sdf: Dict[str, Any] = Field(
        ...,
        description="The SDF state from the previous cycle (JSON object).",
        validation_alias=AliasChoices("prefilled_sdf", "partial_sdf"),
    )
    default_question_answers: Dict[str, Any] = Field(
        default_factory=dict,
        description="Original mandatory wizard answers (hr_work_days, invoice_currency, etc.)."
    )
    prior_context: Dict[str, Any] = Field(
        default_factory=dict,
        description="User's answers to clarifying questions, keyed by question_id."
    )
    # Legacy compatibility: accept answers as list
    answers: Optional[List[ClarificationAnswer]] = Field(
        default=None,
        description="[LEGACY] List of answers. Use prior_context instead."
    )
    language: str = Field(
        default="en",
        description="Project language code ('en' or 'tr'). Controls the language of the generated SDF text and clarification questions."
    )
    selected_modules: Optional[List[str]] = Field(
        default=None,
        description=(
            "Authoritative list of modules the user selected in the UI. When provided, "
            "re-analysis will only keep entities inside this set."
        ),
        validation_alias=AliasChoices("selected_modules", "selectedModules"),
    )
    
    def get_merged_context(self) -> Dict[str, Any]:
        """Merge original wizard answers + clarification answers into one dict.
        
        Wizard answers go first so clarification answers can override them.
        """
        merged = dict(self.default_question_answers)
        merged.update(self.prior_context)
        if self.answers:
            for ans in self.answers:
                merged[ans.question_id] = ans.answer
        return merged
