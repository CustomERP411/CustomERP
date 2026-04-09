function buildReceivePage({ entity, entityName, invCfg, entityLocationField, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}ReceivePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    const pre = searchParams.get('itemId');
    if (pre) setItemId(String(pre));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [itemsRes, locRes] = await Promise.all([
          api.get('/' + ENTITY_SLUG),
          api.get('/' + INV.location_entity).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'warning' });
      return;
    }

    try {
      if ((INV as any).use_workflow_api) {
        await api.post('/' + ENTITY_SLUG + '/' + itemId + '/inventory/receive', {
          quantity,
          location_id: locationId || undefined,
          movement_date: movementDate || undefined,
          reference_number: referenceNumber || undefined,
          note: note || undefined,
        });
        toast({ title: 'Stock received', variant: 'success' });
        navigate('/' + ENTITY_SLUG);
        return;
      }

      const movement: any = {};
      movement[INV.fields.item_ref] = itemId;
      movement[INV.fields.type] = INV.movement_types.receive;
      movement[INV.fields.qty] = quantity;
      if (locationId) movement[INV.fields.location] = locationId;
      if (movementDate) movement[INV.fields.date] = movementDate;
      if (referenceNumber) movement[INV.fields.reference_number] = referenceNumber;
      if (note) movement[INV.fields.reason] = note;

      await api.post('/' + INV.movement_entity, movement);

      // Update cached quantity on the main entity (if it exists)
      const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
      const patch: any = {};
      patch[INV.quantity_field] = current + quantity;

      if (locationId && ENTITY_LOCATION_FIELD) {
        if (String(ENTITY_LOCATION_FIELD).endsWith('_ids')) {
          const existing = Array.isArray(selectedItem?.[ENTITY_LOCATION_FIELD]) ? selectedItem?.[ENTITY_LOCATION_FIELD] : [];
          patch[ENTITY_LOCATION_FIELD] = Array.from(new Set([...existing.map(String), String(locationId)]));
        } else {
          patch[ENTITY_LOCATION_FIELD] = locationId;
        }
      }

      await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);

      toast({ title: 'Stock received', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: 'Receive failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Receive stock</h1>
          <p className="text-sm text-slate-600">Creates a movement + updates quantity.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        {locations.length ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference # (optional)</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Receive
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildIssuePage({ entity, entityName, invCfg, entityLocationField, issueLabel, escapeJsString, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;
const ISSUE_LABEL = '${escapeJsString(issueLabel || 'Sell')}' as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}IssuePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    const pre = searchParams.get('itemId');
    if (pre) setItemId(String(pre));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [itemsRes, locRes] = await Promise.all([
          api.get('/' + ENTITY_SLUG),
          api.get('/' + INV.location_entity).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'warning' });
      return;
    }

    const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
    const nextQty = current - quantity;
    if (!(INV.issue && INV.issue.allow_negative_stock) && nextQty < 0) {
      toast({
        title: 'Insufficient stock',
        description: 'This would make stock negative. Adjust stock or enable negative stock for this operation.',
        variant: 'warning',
      });
      return;
    }

    try {
      if ((INV as any).use_workflow_api) {
        await api.post('/' + ENTITY_SLUG + '/' + itemId + '/inventory/issue', {
          quantity,
          location_id: locationId || undefined,
          movement_date: movementDate || undefined,
          reference_number: referenceNumber || undefined,
          note: note || undefined,
        });
        toast({ title: ISSUE_LABEL + ' recorded', variant: 'success' });
        navigate('/' + ENTITY_SLUG);
        return;
      }

      const mode = String((INV as any).quantity_mode || 'delta');
      const movement: any = {};
      movement[INV.fields.item_ref] = itemId;
      movement[INV.fields.type] = INV.movement_types.issue || 'OUT';
      movement[INV.fields.qty] = mode === 'delta' ? -quantity : quantity;
      if (locationId) movement[INV.fields.location] = locationId;
      if (movementDate) movement[INV.fields.date] = movementDate;
      if (referenceNumber) movement[INV.fields.reference_number] = referenceNumber;
      if (note) movement[INV.fields.reason] = note;

      await api.post('/' + INV.movement_entity, movement);

      const patch: any = {};
      patch[INV.quantity_field] = nextQty;

      if (locationId && ENTITY_LOCATION_FIELD) {
        if (String(ENTITY_LOCATION_FIELD).endsWith('_ids')) {
          const existing = Array.isArray(selectedItem?.[ENTITY_LOCATION_FIELD]) ? selectedItem?.[ENTITY_LOCATION_FIELD] : [];
          patch[ENTITY_LOCATION_FIELD] = Array.from(new Set([...existing.map(String), String(locationId)]));
        } else {
          patch[ENTITY_LOCATION_FIELD] = locationId;
        }
      }

      await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);

      toast({ title: ISSUE_LABEL + ' recorded', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: ISSUE_LABEL + ' failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ISSUE_LABEL}</h1>
          <p className="text-sm text-slate-600">Creates a movement + updates quantity.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        {locations.length ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location (optional)</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reference # (optional)</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {ISSUE_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildAdjustPage({ entity, entityName, invCfg, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}AdjustPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [qtyChange, setQtyChange] = useState<number>(0);
  const [reasonCode, setReasonCode] = useState<string>(INV.adjust.reason_codes?.[0] || 'COUNT');
  const [note, setNote] = useState('');
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get('/' + ENTITY_SLUG);
        if (cancelled) return;
        setItems(Array.isArray(res.data) ? res.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(qtyChange) || qtyChange === 0) {
      toast({ title: 'Quantity change must be non-zero', description: 'Use + for increase, - for decrease', variant: 'warning' });
      return;
    }

    try {
      if ((INV as any).use_workflow_api) {
        await api.post('/' + ENTITY_SLUG + '/' + itemId + '/inventory/adjust', {
          delta: qtyChange,
          movement_date: movementDate || undefined,
          reason: reasonCode,
          note: note || undefined,
        });
        toast({ title: 'Stock adjusted', variant: 'success' });
        navigate('/' + ENTITY_SLUG);
        return;
      }

      const mode = String((INV as any).quantity_mode || 'delta');
      const movement: any = {};
      movement[INV.fields.item_ref] = itemId;
      let movementType = INV.movement_types.adjust;
      let movementQty: number = qtyChange;
      if (mode !== 'delta') {
        movementQty = Math.abs(qtyChange);
        if (qtyChange >= 0) {
          movementType = (INV.movement_types.adjust_in || INV.movement_types.receive);
        } else {
          movementType = (INV.movement_types.adjust_out || INV.movement_types.issue || INV.movement_types.transfer_out || 'OUT');
        }
      }
      movement[INV.fields.type] = movementType;
      movement[INV.fields.qty] = movementQty;
      movement[INV.fields.date] = movementDate;
      movement[INV.fields.reason] = reasonCode + (note ? (': ' + note) : '');

      await api.post('/' + INV.movement_entity, movement);

      const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
      const patch: any = {};
      patch[INV.quantity_field] = current + qtyChange;
      await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);

      toast({ title: 'Stock adjusted', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: 'Adjust failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Adjust stock</h1>
          <p className="text-sm text-slate-600">Use a quantity change (+/-) and a reason code (for non-sales corrections).</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity change</label>
            <input type="number" value={qtyChange} onChange={(e) => setQtyChange(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
            <div className="mt-1 text-xs text-slate-500">Example: -5 (shrinkage), +10 (found stock)</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason code</label>
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="w-full rounded border px-3 py-2">
              {(INV.adjust.reason_codes || []).map((rc) => (
                <option key={rc} value={rc}>{rc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Apply adjustment
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildTransferPage({ entity, entityName, invCfg, entityLocationField, importBase }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

export default function ${entityName}TransferPage() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [itemId, setItemId] = useState('');
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [movementDate, setMovementDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [itemsRes, locRes] = await Promise.all([
          api.get('/' + ENTITY_SLUG),
          api.get('/' + INV.location_entity).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : []);
        setLocations(Array.isArray(locRes.data) ? locRes.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const selectedItem = useMemo(() => items.find((it) => String(it.id) === String(itemId)), [items, itemId]);

  const submit = async () => {
    if (!itemId) {
      toast({ title: 'Select an item', variant: 'warning' });
      return;
    }
    if (!fromLocationId || !toLocationId) {
      toast({ title: 'Select both locations', variant: 'warning' });
      return;
    }
    if (String(fromLocationId) === String(toLocationId)) {
      toast({ title: 'Invalid transfer', description: 'From and To locations must be different', variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: 'Quantity must be > 0', variant: 'warning' });
      return;
    }

    try {
      if ((INV as any).use_workflow_api) {
        await api.post('/' + ENTITY_SLUG + '/' + itemId + '/inventory/transfer', {
          quantity,
          from_location_id: fromLocationId,
          to_location_id: toLocationId,
          movement_date: movementDate || undefined,
          note: note || undefined,
        });
        toast({ title: 'Transfer recorded', variant: 'success' });
        navigate('/' + ENTITY_SLUG);
        return;
      }

      const mode = String((INV as any).quantity_mode || 'delta');
      const outMovement: any = {};
      outMovement[INV.fields.item_ref] = itemId;
      outMovement[INV.fields.type] = INV.movement_types.transfer_out;
      outMovement[INV.fields.qty] = mode === 'delta' ? -quantity : quantity;
      outMovement[INV.fields.location] = fromLocationId;
      outMovement[INV.fields.from_location] = fromLocationId;
      outMovement[INV.fields.to_location] = toLocationId;
      outMovement[INV.fields.date] = movementDate;
      if (note) outMovement[INV.fields.reason] = note;

      const inMovement: any = {};
      inMovement[INV.fields.item_ref] = itemId;
      inMovement[INV.fields.type] = INV.movement_types.transfer_in;
      inMovement[INV.fields.qty] = quantity;
      inMovement[INV.fields.location] = toLocationId;
      inMovement[INV.fields.from_location] = fromLocationId;
      inMovement[INV.fields.to_location] = toLocationId;
      inMovement[INV.fields.date] = movementDate;
      if (note) inMovement[INV.fields.reason] = note;

      await api.post('/' + INV.movement_entity, outMovement);
      await api.post('/' + INV.movement_entity, inMovement);

      // Keep location references updated (best-effort)
      if (ENTITY_LOCATION_FIELD) {
        const patch: any = {};
        if (String(ENTITY_LOCATION_FIELD).endsWith('_ids')) {
          const existing = Array.isArray(selectedItem?.[ENTITY_LOCATION_FIELD]) ? selectedItem?.[ENTITY_LOCATION_FIELD] : [];
          patch[ENTITY_LOCATION_FIELD] = Array.from(new Set([...existing.map(String), String(fromLocationId), String(toLocationId)]));
        } else {
          patch[ENTITY_LOCATION_FIELD] = toLocationId;
        }
        await api.put('/' + ENTITY_SLUG + '/' + itemId, patch);
      }

      toast({ title: 'Transfer recorded', variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: 'Transfer failed', description: err?.response?.data?.error || err?.message || 'Unknown error', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transfer stock</h1>
          <p className="text-sm text-slate-600">Records an OUT and an IN movement (net zero).</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Item</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">Select...</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From location</label>
            <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To location</label>
            <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">Select...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Movement date</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Transfer
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

module.exports = { buildReceivePage, buildIssuePage, buildAdjustPage, buildTransferPage };
