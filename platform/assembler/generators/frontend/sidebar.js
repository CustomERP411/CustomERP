function buildSidebar({ toolsBlock, moduleMap, rbac }) {
  const adminBlock = rbac ? `
        {(isSuperadmin || hasPermission('__erp_users.read')) && (<>
        <div className="mt-4 px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Settings</div>
        <Link
          to="/admin/users"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname.startsWith('/admin/users') ? 'bg-amber-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Users
        </Link>
        <Link
          to="/admin/groups"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname.startsWith('/admin/groups') ? 'bg-amber-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Roles
        </Link>
        </>)}` : '';

  const hasMultipleModules = moduleMap && moduleMap.enabled && moduleMap.enabled.length > 1;

  const canSeeEntity = rbac
    ? `(e) => isSuperadmin || hasPermission(e.slug + '.read')`
    : `() => true`;

  const moduleColors = `{
  inventory: { border: 'border-l-blue-500', active: 'bg-blue-600 text-white', dot: 'bg-blue-500' },
  invoice: { border: 'border-l-emerald-500', active: 'bg-emerald-600 text-white', dot: 'bg-emerald-500' },
  hr: { border: 'border-l-violet-500', active: 'bg-violet-600 text-white', dot: 'bg-violet-500' },
  shared: { border: 'border-l-slate-400', active: 'bg-slate-600 text-white', dot: 'bg-slate-400' },
}`;

  if (hasMultipleModules) {
    return `import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ENTITIES } from '../../config/entities';
${rbac ? `import { useAuth } from '../../contexts/AuthContext';\n` : ''}
const MODULE_DISPLAY_NAMES: Record<string, string> = {
  inventory: 'Inventory',
  invoice: 'Invoicing',
  hr: 'HR & People',
};

const MODULE_COLORS: Record<string, { border: string; active: string; dot: string }> = ${moduleColors};

const DEFAULT_COLOR = { border: 'border-l-slate-400', active: 'bg-slate-600 text-white', dot: 'bg-slate-400' };

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
${rbac ? `  const { user, logout, hasPermission, isSuperadmin } = useAuth();\n` : ''}
  const canSee = ${canSeeEntity};

  const navEntities = ENTITIES.filter((e) => !e.isChild).filter(canSee);

  const entityGroups = navEntities.reduce((acc, entity) => {
    const modules = entity.module === 'shared' && entity.sharedModules?.length
      ? entity.sharedModules
      : [entity.module || 'inventory'];
    for (const moduleKey of modules) {
      if (!acc[moduleKey]) acc[moduleKey] = [];
      if (!acc[moduleKey].some((e: any) => e.slug === entity.slug)) {
        acc[moduleKey].push(entity);
      }
    }
    return acc;
  }, {} as Record<string, typeof ENTITIES>);

  const moduleOrder = ['inventory', 'invoice', 'hr'];
  const orderedModules = moduleOrder.filter(mod => entityGroups[mod] && entityGroups[mod].length > 0);
  for (const key of Object.keys(entityGroups)) {
    if (!orderedModules.includes(key)) orderedModules.push(key);
  }

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(orderedModules.map((m) => [m, true]))
  );

  const toggleSection = (mod: string) =>
    setOpenSections((s) => ({ ...s, [mod]: !s[mod] }));

  return (
    <aside className="w-64 h-screen border-r bg-white flex flex-col">
      <nav className="px-2 py-3 flex-1 overflow-y-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back
        </button>
        <Link
          to="/"
          className={[
            'mb-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold',
            location.pathname === '/' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
          Dashboard
        </Link>

        {orderedModules.map((moduleKey) => {
          const colors = MODULE_COLORS[moduleKey] || DEFAULT_COLOR;
          const isOpen = openSections[moduleKey] !== false;
          return (
            <div key={moduleKey} className={\`mt-1 border-l-2 \${colors.border} rounded-r\`}>
              <button
                onClick={() => toggleSection(moduleKey)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
              >
                <span className="flex items-center gap-1.5">
                  <span className={\`inline-block h-1.5 w-1.5 rounded-full \${colors.dot}\`} />
                  {MODULE_DISPLAY_NAMES[moduleKey] || moduleKey}
                </span>
                <svg className={\`h-3.5 w-3.5 transition-transform \${isOpen ? '' : '-rotate-90'}\`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {isOpen && (
                <div className="pb-1">
                  {entityGroups[moduleKey].map((e) => {
                    const active = location.pathname === '/' + e.slug || location.pathname.startsWith('/' + e.slug + '/');
                    return (
                      <Link
                        key={e.slug}
                        to={'/' + e.slug}
                        className={[
                          'mb-0.5 block rounded-lg px-3 py-1.5 text-sm font-medium ml-2',
                          active ? colors.active : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        ].join(' ')}
                      >
                        {e.displayName}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

${toolsBlock || ''}
${adminBlock}
      </nav>
${rbac ? `      <div className="border-t px-4 py-3">
        <div className="text-xs text-slate-500 truncate">{user?.display_name || user?.username}</div>
        <button onClick={logout} className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">Sign out</button>
      </div>` : ''}
    </aside>
  );
}
`;
  }

  return `import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ENTITIES } from '../../config/entities';
${rbac ? `import { useAuth } from '../../contexts/AuthContext';\n` : ''}
const MODULE_DISPLAY_NAMES: Record<string, string> = {
  inventory: 'Inventory',
  invoice: 'Invoicing',
  hr: 'HR & People',
};

const MODULE_COLORS: Record<string, { border: string; active: string; dot: string }> = ${moduleColors};

const DEFAULT_COLOR = { border: 'border-l-slate-400', active: 'bg-slate-600 text-white', dot: 'bg-slate-400' };

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
${rbac ? `  const { user, logout, hasPermission, isSuperadmin } = useAuth();\n` : ''}
  const canSee = ${canSeeEntity};

  const navEntities = ENTITIES.filter((e) => !e.isChild).filter(canSee);

  const entityGroups = navEntities.reduce((acc, entity) => {
    const modules = entity.module === 'shared' && entity.sharedModules?.length
      ? entity.sharedModules
      : [entity.module || 'inventory'];
    for (const moduleKey of modules) {
      if (!acc[moduleKey]) acc[moduleKey] = [];
      if (!acc[moduleKey].some((e: any) => e.slug === entity.slug)) {
        acc[moduleKey].push(entity);
      }
    }
    return acc;
  }, {} as Record<string, typeof ENTITIES>);

  const moduleOrder = ['inventory', 'invoice', 'hr'];
  const orderedModules = moduleOrder.filter(mod => entityGroups[mod] && entityGroups[mod].length > 0);
  for (const key of Object.keys(entityGroups)) {
    if (!orderedModules.includes(key)) orderedModules.push(key);
  }

  const hasSections = orderedModules.length > 1 || (orderedModules.length === 1 && navEntities.length > 6);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(orderedModules.map((m) => [m, true]))
  );

  const toggleSection = (mod: string) =>
    setOpenSections((s) => ({ ...s, [mod]: !s[mod] }));

  return (
    <aside className="w-64 h-screen border-r bg-white flex flex-col">
      <nav className="px-2 py-3 flex-1 overflow-y-auto">
        <button
          onClick={() => navigate(-1)}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back
        </button>
        <Link
          to="/"
          className={[
            'mb-2 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold',
            location.pathname === '/' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
          Dashboard
        </Link>

        {hasSections ? orderedModules.map((moduleKey) => {
          const colors = MODULE_COLORS[moduleKey] || DEFAULT_COLOR;
          const isOpen = openSections[moduleKey] !== false;
          return (
            <div key={moduleKey} className={\`mt-1 border-l-2 \${colors.border} rounded-r\`}>
              <button
                onClick={() => toggleSection(moduleKey)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
              >
                <span className="flex items-center gap-1.5">
                  <span className={\`inline-block h-1.5 w-1.5 rounded-full \${colors.dot}\`} />
                  {MODULE_DISPLAY_NAMES[moduleKey] || moduleKey}
                </span>
                <svg className={\`h-3.5 w-3.5 transition-transform \${isOpen ? '' : '-rotate-90'}\`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>
              {isOpen && (
                <div className="pb-1">
                  {entityGroups[moduleKey].map((e) => {
                    const active = location.pathname === '/' + e.slug || location.pathname.startsWith('/' + e.slug + '/');
                    return (
                      <Link
                        key={e.slug}
                        to={'/' + e.slug}
                        className={[
                          'mb-0.5 block rounded-lg px-3 py-1.5 text-sm font-medium ml-2',
                          active ? colors.active : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        ].join(' ')}
                      >
                        {e.displayName}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }) : (
          <div className="mt-1">
            {navEntities.map((e) => {
              const active = location.pathname === '/' + e.slug || location.pathname.startsWith('/' + e.slug + '/');
              return (
                <Link
                  key={e.slug}
                  to={'/' + e.slug}
                  className={[
                    'mb-0.5 block rounded-lg px-3 py-2 text-sm font-medium',
                    active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  ].join(' ')}
                >
                  {e.displayName}
                </Link>
              );
            })}
          </div>
        )}

${toolsBlock || ''}
${adminBlock}
      </nav>
${rbac ? `      <div className="border-t px-4 py-3">
        <div className="text-xs text-slate-500 truncate">{user?.display_name || user?.username}</div>
        <button onClick={logout} className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">Sign out</button>
      </div>` : ''}
    </aside>
  );
}
`;
}

module.exports = {
  buildSidebar,
};
