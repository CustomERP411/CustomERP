import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { isUserAdmin } from '../../utils/permissions';
import BrandMark from '../brand/BrandMark';

const SIDEBAR_KEY = 'sidebar_collapsed';

interface SidebarProps {
  drawerOpen?: boolean;
  onCloseDrawer?: () => void;
}

interface NavEntry {
  to: string;
  label: string;
  active: boolean;
  icon: ReactNode;
}

export default function Sidebar({ drawerOpen = false, onCloseDrawer }: SidebarProps) {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('sidebar');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const collapse = () => setCollapsed(true);
    const expand = () => setCollapsed(false);
    window.addEventListener('sidebar-collapse', collapse);
    window.addEventListener('sidebar-expand', expand);
    return () => {
      window.removeEventListener('sidebar-collapse', collapse);
      window.removeEventListener('sidebar-expand', expand);
    };
  }, []);

  // Esc + body scroll lock while drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseDrawer?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, onCloseDrawer]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems: NavEntry[] = [
    {
      to: '/projects',
      label: t('projects'),
      active: isActive('/projects'),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
    {
      to: '/settings',
      label: t('settings'),
      active: isActive('/settings'),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      to: '/my/requests',
      label: t('myRequests'),
      active: isActive('/my/requests'),
      icon: (
        <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      ),
    },
  ];

  if (isUserAdmin(user)) {
    navItems.push(
      {
        to: '/admin',
        label: t('admin'),
        active: location.pathname === '/admin',
        icon: (
          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        ),
      },
      {
        to: '/admin/training',
        label: t('training'),
        active: isActive('/admin/training'),
        icon: (
          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        ),
      },
      {
        to: '/admin/feature-requests',
        label: t('featureRequests'),
        active: isActive('/admin/feature-requests'),
        icon: (
          <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        ),
      }
    );
  }

  const logoutIcon = (
    <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  return (
    <>
      {/* Desktop rail: md+ only */}
      <div
        className={`hidden md:flex flex-col border-r border-app-border bg-app-surface transition-all duration-200 ease-in-out ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Header: logo + toggle */}
        <div className="flex min-h-[4.5rem] items-center justify-between gap-2 px-3 py-2">
          <Link
            to="/projects"
            className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'flex-1'}`}
            title="CustomERP"
          >
            {collapsed ? (
              <BrandMark variant="icon" className="h-12 w-12 shrink-0 object-contain" alt="" />
            ) : (
              <BrandMark variant="wordmark" className="h-11 w-auto max-w-[14rem] object-contain object-left sm:max-w-[16rem] sm:h-12" />
            )}
          </Link>
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-app-text-muted hover:bg-app-surface-hover hover:text-app-accent-blue"
            title={collapsed ? t('expandSidebar') : t('collapseSidebar')}
            aria-label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
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
          {navItems.map((item) => (
            <RailNavItem key={item.to} item={item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer: user info + logout */}
        <div className="border-t border-app-border px-2 py-3 space-y-1">
          <div
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? (user?.name || user?.email || t('user')) : undefined}
          >
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-app-accent-blue/10 text-xs font-bold text-app-accent-blue">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-app-text">{user?.name || t('user')}</div>
                <div className="truncate text-xs text-app-text-muted">{user?.email}</div>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-app-text-muted hover:bg-app-surface-hover hover:text-app-accent-blue ${
              collapsed ? 'justify-center' : ''
            }`}
            title={t('signOut')}
          >
            {logoutIcon}
            {!collapsed && <span className="text-sm">{t('signOut')}</span>}
            {collapsed && <Tooltip label={t('signOut')} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer: below md only */}
      <div className="md:hidden" aria-hidden={!drawerOpen}>
        {/* Overlay */}
        <div
          onClick={onCloseDrawer}
          className={`fixed inset-0 bg-app-overlay z-40 transition-opacity ${
            drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        />
        {/* Slide-over panel */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-app-surface text-app-text shadow-xl transition-transform duration-200 ease-in-out border-r border-app-border ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex min-h-[4.5rem] items-center justify-between px-3 py-2 border-b border-app-border">
            <Link to="/projects" className="min-w-0 flex-1 pr-2" onClick={onCloseDrawer}>
              <BrandMark variant="wordmark" className="h-12 w-auto max-w-full object-contain object-left sm:h-14" />
            </Link>
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label={t('closeMenu')}
              className="flex h-10 w-10 items-center justify-center rounded-md text-app-text-muted hover:bg-app-surface-hover hover:text-app-accent-blue"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={onCloseDrawer}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  item.active
                    ? 'bg-app-surface-hover text-app-accent-blue'
                    : 'text-app-text-muted hover:bg-app-surface-hover hover:text-app-accent-blue'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-app-border px-2 py-3 space-y-1">
            <div className="flex items-center gap-3 rounded-lg px-3 py-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-app-accent-blue/10 text-xs font-bold text-app-accent-blue">
                {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-app-text">{user?.name || t('user')}</div>
                <div className="truncate text-xs text-app-text-muted">{user?.email}</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-app-text-muted hover:bg-app-surface-hover hover:text-app-accent-blue"
            >
              {logoutIcon}
              <span className="text-sm">{t('signOut')}</span>
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}

function RailNavItem({ item, collapsed }: { item: NavEntry; collapsed: boolean }) {
  return (
    <Link
      to={item.to}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        collapsed ? 'justify-center' : ''
      } ${
        item.active
          ? 'bg-app-surface-hover text-app-accent-blue'
          : 'text-app-text-muted hover:bg-app-surface-hover hover:text-app-accent-blue'
      }`}
      title={collapsed ? item.label : undefined}
    >
      {item.icon}
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && <Tooltip label={item.label} />}
    </Link>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-app-surface-elevated px-2 py-1 text-xs text-app-text shadow-lg group-hover:block z-50 border border-app-border">
      {label}
    </span>
  );
}
