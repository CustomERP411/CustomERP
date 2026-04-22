import { useState, FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import LanguageSelector from '../components/common/LanguageSelector';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const e = error as { response?: { data?: { error?: unknown } }; message?: unknown };
    if (typeof e.response?.data?.error === 'string') return e.response.data.error;
    if (typeof e.message === 'string') return e.message;
  }
  return fallback;
}

export default function SettingsPage() {
  const { user, updateUser, deleteAccount } = useAuth();
  const { t } = useTranslation(['settings', 'common', 'auth']);

  // Profile
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Delete account
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || trimmedName.length < 2) {
      setProfileMsg({ type: 'err', text: t('auth:register.errors.nameRequired') });
      return;
    }
    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setProfileMsg({ type: 'err', text: t('auth:register.errors.emailInvalid') });
      return;
    }

    try {
      setProfileSaving(true);
      const res = await api.put('/auth/profile', { name: trimmedName, email: trimmedEmail });
      updateUser(res.data.user);
      setName(res.data.user.name);
      setEmail(res.data.user.email);
      setProfileMsg({ type: 'ok', text: t('settings:profile.saved') });
    } catch (err) {
      setProfileMsg({ type: 'err', text: getErrorMessage(err, t('settings:profile.error')) });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (!currentPw) {
      setPwMsg({ type: 'err', text: t('auth:register.errors.passwordRequired') });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ type: 'err', text: t('settings:password.tooShort') });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: t('settings:password.mismatch') });
      return;
    }

    try {
      setPwSaving(true);
      await api.put('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'ok', text: t('settings:password.saved') });
    } catch (err) {
      setPwMsg({ type: 'err', text: getErrorMessage(err, t('settings:password.error')) });
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== (user?.email || '').toLowerCase()) {
      setDeleteErr(t('settings:danger.confirmPrompt'));
      return;
    }
    try {
      setDeleting(true);
      setDeleteErr('');
      await deleteAccount();
    } catch (err) {
      setDeleteErr(getErrorMessage(err, t('settings:danger.error')));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('settings:title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('settings:subtitle')}</p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t('settings:sections.profile')}</h2>

        <form onSubmit={handleProfileSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('settings:profile.nameLabel')}</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setProfileMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('settings:profile.emailLabel')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setProfileMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {profileMsg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${profileMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {profileMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {profileSaving ? t('settings:profile.saving') : t('settings:profile.save')}
            </button>
          </div>
        </form>
      </section>

      {/* Language */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t('settings:sections.language')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('settings:language.info')}</p>

        <div className="mt-5">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            {t('settings:language.label')}
          </label>
          <LanguageSelector />
        </div>
      </section>

      {/* Password */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{t('settings:sections.password')}</h2>

        <form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('settings:password.currentLabel')}</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setPwMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('settings:password.newLabel')}</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setPwMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">{t('settings:password.confirmLabel')}</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => { setConfirmPw(e.target.value); setPwMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>

          {pwMsg && (
            <div className={`rounded-lg px-3 py-2 text-sm ${pwMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {pwMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pwSaving ? t('settings:password.saving') : t('settings:password.save')}
            </button>
          </div>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">{t('settings:sections.danger')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('settings:danger.description')}</p>

        <button
          onClick={() => setShowDelete(true)}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          {t('settings:danger.delete')}
        </button>
      </section>

      {showDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-red-700">{t('settings:danger.title')}</h3>
            <p className="mt-2 text-sm text-slate-600">{t('settings:danger.description')}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{user?.email}</p>

            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteErr(''); }}
              placeholder={user?.email || ''}
              className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
            />
            {deleteErr && (
              <p className="mt-1 text-xs text-red-700">{deleteErr}</p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirm(''); setDeleteErr(''); }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {t('common:cancel')}
              </button>
              <button
                onClick={() => { void handleDeleteAccount(); }}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? t('settings:danger.deleting') : t('settings:danger.delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
