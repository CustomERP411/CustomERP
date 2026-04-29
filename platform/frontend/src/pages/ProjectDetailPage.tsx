import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectService } from '../services/projectService';
import type { Project } from '../types/project';
import type {
  AiGatewaySdf,
  AnswerReview,
  ClarificationAnswer,
  ClarificationQuestion,
  InferredModule,
  ModulePrecheckResponse,
  ModuleSlug,
} from '../types/aiGateway';
import type {
  DefaultModuleQuestion,
  DefaultQuestionCompletion,
  DefaultQuestionStateResponse,
  DependencyGraph,
  CoercedAnswer,
} from '../types/defaultQuestions';
import {
  applyDependencyCoercion,
  isAutoEnabledByDownstream,
  type AnswerMap,
} from '../components/project/dependencyMirror';

import {
  MODULE_KEYS, useSteps, useBusinessQuestions, BUSINESS_QUESTION_IDS,
  SlideIn, IconCheck,
} from '../components/project/projectConstants';
import ReviewFeedbackModal from '../components/project/ReviewFeedbackModal';

import DefaultQuestions from '../components/project/DefaultQuestions';
import BusinessQuestions from '../components/project/BusinessQuestions';
import type { ReviewHistoryItem } from '../components/project/ReviewApprovalPanel';
import { buildPreview } from '../components/project/buildPreview';
import ModuleSelector from '../components/project/ModuleSelector';
import PostGenerationPanel from '../components/project/PostGenerationPanel';
import GenerationModal from '../components/project/GenerationModal';
import { useChatContext } from '../context/ChatContext';
import { normalizeLanguage } from '../i18n';

const SDF_VISIBLE_STATUSES = new Set<Project['status']>(['Ready', 'Generated', 'Approved', 'Clarifying']);
const SDF_FINAL_STATUSES = new Set<Project['status']>(['Ready', 'Generated', 'Approved']);

