const { tFor } = require('../../i18n/labels');

function buildAuthContext() {
  return `import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';
import { evaluateScopeClient } from '../utils/scopeEvaluator';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
  employee_id?: string | null;
  department_id?: string | null;
  manager_id?: string | null;
}

interface PermissionScopeEntry {
  entity: string;
  permission: string;
  scope: 'self' | 'department' | 'manager_chain' | 'module' | 'all' | string;
  actions?: string[] | null;
  when?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  permissions: string[];
  isSuperadmin: boolean;
  loading: boolean;
  managerChain: string[];
  permissionScopes: PermissionScopeEntry[];
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
  // Plan B follow-up #5: row-level scope check that mirrors the server-side
  // evaluator. Returns true if the actor can act on \`row\` for \`permission\`.
  // \`row\` may be null/undefined for create-time checks.
  hasScope: (permission: string, row?: Record<string, any> | null) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('erp_token'),
    permissions: [],
    isSuperadmin: false,
    loading: true,
    managerChain: [],
    permissionScopes: [],
  });

  const setToken = (t: string | null) => {
    if (t) localStorage.setItem('erp_token', t);
    else localStorage.removeItem('erp_token');
  };

  const loadProfile = useCallback(async (token: string) => {
    try {
      const { data } = await API.get('/auth/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      setState({
        user: data.user,
        token,
        permissions: data.permissions || [],
        isSuperadmin: !!data.isSuperadmin,
        loading: false,
        managerChain: Array.isArray(data.manager_chain) ? data.manager_chain : [],
        permissionScopes: Array.isArray(data.permission_scopes) ? data.permission_scopes : [],
      });
    } catch {
      setToken(null);
      setState({
        user: null,
        token: null,
        permissions: [],
        isSuperadmin: false,
        loading: false,
        managerChain: [],
        permissionScopes: [],
      });
    }
  }, []);

  useEffect(() => {
    if (state.token) loadProfile(state.token);
    else setState((s) => ({ ...s, loading: false }));
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await API.post('/auth/login', { username, password });
    setToken(data.token);
    await loadProfile(data.token);
  };

  const logout = async () => {
    if (state.token) {
      try {
        await API.post('/auth/logout', {}, {
          headers: { Authorization: 'Bearer ' + state.token },
        });
      } catch {
        // Always clear local auth state even if the server-side audit write fails.
      }
    }
    setToken(null);
    setState({
      user: null,
      token: null,
      permissions: [],
      isSuperadmin: false,
      loading: false,
      managerChain: [],
      permissionScopes: [],
    });
  };

  const hasPermission = (key: string) => state.isSuperadmin || state.permissions.includes(key);

  const hasScope = (permission: string, row?: Record<string, any> | null) => {
    if (state.isSuperadmin) return true;
    // Without the broad permission, scope cannot grant access.
    if (!state.permissions.includes(permission)) return false;
    // Find the matching entry in the registry. If none exists the flat-key
    // check above is authoritative — return true.
    const entries = state.permissionScopes.filter((e) => e.permission === permission);
    if (entries.length === 0) return true;
    // Pick the most permissive scope (mirrors server-side _bestScopeForEntry).
    const order: Record<string, number> = { all: 5, module: 4, department: 3, manager_chain: 2, self: 1 };
    let best: PermissionScopeEntry | null = null;
    let bestRank = -1;
    for (const entry of entries) {
      const rank = order[String(entry.scope || '').toLowerCase()] || 0;
      if (rank > bestRank) { best = entry; bestRank = rank; }
    }
    if (!best) return true;
    return evaluateScopeClient(best.scope, {
      employee_id: state.user?.employee_id || null,
      department_id: state.user?.department_id || null,
      manager_chain: state.managerChain,
      isSuperadmin: state.isSuperadmin,
    }, row || null);
  };

  useEffect(() => {
    const id = API.interceptors.request.use((config) => {
      if (state.token) config.headers.Authorization = 'Bearer ' + state.token;
      return config;
    });
    return () => API.interceptors.request.eject(id);
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, hasScope }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { API };
`;
}

