export type ProjectLanguage = 'en' | 'tr';

export interface Project {
  id: string;
  name: string;
  status: 'Draft' | 'Analyzing' | 'Clarifying' | 'Ready' | 'Generated' | 'Approved';
  description?: string | null;
  mode?: 'chat' | 'build';
  language?: ProjectLanguage;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  name: string;
  language?: ProjectLanguage;
}

