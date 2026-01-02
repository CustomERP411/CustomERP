import json
import pathlib

from src.schemas.sdf import SystemDefinitionFile


def main():
    """Generates the sdf_schema.json file from the Pydantic model."""
    # Define the output path relative to the current working directory
    # This script assumes it's run from the 'platform/ai-gateway' directory.
    output_dir = pathlib.Path("src") / "schemas"
    output_path = output_dir / "sdf_schema.json"

    # Ensure the output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate the JSON schema from the Pydantic model
    schema = SystemDefinitionFile.model_json_schema()

    # Write the schema to the file
    with open(output_path, "w") as f:
        json.dump(schema, f, indent=2)

    print(f"✅ Successfully generated SDF schema at: {output_path}")


if __name__ == "__main__":
    main()
