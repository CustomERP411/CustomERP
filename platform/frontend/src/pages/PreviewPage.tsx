import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { detectUserPlatform, PLATFORM_INFO } from '../components/project/projectConstants';
import GenerationModal from '../components/project/GenerationModal';
import { useChatContext } from '../context/ChatContext';
import type { Project } from '../types/project';
import type { ClarificationQuestion, ClarificationAnswer } from '../types/aiGateway';

type PreviewStatus = 'idle' | 'queued' | 'starting' | 'running' | 'error' | 'stopping';

const SIDEBAR_KEY = 'sidebar_collapsed';

const PROGRESS_MESSAGES = [
  { delay: 0, text: 'Generating your ERP...' },
  { delay: 4_000, text: 'Installing backend dependencies...' },
  { delay: 18_000, text: 'Installing frontend dependencies...' },
  { delay: 35_000, text: 'Building interface...' },
  { delay: 50_000, text: 'Starting your ERP...' },
];

function mapGenerationError(err: any): string {
  const raw = err?.response?.data?.error || err?.message || '';
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(raw)) return 'Generation took too long. Your inputs are saved — please try again.';
  if (/network|ECONNREFUSED/i.test(raw)) return 'Our AI service is temporarily unreachable. Please try again in a few minutes.';
  if (/quota|rate.limit/i.test(raw)) return 'We\'re experiencing high demand. Please wait a moment and try again.';
  if (/schema|validation/i.test(raw)) return 'The AI produced an unexpected format. Please try generating again.';
  return raw || 'Something went wrong during generation. Please try again.';
}

