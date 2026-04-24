import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { projectService } from '../services/projectService';
import { detectUserPlatform, usePlatformInfo } from '../components/project/projectConstants';
import GenerationModal from '../components/project/GenerationModal';
import PreviewBuildModal, { type PreviewModalState, type PreviewPhase } from '../components/project/PreviewBuildModal';
import { usePreviewHeartbeat } from '../hooks/usePreviewHeartbeat';
import { useChatContext } from '../context/ChatContext';
import { normalizeLanguage } from '../i18n';
import type { Project } from '../types/project';
import type { ClarificationQuestion, ClarificationAnswer } from '../types/aiGateway';

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

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadPlatform, setDownloadPlatform] = useState('');
  const [downloadPhase, setDownloadPhase] = useState<'pick' | 'building' | 'done' | 'error'>('pick');
  const [downloadError, setDownloadError] = useState('');

  // Change request state
  const [changeText, setChangeText] = useState('');
  // Mobile bottom sheet toggle for the change panel (collapsed by default on <md)
  const [changePanelOpen, setChangePanelOpen] = useState(false);
  /** Phone-only: rotate preview 90° so the ERP uses the long screen edge as “width”. */
  const [mobileWideLayout, setMobileWideLayout] = useState(false);
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
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const clearWide = () => {
      if (mq.matches) setMobileWideLayout(false);
    };
    clearWide();
    mq.addEventListener('change', clearWide);
    return () => mq.removeEventListener('change', clearWide);
  }, []);

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
    setShowDownloadModal(true);
  };

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
      a.download = `${project?.name || 'custom-erp'}-${downloadPlatform}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  const handleRequestChanges = async () => {
    if (!projectId || !changeText.trim()) return;
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
      const res = await projectService.regenerateProject(projectId, changeText.trim());
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

  const mobileRotatedFrameStyle: CSSProperties = {
    position: 'absolute',
    width: '100dvh',
    height: '100dvw',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%) rotate(90deg)',
    transformOrigin: 'center center',
  };

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

      {/* Toolbar */}
      <div className={`flex-shrink-0 bg-app-surface border-b border-app-border shadow-sm px-4 sm:px-6 py-3 ${languageBlocked ? 'pointer-events-none opacity-50' : ''}`}>
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
                onClick={() => setMobileWideLayout((v) => !v)}
                className="md:hidden px-3 py-1.5 text-sm font-medium rounded-lg border border-app-border-strong bg-app-surface-muted text-app-text hover:bg-app-surface-hover transition-colors flex items-center gap-1.5"
                aria-pressed={mobileWideLayout}
                aria-label={mobileWideLayout ? t('mobileView.tallLayoutAria') : t('mobileView.wideLayoutAria')}
              >
                <svg className="h-4 w-4 shrink-0 text-app-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {mobileWideLayout ? t('mobileView.tallLayout') : t('mobileView.wideLayout')}
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
              className={mobileWideLayout ? 'absolute z-0' : 'absolute inset-0'}
              style={mobileWideLayout ? mobileRotatedFrameStyle : undefined}
            >
              <iframe
                ref={iframeRef}
                src={iframeSrc}
                title={t('iframeTitle')}
                className="h-full w-full border-0"
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
              onClick={handleRequestChanges}
              disabled={!changeText.trim() || !!genPhase || status !== 'running'}
              className="mt-4 w-full rounded-lg bg-app-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('changePanel.button')}
            </button>
          </div>
        </div>

        {/* Below md: change panel as collapsible bottom sheet */}
        <div className="md:hidden border-t border-app-border bg-app-surface flex-shrink-0">
          <button
            type="button"
            onClick={() => setChangePanelOpen((v) => !v)}
            aria-expanded={changePanelOpen}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-app-text">{t('changePanel.title')}</span>
            <svg className={`h-4 w-4 text-app-text-muted transition-transform ${changePanelOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {changePanelOpen && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-app-text-muted">{t('changePanel.subtitle')}</p>
              <textarea
                value={changeText}
                onChange={(e) => setChangeText(e.target.value)}
                placeholder={t('changePanel.placeholder')}
                rows={4}
                className="w-full rounded-lg border border-app-border-strong bg-app-surface-muted px-3 py-2 text-sm resize-y focus:ring-2 focus:ring-app-focus focus:border-app-accent-blue outline-none"
                disabled={!!genPhase}
              />
              <button
                type="button"
                onClick={handleRequestChanges}
                disabled={!changeText.trim() || !!genPhase || status !== 'running'}
                className="w-full rounded-lg bg-app-accent-blue px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t('changePanel.button')}
              </button>
            </div>
          )}
        </div>
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
    </div>
  );
}
