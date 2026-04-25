import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { adminService, type AdminUser, type AdminProject } from '../services/adminService';

function getErrorMessage(err: unknown, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const obj = err as Record<string, unknown>;
  const resp = obj.response as Record<string, unknown> | undefined;
  const data = resp?.data as Record<string, unknown> | undefined;
  return String(data?.error || obj.message || fallback);
}

export default function AdminPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('admin');
  const tProjects = useTranslation('projects').t;

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const [blockingUser, setBlockingUser] = useState<AdminUser | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [u, p] = await Promise.all([adminService.getUsers(), adminService.getAllProjects()]);
      setUsers(u);
      setProjects(p);
    } catch (err) {
      setError(getErrorMessage(err, t('unknownError')));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAdmin(target: AdminUser) {
    setActionError('');
    try {
      const updated = await adminService.setAdminStatus(target.id, !target.is_admin);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setActionError(getErrorMessage(err, t('unknownError')));
    }
  }

  function openBlock(target: AdminUser) {
    setBlockingUser(target);
    setBlockReason('');
    setActionError('');
  }

  async function handleBlock() {
    if (!blockingUser) return;
    setBlockSaving(true);
    setActionError('');
    try {
      const updated = await adminService.blockUser(blockingUser.id, blockReason.trim() || undefined);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setBlockingUser(null);
    } catch (err) {
      setActionError(getErrorMessage(err, t('unknownError')));
    } finally {
      setBlockSaving(false);
    }
  }

  async function handleUnblock(target: AdminUser) {
    setActionError('');
    try {
      const updated = await adminService.unblockUser(target.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      setActionError(getErrorMessage(err, t('unknownError')));
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-app-text-muted">{t('loadingAdminData')}</div>;
  }

  const activeUsers = users.filter((u) => !u.deleted);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-app-text">{t('title')}</h1>
        <p className="mt-1 text-sm text-app-text-muted">{t('subtitle')}</p>
      </div>

      {error && <div className="rounded-lg border border-app-danger-border bg-app-danger-soft px-4 py-3 text-sm text-app-danger">{error}</div>}
      {actionError && <div className="rounded-lg border border-app-warning-border bg-app-warning-soft px-4 py-3 text-sm text-app-warning">{actionError}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-app-border overflow-x-auto -mx-2 px-2">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-app-accent-blue text-app-accent-blue'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          {t('tabs.users')} ({activeUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-app-accent-blue text-app-accent-blue'
              : 'border-transparent text-app-text-muted hover:text-app-text'
          }`}
        >
          {t('tabs.projects')} ({projects.length})
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <section className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border bg-app-surface-muted text-left">
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('users.columns.name')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('users.columns.email')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('users.columns.status')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('users.columns.joined')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted text-right">{t('users.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((u) => (
                  <tr key={u.id} className={`border-b border-app-border last:border-b-0 hover:bg-app-surface-muted/60 ${u.blocked ? 'bg-app-danger-soft/40' : ''}`}>
                    <td className="px-4 py-3 font-medium text-app-text">
                      {u.name}
                      {u.id === user.id && <span className="ml-1.5 text-xs text-app-text-subtle">{t('users.youLabel')}</span>}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {u.is_admin ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-app-info-soft px-2 py-0.5 text-xs font-medium text-app-info">{t('users.adminBadge')}</span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-full bg-app-surface-hover px-2 py-0.5 text-xs font-medium text-app-text-muted">{t('users.userBadge')}</span>
                        )}
                        {u.blocked && (
                          <span className="inline-flex w-fit items-center rounded-full bg-app-danger-soft px-2 py-0.5 text-xs font-medium text-app-danger" title={u.block_reason || ''}>
                            {t('users.blocked')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{new Date(u.created_at).toLocaleDateString(i18n.language)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== user.id && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(u)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-app-accent-blue hover:bg-app-info-soft transition-colors"
                          >
                            {u.is_admin ? t('users.revokeAdmin') : t('users.makeAdmin')}
                          </button>
                          {u.blocked ? (
                            <button
                              type="button"
                              onClick={() => void handleUnblock(u)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-app-success hover:bg-app-success-soft transition-colors"
                            >
                              {t('users.unblock')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openBlock(u)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-app-danger hover:bg-app-danger-soft transition-colors"
                            >
                              {t('users.block')}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {activeUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-app-text-subtle">{t('users.noUsers')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="sm:hidden divide-y divide-app-border">
            {activeUsers.map((u) => (
              <li key={u.id} className={`p-4 space-y-3 ${u.blocked ? 'bg-app-danger-soft/40' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-app-text">
                      {u.name}
                      {u.id === user.id && <span className="ml-1.5 text-xs font-normal text-app-text-subtle">{t('users.youLabel')}</span>}
                    </div>
                    <div className="truncate text-xs text-app-text-muted">{u.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {u.is_admin ? (
                      <span className="inline-flex items-center rounded-full bg-app-info-soft px-2 py-0.5 text-xs font-medium text-app-info">{t('users.adminBadge')}</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-app-surface-hover px-2 py-0.5 text-xs font-medium text-app-text-muted">{t('users.userBadge')}</span>
                    )}
                    {u.blocked && (
                      <span className="inline-flex items-center rounded-full bg-app-danger-soft px-2 py-0.5 text-xs font-medium text-app-danger">
                        {t('users.blocked')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-app-text-muted">{new Date(u.created_at).toLocaleDateString(i18n.language)}</div>
                {u.id !== user.id && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggleAdmin(u)}
                      className="rounded-lg border border-app-info-border px-3 py-1.5 text-xs font-medium text-app-accent-blue hover:bg-app-info-soft"
                    >
                      {u.is_admin ? t('users.revokeAdmin') : t('users.makeAdmin')}
                    </button>
                    {u.blocked ? (
                      <button
                        type="button"
                        onClick={() => void handleUnblock(u)}
                        className="rounded-lg border border-app-success-border px-3 py-1.5 text-xs font-medium text-app-success hover:bg-app-success-soft"
                      >
                        {t('users.unblock')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openBlock(u)}
                        className="rounded-lg border border-app-danger-border px-3 py-1.5 text-xs font-medium text-app-danger hover:bg-app-danger-soft"
                      >
                        {t('users.block')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
            {activeUsers.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-app-text-subtle">{t('users.noUsers')}</li>
            )}
          </ul>
        </section>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <section className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-app-border bg-app-surface-muted text-left">
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('projects.columns.project')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('projects.columns.owner')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('projects.columns.status')}</th>
                  <th className="px-4 py-3 font-medium text-app-text-muted">{t('projects.columns.created')}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-app-border last:border-b-0 hover:bg-app-surface-muted/60">
                    <td className="px-4 py-3 font-medium text-app-text">{p.name}</td>
                    <td className="px-4 py-3 text-app-text-muted">
                      <div>{p.owner.name}</div>
                      <div className="text-xs text-app-text-subtle">{p.owner.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'Approved' ? 'bg-app-success-soft text-app-success'
                          : p.status === 'Ready' ? 'bg-app-info-soft text-app-info'
                          : p.status === 'Generated' ? 'bg-app-mod-hr-soft text-app-mod-hr'
                          : 'bg-app-surface-hover text-app-text-muted'
                      }`}>
                        {tProjects(`status.${p.status}`, { defaultValue: p.status })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">{new Date(p.created_at).toLocaleDateString(i18n.language)}</td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-app-text-subtle">{t('projects.noProjects')}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <ul className="sm:hidden divide-y divide-app-border">
            {projects.map((p) => (
              <li key={p.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-app-text">{p.name}</div>
                    <div className="truncate text-xs text-app-text-muted">{p.owner.name}</div>
                    <div className="truncate text-xs text-app-text-subtle">{p.owner.email}</div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.status === 'Approved' ? 'bg-app-success-soft text-app-success'
                      : p.status === 'Ready' ? 'bg-app-info-soft text-app-info'
                      : p.status === 'Generated' ? 'bg-app-mod-hr-soft text-app-mod-hr'
                      : 'bg-app-surface-hover text-app-text-muted'
                  }`}>
                    {tProjects(`status.${p.status}`, { defaultValue: p.status })}
                  </span>
                </div>
                <div className="text-xs text-app-text-muted">{new Date(p.created_at).toLocaleDateString(i18n.language)}</div>
              </li>
            ))}
            {projects.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-app-text-subtle">{t('projects.noProjects')}</li>
            )}
          </ul>
        </section>
      )}

      {/* Block User Modal */}
      {blockingUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-app-overlay px-4">
          <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface-elevated p-6 shadow-xl">
            <h3 className="text-base font-semibold text-app-text">{t('blockModal.title')}</h3>
            <p
              className="mt-2 text-sm text-app-text-muted"
              dangerouslySetInnerHTML={{
                __html: t('blockModal.description', {
                  name: blockingUser.name,
                  email: blockingUser.email,
                  interpolation: { escapeValue: false },
                }),
              }}
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-app-text-muted mb-1">{t('blockModal.reasonLabel')}</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t('blockModal.reasonPlaceholder')}
                className="w-full rounded-lg border border-app-border-strong bg-app-surface-muted px-3 py-2 text-sm text-app-text outline-none focus:ring-2 focus:ring-app-danger/40"
              />
            </div>
            {actionError && <p className="mt-3 text-sm text-app-danger">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setBlockingUser(null); setActionError(''); }}
                className="rounded-lg border border-app-border-strong px-4 py-2 text-sm font-semibold text-app-text hover:bg-app-surface-hover"
              >
                {t('blockModal.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleBlock()}
                disabled={blockSaving}
                className="rounded-lg bg-app-danger px-4 py-2 text-sm font-semibold text-app-text-inverse hover:opacity-90 disabled:opacity-50"
              >
                {blockSaving ? t('blockModal.blocking') : t('blockModal.blockUser')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
