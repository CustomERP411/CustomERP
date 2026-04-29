import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { ENTITIES } from '../config/entities';
// Plan F A2/A3 — shared client evaluator for derived-field formulas. The
// generator copies derivedFieldEvaluator.ts into src/components/ next to
// this file so the relative import resolves at compile time in the
// generated ERP frontend.
import { evaluate as evaluateDerived } from './derivedFieldEvaluator';

const I18N = __DYNAMIC_FORM_I18N__;

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
  // Plan G D4 — conditional visibility predicate. Operator set:
  //   { field, equals: <scalar> }
  //   { field, not_equals: <scalar> }
  //   { field, in: <scalar[]> }
  //   { field, not_in: <scalar[]> }
  //   { field, is_set: boolean }
  //   { field, is_unset: boolean }
  // Hidden fields are skipped during validation and stripped from the
  // submitted payload so the form and server agree on which fields apply.
  visibilityWhen?: { field: string } & (
    | { equals: any }
    | { not_equals: any }
    | { in: any[] }
    | { not_in: any[] }
    | { is_set: boolean }
    | { is_unset: boolean }
  );
  help?: string;
  defaultValue?: any;
}

// Plan F A3 — shape of a derived-field relation as emitted by the assembler
// alongside the entity's field defs. The full SDF carries `kind`, `when`,
// etc. but the form only needs the subset that actually drives evaluation.
interface DerivedRelationDef {
  computed_field: string;
  formula: string;
}

// UI Sections — ordered render layout. Either a captioned group of
// the form's own fields (referenced by name) or a named slot the parent
// page fills with non-field content (line-items table, invoice totals,
// rollups, etc.). Crucially, the form keeps a single shared `formData`
// state so atomic submit + validation still apply across all groups —
// non-field slots are rendered visually between groups but do not
// participate in field state.
type FormGroup =
  | { kind: 'fields'; fieldNames: string[]; heading?: string }
  | { kind: 'slot'; name: string };

