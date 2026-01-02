function buildActivityLogPage() {
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

type AuditRow = {
  id: string;
  at?: string;
  created_at?: string;
  action?: string;
  entity?: string;
  entity_id?: string;
  message?: string;
};

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
        r.message,
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
          <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
          <p className="text-sm text-slate-600">Recent changes across audited entities.</p>
        </div>
        <Link to="/" className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 no-print">
          Back
        </Link>
      </div>

      <div className="no-print">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity..."
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md"
        />
      </div>

      {loading ? (
        <div className="p-4">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">At</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Entity ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-700">{String(r.at || r.created_at || '')}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{String(r.action || '')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{String(r.entity || '')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{String(r.entity_id || '')}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{String(r.message || '')}</td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No activity.</td>
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


