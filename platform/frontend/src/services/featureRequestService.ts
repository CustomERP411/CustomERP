import api from './api';

export type FeatureStatus = 'recorded' | 'denied' | 'in_progress' | 'completed';
export type FeatureSource = 'chatbot' | 'sdf_generation';

export interface FeatureRequest {
  id: string;
  feature_name: string;
  feature_name_normalized: string;
  source: FeatureSource;
  source_detail: string | null;
  user_prompt: string | null;
  user_id: string;
  project_id: string | null;
  status: FeatureStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  project_name?: string | null;
}

export interface FeatureRequestMessage {
  id: string;
  feature_request_id: string;
  sender_id: string;
  sender_role: 'admin' | 'user';
  sender_name?: string;
  sender_email?: string;
  body: string;
  created_at: string;
}

export interface FeatureRequestDetail extends FeatureRequest {
  messages: FeatureRequestMessage[];
}

export interface FeatureRequestStats {
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  top_requested: { feature: string; count: number }[];
}

export interface FeatureRequestListResponse {
  total: number;
  requests: FeatureRequest[];
}

export const featureRequestService = {
  listAll: async (params: {
    status?: string;
    source?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<FeatureRequestListResponse> => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.source) query.set('source', params.source);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    const res = await api.get<FeatureRequestListResponse>(`/admin/feature-requests${qs ? `?${qs}` : ''}`);
    return res.data;
  },

  getStats: async (): Promise<FeatureRequestStats> => {
    const res = await api.get<FeatureRequestStats>('/admin/feature-requests/stats');
    return res.data;
  },

  getDetail: async (id: string): Promise<FeatureRequestDetail> => {
    const res = await api.get<FeatureRequestDetail>(`/admin/feature-requests/${id}`);
    return res.data;
  },

  updateStatus: async (id: string, data: {
    status: FeatureStatus;
    admin_notes?: string | null;
  }): Promise<FeatureRequest> => {
    const res = await api.put<FeatureRequest>(`/admin/feature-requests/${id}`, data);
    return res.data;
  },

  addAdminMessage: async (id: string, body: string): Promise<FeatureRequestMessage> => {
    const res = await api.post<FeatureRequestMessage>(`/admin/feature-requests/${id}/messages`, { body });
    return res.data;
  },

  listMine: async (): Promise<{ requests: FeatureRequest[] }> => {
    const res = await api.get<{ requests: FeatureRequest[] }>('/my/feature-requests');
    return res.data;
  },

  getMyDetail: async (id: string): Promise<FeatureRequestDetail> => {
    const res = await api.get<FeatureRequestDetail>(`/my/feature-requests/${id}`);
    return res.data;
  },

  addUserMessage: async (id: string, body: string): Promise<FeatureRequestMessage> => {
    const res = await api.post<FeatureRequestMessage>(`/my/feature-requests/${id}/messages`, { body });
    return res.data;
  },
};
