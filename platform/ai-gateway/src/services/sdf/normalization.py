"""SDF normalization — transforms raw AI output into generator-compatible shape."""

import re
from copy import deepcopy


def normalize_generator_sdf(data: dict, request_text: str = "") -> dict:
    """
    Best-effort normalization so older AI outputs (schema_name/id/references/relations)
    become a generator SDF compatible with SDF_REFERENCE.md.
    """
    if not isinstance(data, dict):
        return data

    # Collect non-blocking warnings to display to the user (platform UI).
    # Note: Pydantic will drop this unless SystemDefinitionFile includes it.
    warnings = data.get("warnings")
    normalized_warnings: list[str] = []
    if isinstance(warnings, list):
        for w in warnings:
            try:
                ws = str(w).strip()
            except Exception:
                ws = ""
            if ws:
                normalized_warnings.append(ws)

    # Best-effort user-request warnings (features outside generator scope)
    req_text = str(request_text or "")
    chatbot_requested = False
    if req_text:
        chatbot_requested = bool(
            re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", req_text, flags=re.IGNORECASE)
        )
        if chatbot_requested:
            normalized_warnings.append(
                "Chatbot requested: CustomERP currently does not generate an in-app chatbot UI/feature. "
                "This request will be ignored (you can integrate a chatbot manually after generation)."
            )

    # Normalize clarifications_needed:
    # Some model outputs accidentally return a list of strings instead of question objects.
    # Convert strings (and partial dicts) into the required {id, question, type, options?} shape.
    cl = data.get("clarifications_needed")
    if isinstance(cl, list):
        normalized_questions = []
        for idx, q in enumerate(cl):
            qid = f"q{idx + 1}"
            if isinstance(q, str):
                text = q.strip()
                if not text:
                    continue
                # Do not ask clarifications about out-of-scope features we explicitly ignore (e.g., chatbot).
                if re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", text, flags=re.IGNORECASE):
                    normalized_warnings.append(
                        "Ignored a clarification question about chatbot because chatbot is not supported by the generator."
                    )
                    continue
                normalized_questions.append({"id": qid, "question": text, "type": "text"})
                continue

            if isinstance(q, dict):
                raw_id = q.get("id") or q.get("question_id") or q.get("questionId") or qid
                raw_text = q.get("question") or q.get("text") or q.get("question_text") or q.get("questionText") or q.get("prompt") or ""
                raw_type = q.get("type") or q.get("question_type") or q.get("questionType") or "text"
                # Filter chatbot clarifications (unsupported)
                if re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", str(raw_id), flags=re.IGNORECASE) or re.search(
                    r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", str(raw_text), flags=re.IGNORECASE
                ):
                    normalized_warnings.append(
                        "Ignored a clarification question about chatbot because chatbot is not supported by the generator."
                    )
                    continue
                qtype = str(raw_type).strip()
                if qtype not in ("yes_no", "choice", "text"):
                    qtype = "text"
                out = {"id": str(raw_id), "question": str(raw_text), "type": qtype}
                opts = q.get("options")
                if isinstance(opts, list) and opts:
                    out["options"] = [str(o) for o in opts]
                if out["question"].strip():
                    normalized_questions.append(out)
                continue

            # Unknown type -> ignore
            continue

        data["clarifications_needed"] = normalized_questions

    # If chatbot was requested, ensure we don't return any chatbot-related questions (even if they slipped through).
    if chatbot_requested and isinstance(data.get("clarifications_needed"), list):
        before = len(data["clarifications_needed"])
        filtered = []
        for q in data["clarifications_needed"]:
            if not isinstance(q, dict):
                continue
            qid = str(q.get("id") or "")
            qtext = str(q.get("question") or "")
            if re.search(r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", qid, flags=re.IGNORECASE) or re.search(
                r"\bchat\s*bot\b|\bchatbot\b|sohbet\s*botu|sohbetbot", qtext, flags=re.IGNORECASE
            ):
                continue
            filtered.append(q)
        if len(filtered) != before:
            normalized_warnings.append(
                "Chatbot is unsupported, so chatbot clarification questions were removed."
            )
        data["clarifications_needed"] = filtered

    # Old -> new: schema_name => project_name
    if "project_name" not in data and "schema_name" in data and isinstance(data.get("schema_name"), str):
        data["project_name"] = data.get("schema_name")
    # Drop old top-level keys so the returned JSON matches generator SDF shape
    data.pop("schema_name", None)
    data.pop("schemaName", None)

    entities = data.get("entities")
    if not isinstance(entities, list):
        entities = []
        data["entities"] = entities
    if isinstance(entities, list):
        for ent in entities:
            if not isinstance(ent, dict):
                continue

            ent_slug = str(ent.get("slug") or "").strip() or "(unknown-entity)"

            # Defensive: these are defined as dicts in the SDF schema. If the model emits a wrong type,
            # drop it and warn instead of failing validation.
            dict_props = ("ui", "list", "features", "bulk_actions", "inventory_ops", "labels")
            for prop in dict_props:
                if prop in ent and ent.get(prop) is not None and not isinstance(ent.get(prop), dict):
                    normalized_warnings.append(
                        f"Invalid `{ent_slug}.{prop}` type ({type(ent.get(prop)).__name__}); expected object. "
                        f"It will be ignored."
                    )
                    ent[prop] = None

            # Warn on (currently) unsupported inventory_ops configs that models sometimes invent.
            inv = ent.get("inventory_ops")
            if isinstance(inv, dict):
                # If inventory_ops is present without a master switch, infer intent and enable it.
                if "enabled" not in inv:
                    has_config = any(key for key in inv.keys() if key != "enabled")
                    if has_config:
                        inv["enabled"] = True

                # If the model provided a sell/issue config object but forgot `enabled: true`,
                # infer intent and enable it. (Issue/Sell defaults to disabled in generator config.)
                if inv.get("enabled") is True:
                    for issue_key in ("issue", "sell"):
                        cfg = inv.get(issue_key)
                        if isinstance(cfg, dict) and "enabled" not in cfg:
                            cfg["enabled"] = True

                for op_key in ("receive", "adjust", "transfer", "issue", "sell"):
                    op_cfg = inv.get(op_key)
                    if not isinstance(op_cfg, dict):
                        continue
                    for bad_key in ("target_quantity_field", "source_quantity_field", "product_field", "item_field"):
                        if bad_key in op_cfg:
                            normalized_warnings.append(
                                f"Unsupported inventory_ops config: `{ent_slug}.inventory_ops.{op_key}.{bad_key}` "
                                f"is not supported by the generator yet and will be ignored."
                            )

            fields = ent.get("fields")
            if not isinstance(fields, list):
                continue

            normalized_fields = []
            for f in fields:
                if not isinstance(f, dict):
                    continue

                name = f.get("name")
                if name in ("id", "created_at", "updated_at"):
                    # system-managed in generator, drop it
                    continue

                # Old key `references` -> generator key `reference_entity`
                if "reference_entity" not in f and "references" in f and isinstance(f.get("references"), str):
                    f["reference_entity"] = f.get("references")

                # Normalize common type variants to generator types
                t = f.get("type")
                if isinstance(t, str):
                    t_norm = t.strip().lower()
                    allowed_types = {
                        "string",
                        "text",
                        "integer",
                        "decimal",
                        "number",
                        "boolean",
                        "date",
                        "datetime",
                        "reference",
                        "uuid",
                    }
                    type_map = {
                        "uuid": "string",
                        "guid": "string",
                        "int": "integer",
                        "int32": "integer",
                        "int64": "integer",
                        "float": "decimal",
                        "double": "decimal",
                        "money": "decimal",
                        "numeric": "decimal",
                        "bool": "boolean",
                        "timestamp": "datetime",
                        "date_time": "datetime",
                        # Models sometimes emit `enum` for selectable fields.
                        # In generator SDF, selectable fields are `type: "string"` + `options: [...]`.
                        "enum": "string",
                        "select": "string",
                        "choice": "string",
                    }
                    mapped = type_map.get(t_norm, t_norm)
                    if mapped != t_norm and t_norm:
                        normalized_warnings.append(
                            f"Normalized field type `{ent_slug}.{str(name)}` from `{t_norm}` to `{mapped}`."
                        )
                    if mapped not in allowed_types:
                        normalized_warnings.append(
                            f"Unsupported field type `{mapped}` for `{ent_slug}.{str(name)}`; defaulting to `string`."
                        )
                        mapped = "string"
                    f["type"] = mapped

                # If reference_entity is present, force type=reference
                if isinstance(f.get("reference_entity"), str) and f.get("reference_entity").strip():
                    f["type"] = "reference"

                # Old schema flags are ignored by pydantic (extra=allow), but keep output clean
                f.pop("is_primary_key", None)
                f.pop("is_foreign_key", None)

                normalized_fields.append(f)

            ent["fields"] = normalized_fields

    # Old top-level relations list is not used by generator; keep but it will be ignored downstream.
    # Prefer to drop it so callers get a clean generator SDF.
    data.pop("relations", None)

    # -------------------------------------------------------------------------
    # Scope Guardrails: Whitelist validation for Modules and Features
    # -------------------------------------------------------------------------
    ALLOWED_MODULES = {
        "activity_log",
        "inventory_dashboard",
        "scheduled_reports",
        "inventory",
        "invoice",
        "hr",
        "access_control",
    }
    ALLOWED_FEATURES = {"audit_trail", "batch_tracking", "serial_tracking", "multi_location", "print_invoice"}

    # 1. Validate Modules (warn but keep — assembler ignores unknown keys gracefully)
    modules = data.get("modules")
    if isinstance(modules, dict):
        unknown_modules = [k for k in modules.keys() if k not in ALLOWED_MODULES]
        for m in unknown_modules:
            normalized_warnings.append(
                f"Module `{m}` is not natively supported yet and may be ignored by the generator. "
                f"Natively supported modules: {', '.join(sorted(ALLOWED_MODULES))}."
            )

        # Ensure required ERP entities exist when a module is enabled.
        required_by_module = {
            "invoice": ["invoices", "customers"],
            "hr": ["employees"],
        }
        invoice_defaults = {
            "invoices": {
                "slug": "invoices",
                "display_name": "Invoice",
                "display_field": "invoice_number",
                "module": "invoice",
                "list": {
                    "columns": ["invoice_number", "customer_id", "status", "issue_date", "due_date", "grand_total"]
                },
                "features": {"print_invoice": True},
                "fields": [
                    {"name": "invoice_number", "type": "string", "label": "Invoice Number", "required": True, "unique": True},
                    {"name": "customer_id", "type": "reference", "label": "Customer", "required": True, "reference_entity": "customers"},
                    {"name": "issue_date", "type": "date", "label": "Issue Date", "required": True},
                    {"name": "due_date", "type": "date", "label": "Due Date", "required": True},
                    {"name": "status", "type": "string", "label": "Status", "required": True, "options": ["Draft", "Sent", "Paid", "Overdue"]},
                    {"name": "subtotal", "type": "decimal", "label": "Subtotal", "required": True},
                    {"name": "tax_total", "type": "decimal", "label": "Tax Total", "required": True},
                    {"name": "grand_total", "type": "decimal", "label": "Grand Total", "required": True},
                ],
            },
            "customers": {
                "slug": "customers",
                "display_name": "Customer",
                "display_field": "company_name",
                "module": "shared",
                "list": {
                    "columns": ["company_name", "contact_name", "email", "phone"]
                },
                "fields": [
                    {"name": "company_name", "type": "string", "label": "Company Name", "required": True},
                    {"name": "contact_name", "type": "string", "label": "Contact Name", "required": False},
                    {"name": "email", "type": "string", "label": "Email", "required": False},
                    {"name": "phone", "type": "string", "label": "Phone", "required": False},
                ],
            },
        }
        hr_defaults = {
            "employees": {
                "slug": "employees",
                "display_name": "Employee",
                "display_field": "first_name",
                "module": "hr",
                "list": {
                    "columns": ["first_name", "last_name", "email", "job_title"]
                },
                "fields": [
                    {"name": "first_name", "type": "string", "label": "First Name", "required": True},
                    {"name": "last_name", "type": "string", "label": "Last Name", "required": True},
                    {"name": "email", "type": "string", "label": "Email", "required": False},
                    {"name": "phone", "type": "string", "label": "Phone", "required": False},
                    {"name": "job_title", "type": "string", "label": "Job Title", "required": False},
                    {"name": "hire_date", "type": "date", "label": "Hire Date", "required": False},
                    {"name": "status", "type": "string", "label": "Status", "required": False, "options": ["Active", "Terminated", "On Leave"]},
                    {"name": "salary", "type": "decimal", "label": "Salary", "required": False},
                ],
            },
        }

        entity_slugs = set()
        if isinstance(entities, list):
            for ent in entities:
                if not isinstance(ent, dict):
                    continue
                slug = ent.get("slug")
                if slug:
                    entity_slugs.add(str(slug))

        def _module_enabled(cfg) -> bool:
            if cfg is False:
                return False
            if isinstance(cfg, dict) and cfg.get("enabled") is False:
                return False
            return True

        def _ensure_fields(ent: dict, field_defs: list[dict]) -> list[str]:
            fields = ent.get("fields")
            if not isinstance(fields, list):
                fields = []
                ent["fields"] = fields
            existing = {f.get("name") for f in fields if isinstance(f, dict)}
            added = []
            for f in field_defs:
                name = f.get("name")
                if not name or name in existing:
                    continue
                fields.append(deepcopy(f))
                added.append(name)
            return added

        def _merge_defaults(ent: dict, defaults: dict) -> None:
            for key in ("display_name", "display_field", "module", "list"):
                if key not in ent or ent.get(key) in (None, "", {}):
                    ent[key] = deepcopy(defaults.get(key))
            default_features = defaults.get("features")
            if isinstance(default_features, dict):
                features = ent.get("features")
                if not isinstance(features, dict):
                    features = {}
                    ent["features"] = features
                for f_key, f_val in default_features.items():
                    if f_key not in features:
                        features[f_key] = deepcopy(f_val)

        def _ensure_entity(slug: str, defaults: dict) -> tuple[dict, bool]:
            for ent in entities:
                if isinstance(ent, dict) and ent.get("slug") == slug:
                    return ent, False
            ent = deepcopy(defaults)
            entities.append(ent)
            return ent, True

        def _entity_has_role_fields(ent: dict, role_fields: set[str]) -> bool:
            """Check if an entity has enough signature fields to fill a required role."""
            fields = ent.get("fields")
            if not isinstance(fields, list):
                return False
            field_names = {str(f.get("name") or "") for f in fields if isinstance(f, dict)}
            return len(role_fields & field_names) >= max(1, len(role_fields) // 2)

        def _find_role_entity(mod: str, role_fields: set[str]) -> dict | None:
            """Find an entity in a module that looks like it fills a required role."""
            for ent in entities:
                if not isinstance(ent, dict):
                    continue
                ent_mod = str(ent.get("module") or "").lower()
                if ent_mod in (mod, "shared") and _entity_has_role_fields(ent, role_fields):
                    return ent
            return None

        EMPLOYEE_SIGNATURE = {"first_name", "last_name", "email", "hire_date"}
        INVOICE_SIGNATURE = {"invoice_number", "issue_date", "due_date", "status", "grand_total"}
        CUSTOMER_SIGNATURE = {"company_name", "email", "phone"}

        for mod_key, required in required_by_module.items():
            if mod_key not in modules:
                continue
            cfg = modules.get(mod_key)
            if not _module_enabled(cfg):
                continue
            missing = [slug for slug in required if slug not in entity_slugs]
            if not missing:
                continue

            auto_added = []
            if mod_key == "invoice":
                inv_def = invoice_defaults["invoices"]
                cust_def = invoice_defaults["customers"]

                if "invoices" in missing and not _find_role_entity("invoice", INVOICE_SIGNATURE):
                    invoices_entity, created = _ensure_entity("invoices", inv_def)
                    _merge_defaults(invoices_entity, inv_def)
                    if created:
                        auto_added.append("invoices")
                    else:
                        _ensure_fields(invoices_entity, inv_def["fields"])

                if "customers" in missing and not _find_role_entity("shared", CUSTOMER_SIGNATURE):
                    customers_entity, created = _ensure_entity("customers", cust_def)
                    _merge_defaults(customers_entity, cust_def)
                    if created:
                        auto_added.append("customers")
                    else:
                        _ensure_fields(customers_entity, cust_def["fields"])

            if mod_key == "hr":
                emp_def = hr_defaults["employees"]
                if "employees" in missing and not _find_role_entity("hr", EMPLOYEE_SIGNATURE):
                    employees_entity, created = _ensure_entity("employees", emp_def)
                    _merge_defaults(employees_entity, emp_def)
                    if created:
                        auto_added.append("employees")
                    else:
                        _ensure_fields(employees_entity, emp_def["fields"])

            if auto_added:
                entity_slugs.update(auto_added)
                normalized_warnings.append(
                    f"Module `{mod_key}` was missing required entities. Auto-added: {', '.join(auto_added)}."
                )

    # 2. Validate Entity Features (warn but keep — generator skips unknown keys gracefully)
    if isinstance(entities, list):
        for ent in entities:
            if not isinstance(ent, dict):
                continue
            ent_slug = str(ent.get("slug") or "unknown")
            features = ent.get("features")
            if isinstance(features, dict):
                unknown_features = [k for k in features.keys() if k not in ALLOWED_FEATURES]
                for f in unknown_features:
                    normalized_warnings.append(
                        f"Feature `{f}` on entity `{ent_slug}` is not natively supported yet and may be ignored by the generator. "
                        f"Natively supported features: {', '.join(sorted(ALLOWED_FEATURES))}."
                    )

    if normalized_warnings:
        # De-duplicate while preserving order
        seen = set()
        out_warnings: list[str] = []
        for w in normalized_warnings:
            if w in seen:
                continue
            seen.add(w)
            out_warnings.append(w)
        data["warnings"] = out_warnings

    return data
