import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectService } from '../services/projectService';
import type { Project } from '../types/project';
import type { AiGatewaySdf, ClarificationAnswer, ClarificationQuestion } from '../types/aiGateway';
import type {
  DefaultModuleQuestion,
  DefaultQuestionCompletion,
  DefaultQuestionStateResponse,
} from '../types/defaultQuestions';

import {
  MODULE_META, MODULE_KEYS, STEPS, BUSINESS_QUESTIONS,
  MOD_STYLES, SlideIn, MODULE_ICONS,
  detectUserPlatform, summarizeModulesForPreview,
} from '../components/project/projectConstants';

function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
import DefaultQuestions from '../components/project/DefaultQuestions';
import BusinessQuestions from '../components/project/BusinessQuestions';
import ClarificationQuestionsPanel from '../components/project/ClarificationQuestions';
import SdfPreviewSection from '../components/project/SdfPreviewSection';

type ProjectMode = 'chat' | 'build';

/* ------------------------------------------------------------------ */
/*  SDF preview builder                                                */
/* ------------------------------------------------------------------ */

function buildPreview(sdf: AiGatewaySdf) {
  const formatLabel = (name: string) =>
    String(name || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const entities = Array.isArray((sdf as any).entities) ? (sdf as any).entities : [];
  const modules = (sdf as any).modules && typeof (sdf as any).modules === 'object' ? (sdf as any).modules : {};
  const warningsRaw = (sdf as any).warnings;
  const warnings = Array.isArray(warningsRaw) ? warningsRaw.map(String).map((s) => s.trim()).filter(Boolean) : [];

  const entityBySlug: Record<string, any> = Object.fromEntries(
    entities.map((e: any) => [String(e?.slug || ''), e] as const).filter(([slug]: readonly [string, any]) => Boolean(slug))
  );

  const resolveRefSlug = (field: any) => {
    const explicit = field?.reference_entity || field?.referenceEntity;
    if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
    const name = String(field?.name || '');
    const base = name.replace(/_ids?$/, '');
    if (!base) return null;
    const slugCandidates = [base, base + 's', base + 'es', base.endsWith('y') ? base.slice(0, -1) + 'ies' : null].filter(Boolean) as string[];
    for (const c of slugCandidates) { if (entityBySlug[c]) return c; }
    return Object.keys(entityBySlug).find((s) => s.startsWith(base)) || null;
  };

  const guessDisplayField = (entity: any) => {
    const df = entity?.display_field || entity?.displayField;
    if (df) return String(df);
    const fields = Array.isArray(entity?.fields) ? entity.fields : [];
    if (fields.some((f: any) => f?.name === 'name')) return 'name';
    if (fields.some((f: any) => f?.name === 'sku')) return 'sku';
    const first = fields.find((f: any) => f?.name && !['id', 'created_at', 'updated_at'].includes(String(f.name)));
    return first ? String(first.name) : 'id';
  };

  const summarizeEntity = (entity: any) => {
    const slug = String(entity?.slug || '');
    const name = entity?.display_name ? String(entity.display_name) : formatLabel(slug);
    const mod = String(entity?.module || 'shared');
    const fields = Array.isArray(entity?.fields) ? entity.fields : [];
    const ui = entity?.ui || {};
    const csvImportEnabled = ui.csv_import !== false;
    const csvExportEnabled = ui.csv_export !== false;
    const printEnabled = ui.print !== false;

    const configuredCols = Array.isArray(entity?.list?.columns) ? entity.list.columns : null;
    const defaultCols = fields.filter((f: any) => f?.name && f.name !== 'id').slice(0, 5).map((f: any) => String(f.name));
    const columns: string[] = (configuredCols && configuredCols.length ? configuredCols : defaultCols).map(String).filter((c: string) => c && c !== 'id');
    const fieldByName: Record<string, any> = Object.fromEntries(fields.map((f: any) => [String(f?.name || ''), f]));
    const columnLabels = columns.map((c: string) => { const f = fieldByName[c]; return f?.label ? String(f.label) : formatLabel(c); });

    const requiredFields = fields.filter((f: any) => f?.required === true).map((f: any) => (f?.label ? String(f.label) : formatLabel(String(f?.name || '')))).filter(Boolean);
    const uniqueFields = fields.filter((f: any) => f?.unique === true).map((f: any) => (f?.label ? String(f.label) : formatLabel(String(f?.name || '')))).filter(Boolean);
    const choiceFields = fields.map((f: any) => {
      const raw = f?.options ?? f?.enum;
      const options = Array.isArray(raw) ? raw.map(String).map((s) => s.trim()).filter(Boolean) : [];
      if (!options.length) return null;
      return { label: f?.label ? String(f.label) : formatLabel(String(f?.name || '')), options };
    }).filter(Boolean) as { label: string; options: string[] }[];

    const relationFields = fields.map((f: any) => {
      const type = String(f?.type || ''); const fname = String(f?.name || '');
      const isRefish = type === 'reference' || fname.endsWith('_id') || fname.endsWith('_ids') || !!(f?.reference_entity || f?.referenceEntity);
      if (!isRefish) return null;
      const targetSlug = resolveRefSlug(f);
      if (!targetSlug) return null;
      const target = entityBySlug[targetSlug];
      const targetName = target?.display_name ? String(target.display_name) : formatLabel(targetSlug);
      return { label: f?.label ? String(f.label) : formatLabel(fname), targetSlug, targetName, multiple: f?.multiple === true || fname.endsWith('_ids') };
    }).filter(Boolean) as { label: string; targetSlug: string; targetName: string; multiple: boolean }[];

    const inv = entity?.inventory_ops || entity?.inventoryOps || {};
    const invEnabled = inv?.enabled === true;
    const receiveEnabled = invEnabled && inv?.receive?.enabled !== false;
    const adjustEnabled = invEnabled && inv?.adjust?.enabled !== false;
    const issueCfg = inv?.issue || inv?.sell || inv?.issue_stock || inv?.issueStock || {};
    const sellEnabled = invEnabled && issueCfg?.enabled === true;
    const sellLabel = issueCfg?.label || issueCfg?.display_name || issueCfg?.displayName || issueCfg?.name || 'Sell';
    const features = entity?.features || {};
    const transferEnabled = invEnabled && (inv?.transfer?.enabled === true || (inv?.transfer?.enabled !== false && (features?.multi_location === true || fields.some((f: any) => f && String(f.name || '').includes('location')))));
    const labelsEnabled = (entity?.labels?.enabled === true && entity?.labels?.type === 'qrcode');
    const quickCfg = inv?.quick_actions || inv?.quickActions || {};
    const quickAll = quickCfg === true;
    const quickReceive = receiveEnabled && (quickAll || quickCfg?.receive === true || quickCfg?.add === true || quickCfg?.in === true);
    const quickSell = sellEnabled && (quickAll || quickCfg?.issue === true || quickCfg?.sell === true || quickCfg?.out === true);
    const bulk = entity?.bulk_actions || entity?.bulkActions || {};
    const bulkEnabled = bulk?.enabled === true;

    const screens: string[] = ['List page', 'Create / Edit form'];
    if (csvImportEnabled) screens.push('CSV import page');
    if (csvExportEnabled) screens.push('CSV export (download)');
    if (printEnabled) screens.push('Print / PDF');
    if (receiveEnabled) screens.push('Receive stock');
    if (sellEnabled) screens.push(sellLabel);
    if (adjustEnabled) screens.push('Adjust stock (corrections)');
    if (transferEnabled) screens.push('Transfer stock');
    if (labelsEnabled) screens.push('QR Labels');

    return {
      slug, name, mod, displayField: guessDisplayField(entity), csvImportEnabled, csvExportEnabled, printEnabled,
      columns: columnLabels, requiredFields, uniqueFields, choiceFields, relationFields, screens,
      inv: { enabled: invEnabled, receiveEnabled, sellEnabled, sellLabel, adjustEnabled, transferEnabled, quickReceive, quickSell },
      bulk: { enabled: bulkEnabled, delete: bulkEnabled && bulk?.delete !== false, update: bulkEnabled && Array.isArray(bulk?.update_fields) && bulk.update_fields.length > 0 },
      labelsEnabled,
    };
  };

  const enabledModules: { title: string; description: string }[] = [];
  const activity = (modules as any).activity_log || (modules as any).activityLog || {};
  if (activity?.enabled === true) enabledModules.push({ title: 'Activity log', description: 'A feed of recent changes.' });
  const invDash = (modules as any).inventory_dashboard || (modules as any).inventoryDashboard || {};
  if (invDash?.low_stock?.enabled) enabledModules.push({ title: 'Low stock alerts', description: 'Dashboard shows items running low.' });
  if (invDash?.expiry?.enabled) enabledModules.push({ title: 'Expiry alerts', description: 'Dashboard shows items expiring soon.' });
  const sched = (modules as any).scheduled_reports || (modules as any).scheduledReports || {};
  if (sched?.enabled === true) enabledModules.push({ title: 'Reports', description: 'Reports screen with inventory metrics.' });

  const entitySummaries = entities.map(summarizeEntity).filter((e: any) => e && e.slug);
  const projectName = String((sdf as any).project_name || '');
  const screensTotal = 1 + (enabledModules.some((m) => m.title === 'Activity log') ? 1 : 0) + (enabledModules.some((m) => m.title === 'Reports') ? 1 : 0) + entitySummaries.reduce((acc: number, e: any) => acc + e.screens.length, 0);
  const moduleSummaries = summarizeModulesForPreview(modules, entities);

  return { projectName, entityCount: entitySummaries.length, screensTotal, enabledModules, warnings, entities: entitySummaries, moduleSummaries };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ProjectDetailPage() {
  const params = useParams();
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

  const detectedPlatform = useMemo(() => detectUserPlatform(), []);
  const running = analyzing || clarifying || saving;
  const projectModeStorageKey = useMemo(
    () => (projectId ? `project_mode:${projectId}` : ''),
    [projectId]
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
        if (p.description) {
          setBusinessAnswers((prev) => Object.values(prev).some((v) => v.trim()) ? prev : { anything_else: String(p.description) });
        }
        if (latest?.sdf) {
          setSdf(latest.sdf);
          setQuestions(filterQuestions(Array.isArray(latest.sdf.clarifications_needed) ? latest.sdf.clarifications_needed : []));
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
    } catch {
      setProjectMode('chat');
    }
  }, [projectModeStorageKey]);

  useEffect(() => {
    if (!projectModeStorageKey) return;
    try {
      window.localStorage.setItem(projectModeStorageKey, projectMode);
    } catch {
      // Ignore localStorage failures (private mode, quota, etc.)
    }
  }, [projectMode, projectModeStorageKey]);

  /* ── Derived state ──────────────────────────────────────── */

  const description = useMemo(() =>
    BUSINESS_QUESTIONS.map((q) => { const a = (businessAnswers[q.id] || '').trim(); return a ? `${q.question}\n${a}` : ''; }).filter(Boolean).join('\n\n'),
    [businessAnswers]
  );

  const businessComplete = useMemo(() =>
    BUSINESS_QUESTIONS.filter((q) => !q.optional).every((q) => (businessAnswers[q.id] || '').trim().length > 0),
    [businessAnswers]
  );

  const visibleDefaultQuestions = useMemo(() => defaultQuestions.filter(evaluateQuestionVisibility), [defaultQuestions, defaultAnswersById]);

  const canAnalyze = useMemo(() => businessComplete && defaultCompletion?.is_complete === true && selectedModules.length > 0, [businessComplete, defaultCompletion, selectedModules.length]);
  const canSaveDefaultAnswers = useMemo(() => selectedModules.length > 0 && defaultQuestions.length > 0, [selectedModules.length, defaultQuestions.length]);
  const canSubmitAnswers = useMemo(() => !!sdf && questions.length > 0 && questions.every((q) => (answersById[q.id] || '').trim().length > 0), [sdf, questions, answersById]);

  const currentStep = useMemo(() => {
    if (!selectedModules.length) return 0;
    if (!defaultCompletion?.is_complete) return 1;
    if (!businessComplete) return 2;
    if (sdf) return 4;
    return 3;
  }, [selectedModules, defaultCompletion, businessComplete, sdf]);

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
  };

  const switchToChatMode = () => {
    setProjectMode('chat');
    setShowBuildModeConfirm(false);
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
      const res = await projectService.analyzeProject(projectId, description.trim(), {
        modules: selectedModules, default_question_answers: latestDefaults.mandatory_answers, prefilled_sdf: latestDefaults.prefilled_sdf || undefined,
      });
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({});
      setClarifyRound(res.cycle || 1); setSdfComplete(res.sdf_complete || false);
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
    } catch (err: any) {
      const msg = err?.code === 'ECONNABORTED' ? 'Clarification timed out. Your answers are saved -- try again.' : (err?.response?.data?.error || err?.message || 'Clarify failed');
      setError(msg);
    } finally { setClarifying(false); }
  };

  const finalizeSdf = () => {
    setSdfComplete(true);
    setQuestions([]);
  };

  const saveDraft = async () => {
    if (!projectId || !draftJson) return;
    setSaving(true); setError(''); setDraftError('');
    try {
      let parsed: any;
      try { parsed = JSON.parse(draftJson); } catch (e: any) { setDraftError('Invalid JSON: ' + (e?.message || 'Parse error')); return; }
      const res = await projectService.saveSdf(projectId, parsed);
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({}); setDraftJson(JSON.stringify(res.sdf, null, 2));
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const applyAiEdit = async () => {
    if (!projectId || !aiEditText.trim()) return;
    setSaving(true); setError('');
    try {
      const res = await projectService.aiEditSdf(projectId, aiEditText.trim(), sdf || undefined);
      setProject(res.project); setSdf(res.sdf); setQuestions(filterQuestions(res.questions || [])); setAnswersById({}); setAiEditText('');
    } catch (err: any) { setError(err?.response?.data?.error || err?.message || 'AI edit failed'); }
    finally { setSaving(false); }
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
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Set up your ERP step by step</p>
        </div>
        <Link to="/" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">Back to Projects</Link>
      </div>

      {/* ── Step Progress Bar ──────────────────────────────── */}
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

      {/* ── Step 1: Choose Modules ─────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">1. Choose Modules</h2>
          <p className="mt-0.5 text-sm text-slate-500">Select which parts of the ERP you need. You can always change this later.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODULE_KEYS.map((key) => {
            const meta = MODULE_META[key]; const styles = MOD_STYLES[key]; const selected = selectedModules.includes(key);
            const Ico = MODULE_ICONS[key];
            return (
              <button key={key} type="button" onClick={() => toggleModule(key)}
                className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all ${selected ? styles.sel : styles.unsel}`}>
                {selected && <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"><IconCheck className="h-3 w-3" /></div>}
                <div className={styles.icon}><Ico /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{meta.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Step 2: Answer Questions ───────────────────────── */}
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

      {/* ── Prefilled Config Summary ───────────────────────── */}
      <SlideIn show={prefilledModuleSummary.length > 0}>
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Your ERP Configuration</h3>
              <p className="mt-0.5 text-xs text-slate-500">Auto-generated from your answers above. This is sent as a starting point for AI.</p>
            </div>
            <button type="button" onClick={() => setShowPrefilledJson((v) => !v)} className="text-xs text-slate-500 underline hover:text-slate-700">
              {showPrefilledJson ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {prefilledModuleSummary.map((ms) => {
              const styles = MOD_STYLES[ms.key] || MOD_STYLES.shared;
              return (
                <div key={ms.key} className={`rounded-xl border bg-white p-4 ${styles.left}`}>
                  <div className="text-sm font-semibold text-slate-900">{ms.label}</div>
                  {Object.entries(ms.config).length > 0 && (
                    <div className="mt-2 space-y-1">{Object.entries(ms.config).map(([k, v]) => <div key={k} className="text-xs text-slate-600"><span className="font-medium">{k}:</span> {v}</div>)}</div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ms.caps.map((c) => <span key={c.label} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{c.label}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
          {showPrefilledJson && <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(prefilledSdf, null, 2)}</pre>}
        </section>
      </SlideIn>

      {/* ── Step 3: Business Questions ─────────────────────── */}
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

      {/* ── Post-generation (Steps 4 & 5) ──────────────────── */}
      <SlideIn show={!!sdf} className="space-y-8">
        {(questions.length > 0 || sdfComplete) && (
          <ClarificationQuestionsPanel
            questions={questions} answersById={answersById} canSubmit={canSubmitAnswers}
            running={clarifying} clarifyRound={clarifyRound} sdfComplete={sdfComplete}
            onSetAnswers={setAnswersById} onSubmit={submitAnswers} onFinalize={finalizeSdf}
          />
        )}

        {!questions.length && !sdfComplete && (
          <div className="rounded-xl border bg-emerald-50 px-5 py-4">
            <div className="text-sm font-semibold text-emerald-800">No follow-up questions needed</div>
            <div className="mt-0.5 text-xs text-emerald-600">The AI generated a complete ERP setup from your inputs.</div>
          </div>
        )}

        {preview && sdf && (
          <SdfPreviewSection
            sdf={sdf} preview={preview} detectedPlatform={detectedPlatform}
            running={running} standaloneRunning={standaloneRunning} downloadStarted={downloadStarted}
            draftJson={draftJson} draftError={draftError} aiEditText={aiEditText}
            onSaveDraft={saveDraft} onDownloadStandalone={downloadStandalone} onDownloadZip={downloadZip}
            onApplyAiEdit={applyAiEdit} onSetAiEditText={setAiEditText} onSetDraftJson={setDraftJson}
            onResetDraftJson={() => setDraftJson(JSON.stringify(sdf, null, 2))}
          />
        )}
      </SlideIn>

      {showBuildModeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Switch to Build Mode?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Build mode locks in your current answers for SDF generation. You can still switch back to
              chat mode if you want to revise business details before generating.
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <div className="font-medium text-slate-900">Before switching:</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Review the module answers and business questions.</li>
                <li>Confirm your final intent for generation.</li>
                <li>Use Build Mode to enable “Generate My ERP Setup”.</li>
              </ul>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBuildModeConfirm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Stay in Chat Mode
              </button>
              <button
                type="button"
                onClick={confirmBuildModeSwitch}
                disabled={!canAnalyze || running}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm & Switch to Build
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
