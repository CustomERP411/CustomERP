// Schema validation code generation (split from BackendGenerator)
const { resolveEffectiveRequired } = require('../shared/fieldRequired');
const { tFor } = require('../../i18n/labels');

// Plan D follow-up #7: validation error messages are localized at codegen
// time using the assembler's `tFor`. We bake the project-language string
// directly into the generated `validation.js` so the running ERP does not
// need a translation runtime. `_validationMessage(language, key, fallback,
// vars)` resolves `validation.<key>` from i18n and substitutes the simple
// `{token}` placeholders inline. The fallback string is also a template
// (with the same placeholder tokens) and is used when the key is missing
// from the dictionary, preserving today's English copy verbatim.
function _validationMessage(language, key, fallback, vars) {
  const t = tFor(language || 'en');
  const dictKey = `validation.${key}`;
  const fromDict = t(dictKey);
  const template = (typeof fromDict === 'string' && fromDict && fromDict !== dictKey)
    ? fromDict
    : fallback;
  let out = String(template);
  for (const [token, value] of Object.entries(vars || {})) {
    const re = new RegExp(`\\{${token}\\}`, 'g');
    out = out.replace(re, String(value));
  }
  return out;
}

// Escape a string so it can be safely embedded inside single-quoted JS
// source emitted by this codegen (mirrors `BackendGenerator._escapeJsString`).
function _escForSingleQuoteJs(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

module.exports = {
  _injectSchemaValidations(weaver, entity, allEntities) {
    const createSnippet = this._buildCreateValidationSnippet(entity, allEntities);
    const updateSnippet = this._buildUpdateValidationSnippet(entity, allEntities);
    const deleteSnippet = this._buildDeleteRestrictionSnippet(entity, allEntities);

    if (createSnippet) weaver.inject('BEFORE_CREATE_VALIDATION', createSnippet);
    if (updateSnippet) weaver.inject('BEFORE_UPDATE_VALIDATION', updateSnippet);
    if (deleteSnippet) weaver.inject('BEFORE_DELETE_VALIDATION', deleteSnippet);

    // Plan H — entities that have inline child sections AND a 'Draft' status
    // option get a `createDraft` service method so the frontend can auto-create
    // a placeholder row on /new and redirect into the standard edit form.
    this._injectCreateDraftMethod(weaver, entity);
  },

  // Plan H — qualification gate for the draft-then-edit creation flow.
  // Returns true when:
  //   1. `entity.children[]` is non-empty (the entity has inline line items),
  //   2. `entity.fields` contains a `status` field, AND
  //   3. `status.options` contains `Draft`/`draft` (case-insensitive).
  // Other entities keep today's "save first" behaviour with no regression.
  _qualifiesForAutoDraft(entity) {
    if (!entity || typeof entity !== 'object') return false;
    const children = Array.isArray(entity.children) ? entity.children : [];
    if (children.length === 0) return false;
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    const statusField = fields.find((f) => f && f.name === 'status');
    if (!statusField) return false;
    const rawOptions = statusField.options ?? statusField.enum ?? statusField.allowed_values ?? statusField.allowedValues;
    const options = Array.isArray(rawOptions) ? rawOptions : [];
    return options.some((opt) => String(opt || '').trim().toLowerCase() === 'draft');
  },

  // Plan H — return the literal Draft enum value (preserving casing) so the
  // generated `createDraft` method writes the SAME string the validator's
  // options check accepts. Falls back to 'Draft' if the lookup fails (the
  // qualification gate guarantees it exists in well-formed input).
  _getDraftStatusValue(entity) {
    const fields = Array.isArray(entity && entity.fields) ? entity.fields : [];
    const statusField = fields.find((f) => f && f.name === 'status');
    const rawOptions = statusField && (statusField.options ?? statusField.enum ?? statusField.allowed_values ?? statusField.allowedValues);
    const options = Array.isArray(rawOptions) ? rawOptions : [];
    const match = options.find((opt) => String(opt || '').trim().toLowerCase() === 'draft');
    return match ? String(match) : 'Draft';
  },

  // Plan H — emit a `createDraft(payload)` method on the generated service.
  // The method:
  //   - forces `data.status` to the entity's literal Draft option,
  //   - autofills required scalar fields with sensible placeholders so the
  //     unique/length checks (still active for drafts) don't throw,
  //   - leaves required references and required multi-value fields as-is so
  //     the validator surfaces their absence only when the user transitions
  //     out of Draft (or, with `__isDraft` true, lets them slide for now),
  //   - calls `this.create(data, context)` so existing mixin hooks
  //     (audit logging, status propagation, etc.) still run.
  _injectCreateDraftMethod(weaver, entity) {
    if (!this._qualifiesForAutoDraft(entity)) return;
    const draftValue = this._getDraftStatusValue(entity);
    const draftValueEsc = this._escapeJsString(draftValue);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    const placeholderLines = [];
    for (const f of fields) {
      if (!f || !f.name) continue;
      if (f.computed === true) continue;
      const fieldName = String(f.name);
      if (['id', 'created_at', 'updated_at', 'status'].includes(fieldName)) continue;
      if (!resolveEffectiveRequired(f)) continue;
      if (this._isFieldMultiple(f)) continue;
      const fieldEsc = this._escapeJsString(fieldName);
      const fieldType = String(f.type || 'string').toLowerCase();
      const isReference = fieldType === 'reference' || fieldName.endsWith('_id') || fieldName.endsWith('_ids');
      if (isReference) continue;
      if (fieldType === 'boolean') continue;

      if (fieldType === 'date') {
        placeholderLines.push(
          `if (data['${fieldEsc}'] === undefined || data['${fieldEsc}'] === null || (typeof data['${fieldEsc}'] === 'string' && data['${fieldEsc}'].trim() === '')) data['${fieldEsc}'] = __today;`
        );
      } else if (fieldType === 'datetime') {
        placeholderLines.push(
          `if (data['${fieldEsc}'] === undefined || data['${fieldEsc}'] === null || (typeof data['${fieldEsc}'] === 'string' && data['${fieldEsc}'].trim() === '')) data['${fieldEsc}'] = __nowIso;`
        );
      } else if (fieldType === 'integer' || fieldType === 'decimal' || fieldType === 'number') {
        placeholderLines.push(
          `if (data['${fieldEsc}'] === undefined || data['${fieldEsc}'] === null) data['${fieldEsc}'] = 0;`
        );
      } else {
        const upperPrefix = fieldName.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
        const prefixEsc = this._escapeJsString(upperPrefix);
        placeholderLines.push(
          `if (data['${fieldEsc}'] === undefined || data['${fieldEsc}'] === null || (typeof data['${fieldEsc}'] === 'string' && data['${fieldEsc}'].trim() === '')) data['${fieldEsc}'] = '${prefixEsc}-DRAFT-' + __ulid();`
        );
      }
    }

    const placeholderBody = placeholderLines.length
      ? '\n    ' + placeholderLines.join('\n    ')
      : '';

    const methodCode = `
async createDraft(payload, context = {}) {
    // Plan H — Auto-create a draft row on /new mount so the inline child-row
    // sections become editable from the very first render. Required-field
    // rules are relaxed by the validator while \`status === 'Draft'\`; they
    // re-engage on transition out of Draft. Computed-strip and uniqueness
    // checks still run.
    const data = (payload && typeof payload === 'object' && !Array.isArray(payload))
      ? { ...payload }
      : {};
    const __today = new Date().toISOString().slice(0, 10);
    const __nowIso = new Date().toISOString();
    const __ulid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    data.status = '${draftValueEsc}';${placeholderBody}
    const created = await this.create(data, context);
    return { id: created && created.id ? created.id : created };
  }`;

    weaver.inject('ADDITIONAL_METHODS', methodCode);
  },

  _getComputedFieldNames(entity) {
    const fields = Array.isArray(entity && entity.fields) ? entity.fields : [];
    return fields
      .filter((f) => f && f.computed === true && f.name && !['id', 'created_at', 'updated_at'].includes(f.name))
      .map((f) => String(f.name));
  },

  _resolveComputedMode(entity) {
    // Plan B follow-up #6: per-entity strict/lenient mode for computed-field
    // payload handling. Default is 'lenient' to preserve historical behavior
    // (silent strip). 'strict' returns a 400 with field_errors so clients
    // notice that they're trying to write a server-maintained value.
    const raw = entity && (entity.computed_mode || entity.computedMode);
    const mode = String(raw || 'lenient').trim().toLowerCase();
    return mode === 'strict' ? 'strict' : 'lenient';
  },

  _buildComputedStripSnippet(entity) {
    const computed = this._getComputedFieldNames(entity);
    if (!computed.length) return '';
    const literal = JSON.stringify(computed);
    const mode = this._resolveComputedMode(entity);

    if (mode === 'strict') {
      // Reject the request with a 400 so callers can surface the issue in
      // their UI/integration layer rather than silently dropping the value.
      return `
      // Plan B #6 (strict mode): server-maintained (computed) fields must not
      // appear in inbound payloads. Returning a structured error mirrors the
      // schema-validation path so the client can show field-level feedback.
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const __computedFields = ${literal};
        const __computedFieldErrors = {};
        for (const __cf of __computedFields) {
          if (Object.prototype.hasOwnProperty.call(data, __cf)) {
            __computedFieldErrors[__cf] = {
              code: 'computed_readonly',
              message: 'Field "' + __cf + '" is server-maintained and cannot be set by clients.',
            };
          }
        }
        if (Object.keys(__computedFieldErrors).length > 0) {
          const __err = new Error('Computed field rejection');
          __err.statusCode = 400;
          __err.fieldErrors = __computedFieldErrors;
          throw __err;
        }
      }
`;
    }

    return `
      // Strip server-maintained (computed) fields from inbound payload.
      // These are derived by server-side logic (reservations, sales-order
      // commitments, totals) and MUST NOT be accepted from clients.
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const __computedFields = ${literal};
        for (const __cf of __computedFields) {
          if (Object.prototype.hasOwnProperty.call(data, __cf)) {
            delete data[__cf];
          }
        }
      }
`;
  },

  _buildCreateValidationSnippet(entity, allEntities) {
    const rules = this._getFieldRules(entity, allEntities);
    const computedStrip = this._buildComputedStripSnippet(entity);
    if (rules.length === 0 && !computedStrip) return '';

    let code = computedStrip;
    if (rules.length === 0) return code;

    const uniqueFields = rules.filter((r) => r.unique);
    const referenceFields = rules.filter((r) => r.referenceEntity);

    code += `
      // Schema-driven validation (generated)
      const fieldErrors = {};
      const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const isMissingNonString = (v) => v === undefined || v === null;
      // Plan H — relax required-field enforcement while the row is in draft
      // state. Computed-strip, uniqueness, length, options, pattern, numeric,
      // and reference-existence checks all stay active. Required fields are
      // re-enforced once the user (or a lifecycle action) transitions status
      // out of Draft.
      const __isDraft = String((data && data.status != null) ? data.status : '').toLowerCase() === 'draft';
`;

    if (uniqueFields.length) {
      code += `
      const existingItems = await this.repository.findAll(this.slug);
`;
    }

    if (referenceFields.length) {
      code += `
      const __refIdSets = {};
      const getRefIdSet = async (slug) => {
        if (__refIdSets[slug]) return __refIdSets[slug];
        const all = await this.repository.findAll(slug);
        __refIdSets[slug] = new Set(all.map((x) => x.id));
        return __refIdSets[slug];
      };
`;
    }

    const language = this._language || 'en';
    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `data['${fieldKey}']`;

      // Plan D: localized validation messages. `_validationMessage` returns
      // a plain string, which we then escape for safe embedding inside the
      // single-quoted JS we are emitting.
      const msgRequired = _escForSingleQuoteJs(_validationMessage(
        language, 'required', '{label} is required', { label: r.label }
      ));
      const msgMustBeNumber = _escForSingleQuoteJs(_validationMessage(
        language, 'must_be_number', '{label} must be a number', { label: r.label }
      ));
      const msgMustBeUnique = _escForSingleQuoteJs(_validationMessage(
        language, 'must_be_unique', '{label} must be unique', { label: r.label }
      ));

      // required (Plan H: gated by !__isDraft so drafts can be saved with holes)
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!__isDraft && (!Array.isArray(${accessor}) || ${accessor}.length === 0)) fieldErrors['${fieldKey}'] = '${msgRequired}';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (!__isDraft && isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${msgRequired}';
`;
        } else {
          code += `
      if (!__isDraft && isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${msgRequired}';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        const msg = _escForSingleQuoteJs(_validationMessage(
          language, 'min_length', '{label} must be at least {min} characters',
          { label: r.label, min: r.minLength }
        ));
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${msg}';
`;
      }
      if (typeof r.maxLength === 'number') {
        const msg = _escForSingleQuoteJs(_validationMessage(
          language, 'max_length', '{label} must be at most {max} characters',
          { label: r.label, max: r.maxLength }
        ));
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${msg}';
`;
      }
      if (Array.isArray(r.options) && r.options.length) {
        const varName = `__allowed_${String(r.name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const list = r.options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        const preview = r.options.slice(0, 10).join(', ');
        const msg = _escForSingleQuoteJs(_validationMessage(
          language, 'must_be_one_of', '{label} must be one of: {options}',
          { label: r.label, options: preview }
        ));
        code += `
      const ${varName} = [${list}];
      if (!isMissing(${accessor}) && !${varName}.includes(String(${accessor}))) fieldErrors['${fieldKey}'] = '${msg}';
`;
      }
      if (typeof r.pattern === 'string' && r.pattern.length) {
        code += `
      if (!isMissing(${accessor})) {
        try {
          const re = new RegExp('${this._escapeJsString(r.pattern)}');
          if (!re.test(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} is invalid';
        } catch (e) {}
      }
`;
      }

      // numeric rules
      const isNumeric = ['integer', 'decimal', 'number'].includes(r.type);
      if (isNumeric || typeof r.min === 'number' || typeof r.max === 'number') {
        code += `
      if (!isMissing(${accessor})) {
        const num = typeof ${accessor} === 'number' ? ${accessor} : Number(${accessor});
        if (Number.isNaN(num)) {
          fieldErrors['${fieldKey}'] = '${msgMustBeNumber}';
        } else {
`;
        if (r.type === 'integer') {
          code += `
          if (!Number.isInteger(num)) fieldErrors['${fieldKey}'] = '${label} must be an integer';
`;
        }
        if (typeof r.min === 'number') {
          code += `
          if (num < ${r.min}) fieldErrors['${fieldKey}'] = '${label} must be ≥ ${r.min}';
`;
        }
        if (typeof r.max === 'number') {
          code += `
          if (num > ${r.max}) fieldErrors['${fieldKey}'] = '${label} must be ≤ ${r.max}';
`;
        }
        code += `
        }
      }
`;
      }

      // unique
      if (r.unique) {
        code += `
      if (!isMissing(${accessor}) && existingItems.some((it) => String(it['${fieldKey}']) === String(${accessor}))) {
        fieldErrors['${fieldKey}'] = '${msgMustBeUnique}';
      }
`;
      }

      // reference exists
      if (r.referenceEntity) {
        const refSlug = this._escapeJsString(r.referenceEntity);
        if (r.multiple) {
          code += `
      if (!isMissing(${accessor})) {
        if (!Array.isArray(${accessor})) {
          fieldErrors['${fieldKey}'] = '${label} must be a list of IDs';
        } else {
          const ids = await getRefIdSet('${refSlug}');
          const bad = ${accessor}.find((v) => !ids.has(String(v)));
          if (bad !== undefined) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
        }
      }
`;
        } else {
          code += `
      if (!isMissing(${accessor})) {
        const ids = await getRefIdSet('${refSlug}');
        if (!ids.has(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
      }
`;
        }
      }
    }

    code += `
      if (Object.keys(fieldErrors).length) {
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.fieldErrors = fieldErrors;
        throw err;
      }
`;
    return code;
  },

  _buildUpdateValidationSnippet(entity, allEntities) {
    const rules = this._getFieldRules(entity, allEntities);
    const computedStrip = this._buildComputedStripSnippet(entity);
    if (rules.length === 0 && !computedStrip) return '';

    let code = computedStrip;
    if (rules.length === 0) {
      // Even with no other rules, we still need to load the existing row and
      // merge the stripped payload so the update path itself remains valid.
      code += `
      const existing = await this.repository.findById(this.slug, id);
      if (!existing) return null;
      const merged = { ...existing, ...data };
`;
      return code;
    }

    const uniqueFields = rules.filter((r) => r.unique);
    const referenceFields = rules.filter((r) => r.referenceEntity);

    code += `
      // Schema-driven validation (generated)
      const existing = await this.repository.findById(this.slug, id);
      if (!existing) return null;
      const merged = { ...existing, ...data };

      const fieldErrors = {};
      const isMissing = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
      const isMissingNonString = (v) => v === undefined || v === null;
      // Plan H — relax required-field enforcement while the merged row is in
      // draft state. The merged status is what counts: an update that
      // transitions Draft → Open re-engages the required checks immediately.
      const __isDraft = String((merged && merged.status != null) ? merged.status : '').toLowerCase() === 'draft';
`;

    if (uniqueFields.length) {
      code += `
      const existingItems = await this.repository.findAll(this.slug);
`;
    }

    if (referenceFields.length) {
      code += `
      const __refIdSets = {};
      const getRefIdSet = async (slug) => {
        if (__refIdSets[slug]) return __refIdSets[slug];
        const all = await this.repository.findAll(slug);
        __refIdSets[slug] = new Set(all.map((x) => x.id));
        return __refIdSets[slug];
      };
`;
    }

    const language = this._language || 'en';
    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `merged['${fieldKey}']`;

      const msgRequired = _escForSingleQuoteJs(_validationMessage(
        language, 'required', '{label} is required', { label: r.label }
      ));
      const msgMustBeNumber = _escForSingleQuoteJs(_validationMessage(
        language, 'must_be_number', '{label} must be a number', { label: r.label }
      ));
      const msgMustBeUnique = _escForSingleQuoteJs(_validationMessage(
        language, 'must_be_unique', '{label} must be unique', { label: r.label }
      ));

      // required (Plan H: gated by !__isDraft so iterative drafts stay savable)
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!__isDraft && (!Array.isArray(${accessor}) || ${accessor}.length === 0)) fieldErrors['${fieldKey}'] = '${msgRequired}';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (!__isDraft && isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${msgRequired}';
`;
        } else {
          code += `
      if (!__isDraft && isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${msgRequired}';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        const msg = _escForSingleQuoteJs(_validationMessage(
          language, 'min_length', '{label} must be at least {min} characters',
          { label: r.label, min: r.minLength }
        ));
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${msg}';
`;
      }
      if (typeof r.maxLength === 'number') {
        const msg = _escForSingleQuoteJs(_validationMessage(
          language, 'max_length', '{label} must be at most {max} characters',
          { label: r.label, max: r.maxLength }
        ));
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${msg}';
`;
      }
      if (Array.isArray(r.options) && r.options.length) {
        const varName = `__allowed_${String(r.name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const list = r.options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        const preview = r.options.slice(0, 10).join(', ');
        const msg = _escForSingleQuoteJs(_validationMessage(
          language, 'must_be_one_of', '{label} must be one of: {options}',
          { label: r.label, options: preview }
        ));
        code += `
      const ${varName} = [${list}];
      if (!isMissing(${accessor}) && !${varName}.includes(String(${accessor}))) fieldErrors['${fieldKey}'] = '${msg}';
`;
      }
      if (typeof r.pattern === 'string' && r.pattern.length) {
        code += `
      if (!isMissing(${accessor})) {
        try {
          const re = new RegExp('${this._escapeJsString(r.pattern)}');
          if (!re.test(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} is invalid';
        } catch (e) {}
      }
`;
      }

      // numeric rules
      const isNumeric = ['integer', 'decimal', 'number'].includes(r.type);
      if (isNumeric || typeof r.min === 'number' || typeof r.max === 'number') {
        code += `
      if (!isMissing(${accessor})) {
        const num = typeof ${accessor} === 'number' ? ${accessor} : Number(${accessor});
        if (Number.isNaN(num)) {
          fieldErrors['${fieldKey}'] = '${msgMustBeNumber}';
        } else {
`;
        if (r.type === 'integer') {
          code += `
          if (!Number.isInteger(num)) fieldErrors['${fieldKey}'] = '${label} must be an integer';
`;
        }
        if (typeof r.min === 'number') {
          code += `
          if (num < ${r.min}) fieldErrors['${fieldKey}'] = '${label} must be ≥ ${r.min}';
`;
        }
        if (typeof r.max === 'number') {
          code += `
          if (num > ${r.max}) fieldErrors['${fieldKey}'] = '${label} must be ≤ ${r.max}';
`;
        }
        code += `
        }
      }
`;
      }

      // unique
      if (r.unique) {
        code += `
      if (!isMissing(${accessor}) && existingItems.some((it) => it.id !== id && String(it['${fieldKey}']) === String(${accessor}))) {
        fieldErrors['${fieldKey}'] = '${msgMustBeUnique}';
      }
`;
      }

      // reference exists
      if (r.referenceEntity) {
        const refSlug = this._escapeJsString(r.referenceEntity);
        if (r.multiple) {
          code += `
      if (!isMissing(${accessor})) {
        if (!Array.isArray(${accessor})) {
          fieldErrors['${fieldKey}'] = '${label} must be a list of IDs';
        } else {
          const ids = await getRefIdSet('${refSlug}');
          const bad = ${accessor}.find((v) => !ids.has(String(v)));
          if (bad !== undefined) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
        }
      }
`;
        } else {
          code += `
      if (!isMissing(${accessor})) {
        const ids = await getRefIdSet('${refSlug}');
        if (!ids.has(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} has an invalid reference';
      }
`;
        }
      }
    }

    code += `
      if (Object.keys(fieldErrors).length) {
        const err = new Error('Validation failed');
        err.statusCode = 400;
        err.fieldErrors = fieldErrors;
        throw err;
      }
`;
    return code;
  },

  // Owned children — entities that the current entity OWNS via its
  // `children[]` SDF declaration (inline line-items / docket lines / etc.).
  // Their rows must be cascade-deleted before the parent is removed; they
  // never block the parent delete with a 409. External references (other
  // entities that happen to point at this one) keep blocking as before.
  _ownedChildSlugsFor(entity) {
    const owned = new Set();
    const children = Array.isArray(entity && entity.children) ? entity.children : [];
    for (const ch of children) {
      if (!ch || typeof ch !== 'object') continue;
      const slug = String(ch.entity || ch.slug || '').trim();
      if (slug) owned.add(slug);
    }
    return owned;
  },

  _buildDeleteRestrictionSnippet(entity, allEntities) {
    const dependentsByEntity = new Map();
    const ownedSlugs = this._ownedChildSlugsFor(entity);

    for (const other of allEntities) {
      if (!other || other.slug === entity.slug) continue;
      const otherFields = Array.isArray(other.fields) ? other.fields : [];

      const referencingFields = otherFields
        .map((f) => {
          const ref = this._resolveReferenceEntitySlug(f, allEntities);
          if (ref !== entity.slug) return null;
          return {
            name: f.name,
            multiple: this._isFieldMultiple(f),
          };
        })
        .filter(Boolean);

      if (referencingFields.length) {
        dependentsByEntity.set(other.slug, { entity: other, fields: referencingFields });
      }
    }

    if (dependentsByEntity.size === 0) return '';

    // Split dependents into "owned children" (cascade) and "external"
    // (block with 409). Cascade runs FIRST so any rows that would have been
    // counted as dependents are gone by the time the external check runs.
    const cascadeEntries = [];
    const blockEntries = [];
    for (const [slug, info] of dependentsByEntity.entries()) {
      if (ownedSlugs.has(slug)) cascadeEntries.push([slug, info]);
      else blockEntries.push([slug, info]);
    }

    let code = `
      // Delete cascade + protection (generated). Owned children
      // (entity.children[]) are cascade-deleted first; external references
      // still raise a 409 with a dependents payload.
`;

    if (cascadeEntries.length) {
      code += `
      // Cascade-delete owned child rows.
`;
      for (const [otherSlug, info] of cascadeEntries) {
        const checks = info.fields.map((f) => {
          const key = this._escapeJsString(f.name);
          if (f.multiple) {
            return `(Array.isArray(row['${key}']) && row['${key}'].some((v) => String(v) === String(id)))`;
          }
          return `String(row['${key}'] ?? '') === String(id)`;
        });
        const matchExpr = checks.join(' || ') || 'false';

        code += `
      {
        const __ownedRows = await this.repository.findAll('${this._escapeJsString(otherSlug)}');
        for (const row of __ownedRows) {
          if (${matchExpr}) {
            try {
              await this.repository.delete('${this._escapeJsString(otherSlug)}', row.id);
            } catch (e) {
              // Surface as 409 so the caller can react; the parent is still intact.
              const __cascadeErr = new Error('Cannot delete: failed to remove owned child row in ${this._escapeJsString(otherSlug)} (' + (e && e.message ? e.message : 'unknown error') + ')');
              __cascadeErr.statusCode = 409;
              throw __cascadeErr;
            }
          }
        }
      }
`;
      }
    }

    if (blockEntries.length) {
      code += `
      const dependents = [];
`;
      for (const [otherSlug, info] of blockEntries) {
        const otherEntity = info.entity;
        const displayField = this._guessDisplayField(otherEntity);
        const displayFieldEsc = this._escapeJsString(displayField);

        const checks = info.fields.map((f) => {
          const key = this._escapeJsString(f.name);
          if (f.multiple) {
            return `(Array.isArray(row['${key}']) && row['${key}'].some((v) => String(v) === String(id)))`;
          }
          return `String(row['${key}'] ?? '') === String(id)`;
        });
        const matchExpr = checks.join(' || ') || 'false';

        const viaFields = info.fields.map((f) => `'${this._escapeJsString(f.name)}'`).join(', ');

        code += `
      {
        const rows = await this.repository.findAll('${this._escapeJsString(otherSlug)}');
        const matches = rows.filter((row) => ${matchExpr});
        if (matches.length) {
          dependents.push({
            entity: '${this._escapeJsString(otherSlug)}',
            via: [${viaFields}],
            count: matches.length,
            preview: matches.slice(0, 10).map((r) => ({ id: r.id, display: r['${displayFieldEsc}'] || r.id })),
          });
        }
      }
`;
      }

      code += `
      if (dependents.length) {
        const err = new Error('Cannot delete: this record is referenced by other records');
        err.statusCode = 409;
        err.dependents = dependents;
        throw err;
      }
`;
    }

    return code;
  },

  _getFieldRules(entity, allEntities) {
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    return fields
      .filter((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name))
      // Computed fields are maintained entirely by server-side logic and MUST
      // NOT be validated against user-supplied payloads. They are also stripped
      // from incoming data by the service-layer sanitizer (see below).
      .filter((f) => f.computed !== true)
      .map((f) => {
        const type = String(f.type || 'string');
        const label = f.label ? String(f.label) : this._formatLabel(f.name);
        const rawOptions = f.options ?? f.enum ?? f.allowed_values ?? f.allowedValues;
        const options = Array.isArray(rawOptions)
          ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
          : undefined;
        const rule = {
          name: f.name,
          type,
          label,
          required: resolveEffectiveRequired(f),
          unique: !!f.unique,
          minLength: typeof f.min_length === 'number' ? f.min_length : (typeof f.minLength === 'number' ? f.minLength : undefined),
          maxLength: typeof f.max_length === 'number' ? f.max_length : (typeof f.maxLength === 'number' ? f.maxLength : undefined),
          min: typeof f.min === 'number' ? f.min : (typeof f.min_value === 'number' ? f.min_value : (typeof f.minValue === 'number' ? f.minValue : undefined)),
          max: typeof f.max === 'number' ? f.max : (typeof f.max_value === 'number' ? f.max_value : (typeof f.maxValue === 'number' ? f.maxValue : undefined)),
          pattern: typeof f.pattern === 'string' ? f.pattern : (typeof f.regex === 'string' ? f.regex : undefined),
          options,
          referenceEntity: this._resolveReferenceEntitySlug(f, allEntities),
          multiple: this._isFieldMultiple(f),
        };

        // If the field isn't a reference, clear referenceEntity so we don't accidentally validate it.
        const isReferenceish = type === 'reference' || f.name.endsWith('_id') || f.name.endsWith('_ids') || !!(f.reference_entity || f.referenceEntity);
        if (!isReferenceish) {
          rule.referenceEntity = null;
          rule.multiple = false;
        }

        return rule;
      });
  },

  _isFieldMultiple(field) {
    return field && (field.multiple === true || field.is_array === true || String(field.name || '').endsWith('_ids'));
  },

  _resolveReferenceEntitySlug(field, allEntities) {
    if (!field) return null;

    const explicit = field.reference_entity || field.referenceEntity;
    const name = String(field.name || '');
    const inferredBase = name.replace(/_ids?$/, '');
    const baseName = String(explicit || inferredBase);

    if (!baseName) return null;

    const entities = Array.isArray(allEntities) ? allEntities : [];
    const target = entities.find((e) =>
      e.slug === baseName ||
      e.slug === baseName + 's' ||
      e.slug === baseName + 'es' ||
      (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
      e.slug.startsWith(baseName)
    );

    return target ? target.slug : (explicit ? String(explicit) : null);
  },

  _guessDisplayField(entity) {
    if (!entity) return 'id';
    if (entity.display_field) return String(entity.display_field);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    if (fields.some((f) => f && f.name === 'name')) return 'name';
    if (fields.some((f) => f && f.name === 'sku')) return 'sku';
    const first = fields.find((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name));
    return first ? String(first.name) : 'id';
  },

  _escapeJsString(str) {
    // Escape a string for safe inclusion inside single-quoted JS string literals.
    // Important for generated code (regex patterns can include `$`/backslashes/newlines/etc).
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/'/g, "\\'");
  },

  _formatLabel(str) {
    return String(str).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
};
