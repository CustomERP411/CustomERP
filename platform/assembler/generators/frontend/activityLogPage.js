const { tFor } = require('../../i18n/labels');

function buildActivityLogPage(language = 'en') {
  const t = tFor(language);
  const I18N = {
    title: t('activityLog.title'),
    subtitle: t('activityLog.subtitle'),
    searchPlaceholder: t('activityLog.searchPlaceholder'),
    back: t('common.back'),
    loading: t('common.loading'),
    columnAt: t('activityLog.columns.when'),
    columnUser: t('activityLog.columns.user'),
    columnAction: t('activityLog.columns.action'),
    columnEntity: t('activityLog.columns.entity'),
    columnEntityId: t('activityLog.columns.recordId'),
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
};

const ENTITY_NAMES = Object.fromEntries(ENTITIES.map((e) => [e.slug, e.displayName])) as Record<string, string>;

function applyTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => values[key] || '');
}

function userLabel(row: AuditRow) {
  return String(row.user_display_name || row.username || row.user_id || I18N.unknownUser);
}

function actionLabel(row: AuditRow) {
  const action = String(row.action || '').toUpperCase();
  return (I18N.actions as Record<string, string>)[action] || action;
}

function entityLabel(row: AuditRow) {
  const slug = String(row.entity || '');
  return (I18N.entityNames as Record<string, string>)[slug] || ENTITY_NAMES[slug] || slug;
}

function rowMessage(row: AuditRow) {
  const action = String(row.action || '').toUpperCase();
  const template = (I18N.messages as Record<string, string>)[action];
  if (!template) return String(row.message || '');
  return applyTemplate(template, {
    user: userLabel(row),
    entity: entityLabel(row),
    record: String(row.entity_id || ''),
  }).trim();
}

export default function ActivityLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/__audit_logs');
        const data = Array.isArray(res.data) ? res.data : [];
        setRows(data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = rows
      .slice()
      .sort((a, b) => String(b?.at || b?.created_at || '').localeCompare(String(a?.at || a?.created_at || '')));
    if (!term) return sorted;
    return sorted.filter((r) => {
      const hay = [
        r.action,
        r.entity,
        r.entity_id,
        r.username,
        r.user_display_name,
        rowMessage(r),
        r.at,
        r.created_at,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search]);

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

      <div className="no-print">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={I18N.searchPlaceholder}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md"
        />
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
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnEntityId}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{I18N.columnMessage}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">{String(r.at || r.created_at || '')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{userLabel(r)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{actionLabel(r)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{entityLabel(r)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{String(r.entity_id || '')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{rowMessage(r)}</td>
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
