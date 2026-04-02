"""
Main prompt for generating the System Definition File (SDF)
"""

import pathlib

PROMPT_DIR = pathlib.Path(__file__).parent

# Cache for SDF schema reference
_SDF_SCHEMA_CACHE: str = ""


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


def get_sdf_prompt(business_description: str) -> str:
    """Loads the SDF prompt from a text file and injects the business description."""
    try:
        prompt_template_path = PROMPT_DIR / "analyze_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(prompt_template, {"business_description": business_description})
    except FileNotFoundError:
        # Handle case where the prompt file is missing
        print(f"Error: Prompt file not found at {prompt_template_path}")
        # Fallback or raise an exception
        return "Error: Could not load prompt."


def get_clarify_prompt(business_description: str, partial_sdf: str, answers: str) -> str:
    """Loads the clarify prompt and injects the context."""
    try:
        prompt_template_path = PROMPT_DIR / "clarify_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "partial_sdf": partial_sdf,
                "answers": answers,
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_fix_json_prompt(invalid_json: str) -> str:
    """Loads the JSON fix prompt and injects the invalid JSON string."""
    try:
        prompt_template_path = PROMPT_DIR / "fix_json_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(prompt_template, {"invalid_json": invalid_json})
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_edit_prompt(business_description: str, current_sdf: str, instructions: str) -> str:
    """Loads the edit prompt and injects the context."""
    try:
        prompt_template_path = PROMPT_DIR / "edit_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description or "",
                "current_sdf": current_sdf,
                "instructions": instructions,
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_finalize_prompt(business_description: str, partial_sdf: str, answers: str) -> str:
    """Loads the finalize prompt and injects the context."""
    try:
        prompt_template_path = PROMPT_DIR / "finalize_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description or "",
                "partial_sdf": partial_sdf,
                "answers": answers,
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


# ─────────────────────────────────────────────────────────────
# Multi-Agent Pipeline Prompts
# ─────────────────────────────────────────────────────────────

def get_distributor_prompt(
    business_description: str,
    default_questions: str = "",
    prefilled_sdf: str = "",
) -> str:
    """Loads the distributor prompt for routing user input to modules.
    
    Args:
        business_description: The user's natural language input.
        default_questions: Answers to mandatory pre-generation questions.
        prefilled_sdf: Prefilled SDF draft from mandatory answers.
    """
    try:
        prompt_template_path = PROMPT_DIR / "distributor_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "default_questions": default_questions or "",
                "prefilled_sdf": prefilled_sdf or "",
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_hr_generator_prompt(
    business_description: str,
    hr_description: str,
    hr_features: str,
    shared_entities: str,
) -> str:
    """Loads the HR module generator prompt."""
    try:
        prompt_template_path = PROMPT_DIR / "hr_generator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "hr_description": hr_description,
                "hr_features": hr_features,
                "shared_entities": shared_entities,
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_invoice_generator_prompt(
    business_description: str,
    invoice_description: str,
    invoice_features: str,
    shared_entities: str,
) -> str:
    """Loads the Invoice module generator prompt."""
    try:
        prompt_template_path = PROMPT_DIR / "invoice_generator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "invoice_description": invoice_description,
                "invoice_features": invoice_features,
                "shared_entities": shared_entities,
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."


def get_inventory_generator_prompt(
    business_description: str,
    inventory_description: str,
    inventory_features: str,
    shared_entities: str,
) -> str:
    """Loads the Inventory module generator prompt."""
    try:
        prompt_template_path = PROMPT_DIR / "inventory_generator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
            prompt_template,
            {
                "business_description": business_description,
                "inventory_description": inventory_description,
                "inventory_features": inventory_features,
                "shared_entities": shared_entities,
                "sdf_schema_reference": _get_sdf_schema_reference(),
            },
        )
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
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
) -> str:
    """Loads the Integrator prompt for combining module outputs."""
    try:
        prompt_template_path = PROMPT_DIR / "integrator_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return _inject_placeholders(
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
    except FileNotFoundError:
        print(f"Error: Prompt file not found at {prompt_template_path}")
        return "Error: Could not load prompt."
