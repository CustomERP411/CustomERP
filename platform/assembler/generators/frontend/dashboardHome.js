const { tFor, moduleDisplayNames } = require('../../i18n/labels');

function buildDashboardHome({ lowStockCfg, expiryCfg, activityCfg, enableReportsPage, rbac, language = 'en' }) {
  const t = tFor(language);
  const moduleNames = moduleDisplayNames(language);

  // All user-facing strings go through this dictionary so the generated TSX
  // never has to worry about escaping quotes or apostrophes — values are
  // emitted as JSON literals.
  const I18N = {
    greetingDefault: t('dashboard.greetingDefault'),
    greetingWithName: t('dashboard.greetingWithName'),
    recordsLabel: t('dashboard.recordsLabel'),
    totalRecordsLine: t('dashboard.totalRecordsLine'),
    lowStockTitle: t('dashboard.lowStock.title'),
    lowStockSubtitle: t('dashboard.lowStock.subtitle'),
    lowStockEmpty: t('dashboard.lowStock.empty'),
    lowStockQty: t('dashboard.lowStock.qtyLabel'),
    lowStockReorder: t('dashboard.lowStock.reorderLabel'),
    lowStockSuggest: t('dashboard.lowStock.suggestLabel'),
    expiryTitle: t('dashboard.expiry.title'),
    expirySubtitle: t('dashboard.expiry.subtitle'),
    expiryEmpty: t('dashboard.expiry.empty'),
    expiryLabel: t('dashboard.expiry.expiryLabel'),
    expiryDays: t('dashboard.expiry.daysLabel'),
    activityTitle: t('dashboard.activity.title'),
    activitySubtitle: t('dashboard.activity.subtitle'),
    activityView: t('dashboard.activity.view'),
    activityLoading: t('dashboard.activity.loading'),
    activityEmpty: t('dashboard.activity.empty'),
    activityReportsHint: t('dashboard.activity.reportsHint'),
    reportsLabel: t('sidebar.tools.reports'),
    emptyAccessTitle: t('dashboard.emptyAccess.title'),
    emptyAccessBody: t('dashboard.emptyAccess.body'),
  };

  const i18nJson = JSON.stringify(I18N, null, 2);
  const moduleNamesJson = JSON.stringify(moduleNames, null, 2);

  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ENTITIES } from '../config/entities';
import InventoryAlertCard from '../components/modules/inventory/InventoryAlertCard';
${rbac ? `import { useAuth } from '../contexts/AuthContext';\n` : ''}
const LOW_STOCK = ${JSON.stringify(lowStockCfg, null, 2)} as const;
const EXPIRY = ${JSON.stringify(expiryCfg, null, 2)} as const;
const ACTIVITY = ${JSON.stringify(activityCfg, null, 2)} as const;
const ENABLE_REPORTS_PAGE = ${enableReportsPage ? 'true' : 'false'} as const;

const I18N = ${i18nJson} as const;

const MODULE_DISPLAY_NAMES: Record<string, string> = ${moduleNamesJson};

const MODULE_ACCENT: Record<string, string> = {
  inventory: 'border-t-blue-500',
  invoice: 'border-t-emerald-500',
  hr: 'border-t-violet-500',
};

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
};

