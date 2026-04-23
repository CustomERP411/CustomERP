"""
Main prompt for generating the System Definition File (SDF)
"""

import pathlib
from typing import Optional

PROMPT_DIR = pathlib.Path(__file__).parent

# Cache for SDF schema reference
_SDF_SCHEMA_CACHE: str = ""

# Cache for per-language directive files, keyed by normalized language code.
_LANGUAGE_DIRECTIVE_CACHE: dict[str, str] = {}

# Supported languages — the system is pluggable: to add a new language, drop a
# `language_directive_<code>.txt` file next to this module and extend this set.
SUPPORTED_LANGUAGES = {"en", "tr"}
DEFAULT_LANGUAGE = "en"


def _normalize_language(language: str | None) -> str:
    code = (language or "").strip().lower()
    return code if code in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def load_language_directive(language: str | None) -> str:
    """Return the language directive block to prepend to every LLM prompt.

    Directives are read from `language_directive_<code>.txt` next to this
    module and cached in-process.
    """
    code = _normalize_language(language)
    if code in _LANGUAGE_DIRECTIVE_CACHE:
        return _LANGUAGE_DIRECTIVE_CACHE[code]
    directive_path = PROMPT_DIR / f"language_directive_{code}.txt"
    if not directive_path.exists():
        # Fall back to English if the directive file is missing.
        directive_path = PROMPT_DIR / f"language_directive_{DEFAULT_LANGUAGE}.txt"
    try:
        text = directive_path.read_text()
    except FileNotFoundError:
        text = ""
    _LANGUAGE_DIRECTIVE_CACHE[code] = text
    return text


def _get_sdf_schema_reference() -> str:
    """Load the condensed SDF schema reference (cached)."""
    global _SDF_SCHEMA_CACHE
    if not _SDF_SCHEMA_CACHE:
        schema_path = PROMPT_DIR / "sdf_schema_reference.txt"
        if schema_path.exists():
            _SDF_SCHEMA_CACHE = schema_path.read_text()
        else:
            print(f"Warning: SDF schema reference not found at {schema_path}")
            _SDF_SCHEMA_CACHE = "# SDF Schema Reference not available"
    return _SDF_SCHEMA_CACHE


def _inject_placeholders(template: str, values: dict[str, str]) -> str:
    """
    Safe placeholder injection.

    We intentionally DO NOT use Python str.format() here because our prompts often contain
    literal JSON examples with `{}` braces, which would be treated as format placeholders.

    Supported placeholders are literal tokens like: {business_description}
    """
    out = template
    for key, val in values.items():
        out = out.replace("{" + key + "}", val)
    return out


def _with_language_directive(prompt_text: str, language: str | None) -> str:
    """Prepend the language directive block to a rendered prompt.

    Templates may optionally include a `{language_directive}` placeholder — if
    present, we replace it. Otherwise we prepend the directive to the top of
    the prompt so the LLM sees it before any other instruction.
    """
    directive = load_language_directive(language).strip()
    if not directive:
        return prompt_text
    placeholder = "{language_directive}"
    if placeholder in prompt_text:
        return prompt_text.replace(placeholder, directive)
    return f"{directive}\n\n{prompt_text}"


def get_sdf_prompt(business_description: str, language: str = DEFAULT_LANGUAGE) -> str:
    """Loads the SDF prompt from a text file and injects the business description."""
    try:
        prompt_template_path = PROMPT_DIR / "analyze_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(prompt_template, {"business_description": business_description})
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        # Handle case where the prompt file is missing
        print(f"Error: Prompt file not found at {prompt_template_path}")
        # Fallback or raise an exception
        return "Error: Could not load prompt."


def get_clarify_prompt(business_description: str, partial_sdf: str, answers: str, language: str = DEFAULT_LANGUAGE) -> str:
    """Loads the clarify prompt and injects the context."""
    try:
        prompt_template_path = PROMPT_DIR / "clarify_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "partial_sdf": partial_sdf,
                "answers": answers,
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_fix_json_prompt(invalid_json: str) -> str:
    """Loads the JSON fix prompt and injects the invalid JSON string.

    Note: This prompt is pure structural repair — it does not produce
    user-facing content, so we do NOT inject a language directive.
    """
    try:
        prompt_template_path = PROMPT_DIR / "fix_json_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(prompt_template, {"invalid_json": invalid_json})
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_edit_prompt(business_description: str, current_sdf: str, instructions: str, language: str = DEFAULT_LANGUAGE) -> str:
    """Loads the edit prompt and injects the context."""
    try:
        prompt_template_path = PROMPT_DIR / "edit_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description or "",
                "current_sdf": current_sdf,
                "instructions": instructions,
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_finalize_prompt(business_description: str, partial_sdf: str, answers: str, language: str = DEFAULT_LANGUAGE) -> str:
    """Loads the finalize prompt and injects the context."""
    try:
        prompt_template_path = PROMPT_DIR / "finalize_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description or "",
                "partial_sdf": partial_sdf,
                "answers": answers,
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


# ─────────────────────────────────────────────────────────────
# Multi-Agent Pipeline Prompts
# ─────────────────────────────────────────────────────────────

