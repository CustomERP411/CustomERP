import { useMemo, useState } from 'react';

export type AdminUserStatus = 'active' | 'disabled' | 'invited';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  groupNames: string[];
  status: AdminUserStatus;
}

interface UsersAdminPageProps {
  users: AdminUserRecord[];
  onCreateUser?: () => void;
  onEditUser?: (userId: string) => void;
  onToggleUserStatus?: (userId: string, nextStatus: AdminUserStatus) => void;
}

const STATUS_STYLES: Record<AdminUserStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  disabled: 'bg-slate-200 text-slate-700',
  invited: 'bg-amber-100 text-amber-700',
};

export default function UsersAdminPage({
  users,
  onCreateUser,
  onEditUser,
  onToggleUserStatus,
}: UsersAdminPageProps) {
  const [query, setQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return users;
    return users.filter((user) => {
      const groups = user.groupNames.join(' ').toLowerCase();
      return (
        user.name.toLowerCase().includes(text) ||
        user.email.toLowerCase().includes(text) ||
        groups.includes(text)
      );
    });
  }, [users, query]);

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage ERP users and assign them to the right access groups.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateUser}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Add User
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by user, email, or group..."
        className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {filteredUsers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No users found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Groups</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const nextStatus: AdminUserStatus = user.status === 'active' ? 'disabled' : 'active';
                const toggleLabel = user.status === 'active' ? 'Disable' : 'Activate';
                return (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {user.groupNames.length ? user.groupNames.join(', ') : 'No groups'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[user.status]}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEditUser?.(user.id)}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleUserStatus?.(user.id, nextStatus)}
                          className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {toggleLabel}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
