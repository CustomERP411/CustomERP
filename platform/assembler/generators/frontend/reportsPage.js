function buildReportsPage({ scheduledCfg }) {
  const cfg = scheduledCfg || {};
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ENTITIES } from '../config/entities';

const SCHEDULED_REPORTS = ${JSON.stringify(
    {
      enabled: cfg.enabled === true,
      cron: cfg.cron || '0 0 * * *',
      target_slug: cfg.target_slug || '__reports',
      report_type: cfg.report_type || 'daily_summary',
    },
    null,
    2
  )} as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

type ReportRow = {
  id: string;
  report_date?: string;
  report_type?: string;
  generated_at?: string;
  data?: string;
  created_at?: string;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showRaw, setShowRaw] = useState(false);
  const [refMaps, setRefMaps] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/' + SCHEDULED_REPORTS.target_slug);
        setRows(Array.isArray(res.data) ? res.data : []);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const sorted = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => {
        const ad = String(a.report_date || '');
        const bd = String(b.report_date || '');
        if (ad !== bd) return bd.localeCompare(ad);
        return String(b.generated_at || b.created_at || '').localeCompare(String(a.generated_at || a.created_at || ''));
      });
  }, [rows]);

  useEffect(() => {
    if (!selectedId && sorted[0]?.id) {
      setSelectedId(String(sorted[0].id));
    }
  }, [selectedId, sorted]);

  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return sorted.find((r) => String(r.id) === String(selectedId)) || null;
  }, [sorted, selectedId]);

  const parsed = useMemo(() => {
    if (!selectedRow?.data) return null;
    try {
      return JSON.parse(String(selectedRow.data));
    } catch {
      return null;
    }
  }, [selectedRow?.data]);

  const referenceSlugs = useMemo(() => {
    const slugs: string[] = [];
    if (parsed?.low_stock?.entity) slugs.push(String(parsed.low_stock.entity));
    if (parsed?.inventory_value?.entity) slugs.push(String(parsed.inventory_value.entity));
    // Best-effort location labels for movements
    const locEntity = String(parsed?.movements?.location_entity || parsed?.movements?.locationEntity || 'locations');
    if (parsed?.movements?.recent?.some?.((m: any) => m?.location_id)) slugs.push(locEntity);
    return Array.from(new Set(slugs.filter(Boolean)));
  }, [selectedRow?.id]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (referenceSlugs.length === 0) return;
      const entries = await Promise.all(
        referenceSlugs.map(async (slug) => {
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
      if (cancelled) return;
      setRefMaps(Object.fromEntries(entries));
    };
    run();
    return () => { cancelled = true; };
  }, [referenceSlugs.join('|')]);

  const displayFromMap = (entitySlug: string, id: any) => {
    const map = refMaps[entitySlug] || {};
    const key = String(id ?? '');
    return map[key] || key;
  };

  const downloadSelectedJson = () => {
    if (!selectedRow?.data) return;
    const blob = new Blob([String(selectedRow.data || '')], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (selectedRow.report_type || 'report') + '_' + (selectedRow.report_date || '') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-600">Daily inventory snapshots (cron: {SCHEDULED_REPORTS.cron})</p>
        </div>
        <Link to="/" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading...</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          No reports yet. The backend will generate reports on startup and on the configured cron schedule.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="no-print flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-slate-900">Select report</div>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="rounded-md border px-3 py-2 text-sm"
              >
                {sorted.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(r.report_date || '') + ' — ' + (r.report_type || '')}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-500">
                generated {String(selectedRow?.generated_at || selectedRow?.created_at || '')}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
              </button>
              <button
                type="button"
                onClick={downloadSelectedJson}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
                disabled={!selectedRow?.data}
              >
                Download JSON
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Low stock</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{String(parsed?.low_stock?.count ?? '—')}</div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Expiry alerts</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{String(parsed?.expiry?.count ?? '—')}</div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Inventory value</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{parsed?.inventory_value ? String(Math.round(Number(parsed.inventory_value.total_value ?? 0) * 100) / 100) : '—'}</div>
              <div className="mt-1 text-xs text-slate-500">
                qty {parsed?.inventory_value ? String(parsed.inventory_value.total_qty ?? 0) : '—'}
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-slate-500">Movements (net)</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{parsed?.movements?.totals ? String(parsed.movements.totals.net_qty ?? 0) : '—'}</div>
              <div className="mt-1 text-xs text-slate-500">
                {parsed?.movements?.lookback_days ? ('last ' + String(parsed.movements.lookback_days) + ' days') : ''}
              </div>
            </div>
          </div>

          {parsed?.inventory_value ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Top inventory value</div>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 text-left">Item</th>
                      <th className="py-2 pr-4 text-right">Qty</th>
                      <th className="py-2 pr-4 text-right">Unit price</th>
                      <th className="py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(parsed.inventory_value.preview || []).map((p: any) => (
                      <tr key={String(p.id)}>
                        <td className="py-2 pr-4">{displayFromMap(String(parsed.inventory_value.entity || ''), p.id)}</td>
                        <td className="py-2 pr-4 text-right">{String(p.quantity ?? '')}</td>
                        <td className="py-2 pr-4 text-right">{String(p.unit_price ?? '')}</td>
                        <td className="py-2 text-right">{String(Math.round(Number(p.value ?? 0) * 100) / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {parsed?.low_stock ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Low stock preview</div>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 text-left">Item</th>
                      <th className="py-2 pr-4 text-right">Qty</th>
                      <th className="py-2 text-right">Reorder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(parsed.low_stock.preview || []).map((p: any) => (
                      <tr key={String(p.id)}>
                        <td className="py-2 pr-4">{displayFromMap(String(parsed.low_stock.entity || ''), p.id)}</td>
                        <td className="py-2 pr-4 text-right">{String(p.quantity ?? '')}</td>
                        <td className="py-2 text-right">{String(p.reorder_point ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {parsed?.expiry ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Expiry preview</div>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 text-left">Item</th>
                      <th className="py-2 text-right">Expiry date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(parsed.expiry.preview || []).map((p: any) => (
                      <tr key={String(p.id)}>
                        <td className="py-2 pr-4">{displayFromMap(String(parsed.expiry.entity || ''), p.id)}</td>
                        <td className="py-2 text-right">{String(p.expiry_date ?? '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {parsed?.movements?.recent ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Recent movements</div>
              <div className="mt-2 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="py-2 pr-4 text-left">At</th>
                      <th className="py-2 pr-4 text-left">Type</th>
                      <th className="py-2 pr-4 text-left">Item</th>
                      <th className="py-2 pr-4 text-left">Location</th>
                      <th className="py-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(parsed.movements.recent || []).map((m: any) => {
                      const itemSlug = String(parsed?.inventory_value?.entity || parsed?.low_stock?.entity || 'products');
                      const locSlug = String(parsed?.movements?.location_entity || parsed?.movements?.locationEntity || 'locations');
                      return (
                        <tr key={String(m.id)}>
                          <td className="py-2 pr-4">{String(m.at ?? '')}</td>
                          <td className="py-2 pr-4">{String(m.type ?? '')}</td>
                          <td className="py-2 pr-4">{m.item_ref ? displayFromMap(itemSlug, m.item_ref) : '—'}</td>
                          <td className="py-2 pr-4">{m.location_id ? displayFromMap(locSlug, m.location_id) : '—'}</td>
                          <td className="py-2 text-right">{String(m.quantity ?? '')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {showRaw ? (
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 overflow-auto">
              <pre className="whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
`;
}

module.exports = {
  buildReportsPage,
};