type PendingChangeReview = {
  source: 'ai_edit' | 'review_revision';
  instructions: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['projectDetail', 'common', 'errors', 'projects', 'chatbot']);
  const STEPS = useSteps();
  const BUSINESS_QUESTIONS = useBusinessQuestions();
  const projectId = String(params.id || '');

  /* ── State ──────────────────────────────────────────────── */
  const [project, setProject] = useState<Project | null>(null);
  const [businessAnswers, setBusinessAnswers] = useState<Record<string, string>>({});
  const [businessStep, setBusinessStep] = useState(0);
  const [sdf, setSdf] = useState<AiGatewaySdf | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [defaultQuestions, setDefaultQuestions] = useState<DefaultModuleQuestion[]>([]);
  const [defaultAnswersById, setDefaultAnswersById] = useState<Record<string, string | string[]>>({});
  const [defaultCompletion, setDefaultCompletion] = useState<DefaultQuestionCompletion | null>(null);
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraph | null>(null);
  const [coercedNotices, setCoercedNotices] = useState<CoercedAnswer[]>([]);
  const [loadingDefaultQuestions, setLoadingDefaultQuestions] = useState(false);
  const [savingDefaultAnswers, setSavingDefaultAnswers] = useState(false);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiEditText, setAiEditText] = useState('');
  const [clarifyRound, setClarifyRound] = useState(0);
  const [, setSdfComplete] = useState(false);
  const [analyzePhase, setAnalyzePhase] = useState('');
  const [sdfVersion, setSdfVersion] = useState<number | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [reviewActionRunning, setReviewActionRunning] = useState(false);
  const [genResult, setGenResult] = useState<'success' | 'error' | null>(null);
  const [genErrorMsg, setGenErrorMsg] = useState('');
  const [genProgress, setGenProgress] = useState<{ step: string; pct: number; detail: string } | null>(null);
  const [bizSkipWarningOpen, setBizSkipWarningOpen] = useState(false);
  const [answerReview, setAnswerReview] = useState<AnswerReview | null>(null);
  const [changeReview, setChangeReview] = useState<AnswerReview | null>(null);
  const [pendingChangeReview, setPendingChangeReview] = useState<PendingChangeReview | null>(null);
  const [, setAcknowledgedFeatures] = useState<string[]>([]);

  // Plan D follow-up #8: advisory module precheck.
  // The inferred-modules list lives in `precheckResult`; user dismissals
  // live in `precheckDismissed` (cleared whenever description or selected
  // modules change so a new precheck cycle starts fresh).
  const [precheckResult, setPrecheckResult] = useState<ModulePrecheckResponse | null>(null);
  const [precheckDismissed, setPrecheckDismissed] = useState<Set<ModuleSlug>>(new Set());
  const precheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const precheckRequestIdRef = useRef(0);

  const { setProjectContext, openChat, sendMessage, setPulsing } = useChatContext();

  const handleHelpWithQuestion = (questionText: string, currentAnswer: string | string[]) => {
    const ans = Array.isArray(currentAnswer)
      ? currentAnswer.filter((v) => String(v || '').trim()).join(', ')
      : String(currentAnswer ?? '').trim();
    const prompt = ans
      ? t('chatbot:helpPrompt.withAnswer', { question: questionText, answer: ans })
      : t('chatbot:helpPrompt.empty', { question: questionText });
    openChat();
    void sendMessage(prompt);
  };
  const stepRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const hasScrolledRef = useRef(false);
  const expectQuestionFetchRef = useRef(false);
  const savedDefaultAnswersRef = useRef<Record<string, string | string[]> | null>(null);
  const running = analyzing || clarifying || saving || reviewActionRunning;

  const languageBlocked = useMemo(
    () =>
      !!project &&
      normalizeLanguage(i18n.language) !== normalizeLanguage(project.language || 'en'),
    [project, i18n.language],
  );
  const selectedModulesStorageKey = useMemo(
    () => (projectId ? `project_selected_modules:${projectId}` : ''),
    [projectId],
  );
  const businessAnswersStorageKey = useMemo(
    () => (projectId ? `project_business_answers:${projectId}` : ''),
    [projectId],
  );
  const defaultAnswersStorageKey = useMemo(
    () => (projectId ? `project_default_answers:${projectId}` : ''),
    [projectId],
  );
  const businessStepStorageKey = useMemo(
    () => (projectId ? `project_business_step:${projectId}` : ''),
    [projectId],
  );
  const reviewHistoryStorageKey = useMemo(
    () => (projectId ? `project_review_history:${projectId}` : ''),
    [projectId],
  );

  /* ── Helpers ────────────────────────────────────────────── */

  const filterQuestions = (raw: any[]): ClarificationQuestion[] => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.filter((q: any) => {
      const id = String(q?.id || '');
      const text = String(q?.question || '');
      return !/chat\s*bot|chatbot|sohbet\s*botu|sohbetbot/i.test(id + ' ' + text);
    }) as ClarificationQuestion[];
  };

  const normalizeModuleList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      const key = String(item || '').trim().toLowerCase();
      if (!(MODULE_KEYS as readonly string[]).includes(key) || seen.has(key)) continue;
      seen.add(key);
      unique.push(key);
    }
    return unique;
  };

  const normalizeBusinessAnswerMap = (value: unknown): Record<string, string> => {
    if (!value || typeof value !== 'object') return {};
    const source = value as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const question of BUSINESS_QUESTIONS) {
      const raw = source[question.id];
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed) out[question.id] = raw;
        continue;
      }
      if (raw && typeof raw === 'object') {
        const nested = raw as Record<string, unknown>;
        if (typeof nested.answer === 'string' && nested.answer.trim()) {
          out[question.id] = nested.answer;
        }
      }
    }
    return out;
  };

  const readStorageJson = (storageKey: string): unknown => {
    if (!storageKey) return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const applyDefaultQuestionState = (payload: DefaultQuestionStateResponse) => {
    const questionList = Array.isArray(payload?.questions) ? payload.questions : [];
    const answers: Record<string, string | string[]> = {};
    for (const question of questionList) {
      if (Array.isArray(question.answer)) answers[question.id] = question.answer;
      else if (typeof question.answer === 'string') answers[question.id] = question.answer;
      else answers[question.id] = question.type === 'multi_choice' ? [] : '';
    }
    // Restore any locally cached answers that the server didn't have yet
    const cached = readStorageJson(defaultAnswersStorageKey);
    if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
      const cachedMap = cached as Record<string, unknown>;
      for (const question of questionList) {
        const serverVal = answers[question.id];
        const cachedVal = cachedMap[question.id];
        const serverEmpty = Array.isArray(serverVal) ? serverVal.length === 0 : !serverVal;
        if (serverEmpty && cachedVal !== undefined && cachedVal !== null && cachedVal !== '') {
          if (Array.isArray(cachedVal)) answers[question.id] = cachedVal.map(String);
          else if (typeof cachedVal === 'string' && cachedVal.trim()) answers[question.id] = cachedVal;
        }
      }
    }
    setDefaultQuestions(questionList);
    setDefaultAnswersById(answers);
    setDefaultCompletion(payload?.prefill_validation || payload?.completion || null);
    if (payload?.dependency_graph) setDependencyGraph(payload.dependency_graph);
    if (Array.isArray(payload?.coerced) && payload.coerced.length > 0) {
      setCoercedNotices(payload.coerced);
      // Auto-clear after a few seconds so the notices don't sit forever.
      window.setTimeout(() => setCoercedNotices((prev) => (prev === payload.coerced ? [] : prev)), 6000);
    }
    savedDefaultAnswersRef.current = { ...answers };
  };

  const evaluateQuestionVisibility = (question: DefaultModuleQuestion) => {
    const condition = question.condition;
    if (!condition || !Array.isArray(condition.rules) || !condition.rules.length) return true;
    const byKey = Object.fromEntries(defaultQuestions.map((item) => [item.key, defaultAnswersById[item.id]]));
    const checks = condition.rules.map((rule) => {
      const actual = byKey[rule.question_key];
      const expected = String(rule.equals || '').trim().toLowerCase();
      if (Array.isArray(actual)) return actual.map((item) => String(item).trim().toLowerCase()).includes(expected);
      return String(actual || '').trim().toLowerCase() === expected;
    });
    return condition.op === 'any' ? checks.some(Boolean) : checks.every(Boolean);
  };

  const appendReviewHistory = (
    entry: Omit<ReviewHistoryItem, 'id' | 'createdAt'> & { createdAt?: string },
  ) => {
    const next: ReviewHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: entry.createdAt || new Date().toISOString(),
      action: entry.action,
      version: entry.version ?? null,
      status: entry.status ?? null,
      note: entry.note || '',
    };
    setReviewHistory((prev) => [next, ...prev]);
  };

  /* ── Effects ────────────────────────────────────────────── */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId) return;
      setLoading(true); setError('');
      setSelectedModules([]);
      setBusinessAnswers({});
      try {
        const [p, latest, conversationsResponse] = await Promise.all([
          projectService.getProject(projectId),
          projectService.getLatestSdf(projectId).catch(() => ({ sdf: null, sdf_version: null })),
          projectService.getConversations(projectId).catch(() => ({ conversations: [] })),
        ]);
        if (cancelled) return;
        setProject(p);
        const storedModules = normalizeModuleList(readStorageJson(selectedModulesStorageKey));
        const storedBusinessAnswers = normalizeBusinessAnswerMap(readStorageJson(businessAnswersStorageKey));
        const conversations = Array.isArray(conversationsResponse?.conversations)
          ? conversationsResponse.conversations
          : [];
        const conversationWithModules = conversations.find(
          (entry) => normalizeModuleList(entry?.selected_modules).length > 0,
        );
        const conversationWithBusinessAnswers = conversations.find(
          (entry) => Object.keys(normalizeBusinessAnswerMap(entry?.business_answers)).length > 0,
        );
        const modulesFromConversation = normalizeModuleList(conversationWithModules?.selected_modules);
        const businessAnswersFromConversation = normalizeBusinessAnswerMap(conversationWithBusinessAnswers?.business_answers);
        // If the project halted at the answer reviewer, restore the newest
        // persisted review payload so the user is brought back into the same
        // modal they saw before. Do not assume conversations[0] has it: a
        // later non-review row can exist after other actions.
        const latestReviewConversation = conversations.find((entry) => entry?.answer_review);
        const pendingReview = (latestReviewConversation?.answer_review ?? null) as AnswerReview | null;
        const pendingAcked = Array.isArray(latestReviewConversation?.acknowledged_unsupported_features)
          ? (latestReviewConversation!.acknowledged_unsupported_features as string[])
          : [];
        const modulesFromLatestSdf = (() => {
          const moduleConfig = (latest?.sdf as any)?.modules;
          if (!moduleConfig || typeof moduleConfig !== 'object') return [];
          return MODULE_KEYS.filter((key) => {
            if (!Object.prototype.hasOwnProperty.call(moduleConfig, key)) return false;
            const cfg = moduleConfig[key];
            if (cfg === false) return false;
            if (cfg && typeof cfg === 'object' && cfg.enabled === false) return false;
            return true;
          });
        })();
        const initialModules = storedModules.length
          ? storedModules
          : modulesFromConversation.length
            ? modulesFromConversation
            : modulesFromLatestSdf;
        // Only fall back to conversation answers if the user has never visited this
        // page (no localStorage key). If the key exists — even with empty value — the
        // user has been here and their current state takes precedence over stale
        // conversation data from a previous generation.
        const businessAnswersKeyExists = !!window.localStorage.getItem(businessAnswersStorageKey);
        const initialBusinessAnswers = businessAnswersKeyExists
          ? storedBusinessAnswers
          : Object.keys(businessAnswersFromConversation).length
            ? businessAnswersFromConversation
            : {};
        expectQuestionFetchRef.current = initialModules.length > 0;
        setSelectedModules(initialModules);
        setBusinessAnswers(initialBusinessAnswers);
        try {
          const storedStep = window.localStorage.getItem(businessStepStorageKey);
          if (storedStep !== null) {
            const idx = parseInt(storedStep, 10);
            if (!isNaN(idx) && idx >= 0 && idx < BUSINESS_QUESTIONS.length) setBusinessStep(idx);
          }
        } catch { /* ignore */ }
        // Only restore SDFs in lifecycle states where an ERP has actually been
        // generated or is being clarified. Module-question prefill can exist
        // without the user pressing Generate, so a raw latest SDF row is not
        // enough to show the post-generation panel.
        const shouldRestoreSdf = SDF_VISIBLE_STATUSES.has(p.status);
        if (latest?.sdf && shouldRestoreSdf) {
          setSdf(latest.sdf);
          setSdfVersion(typeof latest.sdf_version === 'number' ? latest.sdf_version : null);
          setQuestions(filterQuestions(Array.isArray(latest.sdf.clarifications_needed) ? latest.sdf.clarifications_needed : []));
        } else {
          setSdf(null);
          setSdfVersion(null);
          setQuestions([]);
          setAnswersById({});
          setSdfComplete(false);
        }
        // Project halted at the pre-distributor answer reviewer on the last
        // build attempt. Re-open the feedback modal so the user is told what
        // to fix instead of seeing a silent "Reviewing" badge with no UI.
        if (!cancelled && p.status === 'Reviewing' && pendingReview) {
          setAnswerReview(pendingReview);
          setAcknowledgedFeatures(pendingAcked);
          // Pre-position the wizard on the first offending business question
          // so "Edit answers" lands directly there. currentStep is derived from
          // selectedModules / defaultCompletion / businessComplete / sdf — with
          // no sdf and complete answers it lands on the Review step (3); the
          // modal sits on top of that, and dismissing routes back via
          // handleReviewEditAnswers / business questions step.
          const firstWithIssue = (pendingReview.issues || []).find((i) => i.question_id);
          if (firstWithIssue?.question_id) {
            const idx = BUSINESS_QUESTION_IDS.findIndex((q) => q.id === firstWithIssue.question_id);
            if (idx >= 0) setBusinessStep(idx);
          }
        }

        const serverHistory = await projectService.getReviewHistory(projectId).catch(() => ({ history: [] }));
        if (!cancelled && serverHistory.history.length > 0) {
          setReviewHistory(serverHistory.history);
        } else if (!cancelled && latest?.sdf && shouldRestoreSdf) {
          setReviewHistory([{
            id: `baseline-${latest.sdf_version || 0}`,
            action: 'generated',
            version: typeof latest.sdf_version === 'number' ? latest.sdf_version : null,
            status: p.status || null,
            note: t('projectDetail:history.loadedBaseline'),
            createdAt: p.updated_at || new Date().toISOString(),
          }]);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.loadProject'));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId, selectedModulesStorageKey, businessAnswersStorageKey]);

  const selectedModulesKey = useMemo(() => selectedModules.slice().sort().join(','), [selectedModules]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!projectId || !selectedModules.length) return;
      setLoadingDefaultQuestions(true); setError('');
      try {
        const payload = await projectService.getDefaultQuestions(projectId, selectedModules);
        if (!cancelled) applyDefaultQuestionState(payload);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.loadDefaultQuestions'));
      } finally { if (!cancelled) setLoadingDefaultQuestions(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId, selectedModulesKey]);

  useEffect(() => {
    if (!selectedModulesStorageKey || loading) return;
    try { window.localStorage.setItem(selectedModulesStorageKey, JSON.stringify(selectedModules)); } catch { /* ignore */ }
  }, [selectedModules, selectedModulesStorageKey, loading]);

  useEffect(() => {
    if (!businessAnswersStorageKey || loading) return;
    try { window.localStorage.setItem(businessAnswersStorageKey, JSON.stringify(businessAnswers)); } catch { /* ignore */ }
  }, [businessAnswers, businessAnswersStorageKey, loading]);

  useEffect(() => {
    if (!defaultAnswersStorageKey || loading || !Object.keys(defaultAnswersById).length) return;
    try { window.localStorage.setItem(defaultAnswersStorageKey, JSON.stringify(defaultAnswersById)); } catch { /* ignore */ }
  }, [defaultAnswersById, defaultAnswersStorageKey, loading]);

  useEffect(() => {
    if (!businessStepStorageKey || loading) return;
    try { window.localStorage.setItem(businessStepStorageKey, String(businessStep)); } catch { /* ignore */ }
  }, [businessStep, businessStepStorageKey, loading]);

  useEffect(() => {
    if (!reviewHistoryStorageKey) return;
    setReviewHistory((prev) => {
      if (prev.length > 0) return prev;
      try {
        const raw = window.localStorage.getItem(reviewHistoryStorageKey);
        if (!raw) return prev;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return prev;
        const normalized = parsed
          .map((item) => (typeof item === 'object' && item !== null ? item as Partial<ReviewHistoryItem> : null))
          .filter((item): item is Partial<ReviewHistoryItem> => item !== null)
          .map((item, idx) => ({
            id: typeof item.id === 'string' ? item.id : `history-${idx + 1}`,
            action: item.action === 'generated' || item.action === 'clarified' || item.action === 'manual_save' || item.action === 'ai_revision' || item.action === 'approved' || item.action === 'rejected' || item.action === 'revision_requested'
              ? item.action
              : 'generated',
            version: typeof item.version === 'number' ? item.version : null,
            status: typeof item.status === 'string' ? item.status : null,
            note: typeof item.note === 'string' ? item.note : '',
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          }));
        return normalized.length > 0 ? normalized : prev;
      } catch { return prev; }
    });
  }, [reviewHistoryStorageKey]);

  useEffect(() => {
    if (!reviewHistoryStorageKey) return;
    try { window.localStorage.setItem(reviewHistoryStorageKey, JSON.stringify(reviewHistory)); } catch { /* ignore */ }
  }, [reviewHistory, reviewHistoryStorageKey]);

  /* ── Derived state ──────────────────────────────────────── */

  const description = useMemo(() => {
    return BUSINESS_QUESTIONS
      .map((q) => {
        const answer = (businessAnswers[q.id] || '').trim();
        return answer ? `${q.question}\n${answer}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
  }, [businessAnswers]);

  const businessComplete = useMemo(() =>
    BUSINESS_QUESTIONS.filter((q) => !q.optional).every((q) => (businessAnswers[q.id] || '').trim().length > 0),
    [businessAnswers]
  );

  // ── Plan D follow-up #8: module precheck (advisory) ──────────────────
  //
  // Reset the user's dismissals + clear stale results whenever the
  // description or selected-modules tuple changes. Combined with the
  // debounced trigger below, this means each new wizard state gets a
  // fresh precheck cycle and any prior "Continue without it" choices
  // are forgotten.
  const selectedModulesPrecheckKey = useMemo(
    () => selectedModules.slice().sort().join(','),
    [selectedModules],
  );
  useEffect(() => {
    setPrecheckDismissed(new Set());
    setPrecheckResult(null);
  }, [description, selectedModulesPrecheckKey]);

  // Debounced trigger. Skip if there's no project, no description text,
  // or no modules selected (the precheck is a "you might also need X"
  // hint — meaningless before the user has staked out a baseline).
  useEffect(() => {
    if (precheckTimerRef.current) {
      clearTimeout(precheckTimerRef.current);
      precheckTimerRef.current = null;
    }
    if (!projectId) return;
    const trimmedDescription = description.trim();
    if (!trimmedDescription || selectedModules.length === 0) return;
    // All three modules already selected → no inference possible.
    if (selectedModules.length >= MODULE_KEYS.length) return;

    precheckTimerRef.current = setTimeout(async () => {
      const requestId = ++precheckRequestIdRef.current;
      try {
        const res = await projectService.precheckModules(
          projectId,
          trimmedDescription,
          selectedModules,
        );
        // Only the most recent request wins — guard against stale
        // responses arriving after the user has typed more.
        if (requestId !== precheckRequestIdRef.current) return;
        setPrecheckResult(res || null);
      } catch {
        // Advisory endpoint — silent failure is fine.
      }
    }, 1200);

    return () => {
      if (precheckTimerRef.current) {
        clearTimeout(precheckTimerRef.current);
        precheckTimerRef.current = null;
      }
    };
  }, [projectId, description, selectedModulesPrecheckKey]);

  const visiblePrecheckModules: InferredModule[] = useMemo(() => {
    const inferred = precheckResult?.inferred_modules || [];
    if (!Array.isArray(inferred) || inferred.length === 0) return [];
    return inferred.filter((m) => {
      if (!m || !m.module) return false;
      // Drop anything the user has already added or already dismissed.
      if (selectedModules.includes(m.module)) return false;
      if (precheckDismissed.has(m.module)) return false;
      // Belt-and-suspenders: never surface modules outside the canonical set.
      if (!(MODULE_KEYS as readonly string[]).includes(m.module)) return false;
      return true;
    });
  }, [precheckResult, selectedModules, precheckDismissed]);

  const visibleDefaultQuestions = useMemo(() => defaultQuestions.filter(evaluateQuestionVisibility), [defaultQuestions, defaultAnswersById]);

  const canAnalyze = useMemo(
    () => defaultCompletion?.is_complete === true && selectedModules.length > 0
      && BUSINESS_QUESTIONS.some((q) => (businessAnswers[q.id] || '').trim().length > 0),
    [defaultCompletion, selectedModules.length, businessAnswers],
  );
  const defaultAnswersDirty = useMemo(() => {
    const snapshot = savedDefaultAnswersRef.current;
    if (!snapshot) return true;
    for (const key of Object.keys(defaultAnswersById)) {
      const cur = defaultAnswersById[key];
      const prev = snapshot[key];
      if (Array.isArray(cur) || Array.isArray(prev)) {
        const a = Array.isArray(cur) ? cur : [];
        const b = Array.isArray(prev) ? prev : [];
        if (a.length !== b.length || a.some((v, i) => v !== b[i])) return true;
      } else if ((cur || '') !== (prev || '')) return true;
    }
    for (const key of Object.keys(snapshot)) {
      if (!(key in defaultAnswersById)) return true;
    }
    return false;
  }, [defaultAnswersById]);
  const canSaveDefaultAnswers = useMemo(
    () => selectedModules.length > 0 && defaultQuestions.length > 0 && defaultAnswersDirty,
    [selectedModules.length, defaultQuestions.length, defaultAnswersDirty],
  );
  const canSubmitAnswers = useMemo(() => !!sdf && questions.length > 0 && questions.every((q) => (answersById[q.id] || '').trim().length > 0), [sdf, questions, answersById]);
  const canShowPostGeneration = !!sdf && !!project && SDF_FINAL_STATUSES.has(project.status);

  const currentStep = useMemo(() => {
    if (canShowPostGeneration) return 4;
    if (!selectedModules.length) return 0;
    if (!defaultCompletion?.is_complete) return 1;
    if (!businessComplete) return 2;
    return 3;
  }, [selectedModules, defaultCompletion, businessComplete, canShowPostGeneration]);

  // Scroll to the user's progress point on initial page load.
  // If modules were loaded from saved state, wait for question data (defaultCompletion)
  // before deciding — this avoids the React batching race where loadingDefaultQuestions
  // hasn't flipped yet. For fresh projects (no saved modules) the effect resolves
  // immediately on first load and locks out, so later module selection never triggers it.
  useEffect(() => {
    if (loading || hasScrolledRef.current) return;
    if (expectQuestionFetchRef.current && !defaultCompletion) return;
    hasScrolledRef.current = true;
    if (currentStep === 0) return;
    if (currentStep === 1 && (defaultCompletion?.answered_required_visible ?? 0) === 0) return;
    const timer = setTimeout(() => {
      if (currentStep === 2) {
        const storedRaw = window.localStorage.getItem(businessStepStorageKey);
        const storedIdx = storedRaw !== null ? parseInt(storedRaw, 10) : NaN;
        if (!isNaN(storedIdx) && storedIdx >= 0 && storedIdx < BUSINESS_QUESTIONS.length) {
          setBusinessStep(storedIdx);
        } else {
          const firstUnanswered = BUSINESS_QUESTIONS.findIndex((bq) => !bq.optional && !(businessAnswers[bq.id] || '').trim());
          if (firstUnanswered >= 0) setBusinessStep(firstUnanswered);
        }
      }
      stepRefs[currentStep]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
    return () => clearTimeout(timer);
  }, [loading, defaultCompletion]);

  useEffect(() => { setPulsing(bizSkipWarningOpen); }, [bizSkipWarningOpen, setPulsing]);

  // Feed project context to the global chat widget
  useEffect(() => {
    if (!project || !projectId) {
      setProjectContext(null);
      return;
    }
    const sdfStatus: 'none' | 'generated' | 'reviewed' | 'approved' =
      project.status === 'Approved' ? 'approved'
        : sdf ? (project.status === 'Ready' ? 'reviewed' : 'generated')
        : 'none';
    setProjectContext({
      projectId,
      projectName: project.name,
      description: project.description || '',
      selectedModules,
      businessAnswers: Object.fromEntries(
        BUSINESS_QUESTIONS.map((q) => [q.id, { question: q.question, answer: (businessAnswers[q.id] || '').trim() }])
      ),
      currentStep: STEPS[currentStep] ?? STEPS[0],
      sdfStatus: sdfStatus,
    });
    return () => setProjectContext(null);
  }, [projectId, project, selectedModules, businessAnswers, sdf, currentStep, setProjectContext]);

  const questionsByModule = useMemo(() => {
    const groups: Record<string, DefaultModuleQuestion[]> = {};
    for (const q of visibleDefaultQuestions) { const mod = q.module || 'general'; if (!groups[mod]) groups[mod] = []; groups[mod].push(q); }
    return groups;
  }, [visibleDefaultQuestions]);

  const moduleCompletionCounts = useMemo(() => {
    const counts: Record<string, { total: number; answered: number }> = {};
    for (const q of visibleDefaultQuestions) {
      const mod = q.module || 'general';
      if (!counts[mod]) counts[mod] = { total: 0, answered: 0 };
      counts[mod].total++;
      const raw = defaultAnswersById[q.id];
      if (Array.isArray(raw) ? raw.length > 0 : (typeof raw === 'string' && raw.trim().length > 0)) counts[mod].answered++;
    }
    return counts;
  }, [visibleDefaultQuestions, defaultAnswersById]);

  // Plan C — derived state for inline UI. Per-question auto-enabled badge
  // (locked yes because a downstream is yes) and per-question feeds-hint
  // strings. Both are pure functions of the dependency graph + answers.
  const autoEnabledById = useMemo(() => {
    const map: Record<string, { driverKey: string; reasonKey: string }> = {};
    if (!dependencyGraph) return map;
    const idToKey = new Map<string, string>();
    for (const q of defaultQuestions) idToKey.set(q.id, q.key);
    const byKey: AnswerMap = {};
    for (const id of Object.keys(defaultAnswersById)) {
      const key = idToKey.get(id);
      if (key) byKey[key] = defaultAnswersById[id];
    }
    for (const q of defaultQuestions) {
      const hit = isAutoEnabledByDownstream(dependencyGraph, q.key, byKey);
      if (hit) map[q.id] = hit;
    }
    return map;
  }, [dependencyGraph, defaultQuestions, defaultAnswersById]);

  const feedsHintsByQuestionId = useMemo(() => {
    const map: Record<string, Array<{ to: string; text: string }>> = {};
    if (!dependencyGraph) return map;
    const idToKey = new Map<string, string>();
    const keyToId = new Map<string, string>();
    const keyToLabel = new Map<string, string>();
    for (const q of defaultQuestions) {
      idToKey.set(q.id, q.key);
      keyToId.set(q.key, q.id);
      keyToLabel.set(q.key, q.question);
    }
    const lang = (i18n.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
    for (const q of defaultQuestions) {
      const ans = defaultAnswersById[q.id];
      const isYes = !Array.isArray(ans) && String(ans || '').trim().toLowerCase() === 'yes';
      if (!isYes) continue;
      for (const edge of dependencyGraph.feeds_hints || []) {
        if (edge.from !== q.key) continue;
        const targetAns = defaultAnswersById[keyToId.get(edge.to) || ''];
        const targetIsYes = !Array.isArray(targetAns) && String(targetAns || '').trim().toLowerCase() === 'yes';
        if (targetIsYes) continue;
        const text = lang === 'tr' && edge.default_tr ? edge.default_tr : (edge.default_en || edge.hint_key);
        if (!map[q.id]) map[q.id] = [];
        map[q.id].push({ to: edge.to, text });
      }
    }
    return map;
  }, [dependencyGraph, defaultQuestions, defaultAnswersById, i18n.language]);

  const visibleCoercedNotices = useMemo(() => {
    const idToLabel = new Map<string, string>();
    for (const q of defaultQuestions) idToLabel.set(q.id, q.question);
    const lang = (i18n.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
    return coercedNotices.map((n) => {
      const reason = dependencyGraph?.hard_requires.find((edge) => edge.reason_key === n.reason_key);
      const text = reason
        ? (lang === 'tr' && reason.reason_default_tr ? reason.reason_default_tr : (reason.reason_default_en || reason.reason_key))
        : n.reason_key;
      const subjectLabel = (n.question_id && idToLabel.get(n.question_id)) || n.key;
      const driverLabel = (n.driver_question_id && idToLabel.get(n.driver_question_id)) || n.driver;
      return { ...n, text, subjectLabel, driverLabel };
    });
  }, [coercedNotices, defaultQuestions, dependencyGraph, i18n.language]);

  const preview = useMemo(() => sdf ? buildPreview(sdf, {
    listPage: t('projectDetail:buildPreview.listPage'),
    createEditForm: t('projectDetail:buildPreview.createEditForm'),
    csvImportPage: t('projectDetail:buildPreview.csvImportPage'),
    csvExportPage: t('projectDetail:buildPreview.csvExportPage'),
    printPdf: t('projectDetail:buildPreview.printPdf'),
    receiveStock: t('projectDetail:buildPreview.receiveStock'),
    sellDefault: t('projectDetail:buildPreview.sellDefault'),
    adjustStock: t('projectDetail:buildPreview.adjustStock'),
    transferStock: t('projectDetail:buildPreview.transferStock'),
    qrLabels: t('projectDetail:buildPreview.qrLabels'),
    activityLog: t('projectDetail:buildPreview.activityLog'),
    activityLogDesc: t('projectDetail:buildPreview.activityLogDesc'),
    lowStockAlerts: t('projectDetail:buildPreview.lowStockAlerts'),
    lowStockDesc: t('projectDetail:buildPreview.lowStockDesc'),
    expiryAlerts: t('projectDetail:buildPreview.expiryAlerts'),
    expiryDesc: t('projectDetail:buildPreview.expiryDesc'),
    reports: t('projectDetail:buildPreview.reports'),
    reportsDesc: t('projectDetail:buildPreview.reportsDesc'),
  }) : null, [sdf, t]);

  /* ── Handlers ───────────────────────────────────────────── */

  // Plan C — wizard wiring. Run the dependency-graph mirror after every
  // edit so auto-enable / cascade-off feels instant. Server is still
  // authoritative on save (`saveDefaultAnswers`); this mirror only paints
  // the UI consistently while the user clicks.
  const _runMirrorAndUpdate = (
    nextById: Record<string, string | string[]>,
  ): { byId: Record<string, string | string[]>; coerced: CoercedAnswer[] } => {
    if (!dependencyGraph) return { byId: nextById, coerced: [] };
    const idToKey = new Map<string, string>();
    const keyToId = new Map<string, string>();
    for (const q of defaultQuestions) {
      idToKey.set(q.id, q.key);
      keyToId.set(q.key, q.id);
    }
    const byKey: AnswerMap = {};
    for (const id of Object.keys(nextById)) {
      const key = idToKey.get(id);
      if (key) byKey[key] = nextById[id];
    }
    const { coerced } = applyDependencyCoercion(
      dependencyGraph,
      byKey,
      selectedModules,
    );
    if (coerced.length === 0) return { byId: nextById, coerced: [] };
    const byId = { ...nextById };
    for (const event of coerced) {
      const id = keyToId.get(event.key);
      if (!id) continue;
      byId[id] = event.now as string | string[];
    }
    const coercedWithIds = coerced.map((e) => ({
      ...e,
      question_id: keyToId.get(e.key) || null,
      driver_question_id: keyToId.get(e.driver) || null,
    }));
    return { byId, coerced: coercedWithIds };
  };

  const updateDefaultAnswer = (questionId: string, value: string | string[]) => {
    setDefaultAnswersById((prev) => {
      const next = { ...prev, [questionId]: value };
      const { byId, coerced } = _runMirrorAndUpdate(next);
      if (coerced.length > 0) {
        setCoercedNotices(coerced);
        window.setTimeout(() => setCoercedNotices((cur) => (cur === coerced ? [] : cur)), 6000);
      }
      return byId;
    });
  };
  const toggleMultiChoiceAnswer = (questionId: string, option: string, enabled: boolean) => {
    setDefaultAnswersById((prev) => {
      const existing = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = {
        ...prev,
        [questionId]: enabled
          ? Array.from(new Set([...existing, option]))
          : existing.filter((item) => item !== option),
      };
      const { byId, coerced } = _runMirrorAndUpdate(next);
      if (coerced.length > 0) {
        setCoercedNotices(coerced);
        window.setTimeout(() => setCoercedNotices((cur) => (cur === coerced ? [] : cur)), 6000);
      }
      return byId;
    });
  };
  const toggleModule = (key: string) => {
    setSelectedModules((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]);
    if (sdf) { setSdf(null); setSdfVersion(null); setQuestions([]); }
  };

  // Plan D follow-up #8: precheck banner actions.
  const handlePrecheckAddModule = (slug: ModuleSlug) => {
    if (!selectedModules.includes(slug)) {
      setSelectedModules((prev) => [...prev, slug]);
      if (sdf) { setSdf(null); setSdfVersion(null); setQuestions([]); }
    }
    setPrecheckDismissed((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  };
  const handlePrecheckDismiss = (slug: ModuleSlug) => {
    setPrecheckDismissed((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  };

  const saveDefaultAnswers = async () => {
    if (!projectId || !selectedModules.length) return;
    setSavingDefaultAnswers(true); setError('');
    try {
      const payload = await projectService.saveDefaultAnswers(projectId, {
        modules: selectedModules,
        answers: defaultQuestions.map((q) => ({ question_id: q.id, answer: defaultAnswersById[q.id] ?? (q.type === 'multi_choice' ? [] : '') })),
      });
      applyDefaultQuestionState(payload);
      if (payload.project) setProject(payload.project);
      // Clear stale SDF so the user must complete business questions before
      // the post-generation panel re-appears.
      if (sdf) { setSdf(null); setSdfVersion(null); setQuestions([]); }
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.saveAnswersFailed')); }
    finally { setSavingDefaultAnswers(false); }
  };

  const mapGenerationError = (err: any): string => {
    const raw = err?.response?.data?.error || err?.message || '';
    console.error('ERP generation error:', raw, err);
    if (err?.code === 'ECONNABORTED') return t('projectDetail:errors.genSlow');
    if (!err?.response && err?.message?.toLowerCase().includes('network')) return t('projectDetail:errors.genNetwork');
    if (err?.response?.status >= 500) return t('projectDetail:errors.genServer');
    return t('projectDetail:errors.genGeneric');
  };

  const closeGenerationModal = () => {
    setAnalyzePhase(''); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
  };

  const generatingKey = projectId ? `project_generating:${projectId}` : '';

  const clearGeneratingFlag = () => {
    if (generatingKey) try { window.localStorage.removeItem(generatingKey); } catch { /* ignore */ }
  };

  // On mount, if a generation was in progress before refresh, resume the modal
  // and poll for the result by re-fetching the latest SDF + real progress.
  useEffect(() => {
    if (!generatingKey || loading || !projectId) return;
    const stored = window.localStorage.getItem(generatingKey);
    if (!stored) return;
    const startedAt = parseInt(stored, 10);
    if (isNaN(startedAt) || Date.now() - startedAt > 5 * 60 * 1000) {
      clearGeneratingFlag();
      return;
    }
    setAnalyzePhase(t('projectDetail:phases.resuming'));
    let cancelled = false;
    const poll = async () => {
      try {
        const [latest, prog] = await Promise.all([
          projectService.getLatestSdf(projectId),
          projectService.getGenerationProgress(projectId),
        ]);
        if (cancelled) return;
        if (prog) setGenProgress(prog);
        if (latest?.sdf) {
          setSdf(latest.sdf);
          setSdfVersion(typeof latest.sdf_version === 'number' ? latest.sdf_version : null);
          setQuestions(filterQuestions(Array.isArray(latest.sdf.clarifications_needed) ? latest.sdf.clarifications_needed : []));
          clearGeneratingFlag();
          setGenProgress({ step: 'done', pct: 100, detail: t('projectDetail:progress.complete') });
          setGenResult('success');
          setTimeout(() => { setAnalyzePhase(''); setGenResult(null); setGenProgress(null); }, 2500);
          return;
        }
      } catch { /* ignore */ }
      if (!cancelled) setTimeout(poll, 2000);
    };
    poll();
    const timeout = setTimeout(() => {
      cancelled = true;
      clearGeneratingFlag();
      setGenResult('error');
      setGenErrorMsg(t('projectDetail:errors.genTimeout'));
    }, 3 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [loading, generatingKey]);

  const analyze = async (opts?: { acknowledgedFeatures?: string[] }) => {
    if (!projectId) return;
    const ackedFromOpts = Array.isArray(opts?.acknowledgedFeatures)
      ? opts!.acknowledgedFeatures.map((f) => f.trim()).filter(Boolean)
      : [];

    // Plan D follow-up #8: one final precheck pass right before the
    // expensive analyze call. Fire-and-don't-block — the banner will
    // re-render if there's anything new to surface, but Analyze still
    // proceeds in parallel since the precheck is purely advisory.
    if (description.trim() && selectedModules.length > 0 && selectedModules.length < MODULE_KEYS.length) {
      const requestId = ++precheckRequestIdRef.current;
      void (async () => {
        try {
          const res = await projectService.precheckModules(
            projectId,
            description.trim(),
            selectedModules,
          );
          if (requestId !== precheckRequestIdRef.current) return;
          setPrecheckResult(res || null);
        } catch { /* advisory — silent */ }
      })();
    }

    setAnalyzing(true); setError(''); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
    if (!ackedFromOpts.length) {
      // Fresh attempt — wipe any stale review feedback so we don't flash old issues.
      setAnswerReview(null);
    }
    setAnalyzePhase(t('projectDetail:phases.savingAnswers'));
    if (generatingKey) try { window.localStorage.setItem(generatingKey, String(Date.now())); } catch { /* ignore */ }

    // Poll real progress from the AI gateway
    let progressCancelled = false;
    const pollProgress = async () => {
      if (progressCancelled || !projectId) return;
      try {
        const prog = await projectService.getGenerationProgress(projectId);
        if (!progressCancelled && prog) setGenProgress(prog);
      } catch { /* ignore */ }
      if (!progressCancelled) setTimeout(pollProgress, 1500);
    };

    try {
      const latestDefaults = await projectService.saveDefaultAnswers(projectId, {
        modules: selectedModules,
        answers: defaultQuestions.map((q) => ({ question_id: q.id, answer: defaultAnswersById[q.id] ?? (q.type === 'multi_choice' ? [] : '') })),
      });
      applyDefaultQuestionState(latestDefaults);
      if (!(latestDefaults.prefill_validation || latestDefaults.completion)?.is_complete) {
        setError(t('projectDetail:errors.answerRequired'));
        setAnalyzePhase(''); clearGeneratingFlag();
        return;
      }

      // NOTE: these strings are baked into the SDF the AI sees; keep them in
      // English so the AI builds consistent admin roles regardless of UI language.
      const defaultAdminGroup = {
        name: 'Administrators',
        user_count: '1',
        responsibilities: 'Manage ERP users, groups, and system-wide access rules.',
        permissions: ['manage_users', 'manage_groups', 'manage_permissions', 'view_records'],
        custom_permissions: '',
      };
      const prefilledWithAccess = latestDefaults.prefilled_sdf
        ? ({
            ...latestDefaults.prefilled_sdf,
            modules: {
              ...(latestDefaults.prefilled_sdf?.modules || {}),
              access_control: { enabled: true, groups: [defaultAdminGroup] },
            },
          } as AiGatewaySdf)
        : undefined;

      // Start polling progress right before the AI call
      pollProgress();

      const res = await projectService.analyzeProject(projectId, description.trim(), {
        modules: selectedModules,
        default_question_answers: latestDefaults.mandatory_answers,
        prefilled_sdf: prefilledWithAccess,
        conversation_context: {
          business_answers: Object.fromEntries(
            BUSINESS_QUESTIONS.map((q) => [q.id, { question: q.question, answer: (businessAnswers[q.id] || '').trim() }])
          ),
          access_requirements: [defaultAdminGroup],
        },
        ...(ackedFromOpts.length ? { acknowledged_unsupported_features: ackedFromOpts } : {}),
      });
      progressCancelled = true;
      setProject(res.project);

      // Pre-distributor answer review halted the pipeline. Show the feedback
      // modal and stop — there is no SDF or clarification flow to advance yet.
      if (res.status === 'answer_review_required' && res.answer_review) {
        setSdf(null);
        setSdfVersion(null);
        setQuestions([]);
        setAnswersById({});
        setSdfComplete(false);
        setAnswerReview(res.answer_review);
        clearGeneratingFlag();
        // Hide the generation progress UI; the review modal takes over.
        setAnalyzePhase(''); setGenProgress(null); setGenResult(null);
        return;
      }

      const resQuestions = filterQuestions(res.questions || []);
      setClarifyRound(res.cycle || 1);
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);

      // The user successfully proceeded past the reviewer — clear any stale
      // review state and acknowledged-feature buffer so the next generation
      // starts from a clean slate.
      setAnswerReview(null);
      setAcknowledgedFeatures([]);

      // If distributor returned clarifying questions (early pipeline stop), show them in the modal
      if (resQuestions.length > 0 && !res.sdf_complete) {
        setSdf(res.sdf || null); setQuestions(resQuestions); setAnswersById({});
        setSdfComplete(false);
        setGenProgress({ step: 'clarifications', pct: 20, detail: t('projectDetail:progress.waitingAnswers') });
        // Keep modal open — questions mode will activate automatically
        return;
      }

      setSdf(res.sdf || null); setQuestions([]); setAnswersById({});
      setSdfComplete(res.sdf_complete || false);
      appendReviewHistory({
        action: 'generated',
        version: typeof res.sdf_version === 'number' ? res.sdf_version : null,
        status: res.project.status || null,
        note: t('projectDetail:history.generated'),
      });
      clearGeneratingFlag();
      setGenProgress({ step: 'done', pct: 100, detail: t('projectDetail:progress.complete') });
      setGenResult('success');
      setTimeout(() => { setAnalyzePhase(''); setGenResult(null); setGenProgress(null); }, 2500);
    } catch (err: any) {
      progressCancelled = true;
      clearGeneratingFlag();
      setSdf(null); setSdfVersion(null); setQuestions([]);
      setGenResult('error');
      setGenErrorMsg(mapGenerationError(err));
    } finally { progressCancelled = true; setAnalyzing(false); }
  };

  const handleReviewEditAnswers = (questionId?: string | null) => {
    setAnswerReview(null);
    setAcknowledgedFeatures([]);
    if (!questionId) {
      setBusinessStep(0);
      setTimeout(() => stepRefs[2]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return;
    }
    const idx = BUSINESS_QUESTION_IDS.findIndex((q) => q.id === questionId);
    if (idx < 0) return;
    setBusinessStep(idx);
    setTimeout(() => stepRefs[2]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleReviewAcknowledge = async (acknowledged: string[]) => {
    setAcknowledgedFeatures(acknowledged);
    setAnswerReview(null);
    await analyze({ acknowledgedFeatures: acknowledged });
  };

  const handleChangeReviewEdit = () => {
    if (pendingChangeReview?.source === 'ai_edit') {
      setAiEditText(pendingChangeReview.instructions);
    }
    setChangeReview(null);
    setPendingChangeReview(null);
  };

  const handleChangeReviewAcknowledge = async (acknowledged: string[]) => {
    if (!pendingChangeReview) return;
    setChangeReview(null);
    const pending = pendingChangeReview;
    if (pending.source === 'ai_edit') {
      await applyAiEdit(acknowledged);
    } else {
      await requestRevisionFromReview(pending.instructions, acknowledged);
    }
  };

  const submitModalAnswers = async () => {
    if (!projectId || !sdf || questions.length === 0) return;
    setClarifying(true);
    setGenProgress({ step: 'generators', pct: 30, detail: t('projectDetail:progress.processing') });

    let progressCancelled = false;
    const pollProgress = async () => {
      if (progressCancelled || !projectId) return;
      try {
        const prog = await projectService.getGenerationProgress(projectId);
        if (!progressCancelled && prog) setGenProgress(prog);
      } catch { /* ignore */ }
      if (!progressCancelled) setTimeout(pollProgress, 1500);
    };

    try {
      const answers: ClarificationAnswer[] = questions.map((q) => ({ question_id: q.id, answer: (answersById[q.id] || '').trim() }));
      setQuestions([]); setAnswersById({});
      pollProgress();
      const res = await projectService.clarifyProject(projectId, sdf, answers, description.trim());
      progressCancelled = true;
      setProject(res.project);
      const resQuestions = filterQuestions(res.questions || []);
      setClarifyRound(res.cycle || clarifyRound + 1);
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);

      if (resQuestions.length > 0 && !res.sdf_complete) {
        setSdf(res.sdf ?? null); setQuestions(resQuestions); setAnswersById({});
        setSdfComplete(false);
        setGenProgress({ step: 'clarifications', pct: 20, detail: t('projectDetail:progress.waitingAnswers') });
        return;
      }

      setSdf(res.sdf ?? null); setQuestions([]); setAnswersById({});
      setSdfComplete(res.sdf_complete || false);
      appendReviewHistory({
        action: 'clarified',
        version: typeof res.sdf_version === 'number' ? res.sdf_version : null,
        status: res.project.status || null,
        note: t('projectDetail:history.clarified'),
      });
      clearGeneratingFlag();
      setGenProgress({ step: 'done', pct: 100, detail: t('projectDetail:progress.complete') });
      setGenResult('success');
      setTimeout(() => { setAnalyzePhase(''); setGenResult(null); setGenProgress(null); }, 2500);
    } catch (err: any) {
      progressCancelled = true;
      clearGeneratingFlag();
      setGenResult('error');
      setGenErrorMsg(mapGenerationError(err));
    } finally { progressCancelled = true; setClarifying(false); }
  };

  const applyAiEdit = async (acknowledgedUnsupportedFeatures?: string[]) => {
    const instructions = pendingChangeReview?.source === 'ai_edit'
      ? pendingChangeReview.instructions
      : aiEditText.trim();
    if (!projectId || !instructions.trim()) return;
    setSaving(true); setError('');
    try {
      const res = await projectService.aiEditSdf(projectId, instructions.trim(), sdf || undefined, acknowledgedUnsupportedFeatures);
      if (res.status === 'change_review_required' && res.answer_review) {
        setChangeReview(res.answer_review);
        setPendingChangeReview({ source: 'ai_edit', instructions: instructions.trim() });
        setProject(res.project);
        return;
      }
      setChangeReview(null);
      setPendingChangeReview(null);
      setProject(res.project); setSdf(res.sdf ?? null); setQuestions(filterQuestions(res.questions || [])); setAnswersById({}); setAiEditText('');
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      appendReviewHistory({ action: 'ai_revision', version: typeof res.sdf_version === 'number' ? res.sdf_version : null, status: res.project.status || null, note: t('projectDetail:history.aiRevision') });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.aiEditFailed')); }
    finally { setSaving(false); }
  };

  const approveReview = async () => {
    if (!projectId) return;
    setReviewActionRunning(true); setError('');
    try {
      const res = await projectService.approveReview(projectId);
      setProject(res.project);
      appendReviewHistory({ action: 'approved', version: res.approval.sdf_version, status: res.project.status || null, note: t('projectDetail:history.approved') });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.approveFailed')); }
    finally { setReviewActionRunning(false); }
  };

  const rejectReview = async () => {
    if (!projectId) return;
    setReviewActionRunning(true); setError('');
    try {
      const res = await projectService.rejectReview(projectId);
      setProject(res.project);
      appendReviewHistory({ action: 'rejected', version: res.approval.sdf_version, status: res.project.status || null, note: t('projectDetail:history.rejected') });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.rejectFailed')); }
    finally { setReviewActionRunning(false); }
  };

  const requestRevisionFromReview = async (instructions: string, acknowledgedUnsupportedFeatures?: string[]) => {
    if (!projectId || !instructions.trim()) return;
    setReviewActionRunning(true); setError('');
    try {
      const res = await projectService.requestRevision(projectId, instructions.trim(), undefined, acknowledgedUnsupportedFeatures);
      if (res.status === 'change_review_required' && res.answer_review) {
        setChangeReview(res.answer_review);
        setPendingChangeReview({ source: 'review_revision', instructions: instructions.trim() });
        setProject(res.project);
        return;
      }
      setChangeReview(null);
      setPendingChangeReview(null);
      setProject(res.project); setSdf(res.sdf ?? null); setQuestions(filterQuestions(res.questions || [])); setAnswersById({});
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      if (res.approval) {
        appendReviewHistory({ action: 'revision_requested', version: res.approval.sdf_version, status: null, note: instructions.trim() });
      }
      appendReviewHistory({ action: 'ai_revision', version: typeof res.sdf_version === 'number' ? res.sdf_version : null, status: res.project.status || null, note: t('projectDetail:history.aiRevisionFromReview') });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || t('projectDetail:errors.revisionFailed')); }
    finally { setReviewActionRunning(false); }
  };

  /* ── Render ─────────────────────────────────────────────── */

  if (loading) return <div className="flex items-center justify-center py-20 text-app-text-muted">{t('projectDetail:loading.project')}</div>;

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-app-text">{t('projectDetail:header.projectFallback')}</h1>
          <Link to="/" className="text-sm font-semibold text-app-accent-blue hover:underline">{t('common:back')}</Link>
        </div>
        <div className="rounded-lg border bg-app-surface p-4 text-sm text-app-danger">{error || t('projectDetail:errors.notFound')}</div>
      </div>
    );
  }

  const lockedLangLabel = project
    ? t(`projects:card.languages.${normalizeLanguage(project.language || 'en')}`)
    : '';

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {languageBlocked && (
        <div
          role="alert"
          className="rounded-xl border border-app-warning-border bg-app-warning-soft px-4 py-3 text-sm text-app-warning shadow-sm"
        >
          <p className="font-semibold">{t('projectDetail:languageGate.title')}</p>
          <p className="mt-1 opacity-90">
            {t('projectDetail:languageGate.body', { language: lockedLangLabel })}
          </p>
          <Link
            to="/settings"
            className="mt-3 inline-flex items-center rounded-lg border border-app-warning-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-surface-hover"
          >
            {t('projectDetail:languageGate.openSettings')}
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-app-text break-words">{project.name}</h1>
          <p className="mt-1 text-sm text-app-text-muted">{t('projectDetail:header.subtitle')}</p>
        </div>
        <Link to="/" className="self-start rounded-lg border bg-app-surface px-3 py-2 text-sm font-semibold text-app-text shadow-sm hover:bg-app-surface-muted">{t('projectDetail:header.backToProjects')}</Link>
      </div>

      <div className={languageBlocked ? 'pointer-events-none select-none opacity-[0.55]' : ''}>
      {/* Step Progress Bar — hidden after generation */}
      {!canShowPostGeneration && (
        <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
          <nav className="flex items-center gap-1 min-w-max sm:min-w-0">
            {STEPS.map((label, i) => {
              const done = i < currentStep;
              const active = i === currentStep;
              const clickable = done || active;
              return (
                <div key={label} className="flex flex-1 items-center min-w-max sm:min-w-0">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => stepRefs[i]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className={`flex items-center gap-2 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? 'bg-app-accent-blue text-white' : active ? 'border-2 border-app-accent-blue text-app-accent-blue' : 'border-2 border-app-border-strong text-app-text-subtle'}`}>
                      {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`hidden text-xs font-medium sm:block ${done ? 'text-app-accent-blue' : active ? 'text-app-text' : 'text-app-text-subtle'}`}>{label}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${done ? 'bg-app-accent-blue' : 'bg-app-surface-hover'} min-w-[24px] sm:min-w-0`} />}
                </div>
              );
            })}
          </nav>
        </div>
      )}

      {error && <div className="rounded-lg border border-app-danger-border bg-app-danger-soft px-4 py-3 text-sm text-app-danger">{error}</div>}

      {/* Steps 0-2 and generation area — hidden after SDF is generated */}
      {!sdf && (
        <>
          {/* Step 0: Choose Modules */}
          <div ref={stepRefs[0]} className="scroll-mt-6">
            <ModuleSelector selectedModules={selectedModules} onToggleModule={toggleModule} />
          </div>

          {/* Step 1: Answer Questions */}
          <div ref={stepRefs[1]} className="scroll-mt-6">
            <SlideIn show={selectedModules.length > 0}>
              {visibleCoercedNotices.length > 0 && (
                <div className="mb-3 space-y-2">
                  {visibleCoercedNotices.map((notice, ni) => (
                    <div
                      key={`${notice.question_id || notice.key}-${ni}`}
                      role="status"
                      className="rounded-lg border border-app-info-border bg-app-info-soft px-3 py-2 text-xs text-app-accent-dark-blue"
                    >
                      <span className="font-semibold">
                        {notice.direction === 'auto_enable'
                          ? t('projectDetail:dependency.autoEnabledTitle', { defaultValue: 'Auto-enabled' })
                          : t('projectDetail:dependency.cascadedOffTitle', { defaultValue: 'Disabled by dependency' })}
                        {': '}
                      </span>
                      {notice.text}
                    </div>
                  ))}
                </div>
              )}
              <DefaultQuestions
                answersById={defaultAnswersById}
                completion={defaultCompletion} questionsByModule={questionsByModule}
                moduleCompletionCounts={moduleCompletionCounts} loading={loadingDefaultQuestions}
                saving={savingDefaultAnswers} canSave={canSaveDefaultAnswers}
                onUpdateAnswer={updateDefaultAnswer} onToggleMultiChoice={toggleMultiChoiceAnswer}
                onSave={saveDefaultAnswers}
                onHelpWithQuestion={handleHelpWithQuestion}
                autoEnabledById={autoEnabledById}
                feedsHintsByQuestionId={feedsHintsByQuestionId}
              />
            </SlideIn>
          </div>

          {/* Step 2: Business Questions */}
          <div ref={stepRefs[2]} className="scroll-mt-6">
            <SlideIn show={!!defaultCompletion?.is_complete}>
              {visiblePrecheckModules.length > 0 && (
                <div className="mb-3 space-y-2">
                  {visiblePrecheckModules.map((m) => {
                    const moduleLabel = t(`projectDetail:modules.${m.module}.label`, {
                      defaultValue: m.module,
                    });
                    return (
                      <div
                        key={`precheck-${m.module}`}
                        role="status"
                        className="flex items-start gap-3 rounded-lg border border-app-warning-border bg-app-warning-soft px-3 py-2 text-xs text-app-accent-dark-blue"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="font-semibold">
                            {t('projectDetail:precheck.title', {
                              module: moduleLabel,
                              defaultValue: `Heads up — your description sounds like it might need ${moduleLabel}`,
                            })}
                          </div>
                          {m.reason && (
                            <div className="text-app-text-muted">
                              {t('projectDetail:precheck.reason', {
                                reason: m.reason,
                                defaultValue: `From your description: ${m.reason}`,
                              })}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handlePrecheckAddModule(m.module)}
                              className="rounded-md border border-app-accent bg-app-accent px-2 py-1 text-xs font-medium text-white hover:opacity-90"
                            >
                              {t('projectDetail:precheck.addModule', {
                                module: moduleLabel,
                                defaultValue: `Add ${moduleLabel}`,
                              })}
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrecheckDismiss(m.module)}
                              className="rounded-md border border-app-border bg-transparent px-2 py-1 text-xs font-medium text-app-text hover:bg-app-surface"
                            >
                              {t('projectDetail:precheck.continueWithout', {
                                defaultValue: 'Continue without it',
                              })}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={t('projectDetail:precheck.dismissAria', { defaultValue: 'Dismiss' })}
                          onClick={() => handlePrecheckDismiss(m.module)}
                          className="rounded p-1 text-app-text-muted hover:bg-app-surface"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <BusinessQuestions
                answers={businessAnswers} step={businessStep} canAnalyze={canAnalyze} running={running}
                skipWarningOpen={bizSkipWarningOpen}
                onSetAnswers={setBusinessAnswers} onSetStep={setBusinessStep}
                onAnalyze={() => { void analyze(); }}
                onHelpWithQuestion={handleHelpWithQuestion}
                onSkipWarningChange={setBizSkipWarningOpen}
              />
            </SlideIn>
          </div>

          {/* Step 3: Review & Generate (scroll target) */}
          <div ref={stepRefs[3]} className="scroll-mt-6" />
        </>
      )}

      {/* Step 4: Post-generation (Download & Run) */}
      <div ref={stepRefs[4]} className="scroll-mt-6">
        <SlideIn show={canShowPostGeneration} className="space-y-8">
          {canShowPostGeneration && sdf && (
            <PostGenerationPanel
            sdf={sdf} preview={preview}
            projectStatus={project.status} sdfVersion={sdfVersion} reviewHistory={reviewHistory} running={running}
            onApproveReview={() => { void approveReview(); }}
            onRejectReview={() => { void rejectReview(); }}
            onRequestRevision={(instructions) => { void requestRevisionFromReview(instructions); }}
            onPreview={() => navigate(`/projects/${projectId}/preview`)}
          />
        )}
        </SlideIn>
      </div>
      </div>

      <GenerationModal
        phase={analyzePhase}
        result={genResult}
        errorMessage={genErrorMsg}
        onClose={closeGenerationModal}
        progress={genProgress}
        questions={questions}
        answersById={answersById}
        onSetAnswers={setAnswersById}
        onSubmitAnswers={() => { void submitModalAnswers(); }}
        canSubmitAnswers={canSubmitAnswers}
        submittingAnswers={clarifying}
      />

      {answerReview && (
        <ReviewFeedbackModal
          review={answerReview}
          answers={businessAnswers}
          running={analyzing}
          onEditQuestion={handleReviewEditAnswers}
          onAcknowledgeAndContinue={(features) => { void handleReviewAcknowledge(features); }}
          onClose={() => setAnswerReview(null)}
        />
      )}

      {changeReview && pendingChangeReview && (
        <ReviewFeedbackModal
          review={changeReview}
          answers={{}}
          running={saving || reviewActionRunning}
          variant="change_request"
          requestText={pendingChangeReview.instructions}
          onEditQuestion={handleChangeReviewEdit}
          onAcknowledgeAndContinue={(features) => { void handleChangeReviewAcknowledge(features); }}
          onClose={() => { setChangeReview(null); setPendingChangeReview(null); }}
        />
      )}
    </div>
  );
}
