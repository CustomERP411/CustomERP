import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex w-64 flex-col border-r bg-slate-900 text-white">
      <div className="flex h-16 items-center px-6">
        <div className="flex items-center gap-2 font-bold text-xl">
          <span className="text-blue-400">Custom</span>ERP
        </div>
      </div>
      
      <div className="flex-1 px-4 py-4 space-y-1">
        <Link 
          to="/projects" 
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <span>Projects</span>
        </Link>
        
        {/* Placeholder for future links */}
        <div className="pt-4 text-xs font-semibold uppercase text-slate-500 tracking-wider px-3">
          Workspace
        </div>
        <button 
          disabled
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-500 cursor-not-allowed"
        >
          <span>Settings</span>
        </button>
      </div>

      <div className="border-t border-slate-800 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

