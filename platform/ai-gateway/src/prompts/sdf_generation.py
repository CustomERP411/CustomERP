"""
Main prompt for generating the System Definition File (SDF)
"""

import pathlib

PROMPT_DIR = pathlib.Path(__file__).parent


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
