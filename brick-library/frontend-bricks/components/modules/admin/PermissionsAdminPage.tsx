import { useMemo, useState } from 'react';

export type PermissionScope = 'inventory' | 'invoice' | 'hr' | 'global';

export interface AdminPermissionRecord {
  id: string;
  key: string;
  label: string;
  scope: PermissionScope;
  groupCount: number;
  description?: string;
  isCritical?: boolean;
}

interface PermissionsAdminPageProps {
  permissions: AdminPermissionRecord[];
  onCreatePermission?: () => void;
  onEditPermission?: (permissionId: string) => void;
}

const SCOPE_STYLES: Record<PermissionScope, string> = {
  inventory: 'bg-blue-100 text-blue-700',
  invoice: 'bg-emerald-100 text-emerald-700',
  hr: 'bg-violet-100 text-violet-700',
  global: 'bg-slate-200 text-slate-700',
};

export default function PermissionsAdminPage({
  permissions,
  onCreatePermission,
  onEditPermission,
}: PermissionsAdminPageProps) {
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const filteredPermissions = useMemo(() => {
    if (!showCriticalOnly) return permissions;
    return permissions.filter((permission) => permission.isCritical === true);
  }, [permissions, showCriticalOnly]);

  return (
    <section className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Permission Management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Review available permissions and verify which groups can use them.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreatePermission}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Add Permission
        </button>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={showCriticalOnly}
          onChange={(event) => setShowCriticalOnly(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        Show critical permissions only
      </label>

      {filteredPermissions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No permissions found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Permission</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Used By Groups</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPermissions.map((permission) => (
                <tr key={permission.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{permission.label}</div>
                    <div className="text-xs text-slate-500">
                      {permission.key}
                      {permission.description ? ` - ${permission.description}` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SCOPE_STYLES[permission.scope]}`}>
                      {permission.scope}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{permission.groupCount}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onEditPermission?.(permission.id)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
