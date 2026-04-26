import { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectService } from '../services/projectService';
import { detectUserPlatform, usePlatformInfo } from '../components/project/projectConstants';
import GenerationModal from '../components/project/GenerationModal';
import ReviewFeedbackModal from '../components/project/ReviewFeedbackModal';
import PreviewBuildModal, { type PreviewModalState, type PreviewPhase } from '../components/project/PreviewBuildModal';
import { usePreviewHeartbeat } from '../hooks/usePreviewHeartbeat';
import { useChatContext } from '../context/ChatContext';
import { normalizeLanguage } from '../i18n';
import type { Project } from '../types/project';
import type { AnswerReview, ClarificationQuestion, ClarificationAnswer } from '../types/aiGateway';
import { enterFullscreen, exitFullscreen, getFullscreenElement } from '../utils/fullscreen';

type PreviewStatus = 'idle' | 'queued' | 'building' | 'running' | 'error' | 'stopping';

const SIDEBAR_KEY = 'sidebar_collapsed';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000/api';

/** When `VITE_API_URL` is absolute (common in Docker), point the iframe at the API origin so `/preview` is not loaded through the Vite dev server (whose default proxy target is wrong inside a container). */
function buildPreviewIframeUrl(previewId: string, token: string): string {
  const path = `/preview/${previewId}/?token=${encodeURIComponent(token)}`;
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (!apiUrl || apiUrl.startsWith('/')) return path;
  try {
    return new URL(path, apiUrl).toString();
  } catch {
    return path;
  }
}

// Map backend error codes → i18n keys. Unknown codes fall back to regex/msg.
const CODE_TO_KEY: Record<string, string> = {
  QUEUE_FULL: 'errors.queueFull',
  CAPACITY: 'errors.capacity',
  NO_SDF: 'errors.noSdf',
  ASSEMBLE_FAILED: 'errors.assembleFailed',
  NPM_INSTALL_FAILED: 'errors.npmInstallFailed',
  FRONTEND_BUILD_FAILED: 'errors.frontendBuildFailed',
  PORT_TIMEOUT: 'errors.portTimeout',
  CRASHED: 'errors.crashed',
  STALE: 'errors.stale',
  NOT_FOUND: 'errors.notFound',
  UNAUTHORIZED: 'errors.unauthorized',
  SPAWN_FAILED: 'errors.spawnFailed',
  BUILD_FAILED: 'errors.generic',
};

