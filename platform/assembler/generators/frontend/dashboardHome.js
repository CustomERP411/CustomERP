const { tFor } = require('../../i18n/labels');

function buildDashboardHome({ lowStockCfg, expiryCfg, activityCfg, enableReportsPage, rbac, language = 'en' }) {
  const t = tFor(language);

  const I18N = {
    greetingDefault: t('dashboard.greetingDefault'),
    greetingWithName: t('dashboard.greetingWithName'),
    recordsLabel: t('dashboard.recordsLabel'),
    totalRecordsLine: t('dashboard.totalRecordsLine'),
    lowStockTitle: t('dashboard.lowStock.title'),
    lowStockQty: t('dashboard.lowStock.qtyLabel'),
    lowStockReorder: t('dashboard.lowStock.reorderLabel'),
    expiryTitle: t('dashboard.expiry.title'),
    expiryLabel: t('dashboard.expiry.expiryLabel'),
    expiryDays: t('dashboard.expiry.daysLabel'),
    activityView: t('dashboard.activity.view'),
    activityLoading: t('dashboard.activity.loading'),
    activityReportsHint: t('dashboard.activity.reportsHint'),
    reportsLabel: t('sidebar.tools.reports'),
    emptyAccessTitle: t('dashboard.emptyAccess.title'),
    emptyAccessBody: t('dashboard.emptyAccess.body'),
    saveDashboard: t('dashboard.widgets.save'),
    dashboardSaved: t('dashboard.widgets.saved'),
    range: t('dashboard.widgets.range'),
    recentChanges: t('dashboard.widgets.recentChanges'),
    changedAreas: t('dashboard.widgets.changedAreas'),
    alerts: t('dashboard.widgets.alerts'),
    recordOverview: t('dashboard.widgets.recordOverview'),
    showAs: t('dashboard.widgets.showAs'),
    hidden: t('dashboard.widgets.hidden'),
    cards: t('dashboard.widgets.cards'),
    list: t('dashboard.widgets.list'),
    bars: t('dashboard.widgets.bars'),
    last7: t('dashboard.widgets.last7'),
    last30: t('dashboard.widgets.last30'),
    last90: t('dashboard.widgets.last90'),
    last365: t('dashboard.widgets.last365'),
    allTime: t('dashboard.widgets.allTime'),
    noChanges: t('dashboard.widgets.noChanges'),
    created: t('dashboard.widgets.created'),
    updated: t('dashboard.widgets.updated'),
    deleted: t('dashboard.widgets.deleted'),
    alertsEmpty: t('dashboard.widgets.alertsEmpty'),
    open: t('dashboard.widgets.open'),
  };

  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ENTITIES } from '../config/entities';
${rbac ? `import { useAuth } from '../contexts/AuthContext';\n` : ''}
const LOW_STOCK = ${JSON.stringify(lowStockCfg, null, 2)} as const;
const EXPIRY = ${JSON.stringify(expiryCfg, null, 2)} as const;
const ACTIVITY = ${JSON.stringify(activityCfg, null, 2)} as const;
const ENABLE_REPORTS_PAGE = ${enableReportsPage ? 'true' : 'false'} as const;
const RBAC_ENABLED = ${rbac ? 'true' : 'false'} as const;

const I18N = ${JSON.stringify(I18N, null, 2)} as const;
type WidgetKey = 'recentChanges' | 'changedAreas' | 'alerts' | 'recordOverview';
type WidgetMode = 'hidden' | 'cards' | 'list' | 'bars';
type DashboardRange = '7' | '30' | '90' | '365' | 'all';
type WidgetSetting = { mode: WidgetMode; range?: DashboardRange };
type DashboardConfig = { widgets: Record<WidgetKey, WidgetSetting> };

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: {
    recentChanges: { mode: 'list', range: '7' },
    changedAreas: { mode: 'bars', range: '7' },
    alerts: { mode: 'list' },
    recordOverview: { mode: 'cards' },
  },
};

