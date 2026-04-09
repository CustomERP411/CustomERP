// Field definitions and utility methods (split from FrontendGenerator)
const path = require('path');

module.exports = {
  async generateDynamicForm(outputDir) {
    // Prefer frontend-bricks template (keeps generator modular).
    await this.brickRepo.copyFile(
      'frontend-bricks/components/DynamicForm.tsx',
      path.join(outputDir, 'src/components/DynamicForm.tsx')
    );
  },

  _generateFieldDefinitions(fields, features, allEntities) {
    const defs = [];

    for (const field of fields) {
      if (!field || ['id', 'created_at', 'updated_at'].includes(field.name)) continue;

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
      const label = this._escapeJsString(field.label ? String(field.label) : this._formatLabel(field.name));

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
      defs.push(`  { name: '${field.name}', label: '${label}', type: '${field.type}', widget: '${widget}', required: ${field.required || false}${extraProps} },`);
    }

    // Feature-specific fields (backwards compat)
    if (features && features.batch_tracking) {
      const hasBatch = fields.some((f) => f && f.name === 'batch_number');
      const hasExpiry = fields.some((f) => f && f.name === 'expiry_date');
      if (!hasBatch) defs.push(`  { name: 'batch_number', label: 'Batch Number', type: 'string', widget: 'Input', required: true },`);
      if (!hasExpiry) defs.push(`  { name: 'expiry_date', label: 'Expiry Date', type: 'date', widget: 'DatePicker', required: false },`);
    }

    if (features && features.serial_tracking) {
      const hasSerial = fields.some((f) => f && f.name === 'serial_number');
      if (!hasSerial) defs.push(`  { name: 'serial_number', label: 'Serial Number', type: 'string', widget: 'Input', required: true },`);
    }

    if (features && features.multi_location) {
      const hasLocationRef = fields.some((f) => {
        if (!f) return false;
        const ref = f.reference_entity || f.referenceEntity;
        return f.name === 'location_id' || f.name === 'location_ids' || ref === 'locations';
      });
      if (!hasLocationRef) {
        defs.push(`  { name: 'location_id', label: 'Location', type: 'reference', widget: 'EntitySelect', required: true, referenceEntity: 'locations' },`);
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