def get_distributor_prompt(
    business_description: str,
    default_questions: str = "",
    existing_modules: str = "",
    language: str = DEFAULT_LANGUAGE,
    selected_modules: Optional[list] = None,
) -> str:
    """Loads the distributor prompt for routing user input to modules.
    
    Args:
        business_description: The user's natural language input.
        default_questions: Answers to mandatory pre-generation questions.
        existing_modules: Lightweight summary of enabled modules and entity slugs.
        language: Project language code (en/tr) — controls directive injection.
        selected_modules: Authoritative allowlist of modules the user picked in the UI.
            When present and non-empty, the template's USER-SELECTED MODULES block
            forces ``modules_needed`` to this exact set; fallback detection rules
            only fire when this list is empty.
    """
    try:
        prompt_template_path = PROMPT_DIR / "distributor_prompt.txt"
        prompt_template = prompt_template_path.read_text()

        cleaned_selected: list[str] = []
        if selected_modules:
            seen: set[str] = set()
            for m in selected_modules:
                if not isinstance(m, str):
                    continue
                key = m.strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    cleaned_selected.append(key)

        if cleaned_selected:
            selected_modules_block = (
                "# USER-SELECTED MODULES (AUTHORITATIVE)\n"
                "\n"
                "The user has already selected the following modules in the UI. This selection is AUTHORITATIVE and MUST be respected.\n"
                f"SELECTED MODULES: {cleaned_selected}\n"
                "\n"
                "CRITICAL RULES:\n"
                "- `modules_needed` in your output MUST equal this exact set (order does not matter).\n"
                "- DO NOT add any module not in this list, even if the business description strongly implies it "
                "(e.g., mentions of employees must NOT force HR if HR is not in the selected set).\n"
                "- DO NOT remove any module in this list, even if the description is silent about it.\n"
                "- The FALLBACK DETECTION rules below are IGNORED whenever this list is non-empty.\n"
            )
        else:
            selected_modules_block = (
                "# USER-SELECTED MODULES (AUTHORITATIVE)\n"
                "\n"
                "No explicit selection was provided by the UI — fall back to inference using the detection rules below.\n"
            )

        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "default_questions": default_questions or "",
                "existing_modules": existing_modules or "No existing ERP — this is a fresh generation.",
                "selected_modules_block": selected_modules_block,
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_hr_generator_prompt(
    business_description: str,
    hr_description: str,
    hr_features: str,
    shared_entities: str,
    default_answers: str = "",
    prefilled_module_sdf: str = "",
    change_instructions: str = "",
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """Loads the HR module generator prompt."""
    try:
        prompt_template_path = PROMPT_DIR / "hr_generator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "hr_description": hr_description,
                "hr_features": hr_features,
                "shared_entities": shared_entities,
                "default_answers": default_answers or "None provided",
                "prefilled_module_sdf": prefilled_module_sdf or "None — generate from scratch",
                "change_instructions": change_instructions or "None — this is a fresh generation, not a change request.",
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_invoice_generator_prompt(
    business_description: str,
    invoice_description: str,
    invoice_features: str,
    shared_entities: str,
    default_answers: str = "",
    prefilled_module_sdf: str = "",
    change_instructions: str = "",
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """Loads the Invoice module generator prompt."""
    try:
        prompt_template_path = PROMPT_DIR / "invoice_generator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "invoice_description": invoice_description,
                "invoice_features": invoice_features,
                "shared_entities": shared_entities,
                "default_answers": default_answers or "None provided",
                "prefilled_module_sdf": prefilled_module_sdf or "None — generate from scratch",
                "change_instructions": change_instructions or "None — this is a fresh generation, not a change request.",
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_inventory_generator_prompt(
    business_description: str,
    inventory_description: str,
    inventory_features: str,
    shared_entities: str,
    default_answers: str = "",
    prefilled_module_sdf: str = "",
    change_instructions: str = "",
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """Loads the Inventory module generator prompt."""
    try:
        prompt_template_path = PROMPT_DIR / "inventory_generator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "inventory_description": inventory_description,
                "inventory_features": inventory_features,
                "shared_entities": shared_entities,
                "default_answers": default_answers or "None provided",
                "prefilled_module_sdf": prefilled_module_sdf or "None — generate from scratch",
                "change_instructions": change_instructions or "None — this is a fresh generation, not a change request.",
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_chat_prompt(
    business_description: str,
    user_message: str,
    selected_modules: str = "",
    business_answers: str = "",
    conversation_history: str = "",
    current_step: str = "",
    sdf_status: str = "",
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """Loads the chat mode prompt for conversational feature discussion."""
    try:
        prompt_template_path = PROMPT_DIR / "chat_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description or "",
                "user_message": user_message,
                "selected_modules": selected_modules or "None selected yet",
                "business_answers": business_answers or "None provided yet",
                "conversation_history": conversation_history or "No prior messages",
                "current_step": current_step or "Unknown",
                "sdf_status": sdf_status or "none",
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {PROMPT_DIR / 'chat_prompt.txt'}")
        return "Error: Could not load prompt."


def get_integrator_prompt(
    project_name: str,
    business_description: str,
    shared_entities: str,
    hr_output: str,
    invoice_output: str,
    inventory_output: str,
    default_question_answers: str,
    prefilled_sdf: str,
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """Loads the Integrator prompt for combining module outputs."""
    try:
        prompt_template_path = PROMPT_DIR / "integrator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        rendered = _inject_placeholders(
            prompt_template,
            {
                "project_name": project_name,
                "business_description": business_description,
                "shared_entities": shared_entities,
                "hr_output": hr_output or "null",
                "invoice_output": invoice_output or "null",
                "inventory_output": inventory_output or "null",
                "default_question_answers": default_question_answers or "{}",
                "prefilled_sdf": prefilled_sdf or "{}",
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
        return _with_language_directive(rendered, language)
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."
