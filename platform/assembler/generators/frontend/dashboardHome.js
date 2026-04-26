const { tFor } = require('../../i18n/labels');

function buildDashboardHome({ activityCfg, rbac, language = 'en' }) {
  const t = tFor(language);

  const I18N = {
    greetingDefault: t('dashboard.greetingDefault'),
    greetingWithName: t('dashboard.greetingWithName'),
    recordsLabel: t('dashboard.recordsLabel'),
    totalRecordsLine: t('dashboard.totalRecordsLine'),
    loading: t('dashboard.activity.loading'),
    emptyAccessTitle: t('dashboard.emptyAccess.title'),
    emptyAccessBody: t('dashboard.emptyAccess.body'),
    graphTitle: t('dashboard.graph.title'),
    graphSubtitle: t('dashboard.graph.subtitle'),
    graphEntity: t('dashboard.graph.entity'),
    graphMetric: t('dashboard.graph.metric'),
    graphStartDate: t('dashboard.graph.startDate'),
    graphEndDate: t('dashboard.graph.endDate'),
    graphCountMetric: t('dashboard.graph.countMetric'),
    graphCurrentValue: t('dashboard.graph.currentValue'),
    graphChangesInRange: t('dashboard.graph.changesInRange'),
    graphNoData: t('dashboard.graph.noData'),
    graphSelectEntity: t('dashboard.graph.selectEntity'),
    graphTotal: t('dashboard.graph.total'),
  };

  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ENTITIES } from '../config/entities';
${rbac ? `import { useAuth } from '../contexts/AuthContext';\n` : ''}
const ACTIVITY = ${JSON.stringify(activityCfg, null, 2)} as const;
const RBAC_ENABLED = ${rbac ? 'true' : 'false'} as const;
const I18N = ${JSON.stringify(I18N, null, 2)} as const;

type EntityItem = typeof ENTITIES[number];
type ChartPoint = { label: string; value: number };
type GraphPrefs = {
  entity?: string;
  metric?: string;
  startDate?: string;
  endDate?: string;
};
type DashboardPrefs = GraphPrefs & { graph?: GraphPrefs };

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const interpolate = (tpl: string, vars: Record<string, string | number>): string => {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split('{{' + k + '}}').join(String(v));
  return out;
};

const toInputDate = (date: Date) => date.toISOString().slice(0, 10);
const todayInput = () => toInputDate(new Date());
const daysAgoInput = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toInputDate(d);
};

const toNumber = (value: any): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).trim().replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
};

const rowTime = (row: any): number => {
  const t = new Date(String(row?.at || row?.created_at || row?.updated_at || '')).getTime();
  return Number.isFinite(t) ? t : 0;
};

const parseMeta = (row: any): Record<string, any> => {
  const raw = row?.meta;
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const isNumericField = (field: { name: string; type?: string }) => {
  const type = String(field.type || '').toLowerCase();
  const name = String(field.name || '').toLowerCase();
  if (['number', 'integer', 'int', 'float', 'double', 'decimal', 'currency', 'money'].includes(type)) return true;
  return /(amount|balance|cost|price|qty|quantity|total|rate|value|count|hours|days)/.test(name);
};

const metricLabel = (entity: EntityItem | undefined, metric: string) => {
  if (metric === 'count') return I18N.graphCountMetric;
  return entity?.fields?.find((field) => field.name === metric)?.label || metric.replace(/_/g, ' ');
};

const buildBuckets = (startDate: string, endDate: string) => {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  const startTs = start.getTime();
  const endTs = end.getTime();
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs < startTs) return [];
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.ceil((endTs - startTs) / dayMs) + 1);
  const bucketCount = Math.min(60, days);
  const step = Math.max(dayMs, Math.ceil((endTs - startTs + 1) / bucketCount));
  const buckets: Array<{ end: number; label: string }> = [];
  for (let i = 0; i < bucketCount; i += 1) {
    const bucketEnd = i === bucketCount - 1 ? endTs : Math.min(endTs, startTs + step * (i + 1) - 1);
    buckets.push({ end: bucketEnd, label: DATE_FORMATTER.format(new Date(bucketEnd)) });
  }
  return buckets;
};

function buildSeries(rows: any[], entitySlug: string, metric: string, startDate: string, endDate: string): ChartPoint[] {
  const buckets = buildBuckets(startDate, endDate);
  if (!entitySlug || buckets.length === 0) return [];
  const relevant = rows
    .filter((row) => String(row?.entity || '') === entitySlug)
    .filter((row) => rowTime(row) > 0 && rowTime(row) <= buckets[buckets.length - 1].end)
    .sort((a, b) => rowTime(a) - rowTime(b));

  const active = new Set<string>();
  const values = new Map<string, number>();
  let pointer = 0;

  return buckets.map((bucket) => {
    while (pointer < relevant.length && rowTime(relevant[pointer]) <= bucket.end) {
      const row = relevant[pointer];
      const id = String(row?.entity_id || parseMeta(row).id || '');
      const action = String(row?.action || '').toUpperCase();
      if (id) {
        if (action === 'DELETE') {
          active.delete(id);
          values.delete(id);
        } else if (action === 'CREATE') {
          active.add(id);
        }
        if (metric !== 'count' && action !== 'DELETE') {
          const meta = parseMeta(row);
          const n = toNumber(meta[metric]);
          if (n !== null) values.set(id, n);
        }
      }
      pointer += 1;
    }
    const value = metric === 'count'
      ? active.size
      : Array.from(values.values()).reduce((sum, n) => sum + n, 0);
    return { label: bucket.label, value };
  });
}

