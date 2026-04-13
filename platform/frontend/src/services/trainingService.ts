import api from './api';

export interface SessionSummary {
  session_id: string;
  timestamp: string;
  endpoint: string;
  description_snippet: string;
  step_count: number;
  agents: string[];
  token_usage: Record<string, any>;
  quality: 'good' | 'bad' | 'needs_edit' | null;
  reviewed: boolean;
  is_exported: boolean;
}

export interface StepLog {
  agent: string;
  model: string;
  temperature: number;
  prompt_text: string;
  input_summary: Record<string, any>;
  output_parsed: Record<string, any>;
  raw_response: string;
  tokens_in: number;
  tokens_out: number;
  duration_ms: number;
}

export interface SessionReview {
  quality: 'good' | 'bad' | 'needs_edit' | null;
  reviewer_notes: string | null;
  corrective_instruction: string | null;
  edited_output: Record<string, any> | null;
  is_exported: boolean;
  reviewed_at: string | null;
}

export interface StepReview {
  agent: string;
  quality: 'good' | 'bad' | 'needs_edit' | null;
  reviewer_notes: string | null;
  corrective_instruction: string | null;
  edited_output: Record<string, any> | null;
  is_exported: boolean;
  reviewed_at: string | null;
}

export interface SessionDetail {
  session_id: string;
  timestamp: string;
  endpoint: string;
  input: Record<string, any>;
  output: Record<string, any>;
  step_logs: StepLog[];
  token_usage: Record<string, any>;
  review: SessionReview | null;
  step_reviews: Record<string, StepReview>;
}

export interface TrainingStats {
  total_sessions: number;
  by_endpoint: Record<string, number>;
  total_tokens: number;
  date_range: { earliest: string; latest: string } | null;
  reviewed: {
    total: number;
    good: number;
    bad: number;
    needs_edit: number;
    exported: number;
  };
  by_agent: Record<string, {
    total: number;
    good: number;
    bad: number;
    needs_edit: number;
  }>;
}

export interface SessionListResponse {
  total: number;
  offset: number;
  limit: number;
  sessions: SessionSummary[];
}

export const trainingService = {
  listSessions: async (params: {
    limit?: number;
    offset?: number;
    quality?: string;
    reviewed?: string;
    agent?: string;
  } = {}): Promise<SessionListResponse> => {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    if (params.quality) query.set('quality', params.quality);
    if (params.reviewed) query.set('reviewed', params.reviewed);
    if (params.agent) query.set('agent', params.agent);
    const qs = query.toString();
    const res = await api.get<SessionListResponse>(`/admin/training${qs ? `?${qs}` : ''}`);
    return res.data;
  },

  getSession: async (sessionId: string): Promise<SessionDetail> => {
    const res = await api.get<SessionDetail>(`/admin/training/${sessionId}`);
    return res.data;
  },

  getStats: async (): Promise<TrainingStats> => {
    const res = await api.get<TrainingStats>('/admin/training/stats');
    return res.data;
  },

  saveReview: async (sessionId: string, data: {
    quality: 'good' | 'bad' | 'needs_edit';
    notes?: string;
    corrective_instruction?: string;
    edited_output?: Record<string, any>;
  }): Promise<any> => {
    const res = await api.put(`/admin/training/${sessionId}/review`, data);
    return res.data;
  },

  saveStepReview: async (sessionId: string, agent: string, data: {
    quality: 'good' | 'bad' | 'needs_edit';
    notes?: string;
    corrective_instruction?: string;
    edited_output?: Record<string, any>;
  }): Promise<any> => {
    const res = await api.put(`/admin/training/${sessionId}/steps/${agent}/review`, data);
    return res.data;
  },

  exportAzure: async (data: {
    agent_types: string[];
    quality_filter: 'good' | 'good_and_edited';
  }): Promise<Blob> => {
    const res = await api.post('/admin/training/export', data, {
      responseType: 'blob',
    });
    return res.data;
  },
};
