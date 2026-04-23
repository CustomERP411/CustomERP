import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ClarificationQuestion } from '../../types/aiGateway';

const STEP_KEYS = [
  'starting',
  'distributor',
  'clarifications',
  'generators',
  'integrator',
  'finalizing',
  'normalizing',
  'validating',
  'done',
];

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface GenerationModalProps {
  phase: string;
  result: 'success' | 'error' | null;
  errorMessage: string;
  onClose: () => void;
  progress?: { step: string; pct: number; detail: string } | null;
  questions?: ClarificationQuestion[];
  answersById?: Record<string, string>;
  onSetAnswers?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmitAnswers?: () => void;
  canSubmitAnswers?: boolean;
  submittingAnswers?: boolean;
}

export default function GenerationModal({
  phase, result, errorMessage, onClose, progress,
  questions = [], answersById = {}, onSetAnswers, onSubmitAnswers,
  canSubmitAnswers = false, submittingAnswers = false,
}: GenerationModalProps) {
  const { t } = useTranslation('projectDetail');
  if (!phase && !result) return null;

  const stepOrder = STEP_KEYS.map((key) => ({ key, label: t(`generationModal.steps.${key}`) }));

  const hasQuestions = questions.length > 0 && !result;
  const rawStep = progress?.step || '';
  const step = STEP_KEYS.includes(rawStep) ? rawStep : 'starting';
  const pct = result === 'success' ? 100 : (progress?.pct ?? 5);
  const headlineDetail = progress
    ? t(`generationModal.stepDetails.${step}`)
    : (phase || t('generationModal.stepDetails.idle'));

  const activeIdx = stepOrder.findIndex((s) => s.key === step);
  const currentIdx = activeIdx >= 0 ? activeIdx : 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-app-surface-sunken/60 backdrop-blur-sm px-4 !m-0">
      <div className={`w-full rounded-2xl border border-app-border bg-app-surface shadow-2xl text-center transition-all duration-500 ease-in-out ${
        hasQuestions ? 'max-w-2xl p-4 sm:p-6' : 'max-w-md p-6 sm:p-8'
      }`}>

        {/* Progress mode */}
        {!result && !hasQuestions && (
          <>
            <div className="mx-auto mb-5 h-14 w-14 flex items-center justify-center">
              <svg className="h-14 w-14 animate-spin text-app-accent-blue" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-app-text mb-1">{t('generationModal.generating')}</h3>
            <p className="text-sm text-app-text-muted mb-5">{headlineDetail}</p>

            <div className="w-full rounded-full bg-app-surface-hover h-2.5 mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-app-accent-blue transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="space-y-1.5 mb-4">
              {stepOrder.filter((s) => s.key !== 'done').map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={s.key} className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${done ? 'opacity-40' : active ? 'opacity-100' : 'opacity-25'}`}>
                    {done ? (
                      <svg className="h-3.5 w-3.5 text-app-success shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : active ? (
                      <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-app-accent-blue animate-pulse" />
                      </div>
                    ) : (
                      <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-app-border-strong" />
                      </div>
                    )}
                    <span className={`${active ? 'text-app-text font-medium' : 'text-app-text-muted'}`}>
                      {active ? t(`generationModal.stepDetails.${s.key}`) : s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-app-text-subtle">{t('generationModal.percentComplete', { pct })}</p>
          </>
        )}

        {/* Questions mode */}
        {hasQuestions && (
          <ModalQuestionsPanel
            questions={questions}
            answersById={answersById}
            onSetAnswers={onSetAnswers}
            onSubmit={onSubmitAnswers}
            canSubmit={canSubmitAnswers}
            submitting={submittingAnswers}
          />
        )}

        {/* Success */}
        {result === 'success' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-app-success-soft">
              <svg className="h-9 w-9 text-app-success animate-[checkPop_0.4s_ease-out]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" className="animate-[checkDraw_0.5s_ease-out]" style={{ strokeDasharray: 30, strokeDashoffset: 0 }} />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-app-text">{t('generationModal.successTitle')}</h3>
            <p className="mt-2 text-sm text-app-text-muted">{t('generationModal.successBody')}</p>
            <div className="w-full rounded-full bg-app-surface-hover h-2.5 mt-4 overflow-hidden">
              <div className="h-full rounded-full bg-app-success w-full transition-all duration-500" />
            </div>
          </>
        )}

        {/* Error */}
        {result === 'error' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-app-danger-soft">
              <svg className="h-9 w-9 text-app-danger animate-[checkPop_0.4s_ease-out]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-app-text">{t('generationModal.errorTitle')}</h3>
            <p className="mt-2 text-sm text-app-text-muted">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-app-surface-sunken px-5 py-2 text-sm font-semibold text-white hover:bg-app-surface-sunken transition-colors"
            >
              {t('generationModal.close')}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { stroke-dashoffset: 30; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>,
    document.body,
  );
}

/* ── Inline Questions Panel ─────────────────────────────── */

function ModalQuestionsPanel({ questions, answersById, onSetAnswers, onSubmit, canSubmit, submitting }: {
  questions: ClarificationQuestion[];
  answersById: Record<string, string>;
  onSetAnswers?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit?: () => void;
  canSubmit: boolean;
  submitting: boolean;
}) {
  const { t } = useTranslation('projectDetail');
  const [customActiveFor, setCustomActiveFor] = useState<Set<string>>(new Set());

  const moduleLabels: Record<string, string> = {
    hr: t('modules.hr.label'),
    invoice: t('modules.invoice.label'),
    inventory: t('modules.inventory.label'),
  };

  const grouped = useMemo(() => {
    const sorted = [...questions].sort(
      (a, b) => (PRIORITY_ORDER[a.priority || 'medium'] ?? 1) - (PRIORITY_ORDER[b.priority || 'medium'] ?? 1)
    );
    const groups: Record<string, ClarificationQuestion[]> = {};
    for (const q of sorted) {
      const mod = q.module || 'general';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(q);
    }
    return groups;
  }, [questions]);

  const groupKeys = useMemo(
    () => Object.keys(grouped).sort((a, b) => (a === 'general' ? 1 : 0) - (b === 'general' ? 1 : 0)),
    [grouped]
  );

  return (
    <div className="text-left">
      <div className="text-center mb-5">
        <div className="mx-auto mb-3 h-12 w-12 flex items-center justify-center rounded-full bg-app-info-soft">
          <svg className="h-6 w-6 text-app-accent-blue" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-app-text">{t('generationModal.needMoreInfoTitle')}</h3>
        <p className="mt-1 text-sm text-app-text-muted">{t('generationModal.needMoreInfoBody')}</p>
      </div>

      <div className="max-h-[55vh] overflow-y-auto space-y-5 pr-1">
        {groupKeys.map((mod) => {
          const qs = grouped[mod];
          const label = moduleLabels[mod] || (mod === 'general' ? t('generationModal.general') : mod);
          return (
            <div key={mod} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
                <span>{label}</span>
                <span className="text-xs font-normal text-app-text-subtle">({qs.length})</span>
              </div>
              <div className="space-y-3">
                {qs.map((q) => (
                  <ModalQuestionRow key={q.id} q={q} answer={answersById[q.id] || ''}
                    isCustomActive={customActiveFor.has(q.id)}
                    onAnswer={(val) => onSetAnswers?.((prev) => ({ ...prev, [q.id]: val }))}
                    onToggleCustom={(active) => {
                      setCustomActiveFor((prev) => { const n = new Set(prev); active ? n.add(q.id) : n.delete(q.id); return n; });
                      if (active) onSetAnswers?.((prev) => ({ ...prev, [q.id]: '' }));
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || submitting}
          className="rounded-lg bg-app-accent-blue px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {submitting && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          {t('generationModal.submitAnswers')}
        </button>
      </div>
    </div>
  );
}

function ModalQuestionRow({ q, answer, isCustomActive, onAnswer, onToggleCustom }: {
  q: ClarificationQuestion; answer: string; isCustomActive: boolean;
  onAnswer: (val: string) => void; onToggleCustom: (active: boolean) => void;
}) {
  const { t } = useTranslation('projectDetail');
  const priorityBadge = q.priority === 'high'
    ? <span className="rounded bg-app-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-app-danger">{t('generationModal.required')}</span>
    : null;

  return (
    <div className="rounded-lg border bg-app-surface-muted p-3.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-app-text">{q.question}</span>
        {priorityBadge}
      </div>
      {q.type === 'yes_no' ? (
        <div className="flex gap-2">
          {['yes', 'no'].map((val) => (
            <button key={val} type="button" onClick={() => onAnswer(val)}
              className={`rounded-lg border px-5 py-1.5 text-sm font-medium transition-colors ${
                answer === val
                  ? val === 'yes' ? 'border-app-success bg-app-success-soft text-app-success' : 'border-app-danger bg-app-danger-soft text-app-danger'
                  : 'border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
              }`}>{val === 'yes' ? t('defaultQuestions.yes') : t('defaultQuestions.no')}</button>
          ))}
        </div>
      ) : q.type === 'choice' && Array.isArray(q.options) && q.options.length ? (() => {
        const isCustom = isCustomActive || (answer !== '' && !q.options!.includes(answer));
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {q.options!.map((opt) => (
                <button key={opt} type="button"
                  onClick={() => { onAnswer(opt); onToggleCustom(false); }}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    answer === opt && !isCustom ? 'border-app-accent-blue bg-app-info-soft text-app-accent-dark-blue' : 'border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
                  }`}>{opt}</button>
              ))}
              <button type="button" onClick={() => onToggleCustom(true)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isCustom ? 'border-app-accent-blue bg-app-info-soft text-app-accent-dark-blue' : 'border-dashed border-app-border-strong bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
                }`}>{t('defaultQuestions.custom')}</button>
            </div>
            {isCustom && (
              <textarea value={q.options!.includes(answer) ? '' : answer}
                onChange={(e) => onAnswer(e.target.value)}
                rows={2} className="w-full rounded-lg border bg-app-surface px-3 py-2 text-sm"
                placeholder={t('generationModal.customAnswerPlaceholder')} autoFocus />
            )}
          </div>
        );
      })() : (
        <input value={answer} onChange={(e) => onAnswer(e.target.value)}
          className="w-full rounded-lg border bg-app-surface px-3 py-2 text-sm" placeholder={t('defaultQuestions.textPlaceholder')} />
      )}
    </div>
  );
}
