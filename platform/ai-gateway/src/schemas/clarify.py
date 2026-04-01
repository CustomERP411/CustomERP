"""
Pydantic models for the /ai/clarify endpoint

Supports the stateless feedback loop where:
1. Cycle 1: POST /ai/analyze -> returns SDF + clarifications_needed
2. Cycle 2+: POST /ai/clarify -> user answers + prior SDF -> refined SDF
"""

from pydantic import BaseModel, Field
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
        description="The SDF state from the previous cycle (JSON object)."
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
    
    def get_merged_context(self) -> Dict[str, Any]:
        """Merge prior_context with legacy answers into a single dict."""
        merged = dict(self.prior_context)
        if self.answers:
            for ans in self.answers:
                merged[ans.question_id] = ans.answer
        return merged
