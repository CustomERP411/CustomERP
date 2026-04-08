export interface Project {
  id: string;
  name: string;
  status: 'Draft' | 'Analyzing' | 'Clarifying' | 'Ready' | 'Generated' | 'Approved';
  description?: string | null;
  mode?: 'chat' | 'build';
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
}

