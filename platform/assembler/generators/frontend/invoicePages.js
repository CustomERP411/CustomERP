const { tFor } = require('../../i18n/labels');

function buildInvoiceListPage({ entity, entityName, importBase, invoiceConfig, invoicePriorityCfg, enableCsvImport, enableCsvExport, fieldDefs, title, language = 'en' }) {
  const base = importBase || '..';
  const config = invoiceConfig && typeof invoiceConfig === 'object' ? invoiceConfig : {};
  const currency = String(config.currency || 'USD');
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
  };
  const i18nJson = JSON.stringify(I18N, null, 2);

  const csvFieldNames = fields.length
    ? `['id', ${fields.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import InvoiceCard from '${base}/components/modules/invoice/InvoiceCard';

const currency = '${currency}';
const STATUS_OPTIONS = ${JSON.stringify(statusOptions)};
const I18N = ${i18nJson} as const;
${enableCsvExport ? `const CSV_HEADERS = ${csvFieldNames};` : ''}

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const filteredItems = statusFilter === 'all' 
    ? items 
    : items.filter((inv) => String(inv?.status || 'Draft').toLowerCase() === statusFilter.toLowerCase());

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
