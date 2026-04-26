const { tFor } = require('../../i18n/labels');

function buildInvoiceWorkflowPage({ entity, entityName, importBase, lifecycleCfg, language = 'en' }) {
  const base = importBase || '..';
  const statuses = Array.isArray(lifecycleCfg && lifecycleCfg.statuses) && lifecycleCfg.statuses.length
    ? lifecycleCfg.statuses
    : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const I18N = {
    title: t('invoiceWorkflow.title').replace('{{entity}}', displayName),
    subtitle: t('invoiceWorkflow.subtitle'),
    selectInvoice: t('invoiceWorkflow.selectInvoice'),
    noInvoices: t('invoiceWorkflow.noInvoices'),
    statusFlow: t('invoiceWorkflow.statusFlow'),
    issue: t('invoiceWorkflow.issue'),
    cancel: t('invoiceWorkflow.cancel'),
    selectedHeading: t('invoiceWorkflow.selectedHeading'),
    selectInvoiceHint: t('invoiceWorkflow.selectInvoiceHint'),
    loading: t('common.loading'),
    loadFailed: t('invoiceWorkflow.loadFailed'),
    actionFailed: t('invoiceWorkflow.actionFailed'),
    issued: t('invoiceWorkflow.issued'),
    cancelled: t('invoiceWorkflow.cancelled'),
    confirmIssue: t('invoiceWorkflow.confirmIssue'),
    confirmCancel: t('invoiceWorkflow.confirmCancel'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}';
const STATUS_FLOW = ${JSON.stringify(statuses)};
const I18N = ${i18nJson} as const;

export default function ${entityName}WorkflowPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const selectedInvoice = useMemo(
    () => items.find((x) => String(x.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/' + ENTITY_SLUG);
      const rows = Array.isArray(res.data) ? res.data : [];
      setItems(rows);
      if (!selectedId && rows.length) setSelectedId(String(rows[0].id));
    } catch (error: any) {
      toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (action: 'issue' | 'cancel') => {
    if (!selectedId) return;
    if (!confirm(action === 'issue' ? I18N.confirmIssue : I18N.confirmCancel)) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      toast({ title: action === 'issue' ? I18N.issued : I18N.cancelled, variant: 'success' });
      await fetchData();
    } catch (error: any) {
      toast({ title: I18N.actionFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">{I18N.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{I18N.subtitle}</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{I18N.selectInvoice}</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!items.length && <option value="">{I18N.noInvoices}</option>}
          {items.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.invoice_number || row.id)} - {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 text-sm text-slate-700">
          {I18N.statusFlow}: {STATUS_FLOW.join(' -> ')}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => runAction('issue')}
            disabled={!selectedId || working}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {I18N.issue}
          </button>
          <button
            type="button"
            onClick={() => runAction('cancel')}
            disabled={!selectedId || working}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {I18N.cancel}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">{I18N.selectedHeading}</h2>
        {loading ? (
          <div className="text-sm text-slate-500">{I18N.loading}</div>
        ) : !selectedInvoice ? (
          <div className="text-sm text-slate-500">{I18N.selectInvoiceHint}</div>
        ) : (
          <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedInvoice, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
`;
}

function buildInvoicePaymentsPage({ entity, entityName, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const I18N = {
    title: t('invoicePayments.title').replace('{{entity}}', displayName),
    subtitle: t('invoicePayments.subtitle'),
    invoice: t('invoicePayments.invoice'),
    noInvoices: t('invoicePayments.noInvoices'),
    outstanding: t('invoicePayments.outstanding'),
    recordHeading: t('invoicePayments.recordHeading'),
    amount: t('invoicePayments.amount'),
    paymentMethod: t('invoicePayments.paymentMethod'),
    paymentDate: t('invoicePayments.paymentDate'),
    noteOptional: t('invoicePayments.noteOptional'),
    record: t('invoicePayments.record'),
    paymentsHeading: t('invoicePayments.paymentsHeading'),
    selectInvoice: t('invoicePayments.selectInvoice'),
    noPayments: t('invoicePayments.noPayments'),
    loading: t('common.loading'),
    amountMustBePositive: t('invoicePayments.amountMustBePositive'),
    paymentRecorded: t('invoicePayments.paymentRecorded'),
    loadFailed: t('invoicePayments.loadFailed'),
    loadInvoicesFailed: t('invoiceWorkflow.loadFailed'),
    recordFailed: t('invoicePayments.recordFailed'),
    status: t('invoicePayments.status'),
    unallocated: t('invoicePayments.unallocated'),
    allocated: t('invoicePayments.allocated'),
    paymentLabel: t('invoicePayments.paymentLabel'),
    unknown: t('invoicePayments.unknown'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const INVOICE_SLUG = '${entity.slug}';
const I18N = ${i18nJson} as const;

export default function ${entityName}PaymentsPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    payment_method: '',
    payment_date: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const selectedInvoice = useMemo(
    () => invoices.find((x) => String(x.id) === String(selectedInvoiceId)) || null,
    [invoices, selectedInvoiceId]
  );

  const fetchInvoices = async () => {
    try {
      const res = await api.get('/' + INVOICE_SLUG);
      const rows = Array.isArray(res.data) ? res.data : [];
      setInvoices(rows);
      if (!selectedInvoiceId && rows.length) setSelectedInvoiceId(String(rows[0].id));
    } catch (error: any) {
      toast({ title: I18N.loadInvoicesFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  const fetchPayments = async (invoiceId: string) => {
    if (!invoiceId) {
      setItems([]);
      return;
    }
    try {
      const res = await api.get('/' + INVOICE_SLUG + '/' + invoiceId + '/payments');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchInvoices();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    fetchPayments(selectedInvoiceId);
  }, [selectedInvoiceId]);

  const createPayment = async () => {
    if (!selectedInvoiceId) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: I18N.amountMustBePositive, variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/' + INVOICE_SLUG + '/' + selectedInvoiceId + '/payments', {
        amount,
        payment_method: form.payment_method || undefined,
        payment_date: form.payment_date || undefined,
        note: form.note || undefined,
      });
      toast({ title: I18N.paymentRecorded, variant: 'success' });
      setForm((prev) => ({ ...prev, amount: '', payment_method: '', note: '' }));
      await fetchInvoices();
      await fetchPayments(selectedInvoiceId);
    } catch (error: any) {
      toast({ title: I18N.recordFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">{I18N.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{I18N.subtitle}</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{I18N.invoice}</label>
        <select
          value={selectedInvoiceId}
          onChange={(e) => setSelectedInvoiceId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!invoices.length && <option value="">{I18N.noInvoices}</option>}
          {invoices.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.invoice_number || row.id)} | {I18N.outstanding}: {String(row.outstanding_balance ?? row.grand_total ?? 0)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{I18N.recordHeading}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder={I18N.amount}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.payment_method}
            onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}
            placeholder={I18N.paymentMethod}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.payment_date}
            onChange={(e) => setForm((prev) => ({ ...prev, payment_date: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createPayment}
            disabled={!selectedInvoiceId || saving}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {I18N.record}
          </button>
        </div>
        <textarea
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          placeholder={I18N.noteOptional}
          className="mt-3 min-h-[84px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{I18N.paymentsHeading}</h2>
        {loading ? (
          <div className="text-sm text-slate-500">{I18N.loading}</div>
        ) : !selectedInvoice ? (
          <div className="text-sm text-slate-500">{I18N.selectInvoice}</div>
        ) : !items.length ? (
          <div className="text-sm text-slate-500">{I18N.noPayments}</div>
        ) : (
          <div className="space-y-2">
            {items.map((row: any, idx: number) => {
              const payment = row?.payment || row;
              const allocation = row?.allocation || null;
              return (
                <div key={String(payment?.id || idx)} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="font-medium text-slate-900">{String(payment?.payment_number || payment?.id || I18N.paymentLabel)}</div>
                  <div className="mt-1 text-slate-600">{I18N.status}: {String(payment?.status || I18N.unknown)}</div>
                  <div className="text-slate-600">{I18N.amount}: {String(payment?.amount ?? 0)} | {I18N.unallocated}: {String(payment?.unallocated_amount ?? 0)}</div>
                  {allocation ? (
                    <div className="text-slate-600">{I18N.allocated}: {String(allocation?.amount ?? 0)} at {String(allocation?.allocated_at || '')}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

function buildInvoiceNotesPage({ entity, entityName, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const I18N = {
    title: t('invoiceNotes.title').replace('{{entity}}', displayName),
    subtitle: t('invoiceNotes.subtitle'),
    invoice: t('invoiceNotes.invoice'),
    noInvoices: t('invoicePayments.noInvoices'),
    createHeading: t('invoiceNotes.createHeading'),
    credit: t('invoiceNotes.credit'),
    debit: t('invoiceNotes.debit'),
    amount: t('invoiceNotes.amount'),
    taxTotal: t('invoiceNotes.taxTotal'),
    issueDate: t('invoiceNotes.issueDate'),
    reason: t('invoiceNotes.reason'),
    note: t('invoiceNotes.note'),
    create: t('invoiceNotes.create'),
    noteOptional: t('invoicePayments.noteOptional'),
    loadFailed: t('invoiceNotes.loadFailed'),
    loadInvoicesFailed: t('invoiceWorkflow.loadFailed'),
    created: t('invoiceNotes.created'),
    createFailed: t('invoiceNotes.createFailed'),
    notesHeading: t('invoiceNotes.notesHeading'),
    noNotes: t('invoiceNotes.noNotes'),
    selectInvoice: t('invoiceNotes.selectInvoice'),
    amountMustBePositive: t('invoicePayments.amountMustBePositive'),
    taxNonNegative: 'Tax total must be zero or greater',
    status: t('invoicePayments.status'),
    grandTotal: 'Grand total',
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const INVOICE_SLUG = '${entity.slug}';
const I18N = ${i18nJson} as const;

export default function ${entityName}NotesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    note_type: 'Credit',
    amount: '',
    tax_total: '0',
    issue_date: new Date().toISOString().slice(0, 10),
    reason: '',
    note: '',
  });

  const loadInvoices = async () => {
    try {
      const res = await api.get('/' + INVOICE_SLUG);
      const rows = Array.isArray(res.data) ? res.data : [];
      setInvoices(rows);
      if (!selectedInvoiceId && rows.length) setSelectedInvoiceId(String(rows[0].id));
    } catch (error: any) {
      toast({ title: I18N.loadInvoicesFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  const loadNotes = async (invoiceId: string) => {
    if (!invoiceId) {
      setItems([]);
      return;
    }
    try {
      const res = await api.get('/' + INVOICE_SLUG + '/' + invoiceId + '/notes');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    loadNotes(selectedInvoiceId);
  }, [selectedInvoiceId]);

  const createNote = async () => {
    if (!selectedInvoiceId) return;
    const amount = Number(form.amount);
    const tax = Number(form.tax_total);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: I18N.amountMustBePositive, variant: 'warning' });
      return;
    }
    if (!Number.isFinite(tax) || tax < 0) {
      toast({ title: I18N.taxNonNegative, variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/' + INVOICE_SLUG + '/' + selectedInvoiceId + '/notes', {
        note_type: form.note_type,
        amount,
        tax_total: tax,
        issue_date: form.issue_date || undefined,
        reason: form.reason || undefined,
        note: form.note || undefined,
      });
      toast({ title: I18N.created, variant: 'success' });
      setForm((prev) => ({ ...prev, amount: '', tax_total: '0', reason: '', note: '' }));
      await loadNotes(selectedInvoiceId);
    } catch (error: any) {
      toast({ title: I18N.createFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">{I18N.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{I18N.subtitle}</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{I18N.invoice}</label>
        <select
          value={selectedInvoiceId}
          onChange={(e) => setSelectedInvoiceId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!invoices.length && <option value="">{I18N.noInvoices}</option>}
          {invoices.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.invoice_number || row.id)} | {I18N.status}: {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{I18N.createHeading}</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <select
            value={form.note_type}
            onChange={(e) => setForm((prev) => ({ ...prev, note_type: e.target.value }))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="Credit">{I18N.credit}</option>
            <option value="Debit">{I18N.debit}</option>
          </select>
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder={I18N.amount}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.tax_total}
            onChange={(e) => setForm((prev) => ({ ...prev, tax_total: e.target.value }))}
            placeholder={I18N.taxTotal}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={form.issue_date}
            onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={createNote}
            disabled={!selectedInvoiceId || saving}
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {I18N.create}
          </button>
        </div>
        <input
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
          placeholder={I18N.reason}
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          placeholder={I18N.noteOptional}
          className="mt-3 min-h-[84px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{I18N.notesHeading}</h2>
        {!items.length ? (
          <div className="text-sm text-slate-500">{I18N.noNotes}</div>
        ) : (
          <div className="space-y-2">
            {items.map((row: any) => (
              <div key={String(row.id)} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-900">{String(row.note_number || row.id)}</div>
                <div className="mt-1 text-slate-600">{String(row.note_type || '')} | {I18N.status}: {String(row.status || '')}</div>
                <div className="text-slate-600">{I18N.grandTotal}: {String(row.grand_total ?? row.amount ?? 0)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

function buildPaymentWorkflowPage({ entity, entityName, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const I18N = {
    title: (t('invoiceWorkflow.title') || '{{entity}} Workflow').replace('{{entity}}', displayName),
    subtitle: 'Post or cancel payment entries.',
    payment: 'Payment',
    noPayments: 'No payments',
    postPayment: 'Post Payment',
    cancelPayment: 'Cancel Payment',
    confirmPost: 'Post selected payment?',
    confirmCancel: 'Cancel selected payment?',
    posted: 'Payment posted',
    cancelled: 'Payment cancelled',
    actionFailed: t('invoiceWorkflow.actionFailed'),
    loadFailed: t('invoicePayments.loadFailed'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}';
const I18N = ${i18nJson} as const;

export default function ${entityName}WorkflowPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [working, setWorking] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get('/' + ENTITY_SLUG);
      const rows = Array.isArray(res.data) ? res.data : [];
      setItems(rows);
      if (!selectedId && rows.length) setSelectedId(String(rows[0].id));
    } catch (error: any) {
      toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (action: 'post' | 'cancel') => {
    if (!selectedId) return;
    if (!confirm(action === 'post' ? I18N.confirmPost : I18N.confirmCancel)) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      toast({ title: action === 'post' ? I18N.posted : I18N.cancelled, variant: 'success' });
      await fetchData();
    } catch (error: any) {
      toast({ title: I18N.actionFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">{I18N.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{I18N.subtitle}</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{I18N.payment}</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!items.length && <option value="">{I18N.noPayments}</option>}
          {items.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.payment_number || row.id)} - {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <button type="button" onClick={() => runAction('post')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {I18N.postPayment}
        </button>
        <button type="button" onClick={() => runAction('cancel')} disabled={!selectedId || working} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          {I18N.cancelPayment}
        </button>
      </div>
    </div>
  );
}
`;
}

function buildNoteWorkflowPage({ entity, entityName, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const I18N = {
    title: (t('invoiceWorkflow.title') || '{{entity}} Workflow').replace('{{entity}}', displayName),
    subtitle: 'Post or cancel invoice credit/debit notes.',
    note: 'Note',
    noNotes: 'No notes',
    postNote: 'Post Note',
    cancelNote: 'Cancel Note',
    confirmPost: 'Post selected note?',
    confirmCancel: 'Cancel selected note?',
    posted: 'Note posted',
    cancelled: 'Note cancelled',
    actionFailed: t('invoiceWorkflow.actionFailed'),
    loadFailed: t('invoiceNotes.loadFailed'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}';
const I18N = ${i18nJson} as const;

export default function ${entityName}WorkflowPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [working, setWorking] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get('/' + ENTITY_SLUG);
      const rows = Array.isArray(res.data) ? res.data : [];
      setItems(rows);
      if (!selectedId && rows.length) setSelectedId(String(rows[0].id));
    } catch (error: any) {
      toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (action: 'post' | 'cancel') => {
    if (!selectedId) return;
    if (!confirm(action === 'post' ? I18N.confirmPost : I18N.confirmCancel)) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      toast({ title: action === 'post' ? I18N.posted : I18N.cancelled, variant: 'success' });
      await fetchData();
    } catch (error: any) {
      toast({ title: I18N.actionFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">{I18N.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{I18N.subtitle}</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">{I18N.note}</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!items.length && <option value="">{I18N.noNotes}</option>}
          {items.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.note_number || row.id)} - {String(row.note_type || '')} - {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <button type="button" onClick={() => runAction('post')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {I18N.postNote}
        </button>
        <button type="button" onClick={() => runAction('cancel')} disabled={!selectedId || working} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          {I18N.cancelNote}
        </button>
      </div>
    </div>
  );
}
`;
}

module.exports = {
  buildInvoiceWorkflowPage,
  buildInvoicePaymentsPage,
  buildInvoiceNotesPage,
  buildPaymentWorkflowPage,
  buildNoteWorkflowPage,
};
