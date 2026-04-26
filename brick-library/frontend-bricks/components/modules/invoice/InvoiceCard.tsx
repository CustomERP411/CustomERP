import { Link } from 'react-router-dom';

interface InvoiceCardProps {
  invoice: Record<string, any>;
  to: string;
  currency?: string;
}

const displayText = (value: any, fallback = '—') => {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return value.map((v) => displayText(v, '')).filter(Boolean).join(', ') || fallback;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return String(value.name || value.company_name || value.display_name || value.title || value.id || JSON.stringify(value));
  }
  return String(value);
};

const formatMoney = (value: any, currency: string) => {
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

export default function InvoiceCard({ invoice, to, currency = 'USD' }: InvoiceCardProps) {
  const status = String(invoice?.status || 'Draft');
  const customer =
    invoice?.customer?.name ||
    invoice?.customer?.company_name ||
    invoice?.customer_name ||
    invoice?.customer_id ||
    '—';

  return (
    <Link to={to} className="rounded-lg border bg-white p-4 shadow-sm hover:shadow">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          {displayText(invoice?.invoice_number || invoice?.id)}
        </div>
        <span className={['rounded-full px-2 py-1 text-xs font-semibold', statusClass(status)].join(' ')}>
          {status}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div>Customer: {displayText(customer)}</div>
        <div>Issue Date: {displayText(invoice?.issue_date)}</div>
        <div>Due Date: {displayText(invoice?.due_date)}</div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold text-slate-900">
          {formatMoney(invoice?.grand_total ?? invoice?.total ?? 0, currency)}
        </span>
      </div>
    </Link>
  );
}