function LineChart({ points }: { points: ChartPoint[] }) {
  const width = 720;
  const height = 260;
  const padding = 28;
  const max = Math.max(1, ...points.map((point) => point.value));
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const coords = points.map((point, index) => {
    const x = padding + (points.length <= 1 ? plotWidth : (index / (points.length - 1)) * plotWidth);
    const y = padding + plotHeight - (point.value / max) * plotHeight;
    return { ...point, x, y };
  });
  const line = coords.map((point) => String(point.x) + ',' + String(point.y)).join(' ');
  const area = coords.length ? String(padding) + ',' + String(height - padding) + ' ' + line + ' ' + String(width - padding) + ',' + String(height - padding) : '';
  const tickIndexes = Array.from(new Set([0, Math.floor((coords.length - 1) / 2), coords.length - 1])).filter((i) => i >= 0 && coords[i]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
      <svg viewBox={'0 0 ' + width + ' ' + height} className="h-72 w-full" role="img" aria-label={I18N.graphTitle}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" strokeWidth="1" />
        {area ? <polygon points={area} fill="#dbeafe" opacity="0.8" /> : null}
        {line ? <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /> : null}
        {coords.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r="4" fill="#1d4ed8" />
            {index === coords.length - 1 ? <text x={point.x} y={Math.max(14, point.y - 10)} textAnchor="middle" className="fill-slate-700 text-xs font-semibold">{point.value.toLocaleString()}</text> : null}
          </g>
        ))}
        {tickIndexes.map((index) => (
          <text key={index} x={coords[index].x} y={height - 6} textAnchor="middle" className="fill-slate-500 text-xs">{coords[index].label}</text>
        ))}
        <text x={8} y={padding + 4} className="fill-slate-500 text-xs">{max.toLocaleString()}</text>
        <text x={12} y={height - padding - 4} className="fill-slate-500 text-xs">0</text>
      </svg>
    </div>
  );
}

