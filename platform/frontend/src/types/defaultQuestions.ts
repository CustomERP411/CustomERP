import type { AiGatewaySdf } from './aiGateway';

export type DefaultQuestionType = 'yes_no' | 'choice' | 'text' | 'multi_choice';

export interface DefaultQuestionConditionRule {
  question_key: string;
  equals: string;
}

export interface DefaultQuestionCondition {
  op: 'all' | 'any';
  rules: DefaultQuestionConditionRule[];
}

export interface DefaultModuleQuestion {
  id: string;
  key: string;
  module: 'inventory' | 'invoice' | 'hr' | string;
  version: string;
  question: string;
  type: DefaultQuestionType;
  required: boolean;
  allow_custom?: boolean;
  options?: string[];
  /**
   * Display labels keyed by option value. When present, frontend should render
   * `option_labels[value] ?? value` so the stored slug stays language-neutral
   * while the UI shows the locale-appropriate label.
   */
  option_labels?: Record<string, string>;
  condition?: DefaultQuestionCondition | null;
  section?: string;
  order_index?: number;
  answer?: string | string[];
  visible?: boolean;
  answered?: boolean;
  required_missing?: boolean;
}

export interface DefaultQuestionCompletion {
  total_required_visible: number;
  answered_required_visible: number;
  is_complete: boolean;
  missing_required_question_ids: string[];
  missing_required_question_keys: string[];
}

export interface ModuleTemplateVersionInfo {
  version: string;
  template_type: string;
  total_questions: number;
  source_path?: string | null;
}

export interface DefaultQuestionStateResponse {
  modules: string[];
  template_versions: Record<string, ModuleTemplateVersionInfo>;
  questions: DefaultModuleQuestion[];
  completion: DefaultQuestionCompletion;
  mandatory_answers: Record<string, string | string[]>;
  prefilled_sdf: AiGatewaySdf | null;
  prefilled_sdf_version?: number | null;
  prefill_validation?: DefaultQuestionCompletion;
}

export interface SaveDefaultAnswersRequest {
  modules: string[];
  answers: Array<{
    question_id: string;
    answer: string | string[];
  }>;
}