const RANGES: Array<{ value: DashboardRange; label: string }> = [
  { value: '7', label: I18N.last7 },
  { value: '30', label: I18N.last30 },
  { value: '90', label: I18N.last90 },
  { value: '365', label: I18N.last365 },
  { value: 'all', label: I18N.allTime },
];

const MODES: Array<{ value: WidgetMode; label: string }> = [
  { value: 'hidden', label: I18N.hidden },
  { value: 'cards', label: I18N.cards },
  { value: 'list', label: I18N.list },
  { value: 'bars', label: I18N.bars },
];

const ACTION_LABELS: Record<string, string> = {
  create: I18N.created,
  created: I18N.created,
  update: I18N.updated,
  updated: I18N.updated,
  delete: I18N.deleted,
  deleted: I18N.deleted,
};

const ENTITY_BY_SLUG = Object.fromEntries(ENTITIES.map((e) => [e.slug, e])) as Record<string, typeof ENTITIES[number]>;
const DISPLAY_FIELD_BY_ENTITY = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.displayField])) as Record<string, string>;

const interpolate = (tpl: string, vars: Record<string, string | number>): string => {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) out = out.split('{{' + k + '}}').join(String(v));
  return out;
};

const mergeConfig = (raw: any): DashboardConfig => {
  const oldGlobalRange = ['7', '30', '90', '365', 'all'].includes(String(raw?.range))
    ? String(raw.range) as DashboardRange
    : undefined;
  const widgets = { ...DEFAULT_CONFIG.widgets };
  for (const key of Object.keys(widgets) as WidgetKey[]) {
    const value = raw?.widgets?.[key];
    const base = DEFAULT_CONFIG.widgets[key];
    if (typeof value === 'string' && ['hidden', 'cards', 'list', 'bars'].includes(value)) {
      widgets[key] = { ...base, mode: value as WidgetMode, range: base.range ? (oldGlobalRange || base.range) : undefined };
      continue;
    }
    if (value && typeof value === 'object') {
      const mode = ['hidden', 'cards', 'list', 'bars'].includes(String(value.mode))
        ? String(value.mode) as WidgetMode
        : base.mode;
      const range = ['7', '30', '90', '365', 'all'].includes(String(value.range))
        ? String(value.range) as DashboardRange
        : (base.range ? (oldGlobalRange || base.range) : undefined);
      widgets[key] = { ...base, mode, ...(range ? { range } : {}) };
    } else if (base.range && oldGlobalRange) {
      widgets[key] = { ...base, range: oldGlobalRange };
    }
  }
  return { widgets };
};

const toNumber = (v: any): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || v === undefined) return null;
  const n = Number(String(v).trim().replace(/,/g, '.'));
  return Number.isFinite(n) ? n : null;
};

const rowTime = (row: any): number => {
  const t = new Date(String(row?.at || row?.created_at || row?.updated_at || '')).getTime();
  return Number.isFinite(t) ? t : 0;
};

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.code ?? row?.id;
  return String(v ?? '');
};

const entityName = (slug: string) => ENTITY_BY_SLUG[slug]?.displayName || slug.replace(/_/g, ' ');
const actionName = (action: string) => ACTION_LABELS[String(action || '').toLowerCase()] || String(action || '');