const interpolate = (tpl: string, vars: Record<string, string | number>): string => {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split('{{' + k + '}}').join(String(v));
  }
  return out;
};

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

  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);

  const [expiryItems, setExpiryItems] = useState<any[]>([]);
  const [loadingExpiry, setLoadingExpiry] = useState(false);

  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const visibleEntities = useMemo(
    () => ENTITIES.filter((e) => !e.isChild).filter((e) => canRead(e.slug)),
${rbac
  ? `    [isSuperadmin, hasPermission],`
  : `    [],`}
  );

  const showLowStock = LOW_STOCK.enabled && canRead(LOW_STOCK.entity);
  const showExpiry = EXPIRY.enabled && canRead(EXPIRY.entity);
  const showActivity = ACTIVITY.enabled && canRead('__audit_logs');
  const showAnyAlerts = showLowStock || showExpiry || showActivity;

  useEffect(() => {
    const run = async () => {
      try {
        const tasks: Promise<any>[] = [];

        tasks.push(
          (async () => {
            const entries = await Promise.all(
              visibleEntities.map(async (e) => {
                const res = await api.get('/' + e.slug);
                return [e.slug, Array.isArray(res.data) ? res.data.length : 0] as const;
              })
            );
            setCounts(Object.fromEntries(entries));
          })()
        );

        if (showLowStock) {
          setLoadingLowStock(true);
          tasks.push(
            (async () => {
              const res = await api.get('/' + LOW_STOCK.entity);
              const rows = Array.isArray(res.data) ? res.data : [];
              const qf = LOW_STOCK.quantity_field;
              const rf = LOW_STOCK.reorder_point_field;
              const low = rows
                .filter((r: any) => {
                  const q = toNumber(r?.[qf]);
                  const rp = toNumber(r?.[rf]);
                  if (q === null || rp === null) return false;
                  return q <= rp;
                })
                .sort((a: any, b: any) => (toNumber(a?.[qf]) ?? 0) - (toNumber(b?.[qf]) ?? 0))
                .slice(0, LOW_STOCK.limit);
              setLowStockItems(low);
            })().finally(() => setLoadingLowStock(false))
          );
        }

        if (showExpiry) {
          setLoadingExpiry(true);
          tasks.push(
            (async () => {
              const res = await api.get('/' + EXPIRY.entity);
              const rows = Array.isArray(res.data) ? res.data : [];
              const ef = EXPIRY.expiry_field;
              const nowT = Date.now();
              const horizon = nowT + EXPIRY.within_days * 24 * 60 * 60 * 1000;
              const exp = rows
                .filter((r: any) => {
                  const t = new Date(String(r?.[ef] || '')).getTime();
                  return Number.isFinite(t) && t <= horizon;
                })
                .sort((a: any, b: any) => new Date(String(a?.[ef] || '')).getTime() - new Date(String(b?.[ef] || '')).getTime())
                .slice(0, EXPIRY.limit);
              setExpiryItems(exp);
            })().finally(() => setLoadingExpiry(false))
          );
        }

        if (showActivity) {
          setLoadingAudit(true);
          tasks.push(
            (async () => {
              const res = await api.get('/__audit_logs');
              const rows = Array.isArray(res.data) ? res.data : [];
              const sorted = rows
                .slice()
                .sort((a: any, b: any) => String(b?.at || b?.created_at || '').localeCompare(String(a?.at || a?.created_at || '')))
                .slice(0, ACTIVITY.limit);
              setAuditItems(sorted);
            })().finally(() => setLoadingAudit(false))
          );
        }

        await Promise.all(tasks);
      } finally {
        setLoadingCounts(false);
      }
    };
    run();
  }, [visibleEntities, showLowStock, showExpiry, showActivity]);

  const reorderSuggestion = useMemo(() => {
    const multiplier = Number(LOW_STOCK.suggestion_multiplier ?? 1);
    const qf = LOW_STOCK.quantity_field;
    const rf = LOW_STOCK.reorder_point_field;
    const map: Record<string, number> = {};
    for (const it of lowStockItems) {
      const q = toNumber(it?.[qf]) ?? 0;
      const rp = toNumber(it?.[rf]) ?? 0;
      const suggested = Math.max(0, Math.ceil((rp - q) * multiplier));
      map[String(it?.id)] = suggested;
    }
    return map;
  }, [lowStockItems]);

  const entityGroups = useMemo(() => {
    const groups: Record<string, typeof ENTITIES> = {};
    for (const e of visibleEntities) {
      const modules = e.module === 'shared' && e.sharedModules?.length
        ? e.sharedModules
        : [e.module || 'inventory'];
      for (const mod of modules) {
        if (!groups[mod]) groups[mod] = [];
        if (!groups[mod].some((x: any) => x.slug === e.slug)) {
          groups[mod].push(e);
        }
      }
    }
    const moduleOrder = ['inventory', 'invoice', 'hr'];
    const ordered = moduleOrder.filter((m) => groups[m] && groups[m].length > 0);
    for (const key of Object.keys(groups)) {
      if (!ordered.includes(key)) ordered.push(key);
    }
    return ordered.map((mod) => ({ mod, entities: groups[mod] }));
  }, [visibleEntities]);

  const totalRecords = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const totalRecordsLine = interpolate(I18N.totalRecordsLine, {
    total: totalRecords.toLocaleString(),
    count: visibleEntities.length,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{greeting}</h1>
          {!loadingCounts && (
            <p className="mt-0.5 text-sm text-slate-500">
              {totalRecordsLine}
            </p>
          )}
        </div>
      </div>

      {visibleEntities.length === 0 ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="text-sm font-semibold text-slate-900">{I18N.emptyAccessTitle}</div>
          <p className="mt-1 text-sm text-slate-500">
            {I18N.emptyAccessBody}
          </p>
        </div>
      ) : entityGroups.length === 1 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {entityGroups[0].entities.map((e) => (
            <Link
              key={e.slug}
              to={'/' + e.slug}
              className={\`rounded-xl border border-t-2 \${MODULE_ACCENT[entityGroups[0].mod] || 'border-t-slate-300'} bg-white p-4 shadow-sm transition hover:shadow\`}
            >
              <div className="text-sm font-semibold text-slate-900">{e.displayName}</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">
                {loadingCounts ? '...' : String(counts[e.slug] ?? 0)}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{I18N.recordsLabel}</div>
            </Link>
          ))}
        </div>
      ) : (
        entityGroups.map(({ mod, entities: modEntities }) => (
          <div key={mod}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {MODULE_DISPLAY_NAMES[mod] || mod}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modEntities.map((e) => (
                <Link
                  key={e.slug}
                  to={'/' + e.slug}
                  className={\`rounded-xl border border-t-2 \${MODULE_ACCENT[mod] || 'border-t-slate-300'} bg-white p-4 shadow-sm transition hover:shadow\`}
                >
                  <div className="text-sm font-semibold text-slate-900">{e.displayName}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {loadingCounts ? '...' : String(counts[e.slug] ?? 0)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400">{I18N.recordsLabel}</div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}

      {showAnyAlerts ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {showLowStock ? (
            <InventoryAlertCard
              title={I18N.lowStockTitle}
              subtitle={interpolate(I18N.lowStockSubtitle, { count: LOW_STOCK.limit })}
              actionHref={'/' + LOW_STOCK.entity}
              loading={loadingLowStock}
              isEmpty={lowStockItems.length === 0}
              emptyLabel={I18N.lowStockEmpty}
            >
              <ul className="space-y-2">
                {lowStockItems.map((it: any) => (
                  <li key={it.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{getEntityDisplay(LOW_STOCK.entity, it)}</div>
                      <div className="text-xs text-slate-500">
                        {I18N.lowStockQty} {String(it?.[LOW_STOCK.quantity_field] ?? 0)} · {I18N.lowStockReorder} {String(it?.[LOW_STOCK.reorder_point_field] ?? 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">{I18N.lowStockSuggest}</div>
                      <div className="text-sm font-semibold text-slate-900">{String(reorderSuggestion[String(it.id)] ?? 0)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </InventoryAlertCard>
          ) : null}

          {showExpiry ? (
            <InventoryAlertCard
              title={I18N.expiryTitle}
              subtitle={interpolate(I18N.expirySubtitle, { count: EXPIRY.within_days })}
              actionHref={'/' + EXPIRY.entity}
              loading={loadingExpiry}
              isEmpty={expiryItems.length === 0}
              emptyLabel={I18N.expiryEmpty}
            >
              <ul className="space-y-2">
                {expiryItems.map((it: any) => {
                  const t = new Date(String(it?.[EXPIRY.expiry_field] || '')).getTime();
                  const days = Number.isFinite(t) ? Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)) : null;
                  return (
                    <li key={it.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{getEntityDisplay(EXPIRY.entity, it)}</div>
                        <div className="text-xs text-slate-500">{I18N.expiryLabel} {String(it?.[EXPIRY.expiry_field] ?? '')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">{I18N.expiryDays}</div>
                        <div className={'text-sm font-semibold ' + (days !== null && days <= 0 ? 'text-red-600' : 'text-slate-900')}>
                          {days === null ? '—' : String(days)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </InventoryAlertCard>
          ) : null}

          {showActivity ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{I18N.activityTitle}</div>
                  <div className="text-xs text-slate-500">{I18N.activitySubtitle}</div>
                </div>
                <Link to="/activity" className="text-sm font-semibold text-blue-600 hover:underline">
                  {I18N.activityView}
                </Link>
              </div>
              <div className="mt-3">
                {loadingAudit ? (
                  <div className="text-sm text-slate-500">{I18N.activityLoading}</div>
                ) : auditItems.length === 0 ? (
                  <div className="text-sm text-slate-500">{I18N.activityEmpty}</div>
                ) : (
                  <ul className="space-y-2">
                    {auditItems.map((it: any) => (
                      <li key={it.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {String(it?.action || '').toUpperCase()} · {String(it?.entity || '')}
                          </div>
                          <div className="truncate text-xs text-slate-500">{String(it?.message || '')}</div>
                        </div>
                        <div className="text-right text-xs text-slate-500">{String(it?.at || it?.created_at || '')}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {ENABLE_REPORTS_PAGE ? (
                <div className="mt-3 text-xs text-slate-500">
                  {I18N.activityReportsHint} <Link to="/reports" className="font-semibold text-blue-600 hover:underline">{I18N.reportsLabel}</Link>.
                </div>
              ) : null}
            </div>
          ) : null}
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
