import { Link } from 'react-router-dom';
import type { Invoice } from '../../types/invoice';

interface InvoiceCardProps {
  invoice: Invoice;
}

const statusColors = {
  Draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
};

export default function InvoiceCard({ invoice }: InvoiceCardProps) {
  const formattedIssueDate = new Date(invoice.issue_date).toLocaleDateString();
  const formattedDueDate = new Date(invoice.due_date).toLocaleDateString();

  return (
    <Link
      to={`/invoices/${invoice.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{invoice.invoice_number}</h3>
          {invoice.customer && (
            <p className="mt-1 text-sm text-slate-500">{invoice.customer.company_name}</p>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            statusColors[invoice.status]
          }`}
        >
          {invoice.status}
        </span>
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Issue Date:</span>
          <span className="font-medium text-slate-900">{formattedIssueDate}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Due Date:</span>
          <span className="font-medium text-slate-900">{formattedDueDate}</span>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <span className="text-sm font-medium text-slate-700">Grand Total:</span>
          <span className="text-lg font-bold text-slate-900">
            ${invoice.grand_total.toFixed(2)}
          </span>
        </div>
      </div>
    </Link>
  );
}