export default function DashboardHome() {
${rbac
  ? `  const { user, isSuperadmin, hasPermission } = useAuth();
  const greeting = user?.display_name
    ? interpolate(I18N.greetingWithName, { name: user.display_name.split(' ')[0] })
    : I18N.greetingDefault;
  const canRead = (slug: string) => isSuperadmin || hasPermission(slug + '.read');\n`
  : `  const greeting = I18N.greetingDefault;
  const canRead = (_slug: string) => true;\n`}
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_CONFIG);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [expiryItems, setExpiryItems] = useState<any[]>([]);
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const visibleEntities = useMemo(
    () => ENTITIES.filter((e) => !e.isChild).filter((e) => canRead(e.slug)),
${rbac ? `    [isSuperadmin, hasPermission],` : `    [],`}
  );

  const showLowStock = LOW_STOCK.enabled && canRead(LOW_STOCK.entity);
  const showExpiry = EXPIRY.enabled && canRead(EXPIRY.entity);
  const showActivity = ACTIVITY.enabled && canRead('__audit_logs');

  useEffect(() => {
    let cancelled = false;
    const loadPrefs = async () => {
      try {
        if (RBAC_ENABLED) {
          const res = await api.get('/auth/dashboard/preferences');
          if (!cancelled) setConfig(mergeConfig(res.data?.config));
        } else {
          const raw = window.localStorage.getItem('erp.dashboard.preferences');
          if (!cancelled) setConfig(mergeConfig(raw ? JSON.parse(raw) : null));
        }
      } catch {
        if (!cancelled) setConfig(DEFAULT_CONFIG);
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    };
    loadPrefs();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoadingCounts(true);
      try {
        const entries = await Promise.all(
          visibleEntities.map(async (e) => {
            const res = await api.get('/' + e.slug);
            return [e.slug, Array.isArray(res.data) ? res.data.length : 0] as const;
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
    const tasks: Promise<any>[] = [];
    if (showLowStock) {
      tasks.push((async () => {
        const res = await api.get('/' + LOW_STOCK.entity);
        const rows = Array.isArray(res.data) ? res.data : [];
        const qf = LOW_STOCK.quantity_field;
        const rf = LOW_STOCK.reorder_point_field;
        setLowStockItems(rows.filter((r: any) => {
          const q = toNumber(r?.[qf]);
          const rp = toNumber(r?.[rf]);
          return q !== null && rp !== null && q <= rp;
        }).sort((a: any, b: any) => (toNumber(a?.[qf]) ?? 0) - (toNumber(b?.[qf]) ?? 0)).slice(0, LOW_STOCK.limit));
      })());
    } else {
      setLowStockItems([]);
    }

    if (showExpiry) {
      tasks.push((async () => {
        const res = await api.get('/' + EXPIRY.entity);
        const rows = Array.isArray(res.data) ? res.data : [];
        const horizon = Date.now() + EXPIRY.within_days * 24 * 60 * 60 * 1000;
        setExpiryItems(rows.filter((r: any) => {
          const t = new Date(String(r?.[EXPIRY.expiry_field] || '')).getTime();
          return Number.isFinite(t) && t <= horizon;
        }).sort((a: any, b: any) => new Date(String(a?.[EXPIRY.expiry_field] || '')).getTime() - new Date(String(b?.[EXPIRY.expiry_field] || '')).getTime()).slice(0, EXPIRY.limit));
      })());
    } else {
      setExpiryItems([]);
    }

    if (showActivity) {
      setLoadingAudit(true);
      tasks.push((async () => {
        const res = await api.get('/__audit_logs');
        const rows = Array.isArray(res.data) ? res.data : [];
        setAuditItems(rows.filter((r: any) => !r?.entity || canRead(String(r.entity))).sort((a: any, b: any) => rowTime(b) - rowTime(a)));
      })().finally(() => setLoadingAudit(false)));
    } else {
      setAuditItems([]);
    }

    Promise.all(tasks).catch(() => undefined);
  }, [showLowStock, showExpiry, showActivity]);

  const auditForRange = (range: DashboardRange = '7') => {
    if (range === 'all') return auditItems;
    const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
    return auditItems.filter((row) => {
      const t = rowTime(row);
      return t > 0 && t >= cutoff;
    });
  };

  const buildChangeStats = (rows: any[]) => {
    const map: Record<string, { entity: string; total: number; create: number; update: number; delete: number }> = {};
    for (const row of rows) {
      const slug = String(row?.entity || 'other');
      const action = String(row?.action || '').toLowerCase();
      if (!map[slug]) map[slug] = { entity: slug, total: 0, create: 0, update: 0, delete: 0 };
      map[slug].total += 1;
      if (action.includes('delete')) map[slug].delete += 1;
      else if (action.includes('update')) map[slug].update += 1;
      else map[slug].create += 1;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  };

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const totalRecordsLine = interpolate(I18N.totalRecordsLine, { total: totalRecords.toLocaleString(), count: visibleEntities.length });

  const alertRows = useMemo(() => {
    const rows: Array<{ key: string; title: string; body: string; href: string }> = [];
    for (const it of lowStockItems) {
      rows.push({
        key: 'low-' + String(it?.id),
        title: I18N.lowStockTitle + ': ' + getEntityDisplay(LOW_STOCK.entity, it),
        body: I18N.lowStockQty + ' ' + String(it?.[LOW_STOCK.quantity_field] ?? 0) + ' · ' + I18N.lowStockReorder + ' ' + String(it?.[LOW_STOCK.reorder_point_field] ?? 0),
        href: '/' + LOW_STOCK.entity,
      });
    }
    for (const it of expiryItems) {
      const t = new Date(String(it?.[EXPIRY.expiry_field] || '')).getTime();
      const days = Number.isFinite(t) ? Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)) : null;
      rows.push({
        key: 'exp-' + String(it?.id),
        title: I18N.expiryTitle + ': ' + getEntityDisplay(EXPIRY.entity, it),
        body: I18N.expiryLabel + ' ' + String(it?.[EXPIRY.expiry_field] ?? '') + ' · ' + I18N.expiryDays + ' ' + (days === null ? '-' : String(days)),
        href: '/' + EXPIRY.entity,
      });
    }
    return rows;
  }, [lowStockItems, expiryItems]);

  const updateWidgetMode = (key: WidgetKey, mode: WidgetMode) => {
    setSaved(false);
    setConfig((c) => ({ ...c, widgets: { ...c.widgets, [key]: { ...c.widgets[key], mode } } }));
  };

  const updateWidgetRange = (key: WidgetKey, range: DashboardRange) => {
    setSaved(false);
    setConfig((c) => ({ ...c, widgets: { ...c.widgets, [key]: { ...c.widgets[key], range } } }));
  };

  const savePrefs = async () => {
    if (RBAC_ENABLED) {
      await api.put('/auth/dashboard/preferences', { config });
    } else {
      window.localStorage.setItem('erp.dashboard.preferences', JSON.stringify(config));
    }
    setSaved(true);
  };

  const renderWidgetFrame = (key: WidgetKey, title: string, children: any, options: { range?: boolean } = {}) => (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="flex flex-wrap items-end gap-2">
          {options.range ? (
            <label className="text-xs text-slate-500">
              {I18N.range}
              <select value={config.widgets[key].range || '7'} onChange={(e) => updateWidgetRange(key, e.target.value as DashboardRange)} className="mt-1 rounded-lg border bg-white px-2 py-1 text-sm text-slate-800">
                {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
          ) : null}
          <label className="text-xs text-slate-500">
            {I18N.showAs}
            <select value={config.widgets[key].mode} onChange={(e) => updateWidgetMode(key, e.target.value as WidgetMode)} className="mt-1 rounded-lg border bg-white px-2 py-1 text-sm text-slate-800">
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </label>
          <button onClick={savePrefs} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">{saved ? I18N.dashboardSaved : I18N.saveDashboard}</button>
        </div>
      </div>
      {children}
    </section>
  );

  const renderBars = (rows: Array<{ key: string; label: string; value: number; href?: string }>) => (
    <div className="space-y-2">
      {rows.map((row) => {
        const localMax = Math.max(1, ...rows.map((r) => r.value || 0));
        return (
        <Link key={row.key} to={row.href || '#'} className="block">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{row.label}</span>
            <span className="font-semibold">{row.value}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: Math.max(4, Math.round((row.value / localMax) * 100)) + '%' }} />
          </div>
        </Link>
        );
      })}
    </div>
  );

  const renderRecordOverview = () => {
    const mode = config.widgets.recordOverview.mode;
    if (visibleEntities.length === 0) return null;
    if (mode === 'hidden') return renderWidgetFrame('recordOverview', I18N.recordOverview, null);
    if (mode === 'bars') {
      return renderWidgetFrame('recordOverview', I18N.recordOverview, renderBars(visibleEntities.map((e) => ({ key: e.slug, label: e.displayName, value: counts[e.slug] || 0, href: '/' + e.slug }))));
    }
    if (mode === 'list') {
      return renderWidgetFrame('recordOverview', I18N.recordOverview, (
        <ul className="divide-y divide-slate-100">
          {visibleEntities.map((e) => (
            <li key={e.slug} className="flex items-center justify-between py-2 text-sm">
              <Link to={'/' + e.slug} className="font-medium text-slate-800 hover:underline">{e.displayName}</Link>
              <span className="text-slate-500">{loadingCounts ? '...' : String(counts[e.slug] || 0)}</span>
            </li>
          ))}
        </ul>
      ));
    }
    return renderWidgetFrame('recordOverview', I18N.recordOverview, (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visibleEntities.map((e) => (
          <Link key={e.slug} to={'/' + e.slug} className="rounded-lg border border-slate-200 p-3 transition hover:shadow-sm">
            <div className="text-sm font-semibold text-slate-900">{e.displayName}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{loadingCounts ? '...' : String(counts[e.slug] || 0)}</div>
            <div className="text-xs text-slate-400">{I18N.recordsLabel}</div>
          </Link>
        ))}
      </div>
    ));
  };

  const renderRecentChanges = () => {
    const mode = config.widgets.recentChanges.mode;
    if (!showActivity) return null;
    if (mode === 'hidden') return renderWidgetFrame('recentChanges', I18N.recentChanges, null, { range: true });
    const filteredAudit = auditForRange(config.widgets.recentChanges.range || '7');
    const top = filteredAudit.slice(0, ACTIVITY.limit || 8);
    if (loadingAudit) return renderWidgetFrame('recentChanges', I18N.recentChanges, <div className="text-sm text-slate-500">{I18N.activityLoading}</div>, { range: true });
    if (!top.length) return renderWidgetFrame('recentChanges', I18N.recentChanges, <div className="text-sm text-slate-500">{I18N.noChanges}</div>, { range: true });
    if (mode === 'bars') {
      const byAction = ['create', 'update', 'delete'].map((action) => ({
        key: action,
        label: ACTION_LABELS[action],
        value: filteredAudit.filter((r) => String(r?.action || '').toLowerCase().includes(action)).length,
      }));
      return renderWidgetFrame('recentChanges', I18N.recentChanges, renderBars(byAction), { range: true });
    }
    if (mode === 'cards') {
      return renderWidgetFrame('recentChanges', I18N.recentChanges, (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {['create', 'update', 'delete'].map((action) => (
            <div key={action} className="rounded-lg border border-slate-200 p-3">
              <div className="text-xs text-slate-500">{ACTION_LABELS[action]}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{filteredAudit.filter((r) => String(r?.action || '').toLowerCase().includes(action)).length}</div>
            </div>
          ))}
        </div>
      ), { range: true });
    }
    return renderWidgetFrame('recentChanges', I18N.recentChanges, (
      <ul className="space-y-2">
        {top.map((it: any) => (
          <li key={it.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{actionName(String(it?.action || ''))} · {entityName(String(it?.entity || ''))}</div>
              <div className="truncate text-xs text-slate-500">{String(it?.message || '')}</div>
            </div>
            <div className="text-right text-xs text-slate-500">{String(it?.at || it?.created_at || '')}</div>
          </li>
        ))}
      </ul>
    ), { range: true });
  };

  const renderChangedAreas = () => {
    const mode = config.widgets.changedAreas.mode;
    if (!showActivity) return null;
    if (mode === 'hidden') return renderWidgetFrame('changedAreas', I18N.changedAreas, null, { range: true });
    const filteredAudit = auditForRange(config.widgets.changedAreas.range || '7');
    const changeStats = buildChangeStats(filteredAudit);
    if (!changeStats.length) return renderWidgetFrame('changedAreas', I18N.changedAreas, <div className="text-sm text-slate-500">{I18N.noChanges}</div>, { range: true });
    if (mode === 'bars') {
      return renderWidgetFrame('changedAreas', I18N.changedAreas, renderBars(changeStats.map((s) => ({ key: s.entity, label: entityName(s.entity), value: s.total, href: '/' + s.entity }))), { range: true });
    }
    if (mode === 'cards') {
      return renderWidgetFrame('changedAreas', I18N.changedAreas, (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {changeStats.map((s) => (
            <Link key={s.entity} to={'/' + s.entity} className="rounded-lg border border-slate-200 p-3 transition hover:shadow-sm">
              <div className="text-sm font-semibold text-slate-900">{entityName(s.entity)}</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">{s.total}</div>
              <div className="text-xs text-slate-500">{I18N.created}: {s.create} · {I18N.updated}: {s.update} · {I18N.deleted}: {s.delete}</div>
            </Link>
          ))}
        </div>
      ), { range: true });
    }
    return renderWidgetFrame('changedAreas', I18N.changedAreas, (
      <ul className="divide-y divide-slate-100">
        {changeStats.map((s) => (
          <li key={s.entity} className="flex items-center justify-between py-2 text-sm">
            <Link to={'/' + s.entity} className="font-medium text-slate-800 hover:underline">{entityName(s.entity)}</Link>
            <span className="text-slate-500">{s.total}</span>
          </li>
        ))}
      </ul>
    ), { range: true });
  };

  const renderAlerts = () => {
    const mode = config.widgets.alerts.mode;
    if (!showLowStock && !showExpiry) return null;
    if (mode === 'hidden') return renderWidgetFrame('alerts', I18N.alerts, null);
    if (!alertRows.length) return renderWidgetFrame('alerts', I18N.alerts, <div className="text-sm text-slate-500">{I18N.alertsEmpty}</div>);
    if (mode === 'cards') {
      return renderWidgetFrame('alerts', I18N.alerts, (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {alertRows.map((row) => (
            <Link key={row.key} to={row.href} className="rounded-lg border border-amber-200 bg-amber-50 p-3 transition hover:shadow-sm">
              <div className="text-sm font-semibold text-amber-900">{row.title}</div>
              <div className="mt-1 text-xs text-amber-800">{row.body}</div>
            </Link>
          ))}
        </div>
      ));
    }
    if (mode === 'bars') {
      const bars: Array<{ key: string; label: string; value: number; href: string }> = [];
      if (showLowStock) bars.push({ key: 'low', label: I18N.lowStockTitle, value: lowStockItems.length, href: '/' + LOW_STOCK.entity });
      if (showExpiry) bars.push({ key: 'expiry', label: I18N.expiryTitle, value: expiryItems.length, href: '/' + EXPIRY.entity });
      return renderWidgetFrame('alerts', I18N.alerts, renderBars(bars));
    }
    return renderWidgetFrame('alerts', I18N.alerts, (
      <ul className="space-y-2">
        {alertRows.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">{row.title}</div>
              <div className="text-xs text-slate-500">{row.body}</div>
            </div>
            <Link to={row.href} className="text-xs font-semibold text-blue-600 hover:underline">{I18N.open}</Link>
          </li>
        ))}
      </ul>
    ));
  };

  if (!prefsLoaded) {
    return <div className="text-sm text-slate-500">{I18N.activityLoading}</div>;
  }

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
          {renderRecentChanges()}
          {renderChangedAreas()}
          {renderAlerts()}
          {renderRecordOverview()}
        </>
      )}

      {ENABLE_REPORTS_PAGE ? (
        <div className="text-xs text-slate-500">
          {I18N.activityReportsHint} <Link to="/reports" className="font-semibold text-blue-600 hover:underline">{I18N.reportsLabel}</Link>.
        </div>
      ) : null}
    </div>
  );
}
`;
}

module.exports = {
  buildDashboardHome,
};
