import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface PublicOnlyRouteProps {
  children: ReactNode;
}

/**
 * PublicOnlyRoute Component
 * Redirects to dashboard if user is already authenticated
 * Used for Login/Register pages
 */
export default function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    // Optional: show loading or nothing while checking
    return null; 
  }

  if (user) {
    // User is already logged in, redirect them
    // Check if there was a redirect destination in state, otherwise go to dashboard
    const from = (location.state as any)?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}

