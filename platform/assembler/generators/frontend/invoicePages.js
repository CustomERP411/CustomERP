function buildInvoiceListPage({ entity, entityName, importBase, invoiceConfig, title }) {
  const base = importBase || '..';
  const config = invoiceConfig && typeof invoiceConfig === 'object' ? invoiceConfig : {};
  const currency = String(config.currency || 'USD');
  const pageTitle = title || entityName;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import InvoiceCard from '${base}/components/modules/invoice/InvoiceCard';

const currency = '${currency}';

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
            <InvoiceCard
              key={String(invoice.id)}
              invoice={invoice}
              to={'/${entity.slug}/' + invoice.id}
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
