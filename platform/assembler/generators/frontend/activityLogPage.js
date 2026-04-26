const { tFor } = require('../../i18n/labels');

function buildActivityLogPage(language = 'en') {
  const t = tFor(language);
  const I18N = {
    title: t('activityLog.title'),
    subtitle: t('activityLog.subtitle'),
    searchPlaceholder: t('activityLog.searchPlaceholder'),
    allUsers: t('activityLog.allUsers'),
    allActions: t('activityLog.allActions'),
    allEntities: t('activityLog.allEntities'),
    filterUser: t('activityLog.filters.user'),
    filterAction: t('activityLog.filters.action'),
    filterEntity: t('activityLog.filters.entity'),
    back: t('common.back'),
    loading: t('common.loading'),
    columnAt: t('activityLog.columns.when'),
    columnUser: t('activityLog.columns.user'),
    columnAction: t('activityLog.columns.action'),
    columnEntity: t('activityLog.columns.entity'),
    columnRecord: t('activityLog.columns.record'),
    columnMessage: t('activityLog.columns.message'),
    actions: {
      CREATE: t('activityLog.actions.CREATE'),
      UPDATE: t('activityLog.actions.UPDATE'),
      DELETE: t('activityLog.actions.DELETE'),
      LOGIN: t('activityLog.actions.LOGIN'),
      LOGOUT: t('activityLog.actions.LOGOUT'),
    },
    messages: {
      CREATE: t('activityLog.messages.CREATE'),
      UPDATE: t('activityLog.messages.UPDATE'),
      DELETE: t('activityLog.messages.DELETE'),
      LOGIN: t('activityLog.messages.LOGIN'),
      LOGOUT: t('activityLog.messages.LOGOUT'),
    },
    recordFallback: t('activityLog.recordFallback'),
    unknownUser: t('activityLog.unknownUser'),
    entityNames: {
      __erp_users: t('sidebar.users'),
      __audit_logs: t('activityLog.title'),
    },
    empty: t('activityLog.empty'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ENTITIES } from '../config/entities';
import api from '../services/api';

const I18N = ${i18nJson} as const;

type AuditRow = {
  id: string;
  at?: string;
  created_at?: string;
  action?: string;
  entity?: string;
  entity_id?: string;
  user_id?: string;
  username?: string;
  user_display_name?: string;
  message?: string;
  meta?: string | Record<string, unknown>;
};

const ENTITY_NAMES = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.displayName])) as Record<string, string>;
const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => values[key] || '');
}

function userLabel(row: AuditRow) {
  return String(row.user_display_name || row.username || I18N.unknownUser);
}

function actionLabel(row: AuditRow) {
  const action = String(row.action || '').toUpperCase();
  return (I18N.actions as Record<string, string>)[action] || action;
}

function entityLabel(row: AuditRow) {
  const slug = String(row.entity || '');
  return (I18N.entityNames as Record<string, string>)[slug] || ENTITY_NAMES[slug] || slug;
}

function parseMeta(row: AuditRow): Record<string, unknown> {
  const raw = row.meta;
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function formatTime(row: AuditRow) {
  const t = new Date(String(row.at || row.created_at || '')).getTime();
  return Number.isFinite(t) ? DATE_FORMATTER.format(new Date(t)) : '';
}

function recordLabel(row: AuditRow) {
  const meta = parseMeta(row);
  const named = meta.name || meta.title || meta.code || meta.sku || meta.invoice_number || meta.order_number || meta.reservation_number || meta.reference_number;
  if (named) return String(named);
  return applyTemplate(I18N.recordFallback, { entity: entityLabel(row) });
}

function rowMessage(row: AuditRow, user?: string) {
  const action = String(row.action || '').toUpperCase();
  const template = (I18N.messages as Record<string, string>)[action];
  if (!template) return String(row.message || '');
  return applyTemplate(template, {
    user: user || userLabel(row),
    entity: entityLabel(row),
    record: recordLabel(row),
  }).trim();
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/__audit_logs');
        const data = Array.isArray(res.data) ? res.data : [];
        setRows(data);
        try {
          const userRes = await api.get('/__erp_users');
          const userRows = Array.isArray(userRes.data) ? userRes.data : [];
          setUsers(Object.fromEntries(userRows.map((u: any) => [String(u.id), String(u.display_name || u.username || u.id)])));
        } catch {
          setUsers({});
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const displayUser = (row: AuditRow) => {
    if (row.user_display_name || row.username) return userLabel(row);
    if (row.user_id && users[String(row.user_id)]) return users[String(row.user_id)];
    return I18N.unknownUser;
  };

  const usersForFilter = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const key = String(row.user_id || row.username || row.user_display_name || '');
      if (!key) continue;
      map.set(key, displayUser(row));
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, users]);

  const entitiesForFilter = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      const key = String(row.entity || '');
      if (!key) continue;
      map.set(key, entityLabel(row));
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = rows
      .slice()
      .sort((a, b) => String(b?.at || b?.created_at || '').localeCompare(String(a?.at || a?.created_at || '')));
    return sorted.filter((r) => {
      if (userFilter) {
        const userKey = String(r.user_id || r.username || r.user_display_name || '');
        if (userKey !== userFilter) return false;
      }
      if (actionFilter && String(r.action || '').toUpperCase() !== actionFilter) return false;
      if (entityFilter && String(r.entity || '') !== entityFilter) return false;
      if (!term) return true;
      const hay = [
        r.action,
        r.entity,
        entityLabel(r),
        recordLabel(r),
        r.username,
        r.user_display_name,
        rowMessage(r, displayUser(r)),
        formatTime(r),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, users, search, userFilter, actionFilter, entityFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to="/" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          {I18N.back}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 no-print md:grid-cols-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={I18N.searchPlaceholder}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="text-xs font-medium text-slate-500">
          {I18N.filterUser}
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900">
            <option value="">{I18N.allUsers}</option>
            {usersForFilter.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          {I18N.filterAction}
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900">
            <option value="">{I18N.allActions}</option>
            {Object.entries(I18N.actions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500">
          {I18N.filterEntity}
          <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900">
            <option value="">{I18N.allEntities}</option>
            {entitiesForFilter.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="p-4">{I18N.loading}</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnAt}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnUser}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnAction}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnEntity}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnRecord}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnMessage}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">{formatTime(r)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{displayUser(r)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{actionLabel(r)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{entityLabel(r)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{recordLabel(r)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{rowMessage(r, displayUser(r))}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">{I18N.empty}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
`;
}

module.exports = {
  buildActivityLogPage,
};
