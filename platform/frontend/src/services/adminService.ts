import api from './api';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  blocked: boolean;
  block_reason: string | null;
}

export interface AdminProject {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

export const adminService = {
  getUsers: async (): Promise<AdminUser[]> => {
    const res = await api.get<{ users: AdminUser[] }>('/admin');
    return res.data.users;
  },

  getAllProjects: async (): Promise<AdminProject[]> => {
    const res = await api.get<{ projects: AdminProject[] }>('/admin/projects');
    return res.data.projects;
  },

  setAdminStatus: async (userId: string, is_admin: boolean): Promise<AdminUser> => {
    const res = await api.put<{ user: AdminUser }>(`/admin/${userId}/admin`, { is_admin });
    return res.data.user;
  },

  blockUser: async (userId: string, reason?: string): Promise<AdminUser> => {
    const res = await api.put<{ user: AdminUser }>(`/admin/${userId}/block`, { reason });
    return res.data.user;
  },

  unblockUser: async (userId: string): Promise<AdminUser> => {
    const res = await api.put<{ user: AdminUser }>(`/admin/${userId}/unblock`);
    return res.data.user;
  },
};
