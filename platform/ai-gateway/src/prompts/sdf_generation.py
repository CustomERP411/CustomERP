"""
Main prompt for generating the System Definition File (SDF)
"""



import pathlib

PROMPT_DIR = pathlib.Path(__file__).parent


def get_sdf_prompt(business_description: str) -> str:
    """Loads the SDF prompt from a text file and injects the business description."""
    try:
        prompt_template_path = PROMPT_DIR / "analyze_prompt.txt"
        prompt_template = prompt_template_path.read_text()
        return prompt_template.format(business_description=business_description)
    except FileNotFoundError:
        # Handle case where the prompt file is missing
        print(f"Error: Prompt file not found at {prompt_template_path}")
        # Fallback or raise an exception
        return "Error: Could not load prompt."
