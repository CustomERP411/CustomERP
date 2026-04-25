import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileTopbar from './MobileTopbar';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';

export default function DashboardLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const isPreviewRoute = /\/projects\/[^/]+\/preview$/.test(location.pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <ChatProvider>
      <div
        className={`flex bg-app-bg transition-colors duration-200 ${
          isPreviewRoute ? 'h-viewport max-h-viewport min-h-0 overflow-hidden' : 'min-h-screen'
        }`}
      >
        <Sidebar drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />
        <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${isPreviewRoute ? 'min-h-0 overflow-hidden' : ''}`}>
          <MobileTopbar onOpenMenu={() => setDrawerOpen(true)} />
          <main
            className={`min-h-0 min-w-0 flex-1 ${
              isPreviewRoute
                ? 'flex flex-col overflow-hidden p-0'
                : 'overflow-auto p-4 sm:p-6'
            }`}
          >
            <Outlet />
          </main>
        </div>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}
