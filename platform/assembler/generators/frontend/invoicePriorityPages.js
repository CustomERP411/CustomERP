function buildInvoiceWorkflowPage({ entity, entityName, importBase, lifecycleCfg }) {
  const base = importBase || '..';
  const statuses = Array.isArray(lifecycleCfg && lifecycleCfg.statuses) && lifecycleCfg.statuses.length
    ? lifecycleCfg.statuses
    : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
  return `import { useEffect, useMemo, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}';
const STATUS_FLOW = ${JSON.stringify(statuses)};

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
      toast({ title: 'Failed to load invoices', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (action: 'issue' | 'cancel') => {
    if (!selectedId) return;
    if (!confirm((action === 'issue' ? 'Issue' : 'Cancel') + ' selected invoice?')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      toast({ title: action === 'issue' ? 'Invoice issued' : 'Invoice cancelled', variant: 'success' });
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">${entityName} Workflow</h1>
        <p className="mt-1 text-sm text-slate-600">Run strict invoice lifecycle actions (issue/cancel).</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Select Invoice</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!items.length && <option value="">No invoices</option>}
          {items.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.invoice_number || row.id)} - {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 text-sm text-slate-700">
          Status flow: {STATUS_FLOW.join(' -> ')}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <button
            type="button"
            onClick={() => runAction('issue')}
            disabled={!selectedId || working}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Issue Invoice
          </button>
          <button
            type="button"
            onClick={() => runAction('cancel')}
            disabled={!selectedId || working}
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            Cancel Invoice
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Selected Invoice</h2>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !selectedInvoice ? (
          <div className="text-sm text-slate-500">Select an invoice to view details.</div>
        ) : (
          <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(selectedInvoice, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
`;
}

