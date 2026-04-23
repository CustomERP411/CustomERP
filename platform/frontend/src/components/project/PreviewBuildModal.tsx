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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-app-surface-sunken/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-build-modal-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl bg-app-surface shadow-2xl overflow-hidden"
      >
        {isError ? (
          <div className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-app-danger-soft flex items-center justify-center">
                <svg className="h-5 w-5 text-app-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="preview-build-modal-title" className="text-lg font-semibold text-app-text">
                  {t('modal.errorTitle')}
                </h2>
                <p className="text-sm text-app-text-muted mt-0.5">{t('modal.errorSubtitle')}</p>
              </div>
            </div>

            <div className="rounded-lg bg-app-danger-soft border border-app-danger-border px-4 py-3 text-sm text-app-danger">
              {state.message}
            </div>

            {state.code && (
              <details className="text-xs text-app-text-muted">
                <summary className="cursor-pointer hover:text-app-text">{t('modal.errorDetails')}</summary>
                <div className="mt-2 font-mono text-app-text-muted">
                  code: {state.code}
                </div>
              </details>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-app-border-strong px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface-muted"
              >
                {t('modal.back')}
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-lg bg-app-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-app-accent-dark-blue"
              >
                {t('modal.retry')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div>
              <h2 id="preview-build-modal-title" className="text-lg font-semibold text-app-text">
                {t('modal.title')}
              </h2>
              <p className="text-sm text-app-text-muted mt-0.5">{t('modal.subtitle')}</p>
            </div>

            {isQueued && (
              <div className="rounded-xl border border-app-info-border bg-app-info-soft p-4 space-y-1">
                <p className="text-sm font-semibold text-app-info">
                  {state.queuePosition > 0
                    ? t('modal.queuePosition', { position: state.queuePosition })
                    : t('modal.queueWaiting')}
                </p>
                <p className="text-xs text-app-info">{t('modal.queueEta')}</p>
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
                          ? 'bg-app-success text-white'
                          : active
                          ? 'bg-app-accent-blue text-white'
                          : 'bg-app-surface-hover text-app-text-muted'
                      }`}
                    >
                      {done ? (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : active ? (
                        <span className="w-2 h-2 rounded-full bg-app-surface animate-pulse" />
                      ) : (
                        absIdx
                      )}
                    </span>
                    <span
                      className={`text-sm ${
                        done
                          ? 'text-app-text-muted line-through'
                          : active
                          ? 'text-app-text font-medium'
                          : 'text-app-text-muted'
                      }`}
                    >
                      {t(`phases.${phase}`)}
                    </span>
                    {active && (
                      <span className="ml-auto text-xs text-app-text-subtle">{t('modal.elapsed', { seconds: elapsedSeconds })}</span>
                    )}
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-app-border">
              <p className="text-xs text-app-text-subtle">{t('mayTake')}</p>
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(t('modal.cancelConfirm'));
                  if (ok) onCancel();
                }}
                className="rounded-lg border border-app-border-strong px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface-muted"
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
