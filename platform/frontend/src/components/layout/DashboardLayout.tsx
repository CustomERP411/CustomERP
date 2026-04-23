import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileTopbar from './MobileTopbar';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <ChatProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />
        <div className="flex flex-1 flex-col min-w-0">
          <MobileTopbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="flex-1 overflow-auto p-4 sm:p-6 min-w-0">
            <Outlet />
          </main>
        </div>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}
