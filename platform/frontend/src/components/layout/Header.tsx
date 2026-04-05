import { useState } from 'react';

import { useAuth } from '../../context/AuthContext';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      response?: { data?: { error?: unknown } };
      message?: unknown;
    };
    if (typeof candidate.response?.data?.error === 'string') {
      return candidate.response.data.error;
    }
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
  }
  return fallback;
}

export default function Header() {
  const { user, logout, deleteAccount } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);
  const [accountError, setAccountError] = useState('');

  const closeDeleteModal = () => {
    if (submittingDelete) return;
    setShowDeleteAccountConfirm(false);
    setDeleteConfirmText('');
    setAccountError('');
  };

  const confirmDeleteAccount = async () => {
    const expected = user?.email || '';
    if (deleteConfirmText.trim().toLowerCase() !== expected.toLowerCase()) {
      setAccountError('Type your email exactly to confirm account deletion.');
      return;
    }

    try {
      setSubmittingDelete(true);
      setAccountError('');
      await deleteAccount();
    } catch (err: unknown) {
      setAccountError(getErrorMessage(err, 'Failed to confirm account deletion'));
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
        </div>
        <div className="relative flex items-center gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <span className="text-sm font-medium text-slate-700">{user?.name}</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void logout();
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShowDeleteAccountConfirm(true);
                  setDeleteConfirmText('');
                  setAccountError('');
                }}
                className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
              >
                Delete Account
              </button>
            </div>
          )}
        </div>
      </header>

      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete Account</h3>
            <p className="mt-2 text-sm text-slate-600">
              Confirm your account deletion intent, then you will be signed out.
              Type your email to continue:
            </p>

            <div className="mt-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
              {user?.email || '-'}
            </div>

            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className="mt-4 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
              placeholder={user?.email || ''}
            />

            {accountError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {accountError}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={submittingDelete}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void confirmDeleteAccount(); }}
                disabled={submittingDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingDelete ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
