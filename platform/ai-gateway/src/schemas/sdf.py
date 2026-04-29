"""
Pydantic models for the CustomERP generator SDF (Schema Definition Format).

These models represent the JSON that the *generator* consumes (see SDF_REFERENCE.md),
with optional `clarifications_needed` appended for the AI flow.

Important:
- The generated ERP has system-managed `id/created_at/updated_at` fields.
  The AI should NOT include them in `entity.fields`, but we still accept them and
  normalize them away in the service layer.

Coherence layer:
- Entities may declare `relations[]` to express cross-feature rules (reference
  contracts, status propagation, derived fields, invariants, permission scopes).
  See SDF_REFERENCE.md "Coherence layer" and module_coherence_design.md for the
  design intent. Pydantic validates only the *shape* of relations entries; the
  *semantics* are interpreted by the runtime mixin layer (Plan B follow-up #2).
"""

from typing import Any, Annotated, ClassVar, Dict, List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field, AliasChoices, ConfigDict, model_validator

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

    # Plan E G3 / Plan G D1 — conditional UI visibility. The field is
    # rendered only when the predicate matches another field on the same
    # record. Plan G generalizes the operator set:
    #
    #   { "field": "<sibling_field_name>", "equals":     <scalar> }
    #   { "field": "<sibling_field_name>", "not_equals": <scalar> }
    #   { "field": "<sibling_field_name>", "in":         [<scalar>, ...] }
    #   { "field": "<sibling_field_name>", "not_in":     [<scalar>, ...] }
    #   { "field": "<sibling_field_name>", "is_set":     true|false }
    #   { "field": "<sibling_field_name>", "is_unset":   true|false }
    #
    # Exactly one comparator key per predicate. The frontend's
    # DynamicForm.isFieldVisible interprets the same operators; the
    # server-side `_relInv_conditional_required` invariant uses identical
    # semantics so direct-API writes can't bypass form-level rules.
    visibility_when: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Optional UI visibility predicate: render this field only when "
            "the named sibling field matches the comparator. Supported "
            "operators: equals, not_equals, in, not_in, is_set, is_unset."
        ),
    )

    # Default value for the field. Carried as-is into the frontend form so
    # new records pre-fill, and surfaced in the backend validator as the
    # baseline when the payload omits the column. Strings, booleans and
    # numbers are all valid.
    default: Optional[Any] = Field(
        default=None,
        description="Optional default value for the field (string/number/boolean).",
    )

    # Plan F B1 — codegen-time path-resolved default. Mutually exclusive
    # with `default`. The path begins with `modules.<module>.<key>...`; the
    # assembler walks the SDF modules tree at build time and emits the
    # resolved value as the field's defaultValue. Use this for project-wide
    # configurable defaults (project tax rate, default currency, default
    # payment terms, ...) so the wizard answer flows in automatically and
    # the user can still override per record.
    default_from: Optional[str] = Field(
        default=None,
        description=(
            "Codegen-time default-resolution path, e.g. 'modules.invoice.tax_rate'. "
            "Mutually exclusive with `default`."
        ),
    )

    # Optional inline help text for the field (rendered under the input).
    help: Optional[str] = Field(
        default=None,
        description="Optional inline help text rendered under the field input.",
    )

    @model_validator(mode="after")
    def _validate_computed_constraints(self) -> "EntityField":
        # A server-maintained field cannot be required as user input: there is no
        # valid input to satisfy a required check on a field that ignores user input.
        if self.computed is True and self.required is True:
            raise ValueError(
                f"Field '{self.name}' has computed=True and required=True; "
                "computed (server-maintained) fields cannot be marked required."
            )
        # Plan F B1 — `default` and `default_from` are mutually exclusive.
        # Emitting both is almost always a mistake (the literal silently wins
        # at codegen) and the inconsistency is hard to debug. Reject up
        # front with a clear message.
        if self.default is not None and self.default_from is not None:
            raise ValueError(
                f"Field '{self.name}' has both `default` and `default_from`; "
                "set exactly one. Use `default` for a literal initial value or "
                "`default_from` to resolve from the SDF modules tree at codegen."
            )
        # Plan F B1 — shape check on default_from. Must be a non-empty
        # dot-separated path. We don't resolve here (the SDF root isn't
        # available at field-validation time); the assembler handles
        # resolution + warns on unresolved paths.
        if self.default_from is not None:
            if not isinstance(self.default_from, str) or not self.default_from.strip():
                raise ValueError(
                    f"Field '{self.name}' has invalid `default_from`; expected a "
                    "non-empty dot-path string (e.g. 'modules.invoice.tax_rate')."
                )
        # Plan G D1 — visibility_when shape check. Must declare a sibling
        # field name plus EXACTLY ONE comparator from the supported set,
        # with the right value type for that comparator. The cross-entity
        # check (does `field` reference a real sibling?) lives in
        # sdfValidation.js — at the field level we don't have access to the
        # entity's other fields.
        if self.visibility_when is not None:
            self._validate_visibility_when(self.visibility_when)
        return self

    # Plan G D1 — operator set + per-operator value-type rules. Kept as a
    # plain method (not a separate validator) so the error message can
    # reference `self.name` and we control the exact rejection wording.
    # ClassVar to keep Pydantic from treating the constant as a field.
    _VISIBILITY_OPERATORS: ClassVar[Tuple[str, ...]] = (
        "equals",
        "not_equals",
        "in",
        "not_in",
        "is_set",
        "is_unset",
    )

    def _validate_visibility_when(self, predicate: Dict[str, Any]) -> None:
        if not isinstance(predicate, dict):
            raise ValueError(
                f"Field '{self.name}' visibility_when must be an object; got "
                f"{type(predicate).__name__}."
            )
        src = predicate.get("field")
        if not isinstance(src, str) or not src.strip():
            raise ValueError(
                f"Field '{self.name}' visibility_when must contain a non-empty "
                "string `field` naming the sibling field to compare."
            )
        # Identify comparator keys (everything other than 'field').
        comparators = [k for k in predicate.keys() if k != "field"]
        if not comparators:
            raise ValueError(
                f"Field '{self.name}' visibility_when must contain exactly one "
                "comparator key (equals, not_equals, in, not_in, is_set, is_unset)."
            )
        if len(comparators) > 1:
            raise ValueError(
                f"Field '{self.name}' visibility_when has multiple comparators "
                f"({sorted(comparators)}); use exactly one."
            )
        comparator = comparators[0]
        if comparator not in self._VISIBILITY_OPERATORS:
            raise ValueError(
                f"Field '{self.name}' visibility_when uses unknown comparator "
                f"'{comparator}'; supported: {list(self._VISIBILITY_OPERATORS)}."
            )
        value = predicate[comparator]
        if comparator in ("equals", "not_equals"):
            # Scalars only — strings, numbers, bools. Lists/dicts/None are
            # ambiguous (use is_set/is_unset for None and `in` for lists).
            if isinstance(value, (list, dict)) or value is None:
                raise ValueError(
                    f"Field '{self.name}' visibility_when '{comparator}' value "
                    "must be a scalar (string, number, or boolean)."
                )
        elif comparator in ("in", "not_in"):
            if not isinstance(value, list) or len(value) == 0:
                raise ValueError(
                    f"Field '{self.name}' visibility_when '{comparator}' value "
                    "must be a non-empty list."
                )
        elif comparator in ("is_set", "is_unset"):
            if not isinstance(value, bool):
                raise ValueError(
                    f"Field '{self.name}' visibility_when '{comparator}' value "
                    "must be a boolean."
                )