interface DynamicFormProps {
  fields: FieldDefinition[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
  // Plan F A3 — derived-field relations + an opaque map of child rows the
  // form has already loaded (e.g. invoice_items for an invoice). The form
  // re-evaluates each relation on every formData/childItems change and
  // writes the result into formData[computed_field]. `sum_lines` reads
  // childItemsBySlug; every other handler reads formData only.
  derivedRelations?: DerivedRelationDef[];
  childItemsBySlug?: Record<string, any[]>;
  // Plan F B4 — optional notify-up callback so the parent page can lift
  // formData state for sibling read-only panels (e.g. the dedicated
  // invoice totals panel). Called whenever formData changes.
  onChange?: (data: Record<string, any>) => void;
  // UI Sections — when provided, the form renders fields in the declared
  // group order (interleaved with named slots) instead of the default
  // single-pass field map. Fields not referenced by any `kind: 'fields'`
  // group are auto-appended in a trailing unnamed group so the form never
  // silently swallows fields. `slots[name]` provides the React node for
  // each `kind: 'slot'` placeholder.
  groups?: FormGroup[];
  slots?: Record<string, React.ReactNode>;
}

// Plan F A3 — seed initial form state from explicit initialData first, then
// fall back to per-field defaultValue. We only seed defaults that are
// actually missing in initialData (so an explicit empty string stays
// empty). This closes the Plan E gap where FieldDefinition declared
// defaultValue but the form never read it.
function _seedInitialFormData(
  fields: FieldDefinition[],
  initialData: Record<string, any>,
): Record<string, any> {
  const seeded: Record<string, any> = { ...(initialData || {}) };
  for (const field of fields) {
    if (field.defaultValue === undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(seeded, field.name)) {
      seeded[field.name] = field.defaultValue;
    }
  }
  return seeded;
}

export default function DynamicForm({
  fields,
  initialData = {},
  onSubmit,
  onCancel,
  derivedRelations,
  childItemsBySlug,
  onChange,
  groups,
  slots,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(() =>
    _seedInitialFormData(fields, initialData),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [referenceOptions, setReferenceOptions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    setFormData(_seedInitialFormData(fields, initialData || {}));
    setErrors({});
  }, [initialData]);

  // Plan F B4 — notify the parent of every formData change so sibling
  // read-only panels (e.g. invoice totals panel) can mirror live values
  // (`tax_rate`, `discount`, computed totals) without duplicating math.
  useEffect(() => {
    if (typeof onChange === 'function') onChange(formData);
  }, [formData, onChange]);

  // Plan F A3 — re-evaluate every derived relation whenever a relevant input
  // changes. We compare against the previous formData snapshot inside the
  // setState updater and only commit when at least one computed_field
  // actually changed value, so React doesn't render-loop. Numeric outputs
  // are compared via Number(...) coercion so 0 vs '0' don't trigger a
  // bogus re-render.
  const derivedKey = useMemo(() => {
    if (!Array.isArray(derivedRelations) || derivedRelations.length === 0) return '';
    return derivedRelations.map((r) => `${r.computed_field}|${r.formula}`).join('||');
  }, [derivedRelations]);

  useEffect(() => {
    const rels = Array.isArray(derivedRelations) ? derivedRelations : [];
    if (rels.length === 0) return;
    setFormData((prev) => {
      let next: Record<string, any> | null = null;
      for (const rel of rels) {
        if (!rel || !rel.computed_field || !rel.formula) continue;
        const computed = evaluateDerived(rel, {
          formData: prev,
          childItemsBySlug,
        });
        if (computed === undefined) continue;
        const before = prev[rel.computed_field];
        const same =
          (typeof before === 'number' || typeof computed === 'number')
            ? Number(before) === Number(computed)
            : String(before ?? '') === String(computed ?? '');
        if (same) continue;
        if (next == null) next = { ...prev };
        next[rel.computed_field] = computed;
      }
      return next || prev;
    });
  }, [formData, childItemsBySlug, derivedKey]);

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

  // Plan G D4 — operator switch covering the full visibility_when set.
  // Identical truthiness rules to the server-side
  // `_relUtil_evalVisibilityPredicate` helper used by the
  // `conditional_required` invariant; pinned by visibilityPredicateParity
  // unit tests so the form and the API agree on visibility.
  // Hidden fields are skipped during validation (otherwise a hidden-but-
  // required field would block submit forever) and stripped from the
  // submitted payload (so stale values don't survive a status flip).
  const isFieldVisible = (field: FieldDefinition, data: Record<string, any>): boolean => {
    const predicate: any = field.visibilityWhen;
    if (!predicate || typeof predicate !== 'object') return true;
    const sourceField = predicate.field;
    if (!sourceField || typeof sourceField !== 'string') return true;
    const sourceValue = data ? data[sourceField] : undefined;
    const isPredEmpty = (v: any) => v === undefined || v === null || String(v).trim() === '';

    if (Object.prototype.hasOwnProperty.call(predicate, 'equals')) {
      return String(sourceValue ?? '') === String(predicate.equals);
    }
    if (Object.prototype.hasOwnProperty.call(predicate, 'not_equals')) {
      return String(sourceValue ?? '') !== String(predicate.not_equals);
    }
    if (Array.isArray(predicate.in)) {
      const needle = String(sourceValue ?? '');
      return predicate.in.map((v: any) => String(v)).includes(needle);
    }
    if (Array.isArray(predicate.not_in)) {
      const needle = String(sourceValue ?? '');
      return !predicate.not_in.map((v: any) => String(v)).includes(needle);
    }
    if (typeof predicate.is_set === 'boolean') {
      return predicate.is_set ? !isPredEmpty(sourceValue) : isPredEmpty(sourceValue);
    }
    if (typeof predicate.is_unset === 'boolean') {
      return predicate.is_unset ? isPredEmpty(sourceValue) : !isPredEmpty(sourceValue);
    }
    return true;
  };

  const validateField = (field: FieldDefinition, value: any): string | null => {
    // Plan F A4 — ComputedDisplay fields are server-computed; the user
    // cannot type into them. Never block submit on missing values here;
    // the server-side rule runner will populate the column on persist.
    if (field.widget === 'ComputedDisplay') return null;
    if (field.required && isEmpty(field, value)) return I18N.validation.required.replace('{{field}}', field.label);
    if (value === undefined || value === null || String(value).trim() === '') return null;

    const str = String(value);
    if (typeof field.minLength === 'number' && str.length < field.minLength)
      return I18N.validation.minLength.replace('{{field}}', field.label).replace('{{n}}', String(field.minLength));
    if (typeof field.maxLength === 'number' && str.length > field.maxLength)
      return I18N.validation.maxLength.replace('{{field}}', field.label).replace('{{n}}', String(field.maxLength));

    const isNumericType = ['integer', 'decimal', 'number'].includes(field.type);
    if (isNumericType) {
      const num = typeof value === 'number' ? value : Number(value);
      if (Number.isNaN(num)) return I18N.validation.number.replace('{{field}}', field.label);
      if (typeof field.min === 'number' && num < field.min) return I18N.validation.min.replace('{{field}}', field.label).replace('{{n}}', String(field.min));
      if (typeof field.max === 'number' && num > field.max) return I18N.validation.max.replace('{{field}}', field.label).replace('{{n}}', String(field.max));
    }

    if (Array.isArray(field.options) && field.options.length > 0) {
      const allowed = new Set(field.options.map(String));
      if (!allowed.has(str)) {
        const preview = field.options.slice(0, 8).join(', ');
        return I18N.validation.oneOf.replace('{{field}}', field.label).replace('{{values}}', preview);
      }
    }

    if (typeof field.pattern === 'string' && field.pattern.length) {
      try {
        const re = new RegExp(field.pattern);
        if (!re.test(str)) return I18N.validation.invalid.replace('{{field}}', field.label);
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
      // Plan E G3 — skip validation for hidden fields; they are also
      // stripped from the submitted payload so the server never sees a
      // stale value the user couldn't see while filling the form.
      if (!isFieldVisible(field, formData)) continue;
      const err = validateField(field, formData[field.name]);
      if (err) nextErrors[field.name] = err;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    const submitPayload: Record<string, any> = { ...formData };
    for (const field of fields) {
      if (!isFieldVisible(field, formData)) {
        delete submitPayload[field.name];
      }
    }
    onSubmit(submitPayload);
  };

  // Plan F A4 — money-shape detection for ComputedDisplay. Field names
  // ending in `_total`, `_amount`, `_value`, or named `subtotal`/`grand_total`
  // are formatted as currency in the read-only computed row. Currency
  // symbol is locale-driven via toLocaleString; we do NOT hardcode a
  // currency code here because the project's currency is a wizard answer.
  const _isMoneyShape = (name: string): boolean => {
    if (typeof name !== 'string') return false;
    if (name === 'subtotal' || name === 'grand_total') return true;
    return /_(total|amount|value)$/.test(name);
  };

  const _formatComputedDisplay = (field: FieldDefinition, value: any): string => {
    if (value === undefined || value === null || value === '') return '—';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value);
    if (_isMoneyShape(field.name)) {
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (Number.isInteger(num)) return String(num);
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  };

  const renderWidget = (field: FieldDefinition) => {
    const raw = formData[field.name];
    const value = raw ?? '';
    const options = Array.isArray(field.options) ? field.options : [];

    switch (field.widget) {
      case 'ComputedDisplay':
        // Plan F A4 — read-only computed row. The value is whatever the
        // derived-field useEffect last wrote into formData[field.name];
        // we never accept user input here.
        return (
          <div
            data-testid={`computed-display-${field.name}`}
            className="w-full px-3 py-2 border rounded bg-slate-50 text-slate-700"
          >
            {_formatComputedDisplay(field, raw)}
          </div>
        );

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
            {field.required ? null : <option value="">{I18N.selectPlaceholder}</option>}
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
            {field.multiple ? null : <option value="">{I18N.selectPlaceholder}</option>}
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

  const renderField = (field: FieldDefinition) => {
    if (!isFieldVisible(field, formData)) return null;
    return (
      <div key={field.name}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {renderWidget(field)}
        {field.help ? <div className="mt-1 text-xs text-slate-500">{field.help}</div> : null}
        {errors[field.name] ? <div className="mt-1 text-xs text-red-600">{errors[field.name]}</div> : null}
      </div>
    );
  };

  // UI Sections — when `groups` is provided, walk the declared order:
  //   - 'fields' groups render the named fields with an optional heading
  //     (i18n key looked up in I18N if present, else used verbatim).
  //   - 'slot' groups render `slots[name]` (a React node owned by the
  //     parent page — line-items table, invoice totals, rollups, etc.).
  // Any field not referenced by any 'fields' group is auto-appended in a
  // trailing unlabeled group so the form never silently drops fields.
  const fieldByName = useMemo(() => {
    const map = new Map<string, FieldDefinition>();
    for (const f of fields) map.set(f.name, f);
    return map;
  }, [fields]);

  const renderGroupedBody = () => {
    const referenced = new Set<string>();
    if (Array.isArray(groups)) {
      for (const g of groups) {
        if (g && g.kind === 'fields' && Array.isArray(g.fieldNames)) {
          for (const name of g.fieldNames) referenced.add(name);
        }
      }
    }
    const orphanFields = fields.filter((f) => !referenced.has(f.name));
    const slotMap = slots || {};
    const i18nLookup = I18N as unknown as Record<string, any>;
    const resolveHeading = (heading?: string): string | undefined => {
      if (!heading) return undefined;
      if (heading.indexOf('.') < 0) return heading;
      const parts = heading.split('.');
      let cursor: any = i18nLookup;
      for (const p of parts) {
        if (cursor && typeof cursor === 'object' && Object.prototype.hasOwnProperty.call(cursor, p)) {
          cursor = cursor[p];
        } else {
          cursor = undefined;
          break;
        }
      }
      return typeof cursor === 'string' && cursor.length ? cursor : heading;
    };

    const nodes: React.ReactNode[] = [];
    const seq = Array.isArray(groups) ? groups : [];
    seq.forEach((g, gi) => {
      if (!g || typeof g !== 'object') return;
      if (g.kind === 'fields') {
        const inGroup: FieldDefinition[] = [];
        for (const name of (g.fieldNames || [])) {
          const def = fieldByName.get(name);
          if (def) inGroup.push(def);
        }
        if (inGroup.length === 0 && !g.heading) return;
        const headingText = resolveHeading(g.heading);
        nodes.push(
          <div key={`fields-${gi}`} className="space-y-4">
            {headingText ? (
              <div className="text-sm font-semibold text-slate-900">{headingText}</div>
            ) : null}
            {inGroup.map((f) => renderField(f))}
          </div>
        );
      } else if (g.kind === 'slot') {
        const node = slotMap[g.name];
        if (node !== undefined && node !== null && node !== false) {
          nodes.push(<div key={`slot-${gi}-${g.name}`}>{node}</div>);
        }
      }
    });

    if (orphanFields.length > 0) {
      nodes.push(
        <div key="orphan-fields" className="space-y-4">
          {orphanFields.map((f) => renderField(f))}
        </div>
      );
    }

    return nodes;
  };

  const useGrouped = Array.isArray(groups) && groups.length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {useGrouped
        ? renderGroupedBody()
        : fields.map((field) => renderField(field))}
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
          {I18N.cancel}
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {I18N.save}
        </button>
      </div>
    </form>
  );
}


