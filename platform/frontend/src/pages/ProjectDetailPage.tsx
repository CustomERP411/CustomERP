import { useEffect, useMemo, useState } from 'react';
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
  SlideIn, IconCheck, summarizeModulesForPreview,
  detectUserPlatform,
} from '../components/project/projectConstants';

import DefaultQuestions from '../components/project/DefaultQuestions';
import BusinessQuestions from '../components/project/BusinessQuestions';
import AccessRequirements, { createDefaultAccessRequirement, type AccessRequirementItem } from '../components/project/AccessRequirements';
import type { ReviewHistoryItem } from '../components/project/ReviewApprovalPanel';
import { buildPreview } from '../components/project/buildPreview';
import ModuleSelector from '../components/project/ModuleSelector';
import PrefilledConfigSummary from '../components/project/PrefilledConfigSummary';
import ChatPanel from '../components/project/ChatPanel';
import PostGenerationPanel from '../components/project/PostGenerationPanel';
import BuildModeConfirmDialog from '../components/project/BuildModeConfirmDialog';

type ProjectMode = 'chat' | 'build';

export default function ProjectDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const projectId = String(params.id || '');

  /* ── State ──────────────────────────────────────────────── */
  const [project, setProject] = useState<Project | null>(null);
  const [businessAnswers, setBusinessAnswers] = useState<Record<string, string>>({});
  const [businessStep, setBusinessStep] = useState(0);
  const [sdf, setSdf] = useState<AiGatewaySdf | null>(null);
  const [prefilledSdf, setPrefilledSdf] = useState<AiGatewaySdf | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>(MODULE_KEYS);
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
  const [showPrefilledJson, setShowPrefilledJson] = useState(false);
  const [draftJson, setDraftJson] = useState('');
  const [draftError, setDraftError] = useState('');
  const [aiEditText, setAiEditText] = useState('');
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);
  const [clarifyRound, setClarifyRound] = useState(0);
  const [sdfComplete, setSdfComplete] = useState(false);
  const [analyzePhase, setAnalyzePhase] = useState('');
  const [projectMode, setProjectMode] = useState<ProjectMode>('chat');
  const [showBuildModeConfirm, setShowBuildModeConfirm] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSuggestedModules, setChatSuggestedModules] = useState<string[]>([]);
  const [chatDiscussionPoints, setChatDiscussionPoints] = useState<string[]>([]);
  const [chatConfidence, setChatConfidence] = useState<string>('');
  const [sdfVersion, setSdfVersion] = useState<number | null>(null);
  const [reviewHistory, setReviewHistory] = useState<ReviewHistoryItem[]>([]);
  const [reviewActionRunning, setReviewActionRunning] = useState(false);
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [accessRequirements, setAccessRequirements] = useState<AccessRequirementItem[]>([
    {
      ...createDefaultAccessRequirement(),
      groupName: 'Administrators',
      userCount: '1',
      responsibilities: 'Manage ERP users, groups, and system-wide access rules.',
      permissions: ['manage_users', 'manage_groups', 'manage_permissions', 'view_records'],
    },
  ]);

  const detectedPlatform = useMemo(() => detectUserPlatform(), []);
  const running = analyzing || clarifying || saving || reviewActionRunning;
  const projectModeStorageKey = useMemo(
    () => (projectId ? `project_mode:${projectId}` : ''),
    [projectId]
  );
  const accessRequirementsStorageKey = useMemo(
    () => (projectId ? `project_access_requirements:${projectId}` : ''),
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

  const applyDefaultQuestionState = (payload: DefaultQuestionStateResponse) => {
    const questionList = Array.isArray(payload?.questions) ? payload.questions : [];
    const answers: Record<string, string | string[]> = {};
    for (const question of questionList) {
      if (Array.isArray(question.answer)) answers[question.id] = question.answer;
      else if (typeof question.answer === 'string') answers[question.id] = question.answer;
      else answers[question.id] = question.type === 'multi_choice' ? [] : '';
    }
    setDefaultQuestions(questionList);
    setDefaultAnswersById(answers);
    setPrefilledSdf(payload?.prefilled_sdf || null);
    setDefaultCompletion(payload?.prefill_validation || payload?.completion || null);
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
      try {
        const p = await projectService.getProject(projectId);
        const latest = await projectService.getLatestSdf(projectId).catch(() => ({ sdf: null, sdf_version: null }));
        if (cancelled) return;
        setProject(p);
        if (p.mode === 'chat' || p.mode === 'build') setProjectMode(p.mode);
        if (p.description) {
          setBusinessAnswers((prev) => Object.values(prev).some((v) => v.trim()) ? prev : { anything_else: String(p.description) });
        }
        if (latest?.sdf) {
          setSdf(latest.sdf);
          setSdfVersion(typeof latest.sdf_version === 'number' ? latest.sdf_version : null);
          setQuestions(filterQuestions(Array.isArray(latest.sdf.clarifications_needed) ? latest.sdf.clarifications_needed : []));
        }
        const serverHistory = await projectService.getReviewHistory(projectId).catch(() => ({ history: [] }));
        if (!cancelled && serverHistory.history.length > 0) {
          setReviewHistory(serverHistory.history);
        } else if (!cancelled && latest?.sdf) {
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
  }, [projectId]);

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
    if (!projectModeStorageKey) return;
    try {
      const savedMode = window.localStorage.getItem(projectModeStorageKey);
      if (savedMode === 'chat' || savedMode === 'build') setProjectMode(savedMode);
      else setProjectMode('chat');
    } catch { setProjectMode('chat'); }
  }, [projectModeStorageKey]);

  useEffect(() => {
    if (!projectModeStorageKey) return;
    try { window.localStorage.setItem(projectModeStorageKey, projectMode); } catch { /* ignore */ }
  }, [projectMode, projectModeStorageKey]);

  useEffect(() => {
    if (!accessRequirementsStorageKey) return;
    try {
      const raw = window.localStorage.getItem(accessRequirementsStorageKey);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const normalized = parsed
        .map((item, idx) => {
          const candidate = typeof item === 'object' && item !== null ? item as Partial<AccessRequirementItem> : {};
          return {
            id: typeof candidate.id === 'string' ? candidate.id : `group-${idx + 1}`,
            groupName: typeof candidate.groupName === 'string' ? candidate.groupName : '',
            userCount: typeof candidate.userCount === 'string' ? candidate.userCount : '',
            responsibilities: typeof candidate.responsibilities === 'string' ? candidate.responsibilities : '',
            permissions: Array.isArray(candidate.permissions) ? candidate.permissions.map(String) : [],
            customPermissions: typeof candidate.customPermissions === 'string' ? candidate.customPermissions : '',
          };
        })
        .filter((item) => item.groupName || item.userCount || item.responsibilities || item.permissions.length || item.customPermissions);
      if (normalized.length > 0) setAccessRequirements(normalized);
    } catch { /* ignore */ }
  }, [accessRequirementsStorageKey]);

  useEffect(() => {
    if (!accessRequirementsStorageKey) return;
    try { window.localStorage.setItem(accessRequirementsStorageKey, JSON.stringify(accessRequirements)); } catch { /* ignore */ }
  }, [accessRequirements, accessRequirementsStorageKey]);

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

  const accessRequirementsSummary = useMemo(() => {
    const lines: string[] = [];
    accessRequirements.forEach((item, idx) => {
      const hasContent =
        item.groupName.trim() || item.userCount.trim() || item.responsibilities.trim() ||
        item.permissions.length > 0 || item.customPermissions.trim();
      if (!hasContent) return;
      lines.push(`Group ${idx + 1}: ${item.groupName.trim() || 'Unnamed group'}`);
      if (item.userCount.trim()) lines.push(`- User count: ${item.userCount.trim()}`);
      if (item.responsibilities.trim()) lines.push(`- Responsibilities: ${item.responsibilities.trim()}`);
      if (item.permissions.length > 0) lines.push(`- Required permissions: ${item.permissions.join(', ')}`);
      if (item.customPermissions.trim()) lines.push(`- Custom permissions: ${item.customPermissions.trim()}`);
    });
    return lines.join('\n');
  }, [accessRequirements]);

  const description = useMemo(() => {
    const businessText = BUSINESS_QUESTIONS
      .map((q) => {
        const answer = (businessAnswers[q.id] || '').trim();
        return answer ? `${q.question}\n${answer}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    if (!accessRequirementsSummary.trim()) return businessText;
    return `${businessText}\n\nERP Access Requirements\n${accessRequirementsSummary}`.trim();
  }, [businessAnswers, accessRequirementsSummary]);

  const businessComplete = useMemo(() =>
    BUSINESS_QUESTIONS.filter((q) => !q.optional).every((q) => (businessAnswers[q.id] || '').trim().length > 0),
    [businessAnswers]
  );

  const accessRequirementsComplete = useMemo(
    () => accessRequirements.some((item) => item.groupName.trim().length > 0),
    [accessRequirements],
  );

  const visibleDefaultQuestions = useMemo(() => defaultQuestions.filter(evaluateQuestionVisibility), [defaultQuestions, defaultAnswersById]);

  const canAnalyze = useMemo(
    () => businessComplete && accessRequirementsComplete && defaultCompletion?.is_complete === true && selectedModules.length > 0,
    [businessComplete, accessRequirementsComplete, defaultCompletion, selectedModules.length],
  );
  const canSaveDefaultAnswers = useMemo(() => selectedModules.length > 0 && defaultQuestions.length > 0, [selectedModules.length, defaultQuestions.length]);
  const canSubmitAnswers = useMemo(() => !!sdf && questions.length > 0 && questions.every((q) => (answersById[q.id] || '').trim().length > 0), [sdf, questions, answersById]);

  const currentStep = useMemo(() => {
    if (!selectedModules.length) return 0;
    if (!defaultCompletion?.is_complete) return 1;
    if (!businessComplete || !accessRequirementsComplete) return 2;
    if (sdf) return 4;
    return 3;
  }, [selectedModules, defaultCompletion, businessComplete, accessRequirementsComplete, sdf]);

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

  const prefilledModuleSummary = useMemo(
    () => prefilledSdf ? summarizeModulesForPreview((prefilledSdf as any).modules || {}, (prefilledSdf as any).entities) : [],
    [prefilledSdf]
  );

  const preview = useMemo(() => sdf ? buildPreview(sdf) : null, [sdf]);

  /* ── Handlers ───────────────────────────────────────────── */

  const updateDefaultAnswer = (questionId: string, value: string | string[]) => setDefaultAnswersById((prev) => ({ ...prev, [questionId]: value }));
  const toggleMultiChoiceAnswer = (questionId: string, option: string, enabled: boolean) => {
    setDefaultAnswersById((prev) => {
      const existing = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      return { ...prev, [questionId]: enabled ? Array.from(new Set([...existing, option])) : existing.filter((item) => item !== option) };
    });
  };
  const toggleModule = (key: string) => setSelectedModules((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]);

  const saveDefaultAnswers = async () => {
    if (!projectId || !selectedModules.length) return;
    setSavingDefaultAnswers(true); setError('');
    try {
      const payload = await projectService.saveDefaultAnswers(projectId, {
        modules: selectedModules,
        answers: defaultQuestions.map((q) => ({ question_id: q.id, answer: defaultAnswersById[q.id] ?? (q.type === 'multi_choice' ? [] : '') })),
      });
      applyDefaultQuestionState(payload);
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Failed to save answers'); }
    finally { setSavingDefaultAnswers(false); }
  };

  const requestBuildModeSwitch = () => {
    if (!canAnalyze || running) return;
    setShowBuildModeConfirm(true);
  };

  const confirmBuildModeSwitch = () => {
    setProjectMode('build');
    setShowBuildModeConfirm(false);
    if (projectId) void projectService.updateProject(projectId, { mode: 'build' });
  };

  const switchToChatMode = () => {
    setProjectMode('chat');
    setShowBuildModeConfirm(false);
    if (projectId) void projectService.updateProject(projectId, { mode: 'chat' });
  };

  const sendChatMessage = async (messageOverride?: string) => {
    const msg = (messageOverride ?? chatInput).trim();
    if (!msg || !projectId || chatLoading) return;
    setChatLoading(true);
    setChatInput('');
    const updatedHistory = [...chatHistory, { role: 'user', content: msg }];
    setChatHistory(updatedHistory);
    try {
      const res = await projectService.chatWithProject(projectId, msg, {
        conversation_history: updatedHistory,
        selected_modules: selectedModules,
        business_answers: Object.fromEntries(
          BUSINESS_QUESTIONS.map((q) => [q.id, { question: q.question, answer: (businessAnswers[q.id] || '').trim() }])
        ),
      });
      setChatHistory((prev) => [...prev, { role: 'assistant', content: res.reply }]);
      if (res.suggested_modules?.length) setChatSuggestedModules(res.suggested_modules);
      if (res.discussion_points?.length) setChatDiscussionPoints(res.discussion_points);
      if (res.confidence) setChatConfidence(res.confidence);
    } catch {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: 'Sorry, I could not process your message. Please try again.' }]);
    } finally { setChatLoading(false); }
  };

  const analyze = async () => {
    if (!projectId) return;
    setAnalyzing(true); setError(''); setAnalyzePhase('Saving your answers...');
    const phaseTimer1 = setTimeout(() => setAnalyzePhase('Routing to AI specialists...'), 3000);
    const phaseTimer2 = setTimeout(() => setAnalyzePhase('Generating module configurations...'), 10000);
    const phaseTimer3 = setTimeout(() => setAnalyzePhase('Combining results...'), 25000);
    const phaseTimer4 = setTimeout(() => setAnalyzePhase('This is taking longer than expected. Please wait...'), 45000);
    try {
      const latestDefaults = await projectService.saveDefaultAnswers(projectId, {
        modules: selectedModules,
        answers: defaultQuestions.map((q) => ({ question_id: q.id, answer: defaultAnswersById[q.id] ?? (q.type === 'multi_choice' ? [] : '') })),
      });
      applyDefaultQuestionState(latestDefaults);
      if (!(latestDefaults.prefill_validation || latestDefaults.completion)?.is_complete) { setError('Please answer all required questions before generating.'); return; }
      const acGroups = accessRequirements
        .filter((item) => item.groupName.trim())
        .map((item) => ({
          name: item.groupName.trim(),
          user_count: item.userCount.trim(),
          responsibilities: item.responsibilities.trim(),
          permissions: item.permissions,
          custom_permissions: item.customPermissions.trim(),
        }));
      const prefilledWithAccess = latestDefaults.prefilled_sdf
        ? ({
            ...latestDefaults.prefilled_sdf,
            modules: {
              ...(latestDefaults.prefilled_sdf?.modules || {}),
              access_control: { enabled: true, groups: acGroups },
            },
          } as AiGatewaySdf)
        : undefined;
      const res = await projectService.analyzeProject(projectId, description.trim(), {
        modules: selectedModules,
        default_question_answers: latestDefaults.mandatory_answers,
        prefilled_sdf: prefilledWithAccess,
        mode: projectMode,
        conversation_context: {
          business_answers: Object.fromEntries(
            BUSINESS_QUESTIONS.map((q) => [q.id, { question: q.question, answer: (businessAnswers[q.id] || '').trim() }])
          ),
          access_requirements: accessRequirements
            .filter((item) => item.groupName.trim())
            .map((item) => ({ name: item.groupName.trim(), user_count: item.userCount.trim(), responsibilities: item.responsibilities.trim(), permissions: item.permissions, custom_permissions: item.customPermissions.trim() })),
        },
      });
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({});
      setClarifyRound(res.cycle || 1); setSdfComplete(res.sdf_complete || false);
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      appendReviewHistory({
        action: 'generated',
        version: typeof res.sdf_version === 'number' ? res.sdf_version : null,
        status: res.project.status || null,
        note: 'Generated a new SDF from build mode inputs.',
      });
    } catch (err: any) {
      const msg = err?.code === 'ECONNABORTED' ? 'Generation timed out. Your inputs are saved -- try again.' : (err?.response?.data?.error || err?.message || 'Generation failed');
      setError(msg);
    } finally { setAnalyzing(false); setAnalyzePhase(''); clearTimeout(phaseTimer1); clearTimeout(phaseTimer2); clearTimeout(phaseTimer3); clearTimeout(phaseTimer4); }
  };

  const submitAnswers = async () => {
    if (!projectId || !sdf) return;
    setClarifying(true); setError('');
    try {
      const answers: ClarificationAnswer[] = questions.map((q) => ({ question_id: q.id, answer: (answersById[q.id] || '').trim() }));
      const res = await projectService.clarifyProject(projectId, sdf, answers, description.trim());
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({});
      setClarifyRound(res.cycle || clarifyRound + 1); setSdfComplete(res.sdf_complete || false);
      setSdfVersion(typeof res.sdf_version === 'number' ? res.sdf_version : null);
      appendReviewHistory({
        action: 'clarified',
        version: typeof res.sdf_version === 'number' ? res.sdf_version : null,
        status: res.project.status || null,
        note: 'Applied clarification answers to the current SDF.',
      });
    } catch (err: any) {
      const msg = err?.code === 'ECONNABORTED' ? 'Clarification timed out. Your answers are saved -- try again.' : (err?.response?.data?.error || err?.message || 'Clarify failed');
      setError(msg);
    } finally { setClarifying(false); }
  };

  const finalizeSdf = () => { setSdfComplete(true); setQuestions([]); };

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
      switchToChatMode();
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

      {/* Step Progress Bar */}
      <nav className="flex items-center gap-1">
        {STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? 'bg-indigo-600 text-white' : active ? 'border-2 border-indigo-600 text-indigo-600' : 'border-2 border-slate-300 text-slate-400'}`}>
                  {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden text-xs font-medium sm:block ${done ? 'text-indigo-600' : active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </nav>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {analyzePhase && <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 flex items-center gap-2"><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>{analyzePhase}</div>}

      {/* Step 1: Choose Modules */}
      <ModuleSelector selectedModules={selectedModules} onToggleModule={toggleModule} />

      {/* Step 2: Answer Questions */}
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

      {/* Prefilled Config Summary */}
      <SlideIn show={prefilledModuleSummary.length > 0}>
        <PrefilledConfigSummary
          moduleSummary={prefilledModuleSummary}
          showJson={showPrefilledJson}
          prefilledSdf={prefilledSdf}
          onToggleJson={() => setShowPrefilledJson((v) => !v)}
        />
      </SlideIn>

      {/* Step 3: Business Questions */}
      <SlideIn show={!!defaultCompletion?.is_complete}>
        <BusinessQuestions
          answers={businessAnswers} step={businessStep} canAnalyze={canAnalyze} running={running}
          mode={projectMode}
          onSetAnswers={setBusinessAnswers} onSetStep={setBusinessStep}
          onAnalyze={() => { void analyze(); }}
          onRequestBuildModeSwitch={requestBuildModeSwitch}
          onSwitchToChatMode={switchToChatMode}
        />
      </SlideIn>

      <SlideIn show={!!defaultCompletion?.is_complete}>
        <AccessRequirements items={accessRequirements} disabled={running} onChange={setAccessRequirements} />
      </SlideIn>

      {/* Chat Mode Panel */}
      <SlideIn show={projectMode === 'chat' && !!defaultCompletion?.is_complete}>
        <ChatPanel
          chatHistory={chatHistory}
          chatInput={chatInput}
          chatLoading={chatLoading}
          suggestedModules={chatSuggestedModules}
          discussionPoints={chatDiscussionPoints}
          confidence={chatConfidence}
          onInputChange={setChatInput}
          onSendMessage={sendChatMessage}
        />
      </SlideIn>

      {/* Post-generation (Steps 4 & 5) */}
      <SlideIn show={!!sdf} className="space-y-8">
        {sdf && (
          <PostGenerationPanel
            sdf={sdf} preview={preview}
            questions={questions} answersById={answersById} canSubmitAnswers={canSubmitAnswers}
            clarifying={clarifying} clarifyRound={clarifyRound} sdfComplete={sdfComplete}
            onSetAnswers={setAnswersById} onSubmitAnswers={submitAnswers} onFinalize={finalizeSdf}
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

      <BuildModeConfirmDialog
        open={showBuildModeConfirm}
        canAnalyze={canAnalyze}
        running={running}
        onClose={() => setShowBuildModeConfirm(false)}
        onConfirm={confirmBuildModeSwitch}
      />
    </div>
  );
}
