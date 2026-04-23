// Schema validation code generation (split from BackendGenerator)
module.exports = {
  _injectSchemaValidations(weaver, entity, allEntities) {
    const createSnippet = this._buildCreateValidationSnippet(entity, allEntities);
    const updateSnippet = this._buildUpdateValidationSnippet(entity, allEntities);
    const deleteSnippet = this._buildDeleteRestrictionSnippet(entity, allEntities);

    if (createSnippet) weaver.inject('BEFORE_CREATE_VALIDATION', createSnippet);
    if (updateSnippet) weaver.inject('BEFORE_UPDATE_VALIDATION', updateSnippet);
    if (deleteSnippet) weaver.inject('BEFORE_DELETE_VALIDATION', deleteSnippet);
  },

  _getComputedFieldNames(entity) {
    const fields = Array.isArray(entity && entity.fields) ? entity.fields : [];
    return fields
      .filter((f) => f && f.computed === true && f.name && !['id', 'created_at', 'updated_at'].includes(f.name))
      .map((f) => String(f.name));
  },

  _buildComputedStripSnippet(entity) {
    const computed = this._getComputedFieldNames(entity);
    if (!computed.length) return '';
    const literal = JSON.stringify(computed);
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

    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `data['${fieldKey}']`;

      // required
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!Array.isArray(${accessor}) || ${accessor}.length === 0) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else {
          code += `
      if (isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${label} must be at least ${r.minLength} characters';
`;
      }
      if (typeof r.maxLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${label} must be at most ${r.maxLength} characters';
`;
      }
      if (Array.isArray(r.options) && r.options.length) {
        const varName = `__allowed_${String(r.name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const list = r.options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        const preview = this._escapeJsString(r.options.slice(0, 10).join(', '));
        code += `
      const ${varName} = [${list}];
      if (!isMissing(${accessor}) && !${varName}.includes(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} must be one of: ${preview}';
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
          fieldErrors['${fieldKey}'] = '${label} must be a number';
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
        fieldErrors['${fieldKey}'] = '${label} must be unique';
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

    for (const r of rules) {
      const fieldKey = this._escapeJsString(r.name);
      const label = this._escapeJsString(r.label);
      const accessor = `merged['${fieldKey}']`;

      // required
      if (r.required) {
        if (r.multiple) {
          code += `
      if (!Array.isArray(${accessor}) || ${accessor}.length === 0) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else if (r.type === 'boolean') {
          code += `
      if (isMissingNonString(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        } else {
          code += `
      if (isMissing(${accessor})) fieldErrors['${fieldKey}'] = '${label} is required';
`;
        }
      }

      // string rules
      if (typeof r.minLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length < ${r.minLength}) fieldErrors['${fieldKey}'] = '${label} must be at least ${r.minLength} characters';
`;
      }
      if (typeof r.maxLength === 'number') {
        code += `
      if (!isMissing(${accessor}) && String(${accessor}).length > ${r.maxLength}) fieldErrors['${fieldKey}'] = '${label} must be at most ${r.maxLength} characters';
`;
      }
      if (Array.isArray(r.options) && r.options.length) {
        const varName = `__allowed_${String(r.name).replace(/[^a-zA-Z0-9_]/g, '_')}`;
        const list = r.options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        const preview = this._escapeJsString(r.options.slice(0, 10).join(', '));
        code += `
      const ${varName} = [${list}];
      if (!isMissing(${accessor}) && !${varName}.includes(String(${accessor}))) fieldErrors['${fieldKey}'] = '${label} must be one of: ${preview}';
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
          fieldErrors['${fieldKey}'] = '${label} must be a number';
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
        fieldErrors['${fieldKey}'] = '${label} must be unique';
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

  _buildDeleteRestrictionSnippet(entity, allEntities) {
    const dependentsByEntity = new Map();

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

    let code = `
      // Delete protection (generated): prevent deleting a record that is referenced by others
      const dependents = [];
`;

    for (const [otherSlug, info] of dependentsByEntity.entries()) {
      const otherEntity = info.entity;
      const displayField = this._guessDisplayField(otherEntity);
      const displayFieldEsc = this._escapeJsString(displayField);

      // Build per-row match condition across all referencing fields
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
          required: !!f.required,
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
