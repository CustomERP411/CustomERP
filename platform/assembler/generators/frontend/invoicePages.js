function buildInvoiceListPage({ entity, entityName, importBase, invoiceConfig, title }) {
  const base = importBase || '..';
  const config = invoiceConfig && typeof invoiceConfig === 'object' ? invoiceConfig : {};
  const currency = String(config.currency || 'USD');
  const pageTitle = title || entityName;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const currency = '${currency}';
const formatMoney = (value: any) => {
  const num = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(isNaN(num) ? 0 : num);
  } catch {
    return String(isNaN(num) ? 0 : num);
  }
};

const statusClass = (status: string) => {
  switch (status) {
    case 'Paid':
      return 'bg-emerald-100 text-emerald-700';
    case 'Sent':
      return 'bg-blue-100 text-blue-700';
    case 'Overdue':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        if (!cancelled) toast({ title: 'Failed to load invoices', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Track invoices and billing totals.</p>
        </div>
        <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          New Invoice
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          No invoices yet. Create your first invoice to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((invoice) => (
            <Link
              key={String(invoice.id)}
              to={'/${entity.slug}/' + invoice.id}
              className="rounded-lg border bg-white p-4 shadow-sm hover:shadow"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  {invoice.invoice_number || invoice.id}
                </div>
                <span className={['rounded-full px-2 py-1 text-xs font-semibold', statusClass(String(invoice.status || 'Draft'))].join(' ')}>
                  {invoice.status || 'Draft'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>Customer: {invoice.customer_id || '—'}</div>
                <div>Issue Date: {invoice.issue_date || '—'}</div>
                <div>Due Date: {invoice.due_date || '—'}</div>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-slate-900">{formatMoney(invoice.grand_total ?? invoice.total ?? 0)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

module.exports = { buildInvoiceListPage };
