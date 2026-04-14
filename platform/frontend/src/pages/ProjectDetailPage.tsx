import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../types/project';
import type { AiGatewaySdf, ClarificationAnswer, ClarificationQuestion } from '../types/aiGateway';
import type {
  DefaultModuleQuestion,
  DefaultQuestionCompletion,
  DefaultQuestionStateResponse,
} from '../types/defaultQuestions';

import {
  MODULE_KEYS, STEPS, BUSINESS_QUESTIONS,
  SlideIn, IconCheck,
  detectUserPlatform,
} from '../components/project/projectConstants';

import DefaultQuestions from '../components/project/DefaultQuestions';
import BusinessQuestions from '../components/project/BusinessQuestions';
import type { ReviewHistoryItem } from '../components/project/ReviewApprovalPanel';
import { buildPreview } from '../components/project/buildPreview';
import ModuleSelector from '../components/project/ModuleSelector';
import PostGenerationPanel from '../components/project/PostGenerationPanel';
import GenerationModal from '../components/project/GenerationModal';
import { useChatContext } from '../context/ChatContext';

export default function ProjectDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
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
  const [loadingDefaultQuestions, setLoadingDefaultQuestions] = useState(false);
  const [savingDefaultAnswers, setSavingDefaultAnswers] = useState(false);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [standaloneRunning, setStandaloneRunning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draftJson, setDraftJson] = useState('');
  const [draftError, setDraftError] = useState('');
  const [aiEditText, setAiEditText] = useState('');
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);
  const [clarifyRound, setClarifyRound] = useState(0);
  const [, setSdfComplete] = useState(false);
  const [analyzePhase, setAnalyzePhase] = useState('');
  const [sdfVersion, setSdfVersion] = useState<number | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [reviewActionRunning, setReviewActionRunning] = useState(false);
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [genResult, setGenResult] = useState<'success' | 'error' | null>(null);
  const [genErrorMsg, setGenErrorMsg] = useState('');
  const [genProgress, setGenProgress] = useState<{ step: string; pct: number; detail: string } | null>(null);
  const [bizSkipWarningOpen, setBizSkipWarningOpen] = useState(false);

  const { setProjectContext, openChat, sendMessage, setPulsing } = useChatContext();
  const stepRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const hasScrolledRef = useRef(false);
  const expectQuestionFetchRef = useRef(false);
  const savedDefaultAnswersRef = useRef<Record<string, string | string[]> | null>(null);
  const detectedPlatform = useMemo(() => detectUserPlatform(), []);
  const running = analyzing || clarifying || saving || reviewActionRunning;
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
      if (!MODULE_KEYS.includes(key) || seen.has(key)) continue;
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
        // Only restore the SDF if business answers are actually complete AND
        // the project is not stuck in 'Analyzing' (which means the last generation failed).
        const businessReady = BUSINESS_QUESTIONS
          .filter((q) => !q.optional)
          .every((q) => (initialBusinessAnswers[q.id] || '').trim().length > 0);
        const generationFailed = p.status === 'Analyzing';
        if (latest?.sdf && businessReady && !generationFailed) {
          setSdf(latest.sdf);
          setSdfVersion(typeof latest.sdf_version === 'number' ? latest.sdf_version : null);
          setQuestions(filterQuestions(Array.isArray(latest.sdf.clarifications_needed) ? latest.sdf.clarifications_needed : []));
        }
        const serverHistory = await projectService.getReviewHistory(projectId).catch(() => ({ history: [] }));
        if (!cancelled && serverHistory.history.length > 0) {
          setReviewHistory(serverHistory.history);
        } else if (!cancelled && latest?.sdf && businessReady && !generationFailed) {
          setReviewHistory([{
            id: `baseline-${latest.sdf_version || 0}`,
            action: 'generated',
            version: typeof latest.sdf_version === 'number' ? latest.sdf_version : null,
            status: p.status || null,
            note: 'Loaded latest saved SDF from project history.',
            createdAt: p.updated_at || new Date().toISOString(),
          }]);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Failed to load project');
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
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Failed to load default module questions');
      } finally { if (!cancelled) setLoadingDefaultQuestions(false); }
    })();
    return () => { cancelled = true; };
  }, [projectId, selectedModulesKey]);

  useEffect(() => { if (sdf) { setDraftJson(JSON.stringify(sdf, null, 2)); setDraftError(''); } }, [sdf]);

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

  const currentStep = useMemo(() => {
    if (!selectedModules.length) return 0;
    if (!defaultCompletion?.is_complete) return 1;
    if (!businessComplete) return 2;
    if (sdf) return 4;
    return 3;
  }, [selectedModules, defaultCompletion, businessComplete, sdf]);

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
      currentStep: STEPS[currentStep] ?? 'Choose Modules',
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

  const preview = useMemo(() => sdf ? buildPreview(sdf) : null, [sdf]);

  /* ── Handlers ───────────────────────────────────────────── */

  const updateDefaultAnswer = (questionId: string, value: string | string[]) => setDefaultAnswersById((prev) => ({ ...prev, [questionId]: value }));
  const toggleMultiChoiceAnswer = (questionId: string, option: string, enabled: boolean) => {
    setDefaultAnswersById((prev) => {
      const existing = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      return { ...prev, [questionId]: enabled ? Array.from(new Set([...existing, option])) : existing.filter((item) => item !== option) };
    });
  };
  const toggleModule = (key: string) => {
    setSelectedModules((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]);
    if (sdf) { setSdf(null); setSdfVersion(null); setQuestions([]); }
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
      // Clear stale SDF so the user must complete business questions before
      // the post-generation panel re-appears.
      if (sdf) { setSdf(null); setSdfVersion(null); setQuestions([]); }
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Failed to save answers'); }
    finally { setSavingDefaultAnswers(false); }
  };

  const mapGenerationError = (err: any): string => {
    const raw = err?.response?.data?.error || err?.message || '';
    console.error('ERP generation error:', raw, err);
    if (err?.code === 'ECONNABORTED') return 'Generation is taking longer than expected. Your inputs are saved — please try again in a few minutes.';
    if (!err?.response && err?.message?.toLowerCase().includes('network')) return 'Our AI service is temporarily unreachable. We\'re working on it — please try again in a few minutes.';
    if (err?.response?.status >= 500) return 'Our AI service encountered an issue. We\'re working on it — please try again in a few minutes.';
    return 'Something went wrong during generation. Please try again.';
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
    setAnalyzePhase('Resuming — checking generation status...');
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
          setGenProgress({ step: 'done', pct: 100, detail: 'Complete' });
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
      setGenErrorMsg('Generation timed out. Your inputs are saved — please try again.');
    }, 3 * 60 * 1000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [loading, generatingKey]);

  const analyze = async () => {
    if (!projectId) return;
    setAnalyzing(true); setError(''); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
    setAnalyzePhase('Saving your answers...');
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
        setError('Please answer all required questions before generating.');
        setAnalyzePhase(''); clearGeneratingFlag();
        return;
      }

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
      });
      progressCancelled = true;
      setProject(res.project);
      const resQuestions = filterQuestions(res.questions || []);
      setClarifyRound(res.cycle || 1);
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);

      // If distributor returned clarifying questions (early pipeline stop), show them in the modal
      if (resQuestions.length > 0 && !res.sdf_complete) {
        setSdf(res.sdf); setQuestions(resQuestions); setAnswersById({});
        setSdfComplete(false);
        setGenProgress({ step: 'clarifications', pct: 20, detail: 'Waiting for your answers' });
        // Keep modal open — questions mode will activate automatically
        return;
      }

      setSdf(res.sdf); setQuestions([]); setAnswersById({});
      setSdfComplete(res.sdf_complete || false);
      appendReviewHistory({
        action: 'generated',
        version: typeof res.sdf_version === 'number' ? res.sdf_version : null,
        status: res.project.status || null,
        note: 'Generated a new SDF from build mode inputs.',
      });
      clearGeneratingFlag();
      setGenProgress({ step: 'done', pct: 100, detail: 'Complete' });
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

  const submitModalAnswers = async () => {
    if (!projectId || !sdf || questions.length === 0) return;
    setClarifying(true);
    setGenProgress({ step: 'generators', pct: 30, detail: 'Processing your answers...' });

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
        setSdf(res.sdf); setQuestions(resQuestions); setAnswersById({});
        setSdfComplete(false);
        setGenProgress({ step: 'clarifications', pct: 20, detail: 'Waiting for your answers' });
        return;
      }

      setSdf(res.sdf); setQuestions([]); setAnswersById({});
      setSdfComplete(res.sdf_complete || false);
      appendReviewHistory({
        action: 'clarified',
        version: typeof res.sdf_version === 'number' ? res.sdf_version : null,
        status: res.project.status || null,
        note: 'Applied clarification answers to the current SDF.',
      });
      clearGeneratingFlag();
      setGenProgress({ step: 'done', pct: 100, detail: 'Complete' });
      setGenResult('success');
      setTimeout(() => { setAnalyzePhase(''); setGenResult(null); setGenProgress(null); }, 2500);
    } catch (err: any) {
      progressCancelled = true;
      clearGeneratingFlag();
      setGenResult('error');
      setGenErrorMsg(mapGenerationError(err));
    } finally { progressCancelled = true; setClarifying(false); }
  };

  const saveDraft = async () => {
    if (!projectId || !draftJson) return;
    setSaving(true); setError(''); setDraftError('');
    try {
      let parsed: any;
      try { parsed = JSON.parse(draftJson); } catch (e: any) { setDraftError('Invalid JSON: ' + (e?.message || 'Parse error')); return; }
      const res = await projectService.saveSdf(projectId, parsed);
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({}); setDraftJson(JSON.stringify(res.sdf, null, 2));
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      appendReviewHistory({ action: 'manual_save', version: typeof res.sdf_version === 'number' ? res.sdf_version : null, status: res.project.status || null, note: 'Saved manual JSON edits to the SDF.' });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const applyAiEdit = async () => {
    if (!projectId || !aiEditText.trim()) return;
    setSaving(true); setError('');
    try {
      const res = await projectService.aiEditSdf(projectId, aiEditText.trim(), sdf || undefined);
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({}); setAiEditText('');
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      appendReviewHistory({ action: 'ai_revision', version: typeof res.sdf_version === 'number' ? res.sdf_version : null, status: res.project.status || null, note: 'Applied AI edit instructions from SDF preview.' });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'AI edit failed'); }
    finally { setSaving(false); }
  };

  const approveReview = async () => {
    if (!projectId) return;
    setReviewActionRunning(true); setError('');
    try {
      const res = await projectService.approveReview(projectId);
      setProject(res.project);
      appendReviewHistory({ action: 'approved', version: res.approval.sdf_version, status: res.project.status || null, note: 'Approved current SDF for ERP generation.' });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Approve action failed'); }
    finally { setReviewActionRunning(false); }
  };

  const rejectReview = async () => {
    if (!projectId) return;
    setReviewActionRunning(true); setError('');
    try {
      const res = await projectService.rejectReview(projectId);
      setProject(res.project);
      appendReviewHistory({ action: 'rejected', version: res.approval.sdf_version, status: res.project.status || null, note: 'Rejected current SDF and moved project back to Draft.' });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Reject action failed'); }
    finally { setReviewActionRunning(false); }
  };

  const requestRevisionFromReview = async (instructions: string) => {
    if (!projectId || !instructions.trim()) return;
    setReviewActionRunning(true); setError('');
    try {
      const res = await projectService.requestRevision(projectId, instructions.trim());
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({});
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      appendReviewHistory({ action: 'revision_requested', version: res.approval.sdf_version, status: null, note: instructions.trim() });
      appendReviewHistory({ action: 'ai_revision', version: typeof res.sdf_version === 'number' ? res.sdf_version : null, status: res.project.status || null, note: 'Applied AI revision requested from review panel.' });
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Revision request failed'); }
    finally { setReviewActionRunning(false); }
  };

  const downloadZip = async () => {
    if (!projectId) return;
    setSaving(true); setError('');
    try {
      const blob = await projectService.generateErpZip(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = ((sdf as any)?.project_name || project?.name || 'custom-erp') + '.zip'; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      try { const text = await (err?.response?.data instanceof Blob ? err.response.data.text() : Promise.resolve('')); const parsed = text ? JSON.parse(text) : null; setError(parsed?.error || err?.message || 'Generate failed'); }
      catch { setError(err?.response?.data?.error || err?.message || 'Generate failed'); }
    } finally { setSaving(false); }
  };

  const downloadStandalone = async (platform: string) => {
    if (!projectId) return;
    setStandaloneRunning(platform); setError('');
    try {
      const blob = await projectService.generateStandaloneErpZip(projectId, platform);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${(sdf as any)?.project_name || project?.name || 'custom-erp'}-${platform}.zip`; a.click();
      URL.revokeObjectURL(url); setDownloadStarted(platform);
    } catch (err: any) {
      try { const text = await (err?.response?.data instanceof Blob ? err.response.data.text() : Promise.resolve('')); const parsed = text ? JSON.parse(text) : null; setError(parsed?.error || err?.message || 'Standalone generation failed'); }
      catch { setError(err?.response?.data?.error || err?.message || 'Standalone generation failed'); }
    } finally { setStandaloneRunning(null); }
  };

  /* ── Render ─────────────────────────────────────────────── */

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500">Loading project...</div>;

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Project</h1>
          <Link to="/" className="text-sm font-semibold text-indigo-600 hover:underline">Back</Link>
        </div>
        <div className="rounded-lg border bg-white p-4 text-sm text-red-600">{error || 'Project not found'}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Set up your ERP step by step</p>
        </div>
        <Link to="/" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Back to Projects</Link>
      </div>

      {/* Step Progress Bar — hidden after generation */}
      {!sdf && (
        <nav className="flex items-center gap-1">
          {STEPS.map((label, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            const clickable = done || active;
            return (
              <div key={label} className="flex flex-1 items-center">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => stepRefs[i]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={`flex items-center gap-2 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? 'bg-indigo-600 text-white' : active ? 'border-2 border-indigo-600 text-indigo-600' : 'border-2 border-slate-300 text-slate-400'}`}>
                    {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={`hidden text-xs font-medium sm:block ${done ? 'text-indigo-600' : active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
              </div>
            );
          })}
        </nav>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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
              <DefaultQuestions
                answersById={defaultAnswersById}
                completion={defaultCompletion} questionsByModule={questionsByModule}
                moduleCompletionCounts={moduleCompletionCounts} loading={loadingDefaultQuestions}
                saving={savingDefaultAnswers} canSave={canSaveDefaultAnswers}
                onUpdateAnswer={updateDefaultAnswer} onToggleMultiChoice={toggleMultiChoiceAnswer}
                onSave={saveDefaultAnswers}
              />
            </SlideIn>
          </div>

          {/* Step 2: Business Questions */}
          <div ref={stepRefs[2]} className="scroll-mt-6">
            <SlideIn show={!!defaultCompletion?.is_complete}>
              <BusinessQuestions
                answers={businessAnswers} step={businessStep} canAnalyze={canAnalyze} running={running}
                skipWarningOpen={bizSkipWarningOpen}
                onSetAnswers={setBusinessAnswers} onSetStep={setBusinessStep}
                onAnalyze={() => { void analyze(); }}
                onHelpWithQuestion={(questionText, currentAnswer) => {
                  const prompt = currentAnswer
                    ? `I need help with this question: "${questionText}"\nMy current answer is: "${currentAnswer}"\nCan you help me improve or expand this answer?`
                    : `I need help answering this question: "${questionText}"\nCan you explain what this means and give me guidance on how to answer it for my business?`;
                  openChat();
                  void sendMessage(prompt);
                }}
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
        <SlideIn show={!!sdf} className="space-y-8">
          {sdf && (
            <PostGenerationPanel
            sdf={sdf} preview={preview}
            projectStatus={project.status} sdfVersion={sdfVersion} reviewHistory={reviewHistory} running={running}
            onApproveReview={() => { void approveReview(); }}
            onRejectReview={() => { void rejectReview(); }}
            onRequestRevision={(instructions) => { void requestRevisionFromReview(instructions); }}
            onPreview={() => navigate(`/projects/${projectId}/preview`)}
            showAdvancedView={showAdvancedView}
            onToggleAdvancedView={() => setShowAdvancedView((v) => !v)}
            detectedPlatform={detectedPlatform} standaloneRunning={standaloneRunning} downloadStarted={downloadStarted}
            draftJson={draftJson} draftError={draftError} aiEditText={aiEditText}
            onSaveDraft={saveDraft} onDownloadStandalone={downloadStandalone} onDownloadZip={downloadZip}
            onApplyAiEdit={applyAiEdit} onSetAiEditText={setAiEditText} onSetDraftJson={setDraftJson}
            onResetDraftJson={() => setDraftJson(JSON.stringify(sdf, null, 2))}
          />
        )}
        </SlideIn>
      </div>
    </div>
  );
}
