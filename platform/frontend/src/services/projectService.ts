import api from './api';
import type { Project, CreateProjectRequest } from '../types/project';
import type { AnalyzeProjectResponse, ClarificationAnswer, AiGatewaySdf } from '../types/aiGateway';

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

  updateProject: async (
    id: string,
    data: Partial<CreateProjectRequest> & { description?: string | null; status?: Project['status'] }
  ): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  analyzeProject: async (id: string, description: string): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/analyze`, { description });
    return response.data;
  },

  clarifyProject: async (
    id: string,
    partialSdf: AiGatewaySdf,
    answers: ClarificationAnswer[],
    description?: string
  ): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/clarify`, {
      partial_sdf: partialSdf,
      answers,
      ...(description ? { description } : {}),
    });
    return response.data;
  },

  getLatestSdf: async (id: string): Promise<{ sdf: AiGatewaySdf | null; sdf_version: number | null }> => {
    const response = await api.get<{ sdf: AiGatewaySdf | null; sdf_version: number | null }>(`/projects/${id}/sdf/latest`);
    return response.data;
  },

  saveSdf: async (id: string, sdf: AiGatewaySdf): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/sdf/save`, { sdf });
    return response.data;
  },

  aiEditSdf: async (id: string, instructions: string, currentSdf?: AiGatewaySdf): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/sdf/ai-edit`, {
      instructions,
      ...(currentSdf ? { current_sdf: currentSdf } : {}),
    });
    return response.data;
  },

  generateErpZip: async (id: string): Promise<Blob> => {
    const response = await api.post(`/projects/${id}/generate`, {}, { responseType: 'blob' });
    return response.data as Blob;
  },
};

