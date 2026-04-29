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
  // Plan K §K4 — bilingual storage. `name_en` is the canonical English
  // label (drives dedup); `name_native` is the localized version captured
  // at submission time; `language` is the project language at that moment.
  // All three are nullable for backwards compatibility with rows that
  // existed before migration 017.
  name_en?: string | null;
  name_native?: string | null;
  language?: string | null;
}

/**
 * Plan K §K5 — pick the best label for a feature request given the user's
 * current UI language. Prefers the localized `name_native` when the row's
 * stored language matches the current viewing language; falls back to the
 * canonical `name_en`, then to the legacy `feature_name` column for rows
 * created before migration 017.
 */
export function resolveFeatureName(
  fr: Pick<FeatureRequest, 'name_en' | 'name_native' | 'language' | 'feature_name'>,
  currentLang: string,
): string {
  const lang = (currentLang || 'en').toLowerCase();
  const rowLang = (fr.language || '').toLowerCase();
  if (rowLang && rowLang === lang && fr.name_native) {
    return fr.name_native;
  }
  return fr.name_en || fr.feature_name || '';
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
