function buildReservationsPage({ entity, entityName, importBase, reservationsCfg }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(reservationsCfg || {}, null, 2)} as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}ReservationsPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [itemId, setItemId] = useState('');
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [quantity, setQuantity] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const preselected = searchParams.get('itemId');
    if (preselected) setItemId(String(preselected));
  }, [searchParams]);

  const fetchItems = async () => {
    const res = await api.get('/' + ENTITY_SLUG);
    setItems(Array.isArray(res.data) ? res.data : []);
  };

  const fetchReservations = async (targetItemId: string) => {
    if (!targetItemId) {
      setReservations([]);
      return;
    }
    const res = await api.get('/' + ENTITY_SLUG + '/' + targetItemId + '/reservations');
    setReservations(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await fetchItems();
      } catch (err) {
        if (!cancelled) toast({ title: 'Load failed', description: 'Could not load items', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchReservations(itemId).catch((err) => {
      console.error('Failed to load reservations:', err);
      toast({ title: 'Load failed', description: 'Could not load reservations', variant: 'error' });
    });
  }, [itemId]);

  const selectedItem = useMemo(
    () => items.find((row) => String(row?.id) === String(itemId)),
    [items, itemId]
  );

  const createReservation = async () => {
    if (!itemId) {
      toast({ title: 'Select item first', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be greater than zero', variant: 'warning' });
      return;
    }

    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + itemId + '/reservations', {
        quantity,
        reference_number: referenceNumber || undefined,
        note: note || undefined,
      });
      setQuantity(0);
      setReferenceNumber('');
      setNote('');
      await Promise.all([fetchItems(), fetchReservations(itemId)]);
      toast({ title: 'Reservation created', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Reserve failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const runReservationAction = async (reservationId: string, action: 'release' | 'commit') => {
    if (!itemId || !reservationId) return;
    const question = action === 'release' ? 'Release this reservation?' : 'Commit this reservation?';
    if (!confirm(question)) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + itemId + '/reservations/' + reservationId + '/' + action, {});
      await Promise.all([fetchItems(), fetchReservations(itemId)]);
      toast({
        title: action === 'release' ? 'Reservation released' : 'Reservation committed',
        variant: 'success',
      });
    } catch (err: any) {
      toast({ title: 'Action failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Reservations</h1>
          <p className="text-sm text-slate-600">Reserve, release, or commit stock with clear availability checks.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          Back to ${entityName}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Item</label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">Select...</option>
            {items.map((row) => (
              <option key={row.id} value={row.id}>{getEntityDisplay(ENTITY_SLUG, row)}</option>
            ))}
          </select>
        </div>

        {selectedItem ? (
          <div className="rounded border bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">Availability Snapshot</div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-slate-500">On Hand</div>
                <div className="font-semibold text-slate-900">{selectedItem[CFG.quantity_field || 'quantity'] ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">Reserved</div>
                <div className="font-semibold text-amber-700">{selectedItem[CFG.reserved_field || 'reserved_quantity'] ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">Committed</div>
                <div className="font-semibold text-blue-700">{selectedItem[CFG.committed_field || 'committed_quantity'] ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">Available</div>
                <div className="font-semibold text-emerald-700">{selectedItem[CFG.available_field || 'available_quantity'] ?? 0}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Reference # (optional)</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={working}
            onClick={createReservation}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Reserve Stock
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-900">Reservations</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Reservation</th>
                <th className="px-3 py-2 text-left">Quantity</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Reference</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reservations.map((row) => {
                const status = String(row?.[CFG.status_field || 'status'] || 'Pending');
                const pending = status === 'Pending';
                return (
                  <tr key={String(row.id)}>
                    <td className="px-3 py-2">{String(row.reservation_number || row.id)}</td>
                    <td className="px-3 py-2">{String(row?.[CFG.quantity_field || 'quantity'] ?? 0)}</td>
                    <td className="px-3 py-2">{status}</td>
                    <td className="px-3 py-2">{String(row.source_reference || '')}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-3">
                        {pending ? (
                          <>
                            <button
                              type="button"
                              onClick={() => runReservationAction(String(row.id), 'release')}
                              disabled={working}
                              className="text-amber-700 hover:underline disabled:opacity-50"
                            >
                              Release
                            </button>
                            <button
                              type="button"
                              onClick={() => runReservationAction(String(row.id), 'commit')}
                              disabled={working}
                              className="text-emerald-700 hover:underline disabled:opacity-50"
                            >
                              Commit
                            </button>
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">No reservations yet</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildGrnPostingPage({ entity, entityName, importBase, inboundCfg }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(inboundCfg || {}, null, 2)} as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}PostingPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [receipts, setReceipts] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const pre = searchParams.get('id');
    if (pre) setSelectedId(String(pre));
  }, [searchParams]);

  const fetchReceipts = async () => {
    const res = await api.get('/' + ENTITY_SLUG);
    setReceipts(Array.isArray(res.data) ? res.data : []);
  };

  const fetchLines = async (grnId: string) => {
    if (!grnId) {
      setLines([]);
      return;
    }
    const lineRes = await api.get('/' + CFG.grn_item_entity, {
      params: { [CFG.grn_item_parent_field || 'goods_receipt_id']: grnId },
    });
    setLines(Array.isArray(lineRes.data) ? lineRes.data : []);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await fetchReceipts();
      } catch (err) {
        if (!cancelled) toast({ title: 'Load failed', description: 'Could not load goods receipts', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchLines(selectedId).catch((err) => {
      console.error('Failed to load GRN lines:', err);
      toast({ title: 'Load failed', description: 'Could not load GRN lines', variant: 'error' });
    });
  }, [selectedId]);

  const selectedReceipt = useMemo(
    () => receipts.find((row) => String(row?.id) === String(selectedId)),
    [receipts, selectedId]
  );

  const postReceipt = async () => {
    if (!selectedId) {
      toast({ title: 'Select a goods receipt first', variant: 'warning' });
      return;
    }
    if (!confirm('Post this goods receipt? This updates stock and PO progress.')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/post', {});
      await Promise.all([fetchReceipts(), fetchLines(selectedId)]);
      toast({ title: 'Goods receipt posted', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Post failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const cancelReceipt = async () => {
    if (!selectedId) {
      toast({ title: 'Select a goods receipt first', variant: 'warning' });
      return;
    }
    if (!confirm('Cancel this goods receipt?')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/cancel', {});
      await Promise.all([fetchReceipts(), fetchLines(selectedId)]);
      toast({ title: 'Goods receipt cancelled', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Cancel failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  const statusValue = String(selectedReceipt?.[CFG.grn_status_field || 'status'] || '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PO / GRN Posting</h1>
          <p className="text-sm text-slate-600">Review receipt lines and post to update stock atomically.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          Back to ${entityName}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Goods Receipt</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {receipts.map((row) => (
              <option key={row.id} value={row.id}>
                {String(row.grn_number || row.id)} — {getEntityDisplay(ENTITY_SLUG, row)}
              </option>
            ))}
          </select>
        </div>

        {selectedReceipt ? (
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div><span className="font-semibold">Status:</span> {statusValue || 'Draft'}</div>
            <div><span className="font-semibold">PO:</span> {String(selectedReceipt?.[CFG.grn_parent_field || 'purchase_order_id'] || '—')}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancelReceipt}
            disabled={!selectedId || working || statusValue === 'Posted' || statusValue === 'Cancelled'}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            Cancel GRN
          </button>
          <button
            type="button"
            onClick={postReceipt}
            disabled={!selectedId || working || statusValue === 'Posted' || statusValue === 'Cancelled'}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Post GRN
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-900">Receipt Lines</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">PO Item</th>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-3 py-2">{String(row?.[CFG.grn_item_po_item_field || 'purchase_order_item_id'] ?? '—')}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.grn_item_item_field || 'item_id'] ?? '—')}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.grn_item_received_field || 'received_quantity'] ?? 0)}</td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-500">No lines for selected goods receipt</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildCycleWorkflowPage({ entity, entityName, importBase, cycleCfg }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(cycleCfg || {}, null, 2)} as const;

export default function ${entityName}WorkflowPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [editingLineId, setEditingLineId] = useState('');
  const [editingCountedValue, setEditingCountedValue] = useState<number>(0);

  useEffect(() => {
    const pre = searchParams.get('id');
    if (pre) setSelectedId(String(pre));
  }, [searchParams]);

  const fetchSessions = async () => {
    const res = await api.get('/' + ENTITY_SLUG);
    setSessions(Array.isArray(res.data) ? res.data : []);
  };

  const fetchLines = async (sessionId: string) => {
    if (!sessionId) {
      setLines([]);
      return;
    }
    const res = await api.get('/' + CFG.line_entity, {
      params: { [CFG.line_session_field || 'cycle_count_session_id']: sessionId },
    });
    setLines(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await fetchSessions();
      } catch (err) {
        if (!cancelled) toast({ title: 'Load failed', description: 'Could not load cycle sessions', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    fetchLines(selectedId).catch((err) => {
      console.error('Failed to load cycle lines:', err);
      toast({ title: 'Load failed', description: 'Could not load cycle lines', variant: 'error' });
    });
  }, [selectedId]);

  const selectedSession = useMemo(
    () => sessions.find((row) => String(row?.id) === String(selectedId)),
    [sessions, selectedId]
  );
  const statusValue = String(selectedSession?.[CFG.session_status_field || 'status'] || '');

  const runAction = async (action: 'start' | 'recalculate' | 'approve' | 'post') => {
    if (!selectedId) {
      toast({ title: 'Select a session first', variant: 'warning' });
      return;
    }
    const labels: Record<string, string> = {
      start: 'Start session',
      recalculate: 'Recalculate variance',
      approve: 'Approve session',
      post: 'Post adjustments',
    };
    if (!confirm(labels[action] + '?')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      await Promise.all([fetchSessions(), fetchLines(selectedId)]);
      toast({ title: labels[action] + ' complete', variant: 'success' });
    } catch (err: any) {
      toast({ title: labels[action] + ' failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const openCountEditor = (line: any) => {
    setEditingLineId(String(line?.id || ''));
    const current = Number(line?.[CFG.line_counted_field || 'counted_quantity'] ?? 0);
    setEditingCountedValue(Number.isFinite(current) ? current : 0);
  };

  const saveLineCount = async () => {
    if (!editingLineId) return;
    setWorking(true);
    try {
      await api.put('/' + CFG.line_entity + '/' + editingLineId, {
        [CFG.line_counted_field || 'counted_quantity']: editingCountedValue,
      });
      setEditingLineId('');
      await fetchLines(selectedId);
      toast({ title: 'Count updated', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cycle Count Workflow</h1>
          <p className="text-sm text-slate-600">Count inventory, calculate variance, approve, and post adjustments.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          Back to ${entityName}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Cycle Session</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {sessions.map((row) => (
              <option key={row.id} value={row.id}>
                {String(row.session_number || row.id)} — {String(row?.[CFG.session_status_field || 'status'] || 'Draft')}
              </option>
            ))}
          </select>
        </div>

        {selectedSession ? (
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <span className="font-semibold">Status:</span> {statusValue || 'Draft'}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => runAction('start')} disabled={!selectedId || working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
            Start
          </button>
          <button type="button" onClick={() => runAction('recalculate')} disabled={!selectedId || working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
            Recalculate
          </button>
          <button type="button" onClick={() => runAction('approve')} disabled={!selectedId || working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50">
            Approve
          </button>
          <button type="button" onClick={() => runAction('post')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            Post
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-900">Session Lines</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Expected</th>
                <th className="px-3 py-2 text-left">Counted</th>
                <th className="px-3 py-2 text-left">Variance</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-3 py-2">{String(row?.[CFG.line_item_field || 'item_id'] ?? '—')}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_expected_field || 'expected_quantity'] ?? 0)}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_counted_field || 'counted_quantity'] ?? 0)}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_variance_field || 'variance_quantity'] ?? 0)}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_status_field || 'status'] ?? 'Pending')}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => openCountEditor(row)} className="text-blue-600 hover:underline">
                      Update Count
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">No cycle lines for selected session</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {editingLineId ? (
          <div className="mt-4 rounded border bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">Update Counted Quantity</div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" value={editingCountedValue} onChange={(e) => setEditingCountedValue(e.target.valueAsNumber)} className="w-48 rounded border px-3 py-2 text-sm" />
              <button type="button" onClick={saveLineCount} disabled={working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => setEditingLineId('')} disabled={working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
`;
}

module.exports = {
  buildReservationsPage,
  buildGrnPostingPage,
  buildCycleWorkflowPage,
};

