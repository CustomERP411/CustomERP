"""
Pydantic models for the /ai/clarify endpoint
"""

from pydantic import BaseModel
from typing import List, Dict

from .sdf import SystemDefinitionFile


class ClarificationAnswer(BaseModel):
    """Represents a single answer to a clarification question."""
    question_id: str
    answer: str


class ClarifyRequest(BaseModel):
    """The request body for the /ai/clarify endpoint."""
    business_description: str
    partial_sdf: SystemDefinitionFile
    answers: List[ClarificationAnswer]
