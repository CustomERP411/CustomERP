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

  if (!user?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900">{t('accessDenied')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('accessDeniedMessage')}</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-500">{t('loadingAdminData')}</div>;
  }

  const activeUsers = users.filter((u) => !u.deleted);

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('subtitle')}</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {actionError && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{actionError}</div>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('tabs.users')} ({activeUsers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('tabs.projects')} ({projects.length})
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">{t('users.columns.name')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600">{t('users.columns.email')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600">{t('users.columns.status')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600">{t('users.columns.joined')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600 text-right">{t('users.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.map((u) => (
                  <tr key={u.id} className={`border-b last:border-b-0 hover:bg-slate-50/50 ${u.blocked ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.name}
                      {u.id === user.id && <span className="ml-1.5 text-xs text-slate-400">{t('users.youLabel')}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {u.is_admin ? (
                          <span className="inline-flex w-fit items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">{t('users.adminBadge')}</span>
                        ) : (
                          <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{t('users.userBadge')}</span>
                        )}
                        {u.blocked && (
                          <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700" title={u.block_reason || ''}>
                            {t('users.blocked')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(u.created_at).toLocaleDateString(i18n.language)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== user.id && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(u)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            {u.is_admin ? t('users.revokeAdmin') : t('users.makeAdmin')}
                          </button>
                          {u.blocked ? (
                            <button
                              type="button"
                              onClick={() => void handleUnblock(u)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                            >
                              {t('users.unblock')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openBlock(u)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
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
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">{t('users.noUsers')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">{t('projects.columns.project')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600">{t('projects.columns.owner')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600">{t('projects.columns.status')}</th>
                  <th className="px-4 py-3 font-medium text-slate-600">{t('projects.columns.created')}</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{p.owner.name}</div>
                      <div className="text-xs text-slate-400">{p.owner.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'Approved' ? 'bg-emerald-100 text-emerald-700'
                          : p.status === 'Ready' ? 'bg-blue-100 text-blue-700'
                          : p.status === 'Generated' ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {tProjects(`status.${p.status}`, { defaultValue: p.status })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(p.created_at).toLocaleDateString(i18n.language)}</td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('projects.noProjects')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Block User Modal */}
      {blockingUser && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{t('blockModal.title')}</h3>
            <p
              className="mt-2 text-sm text-slate-600"
              dangerouslySetInnerHTML={{
                __html: t('blockModal.description', {
                  name: blockingUser.name,
                  email: blockingUser.email,
                  interpolation: { escapeValue: false },
                }),
              }}
            />
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('blockModal.reasonLabel')}</label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t('blockModal.reasonPlaceholder')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {actionError && <p className="mt-3 text-sm text-red-600">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setBlockingUser(null); setActionError(''); }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t('blockModal.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleBlock()}
                disabled={blockSaving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
