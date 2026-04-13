import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';

export default function DashboardLayout() {
  return (
    <ChatProvider>
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 min-w-0">
          <Outlet />
        </main>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}
