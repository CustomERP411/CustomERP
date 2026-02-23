function buildDashboardHome({ lowStockCfg, expiryCfg, activityCfg, enableReportsPage }) {
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ENTITIES } from '../config/entities';
import InventoryAlertCard from '../components/modules/inventory/InventoryAlertCard';

const LOW_STOCK = ${JSON.stringify(lowStockCfg, null, 2)} as const;
const EXPIRY = ${JSON.stringify(expiryCfg, null, 2)} as const;
const ACTIVITY = ${JSON.stringify(activityCfg, null, 2)} as const;
const ENABLE_REPORTS_PAGE = ${enableReportsPage ? 'true' : 'false'} as const;

const DISPLAY_FIELD_BY_ENTITY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayField])
) as Record<string, string>;

const getEntityDisplay = (entitySlug: string, row: any) => {
  const df = DISPLAY_FIELD_BY_ENTITY[entitySlug] || 'name';
  const v = row?.[df] ?? row?.name ?? row?.sku ?? row?.id;
  return String(v ?? '');
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
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [loadingLowStock, setLoadingLowStock] = useState(false);

  const [expiryItems, setExpiryItems] = useState<any[]>([]);
  const [loadingExpiry, setLoadingExpiry] = useState(false);

  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const tasks: Promise<any>[] = [];

        tasks.push(
          (async () => {
            const entries = await Promise.all(
              ENTITIES.map(async (e) => {
                const res = await api.get('/' + e.slug);
                return [e.slug, Array.isArray(res.data) ? res.data.length : 0] as const;
              })
            );
            setCounts(Object.fromEntries(entries));
          })()
        );

        if (LOW_STOCK.enabled) {
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

        if (EXPIRY.enabled) {
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

        if (ACTIVITY.enabled) {
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
  }, []);

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

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow">
        <div className="text-sm opacity-90">Welcome</div>
        <div className="mt-1 text-2xl font-bold">Your Inventory Workspace</div>
        <div className="mt-2 text-sm opacity-90">
          Use the sidebar to manage entities and tools.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ENTITIES.map((e) => (
          <Link
            key={e.slug}
            to={'/' + e.slug}
            className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow"
          >
            <div className="text-sm font-semibold text-slate-900">{e.displayName}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {loadingCounts ? '…' : String(counts[e.slug] ?? 0)}
            </div>
            <div className="mt-1 text-xs text-slate-500">records</div>
          </Link>
        ))}
      </div>

      {(LOW_STOCK.enabled || EXPIRY.enabled || ACTIVITY.enabled) ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {LOW_STOCK.enabled ? (
            <InventoryAlertCard
              title="Low stock"
              subtitle={'Top ' + String(LOW_STOCK.limit) + ' items'}
              actionHref={'/' + LOW_STOCK.entity}
              loading={loadingLowStock}
              isEmpty={lowStockItems.length === 0}
              emptyLabel="No low stock items."
            >
              <ul className="space-y-2">
                {lowStockItems.map((it: any) => (
                  <li key={it.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900">{getEntityDisplay(LOW_STOCK.entity, it)}</div>
                      <div className="text-xs text-slate-500">
                        qty {String(it?.[LOW_STOCK.quantity_field] ?? 0)} · reorder {String(it?.[LOW_STOCK.reorder_point_field] ?? 0)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">suggest</div>
                      <div className="text-sm font-semibold text-slate-900">{String(reorderSuggestion[String(it.id)] ?? 0)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </InventoryAlertCard>
          ) : null}

          {EXPIRY.enabled ? (
            <InventoryAlertCard
              title="Expiry alerts"
              subtitle={'Within ' + String(EXPIRY.within_days) + ' days'}
              actionHref={'/' + EXPIRY.entity}
              loading={loadingExpiry}
              isEmpty={expiryItems.length === 0}
              emptyLabel="No expiring items."
            >
              <ul className="space-y-2">
                {expiryItems.map((it: any) => {
                  const t = new Date(String(it?.[EXPIRY.expiry_field] || '')).getTime();
                  const days = Number.isFinite(t) ? Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)) : null;
                  return (
                    <li key={it.id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{getEntityDisplay(EXPIRY.entity, it)}</div>
                        <div className="text-xs text-slate-500">expiry {String(it?.[EXPIRY.expiry_field] ?? '')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500">days</div>
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

          {ACTIVITY.enabled ? (
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Activity</div>
                  <div className="text-xs text-slate-500">Recent changes</div>
                </div>
                <Link to="/activity" className="text-sm font-semibold text-blue-600 hover:underline">
                  View
                </Link>
              </div>
              <div className="mt-3">
                {loadingAudit ? (
                  <div className="text-sm text-slate-500">Loading…</div>
                ) : auditItems.length === 0 ? (
                  <div className="text-sm text-slate-500">No activity yet.</div>
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
                  Daily summaries are available in <Link to="/reports" className="font-semibold text-blue-600 hover:underline">Reports</Link>.
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


