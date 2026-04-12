import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';

export default function DashboardLayout() {
  return (
    <ChatProvider>
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}
