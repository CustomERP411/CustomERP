"""
Pydantic models for the /ai/precheck_modules endpoint (Plan D follow-up #8).

The wizard calls this endpoint with the user's plain-language business
description and the modules they have already selected. The endpoint runs a
single, lightweight LLM call against the `module_precheck_prompt.txt` prompt
and returns suggested modules (advisory only — the user accepts or dismisses
them).

The endpoint deliberately does **not** accept `default_question_answers`
or wizard metadata so platform-meta cues (e.g. "5 people will use the
system") cannot trigger module suggestions.
"""

from pydantic import BaseModel, Field, AliasChoices
from typing import List


SUPPORTED_MODULES = ("hr", "invoice", "inventory")
SUPPORTED_CONFIDENCES = ("high", "medium", "low")


class InferredModule(BaseModel):
    """A single module the LLM thinks the user implicitly described but did
    not select."""

    module: str = Field(
        ...,
        description="Module slug — must be one of: hr, invoice, inventory.",
    )
    reason: str = Field(
        ...,
        min_length=1,
        max_length=400,
        description=(
            "One short SMB-friendly sentence in the project language explaining "
            "WHY the description implies this module."
        ),
    )
    confidence: str = Field(
        default="medium",
        description="Confidence: 'high', 'medium', or 'low'.",
    )


class PrecheckRequest(BaseModel):
    """Request body for POST /ai/precheck_modules."""

    business_description: str = Field(
        ...,
        min_length=10,
        description="The user's plain-language business description.",
    )
    selected_modules: List[str] = Field(
        default_factory=list,
        description="Modules the user has already selected.",
        validation_alias=AliasChoices("selected_modules", "selectedModules"),
    )
    language: str = Field(
        default="en",
        description="Project language ('en' or 'tr'). Drives reason language.",
    )


class PrecheckResponse(BaseModel):
    """Response body for POST /ai/precheck_modules."""

    inferred_modules: List[InferredModule] = Field(
        default_factory=list,
        description=(
            "Modules the LLM inferred the user described but did not select. "
            "Empty list when nothing matches (the safe / conservative answer)."
        ),
    )
