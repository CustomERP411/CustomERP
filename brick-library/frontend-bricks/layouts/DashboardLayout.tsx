import { useState, useEffect, createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, toggle: () => {}, close: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('erp_sidebar') === 'collapsed'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('erp_sidebar', collapsed ? 'collapsed' : 'expanded'); } catch {}
  }, [collapsed]);

  const toggle = () => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  };

  const close = () => setMobileOpen(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, close }}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={close} />
        )}

        <div className="flex">
          {/* Mobile sidebar: off-screen overlay */}
          <div
            className={[
              'no-print fixed z-50 h-screen transition-transform duration-200 md:hidden',
              mobileOpen ? 'translate-x-0' : '-translate-x-full',
            ].join(' ')}
          >
            <Sidebar />
          </div>

          {/* Desktop sidebar: inline, collapsible */}
          <div
            className={[
              'no-print hidden md:block sticky top-0 h-screen shrink-0 transition-all duration-200 overflow-hidden',
              collapsed ? 'w-0' : 'w-64',
            ].join(' ')}
          >
            <div className="w-64 h-full">
              <Sidebar />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="no-print">
              <Topbar />
            </div>
            <main className="p-4 sm:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
