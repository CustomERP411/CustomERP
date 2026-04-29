const { tFor } = require('../../i18n/labels');

function buildReservationsPage({ entity, entityName, importBase, reservationsCfg, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const title = `${displayName} ${t('sidebar.workflow.reservations')}`;
  const backTo = `${t('common.back')} ${displayName}`;
  const L = {
    loading: t('common.loading'),
    item: t('inventoryPages.reservations.item'),
    selectPlaceholder: t('inventoryPages.reservations.selectPlaceholder'),
    availabilitySnapshot: t('inventoryPages.reservations.availabilitySnapshot'),
    onHand: t('inventoryPages.reservations.onHand'),
    reserved: t('inventoryPages.reservations.reserved'),
    committed: t('inventoryPages.reservations.committed'),
    available: t('inventoryPages.reservations.available'),
    quantity: t('inventoryPages.reservations.quantity'),
    referenceOptional: t('inventoryPages.reservations.referenceOptional'),
    noteOptional: t('inventoryPages.reservations.noteOptional'),
    reserveStock: t('inventoryPages.reservations.reserveStock'),
    tableHeader: t('inventoryPages.reservations.tableHeader'),
    colReservation: t('inventoryPages.reservations.colReservation'),
    colQuantity: t('inventoryPages.reservations.colQuantity'),
    colStatus: t('inventoryPages.reservations.colStatus'),
    colReference: t('inventoryPages.reservations.colReference'),
    colActions: t('inventoryPages.reservations.colActions'),
    release: t('inventoryPages.reservations.release'),
    commit: t('inventoryPages.reservations.commit'),
    empty: t('inventoryPages.reservations.empty'),
    actionFailed: t('inventoryPages.reservations.actionFailed'),
    released: t('inventoryPages.reservations.released'),
    committedToast: t('inventoryPages.reservations.committed'),
    subtitle: t('inventoryPages.reservations.subtitle'),
    unknownError: t('common.unknownError'),
    loadFailedTitle: t('inventoryWorkflow.common.loadFailedTitle'),
    couldNotLoadItems: t('inventoryWorkflow.reservations.couldNotLoadItems'),
    couldNotLoadReservations: t('inventoryWorkflow.reservations.couldNotLoadReservations'),
    selectItemFirst: t('inventoryWorkflow.reservations.selectItemFirst'),
    quantityMustBePositive: t('inventoryWorkflow.reservations.quantityMustBePositive'),
    reservationCreated: t('inventoryWorkflow.reservations.reservationCreated'),
    reserveFailed: t('inventoryWorkflow.reservations.reserveFailed'),
    confirmRelease: t('inventoryWorkflow.reservations.confirmRelease'),
    confirmCommit: t('inventoryWorkflow.reservations.confirmCommit'),
  };
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';
import { formatStatus } from '${base}/utils/statusFormatter';

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
        if (!cancelled) toast({ title: '${L.loadFailedTitle}', description: '${L.couldNotLoadItems}', variant: 'error' });
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
      toast({ title: '${L.loadFailedTitle}', description: '${L.couldNotLoadReservations}', variant: 'error' });
    });
  }, [itemId]);

  const selectedItem = useMemo(
    () => items.find((row) => String(row?.id) === String(itemId)),
    [items, itemId]
  );

  const createReservation = async () => {
    if (!itemId) {
      toast({ title: '${L.selectItemFirst}', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: '${L.quantityMustBePositive}', variant: 'warning' });
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
      toast({ title: '${L.reservationCreated}', variant: 'success' });
    } catch (err: any) {
      toast({ title: '${L.reserveFailed}', description: err?.response?.data?.error || err?.message || '${L.unknownError}', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const runReservationAction = async (reservationId: string, action: 'release' | 'commit') => {
    if (!itemId || !reservationId) return;
    const question = action === 'release' ? '${L.confirmRelease}' : '${L.confirmCommit}';
    if (!confirm(question)) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + itemId + '/reservations/' + reservationId + '/' + action, {});
      await Promise.all([fetchItems(), fetchReservations(itemId)]);
      toast({
        title: action === 'release' ? '${L.released}' : '${L.committedToast}',
        variant: 'success',
      });
    } catch (err: any) {
      toast({ title: '${L.actionFailed}', description: err?.response?.data?.error || err?.message || '${L.unknownError}', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-4">${L.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${title}</h1>
          <p className="text-sm text-slate-600">${L.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          ${backTo}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">${L.item}</label>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">${L.selectPlaceholder}</option>
            {items.map((row) => (
              <option key={row.id} value={row.id}>{getEntityDisplay(ENTITY_SLUG, row)}</option>
            ))}
          </select>
        </div>

        {selectedItem ? (
          <div className="rounded border bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">${L.availabilitySnapshot}</div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <div className="text-slate-500">${L.onHand}</div>
                <div className="font-semibold text-slate-900">{selectedItem[CFG.quantity_field || 'quantity'] ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">${L.reserved}</div>
                <div className="font-semibold text-amber-700">{selectedItem[CFG.reserved_field || 'reserved_quantity'] ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">${L.committed}</div>
                <div className="font-semibold text-blue-700">{selectedItem[CFG.committed_field || 'committed_quantity'] ?? 0}</div>
              </div>
              <div>
                <div className="text-slate-500">${L.available}</div>
                <div className="font-semibold text-emerald-700">{selectedItem[CFG.available_field || 'available_quantity'] ?? 0}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">${L.quantity}</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">${L.referenceOptional}</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">${L.noteOptional}</label>
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
            ${L.reserveStock}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-900">${L.tableHeader}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">${L.colReservation}</th>
                <th className="px-3 py-2 text-left">${L.colQuantity}</th>
                <th className="px-3 py-2 text-left">${L.colStatus}</th>
                <th className="px-3 py-2 text-left">${L.colReference}</th>
                <th className="px-3 py-2 text-right">${L.colActions}</th>
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
                    <td className="px-3 py-2">{formatStatus(ENTITY_SLUG, status)}</td>
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
                              ${L.release}
                            </button>
                            <button
                              type="button"
                              onClick={() => runReservationAction(String(row.id), 'commit')}
                              disabled={working}
                              className="text-emerald-700 hover:underline disabled:opacity-50"
                            >
                              ${L.commit}
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
                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">${L.empty}</td>
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

function buildGrnPostingPage({ entity, entityName, importBase, inboundCfg, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const title = `${displayName} ${t('sidebar.workflow.grnPosting')}`;
  const backTo = `${t('common.back')} ${displayName}`;
  const G = {
    loading: t('common.loading'),
    cancelConfirm: t('inventoryPages.grn.cancelConfirm'),
    cancelFailed: t('inventoryPages.grn.cancelFailed'),
    cancelGrn: t('inventoryPages.grn.cancelGrn'),
    unknownError: t('common.unknownError'),
    loadFailedTitle: t('inventoryWorkflow.common.loadFailedTitle'),
    statusLabel: t('inventoryWorkflow.common.statusLabel'),
    selectPlaceholder: t('inventoryWorkflow.common.selectPlaceholder'),
    subtitle: t('inventoryWorkflow.grn.subtitle'),
    couldNotLoadReceipts: t('inventoryWorkflow.grn.couldNotLoadReceipts'),
    couldNotLoadLines: t('inventoryWorkflow.grn.couldNotLoadLines'),
    selectFirst: t('inventoryWorkflow.grn.selectFirst'),
    confirmPost: t('inventoryWorkflow.grn.confirmPost'),
    posted: t('inventoryWorkflow.grn.posted'),
    postFailed: t('inventoryWorkflow.grn.postFailed'),
    cancelled: t('inventoryWorkflow.grn.cancelled'),
    selectLabel: t('inventoryWorkflow.grn.selectLabel'),
    poLabel: t('inventoryWorkflow.grn.poLabel'),
    postButton: t('inventoryWorkflow.grn.postButton'),
    linesHeading: t('inventoryWorkflow.grn.linesHeading'),
    colPoItem: t('inventoryWorkflow.grn.colPoItem'),
    colItem: t('inventoryWorkflow.grn.colItem'),
    colReceived: t('inventoryWorkflow.grn.colReceived'),
    noLines: t('inventoryWorkflow.grn.noLines'),
  };
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';
import { formatStatus } from '${base}/utils/statusFormatter';

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
        if (!cancelled) toast({ title: '${G.loadFailedTitle}', description: '${G.couldNotLoadReceipts}', variant: 'error' });
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
      toast({ title: '${G.loadFailedTitle}', description: '${G.couldNotLoadLines}', variant: 'error' });
    });
  }, [selectedId]);

  const selectedReceipt = useMemo(
    () => receipts.find((row) => String(row?.id) === String(selectedId)),
    [receipts, selectedId]
  );

  const postReceipt = async () => {
    if (!selectedId) {
      toast({ title: '${G.selectFirst}', variant: 'warning' });
      return;
    }
    if (!confirm('${G.confirmPost}')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/post', {});
      await Promise.all([fetchReceipts(), fetchLines(selectedId)]);
      toast({ title: '${G.posted}', variant: 'success' });
    } catch (err: any) {
      toast({ title: '${G.postFailed}', description: err?.response?.data?.error || err?.message || '${G.unknownError}', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const cancelReceipt = async () => {
    if (!selectedId) {
      toast({ title: '${G.selectFirst}', variant: 'warning' });
      return;
    }
    if (!confirm('${G.cancelConfirm}')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/cancel', {});
      await Promise.all([fetchReceipts(), fetchLines(selectedId)]);
      toast({ title: '${G.cancelled}', variant: 'success' });
    } catch (err: any) {
      toast({ title: '${G.cancelFailed}', description: err?.response?.data?.error || err?.message || '${G.unknownError}', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-4">${G.loading}</div>;

  const statusValue = String(selectedReceipt?.[CFG.grn_status_field || 'status'] || '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${title}</h1>
          <p className="text-sm text-slate-600">${G.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          ${backTo}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">${G.selectLabel}</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">${G.selectPlaceholder}</option>
            {receipts.map((row) => (
              <option key={row.id} value={row.id}>
                {String(row.grn_number || row.id)} — {getEntityDisplay(ENTITY_SLUG, row)}
              </option>
            ))}
          </select>
        </div>

        {selectedReceipt ? (
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div><span className="font-semibold">${G.statusLabel}</span> {formatStatus(ENTITY_SLUG, statusValue || 'Draft')}</div>
            <div><span className="font-semibold">${G.poLabel}</span> {String(selectedReceipt?.[CFG.grn_parent_field || 'purchase_order_id'] || '—')}</div>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancelReceipt}
            disabled={!selectedId || working || statusValue === 'Posted' || statusValue === 'Cancelled'}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 disabled:opacity-50"
          >
            ${G.cancelGrn}
          </button>
          <button
            type="button"
            onClick={postReceipt}
            disabled={!selectedId || working || statusValue === 'Posted' || statusValue === 'Cancelled'}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            ${G.postButton}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-900">${G.linesHeading}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">${G.colPoItem}</th>
                <th className="px-3 py-2 text-left">${G.colItem}</th>
                <th className="px-3 py-2 text-left">${G.colReceived}</th>
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
                  <td colSpan={3} className="px-3 py-4 text-center text-slate-500">${G.noLines}</td>
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

function buildCycleWorkflowPage({ entity, entityName, importBase, cycleCfg, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const displayName = entity?.display_name || entityName;
  const title = `${displayName} ${t('sidebar.workflow.cycleCount')}`;
  const backTo = `${t('common.back')} ${displayName}`;
  const C = {
    loading: t('common.loading'),
    updateCount: t('inventoryPages.cycleCount.updateCount'),
    noLines: t('inventoryPages.cycleCount.noLines'),
    save: t('inventoryPages.cycleCount.save'),
    cancel: t('inventoryPages.cycleCount.cancel'),
    unknownError: t('common.unknownError'),
    loadFailedTitle: t('inventoryWorkflow.common.loadFailedTitle'),
    statusLabel: t('inventoryWorkflow.common.statusLabel'),
    selectPlaceholder: t('inventoryWorkflow.common.selectPlaceholder'),
    subtitle: t('inventoryWorkflow.cycle.subtitle'),
    couldNotLoadSessions: t('inventoryWorkflow.cycle.couldNotLoadSessions'),
    couldNotLoadLines: t('inventoryWorkflow.cycle.couldNotLoadLines'),
    selectFirst: t('inventoryWorkflow.cycle.selectFirst'),
    actionStart: t('inventoryWorkflow.cycle.actionStart'),
    actionRecalculate: t('inventoryWorkflow.cycle.actionRecalculate'),
    actionApprove: t('inventoryWorkflow.cycle.actionApprove'),
    actionPost: t('inventoryWorkflow.cycle.actionPost'),
    actionCompleteSuffix: t('inventoryWorkflow.cycle.actionCompleteSuffix'),
    actionFailedSuffix: t('inventoryWorkflow.cycle.actionFailedSuffix'),
    countUpdated: t('inventoryWorkflow.cycle.countUpdated'),
    updateFailed: t('inventoryWorkflow.cycle.updateFailed'),
    selectLabel: t('inventoryWorkflow.cycle.selectLabel'),
    btnStart: t('inventoryWorkflow.cycle.btnStart'),
    btnRecalculate: t('inventoryWorkflow.cycle.btnRecalculate'),
    btnApprove: t('inventoryWorkflow.cycle.btnApprove'),
    btnPost: t('inventoryWorkflow.cycle.btnPost'),
    linesHeading: t('inventoryWorkflow.cycle.linesHeading'),
    colItem: t('inventoryWorkflow.cycle.colItem'),
    colExpected: t('inventoryWorkflow.cycle.colExpected'),
    colCounted: t('inventoryWorkflow.cycle.colCounted'),
    colVariance: t('inventoryWorkflow.cycle.colVariance'),
    colStatus: t('inventoryWorkflow.cycle.colStatus'),
    colActions: t('inventoryWorkflow.cycle.colActions'),
  };
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import { formatStatus } from '${base}/utils/statusFormatter';

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
        if (!cancelled) toast({ title: '${C.loadFailedTitle}', description: '${C.couldNotLoadSessions}', variant: 'error' });
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
      toast({ title: '${C.loadFailedTitle}', description: '${C.couldNotLoadLines}', variant: 'error' });
    });
  }, [selectedId]);

  const selectedSession = useMemo(
    () => sessions.find((row) => String(row?.id) === String(selectedId)),
    [sessions, selectedId]
  );
  const statusValue = String(selectedSession?.[CFG.session_status_field || 'status'] || '');

  const runAction = async (action: 'start' | 'recalculate' | 'approve' | 'post') => {
    if (!selectedId) {
      toast({ title: '${C.selectFirst}', variant: 'warning' });
      return;
    }
    const labels: Record<string, string> = {
      start: '${C.actionStart}',
      recalculate: '${C.actionRecalculate}',
      approve: '${C.actionApprove}',
      post: '${C.actionPost}',
    };
    if (!confirm(labels[action] + '?')) return;
    setWorking(true);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + selectedId + '/' + action, {});
      await Promise.all([fetchSessions(), fetchLines(selectedId)]);
      toast({ title: labels[action] + ' ${C.actionCompleteSuffix}', variant: 'success' });
    } catch (err: any) {
      toast({ title: labels[action] + ' ${C.actionFailedSuffix}', description: err?.response?.data?.error || err?.message || '${C.unknownError}', variant: 'error' });
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
      toast({ title: '${C.countUpdated}', variant: 'success' });
    } catch (err: any) {
      toast({ title: '${C.updateFailed}', description: err?.response?.data?.error || err?.message || '${C.unknownError}', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="p-4">${C.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${title}</h1>
          <p className="text-sm text-slate-600">${C.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          ${backTo}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">${C.selectLabel}</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">${C.selectPlaceholder}</option>
            {sessions.map((row) => (
              <option key={row.id} value={row.id}>
                {String(row.session_number || row.id)} — {formatStatus(ENTITY_SLUG, row?.[CFG.session_status_field || 'status'] || 'Draft')}
              </option>
            ))}
          </select>
        </div>

        {selectedSession ? (
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <span className="font-semibold">${C.statusLabel}</span> {formatStatus(ENTITY_SLUG, statusValue || 'Draft')}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => runAction('start')} disabled={!selectedId || working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
            ${C.btnStart}
          </button>
          <button type="button" onClick={() => runAction('recalculate')} disabled={!selectedId || working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
            ${C.btnRecalculate}
          </button>
          <button type="button" onClick={() => runAction('approve')} disabled={!selectedId || working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50">
            ${C.btnApprove}
          </button>
          <button type="button" onClick={() => runAction('post')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            ${C.btnPost}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-900">${C.linesHeading}</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">${C.colItem}</th>
                <th className="px-3 py-2 text-left">${C.colExpected}</th>
                <th className="px-3 py-2 text-left">${C.colCounted}</th>
                <th className="px-3 py-2 text-left">${C.colVariance}</th>
                <th className="px-3 py-2 text-left">${C.colStatus}</th>
                <th className="px-3 py-2 text-right">${C.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((row) => (
                <tr key={String(row.id)}>
                  <td className="px-3 py-2">{String(row?.[CFG.line_item_field || 'item_id'] ?? '—')}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_expected_field || 'expected_quantity'] ?? 0)}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_counted_field || 'counted_quantity'] ?? 0)}</td>
                  <td className="px-3 py-2">{String(row?.[CFG.line_variance_field || 'variance_quantity'] ?? 0)}</td>
                  <td className="px-3 py-2">{formatStatus(CFG.line_entity || ENTITY_SLUG, String(row?.[CFG.line_status_field || 'status'] ?? 'Pending'))}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => openCountEditor(row)} className="text-blue-600 hover:underline">
                      ${C.updateCount}
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-slate-500">${C.noLines}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {editingLineId ? (
          <div className="mt-4 rounded border bg-slate-50 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-900">${C.updateCount}</div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" value={editingCountedValue} onChange={(e) => setEditingCountedValue(e.target.valueAsNumber)} className="w-48 rounded border px-3 py-2 text-sm" />
              <button type="button" onClick={saveLineCount} disabled={working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                ${C.save}
              </button>
              <button type="button" onClick={() => setEditingLineId('')} disabled={working} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-50">
                ${C.cancel}
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