# --- Coherence layer (entity.relations[]) ----------------------------------
#
# Five primitives keyed by `kind`. SDF-time validation enforces the shape of
# each entry; the runtime mixin layer (Plan B follow-up #2) interprets the
# semantics. See SDF_REFERENCE.md "Coherence layer" for the full reference.


class _RelationBase(BaseModel):
    """Common fields for every relation primitive."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    when: Optional[str] = Field(
        default=None,
        description=(
            "Optional gating condition; expected shape 'modules.<path>.enabled'. "
            "Runtime evaluates the toggle; SDF-time validation only checks shape."
        ),
    )


class ReferenceContractRelation(_RelationBase):
    """Upgrade a free-text field on this entity into a real reference to a target entity."""

    kind: Literal["reference_contract"]
    field: str = Field(..., description="Name of an existing field on this entity to upgrade.")
    target: str = Field(
        ...,
        description=(
            "Target entity slug. May be a user-defined slug or a system slug "
            "(__erp_users, __erp_groups, __erp_permissions)."
        ),
    )


class StatusPropagationRelation(_RelationBase):
    """When this entity transitions between statuses, fire an effect on a target entity."""

    kind: Literal["status_propagation"]
    on: Dict[str, Any] = Field(
        ...,
        description="Trigger spec: { field, from?, to }. Field defaults to 'status' when omitted.",
    )
    effect: Dict[str, Any] = Field(
        ...,
        description="Effect spec: { action, target_entity, set_fields?, ... }.",
    )
    reverse: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Reverse spec for the opposite transition. Same shape as effect plus its own 'on'.",
    )


class DerivedFieldRelation(_RelationBase):
    """Name a computed field on this entity and the formula that produces it."""

    kind: Literal["derived_field"]
    computed_field: str = Field(
        ...,
        description="Name of a field on this entity. Must have computed=True.",
    )
    formula: str = Field(
        ...,
        description="Human-readable expression. Runtime layer parses; SDF-time only checks non-empty.",
    )


class InvariantRelation(_RelationBase):
    """A validation rule that fires when the capability is on."""

    kind: Literal["invariant"]
    rule: str = Field(..., description="Human-readable expression interpreted by runtime layer.")
    error_key: Optional[str] = Field(
        default=None,
        description="Localization key for the error message.",
    )
    severity: Literal["block", "warn"] = Field(
        default="block",
        description="'block' rejects the operation; 'warn' records a non-blocking warning.",
    )


class PermissionScopeRelation(_RelationBase):
    """Declares which permission and scope are required to perform actions on this entity."""

    kind: Literal["permission_scope"]
    permission: str = Field(..., description="Permission key (e.g. 'hr.leaves.approve').")
    scope: Literal["self", "department", "manager_chain", "module", "all"] = Field(
        ...,
        description="One of self / department / manager_chain / module / all.",
    )
    actions: List[str] = Field(
        default_factory=list,
        description="Action selectors (e.g. 'update.status:Approved'). Empty = applies to all actions.",
    )


EntityRelation = Annotated[
    Union[
        ReferenceContractRelation,
        StatusPropagationRelation,
        DerivedFieldRelation,
        InvariantRelation,
        PermissionScopeRelation,
    ],
    Field(discriminator="kind"),
]


# --- UI sections (entity.ui.sections) --------------------------------------
#
# Optional opt-in primitive that lets each entity declare an ordered form-page
# layout. When present, the form-page generator replaces its default layout
# (header -> DynamicForm -> companion -> CHILD_SECTIONS -> ROLLUP_SECTIONS ->
# totals) with the explicit section order. Useful for header-line entities
# (invoices, POs, GRNs, cycle sessions) where the line items ARE the bread
# and butter and shouldn't sink to the bottom of the form.
#
# Pydantic enforces shape (one comparator per section, kind discrimination,
# heading dot-key shape). Cross-entity references (field exists, child slug
# matches `entity.children[]`) are checked in the entity-level validator
# below, where we can see the entity's other fields/children.


class _SectionBase(BaseModel):
    """Common fields for every form-section primitive."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    id: Optional[str] = Field(
        default=None,
        description="Optional opaque identifier for the section (used for tests / debugging).",
    )