export default function DashboardHome() {
${rbac
  ? `  const { user, isSuperadmin, hasPermission } = useAuth();
  const greeting = user?.display_name
    ? interpolate(I18N.greetingWithName, { name: user.display_name.split(' ')[0] })
    : I18N.greetingDefault;
  const canRead = (slug: string) => isSuperadmin || hasPermission(slug + '.read');\n`
  : `  const greeting = I18N.greetingDefault;
  const canRead = (_slug: string) => true;\n`}
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedMetric, setSelectedMetric] = useState('count');
  const [startDate, setStartDate] = useState(() => daysAgoInput(30));
  const [endDate, setEndDate] = useState(() => todayInput());

  const visibleEntities = useMemo(
    () => ENTITIES.filter((e) => !e.isChild).filter((e) => canRead(e.slug)),
${rbac ? `    [isSuperadmin, hasPermission],` : `    [],`}
  );

  const showActivity = ACTIVITY.enabled && canRead('__audit_logs');

  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      try {
        let raw: DashboardPrefs | null = null;
        if (RBAC_ENABLED) {
          const res = await api.get('/auth/dashboard/preferences');
          raw = (res.data?.config || null) as DashboardPrefs | null;
        } else {
          const stored = window.localStorage.getItem('erp.dashboard.preferences');
          raw = stored ? JSON.parse(stored) : null;
        }
        if (cancelled) return;
        const graph = raw?.graph || raw;
        if (typeof graph?.entity === 'string') setSelectedEntity(graph.entity);
        if (typeof graph?.metric === 'string') setSelectedMetric(graph.metric);
        if (typeof graph?.startDate === 'string') setStartDate(graph.startDate);
        if (typeof graph?.endDate === 'string') setEndDate(graph.endDate);
      } catch {
        // Preferences are optional; defaults are good enough if loading fails.
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    };
    loadPrefs();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visibleEntities.length) {
      setSelectedEntity('');
      return;
    }
    if (!visibleEntities.some((entity) => entity.slug === selectedEntity)) {
      setSelectedEntity(visibleEntities[0].slug);
      setSelectedMetric('count');
    }
  }, [visibleEntities, selectedEntity]);

  useEffect(() => {
    if (!prefsLoaded) return;
    const prefs = {
      graph: {
        entity: selectedEntity,
        metric: selectedMetric,
        startDate,
        endDate,
      },
    };
    const timer = window.setTimeout(() => {
      if (RBAC_ENABLED) {
        api.put('/auth/dashboard/preferences', { config: prefs }).catch(() => undefined);
      } else {
        window.localStorage.setItem('erp.dashboard.preferences', JSON.stringify(prefs));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [prefsLoaded, selectedEntity, selectedMetric, startDate, endDate]);

  useEffect(() => {
    const run = async () => {
      setLoadingCounts(true);
      try {
        const entries = await Promise.all(
          visibleEntities.map(async (entity) => {
            try {
              const res = await api.get('/' + entity.slug);
              return [entity.slug, Array.isArray(res.data) ? res.data.length : 0] as const;
            } catch {
              return [entity.slug, 0] as const;
            }
          })
        );
        setCounts(Object.fromEntries(entries));
      } finally {
        setLoadingCounts(false);
      }
    };
    run();
  }, [visibleEntities]);

  useEffect(() => {
    if (!showActivity) {
      setAuditItems([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoadingAudit(true);
      try {
        const res = await api.get('/__audit_logs');
        const rows = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setAuditItems(rows.filter((row: any) => !row?.entity || canRead(String(row.entity))));
      } finally {
        if (!cancelled) setLoadingAudit(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [showActivity]);

  const selectedEntityInfo = visibleEntities.find((entity) => entity.slug === selectedEntity);
  const numericFields = (selectedEntityInfo?.fields || []).filter(isNumericField);
  const metricOptions = [{ name: 'count', label: I18N.graphCountMetric }, ...numericFields.map((field) => ({ name: field.name, label: field.label }))];

  useEffect(() => {
    if (!metricOptions.some((option) => option.name === selectedMetric)) setSelectedMetric('count');
  }, [selectedEntity, selectedMetric, metricOptions.length]);

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const totalRecordsLine = interpolate(I18N.totalRecordsLine, { total: totalRecords.toLocaleString(), count: visibleEntities.length });
  const series = useMemo(
    () => buildSeries(auditItems, selectedEntity, selectedMetric, startDate, endDate),
    [auditItems, selectedEntity, selectedMetric, startDate, endDate]
  );
  const currentValue = series.length ? series[series.length - 1].value : 0;
  const changesInRange = auditItems.filter((row) => {
    const t = rowTime(row);
    const start = new Date(startDate + 'T00:00:00').getTime();
    const end = new Date(endDate + 'T23:59:59').getTime();
    return String(row?.entity || '') === selectedEntity && t >= start && t <= end;
  }).length;
  const hasGraphData = series.some((point) => point.value !== 0) || changesInRange > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{greeting}</h1>
          {!loadingCounts && <p className="mt-0.5 text-sm text-slate-500">{totalRecordsLine}</p>}
        </div>
      </div>

      {visibleEntities.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{I18N.emptyAccessTitle}</div>
          <p className="mt-1 text-sm text-slate-500">{I18N.emptyAccessBody}</p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {visibleEntities.map((entity) => (
              <Link key={entity.slug} to={'/' + entity.slug} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="text-sm font-semibold text-slate-900">{entity.displayName}</div>
                <div className="mt-4 text-3xl font-bold text-slate-950">{loadingCounts ? '...' : (counts[entity.slug] || 0).toLocaleString()}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{I18N.recordsLabel}</div>
              </Link>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{I18N.graphTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">{I18N.graphSubtitle}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-medium text-slate-500">
                  {I18N.graphEntity}
                  <select value={selectedEntity} onChange={(e) => { setSelectedEntity(e.target.value); setSelectedMetric('count'); }} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900">
                    {visibleEntities.map((entity) => <option key={entity.slug} value={entity.slug}>{entity.displayName}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500">
                  {I18N.graphMetric}
                  <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900">
                    {metricOptions.map((option) => <option key={option.name} value={option.name}>{option.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-500">
                  {I18N.graphStartDate}
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900" />
                </label>
                <label className="text-xs font-medium text-slate-500">
                  {I18N.graphEndDate}
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900" />
                </label>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-500">{I18N.graphCurrentValue}</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{loadingAudit ? '...' : currentValue.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-500">{I18N.graphMetric}</div>
                <div className="mt-1 text-base font-semibold text-slate-950">{metricLabel(selectedEntityInfo, selectedMetric)}</div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-xs font-medium text-slate-500">{I18N.graphChangesInRange}</div>
                <div className="mt-1 text-2xl font-bold text-slate-950">{loadingAudit ? '...' : changesInRange.toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-5">
              {loadingAudit ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">{I18N.loading}</div>
              ) : hasGraphData ? (
                <LineChart points={series} />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">{showActivity ? I18N.graphNoData : I18N.graphSelectEntity}</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
`;
}

module.exports = {
  buildDashboardHome,
};
