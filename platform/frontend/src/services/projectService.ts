import api from './api';
import type { Project, CreateProjectRequest } from '../types/project';
import type { AnalyzeProjectResponse, AnswerReview, ClarificationAnswer, AiGatewaySdf } from '../types/aiGateway';
import type { DefaultQuestionStateResponse, SaveDefaultAnswersRequest } from '../types/defaultQuestions';
import type { ReviewHistoryItem } from '../components/project/ReviewApprovalPanel';

export interface ReviewSummaryResponse {
  entityCount: number;
  fieldCount: number;
  relationCount: number;
  moduleSummaries: { name: string; entityCount: number }[];
  entities: { slug: string; fieldCount: number; relationFields: unknown[] }[];
  warnings: string[];
  sdfVersion: number;
  projectStatus: string;
}

export interface ReviewActionResponse {
  project: Project;
  approval: {
    id: string;
    decision: string;
    sdf_version: number | null;
    resulting_sdf_version: number | null;
    comments: string | null;
    revision_instructions: string | null;
    decided_at: string;
  };
}

export interface RevisionResponse {
  project: Project;
  approval?: ReviewActionResponse['approval'];
  sdf?: AiGatewaySdf;
  sdf_version?: number;
  questions?: unknown[];
  status?: 'change_review_required';
  answer_review?: AnswerReview;
}

export interface ChatWithProjectResponse {
  reply: string;
  suggested_modules: string[];
  discussion_points: string[];
  confidence: 'low' | 'medium' | 'high';
  unsupported_features: string[];
}

