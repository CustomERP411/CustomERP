import { useEffect, useState } from 'react';
import { invoiceService } from '../services/invoiceService';
import InvoiceCard from '../components/invoices/InvoiceCard';
import NewInvoiceModal from '../components/invoices/NewInvoiceModal';
import Button from '../components/ui/Button';
import type { Invoice } from '../types/invoice';

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await invoiceService.getInvoices();
      setInvoices(data);
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceCreated = (newInvoice: Invoice) => {
    setInvoices([newInvoice, ...invoices]);
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500">Manage your invoices and billing</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>New Invoice</Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
          <div className="rounded-full bg-white p-4 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-slate-100" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No invoices yet</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Create your first invoice to start tracking your billing.
          </p>
          <div className="mt-6">
            <Button onClick={() => setIsModalOpen(true)}>Create Invoice</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {invoices.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice} />
          ))}
        </div>
      )}

      <NewInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onInvoiceCreated={handleInvoiceCreated}
      />
    </div>
  );
}
