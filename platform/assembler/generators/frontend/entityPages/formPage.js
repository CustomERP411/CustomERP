function buildEntityFormPage({
  entity,
  entityName,
  fieldDefs,
  childSections,
  escapeJsString,
  importBase,
  invoiceConfig,
  enablePrintInvoice,
  statusTransitions,
  hasReservationFields,
  approvalConfig,
}) {
  const hasChildren = Array.isArray(childSections) && childSections.length > 0;
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '${base}/services/api';
import DynamicForm from '${base}/components/DynamicForm';
import Modal from '${base}/components/ui/Modal';
import { useToast } from '${base}/components/ui/toast';
import { ENTITIES } from '${base}/config/entities';

const fieldDefinitions = [
${fieldDefs}
];

const CHILD_SECTIONS = ${JSON.stringify(childSections || [], null, 2)} as const;
const INVOICE_CFG = ${invoiceConfig ? JSON.stringify(invoiceConfig) : 'null'} as const;
const ENABLE_PRINT = ${enablePrintInvoice ? 'true' : 'false'} as const;
const STATUS_TRANSITIONS = ${statusTransitions ? JSON.stringify(statusTransitions) : 'null'} as const;
const HAS_RESERVATION = ${hasReservationFields ? 'true' : 'false'} as const;
const APPROVAL_CFG = ${approvalConfig ? JSON.stringify(approvalConfig) : 'null'} as const;
const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.displayField])) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}FormPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id;
  const isEdit = !!id;
  const [loading, setLoading] = useState<boolean>(isEdit);
  const [initialData, setInitialData] = useState<Record<string, any>>({});
  const [childItemsBySlug, setChildItemsBySlug] = useState<Record<string, any[]>>({});
  const [childLoading, setChildLoading] = useState(false);
  const [childRefMaps, setChildRefMaps] = useState<Record<string, Record<string, string>>>({});
  const [childModalOpen, setChildModalOpen] = useState(false);
  const [childModalSection, setChildModalSection] = useState<any | null>(null);
  const [childModalMode, setChildModalMode] = useState<'create' | 'edit'>('create');
  const [childModalInitial, setChildModalInitial] = useState<any>({});
  const [statusChanging, setStatusChanging] = useState(false);

  const invoiceEnabled = !!INVOICE_CFG;
  const invoiceCalcCfg = invoiceEnabled && INVOICE_CFG.calculation_engine && INVOICE_CFG.calculation_engine.enabled !== false
    ? INVOICE_CFG.calculation_engine
    : null;
  const invoiceItemsEntitySlug = invoiceEnabled
    ? String(invoiceCalcCfg?.invoice_item_entity || 'invoice_items')
    : 'invoice_items';
  const invoiceItems = invoiceEnabled ? (childItemsBySlug[invoiceItemsEntitySlug] || []) : [];
  const lineSubtotalField = String(invoiceCalcCfg?.item_line_subtotal_field || 'line_subtotal');
  const lineDiscountTotalField = String(invoiceCalcCfg?.item_discount_total_field || 'line_discount_total');
  const lineTaxTotalField = String(invoiceCalcCfg?.item_tax_total_field || 'line_tax_total');
  const lineAdditionalChargeField = String(invoiceCalcCfg?.item_additional_charge_field || 'line_additional_charge');
  const lineTotalField = String(invoiceCalcCfg?.item_line_total_field || 'line_total');
  const lineQtyField = String(invoiceCalcCfg?.item_quantity_field || 'quantity');
  const linePriceField = String(invoiceCalcCfg?.item_unit_price_field || 'unit_price');
  const invoiceSubtotal = invoiceEnabled
    ? Number(
        invoiceItems
          .reduce((sum: number, item: any) => {
            const fallback = Number(item?.[lineQtyField] ?? 0) * Number(item?.[linePriceField] ?? 0);
            const line = Number(item?.[lineSubtotalField] ?? fallback ?? 0);
            return sum + (isNaN(line) ? 0 : line);
          }, 0)
          .toFixed(2)
      )
    : 0;
  const invoiceDiscountTotal = invoiceEnabled
    ? Number(
        invoiceItems
          .reduce((sum: number, item: any) => {
            const line = Number(item?.[lineDiscountTotalField] ?? 0);
            return sum + (isNaN(line) ? 0 : line);
          }, 0)
          .toFixed(2)
      )
    : 0;
  const invoiceAdditionalChargeTotal = invoiceEnabled
    ? Number(
        invoiceItems
          .reduce((sum: number, item: any) => {
            const line = Number(item?.[lineAdditionalChargeField] ?? 0);
            return sum + (isNaN(line) ? 0 : line);
          }, 0)
          .toFixed(2)
      )
    : 0;
  const invoiceTaxRate = invoiceEnabled && !invoiceCalcCfg ? Number(INVOICE_CFG.tax_rate ?? 0) || 0 : 0;
  const invoiceTaxTotal = invoiceEnabled
    ? (
        invoiceCalcCfg
          ? Number(
              invoiceItems
                .reduce((sum: number, item: any) => {
                  const line = Number(item?.[lineTaxTotalField] ?? 0);
                  return sum + (isNaN(line) ? 0 : line);
                }, 0)
                .toFixed(2)
            )
          : Number(((invoiceSubtotal * invoiceTaxRate) / 100).toFixed(2))
      )
    : 0;
  const invoiceGrandTotal = invoiceEnabled
    ? (
        invoiceCalcCfg
          ? Number(
              invoiceItems
                .reduce((sum: number, item: any) => {
                  const fallback = Number(item?.[lineQtyField] ?? 0) * Number(item?.[linePriceField] ?? 0);
                  const line = Number(item?.[lineTotalField] ?? fallback ?? 0);
                  return sum + (isNaN(line) ? 0 : line);
                }, 0)
                .toFixed(2)
            )
          : Number((invoiceSubtotal + invoiceTaxTotal).toFixed(2))
      )
    : 0;
  const formatMoney = (value: any) => {
    if (!invoiceEnabled) return String(value ?? '');
    const currency = String(INVOICE_CFG.currency || 'USD');
    const num = Number(value ?? 0);
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(isNaN(num) ? 0 : num);
    } catch {
      return String(isNaN(num) ? 0 : num);
    }
  };

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/${entity.slug}/' + id);
        if (cancelled) return;
        setInitialData(res.data || {});
      } catch (e) {
        toast({ title: 'Failed to load', description: 'Could not load record', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [id, isEdit]);

  const loadChildRefs = async (sections: any[]) => {
    const refSlugs = new Set<string>();
    for (const s of sections) {
      const cols = Array.isArray(s?.columns) ? s.columns : [];
      for (const c of cols) {
        if (typeof c?.referenceEntity === 'string' && c.referenceEntity.trim()) refSlugs.add(c.referenceEntity.trim());
      }
    }
    if (refSlugs.size === 0) return;
    try {
      const entries = await Promise.all(
        Array.from(refSlugs).map(async (slug) => {
          try {
            const res = await api.get('/' + slug);
            const rows = Array.isArray(res.data) ? res.data : [];
            const map: Record<string, string> = {};
            for (const r of rows) {
              if (!r?.id) continue;
              map[String(r.id)] = getEntityDisplay(slug, r);
            }
            return [slug, map] as const;
          } catch {
            return [slug, {} as Record<string, string>] as const;
          }
        })
      );
      setChildRefMaps(Object.fromEntries(entries));
    } catch {
      // ignore
    }
  };

  const fetchChildItems = async () => {
    if (!isEdit) return;
    if (!CHILD_SECTIONS.length) return;
    setChildLoading(true);
    try {
      const results = await Promise.all(
        CHILD_SECTIONS.map(async (s: any) => {
          const slug = String(s.childSlug || '');
          const fk = String(s.foreignKey || '');
          if (!slug || !fk) return [slug, []] as const;
          const res = await api.get('/' + slug, { params: { [fk]: id } });
          return [slug, Array.isArray(res.data) ? res.data : []] as const;
        })
      );
      setChildItemsBySlug(Object.fromEntries(results));
      await loadChildRefs(CHILD_SECTIONS as any);
    } catch (e) {
      toast({ title: 'Failed to load line items', variant: 'error' });
    } finally {
      setChildLoading(false);
    }
  };

  useEffect(() => {
    fetchChildItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const handleSubmit = async (data: any) => {
    try {
      if (isEdit) {
        await api.put('/${entity.slug}/' + id, data);
        toast({ title: 'Saved', description: 'Record updated', variant: 'success' });
      } else {
        await api.post('/${entity.slug}', data);
        toast({ title: 'Created', description: 'Record created', variant: 'success' });
      }
      navigate('/${entity.slug}');
    } catch (err: any) {
      toast({ title: 'Operation failed', description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!isEdit || !id) return;
    if (!confirm(\`Change status to \${newStatus}?\`)) return;
    setStatusChanging(true);
    try {
      await api.put('/${entity.slug}/' + id, { status: newStatus });
      toast({ title: 'Status updated', description: \`Status changed to \${newStatus}\`, variant: 'success' });
      const res = await api.get('/${entity.slug}/' + id);
      setInitialData(res.data || {});
    } catch (err: any) {
      toast({ title: 'Status update failed', description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
    } finally {
      setStatusChanging(false);
    }
  };

  const handleApproval = async (action: 'approve' | 'reject') => {
    if (!isEdit || !id || !APPROVAL_CFG) return;
    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
    if (!confirm(\`\${action === 'approve' ? 'Approve' : 'Reject'} this request?\`)) return;
    setStatusChanging(true);
    try {
      await api.put('/${entity.slug}/' + id, { status: newStatus });
      toast({ title: \`Request \${action === 'approve' ? 'approved' : 'rejected'}\`, variant: 'success' });
      const res = await api.get('/${entity.slug}/' + id);
      setInitialData(res.data || {});
    } catch (err: any) {
      toast({ title: 'Operation failed', description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
    } finally {
      setStatusChanging(false);
    }
  };

  const getChildCellDisplay = (section: any, item: any, col: any) => {
    const key = String(col?.key || '');
    const raw = item?.[key];
    const refEntity = col?.referenceEntity;
    if (refEntity) {
      const map = childRefMaps[String(refEntity)] || {};
      if (col?.multiple) {
        const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
        return arr.map((v: any) => map[String(v)] || String(v)).join(', ');
      }
      return map[String(raw)] || String(raw ?? '');
    }
    if (Array.isArray(raw)) return raw.join('; ');
    return String(raw ?? '');
  };

  const openChildCreate = (section: any) => {
    setChildModalSection(section);
    setChildModalMode('create');
    setChildModalInitial({});
    setChildModalOpen(true);
  };

  const openChildEdit = (section: any, item: any) => {
    setChildModalSection(section);
    setChildModalMode('edit');
    setChildModalInitial(item || {});
    setChildModalOpen(true);
  };

  const submitChild = async (data: any) => {
    const section = childModalSection;
    if (!section) return;
    const childSlug = String(section.childSlug || '');
    const fk = String(section.foreignKey || '');
    if (!childSlug || !fk) return;
    try {
      const payload: any = { ...data };
      // Always enforce FK to the parent
      payload[fk] = id;

      if (childModalMode === 'edit') {
        const childId = childModalInitial?.id;
        await api.put('/' + childSlug + '/' + childId, payload);
        toast({ title: 'Saved', description: 'Line item updated', variant: 'success' });
      } else {
        await api.post('/' + childSlug, payload);
        toast({ title: 'Created', description: 'Line item added', variant: 'success' });
      }
      setChildModalOpen(false);
      setChildModalSection(null);
      await fetchChildItems();
    } catch (err: any) {
      toast({ title: 'Operation failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  const deleteChild = async (section: any, childId: string) => {
    const childSlug = String(section?.childSlug || '');
    if (!childSlug) return;
    if (!confirm('Delete this line item?')) return;
    try {
      await api.delete('/' + childSlug + '/' + childId);
      toast({ title: 'Deleted', variant: 'success' });
      await fetchChildItems();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || 'Delete failed';
      if (status === 409) {
        toast({ title: 'Cannot delete', description: msg, variant: 'warning' });
      } else {
        toast({ title: 'Delete failed', description: msg, variant: 'error' });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEdit ? 'Edit' : 'Create'} ${escapeJsString(entity.display_name || entityName)}</h1>
          <p className="text-sm text-slate-600">Fill in the fields and save.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invoiceEnabled && ENABLE_PRINT && isEdit ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 no-print"
            >
              Print
            </button>
          ) : null}
          {APPROVAL_CFG && isEdit && initialData?.status === 'Pending' ? (
            <>
              <button
                type="button"
                onClick={() => handleApproval('approve')}
                disabled={statusChanging}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 no-print"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleApproval('reject')}
                disabled={statusChanging}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 no-print"
              >
                Reject
              </button>
            </>
          ) : null}
          {STATUS_TRANSITIONS && isEdit && initialData?.status ? (
            (STATUS_TRANSITIONS as any)[initialData.status]?.map((nextStatus: string) => (
              <button
                key={nextStatus}
                type="button"
                onClick={() => handleStatusChange(nextStatus)}
                disabled={statusChanging}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 no-print"
              >
                → {nextStatus}
              </button>
            ))
          ) : null}
          <Link to="/${entity.slug}" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
            Back
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="p-4">Loading...</div>
      ) : (
        <div className="space-y-4">
          {HAS_RESERVATION && isEdit && initialData ? (
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm font-semibold text-slate-900 mb-3">Stock Availability</div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <div>
                  <div className="text-slate-500">On Hand</div>
                  <div className="font-semibold text-slate-900">{initialData.quantity ?? '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Reserved</div>
                  <div className="font-semibold text-amber-700">{initialData.reserved_quantity ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">Committed</div>
                  <div className="font-semibold text-blue-700">{initialData.committed_quantity ?? 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">Available</div>
                  <div className="font-semibold text-emerald-700">{initialData.available_quantity ?? initialData.quantity ?? 0}</div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="rounded-lg bg-white p-6 shadow">
            <DynamicForm
              fields={fieldDefinitions as any}
              initialData={initialData}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/${entity.slug}')}
            />
          </div>

          {CHILD_SECTIONS.length ? (
            <div className="rounded-lg bg-white p-6 shadow space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Line items</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Add and manage child rows linked to this record.
                  </div>
                </div>
                {!isEdit ? (
                  <div className="text-xs text-slate-500">Save this record first to add line items.</div>
                ) : childLoading ? (
                  <div className="text-xs text-slate-500">Loading…</div>
                ) : null}
              </div>

              {CHILD_SECTIONS.map((section: any) => {
                const childSlug = String(section.childSlug || '');
                const rows = childItemsBySlug[childSlug] || [];
                const cols = Array.isArray(section.columns) ? section.columns : [];
                return (
                  <div key={childSlug} className="rounded-lg border bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{section.label}</div>
                      <button
                        type="button"
                        onClick={() => openChildCreate(section)}
                        disabled={!isEdit}
                        className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border bg-white">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            {cols.map((c: any) => (
                              <th key={String(c.key)} className="px-4 py-2 text-left font-semibold">
                                {c.label}
                              </th>
                            ))}
                            <th className="px-4 py-2 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {rows.map((r: any) => (
                            <tr key={String(r.id)}>
                              {cols.map((c: any) => (
                                <td key={String(c.key)} className="px-4 py-2">
                                  {getChildCellDisplay(section, r, c)}
                                </td>
                              ))}
                              <td className="px-4 py-2 text-right whitespace-nowrap">
                                <div className="flex justify-end gap-3">
                                  <button type="button" onClick={() => openChildEdit(section, r)} className="text-blue-600 hover:underline">
                                    Edit
                                  </button>
                                  <button type="button" onClick={() => deleteChild(section, String(r.id))} className="text-red-600 hover:underline">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={cols.length + 1} className="px-4 py-4 text-center text-slate-500">
                                No line items yet
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {invoiceEnabled ? (
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Invoice totals</div>
                <div className="text-xs text-slate-500">
                  {invoiceCalcCfg ? 'Line-level calculation engine' : \`Tax rate: \${invoiceTaxRate}%\`}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="font-semibold text-slate-900">{formatMoney(invoiceSubtotal)}</span>
                </div>
                {invoiceCalcCfg ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Discount</span>
                      <span className="font-semibold text-slate-900">-{formatMoney(invoiceDiscountTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Additional charges</span>
                      <span className="font-semibold text-slate-900">{formatMoney(invoiceAdditionalChargeTotal)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span className="font-semibold text-slate-900">{formatMoney(invoiceTaxTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-slate-700">Grand total</span>
                  <span className="font-semibold text-slate-900">{formatMoney(invoiceGrandTotal)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {childModalOpen && childModalSection ? (
        <Modal isOpen={childModalOpen} onClose={() => setChildModalOpen(false)} title={(childModalMode === 'edit' ? 'Edit' : 'Add') + ' ' + String(childModalSection.label || 'Item')}>
          <DynamicForm
            fields={(childModalSection.formFields || []) as any}
            initialData={childModalMode === 'edit' ? childModalInitial : {}}
            onSubmit={submitChild}
            onCancel={() => setChildModalOpen(false)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
`;
}


module.exports = { buildEntityFormPage };