export interface ProjectConversationRecord {
  id: string;
  project_id: string;
  sdf_version: number | null;
  mode: 'chat' | 'build';
  business_answers: Record<string, unknown> | null;
  selected_modules: string[] | null;
  access_requirements: unknown[] | null;
  description_snapshot: string | null;
  default_question_answers: Record<string, unknown> | null;
  answer_review: AnswerReview | null;
  acknowledged_unsupported_features: string[] | null;
  created_at: string;
}

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
    data: Partial<CreateProjectRequest> & { description?: string | null; status?: Project['status']; mode?: Project['mode'] }
  ): Promise<Project> => {
    const response = await api.put<Project>(`/projects/${id}`, data);
    return response.data;
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },

  analyzeProject: async (
    id: string,
    description: string,
    options?: {
      modules?: string[];
      default_question_answers?: Record<string, unknown>;
      prefilled_sdf?: AiGatewaySdf;
      conversation_context?: {
        business_answers?: Record<string, { question: string; answer: string }>;
        access_requirements?: { name: string; user_count: string; responsibilities: string; permissions: string[]; custom_permissions: string }[];
      };
      acknowledged_unsupported_features?: string[];
    }
  ): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/analyze`, {
      description,
      ...(options?.modules?.length ? { modules: options.modules } : {}),
      ...(options?.default_question_answers ? { default_question_answers: options.default_question_answers } : {}),
      ...(options?.prefilled_sdf ? { prefilled_sdf: options.prefilled_sdf } : {}),
      ...(options?.conversation_context ? { conversation_context: options.conversation_context } : {}),
      ...(options?.acknowledged_unsupported_features?.length
        ? { acknowledged_unsupported_features: options.acknowledged_unsupported_features }
        : {}),
    }, { timeout: 300000 });
    return response.data;
  },

  getDefaultQuestions: async (id: string, modules: string[]): Promise<DefaultQuestionStateResponse> => {
    const params = new URLSearchParams();
    if (Array.isArray(modules) && modules.length) {
      params.set('modules', modules.join(','));
    }
    const query = params.toString();
    const response = await api.get<DefaultQuestionStateResponse>(
      `/projects/${id}/default-questions${query ? `?${query}` : ''}`
    );
    return response.data;
  },

  saveDefaultAnswers: async (id: string, payload: SaveDefaultAnswersRequest): Promise<DefaultQuestionStateResponse> => {
    const response = await api.post<DefaultQuestionStateResponse>(`/projects/${id}/default-questions/answers`, payload);
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
    }, { timeout: 300000 });
    return response.data;
  },

  getLatestSdf: async (id: string): Promise<{ sdf: AiGatewaySdf | null; sdf_version: number | null }> => {
    const response = await api.get<{ sdf: AiGatewaySdf | null; sdf_version: number | null }>(`/projects/${id}/sdf/latest`);
    return response.data;
  },

  getGenerationProgress: async (id: string): Promise<{ step: string; pct: number; detail: string }> => {
    const response = await api.get<{ step: string; pct: number; detail: string }>(`/projects/${id}/analyze/progress`);
    return response.data;
  },

  saveSdf: async (id: string, sdf: AiGatewaySdf): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/sdf/save`, { sdf });
    return response.data;
  },

  regenerateProject: async (id: string, changeInstructions: string, acknowledgedUnsupportedFeatures?: string[]): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/regenerate`, {
      change_instructions: changeInstructions,
      ...(acknowledgedUnsupportedFeatures?.length
        ? { acknowledged_unsupported_features: acknowledgedUnsupportedFeatures }
        : {}),
    }, { timeout: 300000 });
    return response.data;
  },

  aiEditSdf: async (id: string, instructions: string, currentSdf?: AiGatewaySdf, acknowledgedUnsupportedFeatures?: string[]): Promise<AnalyzeProjectResponse> => {
    const response = await api.post<AnalyzeProjectResponse>(`/projects/${id}/sdf/ai-edit`, {
      instructions,
      ...(currentSdf ? { current_sdf: currentSdf } : {}),
      ...(acknowledgedUnsupportedFeatures?.length
        ? { acknowledged_unsupported_features: acknowledgedUnsupportedFeatures }
        : {}),
    });
    return response.data;
  },

  generateErpZip: async (id: string): Promise<Blob> => {
    const response = await api.post(`/projects/${id}/generate`, {}, { responseType: 'blob' });
    return response.data as Blob;
  },

  generateStandaloneErpZip: async (id: string, platform: string): Promise<Blob> => {
    const response = await api.post(
      `/projects/${id}/generate/standalone?platform=${encodeURIComponent(platform)}`,
      {},
      { responseType: 'blob', timeout: 300000 },
    );
    return response.data as Blob;
  },

  getReviewSummary: async (id: string): Promise<ReviewSummaryResponse> => {
    const response = await api.get<ReviewSummaryResponse>(`/projects/${id}/review/summary`);
    return response.data;
  },

  approveReview: async (id: string, comments?: string): Promise<ReviewActionResponse> => {
    const response = await api.post<ReviewActionResponse>(`/projects/${id}/review/approve`, {
      ...(comments ? { comments } : {}),
    });
    return response.data;
  },

  rejectReview: async (id: string, comments?: string): Promise<ReviewActionResponse> => {
    const response = await api.post<ReviewActionResponse>(`/projects/${id}/review/reject`, {
      ...(comments ? { comments } : {}),
    });
    return response.data;
  },

  requestRevision: async (id: string, instructions: string, comments?: string, acknowledgedUnsupportedFeatures?: string[]): Promise<RevisionResponse> => {
    const response = await api.post<RevisionResponse>(`/projects/${id}/review/revise`, {
      instructions,
      ...(comments ? { comments } : {}),
      ...(acknowledgedUnsupportedFeatures?.length
        ? { acknowledged_unsupported_features: acknowledgedUnsupportedFeatures }
        : {}),
    });
    return response.data;
  },

  getReviewHistory: async (id: string): Promise<{ history: ReviewHistoryItem[] }> => {
    const response = await api.get<{ history: ReviewHistoryItem[] }>(`/projects/${id}/review/history`);
    return response.data;
  },

  getConversations: async (id: string): Promise<{ conversations: ProjectConversationRecord[] }> => {
    const response = await api.get<{ conversations: ProjectConversationRecord[] }>(`/projects/${id}/conversations`);
    return response.data;
  },

  startPreview: async (id: string): Promise<{ previewId: string; status: string }> => {
    const response = await api.post<{ previewId: string; status: string }>(
      `/projects/${id}/preview/start`,
      {},
      { timeout: 300000 },
    );
    return response.data;
  },

  getPreviewStatus: async (
    id: string,
  ): Promise<{
    previewId?: string;
    status: 'none' | 'queued' | 'building' | 'running' | 'error' | 'stopped';
    phase?: string;
    queuePosition?: number;
    errorCode?: string;
    error?: string;
    iframeToken?: string;
  }> => {
    const response = await api.get(`/projects/${id}/preview/status`);
    return response.data;
  },

  stopPreview: async (id: string): Promise<{ status: string }> => {
    const response = await api.delete<{ status: string }>(`/projects/${id}/preview/stop`);
    return response.data;
  },

  heartbeatPreview: async (id: string): Promise<void> => {
    await api.post(`/projects/${id}/preview/heartbeat`);
  },

  chatWithProject: async (
    id: string,
    message: string,
    options?: {
      conversation_history?: { role: string; content: string }[];
      selected_modules?: string[];
      business_answers?: Record<string, unknown>;
      current_step?: string;
      sdf_status?: string;
    }
  ): Promise<ChatWithProjectResponse> => {
    const response = await api.post<ChatWithProjectResponse>(`/projects/${id}/chat`, {
      message,
      conversation_history: options?.conversation_history ?? [],
      selected_modules: options?.selected_modules ?? [],
      business_answers: options?.business_answers ?? null,
      current_step: options?.current_step ?? null,
      sdf_status: options?.sdf_status ?? null,
    }, { timeout: 60000 });
    return response.data;
  },
};

