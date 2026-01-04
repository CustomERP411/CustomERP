import { useEffect, useState } from 'react';
import api from '../services/api';
import { ENTITIES } from '../config/entities';

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  widget: string;
  required?: boolean;
  referenceEntity?: string;
  multiple?: boolean;
  options?: string[];
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  unique?: boolean;
}

interface DynamicFormProps {
  fields: FieldDefinition[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
}

export default function DynamicForm({ fields, initialData = {}, onSubmit, onCancel }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [referenceOptions, setReferenceOptions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    setFormData(initialData || {});
    setErrors({});
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const refFields = fields.filter((f) => f.widget === 'EntitySelect' && f.referenceEntity);
      if (refFields.length === 0) return;
      try {
        const results = await Promise.all(
          refFields.map(async (field) => {
            const res = await api.get('/' + field.referenceEntity);
            return [field.name, Array.isArray(res.data) ? res.data : []] as const;
          })
        );
        if (cancelled) return;
        setReferenceOptions((prev) => ({ ...prev, ...Object.fromEntries(results) }));
      } catch (err) {
        console.error('Failed to load reference options:', err);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [fields]);

  const isEmpty = (field: FieldDefinition, value: any) => {
    if (field.widget === 'Checkbox') return value !== true;
    if (field.widget === 'EntitySelect' && field.multiple) return !Array.isArray(value) || value.length === 0;
    return value === undefined || value === null || String(value).trim() === '';
  };

  const validateField = (field: FieldDefinition, value: any): string | null => {
    if (field.required && isEmpty(field, value)) return field.label + ' is required';
    if (value === undefined || value === null || String(value).trim() === '') return null;

    const str = String(value);
    if (typeof field.minLength === 'number' && str.length < field.minLength)
      return field.label + ' must be at least ' + field.minLength + ' characters';
    if (typeof field.maxLength === 'number' && str.length > field.maxLength)
      return field.label + ' must be at most ' + field.maxLength + ' characters';

    const isNumericType = ['integer', 'decimal', 'number'].includes(field.type);
    if (isNumericType) {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(num)) return field.label + ' must be a number';
      if (typeof field.min === 'number' && num < field.min) return field.label + ' must be ≥ ' + field.min;
      if (typeof field.max === 'number' && num > field.max) return field.label + ' must be ≤ ' + field.max;
    }

    if (Array.isArray(field.options) && field.options.length > 0) {
      const allowed = new Set(field.options.map(String));
      if (!allowed.has(str)) {
        const preview = field.options.slice(0, 8).join(', ');
        return field.label + ' must be one of: ' + preview;
      }
    }

    if (typeof field.pattern === 'string' && field.pattern.length) {
      try {
        const re = new RegExp(field.pattern);
        if (!re.test(str)) return field.label + ' is invalid';
      } catch {}
    }

    return null;
  };

  const setField = (field: FieldDefinition, value: any) => {
    setFormData((prev) => ({ ...prev, [field.name]: value }));
    const err = validateField(field, value);
    setErrors((prev) => {
      if (!err) {
        const { [field.name]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field.name]: err };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const err = validateField(field, formData[field.name]);
      if (err) nextErrors[field.name] = err;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(formData);
  };

  const renderWidget = (field: FieldDefinition) => {
    const raw = formData[field.name];
    const value = raw ?? '';
    const options = Array.isArray(field.options) ? field.options : [];

    switch (field.widget) {
      case 'RadioGroup':
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const selected = String(value) === String(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setField(field, opt)}
                  className={
                    'px-3 py-2 rounded border text-sm font-medium transition ' +
                    (selected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50')
                  }
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );

      case 'Select':
        return (
          <select
            value={value}
            onChange={(e) => setField(field, e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {field.required ? null : <option value="">Select...</option>}
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case 'NumberInput':
        return (
          <input
            type="number"
            value={value === '' || value === undefined || value === null ? '' : String(value)}
            onChange={(e) => {
              if (e.target.value === '') return setField(field, undefined);
              setField(field, e.target.valueAsNumber);
            }}
            min={typeof field.min === 'number' ? field.min : undefined}
            max={typeof field.max === 'number' ? field.max : undefined}
            step={field.type === 'integer' ? 1 : 'any'}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case 'DatePicker':
        return (
          <input
            type="date"
            value={value ? String(value).split('T')[0] : ''}
            onChange={(e) => setField(field, e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );

      case 'EntitySelect':
        const refOptions = referenceOptions[field.name] || [];
        const selectValue = field.multiple ? (Array.isArray(raw) ? raw : raw ? [raw] : []) : value;
        return (
          <select
            multiple={!!field.multiple}
            value={selectValue}
            onChange={(e) => {
              if (field.multiple) {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setField(field, values);
              } else {
                setField(field, e.target.value);
              }
            }}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {field.multiple ? null : <option value="">Select...</option>}
            {refOptions.map((opt: any) => (
              <option key={opt.id} value={opt.id}>
                {field.referenceEntity ? getEntityDisplay(field.referenceEntity, opt) : opt.name || opt.sku || opt.id}
              </option>
            ))}
          </select>
        );

      case 'TextArea':
        return (
          <textarea
            value={value}
            onChange={(e) => setField(field, e.target.value)}
            minLength={typeof field.minLength === 'number' ? field.minLength : undefined}
            maxLength={typeof field.maxLength === 'number' ? field.maxLength : undefined}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        );

      case 'Checkbox':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setField(field, e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => setField(field, e.target.value)}
            minLength={typeof field.minLength === 'number' ? field.minLength : undefined}
            maxLength={typeof field.maxLength === 'number' ? field.maxLength : undefined}
            pattern={typeof field.pattern === 'string' ? field.pattern : undefined}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {renderWidget(field)}
          {errors[field.name] ? <div className="mt-1 text-xs text-red-600">{errors[field.name]}</div> : null}
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Save
        </button>
      </div>
    </form>
  );
}


