import { useState, useEffect } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import type { InvoiceItem, CreateInvoiceItemRequest } from '../../types/invoice';

interface InvoiceItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateInvoiceItemRequest) => Promise<void>;
  invoiceId: string;
  editItem?: InvoiceItem | null;
}

export default function InvoiceItemModal({
  isOpen,
  onClose,
  onSubmit,
  invoiceId,
  editItem,
}: InvoiceItemModalProps) {
  const [formData, setFormData] = useState<CreateInvoiceItemRequest>({
    invoice_id: invoiceId,
    description: '',
    quantity: 1,
    unit_price: 0,
    line_total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setFormData({
          invoice_id: editItem.invoice_id,
          description: editItem.description,
          quantity: editItem.quantity,
          unit_price: editItem.unit_price,
          line_total: editItem.line_total,
        });
      } else {
        setFormData({
          invoice_id: invoiceId,
          description: '',
          quantity: 1,
          unit_price: 0,
          line_total: 0,
        });
      }
      setError('');
    }
  }, [isOpen, editItem, invoiceId]);

  const calculateLineTotal = (quantity: number, unitPrice: number) => {
    return Number((quantity * unitPrice).toFixed(2));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const updatedFormData = { ...formData, [name]: name === 'description' ? value : Number(value) };

    if (name === 'quantity' || name === 'unit_price') {
      updatedFormData.line_total = calculateLineTotal(
        updatedFormData.quantity,
        updatedFormData.unit_price
      );
    }

    setFormData(updatedFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description.trim()) return;

    try {
      setLoading(true);
      setError('');
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm !m-0">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {editItem ? 'Edit Line Item' : 'Add Line Item'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <span aria-hidden="true" className="text-2xl leading-none">
              ×
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter item description"
              required
              autoFocus
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity"
              name="quantity"
              type="number"
              min="0"
              step="0.01"
              value={formData.quantity}
              onChange={handleChange}
              required
            />

            <Input
              label="Unit Price"
              name="unit_price"
              type="number"
              min="0"
              step="0.01"
              value={formData.unit_price}
              onChange={handleChange}
              required
            />
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Line Total:</span>
              <span className="text-lg font-bold text-slate-900">
                ${formData.line_total.toFixed(2)}
              </span>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.description.trim()}>
              {loading && (
                <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
              )}
              {editItem ? 'Update Item' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
