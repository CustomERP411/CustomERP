import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <div className="no-print">
          <Sidebar />
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
  );
}


