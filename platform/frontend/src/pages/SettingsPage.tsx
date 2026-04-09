import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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
      setProfileMsg({ type: 'err', text: 'Name must be at least 2 characters.' });
      return;
    }
    if (!trimmedEmail || !/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setProfileMsg({ type: 'err', text: 'Please enter a valid email.' });
      return;
    }

    try {
      setProfileSaving(true);
      const res = await api.put('/auth/profile', { name: trimmedName, email: trimmedEmail });
      updateUser(res.data.user);
      setName(res.data.user.name);
      setEmail(res.data.user.email);
      setProfileMsg({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'err', text: getErrorMessage(err, 'Failed to update profile.') });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (!currentPw) { setPwMsg({ type: 'err', text: 'Enter your current password.' }); return; }
    if (newPw.length < 6) { setPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'err', text: 'Passwords do not match.' }); return; }

    try {
      setPwSaving(true);
      await api.put('/auth/password', { currentPassword: currentPw, newPassword: newPw });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'ok', text: 'Password changed successfully.' });
    } catch (err) {
      setPwMsg({ type: 'err', text: getErrorMessage(err, 'Failed to change password.') });
    } finally {
      setPwSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm.trim().toLowerCase() !== (user?.email || '').toLowerCase()) {
      setDeleteErr('Type your email exactly to confirm.');
      return;
    }
    try {
      setDeleting(true);
      setDeleteErr('');
      await deleteAccount();
    } catch (err) {
      setDeleteErr(getErrorMessage(err, 'Failed to delete account.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500">Update your name and email address.</p>

        <form onSubmit={handleProfileSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setProfileMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
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
              {profileSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </section>

      {/* Password */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Change Password</h2>
        <p className="mt-1 text-sm text-slate-500">Update your password to keep your account secure.</p>

        <form onSubmit={handlePasswordChange} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Current Password</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => { setCurrentPw(e.target.value); setPwMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">New Password</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => { setNewPw(e.target.value); setPwMsg(null); }}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
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
              {pwSaving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="rounded-xl border border-red-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="mt-1 text-sm text-slate-500">
          Permanently delete your account. Your projects will no longer be accessible but data is retained internally.
        </p>

        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Delete My Account
          </button>
        ) : (
          <div className="mt-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">
              Type your email to confirm: <span className="font-semibold">{user?.email}</span>
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteErr(''); }}
              placeholder={user?.email || ''}
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
            />
            {deleteErr && (
              <p className="text-xs text-red-700">{deleteErr}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirm(''); setDeleteErr(''); }}
                disabled={deleting}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleDeleteAccount(); }}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
