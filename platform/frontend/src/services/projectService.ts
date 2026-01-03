import api from './api';
import type { Project, CreateProjectRequest } from '../types/project';

export const projectService = {
  getProjects: async (): Promise<Project[]> => {
    const response = await api.get<{ projects: Project[] }>('/projects');
    return response.data.projects;
  },

  createProject: async (data: CreateProjectRequest): Promise<Project> => {
    const response = await api.post<Project>('/projects', data);
    return response.data;
  },

  getProject: async (id: string): Promise<Project> => {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  },

  updateProject: async (id: string, data: Partial<CreateProjectRequest>): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};

