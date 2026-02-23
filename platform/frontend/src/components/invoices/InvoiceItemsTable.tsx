import { useState } from 'react';
import type { InvoiceItem } from '../../types/invoice';
import Button from '../ui/Button';

interface InvoiceItemsTableProps {
  items: InvoiceItem[];
  onAddItem?: () => void;
  onEditItem?: (item: InvoiceItem) => void;
  onDeleteItem?: (id: string) => void;
  editable?: boolean;
}

export default function InvoiceItemsTable({
  items,
  onAddItem,
  onEditItem,
  onDeleteItem,
  editable = false,
}: InvoiceItemsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!onDeleteItem) return;
    setDeletingId(id);
    try {
      await onDeleteItem(id);
    } finally {
      setDeletingId(null);
    }
  };

  const total = items.reduce((sum, item) => sum + (item.line_total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Line Items</h3>
        {editable && onAddItem && (
          <Button onClick={onAddItem} variant="secondary" size="sm">
            Add Item
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Description
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Quantity
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Unit Price
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                Line Total
              </th>
              {editable && (
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={editable ? 5 : 4}
                  className="px-6 py-8 text-center text-sm text-slate-500"
                >
                  No line items yet
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-sm text-slate-900">{item.description}</td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-slate-900">
                    ${item.unit_price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                    ${item.line_total.toFixed(2)}
                  </td>
                  {editable && (
                    <td className="px-6 py-4 text-right text-sm">
                      <button
                        onClick={() => onEditItem?.(item)}
                        className="mr-3 text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deletingId === item.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-slate-50">
              <tr>
                <td
                  colSpan={editable ? 4 : 3}
                  className="px-6 py-4 text-right text-sm font-semibold text-slate-900"
                >
                  Subtotal:
                </td>
                <td className="px-6 py-4 text-right text-sm font-bold text-slate-900">
                  ${total.toFixed(2)}
                </td>
                {editable && <td></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
