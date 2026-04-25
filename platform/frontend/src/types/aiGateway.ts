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

export type AnswerIssueKind =
  | 'gibberish'
  | 'too_short'
  | 'all_basics_empty'
  | 'mismatch'
  | 'unsupported_feature';
export type AnswerIssueSeverity = 'block' | 'acknowledgeable';

export interface AnswerIssue {
  kind: AnswerIssueKind;
  severity: AnswerIssueSeverity;
  question_id?: string | null;
  message: string;
  suggested_fix?: string | null;
  related_feature?: string | null;
}

export interface AnswerReview {
  is_clear_to_proceed: boolean;
  issues: AnswerIssue[];
  summary?: string;
}

export interface AnalyzeProjectResponse {
  project: import('./project').Project;
  sdf_version?: number | null;
  sdf?: AiGatewaySdf;
  questions?: ClarificationQuestion[];
  sdf_complete?: boolean;
  token_usage?: TokenUsage | null;
  cycle?: number;
  // Pre-distributor answer-review halt response. When `status` is set to
  // 'answer_review_required', `sdf` / `sdf_version` / `questions` are absent
  // and the frontend should show feedback instead of the generation modal.
  status?: 'answer_review_required' | 'change_review_required';
  answer_review?: AnswerReview;
}
