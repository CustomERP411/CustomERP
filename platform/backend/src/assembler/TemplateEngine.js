class TemplateEngine {
  static render(template, context) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] || match;
    });
  }
}

module.exports = TemplateEngine;