export default function PreviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { setProjectContext } = useChatContext();

  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [queuePosition, setQueuePosition] = useState(0);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadPlatform, setDownloadPlatform] = useState('');
  const [downloadPhase, setDownloadPhase] = useState<'pick' | 'building' | 'done' | 'error'>('pick');
  const [downloadError, setDownloadError] = useState('');

  // Change request state
  const [changeText, setChangeText] = useState('');
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearProgressTimers = useCallback(() => {
    progressTimers.current.forEach(clearTimeout);
    progressTimers.current = [];
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

  const pollUntilReady = useCallback(() => {
    const poll = async () => {
      if (!mountedRef.current || !projectId) return;
      try {
        const res = await projectService.getPreviewStatus(projectId);
        if (!mountedRef.current) return;
        if (res.status === 'running' && res.previewId) {
          clearProgressTimers();
          setPreviewId(res.previewId);
          setStatus('running');
          setProgressText('');
          setQueuePosition(0);
          return;
        }
        if (res.status === 'queued') {
          setStatus('queued');
          setQueuePosition(res.queuePosition || 0);
          setProgressText('');
          const t = setTimeout(poll, 3000);
          progressTimers.current.push(t);
          return;
        }
        if (res.status === 'building') {
          if (status === 'queued') {
            setStatus('starting');
            PROGRESS_MESSAGES.forEach(({ delay, text }) => {
              const t = setTimeout(() => { if (mountedRef.current) setProgressText(text); }, delay);
              progressTimers.current.push(t);
            });
          }
          setQueuePosition(0);
          const t = setTimeout(poll, 3000);
          progressTimers.current.push(t);
          return;
        }
      } catch { /* ignore */ }
      clearProgressTimers();
      if (mountedRef.current) {
        setStatus('error');
        setProgressText('');
        setQueuePosition(0);
        setErrorMsg('Preview build failed. Please try again.');
      }
    };

    const t = setTimeout(poll, 3000);
    progressTimers.current.push(t);
  }, [projectId, clearProgressTimers, status]);

  const startPreviewFlow = useCallback(async () => {
    if (!projectId) return;
    setStatus('starting');
    setErrorMsg('');
    setPreviewId(null);
    setQueuePosition(0);

    try {
      const result = await projectService.startPreview(projectId);
      if (!mountedRef.current) return;
      setPreviewId(result.previewId);

      if (result.status === 'queued') {
        setStatus('queued');
        pollUntilReady();
      } else if (result.status === 'building') {
        setStatus('starting');
        PROGRESS_MESSAGES.forEach(({ delay, text }) => {
          const t = setTimeout(() => { if (mountedRef.current) setProgressText(text); }, delay);
          progressTimers.current.push(t);
        });
        pollUntilReady();
      } else if (result.status === 'running') {
        setStatus('running');
      } else {
        pollUntilReady();
      }
    } catch (err: any) {
      clearProgressTimers();
      if (!mountedRef.current) return;
      setStatus('error');
      setProgressText('');
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to start preview');
    }
  }, [projectId, clearProgressTimers, pollUntilReady]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const existing = await projectService.getPreviewStatus(projectId);
        if (cancelled) return;
        if (existing.status === 'running' && existing.previewId) {
          setPreviewId(existing.previewId);
          setStatus('running');
          return;
        }
        if (existing.status === 'queued' && existing.previewId) {
          setPreviewId(existing.previewId);
          setStatus('queued');
          pollUntilReady();
          return;
        }
        if (existing.status === 'building' && existing.previewId) {
          setPreviewId(existing.previewId);
          setStatus('starting');
          PROGRESS_MESSAGES.forEach(({ delay, text }) => {
            const t = setTimeout(() => { if (mountedRef.current) setProgressText(text); }, delay);
            progressTimers.current.push(t);
          });
          pollUntilReady();
          return;
        }
      } catch { /* ignore */ }
      if (!cancelled) startPreviewFlow();
    })();

    return () => { cancelled = true; clearProgressTimers(); };
  }, [projectId, startPreviewFlow, clearProgressTimers, pollUntilReady]);

  // Load current SDF for change requests
  useEffect(() => {
    if (!projectId) return;
    projectService.getLatestSdf(projectId).then((res) => {
      if (res.sdf) setCurrentSdf(res.sdf);
    }).catch(() => {});
  }, [projectId]);

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
        ? await err.response.data.text().then((t: string) => { try { return JSON.parse(t).error; } catch { return t; } }).catch(() => '')
        : (err?.response?.data?.error || err?.message || '');
      setDownloadError(raw || 'Download failed. Please try again.');
      setDownloadPhase('error');
    }
  };

  const handleRequestChanges = async () => {
    if (!projectId || !changeText.trim()) return;
    setGenPhase('Applying changes...'); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
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
        setGenProgress({ step: 'clarifications', pct: 20, detail: 'Waiting for your answers' });
        return;
      }

      setCurrentSdf(res.sdf);
      setGenProgress({ step: 'done', pct: 100, detail: 'Complete' });
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
      setGenErrorMsg(mapGenerationError(err));
    }
  };

  const submitModalAnswers = async () => {
    if (!projectId || !currentSdf || questions.length === 0) return;
    setSubmittingAnswers(true);
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
      const res = await projectService.clarifyProject(projectId, currentSdf, answers, project?.description || '');
      progressCancelled = true;
      setProject(res.project);
      const resQuestions = (res.questions || []).filter((q: any) => q?.id && q?.question) as ClarificationQuestion[];

      if (resQuestions.length > 0 && !res.sdf_complete) {
        setCurrentSdf(res.sdf); setQuestions(resQuestions); setAnswersById({});
        setGenProgress({ step: 'clarifications', pct: 20, detail: 'Waiting for your answers' });
        return;
      }

      setCurrentSdf(res.sdf);
      setGenProgress({ step: 'done', pct: 100, detail: 'Complete' });
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
      setGenErrorMsg(mapGenerationError(err));
    } finally { progressCancelled = true; setSubmittingAnswers(false); }
  };

  const closeGenModal = () => {
    setGenPhase(''); setGenResult(null); setGenErrorMsg(''); setGenProgress(null);
    setQuestions([]); setAnswersById({});
  };

  const iframeSrc = previewId ? `/preview/${previewId}/` : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to={`/projects/${projectId}`} className="text-gray-500 hover:text-gray-700 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">{project?.name || 'Preview'}</h1>
              <p className="text-xs text-gray-500">Live Preview</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status === 'running' ? 'bg-green-100 text-green-800' :
              status === 'starting' ? 'bg-amber-100 text-amber-800' :
              status === 'queued' ? 'bg-blue-100 text-blue-800' :
              status === 'error' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'running' ? 'bg-green-500 animate-pulse' :
                status === 'starting' ? 'bg-amber-500 animate-pulse' :
                status === 'queued' ? 'bg-blue-500 animate-pulse' :
                status === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              {status === 'running' ? 'Running' : status === 'queued' ? 'In Queue' : status === 'starting' ? 'Building...' : status === 'error' ? 'Error' : status === 'stopping' ? 'Stopping...' : 'Idle'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openDownloadModal}
              disabled={(status !== 'running') || showDownloadModal}
              className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              Approve &amp; Download
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-2 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
          </div>
        )}
      </div>

      {/* Main: split layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: iframe / loading / error */}
        <div className="flex-1 relative overflow-hidden">
          {status === 'queued' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center space-y-6 max-w-sm">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
                  {queuePosition > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">{queuePosition}</span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900">Your preview is queued</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {queuePosition > 0
                      ? `Position ${queuePosition} in queue. Another build is in progress.`
                      : 'Waiting for a build slot to open up.'}
                  </p>
                </div>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center space-y-6">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                  <div className="absolute inset-3 rounded-full border-4 border-indigo-300 border-b-transparent animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-900">{progressText || 'Preparing preview...'}</p>
                  <p className="text-sm text-gray-500 mt-1">This may take up to a minute</p>
                </div>
                <div className="flex justify-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center space-y-4 max-w-md">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Preview Failed</h3>
                <p className="text-sm text-gray-600">{errorMsg || 'Something went wrong while generating the preview.'}</p>
                <div className="flex justify-center gap-3">
                  <button onClick={startPreviewFlow} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Try Again</button>
                  <Link to={`/projects/${projectId}`} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Back to Project</Link>
                </div>
              </div>
            </div>
          )}

          {status === 'running' && iframeSrc && (
            <iframe ref={iframeRef} src={iframeSrc} title="ERP Preview" className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" />
          )}
        </div>

        {/* Right: change panel */}
        <div className="w-[340px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
          <div className="p-5 flex-1 flex flex-col">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Request Changes</h2>
            <p className="text-xs text-gray-500 mb-4">Describe what you'd like changed and we'll regenerate your ERP.</p>

            <textarea
              value={changeText}
              onChange={(e) => setChangeText(e.target.value)}
              placeholder="e.g. Add an expiry date field to products, change the invoice layout to show tax separately..."
              className="flex-1 min-h-[200px] w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-3 text-sm resize-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
              disabled={!!genPhase}
            />

            <button
              type="button"
              onClick={handleRequestChanges}
              disabled={!changeText.trim() || !!genPhase || status !== 'running'}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Request Changes
            </button>
          </div>
        </div>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {downloadPhase === 'pick' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Approve &amp; Download</h2>
                  <p className="text-sm text-gray-500 mt-1">Choose the operating system you'll run this ERP on.</p>
                </div>
                <div className="space-y-2">
                  {Object.entries(PLATFORM_INFO).map(([key, info]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
                        downloadPlatform === key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
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
                        <div className="text-sm font-medium text-gray-900">{info.label}</div>
                        <div className="text-xs text-gray-500">Run with <code className="bg-gray-100 px-1 rounded">{info.startFile}</code></div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { void startApproveAndDownload(); }}
                    disabled={!downloadPlatform}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Approve &amp; Download
                  </button>
                </div>
              </div>
            )}

            {downloadPhase === 'building' && (
              <div className="p-8 text-center space-y-5">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Compiling your ERP</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Building for {PLATFORM_INFO[downloadPlatform]?.label || downloadPlatform}. This may take a few minutes.
                  </p>
                </div>
                <p className="text-xs text-gray-400">Please don't close this page.</p>
              </div>
            )}

            {downloadPhase === 'done' && (
              <div className="p-8 text-center space-y-5">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Download started!</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Your ERP has been approved and the download should begin automatically.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {PLATFORM_INFO[downloadPlatform]?.extractTip}
                  </p>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Close
                </button>
              </div>
            )}

            {downloadPhase === 'error' && (
              <div className="p-8 text-center space-y-5">
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Download failed</h3>
                  <p className="text-sm text-gray-600 mt-1">{downloadError}</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => { void startApproveAndDownload(); }}
                    className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Retry
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
