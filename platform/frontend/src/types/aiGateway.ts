export type ClarificationQuestionType = 'yes_no' | 'choice' | 'text';

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: ClarificationQuestionType;
  options?: string[];
}

export interface ClarificationAnswer {
  question_id: string;
  answer: string;
}

// This matches the AI Gateway output (generator SDF shape + optional clarifications_needed).
export interface AiGatewaySdf {
  project_name: string;
  modules?: Record<string, unknown>;
  entities: unknown[];
  // Backwards compatibility: older outputs might include relations/schema_name
  relations?: unknown[];
  schema_name?: string;
  clarifications_needed?: ClarificationQuestion[] | null;
}

export interface AnalyzeProjectResponse {
  project: import('./project').Project;
  sdf_version: number | null;
  sdf: AiGatewaySdf;
  questions: ClarificationQuestion[];
}


