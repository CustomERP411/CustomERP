const { tFor } = require('../../../i18n/labels');

function _commonInvLabels(language) {
  const t = tFor(language);
  return {
    item: t('inventoryOps.fields.item') || 'Item',
    location: t('inventoryOps.fields.location') || 'Location',
    locationOptional: t('inventoryOps.fields.locationOptional') || 'Location (optional)',
    fromLocation: t('inventoryOps.fields.fromLocation') || 'From location',
    toLocation: t('inventoryOps.fields.toLocation') || 'To location',
    quantity: t('inventoryOps.fields.quantity') || 'Quantity',
    quantityChange: t('inventoryOps.fields.quantityChange') || 'Quantity change',
    movementDate: t('inventoryOps.fields.movementDate') || 'Movement date',
    referenceNumber: t('inventoryOps.fields.referenceNumber') || 'Reference # (optional)',
    note: t('inventoryOps.fields.note') || 'Note (optional)',
    reasonCode: t('inventoryOps.fields.reasonCode') || 'Reason code',
    selectPlaceholder: t('common.select') || 'Select...',
    cancel: t('common.cancel'),
    back: t('common.back'),
    loading: t('common.loading'),
    selectItemTitle: t('inventoryOps.errors.selectItem') || 'Select an item',
    qtyMustBePositive: t('inventoryOps.errors.qtyPositive') || 'Quantity must be > 0',
    qtyChangeNonZero: t('inventoryOps.errors.qtyNonZero') || 'Quantity change must be non-zero',
    qtyChangeHint: t('inventoryOps.errors.qtyChangeHint') || 'Use + for increase, - for decrease',
    selectBothLocations: t('inventoryOps.errors.selectBothLocations') || 'Select both locations',
    invalidTransferTitle: t('inventoryOps.errors.invalidTransfer') || 'Invalid transfer',
    invalidTransferBody: t('inventoryOps.errors.invalidTransferBody') || 'From and To locations must be different',
    insufficientStockTitle: t('inventoryOps.errors.insufficientStock') || 'Insufficient stock',
    insufficientStockBody: t('inventoryOps.errors.insufficientStockBody') || 'This would make stock negative. Adjust stock or enable negative stock for this operation.',
    unknownError: 'Unknown error',
  };
}

