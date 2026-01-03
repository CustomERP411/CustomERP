export interface Project {
  id: string;
  name: string;
  status: 'Draft' | 'Analyzing' | 'Clarifying' | 'Ready' | 'Generated' | 'Approved';
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
}

