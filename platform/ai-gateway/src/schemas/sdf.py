"""
Pydantic models for the System Definition File (SDF)

This file defines the data structures that represent the output of the AI.
The SDF describes the entities, fields, and relationships of the generated ERP.
"""

from pydantic import BaseModel, Field
from typing import List, Literal, Optional

# Allowed data types for entity fields
FieldType = Literal[
    "string",
    "integer",
    "decimal",
    "boolean",
    "date",
    "uuid",
    "reference"
]

class EntityField(BaseModel):
    """Represents a single field within an entity"""
    name: str = Field(..., description="The programmatic name of the field (e.g., 'product_name')")
    type: FieldType = Field(..., description="The data type of the field")
    required: bool = Field(True, description="Whether the field is mandatory")
    description: str = Field(..., description="A brief, user-friendly description of the field")
    is_primary_key: Optional[bool] = Field(False, description="Indicates if this field is the primary key")
    is_foreign_key: Optional[bool] = Field(False, description="Indicates if this field is a foreign key")
    references: Optional[str] = Field(None, description="If a foreign key, slug of the entity it references")

class Entity(BaseModel):
    """Represents a business entity (like a database table)"""
    slug: str = Field(..., description="A unique, URL-friendly identifier for the entity (e.g., 'products')")
    display_name: str = Field(..., description="A user-friendly name for the entity (e.g., 'Product')")
    description: str = Field(..., description="A summary of the entity's purpose")
    fields: List[EntityField] = Field(..., description="The list of fields belonging to this entity")

class Relation(BaseModel):
    """Represents a relationship between two entities"""
    from_entity: str = Field(..., description="The slug of the source entity")
    to_entity: str = Field(..., description="The slug of the target entity")
    type: Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many"] = Field(..., description="The cardinality of the relationship")
    description: str = Field(..., description="A brief description of the relationship")

class ClarificationQuestion(BaseModel):
    """Represents a question to ask the user to resolve an ambiguity."""
    id: str = Field(..., description="A unique identifier for the question (e.g., 'q1').")
    question: str = Field(..., description="The text of the question to ask the user.")
    type: Literal["yes_no", "choice", "text"] = Field(..., description="The type of answer expected.")

class SystemDefinitionFile(BaseModel):
    """The root model for the System Definition File"""
    schema_name: str = Field(..., description="A descriptive name for the entire schema (e.g., 'Inventory Management System')")
    entities: List[Entity] = Field(..., description="A list of all entities in the system")
    relations: List[Relation] = Field(default=[], description="A list of all relationships between entities")
    clarifications_needed: Optional[List[ClarificationQuestion]] = Field(default=None, description="A list of questions to ask the user to resolve ambiguities.")
