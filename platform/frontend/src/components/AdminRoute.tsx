import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const REDIRECT_SECONDS = 4;

/**
 * AdminRoute
 *
 * Wraps admin-only routes. Non-admins see a "Restricted Access" notice with a
 * countdown that auto-redirects to /projects so child admin pages never mount
 * (and therefore never trigger their data-fetch effects).
 */
export default function AdminRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  const isAdmin = !!user?.is_admin;

  useEffect(() => {
    if (loading || isAdmin) return;
    if (seconds <= 0) {
      navigate('/projects', { replace: true });
      return;
    }
    const timer = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [loading, isAdmin, seconds, navigate]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-app-accent-blue border-t-transparent" />
      </div>
    );
  }

  if (isAdmin) return <Outlet />;

  return (
    <div className="mx-auto max-w-2xl py-20 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-danger-soft">
        <svg
          className="h-8 w-8 text-app-danger"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"
          />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-app-text">{t('restrictedAccess.title')}</h1>
      <p className="mt-2 text-sm text-app-text-muted">{t('restrictedAccess.body')}</p>
      <p className="mt-4 text-sm font-medium text-app-text-muted">
        {t('restrictedAccess.redirecting', { count: Math.max(seconds, 0) })}
      </p>
      <button
        type="button"
        onClick={() => navigate('/projects', { replace: true })}
        className="mt-5 rounded-lg border border-app-border bg-app-surface px-5 py-2 text-sm font-semibold text-app-text hover:bg-app-surface-hover transition-colors"
      >
        {t('restrictedAccess.goNow')}
      </button>
    </div>
  );
}
