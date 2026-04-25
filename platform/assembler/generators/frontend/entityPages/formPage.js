const { tFor } = require('../../../i18n/labels');

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
  availabilityLabels,
  companionUserConfig,
  language = 'en',
}) {
  const t = tFor(language);
  const I18N = {
    titleEdit: t('form.titleEdit').replace('{{entity}}', String(entity.display_name || entityName)),
    titleCreate: t('form.titleCreate').replace('{{entity}}', String(entity.display_name || entityName)),
    subtitle: t('form.subtitle'),
    save: t('form.save'),
    saving: t('form.saving'),
    cancel: t('form.cancel'),
    back: t('common.back'),
    print: t('form.print'),
    approve: t('invoiceWorkflow.actions.approve'),
    reject: t('invoiceWorkflow.actions.reject'),
    loading: t('common.loading'),
    delete: t('form.delete'),
    edit: t('list.rowActions.edit'),
    add: t('form.add'),
    actionsColumn: t('list.actionsColumn'),
    lineItemsHeading: t('form.lineItems.heading'),
    lineItemsHelp: t('form.lineItems.help'),
    lineItemsSaveFirst: t('form.lineItems.saveFirst'),
    lineItemsLoading: t('common.loading'),
    lineItemsEmpty: t('form.lineItems.empty'),
    invoiceTotalsHeading: t('form.invoiceTotals.heading'),
    subtotal: t('form.invoiceTotals.subtotal'),
    discount: t('form.invoiceTotals.discount'),
    additionalCharges: t('form.invoiceTotals.additionalCharges'),
    tax: t('form.invoiceTotals.tax'),
    grandTotal: t('form.invoiceTotals.total'),
    lineEngine: t('form.invoiceTotals.lineEngine'),
    taxRateLabel: t('form.invoiceTotals.taxRateLabel'),
    saveSuccessTitle: t('form.toast.saveSuccess'),
    saveSuccessUpdated: t('form.toast.recordUpdated'),
    saveSuccessCreated: t('form.toast.recordCreated'),
    saveFailedTitle: t('form.toast.saveFailed'),
    deleteSuccess: t('form.toast.deleteSuccess'),
    deleteFailedTitle: t('form.toast.deleteFailed'),
    loadFailedTitle: t('form.toast.loadFailed'),
    loadFailedDesc: t('form.toast.loadFailedDesc'),
    lineItemSaved: t('form.lineItems.saved'),
    lineItemAdded: t('form.lineItems.added'),
    lineItemFailed: t('form.lineItems.failed'),
    lineItemLoadFailed: t('form.lineItems.loadFailed'),
    confirmDeleteLine: t('form.lineItems.confirmDelete'),
    cantDeleteTitle: t('list.deleteBlocked.title'),
    deleteLineFailed: t('form.lineItems.deleteFailed'),
    childAddTitlePrefix: t('form.childModal.addPrefix'),
    childEditTitlePrefix: t('form.childModal.editPrefix'),
    statusArrow: '→',
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  const hasChildren = Array.isArray(childSections) && childSections.length > 0;
  const base = importBase || '..';
  const labels = availabilityLabels || {
    title: t('stockAvailability.title'),
    onHand: t('stockAvailability.onHand'),
    reserved: t('stockAvailability.reserved'),
    committed: t('stockAvailability.committed'),
    available: t('stockAvailability.available'),
    reservedTooltip: t('stockAvailability.reservedTooltip'),
    committedTooltip: t('stockAvailability.committedTooltip'),
    infoIconAria: t('stockAvailability.infoIconAria'),
  };
  const lbl = (s) => escapeJsString(String(s == null ? '' : s));
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
const COMPANION_USER_CFG = ${companionUserConfig ? JSON.stringify(companionUserConfig) : 'null'} as const;
const I18N = ${i18nJson} as const;
const interpolate = (s: string, params: Record<string, string | number> = {}) =>
  s.replace(/{{(\\w+)}}/g, (_m, k) => (params[k] !== undefined ? String(params[k]) : ''));
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
  const [createLogin, setCreateLogin] = useState<boolean>(false);
  const [companionUsername, setCompanionUsername] = useState<string>('');
  const [companionEmail, setCompanionEmail] = useState<string>('');
  const [companionPassword, setCompanionPassword] = useState<string>('');
  const [companionIsActive, setCompanionIsActive] = useState<boolean>(true);
  const [companionGroupIds, setCompanionGroupIds] = useState<string[]>([]);
  const [companionGroups, setCompanionGroups] = useState<any[]>([]);
  const [linkedUserInfo, setLinkedUserInfo] = useState<{ id: string; username?: string; email?: string } | null>(null);

  const companionEnabled = !!COMPANION_USER_CFG;
  const hasLinkedUser = companionEnabled && isEdit && !!(initialData && (initialData as any).user_id);

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
        toast({ title: I18N.loadFailedTitle, description: I18N.loadFailedDesc, variant: 'error' });
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
      toast({ title: I18N.lineItemLoadFailed, variant: 'error' });
    } finally {
      setChildLoading(false);
    }
  };

  useEffect(() => {
    fetchChildItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  useEffect(() => {
    if (!companionEnabled) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/__erp_groups');
        if (cancelled) return;
        setCompanionGroups(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setCompanionGroups([]);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [companionEnabled]);

  useEffect(() => {
    if (!companionEnabled) return;
    if (!hasLinkedUser) { setLinkedUserInfo(null); return; }
    const uid = String((initialData as any).user_id || '');
    if (!uid) { setLinkedUserInfo(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/__erp_users/' + uid);
        if (cancelled) return;
        const u = res.data || {};
        setLinkedUserInfo({ id: uid, username: u.username, email: u.email });
      } catch {
        if (!cancelled) setLinkedUserInfo({ id: uid });
      }
    })();
    return () => { cancelled = true; };
  }, [hasLinkedUser, initialData, companionEnabled]);

  const buildCompanionPayload = () => ({
    username: String(companionUsername || '').trim(),
    email: String(companionEmail || '').trim() || undefined,
    password: String(companionPassword || ''),
    is_active: companionIsActive,
    group_ids: Array.from(new Set(companionGroupIds.filter(Boolean))),
  });

  const validateCompanion = () => {
    if (!companionUsername.trim()) {
      toast({ title: 'Username required', variant: 'error' });
      return false;
    }
    if (String(companionPassword).length < 4) {
      toast({ title: 'Password too short', description: 'Password must be at least 4 characters', variant: 'error' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (data: any) => {
    try {
      if (companionEnabled && !isEdit && createLogin) {
        if (!validateCompanion()) return;
        await api.post('/${entity.slug}/with-user', { employee: data, companion_user: buildCompanionPayload() });
        toast({ title: 'Created', description: 'Employee and login created', variant: 'success' });
        navigate('/${entity.slug}');
        return;
      }
      if (isEdit) {
        await api.put('/${entity.slug}/' + id, data);
        toast({ title: I18N.saveSuccessTitle, description: I18N.saveSuccessUpdated, variant: 'success' });
        if (companionEnabled && createLogin && !hasLinkedUser) {
          if (!validateCompanion()) { navigate('/${entity.slug}'); return; }
          try {
            await api.post('/${entity.slug}/' + id + '/link-user', buildCompanionPayload());
            toast({ title: 'Login created', description: 'Linked user account created', variant: 'success' });
          } catch (err: any) {
            toast({ title: 'Link user failed', description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
            return;
          }
        }
      } else {
        await api.post('/${entity.slug}', data);
        toast({ title: I18N.saveSuccessTitle, description: I18N.saveSuccessCreated, variant: 'success' });
      }
      navigate('/${entity.slug}');
    } catch (err: any) {
      toast({ title: I18N.saveFailedTitle, description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
    }
  };

  const toggleCompanionGroup = (gid: string) => {
    setCompanionGroupIds((prev) => prev.includes(gid) ? prev.filter((x) => x !== gid) : [...prev, gid]);
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
        toast({ title: I18N.saveSuccessTitle, description: I18N.lineItemSaved, variant: 'success' });
      } else {
        await api.post('/' + childSlug, payload);
        toast({ title: 'Created', description: 'Line item added', variant: 'success' });
      }
      setChildModalOpen(false);
      setChildModalSection(null);
      await fetchChildItems();
    } catch (err: any) {
      toast({ title: I18N.lineItemFailed, description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  const deleteChild = async (section: any, childId: string) => {
    const childSlug = String(section?.childSlug || '');
    if (!childSlug) return;
    if (!confirm(I18N.confirmDeleteLine)) return;
    try {
      await api.delete('/' + childSlug + '/' + childId);
      toast({ title: I18N.deleteSuccess, variant: 'success' });
      await fetchChildItems();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || I18N.deleteLineFailed;
      if (status === 409) {
        toast({ title: I18N.cantDeleteTitle, description: msg, variant: 'warning' });
      } else {
        toast({ title: I18N.deleteFailedTitle, description: msg, variant: 'error' });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEdit ? I18N.titleEdit : I18N.titleCreate}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {invoiceEnabled && ENABLE_PRINT && isEdit ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 no-print"
            >
              {I18N.print}
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
                {I18N.approve}
              </button>
              <button
                type="button"
                onClick={() => handleApproval('reject')}
                disabled={statusChanging}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 no-print"
              >
                {I18N.reject}
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
            {I18N.back}
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="p-4">{I18N.loading}</div>
      ) : (
        <div className="space-y-4">
          {HAS_RESERVATION ? (
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="text-sm font-semibold text-slate-900 mb-3">${lbl(labels.title)}</div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <div>
                  <div className="text-slate-500">${lbl(labels.onHand)}</div>
                  <div className="font-semibold text-slate-900">{isEdit ? (initialData?.quantity ?? '—') : 0}</div>
                </div>
                <div>
                  <div className="text-slate-500 inline-flex items-center gap-1">
                    <span>${lbl(labels.reserved)}</span>
                    <span
                      aria-label="${lbl(labels.infoIconAria)}"
                      title="${lbl(labels.reservedTooltip)}"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 cursor-help select-none"
                    >
                      i
                    </span>
                  </div>
                  <div className="font-semibold text-amber-700">{isEdit ? (initialData?.reserved_quantity ?? 0) : 0}</div>
                </div>
                <div>
                  <div className="text-slate-500 inline-flex items-center gap-1">
                    <span>${lbl(labels.committed)}</span>
                    <span
                      aria-label="${lbl(labels.infoIconAria)}"
                      title="${lbl(labels.committedTooltip)}"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] text-slate-500 cursor-help select-none"
                    >
                      i
                    </span>
                  </div>
                  <div className="font-semibold text-blue-700">{isEdit ? (initialData?.committed_quantity ?? 0) : 0}</div>
                </div>
                <div>
                  <div className="text-slate-500">${lbl(labels.available)}</div>
                  <div className="font-semibold text-emerald-700">{isEdit ? (initialData?.available_quantity ?? initialData?.quantity ?? 0) : 0}</div>
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

          {companionEnabled && hasLinkedUser ? (
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-semibold text-slate-900 mb-2">{COMPANION_USER_CFG!.labels.linkedUser}</div>
              <div className="text-sm text-slate-700">
                <span className="font-medium">{linkedUserInfo?.username || linkedUserInfo?.id || '—'}</span>
                {linkedUserInfo?.email ? <span className="text-slate-500"> · {linkedUserInfo.email}</span> : null}
              </div>
              <div className="mt-2 text-xs text-slate-500">{COMPANION_USER_CFG!.labels.linkedUserAlready}</div>
              <div className="mt-3">
                <Link to={'/admin/users'} className="text-sm font-semibold text-blue-600 hover:underline">
                  {COMPANION_USER_CFG!.labels.openInUsers}
                </Link>
              </div>
            </div>
          ) : null}

          {companionEnabled && !hasLinkedUser ? (
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="text-sm font-semibold text-slate-900 mb-2">{COMPANION_USER_CFG!.labels.title}</div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createLogin}
                  onChange={(e) => setCreateLogin(e.target.checked)}
                  className="h-4 w-4"
                />
                <span>{COMPANION_USER_CFG!.labels.createLogin}</span>
              </label>
              {createLogin ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <span className="text-slate-600">{COMPANION_USER_CFG!.labels.username}</span>
                    <input
                      type="text"
                      value={companionUsername}
                      onChange={(e) => setCompanionUsername(e.target.value)}
                      autoComplete="off"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-600">Email</span>
                    <input
                      type="email"
                      value={companionEmail}
                      onChange={(e) => setCompanionEmail(e.target.value)}
                      autoComplete="off"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm">
                    <span className="text-slate-600">{COMPANION_USER_CFG!.labels.password}</span>
                    <input
                      type="password"
                      value={companionPassword}
                      onChange={(e) => setCompanionPassword(e.target.value)}
                      autoComplete="new-password"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm self-end">
                    <input
                      type="checkbox"
                      checked={companionIsActive}
                      onChange={(e) => setCompanionIsActive(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span>{COMPANION_USER_CFG!.labels.active}</span>
                  </label>
                  <div className="md:col-span-2 text-sm">
                    <div className="text-slate-600 mb-1">{COMPANION_USER_CFG!.labels.roles}</div>
                    <div className="flex flex-wrap gap-3 rounded-md border border-slate-200 p-3 bg-slate-50">
                      {companionGroups.length === 0 ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : companionGroups.map((g: any) => (
                        <label key={String(g.id)} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={companionGroupIds.includes(String(g.id))}
                            onChange={() => toggleCompanionGroup(String(g.id))}
                            className="h-4 w-4"
                          />
                          <span>{g.name || g.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {CHILD_SECTIONS.length ? (
            <div className="rounded-lg bg-white p-6 shadow space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{I18N.lineItemsHeading}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {I18N.lineItemsHelp}
                  </div>
                </div>
                {!isEdit ? (
                  <div className="text-xs text-slate-500">{I18N.lineItemsSaveFirst}</div>
                ) : childLoading ? (
                  <div className="text-xs text-slate-500">{I18N.lineItemsLoading}</div>
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
                        {I18N.add}
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
                            <th className="px-4 py-2 text-right font-semibold">{I18N.actionsColumn}</th>
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
                                    {I18N.edit}
                                  </button>
                                  <button type="button" onClick={() => deleteChild(section, String(r.id))} className="text-red-600 hover:underline">
                                    {I18N.delete}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={cols.length + 1} className="px-4 py-4 text-center text-slate-500">
                                {I18N.lineItemsEmpty}
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
                <div className="text-sm font-semibold text-slate-900">{I18N.invoiceTotalsHeading}</div>
                <div className="text-xs text-slate-500">
                  {invoiceCalcCfg ? I18N.lineEngine : interpolate(I18N.taxRateLabel, { rate: invoiceTaxRate })}
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{I18N.subtotal}</span>
                  <span className="font-semibold text-slate-900">{formatMoney(invoiceSubtotal)}</span>
                </div>
                {invoiceCalcCfg ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{I18N.discount}</span>
                      <span className="font-semibold text-slate-900">-{formatMoney(invoiceDiscountTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">{I18N.additionalCharges}</span>
                      <span className="font-semibold text-slate-900">{formatMoney(invoiceAdditionalChargeTotal)}</span>
                    </div>
                  </>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">{I18N.tax}</span>
                  <span className="font-semibold text-slate-900">{formatMoney(invoiceTaxTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-slate-700">{I18N.grandTotal}</span>
                  <span className="font-semibold text-slate-900">{formatMoney(invoiceGrandTotal)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {childModalOpen && childModalSection ? (
        <Modal isOpen={childModalOpen} onClose={() => setChildModalOpen(false)} title={(childModalMode === 'edit' ? I18N.childEditTitlePrefix : I18N.childAddTitlePrefix) + ' ' + String(childModalSection.label || 'Item')}>
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
