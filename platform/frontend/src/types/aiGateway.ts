export type ClarificationQuestionType = 'yes_no' | 'choice' | 'text';
export type ClarificationPriority = 'high' | 'medium' | 'low';

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: ClarificationQuestionType;
  options?: string[];
  module?: string;
  priority?: ClarificationPriority;
}

export interface ClarificationAnswer {
  question_id: string;
  answer: string;
}

export interface TokenUsage {
  [agent: string]: { prompt: number; completion: number; total: number };
}

export interface AiGatewaySdf {
  project_name: string;
  modules?: Record<string, unknown>;
  entities: unknown[];
  relations?: unknown[];
  schema_name?: string;
  clarifications_needed?: ClarificationQuestion[] | null;
  sdf_complete?: boolean;
  token_usage?: TokenUsage | null;
  warnings?: string[] | null;
}

export interface AnalyzeProjectResponse {
  project: import('./project').Project;
  sdf_version: number | null;
  sdf: AiGatewaySdf;
  questions: ClarificationQuestion[];
  sdf_complete?: boolean;
  token_usage?: TokenUsage | null;
  cycle?: number;
}
