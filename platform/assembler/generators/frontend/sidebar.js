function buildSidebar({ toolsBlock, moduleMap }) {
  // If moduleMap exists and has multiple enabled modules, use module-aware navigation
  const hasMultipleModules = moduleMap && moduleMap.enabled && moduleMap.enabled.length > 1;
  
  if (hasMultipleModules) {
    // Module-aware navigation with grouping
    return `import { Link, useLocation } from 'react-router-dom';
import { ENTITIES } from '../config/entities';

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  inventory: 'Inventory',
  invoice: 'Invoice',
  hr: 'HR',
  shared: 'Shared',
};

export default function Sidebar() {
  const location = useLocation();

  // Group entities by module
  const entityGroups = ENTITIES.reduce((acc, entity) => {
    const moduleKey = entity.module || 'inventory';
    if (!acc[moduleKey]) {
      acc[moduleKey] = [];
    }
    acc[moduleKey].push(entity);
    return acc;
  }, {} as Record<string, typeof ENTITIES>);

  // Order modules: inventory, invoice, hr, then shared
  const moduleOrder = ['inventory', 'invoice', 'hr', 'shared'];
  const orderedModules = moduleOrder.filter(mod => entityGroups[mod] && entityGroups[mod].length > 0);

  return (
    <aside className="w-64 border-r bg-white flex flex-col">
      <div className="px-4 py-4">
        <div className="text-lg font-bold text-slate-900">ERP System</div>
        <div className="text-xs text-slate-500">CustomERP generated</div>
      </div>
      
      <nav className="px-2 pb-4 flex-1 overflow-y-auto">
        <Link
          to="/"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname === '/' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Dashboard
        </Link>

        {orderedModules.map((moduleKey) => (
          <div key={moduleKey} className="mt-4">
            <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {MODULE_DISPLAY_NAMES[moduleKey] || moduleKey}
            </div>
            {entityGroups[moduleKey].map((e) => {
              const active = location.pathname === '/' + e.slug || location.pathname.startsWith('/' + e.slug + '/');
              return (
                <Link
                  key={e.slug}
                  to={'/' + e.slug}
                  className={[
                    'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
                    active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {e.displayName}
                </Link>
              );
            })}
          </div>
        ))}

${toolsBlock || ''}
      </nav>
    </aside>
  );
}
`;
  } else {
    // Single module / backward compatible flat navigation
    return `import { Link, useLocation } from 'react-router-dom';
import { ENTITIES } from '../config/entities';

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-white">
      <div className="px-4 py-4">
        <div className="text-lg font-bold text-slate-900">Inventory</div>
        <div className="text-xs text-slate-500">CustomERP generated</div>
      </div>
      <nav className="px-2 pb-4">
        <Link
          to="/"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname === '/' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Dashboard
        </Link>
        <div className="my-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Entities</div>
        {ENTITIES.map((e) => {
          const active = location.pathname === '/' + e.slug || location.pathname.startsWith('/' + e.slug + '/');
          return (
            <Link
              key={e.slug}
              to={'/' + e.slug}
              className={[
                'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
                active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {e.displayName}
            </Link>
          );
        })}
${toolsBlock || ''}
      </nav>
    </aside>
  );
}
`;
  }
}

module.exports = {
  buildSidebar,
};