class FieldsSection(_SectionBase):
    """Group of parent-entity fields rendered together with an optional heading."""

    kind: Literal["fields"]
    heading: Optional[str] = Field(
        default=None,
        description=(
            "Optional i18n key for the group heading (e.g. 'form.sections.identity'). "
            "Non-EN projects: must be a dot-keyed translation key, not raw English."
        ),
    )
    fields: List[str] = Field(
        ...,
        description="Ordered list of field names from this entity's `fields[]` to render in this group.",
    )


class LineItemsSection(_SectionBase):
    """Place a single child-entity table at this position in the form."""

    kind: Literal["line_items"]
    child: str = Field(
        ...,
        description=(
            "Slug of the child entity (must match `entity.children[*].entity`). "
            "When `entity.children` declares multiple FKs to the same child, the "
            "first match wins; use `entity.children[*].label` overrides to "
            "disambiguate."
        ),
    )
    heading: Optional[str] = Field(
        default=None,
        description="Optional i18n key for the section heading (overrides the auto-derived label).",
    )


class RollupsSection(_SectionBase):
    """Place the auto-derived inbound rollup card at this position."""

    kind: Literal["rollups"]


class TotalsSection(_SectionBase):
    """Place the invoice totals card at this position. No-op outside invoice header."""

    kind: Literal["totals"]


class StockAvailabilitySection(_SectionBase):
    """Place the stock availability band at this position. No-op without reservation fields."""

    kind: Literal["stock_availability"]


class CompanionUserSection(_SectionBase):
    """Place the HR companion-login panel at this position. No-op outside HR employees entity."""

    kind: Literal["companion_user"]


EntityUISection = Annotated[
    Union[
        FieldsSection,
        LineItemsSection,
        RollupsSection,
        TotalsSection,
        StockAvailabilitySection,
        CompanionUserSection,
    ],
    Field(discriminator="kind"),
]