function buildLoginPage({ language } = {}) {
  const t = tFor(language);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const L = {
    signIn: t('auth.login.submit'),
    subtitle: t('auth.login.subtitle'),
    loading: t('rbac.loading'),
    username: t('auth.login.username'),
    password: t('auth.login.password'),
    signingIn: t('auth.login.submitting'),
    loginFailed: t('auth.login.genericError'),
    defaultLogin: t('rbac.defaultLogin'),
  };
  return `import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import api from '../services/api';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDefaultHint, setShowDefaultHint] = useState(false);

  useEffect(() => {
    api.get('/auth/default-credentials').then((res) => {
      if (res.data?.active) setShowDefaultHint(true);
    }).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-500">${esc(L.loading)}</div>
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err?.response?.data?.error || '${esc(L.loginFailed)}');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <form
        onSubmit={handleSubmit}
        name="erp-login"
        autoComplete="off"
        className="w-full max-w-sm space-y-5 rounded-2xl border bg-white p-8 shadow-lg"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">${esc(L.signIn)}</h1>
          <p className="mt-1 text-sm text-slate-500">${esc(L.subtitle)}</p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">${esc(L.username)}</label>
          <input
            name="erp-username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">${esc(L.password)}</label>
          <input
            type="password"
            name="erp-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? '${esc(L.signingIn)}' : '${esc(L.signIn)}'}
        </button>

        {showDefaultHint && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
            <p className="text-sm font-medium text-blue-800">
              ${esc(L.defaultLogin)} <strong>admin</strong> / <strong>admin</strong>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
`;
}

function buildRequireAuth({ language } = {}) {
  const t = tFor(language);
  const loadingLabel = t('common.loading');
  return `import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-slate-500">${loadingLabel}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
`;
}

function buildRequirePermission({ language } = {}) {
  const t = tFor(language);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const L = {
    loading: t('rbacForbidden.loading'),
    forbiddenTitle: t('rbacForbidden.title'),
    forbiddenBody: t('rbacForbidden.body'),
    missing: t('rbacForbidden.missing'),
    back: t('rbacForbidden.back'),
  };
  return `import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

export function ForbiddenPage({ missing }: { missing?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
        </div>
        <h2 className="text-lg font-semibold text-rose-900">${esc(L.forbiddenTitle)}</h2>
        <p className="mt-1 text-sm text-rose-800">${esc(L.forbiddenBody)}</p>
        {missing && (
          <p className="mt-2 text-xs text-rose-700">
            <span className="font-semibold">${esc(L.missing)}:</span> <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px]">{missing}</code>
          </p>
        )}
        <div className="mt-4">
          <Link to="/" className="inline-block rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">${esc(L.back)}</Link>
        </div>
      </div>
    </div>
  );
}

export default function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { isSuperadmin, hasPermission, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-slate-500">${esc(L.loading)}</div>;
  if (!(isSuperadmin || hasPermission(permission))) return <ForbiddenPage missing={permission} />;
  return <>{children}</>;
}
`;
}

function buildUsersAdminPageConnected({ language } = {}) {
  const t = tFor(language);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API, useAuth } from '../../contexts/AuthContext';

interface UserRow {
  id: string;
  username: string;
  email: string;
  display_name: string;
  is_active: number | boolean;
}

interface GroupRow {
  id: string;
  name: string;
}

interface MembershipRow {
  id: string;
  user_id: string;
  group_id: string;
}

