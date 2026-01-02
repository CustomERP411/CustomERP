// platform/assembler/CodeWeaver.js
class CodeWeaver {
  constructor(baseTemplate) {
    this.content = baseTemplate;
  }

  /**
   * Injects code at a specific hook point.
   * @param {string} hookName - The name of the hook (e.g., 'BEFORE_CREATE_VALIDATION')
   * @param {string} codeSnippet - The code to inject
   */
  inject(hookName, codeSnippet) {
    const marker = `// @HOOK: ${hookName}`;
    // Indent the injected code to match the marker's indentation level (basic heuristic)
    // For now, we just append it after the marker.
    // In a more robust version, we could detect indentation.

    if (this.content.includes(marker)) {
      // IMPORTANT:
      // String.replace() treats `$` sequences in the replacement string as special tokens
      // (e.g. `$&`, `$'`, `$1`). Injected code may legitimately contain `$` (regex patterns, template docs, etc),
      // so we must use the function form to avoid accidental replacement expansion.
      this.content = this.content.replace(marker, (match) => `${match}\n    ${codeSnippet}`);
    } else {
      console.warn(`Hook point ${hookName} not found in template.`);
    }
  }

  /**
   * Replaces placeholders like {{EntityName}}
   * @param {object} context - Key-value pairs
   */
  render(context) {
    return this.content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] || match;
    });
  }

  getContent() {
    return this.content;
  }
}

module.exports = CodeWeaver;
