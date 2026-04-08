import { useMemo, useState } from 'react';

export interface AdminGroupRecord {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  permissionCount: number;
}

interface GroupsAdminPageProps {
  groups: AdminGroupRecord[];
  onCreateGroup?: () => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export default function GroupsAdminPage({
  groups,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
}: GroupsAdminPageProps) {
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return groups;
    return groups.filter((group) => {
      return (
        group.name.toLowerCase().includes(text) ||
        group.description.toLowerCase().includes(text)
      );
    });
  }, [groups, query]);

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Group Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Define user groups and map responsibilities to each team.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateGroup}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Add Group
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search groups..."
        className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No groups found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filteredGroups.map((group) => (
            <article key={group.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
                <div className="text-xs text-slate-500">{group.memberCount} members</div>
              </div>
              <p className="mt-2 text-xs text-slate-600">{group.description || 'No description'}</p>
              <div className="mt-3 text-xs text-slate-700">
                Permissions assigned: <span className="font-semibold">{group.permissionCount}</span>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onEditGroup?.(group.id)}
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteGroup?.(group.id)}
                  className="rounded border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
