// Field definitions and utility methods (split from FrontendGenerator)
const path = require('path');
const fs = require('fs').promises;
const { tFor } = require('../../i18n/labels');
const { pickTrFieldLabel } = require('../../i18n/glossaryI18n');
const { resolveEffectiveRequired } = require('../shared/fieldRequired');

module.exports = {
  async generateDynamicForm(outputDir) {
    const t = tFor(this._language || 'en');
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
    };
    const template = await this.brickRepo.getTemplate('DynamicForm.tsx');
    const content = template.replace('__DYNAMIC_FORM_I18N__', `${JSON.stringify(labels, null, 2)} as const`);
    const dest = path.join(outputDir, 'src/components/DynamicForm.tsx');
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, content);
  },

  _resolveFieldLabelForForm(field) {
    const auto = this._formatLabel(field.name);
    const fromSdf = field.label != null && field.label !== '' ? String(field.label) : null;
    let text = fromSdf != null && fromSdf !== '' ? fromSdf : auto;
    if (this._language === 'tr') {
      const tr = pickTrFieldLabel(field.name, fromSdf);
      if (tr) text = tr;
    }
    return this._escapeJsString(text);
  },

  _resolveColumnLabel(colName, defField) {
    const auto = this._formatLabel(colName);
    const fromSdf = defField && defField.label != null && defField.label !== '' ? String(defField.label) : null;
    let text = fromSdf != null && fromSdf !== '' ? fromSdf : auto;
    if (this._language === 'tr') {
      const tr = pickTrFieldLabel(colName, fromSdf);
      if (tr) text = tr;
    }
    return this._escapeJsString(text);
  },

  _generateFieldDefinitions(fields, features, allEntities) {
    const defs = [];

    for (const field of fields) {
      if (!field || ['id', 'created_at', 'updated_at'].includes(field.name)) continue;
      // Server-maintained (computed) fields must never appear as editable
      // inputs in create/edit forms. They are still persisted, shown in
      // list views, and (where applicable) rendered in dedicated read-only
      // bands such as the inventory "Stock Availability" band.
      if (field.computed === true) continue;

      const rawOptions = field.options ?? field.enum ?? field.allowed_values ?? field.allowedValues;
      const options = Array.isArray(rawOptions)
        ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
        : null;

      let widget = field.widget || this._getWidgetForType(field.type);
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
        };
        widget = widgetMap[wNorm] || w;
      }
      if (!field.widget && options && options.length) {
        // Fast tap-friendly UX for small enums, dropdown for larger.
        widget = options.length <= 4 ? 'RadioGroup' : 'Select';
      }
      const label = this._resolveFieldLabelForForm(field);
      const required = resolveEffectiveRequired(field);

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
