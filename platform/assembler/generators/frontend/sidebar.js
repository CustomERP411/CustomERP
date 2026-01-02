function buildSidebar({ toolsBlock }) {
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

module.exports = {
  buildSidebar,
};


