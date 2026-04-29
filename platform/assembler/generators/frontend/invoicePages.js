const { tFor } = require('../../i18n/labels');

// Resolve a field's target reference entity to a canonical slug. Mirrors
// validationCodegen._resolveReferenceEntitySlug so the lookup respects
// explicit `reference_entity` overrides AND the implicit `<base>_id` →
// `<base>` / pluralised match the rest of the assembler relies on.
function _resolveReferenceEntitySlug(field, allEntities) {
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
}

function _isReferenceField(field) {
  if (!field) return false;
  if (field.type === 'reference') return true;
  // Heuristic — fields named *_id / *_ids without an explicit type still
  // act like references (validationCodegen + listPage agree on this).
  const name = String(field.name || '');
  return /_ids?$/.test(name) && !!(field.reference_entity || field.referenceEntity);
}

function _displayFieldFor(slug, allEntities) {
  const entity = (allEntities || []).find((e) => e && e.slug === slug);
  return (entity && (entity.display_field || entity.displayField)) || 'name';
}

function buildInvoiceListPage({ entity, entityName, importBase, invoiceConfig, invoicePriorityCfg, enableCsvImport, enableCsvExport, fieldDefs, title, language = 'en', allEntities = [] }) {
  const base = importBase || '..';
  const config = invoiceConfig && typeof invoiceConfig === 'object' ? invoiceConfig : {};
  const currency = String(config.currency || 'USD');

  // Compute reference fields on this entity that the card might want to
  // resolve (customer_id → account_clients, posted_by → __erp_users, …).
  // Each entry tells the generated page which slug to fetch and which
  // denormalised key to populate on the row before handing it to the card.
  const entityFields = Array.isArray(entity && entity.fields) ? entity.fields : [];
  const referenceFields = entityFields
    .map((f) => {
      if (!_isReferenceField(f)) return null;
      const refSlug = _resolveReferenceEntitySlug(f, allEntities);
      if (!refSlug) return null;
      const fieldName = String(f.name || '');
      // `<base>_id` → `<base>_name`; `<base>` (no _id) → `<base>_name`.
      const baseName = fieldName.endsWith('_id')
        ? fieldName.slice(0, -3)
        : fieldName.endsWith('_ids')
        ? fieldName.slice(0, -4)
        : fieldName;
      return {
        fieldName,
        baseName,
        refSlug,
        displayField: _displayFieldFor(refSlug, allEntities),
        multiple: !!(f.multiple || f.is_array || /_ids$/.test(fieldName)),
      };
    })
    .filter(Boolean);

  const referenceMetaJson = JSON.stringify(referenceFields, null, 2);
  const referenceSlugsJson = JSON.stringify(
    Array.from(new Set(referenceFields.map((r) => r.refSlug)))
  );

  // Locale baked into the build so a TR ERP renders dates as 28.04.2026
  // even if the operator's browser locale is en-US (mirrors listPage.js).
  const displayLocale = language === 'tr' ? 'tr-TR' : language === 'en' ? 'en-US' : language;
  const lifecycle =
    invoicePriorityCfg && invoicePriorityCfg.lifecycle && typeof invoicePriorityCfg.lifecycle === 'object'
      ? invoicePriorityCfg.lifecycle
      : {};
  const statusOptions = Array.isArray(lifecycle.statuses) && lifecycle.statuses.length
    ? lifecycle.statuses
    : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
  const pageTitle = title || entityName;
  const fields = Array.isArray(fieldDefs) ? fieldDefs : [];
  const t = tFor(language);
  const I18N = {
    subtitle: t('invoicePages.subtitle'),
    importCsv: t('list.importCsv'),
    exportCsv: t('list.exportCsv'),
    newInvoice: t('invoicePages.newInvoice'),
    filterAll: t('invoicePages.filterAll'),
    loading: t('common.loading'),
    emptyAll: t('invoicePages.emptyAll'),
    emptyFilter: t('invoicePages.emptyFilter'),
    loadFailed: t('invoiceWorkflow.loadFailed'),
    delete: t('list.rowActions.delete'),
    confirmDelete: t('common.confirmDelete'),
    deletedToast: t('list.toast.deleteSuccess'),
    deleteFailedToast: t('list.toast.deleteFailed'),
    deleteBlockedTitle: t('list.deleteBlocked.title'),
    deleteBlockedFallback: t('list.deleteBlocked.body'),
    cantDeleteRefBy: t('list.cannotDelete'),
    customer: t('invoicePages.card.customer'),
    issueDate: t('invoicePages.card.issueDate'),
    dueDate: t('invoicePages.card.dueDate'),
    total: t('invoicePages.card.total'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);

  const csvFieldNames = fields.length
    ? `['id', ${fields.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import InvoiceCard from '${base}/components/modules/invoice/InvoiceCard';

const currency = '${currency}';
const STATUS_OPTIONS = ${JSON.stringify(statusOptions)};
const I18N = ${i18nJson} as const;
${enableCsvExport ? `const CSV_HEADERS = ${csvFieldNames};` : ''}

// Reference fields the card needs to resolve (customer_id → customer_name, …)
// so the InvoiceCard's display chain (\`customer.name → customer_name → customer_id\`)
// hits the resolved name first instead of falling through to the raw UUID.
const REFERENCE_FIELDS: Array<{
  fieldName: string;
  baseName: string;
  refSlug: string;
  displayField: string;
  multiple: boolean;
}> = ${referenceMetaJson};
const REFERENCE_SLUGS: string[] = ${referenceSlugsJson};

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refMaps, setRefMaps] = useState<Record<string, Record<string, string>>>({});
  // \`refsLoading\` masks the brief window between the items fetch landing
  // and the per-reference \`GET /<slug>\` round-trips completing. Without
  // this, the card briefly paints the raw FK id (e.g. customer_id UUID)
  // before flipping to the resolved name — which the user reads as
  // "references appear as ids".
  const [refsLoading, setRefsLoading] = useState(REFERENCE_SLUGS.length > 0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get('/${entity.slug}');
        if (!cancelled) {
          setItems(Array.isArray(res.data) ? res.data : []);
        }
      } catch (e) {
        if (!cancelled) toast({ title: I18N.loadFailed, variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Mirrors entityPages/listPage.js: load every referenced entity in
  // parallel, build id→display maps, expose via state so renders that
  // happen before this resolves can show "…" instead of the raw UUID.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (REFERENCE_SLUGS.length === 0) {
        setRefsLoading(false);
        return;
      }
      try {
        const entries = await Promise.all(
          REFERENCE_SLUGS.map(async (slug) => {
            try {
              const res = await api.get('/' + slug);
              const rows = Array.isArray(res.data) ? res.data : [];
              const map: Record<string, string> = {};
              const displayField =
                REFERENCE_FIELDS.find((r) => r.refSlug === slug)?.displayField || 'name';
              for (const r of rows) {
                if (!r?.id) continue;
                const v = r[displayField] ?? r.name ?? r.code ?? r.id;
                map[String(r.id)] = String(v ?? '');
              }
              return [slug, map] as const;
            } catch (e) {
              console.error('Failed to load reference list:', slug, e);
              return [slug, {} as Record<string, string>] as const;
            }
          })
        );
        if (cancelled) return;
        setRefMaps(Object.fromEntries(entries));
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Denormalise resolved display names onto each row so the InvoiceCard's
  // existing fallback chain (\`row.<base>.name → row.<base>_name → row.<base>_id\`)
  // hits the resolved name first. While refsLoading is true we expose
  // "…" instead of leaking the raw UUID through the chain.
  const enrichedItems = useMemo(() => {
    if (REFERENCE_FIELDS.length === 0) return items;
    return items.map((row) => {
      const enriched: Record<string, any> = { ...row };
      for (const ref of REFERENCE_FIELDS) {
        const raw = row?.[ref.fieldName];
        const map = refMaps[ref.refSlug] || {};
        const resolveOne = (id: any) => {
          const sId = String(id ?? '');
          if (!sId) return '';
          const hit = map[sId];
          if (hit) return hit;
          return refsLoading ? '…' : sId;
        };
        const resolved = ref.multiple
          ? (Array.isArray(raw) ? raw.map(resolveOne).filter(Boolean).join(', ') : '')
          : (raw ? resolveOne(raw) : '');
        enriched[ref.baseName + '_name'] = resolved;
      }
      return enriched;
    });
  }, [items, refMaps, refsLoading]);

  const filteredItems = statusFilter === 'all'
    ? enrichedItems
    : enrichedItems.filter((inv) => String(inv?.status || 'Draft').toLowerCase() === statusFilter.toLowerCase());

  const refreshItems = async () => {
    try {
      setLoading(true);
      const res = await api.get('/${entity.slug}');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast({ title: I18N.loadFailed, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!id) return;
    if (!confirm(I18N.confirmDelete)) return;
    try {
      await api.delete('/${entity.slug}/' + id);
      toast({ title: I18N.deletedToast, variant: 'success' });
      await refreshItems();
    } catch (err: any) {
      const status = err?.response?.status;
      const payload = err?.response?.data;
      if (status === 409) {
        toast({
          title: I18N.deleteBlockedTitle,
          description: payload?.error || I18N.cantDeleteRefBy,
          variant: 'warning',
        });
        return;
      }
      console.error('Delete failed:', err);
      toast({
        title: I18N.deleteFailedToast,
        description: payload?.error || I18N.deleteFailedToast,
        variant: 'error',
      });
    }
  };

${enableCsvExport ? `  const exportCsv = () => {
    const escape = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [CSV_HEADERS.join(','), ...items.map((r) => CSV_HEADERS.map((h) => escape(r[h])).join(','))];
    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.importCsv}</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.exportCsv}</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{I18N.newInvoice}</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
        >
          {I18N.filterAll}
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4">{I18N.loading}</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          {statusFilter === 'all' 
            ? I18N.emptyAll
            : \`\${I18N.emptyFilter} "\${statusFilter}".\`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((invoice) => (
            <InvoiceCard
              key={String(invoice.id)}
              invoice={invoice}
              to={'/${entity.slug}/' + invoice.id + '/edit'}
              currency={currency}
              onDelete={handleDelete}
              deleteLabel={I18N.delete}
              customerLabel={I18N.customer}
              issueDateLabel={I18N.issueDate}
              dueDateLabel={I18N.dueDate}
              totalLabel={I18N.total}
              locale="${displayLocale}"
            />
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

module.exports = { buildInvoiceListPage };
