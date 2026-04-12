import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const SIDEBAR_KEY = 'sidebar_collapsed';

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div
      className={`flex flex-col border-r bg-slate-900 text-white transition-all duration-200 ease-in-out ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Header: logo + toggle */}
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed && (
          <Link to="/projects" className="flex items-center gap-1.5 font-bold text-lg truncate">
            <span className="text-blue-400">C</span>ERP
          </Link>
        )}
        <button
          onClick={() => setCollapsed((p) => !p)}
          className={`flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white ${
            collapsed ? 'mx-auto' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        <NavItem
          to="/projects"
          label="Projects"
          active={isActive('/projects')}
          collapsed={collapsed}
          icon={
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
        />
        <NavItem
          to="/settings"
          label="Settings"
          active={isActive('/settings')}
          collapsed={collapsed}
          icon={
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <NavItem
          to="/my/requests"
          label="Your Requests"
          active={isActive('/my/requests')}
          collapsed={collapsed}
          icon={
            <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
            </svg>
          }
        />
        {user?.is_admin && (
          <>
            <NavItem
              to="/admin"
              label="Admin"
              active={location.pathname === '/admin'}
              collapsed={collapsed}
              icon={
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              }
            />
            <NavItem
              to="/admin/training"
              label="Training Data"
              active={isActive('/admin/training')}
              collapsed={collapsed}
              icon={
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
              }
            />
            <NavItem
              to="/admin/feature-requests"
              label="Feature Requests"
              active={isActive('/admin/feature-requests')}
              collapsed={collapsed}
              icon={
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
              }
            />
          </>
        )}
      </nav>

      {/* Footer: logout */}
      <div className="border-t border-slate-800 px-2 py-3">
        <button
          onClick={handleLogout}
          className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-400 hover:bg-slate-800 hover:text-white ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Logout"
        >
          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && <span className="text-sm">Logout</span>}
          {collapsed && <Tooltip label="Logout" />}
        </button>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  active,
  collapsed,
  icon,
}: {
  to: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        collapsed ? 'justify-center' : ''
      } ${
        active
          ? 'bg-slate-800 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && <Tooltip label={label} />}
    </Link>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs text-white shadow-lg group-hover:block z-50">
      {label}
    </span>
  );
}
