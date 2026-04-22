import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { ChatProvider } from '../../context/ChatContext';
import ChatWidget from '../chat/ChatWidget';
import LanguageSelector from '../common/LanguageSelector';

export default function DashboardLayout() {
  return (
    <ChatProvider>
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex h-12 items-center justify-end gap-3 border-b border-slate-200 bg-white px-4">
            <LanguageSelector compact />
          </header>
          <main className="flex-1 overflow-auto p-6 min-w-0">
            <Outlet />
          </main>
        </div>
        <ChatWidget />
      </div>
    </ChatProvider>
  );
}
