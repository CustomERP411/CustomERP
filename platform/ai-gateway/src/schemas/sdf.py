"""
Pydantic models for the CustomERP generator SDF (Schema Definition Format).

These models represent the JSON that the *generator* consumes (see SDF_REFERENCE.md),
with optional `clarifications_needed` appended for the AI flow.

Important:
- The generated ERP has system-managed `id/created_at/updated_at` fields.
  The AI should NOT include them in `entity.fields`, but we still accept them and
  normalize them away in the service layer.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, AliasChoices, ConfigDict

# Allowed data types for generator fields
FieldType = Literal[
    "string",
    "text",
    "integer",
    "decimal",
    "number",
    "boolean",
    "date",
    "datetime",
    "reference",
    # Backwards-compat: some models may emit uuid; we normalize it to string.
    "uuid",
]


class ClarificationQuestion(BaseModel):
    """Represents a question to ask the user to resolve an ambiguity."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(..., description="Unique identifier for the question (e.g., 'q1').")
    question: str = Field(..., description="The text of the question to ask the user.")
    type: Literal["yes_no", "choice", "text"] = Field(..., description="The type of answer expected.")
    options: Optional[List[str]] = Field(default=None, description="Options for choice questions.")
    module: Optional[str] = Field(default=None, description="Source module (hr, invoice, inventory).")
    priority: Optional[Literal["high", "medium", "low"]] = Field(default="medium", description="Question priority.")


class EntityField(BaseModel):
    """Represents a field within an entity (generator format)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    name: str = Field(..., description="The programmatic name of the field (e.g., 'sku_code').")
    type: FieldType = Field(..., description="The data type of the field.")

    # Generator field properties
    label: Optional[str] = Field(default=None, description="UI label (optional).")
    required: bool = Field(default=False, description="Whether the field is required.")
    widget: Optional[str] = Field(default=None, description="UI widget override (optional).")

    # Reference fields
    reference_entity: Optional[str] = Field(
        default=None,
        description="Target entity slug for reference fields.",
        validation_alias=AliasChoices("reference_entity", "referenceEntity", "references"),
    )
    multiple: bool = Field(default=False, description="If true, stores an array of ids.")

    # Selectable/enum fields
    options: Optional[List[str]] = Field(
        default=None,
        description="Allowed values for selectable (enum) fields.",
        validation_alias=AliasChoices("options", "enum"),
    )

    # Validation rules (snake_case or camelCase)
    min_length: Optional[int] = Field(default=None, validation_alias=AliasChoices("min_length", "minLength"))
    max_length: Optional[int] = Field(default=None, validation_alias=AliasChoices("max_length", "maxLength"))
    min: Optional[float] = Field(default=None, validation_alias=AliasChoices("min", "min_value", "minValue"))
    max: Optional[float] = Field(default=None, validation_alias=AliasChoices("max", "max_value", "maxValue"))
    pattern: Optional[str] = Field(default=None, validation_alias=AliasChoices("pattern", "regex"))
    unique: Optional[bool] = Field(default=None)

    # Server-maintained fields:
    # When True, the field is maintained exclusively by server-side logic
    # (e.g. reservation/commitment workflows). It MUST be:
    #   - persisted as a column in the DB
    #   - emitted as read-only / omitted from create+update validation on the API
    #   - filtered out of editable inputs in the generated frontend (but may still be listed)
    # Never writable from UI or API payloads.
    computed: Optional[bool] = Field(
        default=None,
        description=(
            "If true, the field is maintained by server-side logic and must NOT be accepted "
            "from UI or API inputs. It is persisted in the DB but read-only to clients."
        ),
    )


class Entity(BaseModel):
    """Represents a business entity (API resource + UI pages)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    slug: str = Field(..., description="Unique identifier for the entity (e.g., 'products').")
    display_name: Optional[str] = Field(default=None, description="UI label shown in navigation/pages.")
    display_field: Optional[str] = Field(default=None, description="Human-readable field for references.")
    module: Optional[str] = Field(
        default=None,
        description="ERP module tag (inventory, invoice, hr, shared).",
        validation_alias=AliasChoices("module", "module_slug", "moduleSlug"),
    )

    # Optional generator configs (kept flexible; validated in generator)
    ui: Optional[Dict[str, Any]] = None
    list: Optional[Dict[str, Any]] = None
    features: Optional[Dict[str, Any]] = None
    bulk_actions: Optional[Dict[str, Any]] = None
    inventory_ops: Optional[Dict[str, Any]] = None
    labels: Optional[Dict[str, Any]] = None
    children: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional parent->children (line items) configuration for embedding child lists in the parent form UI.",
    )

    fields: List[EntityField] = Field(..., description="Entity fields (excluding system-managed fields).")


class SystemDefinitionFile(BaseModel):
    """Root model for the generator SDF + AI clarification questions."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    project_name: str = Field(
        ...,
        description="Human name for the generated ERP project.",
        validation_alias=AliasChoices("project_name", "projectName", "schema_name", "schemaName"),
    )
    modules: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Global module configuration and ERP module toggles (inventory, invoice, hr).",
    )
    entities: List[Entity] = Field(..., description="List of entity definitions.")

    # AI-only extension
    clarifications_needed: Optional[List[ClarificationQuestion]] = Field(
        default=None,
        description="Questions to ask the user to resolve ambiguities.",
    )

    # Pipeline metadata
    sdf_complete: Optional[bool] = Field(
        default=None,
        description="True when all domain models confirm the SDF is complete.",
    )
    token_usage: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Per-agent and total token usage for this pipeline run.",
    )

    warnings: Optional[List[str]] = Field(
        default=None,
        description="Non-blocking warnings and limitations (internal/logs only).",
    )
    unsupported_features: Optional[List[str]] = Field(
        default=None,
        description="Plain-English list of requested features the platform cannot yet provide.",
    )

    # Pre-distributor answer-quality review (Step 0 of the multi-agent pipeline).
    # Populated when the reviewer halts the pipeline so the frontend can show
    # actionable feedback per business question instead of generating an SDF.
    answer_review: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Output of the answer-reviewer agent when it halts the pipeline.",
    )
    halted_reason: Optional[Literal["answer_review", "clarifications"]] = Field(
        default=None,
        description="When the pipeline stops early, indicates which gate halted it.",
    )

    # Backwards-compat: old AI schema used `relations`; we accept but ignore.
    relations: Optional[List[Dict[str, Any]]] = Field(default=None)