export default function UsersAdminPageConnected() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', email: '', display_name: '', password: '', is_active: true, group_ids: [] as string[] });
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    const [u, g, m] = await Promise.all([
      API.get('/__erp_users'),
      API.get('/__erp_groups'),
      API.get('/__erp_user_groups'),
    ]);
    setUsers(u.data);
    setGroups(g.data);
    setMemberships(m.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => { firstInputRef.current?.focus(); }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [showForm]);

  const groupMap = new Map(groups.map((g) => [g.id, g.name]));
  const userGroups = (userId: string) =>
    memberships.filter((m) => m.user_id === userId).map((m) => groupMap.get(m.group_id) || m.group_id);

  const isSuperadminUser = (userId: string) =>
    userGroups(userId).some((g) => String(g).toLowerCase() === 'superadmin');

  const filtered = users.filter((u) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return (
      (u.username || '').toLowerCase().includes(text) ||
      (u.email || '').toLowerCase().includes(text) ||
      (u.display_name || '').toLowerCase().includes(text) ||
      userGroups(u.id).join(' ').toLowerCase().includes(text)
    );
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ username: '', email: '', display_name: '', password: '', is_active: true, group_ids: [] });
    setShowForm(true);
  };

  const openEdit = (user: UserRow) => {
    setEditingUser(user);
    const gids = memberships.filter((m) => m.user_id === user.id).map((m) => m.group_id);
    setForm({ username: user.username, email: user.email || '', display_name: user.display_name || '', password: '', is_active: Number(user.is_active) !== 0, group_ids: gids });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    try {
      const payload: Record<string, any> = {
        username: form.username,
        email: form.email,
        display_name: form.display_name,
        is_active: form.is_active ? 1 : 0,
      };
      if (form.password) payload.password_hash = form.password;

      let userId: string;
      if (editingUser) {
        await API.put('/__erp_users/' + editingUser.id, payload);
        userId = editingUser.id;
      } else {
        if (!form.password) { alert('${esc(t('rbac.passwordRequired'))}'); return; }
        const { data } = await API.post('/__erp_users', payload);
        userId = data.id;
      }

      const existingMemberships = memberships.filter((m) => m.user_id === userId);
      for (const m of existingMemberships) {
        if (!form.group_ids.includes(m.group_id)) {
          await API.delete('/__erp_user_groups/' + m.id);
        }
      }
      const existingGids = new Set(existingMemberships.map((m) => m.group_id));
      for (const gid of form.group_ids) {
        if (!existingGids.has(gid)) {
          await API.post('/__erp_user_groups', { user_id: userId, group_id: gid });
        }
      }

      setShowForm(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Request failed');
    }
  };

  const toggleStatus = async (user: UserRow) => {
    try {
      await API.put('/__erp_users/' + user.id, { is_active: Number(user.is_active) === 0 ? 1 : 0 });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.error || e?.message || 'Request failed');
    }
  };

  const superadminGroup = groups.find((g) => String(g.name).toLowerCase() === 'superadmin');
  const superadminUserIds = superadminGroup
    ? [...new Set(memberships.filter((m) => m.group_id === superadminGroup.id).map((m) => m.user_id))]
    : [];
  const activeSuperadminIds = superadminUserIds.filter((uid) => {
    const u = users.find((x) => x.id === uid);
    return u && Number(u.is_active) !== 0;
  });
  const isEditingSelf = !!(editingUser && currentUser && editingUser.id === currentUser.id);
  const isLastActiveSuperadmin = !!(editingUser && activeSuperadminIds.length === 1 && activeSuperadminIds[0] === editingUser.id);
  const superadminGroupId = superadminGroup ? superadminGroup.id : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">${t('rbac.usersTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">${t('rbac.usersSubtitle')}</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">${t('rbac.addUser')}</button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="${t('rbac.searchUsers')}" className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />

      {showForm && createPortal((
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="font-semibold text-slate-900">{editingUser ? '${esc(t('rbac.editUser'))}' : '${esc(t('rbac.createUser'))}'}</h3>
              <button
                type="button"
                aria-label="${esc(t('rbac.close'))}"
                onClick={() => setShowForm(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input ref={firstInputRef} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="${t('rbac.username')}" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="${t('rbac.email')}" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="${t('rbac.displayName')}" className="rounded-lg border px-3 py-2 text-sm" />
                <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? '${esc(t('rbac.passwordKeep'))}' : '${esc(t('rbac.password'))}'} className="rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    disabled={(isEditingSelf && form.is_active) || (isLastActiveSuperadmin && form.is_active)}
                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 disabled:opacity-50"
                  />
                  ${t('rbac.active')}
                </label>
                {isEditingSelf && form.is_active && (
                  <p className="text-xs italic text-slate-500">${esc(t('rbac.cannotDeactivateSelf'))}</p>
                )}
                {!isEditingSelf && isLastActiveSuperadmin && form.is_active && (
                  <p className="text-xs italic text-slate-500">${esc(t('rbac.lastSuperadmin'))}</p>
                )}
              </div>
              <div>
                <div className="mb-1 text-sm font-medium text-slate-700">${t('rbac.roles')}</div>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const isSuperGroup = superadminGroupId !== null && g.id === superadminGroupId;
                    const isChecked = form.group_ids.includes(g.id);
                    const lockSelf = isEditingSelf && isSuperGroup && isChecked;
                    const lockLast = isSuperGroup && isChecked && isLastActiveSuperadmin;
                    const disabled = lockSelf || lockLast;
                    return (
                      <label key={g.id} className="inline-flex flex-col text-sm">
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={disabled}
                            onChange={(e) => {
                              setForm((f) => ({
                                ...f,
                                group_ids: e.target.checked ? [...f.group_ids, g.id] : f.group_ids.filter((id) => id !== g.id),
                              }));
                            }}
                            className="h-4 w-4 rounded border-slate-300 disabled:opacity-50"
                          />
                          {g.name}
                        </span>
                        {lockSelf && (
                          <span className="ml-5 text-[11px] italic text-slate-500">${esc(t('rbac.cannotDemoteSelf'))}</span>
                        )}
                        {!lockSelf && lockLast && (
                          <span className="ml-5 text-[11px] italic text-slate-500">${esc(t('rbac.lastSuperadmin'))}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">${t('rbac.cancel')}</button>
              <button onClick={handleSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">${t('rbac.save')}</button>
            </div>
          </div>
        </div>
      ), document.body)}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">${t('rbac.user')}</th>
              <th className="px-3 py-2">${t('rbac.roles')}</th>
              <th className="px-3 py-2">${t('rbac.status')}</th>
              <th className="px-3 py-2 text-right">${t('rbac.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isProtected = isSuperadminUser(user.id);
              const isSelf = !!(currentUser && user.id === currentUser.id);
              const isLastActive = activeSuperadminIds.length === 1 && activeSuperadminIds[0] === user.id;
              const canToggleStatus = !isProtected && !isSelf && !(isLastActive && Number(user.is_active) !== 0);
              return (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">
                    {user.display_name || user.username}
                    {isProtected && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">SUPERADMIN</span>}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-3 py-2 text-slate-700">{userGroups(user.id).join(', ') || '${esc(t('rbac.noRoles'))}'}</td>
                <td className="px-3 py-2">
                  <span className={\`rounded-full px-2 py-0.5 text-xs font-semibold \${Number(user.is_active) !== 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}\`}>
                    {Number(user.is_active) !== 0 ? '${esc(t('rbac.statusActive'))}' : '${esc(t('rbac.statusDisabled'))}'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => openEdit(user)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">${t('rbac.edit')}</button>
                    {canToggleStatus && (
                      <button onClick={() => toggleStatus(user)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">{Number(user.is_active) !== 0 ? '${esc(t('rbac.disable'))}' : '${esc(t('rbac.activate'))}'}</button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
}

function buildGroupsAdminPageConnected({ language } = {}) {
  const t = tFor(language);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const actionLabels = {
    create: t('rbac.actionCreate'),
    read: t('rbac.actionRead'),
    update: t('rbac.actionUpdate'),
    delete: t('rbac.actionDelete'),
  };
  const memberSingular = t('rbac.memberSingular');
  const memberPlural = t('rbac.memberPlural');
  const noDescription = t('rbac.noDescription');
  const permissionsWord = t('rbac.permissions');
  const searchRoles = t('rbac.searchRoles');
  const descriptionOptional = t('rbac.descriptionOptional');
  const whatCanThisRoleDo = t('rbac.whatCanThisRoleDo');
  const hideAdvanced = t('rbac.hideAdvanced');
  const showAdvancedLbl = t('rbac.showAdvanced');
  const manageRolesSub = t('rbac.manageRolesSub');
  const closeLbl = t('rbac.close');
  const systemLabels = {
    '__erp_users': t('sidebar.users'),
    '__erp_groups': t('sidebar.roles'),
    '__erp_permissions': t('sidebar.permissions'),
    '__erp_user_groups': t('rbac.roles'),
    '__erp_group_permissions': t('rbac.permissions'),
    '__audit_logs': t('activityLog.title'),
  };
  const builtinDescriptions = {
    superadmin: t('rbac.seedSuperadminDescription'),
    admin: t('rbac.seedAdminDescription'),
  };
  return `import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { API } from '../../contexts/AuthContext';
import { useAuth } from '../../contexts/AuthContext';
import { ENTITIES } from '../../config/entities';

interface GroupRow { id: string; name: string; description: string; }
interface MembershipRow { id: string; user_id: string; group_id: string; }
interface GPRow { id: string; group_id: string; permission_id: string; }
interface PermissionRow { id: string; key: string; label: string; scope: string; }

const ACTION_LABELS: Record<string, string> = {
  create: '${esc(actionLabels.create)}',
  read: '${esc(actionLabels.read)}',
  update: '${esc(actionLabels.update)}',
  delete: '${esc(actionLabels.delete)}',
};

const ENTITY_DISPLAY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayName])
);

const SYSTEM_ENTITY_DISPLAY: Record<string, string> = ${JSON.stringify(systemLabels, null, 2)};
const BUILTIN_ROLE_DESCRIPTIONS: Record<string, string> = ${JSON.stringify(builtinDescriptions, null, 2)};

function humanizeEntity(slug: string) {
  if (ENTITY_DISPLAY[slug]) return ENTITY_DISPLAY[slug];
  if (SYSTEM_ENTITY_DISPLAY[slug]) return SYSTEM_ENTITY_DISPLAY[slug];
  return slug
    .replace(/^__erp_/, '')
    .replace(/_/g, ' ')
    .replace(/\\b\\w/g, (c) => c.toUpperCase());
}

function roleDescription(group: GroupRow) {
  const key = String(group.name || '').trim().toLowerCase();
  if (BUILTIN_ROLE_DESCRIPTIONS[key]) return BUILTIN_ROLE_DESCRIPTIONS[key];
  const desc = String(group.description || '').trim();
  if (!desc) return '${esc(noDescription)}';
  if (
    desc === 'Full access to all entities and actions' ||
    desc === 'Full access (manageable admin group)' ||
    /^Admin for .+ module$/i.test(desc)
  ) {
    return '${esc(noDescription)}';
  }
  return desc;
}

export default function GroupsAdminPageConnected() {
  const { isSuperadmin } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [gps, setGps] = useState<GPRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [form, setForm] = useState({ name: '', description: '', permission_ids: [] as string[] });
  const [query, setQuery] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => { firstInputRef.current?.focus(); }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [showForm]);

  const load = useCallback(async () => {
    const [g, m, gp, p] = await Promise.all([
      API.get('/__erp_groups'),
      API.get('/__erp_user_groups'),
      API.get('/__erp_group_permissions'),
      API.get('/__erp_permissions'),
    ]);
    setGroups(g.data);
    setMemberships(m.data);
    setGps(gp.data);
    setPermissions(p.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const memberCount = (gid: string) => memberships.filter((m) => m.group_id === gid).length;
  const permCount = (gid: string) => gps.filter((gp) => gp.group_id === gid).length;

  const filtered = groups.filter((g) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return g.name.toLowerCase().includes(text) || (g.description || '').toLowerCase().includes(text);
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', permission_ids: [] });
    setShowForm(true);
  };

  const openEdit = (group: GroupRow) => {
    setEditing(group);
    const pids = gps.filter((gp) => gp.group_id === group.id).map((gp) => gp.permission_id);
    setForm({ name: group.name, description: group.description || '', permission_ids: pids });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    let groupId: string;
    if (editing) {
      await API.put('/__erp_groups/' + editing.id, { name: form.name, description: form.description });
      groupId = editing.id;
    } else {
      const { data } = await API.post('/__erp_groups', { name: form.name, description: form.description });
      groupId = data.id;
    }

    const existing = gps.filter((gp) => gp.group_id === groupId);
    for (const gp of existing) {
      if (!form.permission_ids.includes(gp.permission_id)) {
        await API.delete('/__erp_group_permissions/' + gp.id);
      }
    }
    const existingPids = new Set(existing.map((gp) => gp.permission_id));
    for (const pid of form.permission_ids) {
      if (!existingPids.has(pid)) {
        await API.post('/__erp_group_permissions', { group_id: groupId, permission_id: pid });
      }
    }

    setShowForm(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('${esc(t('rbac.confirmDeleteRole'))}')) return;
    await API.delete('/__erp_groups/' + id);
    await load();
  };

  const businessPerms = permissions.filter((p) => !p.key.startsWith('__'));
  const systemPerms = permissions.filter((p) => p.key.startsWith('__'));

  const permsByEntity = businessPerms.reduce((acc, p) => {
    const parts = p.key.split('.');
    const entity = parts.length > 1 ? parts.slice(0, -1).join('.') : 'other';
    if (!acc[entity]) acc[entity] = [];
    acc[entity].push(p);
    return acc;
  }, {} as Record<string, PermissionRow[]>);

  const systemPermsByEntity = systemPerms.reduce((acc, p) => {
    const parts = p.key.split('.');
    const entity = parts.length > 1 ? parts.slice(0, -1).join('.') : 'other';
    if (!acc[entity]) acc[entity] = [];
    acc[entity].push(p);
    return acc;
  }, {} as Record<string, PermissionRow[]>);

  const renderPermBlock = (entityPerms: Record<string, PermissionRow[]>) =>
    Object.entries(entityPerms).map(([entity, perms]) => {
      const entityPermIds = perms.map((p) => p.id);
      const selectedCount = entityPermIds.filter((id) => form.permission_ids.includes(id)).length;
      const allSelected = selectedCount === entityPermIds.length;
      const someSelected = selectedCount > 0 && !allSelected;
      const toggleEntity = () => {
        setForm((f) => {
          if (allSelected) {
            return { ...f, permission_ids: f.permission_ids.filter((id) => !entityPermIds.includes(id)) };
          }
          const merged = new Set([...f.permission_ids, ...entityPermIds]);
          return { ...f, permission_ids: [...merged] };
        });
      };
      return (
        <div key={entity} className="rounded-lg border border-slate-200 p-3">
          <label className="mb-2 inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = someSelected; }} onChange={toggleEntity} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-800">{humanizeEntity(entity)}</span>
            <span className="text-xs text-slate-400">{selectedCount}/{entityPermIds.length}</span>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1 ml-6">
            {perms.map((p) => {
              const action = p.key.split('.').pop() || p.key;
              return (
                <label key={p.id} className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <input type="checkbox" checked={form.permission_ids.includes(p.id)} onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      permission_ids: e.target.checked ? [...f.permission_ids, p.id] : f.permission_ids.filter((id) => id !== p.id),
                    }));
                  }} className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600" />
                  {ACTION_LABELS[action] || (action.charAt(0).toUpperCase() + action.slice(1))}
                </label>
              );
            })}
          </div>
        </div>
      );
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">${t('rbac.roles')}</h2>
          <p className="mt-1 text-sm text-slate-500">${esc(manageRolesSub)}</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">${t('rbac.addRole')}</button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="${esc(searchRoles)}" className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />

      {showForm && createPortal((
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h3 className="font-semibold text-slate-900">{editing ? '${esc(t('rbac.editRole'))}' : '${esc(t('rbac.createRole'))}'}</h3>
              <button
                type="button"
                aria-label="${esc(closeLbl)}"
                onClick={() => setShowForm(false)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input ref={firstInputRef} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="${esc(t('rbac.roleName'))}" className="rounded-lg border px-3 py-2 text-sm" />
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="${esc(descriptionOptional)}" className="rounded-lg border px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">${esc(whatCanThisRoleDo)}</div>
                <div className="space-y-2">
                  {renderPermBlock(permsByEntity)}
                </div>
              </div>
              {isSuperadmin && Object.keys(systemPermsByEntity).length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    {showAdvanced ? '${esc(hideAdvanced)}' : '${esc(showAdvancedLbl)}'}
                  </button>
                  {showAdvanced && (
                    <div className="mt-2 space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
                      {renderPermBlock(systemPermsByEntity)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">${t('rbac.cancel')}</button>
              <button onClick={handleSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">${t('rbac.save')}</button>
            </div>
          </div>
        </div>
      ), document.body)}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map((group) => (
          <article key={group.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
              <div className="text-xs text-slate-500">{memberCount(group.id)} {memberCount(group.id) === 1 ? '${esc(memberSingular)}' : '${esc(memberPlural)}'}</div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{roleDescription(group)}</p>
            <div className="mt-2 text-xs text-slate-600">${esc(permissionsWord)}: <span className="font-semibold">{permCount(group.id)}</span></div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => openEdit(group)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">${t('rbac.edit')}</button>
              {String(group.name).toLowerCase() !== 'superadmin' && String(group.name).toLowerCase() !== 'admin' && (
                <button onClick={() => handleDelete(group.id)} className="rounded border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">${t('rbac.delete')}</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
`;
}

function buildPermissionsAdminPageConnected({ language } = {}) {
  const t = tFor(language);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const L = {
    title: t('rbac.permissionsManagementTitle'),
    subtitle: t('rbac.permissionsManagementSubtitle'),
    addPermission: t('rbac.addPermission'),
    showGlobalOnly: t('rbac.showGlobalOnly'),
    editPermission: t('rbac.editPermission'),
    createPermission: t('rbac.createPermission'),
    permissionKey: t('rbac.permissionKey'),
    label: t('rbac.permissionLabel'),
    description: t('rbac.description'),
    scopeModule: t('rbac.scopeModule'),
    scopeGlobal: t('rbac.scopeGlobal'),
    save: t('rbac.save'),
    cancel: t('rbac.cancel'),
    permission: t('rbac.permission'),
    scope: t('rbac.scope'),
    usedByGroups: t('rbac.usedByGroups'),
    actions: t('rbac.actions'),
    edit: t('rbac.edit'),
  };
  return `import { useEffect, useState, useCallback } from 'react';
import { API } from '../../contexts/AuthContext';

interface PermissionRow { id: string; key: string; label: string; scope: string; description: string; }
interface GPRow { id: string; group_id: string; permission_id: string; }

export default function PermissionsAdminPageConnected() {
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [gps, setGps] = useState<GPRow[]>([]);
  const [showCritical, setShowCritical] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PermissionRow | null>(null);
  const [form, setForm] = useState({ key: '', label: '', scope: 'module', description: '' });

  const load = useCallback(async () => {
    const [p, gp] = await Promise.all([
      API.get('/__erp_permissions'),
      API.get('/__erp_group_permissions'),
    ]);
    setPermissions(p.data);
    setGps(gp.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groupCount = (pid: string) => gps.filter((gp) => gp.permission_id === pid).length;

  const filtered = showCritical ? permissions.filter((p) => p.scope === 'global') : permissions;

  const openEdit = (perm: PermissionRow) => {
    setEditing(perm);
    setForm({ key: perm.key, label: perm.label || '', scope: perm.scope || 'module', description: perm.description || '' });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ key: '', label: '', scope: 'module', description: '' });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (editing) {
      await API.put('/__erp_permissions/' + editing.id, form);
    } else {
      await API.post('/__erp_permissions', form);
    }
    setShowForm(false);
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">${esc(L.title)}</h2>
          <p className="mt-1 text-sm text-slate-500">${esc(L.subtitle)}</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">${esc(L.addPermission)}</button>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={showCritical} onChange={(e) => setShowCritical(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        ${esc(L.showGlobalOnly)}
      </label>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-900">{editing ? '${esc(L.editPermission)}' : '${esc(L.createPermission)}'}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="${esc(L.permissionKey)}" className="rounded-lg border px-3 py-2 text-sm" disabled={!!editing} />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="${esc(L.label)}" className="rounded-lg border px-3 py-2 text-sm" />
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
              <option value="module">${esc(L.scopeModule)}</option>
              <option value="global">${esc(L.scopeGlobal)}</option>
            </select>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="${esc(L.description)}" className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">${esc(L.save)}</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">${esc(L.cancel)}</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">${esc(L.permission)}</th>
              <th className="px-3 py-2">${esc(L.scope)}</th>
              <th className="px-3 py-2">${esc(L.usedByGroups)}</th>
              <th className="px-3 py-2 text-right">${esc(L.actions)}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((perm) => (
              <tr key={perm.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">{perm.label || perm.key}</div>
                  <div className="text-xs text-slate-500">{perm.key}{perm.description ? ' - ' + perm.description : ''}</div>
                </td>
                <td className="px-3 py-2">
                  <span className={\`rounded-full px-2 py-0.5 text-xs font-semibold \${perm.scope === 'global' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-700'}\`}>{perm.scope}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">{groupCount(perm.id)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => openEdit(perm)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">${esc(L.edit)}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`;
}

// Plan B follow-up #5: emits src/utils/scopeEvaluator.ts — a tiny TS port of
// the server-side scopeEvaluator used by AuthContext.hasScope. Pure function;
// no React imports. Kept structurally identical to the Node version so that
// a server-pass and a client-pass over the same row always agree.
function buildScopeEvaluatorClient() {
  return `// Auto-generated by FrontendGenerator (rbacPages.js).
// Mirrors brick-library/backend-bricks/rbac/scopeEvaluator.js.

interface Actor {
  employee_id?: string | null;
  department_id?: string | null;
  manager_chain?: string[];
  isSuperadmin?: boolean;
  userId?: string | null;
  id?: string | null;
}

const DEFAULT_SELF_FIELDS = ['employee_id', 'requested_by', 'created_by', 'submitted_by'];
const DEFAULT_DEPT_FIELDS = ['department_id'];
const DEFAULT_ROW_EMPLOYEE_FIELDS = ['employee_id', 'requested_by', 'submitted_by'];

export function evaluateScopeClient(
  scope: string,
  actor: Actor,
  row: Record<string, any> | null,
  options?: { actorFields?: string[]; departmentFields?: string[]; rowEmployeeFields?: string[] }
): boolean {
  if (!actor) return false;
  if (actor.isSuperadmin === true) return true;
  const kind = String(scope || '').trim().toLowerCase();

  if (kind === 'all' || kind === 'module') return true;

  if (kind === 'self') {
    if (!row) return true;
    const actorEmp = actor.employee_id || null;
    const actorUser = actor.userId || actor.id || null;
    const fields = (options?.actorFields && options.actorFields.length) ? options.actorFields : DEFAULT_SELF_FIELDS;
    for (const f of fields) {
      const v = row[f];
      if (v === undefined || v === null) continue;
      if (actorEmp && String(v) === String(actorEmp)) return true;
      if (actorUser && String(v) === String(actorUser)) return true;
    }
    return false;
  }

  if (kind === 'department') {
    if (!row) return true;
    const actorDept = actor.department_id || null;
    if (!actorDept) return false;
    const fields = (options?.departmentFields && options.departmentFields.length) ? options.departmentFields : DEFAULT_DEPT_FIELDS;
    for (const f of fields) {
      const v = row[f];
      if (v && String(v) === String(actorDept)) return true;
    }
    return false;
  }

  if (kind === 'manager_chain') {
    if (!row) return true;
    const actorEmp = actor.employee_id || null;
    if (!actorEmp) return false;
    const fields = (options?.rowEmployeeFields && options.rowEmployeeFields.length) ? options.rowEmployeeFields : DEFAULT_ROW_EMPLOYEE_FIELDS;
    let rowEmp: string | null = null;
    for (const f of fields) {
      const v = row[f];
      if (v !== undefined && v !== null && v !== '') { rowEmp = String(v); break; }
    }
    if (!rowEmp) return false;
    if (rowEmp === String(actorEmp)) return true;
    // The client gets a pre-resolved manager_chain at login. If row's
    // employee is the actor or anywhere in the chain, allow. Otherwise we
    // can't walk the DB from the browser, so deny — the server-side
    // middleware is the authoritative gate.
    const chain = actor.manager_chain || [];
    for (const id of chain) {
      if (String(id) === rowEmp) return true;
    }
    return false;
  }

  return false;
}
`;
}

module.exports = {
  buildAuthContext,
  buildLoginPage,
  buildRequireAuth,
  buildRequirePermission,
  buildUsersAdminPageConnected,
  buildGroupsAdminPageConnected,
  buildPermissionsAdminPageConnected,
  buildScopeEvaluatorClient,
};
