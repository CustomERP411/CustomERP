function buildAuthContext() {
  return `import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import axios from 'axios';

interface AuthUser {
  id: string;
  username: string;
  email: string;
  display_name: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  permissions: string[];
  isSuperadmin: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
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
      });
    } catch {
      setToken(null);
      setState({ user: null, token: null, permissions: [], isSuperadmin: false, loading: false });
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

  const logout = () => {
    setToken(null);
    setState({ user: null, token: null, permissions: [], isSuperadmin: false, loading: false });
  };

  const hasPermission = (key: string) => state.isSuperadmin || state.permissions.includes(key);

  useEffect(() => {
    const id = API.interceptors.request.use((config) => {
      if (state.token) config.headers.Authorization = 'Bearer ' + state.token;
      return config;
    });
    return () => API.interceptors.request.eject(id);
  }, [state.token]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission }}>
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

function buildLoginPage() {
  return `import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm text-slate-500">Loading...</div>
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
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border bg-white p-8 shadow-lg"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Sign In</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your credentials to continue</p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
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
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
          <p className="text-sm font-medium text-blue-800">
            <span className="inline-block mr-1">&#128273;</span>
            Default login: <strong>admin</strong> / <strong>admin</strong>
          </p>
          <p className="text-xs text-blue-600 mt-1">You can change this after signing in via Settings.</p>
        </div>
      </form>
    </div>
  );
}
`;
}

function buildRequireAuth() {
  return `import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-sm text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
`;
}

function buildUsersAdminPageConnected() {
  return `import { useEffect, useState, useCallback } from 'react';
import { API } from '../../contexts/AuthContext';

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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', email: '', display_name: '', password: '', is_active: true, group_ids: [] as string[] });

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
      if (!form.password) { alert('Password is required for new users'); return; }
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
  };

  const toggleStatus = async (user: UserRow) => {
    await API.put('/__erp_users/' + user.id, { is_active: Number(user.is_active) === 0 ? 1 : 0 });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">Add, edit, or deactivate users and assign their roles.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Add User</button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />

      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-900">{editingUser ? 'Edit User' : 'Create User'}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" className="rounded-lg border px-3 py-2 text-sm" />
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="rounded-lg border px-3 py-2 text-sm" />
            <input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Display Name" className="rounded-lg border px-3 py-2 text-sm" />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? 'New password (leave blank to keep)' : 'Password'} className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Active
          </label>
          <div>
            <div className="mb-1 text-sm font-medium text-slate-700">Roles</div>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <label key={g.id} className="inline-flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={form.group_ids.includes(g.id)} onChange={(e) => {
                    setForm((f) => ({
                      ...f,
                      group_ids: e.target.checked ? [...f.group_ids, g.id] : f.group_ids.filter((id) => id !== g.id),
                    }));
                  }} className="h-4 w-4 rounded border-slate-300" />
                  {g.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isProtected = isSuperadminUser(user.id);
              return (
              <tr key={user.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-900">
                    {user.display_name || user.username}
                    {isProtected && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">SUPERADMIN</span>}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-3 py-2 text-slate-700">{userGroups(user.id).join(', ') || 'No roles'}</td>
                <td className="px-3 py-2">
                  <span className={\`rounded-full px-2 py-0.5 text-xs font-semibold \${Number(user.is_active) !== 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}\`}>
                    {Number(user.is_active) !== 0 ? 'active' : 'disabled'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button onClick={() => openEdit(user)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
                    {!isProtected && (
                      <button onClick={() => toggleStatus(user)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">{Number(user.is_active) !== 0 ? 'Disable' : 'Activate'}</button>
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

function buildGroupsAdminPageConnected() {
  return `import { useEffect, useState, useCallback } from 'react';
import { API } from '../../contexts/AuthContext';
import { useAuth } from '../../contexts/AuthContext';
import { ENTITIES } from '../../config/entities';

interface GroupRow { id: string; name: string; description: string; }
interface MembershipRow { id: string; user_id: string; group_id: string; }
interface GPRow { id: string; group_id: string; permission_id: string; }
interface PermissionRow { id: string; key: string; label: string; scope: string; }

const ACTION_LABELS: Record<string, string> = {
  create: 'Add',
  read: 'View',
  update: 'Edit',
  delete: 'Remove',
};

const ENTITY_DISPLAY: Record<string, string> = Object.fromEntries(
  ENTITIES.map((e) => [e.slug, e.displayName])
);

function humanizeEntity(slug: string) {
  if (ENTITY_DISPLAY[slug]) return ENTITY_DISPLAY[slug];
  return slug
    .replace(/^__erp_/, '')
    .replace(/_/g, ' ')
    .replace(/\\b\\w/g, (c) => c.toUpperCase());
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
    if (!confirm('Delete this role?')) return;
    await API.delete('/__erp_groups/' + id);
    await load();
  };

  const businessPerms = permissions.filter((p) => !p.key.startsWith('__erp_'));
  const systemPerms = permissions.filter((p) => p.key.startsWith('__erp_'));

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
          <h2 className="text-lg font-semibold text-slate-900">Roles</h2>
          <p className="mt-1 text-sm text-slate-500">Manage roles and what each role can do.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Add Role</button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search roles..." className="w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />

      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-900">{editing ? 'Edit Role' : 'Create Role'}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Role name" className="rounded-lg border px-3 py-2 text-sm" />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (optional)" className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-slate-700">What can this role do?</div>
            <div className="max-h-80 overflow-y-auto space-y-2">
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
                {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
              </button>
              {showAdvanced && (
                <div className="mt-2 max-h-48 overflow-y-auto space-y-2 rounded-lg border border-dashed border-slate-300 p-3">
                  {renderPermBlock(systemPermsByEntity)}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filtered.map((group) => (
          <article key={group.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
              <div className="text-xs text-slate-500">{memberCount(group.id)} {memberCount(group.id) === 1 ? 'member' : 'members'}</div>
            </div>
            <p className="mt-1 text-xs text-slate-500">{group.description || 'No description'}</p>
            <div className="mt-2 text-xs text-slate-600">Permissions: <span className="font-semibold">{permCount(group.id)}</span></div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button onClick={() => openEdit(group)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
              {String(group.name).toLowerCase() !== 'superadmin' && String(group.name).toLowerCase() !== 'admin' && (
                <button onClick={() => handleDelete(group.id)} className="rounded border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">Delete</button>
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

function buildPermissionsAdminPageConnected() {
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
          <h2 className="text-lg font-semibold text-slate-900">Permission Management</h2>
          <p className="mt-1 text-sm text-slate-500">Review and manage available permissions.</p>
        </div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">Add Permission</button>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={showCritical} onChange={(e) => setShowCritical(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        Show global permissions only
      </label>

      {showForm && (
        <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-900">{editing ? 'Edit Permission' : 'Create Permission'}</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="Permission key" className="rounded-lg border px-3 py-2 text-sm" disabled={!!editing} />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label" className="rounded-lg border px-3 py-2 text-sm" />
            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
              <option value="module">Module</option>
              <option value="global">Global</option>
            </select>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" className="rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save</button>
            <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Permission</th>
              <th className="px-3 py-2">Scope</th>
              <th className="px-3 py-2">Used By Groups</th>
              <th className="px-3 py-2 text-right">Actions</th>
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
                  <button onClick={() => openEdit(perm)} className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">Edit</button>
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

module.exports = {
  buildAuthContext,
  buildLoginPage,
  buildRequireAuth,
  buildUsersAdminPageConnected,
  buildGroupsAdminPageConnected,
  buildPermissionsAdminPageConnected,
};
