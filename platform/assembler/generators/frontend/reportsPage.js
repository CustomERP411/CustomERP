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

type ReportRow = {
  id: string;
  report_date?: string;
  report_type?: string;
  generated_at?: string;
  data?: string;
  created_at?: string;
};

const ENTITY_NAME_BY_SLUG: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayName])
) as Record<string, string>;

const toNumber = (v: any): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const normalized = s.replace(/,/g, '.');
  const n = Number(normalized);
  if (Number.isFinite(n)) return n;
  const pf = parseFloat(normalized);
  return Number.isFinite(pf) ? pf : null;
};

const isEqual = (a: any, b: any) => {
  // Numeric equality (tolerant of "1" vs 1)
  const an = toNumber(a);
  const bn = toNumber(b);
  if (an !== null && bn !== null) return an === bn;
  return String(a ?? '') === String(b ?? '');
};

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [focusEntity, setFocusEntity] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

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

  const reportRows = useMemo(() => {
    // Only keep the configured report_type (if present)
    const wantType = String(SCHEDULED_REPORTS.report_type || '');
    const filtered = rows.filter((r) => !wantType || String(r.report_type || '') === wantType);
    return filtered.slice().sort((a, b) => String(a.report_date || '').localeCompare(String(b.report_date || '')));
  }, [rows]);

  const availableDates = useMemo(() => {
    return Array.from(new Set(reportRows.map((r) => String(r.report_date || '')).filter(Boolean))).sort();
  }, [reportRows]);

  const rowByDate = useMemo(() => {
    const map: Record<string, ReportRow> = {};
    for (const r of reportRows) {
      const d = String(r.report_date || '');
      if (!d) continue;
      map[d] = r;
    }
    return map;
  }, [reportRows]);

  useEffect(() => {
    if (availableDates.length === 0) return;
    if (!toDate) setToDate(availableDates[availableDates.length - 1]);
    if (!fromDate) {
      const idx = Math.max(0, availableDates.length - 2);
      setFromDate(availableDates[idx]);
    }
  }, [availableDates.join('|')]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) setToDate(fromDate);
  }, [fromDate, toDate]);

  const parseData = (r: ReportRow | undefined): any | null => {
    if (!r?.data) return null;
    try {
      return JSON.parse(String(r.data));
    } catch {
      return null;
    }
  };

  const fromRow = rowByDate[fromDate];
  const toRow = rowByDate[toDate];
  const fromData = useMemo(() => parseData(fromRow), [fromRow?.id]);
  const toData = useMemo(() => parseData(toRow), [toRow?.id]);

  const snapshotEntities = useMemo(() => {
    const a = fromData?.entity_snapshots || {};
    const b = toData?.entity_snapshots || {};
    const slugs = Array.from(new Set([...Object.keys(a), ...Object.keys(b)]));
    return slugs.sort();
  }, [fromRow?.id, toRow?.id]);

  useEffect(() => {
    if (!focusEntity && snapshotEntities.length) {
      setFocusEntity(snapshotEntities[0]);
    }
  }, [focusEntity, snapshotEntities.join('|')]);

  const availableFields = useMemo(() => {
    const a = fromData?.entity_snapshots?.[focusEntity] || null;
    const b = toData?.entity_snapshots?.[focusEntity] || null;
    const fields = Array.from(new Set([...(a?.fields || []), ...(b?.fields || [])].map(String))).filter(Boolean);
    return fields;
  }, [focusEntity, fromRow?.id, toRow?.id]);

  useEffect(() => {
    if (availableFields.length && selectedFields.length === 0) {
      setSelectedFields(availableFields.slice(0, 6));
    }
  }, [availableFields.join('|')]);

  const diff = useMemo(() => {
    const aSnap = fromData?.entity_snapshots?.[focusEntity];
    const bSnap = toData?.entity_snapshots?.[focusEntity];
    const aItems = Array.isArray(aSnap?.items) ? aSnap.items : [];
    const bItems = Array.isArray(bSnap?.items) ? bSnap.items : [];

    const aMap = new Map<string, any>();
    const bMap = new Map<string, any>();

    for (const it of aItems) {
      const id = String(it?.id ?? '');
      if (!id) continue;
      aMap.set(id, it);
    }
    for (const it of bItems) {
      const id = String(it?.id ?? '');
      if (!id) continue;
      bMap.set(id, it);
    }

    const added: any[] = [];
    const removed: any[] = [];
    const changed: any[] = [];

    for (const [id, bIt] of bMap.entries()) {
      if (!aMap.has(id)) {
        added.push(bIt);
      }
    }
    for (const [id, aIt] of aMap.entries()) {
      if (!bMap.has(id)) {
        removed.push(aIt);
      }
    }
    for (const [id, aIt] of aMap.entries()) {
      const bIt = bMap.get(id);
      if (!bIt) continue;
      const fields = selectedFields.length ? selectedFields : availableFields;
      let hasChange = false;
      const fieldDiffs: Record<string, { from: any; to: any; delta?: number | null }> = {};
      for (const f of fields) {
        const av = aIt?.[f];
        const bv = bIt?.[f];
        if (!isEqual(av, bv)) {
          hasChange = true;
          const an = toNumber(av);
          const bn = toNumber(bv);
          fieldDiffs[f] = {
            from: av,
            to: bv,
            delta: an !== null && bn !== null ? (bn - an) : null,
          };
        }
      }
      if (hasChange) {
        changed.push({
          id,
          display: bIt?.display ?? aIt?.display ?? id,
          diffs: fieldDiffs,
          from: aIt,
          to: bIt,
        });
      }
    }

    changed.sort((x, y) => String(x.display || '').localeCompare(String(y.display || ''), undefined, { numeric: true, sensitivity: 'base' }));
    return { added, removed, changed, fromCount: aMap.size, toCount: bMap.size };
  }, [fromRow?.id, toRow?.id, focusEntity, selectedFields.join('|'), availableFields.join('|')]);

  const focusEntityLabel = useMemo(() => {
    if (!focusEntity) return '';
    return ENTITY_NAME_BY_SLUG[focusEntity] ? (ENTITY_NAME_BY_SLUG[focusEntity] + ' (' + focusEntity + ')') : focusEntity;
  }, [focusEntity]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-600">Compare two dates to see what changed.</p>
        </div>
        <Link to="/" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading...</div>
      ) : availableDates.length === 0 ? (
        <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
          No report snapshots yet. The backend creates one on startup and on the cron schedule ({SCHEDULED_REPORTS.cron}).
        </div>
      ) : (
        <div className="space-y-4">
          <div className="no-print grid grid-cols-1 gap-3 rounded-xl border bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">From date</div>
              <select value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                {availableDates.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">To date</div>
              <select value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                {availableDates.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focus entity</div>
              <select value={focusEntity} onChange={(e) => { setFocusEntity(e.target.value); setSelectedFields([]); }} className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
                {snapshotEntities.map((s) => (
                  <option key={s} value={s}>{ENTITY_NAME_BY_SLUG[s] ? (ENTITY_NAME_BY_SLUG[s] + ' (' + s + ')') : s}</option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">
                Snapshots must include this entity via <code>modules.scheduled_reports.entity_snapshots</code>.
              </div>
            </div>
          </div>

          {snapshotEntities.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">
              This report config does not include any entity snapshots. Add <code>modules.scheduled_reports.entity_snapshots</code> to enable entity diff reports.
            </div>
          ) : !focusEntity ? null : (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Changes — {focusEntityLabel}</div>
                  <div className="text-xs text-slate-500">
                    from {fromDate || '—'} to {toDate || '—'}
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {availableFields.length} field(s) available
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-4">
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Added</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{String(diff.added.length)}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Removed</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{String(diff.removed.length)}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Changed</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{String(diff.changed.length)}</div>
                </div>
                <div className="rounded-lg border bg-slate-50 p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Count Δ</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{String(diff.toCount - diff.fromCount)}</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-900">Fields to compare</div>
                {availableFields.length === 0 ? (
                  <div className="mt-1 text-sm text-slate-600">No fields configured for this snapshot.</div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableFields.map((f) => {
                      const checked = selectedFields.includes(f);
                      return (
                        <label key={f} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedFields((prev) => checked ? prev.filter((x) => x !== f) : [...prev, f].slice(0, 10));
                            }}
                          />
                          <span className="font-medium text-slate-800">{f}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="mt-1 text-xs text-slate-500">Tip: keep it to ~5–10 fields for readability.</div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-900">Changed records (preview)</div>
                {diff.changed.length === 0 ? (
                  <div className="mt-2 text-sm text-slate-600">No changes for the selected fields.</div>
                ) : (
                  <div className="mt-2 overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="py-2 pr-4 text-left">Item</th>
                          <th className="py-2 pr-4 text-left">ID</th>
                          {(selectedFields.length ? selectedFields : availableFields).slice(0, 6).map((f) => (
                            <th key={f} className="py-2 pr-4 text-left">{f}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {diff.changed.slice(0, 25).map((r: any) => (
                          <tr key={String(r.id)}>
                            <td className="py-2 pr-4 font-medium text-slate-900">{String(r.display ?? r.id)}</td>
                            <td className="py-2 pr-4 text-slate-600">{String(r.id)}</td>
                            {(selectedFields.length ? selectedFields : availableFields).slice(0, 6).map((f) => {
                              const d = r.diffs?.[f];
                              if (!d) return <td key={f} className="py-2 pr-4 text-slate-400">—</td>;
                              const delta = d.delta;
                              return (
                                <td key={f} className="py-2 pr-4">
                                  <div className="text-slate-700">
                                    <span className="font-semibold">{String(d.from ?? '')}</span> → <span className="font-semibold">{String(d.to ?? '')}</span>
                                  </div>
                                  {typeof delta === 'number' ? (
                                    <div className={'text-xs ' + (delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-700' : 'text-slate-500')}>
                                      Δ {String(delta)}
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {diff.changed.length > 25 ? (
                      <div className="mt-2 text-xs text-slate-500">Showing 25 of {diff.changed.length} changed records.</div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
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


