import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../utils/permissions';

/**
 * AdminRoute — wraps admin-only routes. Non-admins are redirected to /projects
 * so admin pages (and their data-fetch effects) never mount.
 * Uses is_admin from the server after session bootstrap so stale localStorage
 * cannot show admin UIs the API would reject.
 */
export default function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-app-accent-blue border-t-transparent" />
      </div>
    );
  }

  if (isUserAdmin(user)) {
    return <Outlet />;
  }

  return <Navigate to="/projects" replace />;
}
