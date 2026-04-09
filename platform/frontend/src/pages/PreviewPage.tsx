import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { detectUserPlatform } from '../components/project/projectConstants';
import type { Project } from '../types/project';

type PreviewStatus = 'idle' | 'starting' | 'running' | 'error' | 'stopping';

const PROGRESS_MESSAGES = [
  { delay: 0, text: 'Generating your ERP...' },
  { delay: 4_000, text: 'Installing backend dependencies...' },
  { delay: 18_000, text: 'Installing frontend dependencies...' },
  { delay: 35_000, text: 'Building interface...' },
  { delay: 50_000, text: 'Starting your ERP...' },
];

export default function PreviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('idle');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [progressText, setProgressText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [approving, setApproving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionText, setRevisionText] = useState('');
  const [revisionLoading, setRevisionLoading] = useState(false);

  const detectedPlatform = useMemo(() => detectUserPlatform(), []);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearProgressTimers = useCallback(() => {
    progressTimers.current.forEach(clearTimeout);
    progressTimers.current = [];
  }, []);

  useEffect(() => {
    if (!projectId) return;
    projectService.getProject(projectId).then(setProject).catch(() => {});
  }, [projectId]);

  const startPreviewFlow = useCallback(async () => {
    if (!projectId) return;
    setStatus('starting');
    setErrorMsg('');
    setPreviewId(null);

    PROGRESS_MESSAGES.forEach(({ delay, text }) => {
      const t = setTimeout(() => setProgressText(text), delay);
      progressTimers.current.push(t);
    });

    try {
      const result = await projectService.startPreview(projectId);
      clearProgressTimers();
      setPreviewId(result.previewId);
      setStatus('running');
      setProgressText('');
    } catch (err: any) {
      clearProgressTimers();
      setStatus('error');
      setProgressText('');
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to start preview');
    }
  }, [projectId, clearProgressTimers]);

  // Auto-start on mount: check if already running, otherwise start
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
      } catch {
        // ignore
      }
      if (!cancelled) startPreviewFlow();
    })();

    return () => { cancelled = true; clearProgressTimers(); };
  }, [projectId, startPreviewFlow, clearProgressTimers]);

  const handleApproveAndDownload = async () => {
    if (!projectId) return;
    setApproving(true);
    try {
      await projectService.approveReview(projectId);
      setDownloading(true);
      const blob = await projectService.generateStandaloneErpZip(projectId, detectedPlatform);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.name || 'custom-erp'}-${detectedPlatform}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'Download failed');
    } finally {
      setApproving(false);
      setDownloading(false);
    }

    try {
      await projectService.stopPreview(projectId);
    } catch {
      // cleanup best effort
    }
  };

  const handleRequestChanges = async () => {
    if (!projectId || !revisionText.trim()) return;
    setRevisionLoading(true);
    try {
      await projectService.requestRevision(projectId, revisionText.trim());
      try { await projectService.stopPreview(projectId); } catch {}
      navigate(`/projects/${projectId}`);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err?.message || 'Failed to request changes');
    } finally {
      setRevisionLoading(false);
    }
  };

  const iframeSrc = previewId ? `/preview/${previewId}/` : undefined;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-50">
      {/* Floating toolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Left: back link + project name */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to={`/projects/${projectId}`}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 truncate">
                {project?.name || 'Preview'}
              </h1>
              <p className="text-xs text-gray-500">Live Preview</p>
            </div>
            {/* Status badge */}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
              status === 'running' ? 'bg-green-100 text-green-800' :
              status === 'starting' ? 'bg-amber-100 text-amber-800' :
              status === 'error' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                status === 'running' ? 'bg-green-500 animate-pulse' :
                status === 'starting' ? 'bg-amber-500 animate-pulse' :
                status === 'error' ? 'bg-red-500' :
                'bg-gray-400'
              }`} />
              {status === 'running' ? 'Running' :
               status === 'starting' ? 'Building...' :
               status === 'error' ? 'Error' :
               status === 'stopping' ? 'Stopping...' :
               'Idle'}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {!showRevisionInput && (
              <>
                <button
                  onClick={() => setShowRevisionInput(true)}
                  disabled={status !== 'running'}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Request Changes
                </button>
                <button
                  onClick={handleApproveAndDownload}
                  disabled={status !== 'running' || approving}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {downloading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Downloading...
                    </>
                  ) : approving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Approving...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      Approve &amp; Download
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Revision input bar */}
        {showRevisionInput && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
              placeholder="Describe what you'd like changed in plain language..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleRequestChanges()}
              disabled={revisionLoading}
            />
            <button
              onClick={handleRequestChanges}
              disabled={!revisionText.trim() || revisionLoading}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {revisionLoading ? 'Sending...' : 'Send'}
            </button>
            <button
              onClick={() => { setShowRevisionInput(false); setRevisionText(''); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              disabled={revisionLoading}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Error banner */}
        {errorMsg && (
          <div className="mt-2 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading state */}
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
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
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
                <button
                  onClick={startPreviewFlow}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                >
                  Try Again
                </button>
                <Link
                  to={`/projects/${projectId}`}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Back to Project
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Iframe (visible only when running) */}
        {status === 'running' && iframeSrc && (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="ERP Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}