function buildInvoicePaymentsPage({ entity, entityName, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const INVOICE_SLUG = '${entity.slug}';

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
      toast({ title: 'Failed to load invoices', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
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
      toast({ title: 'Failed to load payments', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
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
      toast({ title: 'Amount must be greater than zero', variant: 'warning' });
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
      toast({ title: 'Payment recorded', variant: 'success' });
      setForm((prev) => ({ ...prev, amount: '', payment_method: '', note: '' }));
      await fetchInvoices();
      await fetchPayments(selectedInvoiceId);
    } catch (error: any) {
      toast({ title: 'Failed to record payment', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">${entityName} Payments</h1>
        <p className="mt-1 text-sm text-slate-600">Record and review allocations (full/partial payments).</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Invoice</label>
        <select
          value={selectedInvoiceId}
          onChange={(e) => setSelectedInvoiceId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!invoices.length && <option value="">No invoices</option>}
          {invoices.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.invoice_number || row.id)} | Outstanding: {String(row.outstanding_balance ?? row.grand_total ?? 0)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Record Payment</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Amount"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.payment_method}
            onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}
            placeholder="Payment method"
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
            Record
          </button>
        </div>
        <textarea
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          placeholder="Note (optional)"
          className="mt-3 min-h-[84px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Payments for selected invoice</h2>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !selectedInvoice ? (
          <div className="text-sm text-slate-500">Select an invoice.</div>
        ) : !items.length ? (
          <div className="text-sm text-slate-500">No payments allocated yet.</div>
        ) : (
          <div className="space-y-2">
            {items.map((row: any, idx: number) => {
              const payment = row?.payment || row;
              const allocation = row?.allocation || null;
              return (
                <div key={String(payment?.id || idx)} className="rounded-md border border-slate-200 p-3 text-sm">
                  <div className="font-medium text-slate-900">{String(payment?.payment_number || payment?.id || 'Payment')}</div>
                  <div className="mt-1 text-slate-600">Status: {String(payment?.status || 'Unknown')}</div>
                  <div className="text-slate-600">Amount: {String(payment?.amount ?? 0)} | Unallocated: {String(payment?.unallocated_amount ?? 0)}</div>
                  {allocation ? (
                    <div className="text-slate-600">Allocated: {String(allocation?.amount ?? 0)} at {String(allocation?.allocated_at || '')}</div>
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

function buildInvoiceNotesPage({ entity, entityName, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const INVOICE_SLUG = '${entity.slug}';

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
      toast({ title: 'Failed to load invoices', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
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
      toast({ title: 'Failed to load notes', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
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
      toast({ title: 'Amount must be greater than zero', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(tax) || tax < 0) {
      toast({ title: 'Tax total must be zero or greater', variant: 'warning' });
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
      toast({ title: 'Note created', variant: 'success' });
      setForm((prev) => ({ ...prev, amount: '', tax_total: '0', reason: '', note: '' }));
      await loadNotes(selectedInvoiceId);
    } catch (error: any) {
      toast({ title: 'Failed to create note', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">${entityName} Notes</h1>
        <p className="mt-1 text-sm text-slate-600">Create credit/debit notes linked to source invoices.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Invoice</label>
        <select
          value={selectedInvoiceId}
          onChange={(e) => setSelectedInvoiceId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!invoices.length && <option value="">No invoices</option>}
          {invoices.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.invoice_number || row.id)} | Status: {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Create Note</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <select
            value={form.note_type}
            onChange={(e) => setForm((prev) => ({ ...prev, note_type: e.target.value }))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="Credit">Credit</option>
            <option value="Debit">Debit</option>
          </select>
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Amount"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={form.tax_total}
            onChange={(e) => setForm((prev) => ({ ...prev, tax_total: e.target.value }))}
            placeholder="Tax total"
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
            Create
          </button>
        </div>
        <input
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
          placeholder="Reason"
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <textarea
          value={form.note}
          onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
          placeholder="Note (optional)"
          className="mt-3 min-h-[84px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Notes for selected invoice</h2>
        {!items.length ? (
          <div className="text-sm text-slate-500">No notes yet.</div>
        ) : (
          <div className="space-y-2">
            {items.map((row: any) => (
              <div key={String(row.id)} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-900">{String(row.note_number || row.id)}</div>
                <div className="mt-1 text-slate-600">{String(row.note_type || '')} | Status: {String(row.status || '')}</div>
                <div className="text-slate-600">Grand total: {String(row.grand_total ?? row.amount ?? 0)}</div>
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

function buildPaymentWorkflowPage({ entity, entityName, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}';

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
      toast({ title: 'Failed to load payments', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (action: 'post' | 'cancel') => {
    if (!selectedId) return;
    if (!confirm((action === 'post' ? 'Post' : 'Cancel') + ' selected payment?')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      toast({ title: action === 'post' ? 'Payment posted' : 'Payment cancelled', variant: 'success' });
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">${entityName} Workflow</h1>
        <p className="mt-1 text-sm text-slate-600">Post or cancel payment entries.</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Payment</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!items.length && <option value="">No payments</option>}
          {items.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.payment_number || row.id)} - {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <button type="button" onClick={() => runAction('post')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          Post Payment
        </button>
        <button type="button" onClick={() => runAction('cancel')} disabled={!selectedId || working} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          Cancel Payment
        </button>
      </div>
    </div>
  );
}
`;
}

function buildNoteWorkflowPage({ entity, entityName, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useState } from 'react';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}';

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
      toast({ title: 'Failed to load notes', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runAction = async (action: 'post' | 'cancel') => {
    if (!selectedId) return;
    if (!confirm((action === 'post' ? 'Post' : 'Cancel') + ' selected note?')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      toast({ title: action === 'post' ? 'Note posted' : 'Note cancelled', variant: 'success' });
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Action failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <h1 className="text-xl font-semibold text-slate-900">${entityName} Workflow</h1>
        <p className="mt-1 text-sm text-slate-600">Post or cancel invoice credit/debit notes.</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">Note</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {!items.length && <option value="">No notes</option>}
          {items.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.note_number || row.id)} - {String(row.note_type || '')} - {String(row.status || 'Draft')}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <button type="button" onClick={() => runAction('post')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          Post Note
        </button>
        <button type="button" onClick={() => runAction('cancel')} disabled={!selectedId || working} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          Cancel Note
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