export default function PreviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setProjectContext } = useChatContext();
  const { t, i18n } = useTranslation(['previewPage', 'projectDetail', 'projects']);
  const PLATFORM_INFO = usePlatformInfo();

  const mapGenerationError = useCallback((err: any): { code?: string; message: string } => {
    const code = err?.response?.data?.code as string | undefined;
    const raw = err?.response?.data?.error || err?.message || '';

    if (code && CODE_TO_KEY[code]) {
      return { code, message: t(CODE_TO_KEY[code]) };
    }
    if (err?.code === 'ECONNABORTED' || /timeout/i.test(raw)) return { code, message: t('errors.tooLong') };
    if (/network|ECONNREFUSED/i.test(raw)) return { code, message: t('errors.unreachable') };
    if (/quota|rate.limit/i.test(raw)) return { code, message: t('errors.highDemand') };
    if (/schema|validation/i.test(raw)) return { code, message: t('errors.unexpectedFormat') };
    return { code, message: raw || t('errors.generic') };
  }, [t]);

  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [phase, setPhase] = useState<PreviewPhase>('queued');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [iframeToken, setIframeToken] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState(0);
  const [buildStartedAt, setBuildStartedAt] = useState<number>(() => Date.now());
  const [errorState, setErrorState] = useState<{ code?: string; message: string } | null>(null);
  const [changeReview, setChangeReview] = useState<AnswerReview | null>(null);
  const [pendingChangeText, setPendingChangeText] = useState('');

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadPlatform, setDownloadPlatform] = useState('');
  const [downloadPhase, setDownloadPhase] = useState<'pick' | 'building' | 'done' | 'error'>('pick');
  const [downloadError, setDownloadError] = useState('');
  const [downloadSetupParams, setDownloadSetupParams] = useState<{ file: string; platform: string; project: string } | null>(null);

  // Change request state
  const [changeText, setChangeText] = useState('');
  // Mobile bottom sheet toggle for the change panel (collapsed by default on <md)
  const [changePanelOpen, setChangePanelOpen] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [genPhase, setGenPhase] = useState('');
  const [genResult, setGenResult] = useState<'success' | 'error' | null>(null);
  const [genErrorMsg, setGenErrorMsg] = useState('');
  const [genProgress, setGenProgress] = useState<{ step: string; pct: number; detail: string } | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [currentSdf, setCurrentSdf] = useState<any>(null);

  const canSubmitAnswers = useMemo(
    () => questions.length > 0 && questions.every((q) => (answersById[q.id] || '').trim().length > 0),
    [questions, answersById],
  );

  const detectedPlatform = useMemo(() => detectUserPlatform(), []);

  const languageBlocked = useMemo(
    () =>
      !!project &&
      normalizeLanguage(i18n.language) !== normalizeLanguage(project.language || 'en'),
    [project, i18n.language],
  );

  const lockedLangLabel = project
    ? t(`projects:card.languages.${normalizeLanguage(project.language || 'en')}`)
    : '';
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const changePanelTitleId = useId();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const syncPreviewFullscreen = useCallback(() => {
    setIsPreviewFullscreen(getFullscreenElement() === previewStageRef.current);
  }, []);

  useEffect(() => {
    const onFs = () => { syncPreviewFullscreen(); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('mozfullscreenchange', onFs);
    document.addEventListener('MSFullscreenChange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      document.removeEventListener('mozfullscreenchange', onFs);
      document.removeEventListener('MSFullscreenChange', onFs);
    };
  }, [syncPreviewFullscreen]);

  const togglePreviewFullscreen = useCallback(async () => {
    const el = previewStageRef.current;
    if (!el) return;
    const fsEl = getFullscreenElement();
    try {
      if (fsEl === el) await exitFullscreen();
      else await enterFullscreen(el);
    } catch {
      /* unsupported or blocked */
    }
  }, []);

  useEffect(() => {
    return () => {
      const el = previewStageRef.current;
      if (el && getFullscreenElement() === el) void exitFullscreen();
    };
  }, []);

  useEffect(() => {
    if (!changePanelOpen) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [changePanelOpen]);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Auto-collapse sidebar on mount, restore on unmount
  useEffect(() => {
    const wasPreviouslyCollapsed = localStorage.getItem(SIDEBAR_KEY) === '1';
    localStorage.setItem(SIDEBAR_KEY, '1');
    window.dispatchEvent(new CustomEvent('sidebar-collapse'));
    return () => {
      if (!wasPreviouslyCollapsed) {
        localStorage.setItem(SIDEBAR_KEY, '0');
        window.dispatchEvent(new CustomEvent('sidebar-expand'));
      }
    };
  }, []);

  useEffect(() => {
    if (!projectId) return;
    projectService.getProject(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (!project || !projectId) { setProjectContext(null); return; }
    setProjectContext({
      projectId,
      projectName: project.name,
      description: project.description || '',
      selectedModules: [],
      businessAnswers: {},
      currentStep: 'Preview',
      sdfStatus: project.status === 'Approved' ? 'approved' : 'generated',
    });
    return () => setProjectContext(null);
  }, [projectId, project, setProjectContext]);

  // --- Unified status polling ---------------------------------------------
  const applyStatusResponse = useCallback((res: Awaited<ReturnType<typeof projectService.getPreviewStatus>>) => {
    if (!mountedRef.current) return 'stop';

    if (res.status === 'running' && res.previewId) {
      setPreviewId(res.previewId);
      setIframeToken(res.iframeToken || null);
      setStatus('running');
      setPhase('running');
      setQueuePosition(0);
      setErrorState(null);
      return 'stop';
    }
    if (res.status === 'queued') {
      setStatus('queued');
      setPhase(((res.phase as PreviewPhase) || 'queued'));
      setQueuePosition(res.queuePosition || 0);
      if (res.previewId) setPreviewId(res.previewId);
      return 'poll';
    }
    if (res.status === 'building') {
      setStatus('building');
      setPhase((res.phase as PreviewPhase) || 'assembling');
      setQueuePosition(0);
      if (res.previewId) setPreviewId(res.previewId);
      return 'poll';
    }
    if (res.status === 'error') {
      const code = res.errorCode || 'BUILD_FAILED';
      const key = CODE_TO_KEY[code] || 'errors.generic';
      setStatus('error');
      setErrorState({ code, message: t(key) });
      if (res.previewId) setPreviewId(res.previewId);
      return 'stop';
    }
    return 'none';
  }, [t]);

  const pollUntilReady = useCallback(() => {
    clearPoll();
    const poll = async () => {
      if (!mountedRef.current || !projectId) return;
      try {
        const res = await projectService.getPreviewStatus(projectId);
        const outcome = applyStatusResponse(res);
        if (outcome === 'poll') {
          pollTimerRef.current = setTimeout(poll, 3000);
        }
      } catch {
        if (mountedRef.current) {
          setStatus('error');
          setErrorState({ code: 'BUILD_FAILED', message: t('errors.previewBuildFailed') });
        }
      }
    };
    pollTimerRef.current = setTimeout(poll, 1500);
  }, [projectId, applyStatusResponse, clearPoll, t]);

  const startPreviewFlow = useCallback(async () => {
    if (!projectId || languageBlocked) return;
    clearPoll();
    setStatus('queued');
    setPhase('queued');
    setErrorState(null);
    setPreviewId(null);
    setIframeToken(null);
    setQueuePosition(0);
    setBuildStartedAt(Date.now());

    try {
      const result = await projectService.startPreview(projectId);
      if (!mountedRef.current) return;
      setPreviewId(result.previewId);

      if (result.status === 'running') {
        // Fetch full status to get the iframe token.
        pollUntilReady();
      } else {
        setStatus(result.status === 'building' ? 'building' : 'queued');
        setPhase(result.status === 'building' ? 'assembling' : 'queued');
        pollUntilReady();
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const mapped = mapGenerationError(err);
      setStatus('error');
      setErrorState(mapped);
    }
  }, [projectId, clearPoll, pollUntilReady, mapGenerationError, languageBlocked]);

  // Initial load: pick up existing preview or start a fresh one (after project is known)
  useEffect(() => {
    if (!projectId || !project || languageBlocked) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await projectService.getPreviewStatus(projectId);
        if (cancelled) return;
        const outcome = applyStatusResponse(existing);
        if (outcome === 'poll') {
          setBuildStartedAt(Date.now());
          pollUntilReady();
          return;
        }
        if (outcome === 'stop') return;
      } catch { /* fallthrough */ }
      if (!cancelled) startPreviewFlow();
    })();

    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [projectId, project, languageBlocked, startPreviewFlow, applyStatusResponse, clearPoll, pollUntilReady]);

  // --- Heartbeat + cleanup ------------------------------------------------
  const heartbeatActive = status === 'queued' || status === 'building' || status === 'running';
  usePreviewHeartbeat(projectId, heartbeatActive);

  // Track latest state via ref so the unmount cleanup can decide whether to stop.
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  const sendKeepaliveStop = useCallback(() => {
    if (!projectId) return;
    const s = statusRef.current;
    if (s === 'idle' || s === 'error' || s === 'stopping') return;
    const token = localStorage.getItem('token');
    try {
      // `keepalive` lets the request survive navigation/unload
      fetch(`${API_BASE}/projects/${projectId}/preview/stop`, {
        method: 'DELETE',
        keepalive: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [projectId]);

  // Browser close/refresh: warn during build, always fire keepalive stop.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const s = statusRef.current;
      sendKeepaliveStop();
      if (s === 'queued' || s === 'building') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sendKeepaliveStop]);

  // React unmount (in-app navigation away): stop the preview.
  useEffect(() => {
    return () => {
      sendKeepaliveStop();
    };
  }, [sendKeepaliveStop]);

  // Load current SDF for change requests
  useEffect(() => {
    if (!projectId) return;
    projectService.getLatestSdf(projectId).then((res) => {
      if (res.sdf) setCurrentSdf(res.sdf);
    }).catch(() => {});
  }, [projectId]);

  const cancelBuild = useCallback(async () => {
    if (!projectId) return;
    clearPoll();
    setStatus('stopping');
    try { await projectService.stopPreview(projectId); } catch { /* ignore */ }
    navigate(`/projects/${projectId}`);
  }, [projectId, clearPoll, navigate]);

  const retryBuild = useCallback(async () => {
    if (!projectId) return;
    // Drop any retained error record server-side before retrying.
    try { await projectService.stopPreview(projectId); } catch { /* ignore */ }
    startPreviewFlow();
  }, [projectId, startPreviewFlow]);

  const openDownloadModal = () => {
    setDownloadPlatform(detectedPlatform);
    setDownloadPhase('pick');
    setDownloadError('');
    setDownloadSetupParams(null);
    setShowDownloadModal(true);
  };

  useEffect(() => {
    if (downloadPhase !== 'done' || !downloadSetupParams) return;
    const params = new URLSearchParams(downloadSetupParams);
    const redirectTimer = setTimeout(() => {
      navigate(`/setup?${params.toString()}`);
    }, 2500);
    return () => clearTimeout(redirectTimer);
  }, [downloadPhase, downloadSetupParams, navigate]);

  const startApproveAndDownload = async () => {
    if (!projectId || !downloadPlatform) return;
    setDownloadPhase('building');
    setDownloadError('');
    try {
      await projectService.approveReview(projectId);
      const blob = await projectService.generateStandaloneErpZip(projectId, downloadPlatform);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = `${project?.name || 'custom-erp'}-${downloadPlatform}.zip`;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSetupParams({
        file: fileName,
        platform: downloadPlatform,
        project: project?.name || 'CustomERP',
      });
      setDownloadPhase('done');
      try { await projectService.stopPreview(projectId); } catch { /* cleanup */ }
    } catch (err: any) {
      const raw = err?.response?.data instanceof Blob
        ? await err.response.data.text().then((text: string) => { try { return JSON.parse(text).error; } catch { return text; } }).catch(() => '')
        : (err?.response?.data?.error || err?.message || '');
      setDownloadError(raw || t('errors.downloadFailed'));
      setDownloadPhase('error');
    }
  };

  const handleRequestChanges = async (acknowledgedUnsupportedFeatures?: string[]) => {
    const instructions = (pendingChangeText || changeText).trim();
    if (!projectId || !instructions) return;
    setChangePanelOpen(false);
    setGenPhase(t('phase.applying')); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
    setQuestions([]); setAnswersById({});

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
      pollProgress();
      const res = await projectService.regenerateProject(projectId, instructions, acknowledgedUnsupportedFeatures);
      progressCancelled = true;
      if (res.status === 'change_review_required' && res.answer_review) {
        setChangeReview(res.answer_review);
        setPendingChangeText(instructions);
        setProject(res.project);
        setGenPhase('');
        setGenProgress(null);
        return;
      }
      setChangeReview(null);
      setPendingChangeText('');
      setProject(res.project);
      const resQuestions = (res.questions || []).filter((q: any) => q?.id && q?.question) as ClarificationQuestion[];

      if (resQuestions.length > 0 && !res.sdf_complete) {
        setCurrentSdf(res.sdf); setQuestions(resQuestions); setAnswersById({});
        setGenProgress({ step: 'clarifications', pct: 20, detail: t('phase.waitingAnswers') });
        return;
      }

      setCurrentSdf(res.sdf);
      setGenProgress({ step: 'done', pct: 100, detail: t('phase.complete') });
      setGenResult('success');
      setChangeText('');
      setTimeout(async () => {
        setGenPhase(''); setGenResult(null); setGenProgress(null);
        try { await projectService.stopPreview(projectId); } catch { /* ignore */ }
        startPreviewFlow();
      }, 2000);
    } catch (err: any) {
      progressCancelled = true;
      setGenResult('error');
      setGenErrorMsg(mapGenerationError(err).message);
    }
  };

  const submitModalAnswers = async () => {
    if (!projectId || !currentSdf || questions.length === 0) return;
    setSubmittingAnswers(true);
    setGenProgress({ step: 'generators', pct: 30, detail: t('phase.processingAnswers') });

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
      const res = await projectService.clarifyProject(projectId, currentSdf, answers, project?.description || '');
      progressCancelled = true;
      setProject(res.project);
      const resQuestions = (res.questions || []).filter((q: any) => q?.id && q?.question) as ClarificationQuestion[];

      if (resQuestions.length > 0 && !res.sdf_complete) {
        setCurrentSdf(res.sdf); setQuestions(resQuestions); setAnswersById({});
        setGenProgress({ step: 'clarifications', pct: 20, detail: t('phase.waitingAnswers') });
        return;
      }

      setCurrentSdf(res.sdf);
      setGenProgress({ step: 'done', pct: 100, detail: t('phase.complete') });
      setGenResult('success');
      setChangeText('');
      setTimeout(async () => {
        setGenPhase(''); setGenResult(null); setGenProgress(null);
        try { await projectService.stopPreview(projectId); } catch { /* ignore */ }
        startPreviewFlow();
      }, 2000);
    } catch (err: any) {
      progressCancelled = true;
      setGenResult('error');
      setGenErrorMsg(mapGenerationError(err).message);
    } finally { progressCancelled = true; setSubmittingAnswers(false); }
  };

  const closeGenModal = () => {
    setGenPhase(''); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
    setQuestions([]); setAnswersById({});
  };

  const iframeSrc = previewId && iframeToken ? buildPreviewIframeUrl(previewId, iframeToken) : undefined;

  useEffect(() => {
    if (!projectId || status !== 'running' || !previewId || iframeToken) return;
    const h = window.setTimeout(() => {
      projectService.getPreviewStatus(projectId).then(applyStatusResponse).catch(() => {});
    }, 500);
    return () => window.clearTimeout(h);
  }, [projectId, status, previewId, iframeToken, applyStatusResponse]);

  // Drive the blocking modal off backend-authoritative state.
  const modalState: PreviewModalState | null = (() => {
    if (status === 'error' && errorState) {
      return { kind: 'error', code: errorState.code || 'BUILD_FAILED', message: errorState.message, phase };
    }
    if (status === 'queued') {
      return { kind: 'queued', queuePosition, phase, startedAt: buildStartedAt };
    }
    if (status === 'building' || status === 'stopping') {
      return { kind: 'building', phase, startedAt: buildStartedAt };
    }
    return null;
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-app-surface-muted">
      {languageBlocked && (
        <div
          role="alert"
          className="flex-shrink-0 border-b border-app-warning-border bg-app-warning-soft px-4 py-3 text-sm text-app-warning"
        >
          <p className="font-semibold">{t('projectDetail:languageGate.title')}</p>
          <p className="mt-1 opacity-90">
            {t('projectDetail:languageGate.body', { language: lockedLangLabel })}
          </p>
          <Link
            to="/settings"
            className="mt-2 inline-flex rounded-lg bg-app-warning px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {t('projectDetail:languageGate.openSettings')}
          </Link>
        </div>
      )}

      <div
        className={`flex-shrink-0 bg-app-surface border-b border-app-border shadow-sm px-4 sm:px-6 py-3 ${languageBlocked ? 'pointer-events-none opacity-50' : ''}`}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/projects/${projectId}`} className="text-app-text-muted hover:text-app-text transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-app-text truncate">{project?.name || t('livePreview')}</h1>
              <p className="text-xs text-app-text-muted">{t('livePreview')}</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status === 'running' ? 'bg-app-success-soft text-app-success' :
              status === 'building' ? 'bg-app-warning-soft text-app-warning' :
              status === 'queued' ? 'bg-app-info-soft text-app-info' :
              status === 'error' ? 'bg-app-danger-soft text-app-danger' :
              'bg-app-surface-hover text-app-text'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'running' ? 'bg-app-success animate-pulse' :
                status === 'building' ? 'bg-app-warning animate-pulse' :
                status === 'queued' ? 'bg-app-accent-blue animate-pulse' :
                status === 'error' ? 'bg-app-danger' : 'bg-app-text-subtle'
              }`} />
              {status === 'running' ? t('status.running') : status === 'queued' ? t('status.inQueue') : status === 'building' ? t('status.building') : status === 'error' ? t('status.error') : status === 'stopping' ? t('status.stopping') : t('status.idle')}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {status === 'running' && iframeSrc && (
              <button
                type="button"
                onClick={() => { void togglePreviewFullscreen(); }}
                className="md:hidden px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border-strong bg-app-surface-muted text-app-text hover:bg-app-surface-hover transition-colors inline-flex items-center gap-1.5"
                aria-pressed={isPreviewFullscreen}
                aria-label={isPreviewFullscreen ? t('fullscreen.exitAria') : t('fullscreen.enterAria')}
              >
                {isPreviewFullscreen ? (
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                )}
                {isPreviewFullscreen ? t('fullscreen.exit') : t('fullscreen.enter')}
              </button>
            )}
            <button
              onClick={openDownloadModal}
              disabled={(status !== 'running') || showDownloadModal}
              className="px-4 py-1.5 text-sm font-medium text-white bg-app-accent-blue rounded-lg hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              {t('approveDownload')}
            </button>
          </div>
        </div>
      </div>

      {/* Main: split layout (side-by-side on md+, stacked with bottom-sheet on <md) */}
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row ${languageBlocked ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="relative flex-1 min-h-[50vh] overflow-hidden bg-app-surface-muted md:min-h-0">
          {status === 'running' && previewId && !iframeSrc && (
            <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3 bg-app-surface-muted p-6 text-center">
              <p className="text-sm text-app-text-muted">{t('iframe.waitingToken')}</p>
              <button
                type="button"
                onClick={() => {
                  void projectService.getPreviewStatus(projectId!).then(applyStatusResponse);
                }}
                className="rounded-lg border border-app-border-strong bg-app-surface px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface-hover"
              >
                {t('iframe.retryLink')}
              </button>
            </div>
          )}
          {status === 'running' && iframeSrc && (
            <div
              ref={previewStageRef}
              className="preview-erp-stage absolute inset-0 bg-app-surface-muted"
            >
              {isPreviewFullscreen && (
                <button
                  type="button"
                  onClick={() => { void togglePreviewFullscreen(); }}
                  className="absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-lg border border-app-border/80 bg-app-surface/95 px-2.5 py-1.5 text-xs font-medium text-app-text shadow-md backdrop-blur-sm"
                  aria-label={t('fullscreen.exitAria')}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                  </svg>
                  {t('fullscreen.exit')}
                </button>
              )}
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={t('iframeTitle')}
                className="h-full w-full border-0"
                allow="fullscreen"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              />
            </div>
          )}
        </div>

        {/* Right (md+): change panel as side rail */}
        <div className="hidden md:flex w-[340px] flex-shrink-0 border-l border-app-border bg-app-surface flex-col">
          <div className="p-5 flex-1 flex flex-col">
            <h2 className="text-base font-semibold text-app-text mb-1">{t('changePanel.title')}</h2>
            <p className="text-xs text-app-text-muted mb-4">{t('changePanel.subtitle')}</p>

            <textarea
              value={changeText}
              onChange={(e) => setChangeText(e.target.value)}
              placeholder={t('changePanel.placeholder')}
              className="flex-1 min-h-[200px] w-full rounded-lg border border-app-border-strong bg-app-surface-muted px-3 py-3 text-sm resize-none focus:ring-2 focus:ring-app-focus focus:border-app-accent-blue outline-none"
              disabled={!!genPhase}
            />

            <button
              type="button"
              onClick={() => { void handleRequestChanges(); }}
              disabled={!changeText.trim() || !!genPhase || status !== 'running'}
              className="mt-4 w-full rounded-lg bg-app-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('changePanel.button')}
            </button>
          </div>
        </div>

        {/* Below md: handle row; fixed sheet when open. Collapsed in wide layout / when sheet open. */}
        <div
          className={`md:hidden border-t border-app-border bg-app-surface flex-shrink-0 ${
            changePanelOpen ? 'max-md:hidden' : ''
          } pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
        >
          <button
            type="button"
            onClick={() => setChangePanelOpen((v) => !v)}
            aria-expanded={changePanelOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-app-text">{t('changePanel.title')}</span>
            <svg className="h-4 w-4 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>

        {changePanelOpen && (
          <div className="md:hidden">
            <div
              className="fixed inset-0 z-[45] bg-app-overlay/60"
              onClick={() => setChangePanelOpen(false)}
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={changePanelTitleId}
              className="fixed bottom-0 left-0 right-0 z-[45] flex max-h-mobile-sheet max-w-full flex-col rounded-t-2xl border-t border-app-border bg-app-surface shadow-xl"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-app-border px-4 py-3">
                <span id={changePanelTitleId} className="text-sm font-semibold text-app-text">
                  {t('changePanel.title')}
                </span>
                <button
                  type="button"
                  onClick={() => setChangePanelOpen(false)}
                  className="rounded-lg p-1.5 text-app-text-muted hover:bg-app-surface-hover hover:text-app-text"
                  aria-label={t('common:close')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <p className="text-xs text-app-text-muted mb-3">{t('changePanel.subtitle')}</p>
                <textarea
                  value={changeText}
                  onChange={(e) => setChangeText(e.target.value)}
                  placeholder={t('changePanel.placeholder')}
                  className="min-h-[8rem] w-full rounded-lg border border-app-border-strong bg-app-surface-muted px-3 py-2 text-sm focus:ring-2 focus:ring-app-focus focus:border-app-accent-blue outline-none"
                  disabled={!!genPhase}
                />
              </div>
              <div className="flex-shrink-0 border-t border-app-border bg-app-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => { void handleRequestChanges(); }}
                  disabled={!changeText.trim() || !!genPhase || status !== 'running'}
                  className="w-full rounded-lg bg-app-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('changePanel.button')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <PreviewBuildModal
        state={modalState}
        onCancel={cancelBuild}
        onRetry={retryBuild}
        onBack={() => navigate(`/projects/${projectId}`)}
      />

      <GenerationModal
        phase={genPhase}
        result={genResult}
        errorMessage={genErrorMsg}
        onClose={closeGenModal}
        progress={genProgress}
        questions={questions}
        answersById={answersById}
        onSetAnswers={setAnswersById}
        onSubmitAnswers={() => { void submitModalAnswers(); }}
        canSubmitAnswers={canSubmitAnswers}
        submittingAnswers={submittingAnswers}
      />

      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay backdrop-blur-sm">
          <div className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {downloadPhase === 'pick' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-app-text">{t('approveDownload')}</h2>
                  <p className="text-sm text-app-text-muted mt-1">{t('downloadModal.choosePlatform')}</p>
                </div>
                <div className="space-y-2">
                  {Object.entries(PLATFORM_INFO).map(([key, info]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                        downloadPlatform === key ? 'border-app-accent-blue bg-app-info-soft' : 'border-app-border hover:border-app-border-strong'
                      }`}
                    >
                      <input
                        type="radio"
                        name="platform"
                        value={key}
                        checked={downloadPlatform === key}
                        onChange={() => setDownloadPlatform(key)}
                        className="accent-indigo-600"
                      />
                      <div>
                        <div className="text-sm font-medium text-app-text">{info.label}</div>
                        <div className="text-xs text-app-text-muted">{t('downloadModal.runWith')} <code className="bg-app-surface-hover px-1 rounded">{info.startFile}</code></div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="flex-1 rounded-lg border border-app-border-strong px-4 py-2.5 text-sm font-medium text-app-text hover:bg-app-surface-muted"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => { void startApproveAndDownload(); }}
                    disabled={!downloadPlatform}
                    className="flex-1 rounded-lg bg-app-accent-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-app-accent-dark-blue disabled:opacity-50"
                  >
                    {t('approveDownload')}
                  </button>
                </div>
              </div>
            )}

            {downloadPhase === 'building' && (
              <div className="p-8 text-center space-y-5">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-app-border" />
                  <div className="absolute inset-0 rounded-full border-4 border-app-accent-blue border-t-transparent animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-app-text">{t('downloadModal.compiling')}</h3>
                  <p className="text-sm text-app-text-muted mt-1">
                    {t('downloadModal.buildingFor', { platform: PLATFORM_INFO[downloadPlatform]?.label || downloadPlatform })}
                  </p>
                </div>
                <p className="text-xs text-app-text-subtle">{t('downloadModal.dontClose')}</p>
              </div>
            )}

            {downloadPhase === 'done' && (
              <div className="p-8 text-center space-y-5">
                <div className="mx-auto w-16 h-16 bg-app-success-soft rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-app-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-app-text">{t('downloadModal.startedTitle')}</h3>
                  <p className="text-sm text-app-text-muted mt-1">{t('downloadModal.startedBody')}</p>
                  <p className="text-xs text-app-text-subtle mt-2">
                    {PLATFORM_INFO[downloadPlatform]?.extractTip}
                  </p>
                  <p className="text-xs text-app-text-subtle mt-2">{t('downloadModal.redirectingToSetup')}</p>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="rounded-lg bg-app-accent-blue px-6 py-2.5 text-sm font-semibold text-white hover:bg-app-accent-dark-blue"
                >
                  {t('common.close')}
                </button>
              </div>
            )}

            {downloadPhase === 'error' && (
              <div className="p-8 text-center space-y-5">
                <div className="mx-auto w-16 h-16 bg-app-danger-soft rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-app-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-app-text">{t('downloadModal.failedTitle')}</h3>
                  <p className="text-sm text-app-text-muted mt-1">{downloadError}</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="rounded-lg border border-app-border-strong px-4 py-2.5 text-sm font-medium text-app-text hover:bg-app-surface-muted"
                  >
                    {t('common.close')}
                  </button>
                  <button
                    onClick={() => { void startApproveAndDownload(); }}
                    className="rounded-lg bg-app-accent-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-app-accent-dark-blue"
                  >
                    {t('downloadModal.retry')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {changeReview && (
        <ReviewFeedbackModal
          review={changeReview}
          answers={{}}
          running={Boolean(genPhase)}
          variant="change_request"
          requestText={pendingChangeText}
          onEditQuestion={() => {
            setChangeText(pendingChangeText);
            setChangePanelOpen(true);
            setChangeReview(null);
            setPendingChangeText('');
          }}
          onAcknowledgeAndContinue={(features) => { void handleRequestChanges(features); }}
          onClose={() => { setChangeReview(null); setPendingChangeText(''); }}
        />
      )}
    </div>
  );
}
