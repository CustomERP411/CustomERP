import { useTranslation } from 'react-i18next';

export interface AccessRequirementItem {
  id: string;
  groupName: string;
  userCount: string;
  responsibilities: string;
  permissions: string[];
  customPermissions: string;
}

interface AccessRequirementsProps {
  items: AccessRequirementItem[];
  disabled?: boolean;
  onChange: (next: AccessRequirementItem[]) => void;
}

const PERMISSION_CHOICES = [
  'view_records',
  'create_records',
  'edit_records',
  'delete_records',
  'approve_transactions',
  'manage_users',
  'manage_groups',
  'manage_permissions',
];

export function createDefaultAccessRequirement(idSeed = Date.now()): AccessRequirementItem {
  return {
    id: `group-${idSeed}`,
    groupName: '',
    userCount: '',
    responsibilities: '',
    permissions: [],
    customPermissions: '',
  };
}

export default function AccessRequirements({ items, disabled = false, onChange }: AccessRequirementsProps) {
  const { t } = useTranslation('projectDetail');
  const updateItem = (id: string, patch: Partial<AccessRequirementItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const togglePermission = (id: string, permission: string, checked: boolean) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = checked
          ? Array.from(new Set([...item.permissions, permission]))
          : item.permissions.filter((entry) => entry !== permission);
        return { ...item, permissions: next };
      }),
    );
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    onChange(items.filter((item) => item.id !== id));
  };

  const addItem = () => {
    onChange([...items, createDefaultAccessRequirement(Date.now())]);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t('accessRequirements.title')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t('accessRequirements.subtitle')}</p>
        <p className="mt-1 text-xs text-slate-500">{t('accessRequirements.atLeastOne')}</p>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">{t('accessRequirements.group', { n: idx + 1 })}</div>
              <button
                type="button"
                disabled={disabled || items.length <= 1}
                onClick={() => removeItem(item.id)}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('accessRequirements.remove')}
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">{t('accessRequirements.groupName')}</label>
                <input
                  value={item.groupName}
                  disabled={disabled}
                  onChange={(event) => updateItem(item.id, { groupName: event.target.value })}
                  placeholder={t('accessRequirements.groupNamePlaceholder')}
                  className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">{t('accessRequirements.userCount')}</label>
                <input
                  value={item.userCount}
                  disabled={disabled}
                  onChange={(event) => updateItem(item.id, { userCount: event.target.value })}
                  placeholder={t('accessRequirements.userCountPlaceholder')}
                  className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-slate-500">{t('accessRequirements.responsibilities')}</label>
              <textarea
                rows={2}
                value={item.responsibilities}
                disabled={disabled}
                onChange={(event) => updateItem(item.id, { responsibilities: event.target.value })}
                placeholder={t('accessRequirements.responsibilitiesPlaceholder')}
                className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>

            <div className="mt-3">
              <div className="text-xs font-medium text-slate-500">{t('accessRequirements.requiredPermissions')}</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PERMISSION_CHOICES.map((permission) => {
                  const checked = item.permissions.includes(permission);
                  return (
                    <label key={permission} className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => togglePermission(item.id, permission, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {t(`accessRequirements.permissions.${permission}`, { defaultValue: permission.replace(/_/g, ' ') })}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-slate-500">{t('accessRequirements.customPermissions')}</label>
              <input
                value={item.customPermissions}
                disabled={disabled}
                onChange={(event) => updateItem(item.id, { customPermissions: event.target.value })}
                placeholder={t('accessRequirements.customPermissionsPlaceholder')}
                className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={addItem}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('accessRequirements.addGroup')}
      </button>
    </section>
  );
}