function buildReceivePage({ entity, entityName, invCfg, entityLocationField, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const c = _commonInvLabels(language);
  const TITLE = t('inventoryOps.receive.title');
  const SUBTITLE = t('inventoryOps.receive.subtitle');
  const SUBMIT = t('inventoryOps.receive.submit');
  const SUCCESS = t('inventoryOps.receive.successToast');
  const FAILED = t('inventoryOps.receive.failureToast');
  const I18N_JSON = JSON.stringify({ ...c, title: TITLE, subtitle: SUBTITLE, submit: SUBMIT, successToast: SUCCESS, failureToast: FAILED }, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;
const I18N = ${I18N_JSON} as const;

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
      toast({ title: I18N.selectItemTitle, variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: I18N.qtyMustBePositive, variant: 'warning' });
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
        toast({ title: I18N.successToast, variant: 'success' });
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

      toast({ title: I18N.successToast, variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: I18N.failureToast, description: err?.response?.data?.error || err?.message || I18N.unknownError, variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">{I18N.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          {I18N.back}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.item}</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">{I18N.selectPlaceholder}</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        {locations.length ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.locationOptional}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">{I18N.selectPlaceholder}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.quantity}</label>
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
            {I18N.cancel}
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {I18N.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildIssuePage({ entity, entityName, invCfg, entityLocationField, issueLabel, escapeJsString, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const c = _commonInvLabels(language);
  const I18N_JSON = JSON.stringify({
    ...c,
    title: t('inventoryOps.issue.title'),
    subtitle: t('inventoryOps.issue.subtitle'),
    submit: t('inventoryOps.issue.submit'),
    successToast: t('inventoryOps.issue.successToast'),
    failureToast: t('inventoryOps.issue.failureToast'),
  }, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;
const ISSUE_LABEL = '${escapeJsString(issueLabel || 'Sell')}' as const;
const I18N = ${I18N_JSON} as const;

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
      toast({ title: I18N.selectItemTitle, variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: I18N.qtyMustBePositive, variant: 'warning' });
      return;
    }

    const current = Number(selectedItem?.[INV.quantity_field] ?? 0) || 0;
    const nextQty = current - quantity;
    if (!(INV.issue && INV.issue.allow_negative_stock) && nextQty < 0) {
      toast({
        title: I18N.insufficientStockTitle,
        description: I18N.insufficientStockBody,
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
        toast({ title: I18N.successToast, variant: 'success' });
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

      toast({ title: I18N.successToast, variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: I18N.failureToast, description: err?.response?.data?.error || err?.message || I18N.unknownError, variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">{I18N.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{ISSUE_LABEL}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          {I18N.back}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.item}</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">{I18N.selectPlaceholder}</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        {locations.length ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.locationOptional}</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">{I18N.selectPlaceholder}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.quantity}</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.movementDate}</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.referenceNumber}</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.note}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            {I18N.cancel}
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

function buildAdjustPage({ entity, entityName, invCfg, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const c = _commonInvLabels(language);
  const I18N_JSON = JSON.stringify({
    ...c,
    title: t('inventoryOps.adjust.title'),
    subtitle: t('inventoryOps.adjust.subtitle'),
    submit: t('inventoryOps.adjust.submit'),
    successToast: t('inventoryOps.adjust.successToast'),
    failureToast: t('inventoryOps.adjust.failureToast'),
    qtyChangeExample: t('inventoryOps.adjust.qtyChangeExample') || 'Example: -5 (shrinkage), +10 (found stock)',
  }, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const I18N = ${I18N_JSON} as const;

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
      toast({ title: I18N.selectItemTitle, variant: 'warning' });
      return;
    }
    if (!Number.isFinite(qtyChange) || qtyChange === 0) {
      toast({ title: I18N.qtyChangeNonZero, description: I18N.qtyChangeHint, variant: 'warning' });
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
        toast({ title: I18N.successToast, variant: 'success' });
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

      toast({ title: I18N.successToast, variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: I18N.failureToast, description: err?.response?.data?.error || err?.message || I18N.unknownError, variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">{I18N.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          {I18N.back}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.item}</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">{I18N.selectPlaceholder}</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.quantityChange}</label>
            <input type="number" value={qtyChange} onChange={(e) => setQtyChange(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
            <div className="mt-1 text-xs text-slate-500">{I18N.qtyChangeExample}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.movementDate}</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.reasonCode}</label>
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} className="w-full rounded border px-3 py-2">
              {(INV.adjust.reason_codes || []).map((rc) => (
                <option key={rc} value={rc}>{rc}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.note}</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            {I18N.cancel}
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {I18N.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function buildTransferPage({ entity, entityName, invCfg, entityLocationField, importBase, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const c = _commonInvLabels(language);
  const I18N_JSON = JSON.stringify({
    ...c,
    title: t('inventoryOps.transfer.title'),
    subtitle: t('inventoryOps.transfer.subtitle'),
    submit: t('inventoryOps.transfer.submit'),
    successToast: t('inventoryOps.transfer.successToast'),
    failureToast: t('inventoryOps.transfer.failureToast'),
  }, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '${base}/services/api';
import { ENTITIES } from '${base}/config/entities';
import { useToast } from '${base}/components/ui/toast';

const INV = ${JSON.stringify(invCfg, null, 2)} as const;
const ENTITY_SLUG = '${entity.slug}' as const;
const ENTITY_LOCATION_FIELD = ${entityLocationField ? `'${entityLocationField}'` : 'null'} as any;
const I18N = ${I18N_JSON} as const;

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
      toast({ title: I18N.selectItemTitle, variant: 'warning' });
      return;
    }
    if (!fromLocationId || !toLocationId) {
      toast({ title: I18N.selectBothLocations, variant: 'warning' });
      return;
    }
    if (String(fromLocationId) === String(toLocationId)) {
      toast({ title: I18N.invalidTransferTitle, description: I18N.invalidTransferBody, variant: 'warning' });
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({ title: I18N.qtyMustBePositive, variant: 'warning' });
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
        toast({ title: I18N.successToast, variant: 'success' });
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

      toast({ title: I18N.successToast, variant: 'success' });
      navigate('/' + ENTITY_SLUG);
    } catch (err: any) {
      toast({ title: I18N.failureToast, description: err?.response?.data?.error || err?.message || I18N.unknownError, variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">{I18N.loading}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          {I18N.back}
        </Link>
      </div>

      <div className="rounded-lg bg-white p-6 shadow space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.item}</label>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="w-full rounded border px-3 py-2">
            <option value="">{I18N.selectPlaceholder}</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>{getEntityDisplay(ENTITY_SLUG, it)}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.fromLocation}</label>
            <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">{I18N.selectPlaceholder}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.toLocation}</label>
            <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} className="w-full rounded border px-3 py-2">
              <option value="">{I18N.selectPlaceholder}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{getEntityDisplay(INV.location_entity, l)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.quantity}</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.valueAsNumber)} className="w-full rounded border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.movementDate}</label>
            <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">{I18N.note}</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>

        <div className="flex justify-end gap-2 no-print">
          <button type="button" onClick={() => navigate('/' + ENTITY_SLUG)} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            {I18N.cancel}
          </button>
          <button type="button" onClick={submit} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            {I18N.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

module.exports = { buildReceivePage, buildIssuePage, buildAdjustPage, buildTransferPage };
