"""
Pydantic models for the /ai/clarify endpoint
"""

from pydantic import BaseModel
from typing import List, Optional

from .sdf import SystemDefinitionFile


class ClarificationAnswer(BaseModel):
    """Represents a single answer to a clarification question."""
    question_id: str
    answer: str


class ClarifyRequest(BaseModel):
    """The request body for the /ai/clarify endpoint."""
    # Backwards/forwards compatibility:
    # - Sprint plan originally omitted business_description, but our clarify prompt benefits from it.
    # - Keep it optional so clients can send either {partial_sdf, answers} or {business_description, partial_sdf, answers}.
    business_description: Optional[str] = None
    partial_sdf: SystemDefinitionFile
    answers: List[ClarificationAnswer]
