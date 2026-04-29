// Field definitions and utility methods (split from FrontendGenerator)
const path = require('path');
const fs = require('fs').promises;
const { tFor } = require('../../i18n/labels');
const { pickTrFieldLabel } = require('../../i18n/glossaryI18n');
const { resolveEffectiveRequired } = require('../shared/fieldRequired');

module.exports = {
  async generateDynamicForm(outputDir) {
    const t = tFor(this._language || 'en');
    // DynamicForm's resolveHeading() walks dotted i18n keys (e.g.
    // "form.sections.details") against the labels JSON we inject below.
    // The AI generators emit those exact dot-keys for every section heading,
    // so the labels object MUST mirror that namespace; otherwise the lookup
    // falls back to the raw key and the user sees "form.sections.details"
    // sitting in the form. Mirror the canonical sections from en/tr.json so
    // any of the documented headings (`identity`, `details`, `lifecycle`,
    // `notes`, `lineItems`, `totals`) resolve.
    const labels = {
      cancel: t('dynamicForm.cancel'),
      save: t('dynamicForm.save'),
      selectPlaceholder: t('dynamicForm.selectPlaceholder'),
      validation: {
        required: t('dynamicForm.validation.required'),
        minLength: t('dynamicForm.validation.minLength'),
        maxLength: t('dynamicForm.validation.maxLength'),
        number: t('dynamicForm.validation.number'),
        min: t('dynamicForm.validation.min'),
        max: t('dynamicForm.validation.max'),
        oneOf: t('dynamicForm.validation.oneOf'),
        invalid: t('dynamicForm.validation.invalid'),
      },
      form: {
        sections: {
          identity: t('form.sections.identity'),
          details: t('form.sections.details'),
          lifecycle: t('form.sections.lifecycle'),
          notes: t('form.sections.notes'),
          lineItems: t('form.sections.lineItems'),
          totals: t('form.sections.totals'),
          // Tolerate the singular spelling some generators emit.
          section: {
            identity: t('form.sections.identity'),
            details: t('form.sections.details'),
            lifecycle: t('form.sections.lifecycle'),
            notes: t('form.sections.notes'),
            lineItems: t('form.sections.lineItems'),
            totals: t('form.sections.totals'),
          },
        },
      },
    };
    const template = await this.brickRepo.getTemplate('DynamicForm.tsx');
    const content = template.replace('__DYNAMIC_FORM_I18N__', `${JSON.stringify(labels, null, 2)} as const`);
    const dest = path.join(outputDir, 'src/components/DynamicForm.tsx');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);

    // Plan F A2/A3 — copy the shared client evaluator next to DynamicForm
    // so the relative import in the form template resolves at compile time
    // in the generated frontend. The file is plain TS with no template
    // substitutions; ship it verbatim.
    const evaluatorSrc = await this.brickRepo.getTemplate('derivedFieldEvaluator.ts');
    const evaluatorDest = path.join(outputDir, 'src/components/derivedFieldEvaluator.ts');
    await fs.writeFile(evaluatorDest, evaluatorSrc);
  },

  // Plan E C2: when a field is missing an explicit `label` AND it points
  // at another entity via reference_entity, fall back to that target's
  // display label (e.g. `customer_id` -> "Customer") rather than the raw
  // title-cased column name ("Customer Id"). Strips the trailing `_id` /
  // `_ids` for the very-last fallback so we never render the awkward
  // "Customer Id" suffix even when the target entity isn't found.
  _resolveReferenceTargetLabel(defField, allEntities) {
    if (!defField) return null;
    const isReferenceShape =
      defField.type === 'reference' ||
      defField.reference_entity ||
      defField.referenceEntity ||
      (typeof defField.name === 'string' && (defField.name.endsWith('_id') || defField.name.endsWith('_ids')));
    if (!isReferenceShape) return null;
    if (!Array.isArray(allEntities) || allEntities.length === 0) return null;

    const explicitRef = defField.reference_entity || defField.referenceEntity;
    const inferredBase = String(defField.name || '').replace(/_ids?$/, '');
    const baseName = String(explicitRef || inferredBase);
    if (!baseName) return null;
    const target = allEntities.find((e) =>
      e && (
        e.slug === baseName ||
        e.slug === baseName + 's' ||
        e.slug === baseName + 'es' ||
        (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
        (typeof e.slug === 'string' && e.slug.startsWith(baseName))
      )
    );
    if (!target) return null;
    if (target.label) return String(target.label);
    if (target.display_name) return String(target.display_name);
    if (target.displayName) return String(target.displayName);
    return null;
  },

  _resolveFieldLabelForForm(field, allEntities) {
    const auto = this._formatLabel(String(field.name || '').replace(/_ids?$/, ''));
    const fromSdf = field.label != null && field.label !== '' ? String(field.label) : null;
    const refFallback = fromSdf == null ? this._resolveReferenceTargetLabel(field, allEntities) : null;
    let text = fromSdf != null && fromSdf !== '' ? fromSdf : (refFallback || auto);
    if (this._language === 'tr') {
      const tr = pickTrFieldLabel(field.name, fromSdf);
      if (tr) text = tr;
    }
    return this._escapeJsString(text);
  },

  _resolveColumnLabel(colName, defField, allEntities) {
    const auto = this._formatLabel(String(colName || '').replace(/_ids?$/, ''));
    const fromSdf = defField && defField.label != null && defField.label !== '' ? String(defField.label) : null;
    const refFallback = fromSdf == null ? this._resolveReferenceTargetLabel(defField, allEntities) : null;
    let text = fromSdf != null && fromSdf !== '' ? fromSdf : (refFallback || auto);
    if (this._language === 'tr') {
      const tr = pickTrFieldLabel(colName, fromSdf);
      if (tr) text = tr;
    }
    return this._escapeJsString(text);
  },

  // Plan F B2 — resolve a `default_from` config path against the SDF
  // modules tree. Path shape: 'modules.<module>.<key>[.<subkey>...]'. Returns
  // the value at that path, or `undefined` when the path is missing or the
  // sdf wasn't threaded through. Caller decides whether to fall through to
  // `field.default`.
  _resolveConfigPath(pathStr, sdf) {
    if (!pathStr || typeof pathStr !== 'string') return undefined;
    if (!sdf || typeof sdf !== 'object') return undefined;
    const parts = pathStr.split('.').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return undefined;
    let cursor = sdf;
    for (const key of parts) {
      if (cursor && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, key)) {
        cursor = cursor[key];
      } else {
        return undefined;
      }
    }
    return cursor;
  },

  _generateFieldDefinitions(fields, features, allEntities, sdf) {
    const defs = [];

    for (const field of fields) {
      if (!field || ['id', 'created_at', 'updated_at'].includes(field.name)) continue;

      const rawOptions = field.options ?? field.enum ?? field.allowed_values ?? field.allowedValues;
      const options = Array.isArray(rawOptions)
        ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
        : null;

      // Plan F A4 — `computed: true` fields used to be skipped entirely so
      // they never showed up in create/edit forms. We now emit them with a
      // dedicated read-only `ComputedDisplay` widget so the user can SEE
      // the live-computed value (e.g. invoice total) as they fill the
      // form. The dedicated invoice totals panel and inventory
      // availability band still exist; both read from formData (which the
      // derived-field useEffect updates) so they stay consistent.
      const isComputed = field.computed === true;

      let widget;
      if (isComputed) {
        widget = 'ComputedDisplay';
      } else {
        widget = field.widget || this._getWidgetForType(field.type);
        if (typeof widget === 'string' && widget.length) {
          const w = widget.trim();
          const wNorm = w.toLowerCase();
          const widgetMap = {
            input: 'Input',
            textinput: 'Input',
            textarea: 'TextArea',
            number: 'NumberInput',
            numberinput: 'NumberInput',
            checkbox: 'Checkbox',
            date: 'DatePicker',
            datepicker: 'DatePicker',
            select: 'Select',
            dropdown: 'Select',
            radiogroup: 'RadioGroup',
            radio: 'RadioGroup',
            entityselect: 'EntitySelect',
            computeddisplay: 'ComputedDisplay',
          };
          widget = widgetMap[wNorm] || w;
        }
        if (!field.widget && options && options.length) {
          widget = options.length <= 4 ? 'RadioGroup' : 'Select';
        }
      }
      const label = this._resolveFieldLabelForForm(field, allEntities);
      // Computed fields are server-populated — never required at the form
      // layer; the user can't fill them in.
      const required = isComputed ? false : resolveEffectiveRequired(field);

      const extraParts = [];

      const minLength = field.min_length ?? field.minLength;
      const maxLength = field.max_length ?? field.maxLength;
      const min = field.min ?? field.min_value ?? field.minValue;
      const max = field.max ?? field.max_value ?? field.maxValue;
      const pattern = field.pattern ?? field.regex;
      const unique = field.unique === true;

      if (typeof minLength === 'number') extraParts.push(`minLength: ${minLength}`);
      if (typeof maxLength === 'number') extraParts.push(`maxLength: ${maxLength}`);
      if (typeof min === 'number') extraParts.push(`min: ${min}`);
      if (typeof max === 'number') extraParts.push(`max: ${max}`);
      if (typeof pattern === 'string' && pattern.length) extraParts.push(`pattern: '${this._escapeJsString(pattern)}'`);
      if (unique) extraParts.push(`unique: true`);

      if (options && options.length) {
        const opts = options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        extraParts.push(`options: [${opts}]`);
      }

      // Plan G D3 — emit visibilityWhen predicate so DynamicForm can hide
      // the field when the predicate doesn't match. The predicate is
      // serialized via JSON.stringify so list-shaped values (in / not_in)
      // and boolean values (is_set / is_unset) round-trip safely. Pydantic
      // (D1) + sdfValidation.js (D2) have already enforced the shape; here
      // we only filter to a known comparator and emit the canonical pair.
      const visibilityWhen = field.visibility_when || field.visibilityWhen;
      const VISIBILITY_OPERATORS = ['equals', 'not_equals', 'in', 'not_in', 'is_set', 'is_unset'];
      if (visibilityWhen && typeof visibilityWhen === 'object'
          && typeof visibilityWhen.field === 'string' && visibilityWhen.field.length > 0) {
        const comparator = VISIBILITY_OPERATORS.find((k) =>
          Object.prototype.hasOwnProperty.call(visibilityWhen, k));
        if (comparator) {
          const out = { field: visibilityWhen.field, [comparator]: visibilityWhen[comparator] };
          extraParts.push(`visibilityWhen: ${JSON.stringify(out)}`);
        }
      }

      // Inline help text rendered under the field input.
      if (typeof field.help === 'string' && field.help.length > 0) {
        extraParts.push(`help: '${this._escapeJsString(field.help)}'`);
      }

      // Plan F B2 — emit defaultValue, resolving `default_from` against the
      // SDF modules tree at codegen time. `default` (an explicit literal)
      // takes precedence; `default_from` is the fallback. Skip computed
      // fields (server populates them) and skip altogether when neither is
      // set.
      if (!isComputed) {
        let resolvedDefault;
        if (field.default !== undefined) {
          resolvedDefault = field.default;
        } else if (typeof field.default_from === 'string' && field.default_from.length > 0) {
          resolvedDefault = this._resolveConfigPath(field.default_from, sdf);
        } else if (typeof field.defaultFrom === 'string' && field.defaultFrom.length > 0) {
          resolvedDefault = this._resolveConfigPath(field.defaultFrom, sdf);
        }
        if (resolvedDefault !== undefined) {
          extraParts.push(`defaultValue: ${JSON.stringify(resolvedDefault)}`);
        }
      }

      const isReference = field.type === 'reference' || field.name.endsWith('_id') || field.name.endsWith('_ids');
      if (isReference) {
        const explicitRef = field.reference_entity || field.referenceEntity;
        const inferredBase = String(field.name).replace(/_ids?$/, '');
        const baseName = String(explicitRef || inferredBase);
        const targetEntity = (allEntities || []).find((e) =>
          e.slug === baseName ||
          e.slug === baseName + 's' ||
          e.slug === baseName + 'es' ||
          (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
          e.slug.startsWith(baseName)
        );
        if (targetEntity) {
          extraParts.push(`referenceEntity: '${targetEntity.slug}'`);
        } else if (explicitRef) {
          extraParts.push(`referenceEntity: '${this._escapeJsString(explicitRef)}'`);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`Could not resolve reference for field ${field.name}`);
        }

        const multiple = field.multiple === true || field.is_array === true || field.name.endsWith('_ids');
        if (multiple) extraParts.push(`multiple: true`);
      }

      const extraProps = extraParts.length ? `, ${extraParts.join(', ')}` : '';
      defs.push(`  { name: '${field.name}', label: '${label}', type: '${field.type}', widget: '${widget}', required: ${required}${extraProps} },`);
    }

    const t = tFor(this._language || 'en');
    const batchLabel = this._escapeJsString(t('fieldLabels.inventory.batch'));
    const expiryLabel = this._escapeJsString(t('fieldLabels.inventory.expiry'));
    const serialLabel = this._escapeJsString(t('fieldLabels.inventory.serial'));
    const locationLabel = this._escapeJsString(t('fieldLabels.inventory.location'));

    if (features && features.batch_tracking) {
      const hasBatch = fields.some((f) => f && f.name === 'batch_number');
      const hasExpiry = fields.some((f) => f && f.name === 'expiry_date');
      if (!hasBatch) defs.push(`  { name: 'batch_number', label: '${batchLabel}', type: 'string', widget: 'Input', required: true },`);
      if (!hasExpiry) defs.push(`  { name: 'expiry_date', label: '${expiryLabel}', type: 'date', widget: 'DatePicker', required: false },`);
    }

    if (features && features.serial_tracking) {
      const hasSerial = fields.some((f) => f && f.name === 'serial_number');
      if (!hasSerial) defs.push(`  { name: 'serial_number', label: '${serialLabel}', type: 'string', widget: 'Input', required: true },`);
    }

    if (features && features.multi_location) {
      const hasLocationRef = fields.some((f) => {
        if (!f) return false;
        const ref = f.reference_entity || f.referenceEntity;
        return f.name === 'location_id' || f.name === 'location_ids' || ref === 'locations';
      });
      if (!hasLocationRef) {
        defs.push(`  { name: 'location_id', label: '${locationLabel}', type: 'reference', widget: 'EntitySelect', required: true, referenceEntity: 'locations' },`);
      }
    }

    return defs.join('\n');
  },

  _getWidgetForType(type) {
    const widgetMap = {
      string: 'Input',
      integer: 'NumberInput',
      decimal: 'NumberInput',
      number: 'NumberInput',
      boolean: 'Checkbox',
      date: 'DatePicker',
      datetime: 'DatePicker',
      reference: 'EntitySelect',
      text: 'TextArea'
    };
    return widgetMap[type] || 'Input';
  },

  _capitalize(str) {
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
  },

  _formatLabel(str) {
    return String(str).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  },

  _guessDisplayField(entity) {
    if (!entity) return 'id';
    if (entity.display_field) return String(entity.display_field);
    if (entity.displayField) return String(entity.displayField);

    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    if (fields.some((f) => f && f.name === 'name')) return 'name';
    if (fields.some((f) => f && f.name === 'sku')) return 'sku';
    const first = fields.find((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name));
    return first ? String(first.name) : 'id';
  },

  _escapeJsString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/'/g, "\\'");
  },
};