# Dot-keyed i18n key shape (mirrors sdfLocalizationLint DOT_KEY_RE). Used to
# warn early on raw-English headings that would leak in non-EN projects.
# Case-insensitive so dictionary keys like `form.sections.lineItems` are
# accepted, matching the JS-side regex in sdfLocalizationLint.
_HEADING_DOT_KEY_RE = r"(?i)^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$"


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

    # Plan H F4 — per-entity overrides for inbound rollup sections rendered
    # on this entity's detail page. Keys are SOURCE-entity slugs (the entity
    # that owns the foreign-key field pointing at this entity); values are
    # either `False` to suppress the auto-derived rollup, or an object with
    # optional `label` (str), `columns` (list of str), and `foreign_key`
    # (str) to customize the auto-derive output. Auto-derive is the default;
    # overrides win.
    #
    # Example:
    #   customers.rollups: { invoices: { columns: ["invoice_number",
    #                                              "issue_date",
    #                                              "status",
    #                                              "grand_total"] } }
    rollups: Optional[Dict[str, Any]] = Field(
        default=None,
        description=(
            "Optional per-entity overrides for inbound rollup sections rendered "
            "on this entity's detail page. Keys are source-entity slugs; values "
            "are either `false` to suppress the auto-derived rollup, or an "
            "object {label?, columns?, foreign_key?} to customize it."
        ),
    )

    fields: List[EntityField] = Field(..., description="Entity fields (excluding system-managed fields).")

    # Coherence layer entries: see SDF_REFERENCE.md "Coherence layer".
    # Discriminated union by `kind`; shape is enforced here, semantics by the
    # runtime mixin layer (Plan B follow-up #2).
    relations: Optional[List[EntityRelation]] = Field(
        default=None,
        description=(
            "Optional list of coherence-layer rules (reference_contract, status_propagation, "
            "derived_field, invariant, permission_scope). See SDF_REFERENCE.md."
        ),
    )

    @model_validator(mode="after")
    def _validate_ui_sections(self) -> "Entity":
        # `ui` stays a free-form dict for legacy keys (search, csv_import, ...).
        # Only the `sections` key is shape-validated. When absent, the form-page
        # generator uses its default layout (byte-for-byte preserved).
        if not isinstance(self.ui, dict):
            return self
        raw_sections = self.ui.get("sections")
        if raw_sections is None:
            return self
        if not isinstance(raw_sections, list):
            raise ValueError(
                f"Entity '{self.slug}': `ui.sections` must be a list when present."
            )

        import re

        from pydantic import TypeAdapter

        try:
            adapter = TypeAdapter(List[EntityUISection])
            sections = adapter.validate_python(raw_sections)
        except Exception as err:
            raise ValueError(
                f"Entity '{self.slug}': `ui.sections` failed shape validation: {err}"
            ) from err

        # Cross-reference checks (we have access to fields + children here).
        field_names = {f.name for f in self.fields}
        child_slugs: set[str] = set()
        if isinstance(self.children, list):
            for ch in self.children:
                if not isinstance(ch, dict):
                    continue
                slug = ch.get("entity") or ch.get("slug")
                if isinstance(slug, str) and slug.strip():
                    child_slugs.add(slug.strip())

        seen_fields: Dict[str, int] = {}
        for idx, section in enumerate(sections):
            if isinstance(section, FieldsSection):
                if not section.fields:
                    raise ValueError(
                        f"Entity '{self.slug}': `ui.sections[{idx}]` (fields) must "
                        "list at least one field."
                    )
                for fname in section.fields:
                    if not isinstance(fname, str) or not fname.strip():
                        raise ValueError(
                            f"Entity '{self.slug}': `ui.sections[{idx}].fields` "
                            "entries must be non-empty strings."
                        )
                    if fname not in field_names:
                        raise ValueError(
                            f"Entity '{self.slug}': `ui.sections[{idx}]` references "
                            f"field '{fname}' that is not declared on this entity."
                        )
                    if fname in seen_fields:
                        raise ValueError(
                            f"Entity '{self.slug}': field '{fname}' appears in "
                            f"`ui.sections[{seen_fields[fname]}]` and "
                            f"`ui.sections[{idx}]`; each field can be placed in "
                            "at most one section."
                        )
                    seen_fields[fname] = idx
                if section.heading is not None:
                    if not isinstance(section.heading, str) or not section.heading.strip():
                        raise ValueError(
                            f"Entity '{self.slug}': `ui.sections[{idx}].heading` "
                            "must be a non-empty string when present."
                        )
                    if not re.match(_HEADING_DOT_KEY_RE, section.heading):
                        raise ValueError(
                            f"Entity '{self.slug}': `ui.sections[{idx}].heading` "
                            f"must be an i18n dot-key (e.g. 'form.sections.identity'); "
                            f"got '{section.heading}'."
                        )
            elif isinstance(section, LineItemsSection):
                if not section.child or not section.child.strip():
                    raise ValueError(
                        f"Entity '{self.slug}': `ui.sections[{idx}].child` must "
                        "be a non-empty child entity slug."
                    )
                if section.child not in child_slugs:
                    raise ValueError(
                        f"Entity '{self.slug}': `ui.sections[{idx}].child` "
                        f"references '{section.child}' but no entry in "
                        "`children[]` declares that slug."
                    )
                if section.heading is not None:
                    if not re.match(_HEADING_DOT_KEY_RE, section.heading):
                        raise ValueError(
                            f"Entity '{self.slug}': `ui.sections[{idx}].heading` "
                            f"must be an i18n dot-key; got '{section.heading}'."
                        )

        return self

    @model_validator(mode="after")
    def _validate_rollups(self) -> "Entity":
        if self.rollups is None:
            return self
        if not isinstance(self.rollups, dict):
            raise ValueError(
                f"Entity '{self.slug}': `rollups` must be a mapping of source-entity slug -> override."
            )
        for raw_key, raw_value in self.rollups.items():
            if not isinstance(raw_key, str) or not raw_key.strip():
                raise ValueError(
                    f"Entity '{self.slug}': `rollups` keys must be non-empty strings."
                )
            if raw_value is False:
                continue
            if raw_value is True:
                raise ValueError(
                    f"Entity '{self.slug}': `rollups['{raw_key}']` must be `false` to suppress "
                    "or an object with override fields; `true` is not a valid value."
                )
            if not isinstance(raw_value, dict):
                raise ValueError(
                    f"Entity '{self.slug}': `rollups['{raw_key}']` must be `false` or an object."
                )
            allowed = {"label", "columns", "foreign_key"}
            extras = set(raw_value.keys()) - allowed
            if extras:
                raise ValueError(
                    f"Entity '{self.slug}': `rollups['{raw_key}']` has unsupported keys "
                    f"{sorted(extras)}; allowed keys are {sorted(allowed)}."
                )
            if "label" in raw_value:
                if not isinstance(raw_value["label"], str) or not raw_value["label"].strip():
                    raise ValueError(
                        f"Entity '{self.slug}': `rollups['{raw_key}'].label` must be a non-empty string."
                    )
            if "foreign_key" in raw_value:
                fk = raw_value["foreign_key"]
                if not isinstance(fk, str) or not fk.strip():
                    raise ValueError(
                        f"Entity '{self.slug}': `rollups['{raw_key}'].foreign_key` must be a non-empty string."
                    )
            if "columns" in raw_value:
                cols = raw_value["columns"]
                if not isinstance(cols, list) or len(cols) == 0:
                    raise ValueError(
                        f"Entity '{self.slug}': `rollups['{raw_key}'].columns` must be a non-empty list."
                    )
                for c in cols:
                    if not isinstance(c, str) or not c.strip():
                        raise ValueError(
                            f"Entity '{self.slug}': `rollups['{raw_key}'].columns` entries must "
                            "be non-empty strings."
                        )
        return self


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
    inferred_dropped_modules: Optional[List[str]] = Field(
        default=None,
        description=(
            "Plan D follow-up #8 audit trail: modules the distributor inferred "
            "from the description but that were silently dropped by the "
            "user-selected_modules clamp. Surfaced in the generation report."
        ),
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

    # Backwards-compat: old AI schema used a root-level `relations` array.
    # The new coherence layer puts relations on each Entity; root-level relations
    # are accepted but ignored. A deprecation warning is appended into `warnings`
    # when this field is present so callers can spot the legacy shape.
    relations: Optional[List[Dict[str, Any]]] = Field(default=None)

    @model_validator(mode="after")
    def _emit_root_relations_deprecation(self) -> "SystemDefinitionFile":
        if self.relations:
            msg = (
                "Deprecated: root-level `relations` is ignored. "
                "Move coherence-layer rules onto each entity's `relations[]` array. "
                "See SDF_REFERENCE.md 'Coherence layer'."
            )
            warnings = list(self.warnings) if self.warnings else []
            if msg not in warnings:
                warnings.append(msg)
            self.warnings = warnings
        return self
