import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export type PreviewPhase =
  | 'queued'
  | 'assembling'
  | 'installing_backend'
  | 'installing_frontend'
  | 'building_frontend'
  | 'starting'
  | 'running';

export type PreviewModalState =
  | { kind: 'queued'; queuePosition: number; phase: PreviewPhase; startedAt: number }
  | { kind: 'building'; phase: PreviewPhase; startedAt: number }
  | { kind: 'error'; code: string; message: string; phase?: PreviewPhase };

const PHASE_ORDER: PreviewPhase[] = [
  'queued',
  'assembling',
  'installing_backend',
  'installing_frontend',
  'building_frontend',
  'starting',
  'running',
];

interface Props {
  state: PreviewModalState | null;
  onCancel: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export default function PreviewBuildModal({ state, onCancel, onRetry, onBack }: Props) {
  const { t } = useTranslation('previewPage');
  const [tick, setTick] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const isOpen = !!state;

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  useEffect(() => {
    if (!state || state.kind === 'error') return;
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state?.kind, state]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state && state.kind !== 'error') {
        const ok = window.confirm(t('modal.cancelConfirm'));
        if (ok) onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, state, onCancel, t]);

  const elapsedSeconds = useMemo(() => {
    if (!state || state.kind === 'error') return 0;
    return Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
  // tick keeps this fresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, tick]);

  if (!state) return null;

  const currentPhase: PreviewPhase | undefined =
    state.kind === 'error' ? state.phase : state.phase;
  const currentIdx = currentPhase ? PHASE_ORDER.indexOf(currentPhase) : -1;
  const isError = state.kind === 'error';
  const isQueued = state.kind === 'queued';

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-build-modal-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        {isError ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="preview-build-modal-title" className="text-lg font-semibold text-slate-900">
                  {t('modal.errorTitle')}
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">{t('modal.errorSubtitle')}</p>
              </div>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {state.message}
            </div>

            {state.code && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer hover:text-slate-700">{t('modal.errorDetails')}</summary>
                <div className="mt-2 font-mono text-slate-600">
                  code: {state.code}
                </div>
              </details>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('modal.back')}
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                {t('modal.retry')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <h2 id="preview-build-modal-title" className="text-lg font-semibold text-slate-900">
                {t('modal.title')}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{t('modal.subtitle')}</p>
            </div>

            {isQueued && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-1">
                <p className="text-sm font-semibold text-blue-900">
                  {state.queuePosition > 0
                    ? t('modal.queuePosition', { position: state.queuePosition })
                    : t('modal.queueWaiting')}
                </p>
                <p className="text-xs text-blue-700">{t('modal.queueEta')}</p>
              </div>
            )}

            <ol className="space-y-2">
              {PHASE_ORDER.slice(1).map((phase, i) => {
                // skip showing `running` in the stepper; it's the destination
                if (phase === 'running') return null;
                const absIdx = i + 1; // because we sliced(1)
                const done = currentIdx > absIdx;
                const active = currentIdx === absIdx;
                return (
                  <li key={phase} className="flex items-center gap-3">
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {done ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : active ? (
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      ) : (
                        absIdx
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        done
                          ? 'text-slate-500 line-through'
                          : active
                          ? 'text-slate-900 font-medium'
                          : 'text-slate-500'
                      }`}
                    >
                      {t(`phases.${phase}`)}
                    </span>
                    {active && (
                      <span className="ml-auto text-xs text-slate-400">{t('modal.elapsed', { seconds: elapsedSeconds })}</span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400">{t('mayTake')}</p>
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(t('modal.cancelConfirm'));
                  if (ok) onCancel();
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('modal.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
