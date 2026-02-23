import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { invoiceService } from '../services/invoiceService';
import InvoiceItemsTable from '../components/invoices/InvoiceItemsTable';
import InvoiceItemModal from '../components/invoices/InvoiceItemModal';
import Button from '../components/ui/Button';
import type { Invoice, InvoiceItem, CreateInvoiceItemRequest } from '../types/invoice';

const statusColors = {
  Draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  Paid: 'bg-green-100 text-green-700',
  Overdue: 'bg-red-100 text-red-700',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadInvoiceData();
    }
  }, [id]);

  const loadInvoiceData = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const [invoiceData, itemsData] = await Promise.all([
        invoiceService.getInvoice(id),
        invoiceService.getInvoiceItems(id),
      ]);
      setInvoice(invoiceData);
      setItems(itemsData);
    } catch (err) {
      setError('Failed to load invoice');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (data: CreateInvoiceItemRequest) => {
    const newItem = await invoiceService.createInvoiceItem(data);
    setItems([...items, newItem]);
    await loadInvoiceData(); // Reload to get updated totals
  };

  const handleEditItem = async (data: CreateInvoiceItemRequest) => {
    if (!editingItem) return;
    const updatedItem = await invoiceService.updateInvoiceItem(editingItem.id, data);
    setItems(items.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
    setEditingItem(null);
    await loadInvoiceData(); // Reload to get updated totals
  };

  const handleDeleteItem = async (itemId: string) => {
    await invoiceService.deleteInvoiceItem(itemId);
    setItems(items.filter((item) => item.id !== itemId));
    await loadInvoiceData(); // Reload to get updated totals
  };

  const handleDeleteInvoice = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this invoice?')) return;

    try {
      setDeleting(true);
      await invoiceService.deleteInvoice(id);
      navigate('/invoices');
    } catch (err) {
      setError('Failed to delete invoice');
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  const openEditItemModal = (item: InvoiceItem) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">Invoice not found</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate('/invoices')}
            className="mb-2 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Invoices
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{invoice.invoice_number}</h1>
          <p className="text-slate-500">Invoice Details</p>
        </div>
        <div className="flex gap-3">
          <span className={`rounded-full px-4 py-2 text-sm font-medium ${statusColors[invoice.status]}`}>
            {invoice.status}
          </span>
          <Button variant="danger" onClick={handleDeleteInvoice} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Invoice'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Invoice Information</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500">Customer</p>
            <p className="mt-1 font-medium text-slate-900">
              {invoice.customer?.company_name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Email</p>
            <p className="mt-1 font-medium text-slate-900">
              {invoice.customer?.email || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Issue Date</p>
            <p className="mt-1 font-medium text-slate-900">
              {new Date(invoice.issue_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Due Date</p>
            <p className="mt-1 font-medium text-slate-900">
              {new Date(invoice.due_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <InvoiceItemsTable
        items={items}
        onAddItem={() => setIsItemModalOpen(true)}
        onEditItem={openEditItemModal}
        onDeleteItem={handleDeleteItem}
        editable={invoice.status === 'Draft'}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Subtotal:</span>
            <span className="font-medium text-slate-900">${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Tax:</span>
            <span className="font-medium text-slate-900">${invoice.tax_total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3">
            <span className="text-lg font-semibold text-slate-900">Grand Total:</span>
            <span className="text-2xl font-bold text-slate-900">
              ${invoice.grand_total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <InvoiceItemModal
        isOpen={isItemModalOpen}
        onClose={closeItemModal}
        onSubmit={editingItem ? handleEditItem : handleAddItem}
        invoiceId={id!}
        editItem={editingItem}
      />
    </div>
  );
}
