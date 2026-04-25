import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import { useBusinessQuestions } from './projectConstants';

const BASIC_INDICES = [0, 1, 2];
const EXTRA_INDICES = [3, 4, 5];

interface Props {
  answers: Record<string, string>;
  step: number;
  canAnalyze: boolean;
  running: boolean;
  skipWarningOpen: boolean;
  onSetAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetStep: React.Dispatch<React.SetStateAction<number>>;
  onAnalyze: () => void;
  onHelpWithQuestion: (questionText: string, currentAnswer: string) => void;
  onSkipWarningChange: (open: boolean) => void;
}

export default function BusinessQuestions({
  answers, step, canAnalyze, running, skipWarningOpen,
  onSetAnswers, onSetStep, onAnalyze, onHelpWithQuestion, onSkipWarningChange,
}: Props) {
  const { t } = useTranslation('projectDetail');
  const questions = useBusinessQuestions();
  const q = questions[step];
  const warningDismissedRef = useRef(false);

  const advance = () => {
    if (step < questions.length - 1) {
      onSetStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    if (step < questions.length - 1) {
      advance();
      return;
    }
    tryGenerate();
  };

  const tryGenerate = () => {
    if (warningDismissedRef.current) {
      onAnalyze();
      return;
    }

    const basicSkipped = BASIC_INDICES.some((i) => !(answers[questions[i].id] || '').trim());
    const allExtraSkipped = EXTRA_INDICES
      .filter((i) => i < questions.length)
      .every((i) => !(answers[questions[i].id] || '').trim());

    if (basicSkipped || allExtraSkipped) {
      onSkipWarningChange(true);
      return;
    }
    onAnalyze();
  };

  const confirmGenerate = () => {
    warningDismissedRef.current = true;
    onSkipWarningChange(false);
    onAnalyze();
  };

  const goBackAndAnswer = () => {
    onSkipWarningChange(false);
    onSetStep(0);
  };

  return (
    <>
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-app-text">{t('businessSection.title')}</h2>
          <p className="mt-0.5 text-sm text-app-text-muted">
            {t('businessSection.subtitle')}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {questions.map((bq, i) => {
            const answered = !!(answers[bq.id] || '').trim();
            const active = i === step;
            return (
              <button key={bq.id} type="button" onClick={() => onSetStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  active ? 'w-8 bg-app-accent-blue' : answered ? 'w-2.5 bg-app-accent-blue/40 hover:bg-app-accent-blue' : 'w-2.5 bg-app-surface-hover hover:bg-app-border-strong'
                }`}
              />
            );
          })}
          <span className="ml-2 text-xs text-app-text-subtle">{t('businessSection.progress', { current: step + 1, total: questions.length })}</span>
        </div>

        {/* Current question card */}
        <div className="rounded-xl border bg-app-surface p-4 sm:p-5 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
            <div className="min-w-0">
              <span className="text-xs font-medium text-app-accent-blue uppercase tracking-wide">{t('businessSection.questionLabel', { n: step + 1 })}</span>
              <div className="mt-1 text-sm font-semibold text-app-text break-words">{q.question}</div>
              {q.hint && <div className="mt-1 text-xs text-app-text-subtle">{q.hint}</div>}
            </div>
            <button
              type="button"
              onClick={() => onHelpWithQuestion(q.question, (answers[q.id] || '').trim())}
              className="self-start shrink-0 text-xs font-medium text-app-text-muted underline decoration-app-border underline-offset-2 hover:text-app-accent-blue hover:decoration-app-accent-blue/40 transition-colors"
            >
              {t('businessSection.needHelp')}
            </button>
          </div>
          <textarea
            key={q.id}
            value={answers[q.id] || ''}
            onChange={(e) => { const id = q.id; onSetAnswers((prev) => ({ ...prev, [id]: e.target.value })); }}
            rows={3}
            className="w-full rounded-lg border bg-app-surface-muted px-4 py-3 text-sm text-app-text outline-none focus:ring-2 focus:ring-app-focus transition-shadow"
            placeholder={q.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && step < questions.length - 1) {
                e.preventDefault();
                advance();
              }
            }}
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button type="button" onClick={() => onSetStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="text-sm font-medium text-app-text-muted hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed transition-opacity">
              &larr; {t('businessSection.back')}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={handleSkip}
                disabled={!!(answers[q.id] || '').trim()}
                className="rounded-lg border border-app-border px-3 sm:px-4 py-2 text-sm font-medium text-app-text-muted hover:bg-app-surface-muted hover:text-app-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                {t('businessSection.skip')}
              </button>
              {step < questions.length - 1 ? (
                <button type="button" onClick={advance}
                  className="rounded-lg bg-app-accent-blue px-5 py-2 text-sm font-semibold text-white hover:bg-app-accent-dark-blue shadow-sm transition-colors">
                  {t('businessSection.next')} &rarr;
                </button>
              ) : (
                <Button onClick={tryGenerate} loading={running} disabled={!canAnalyze || running}>
                  {t('businessSection.generate')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary of answered questions */}
        {Object.values(answers).some((v) => v.trim()) && (
          <div className="rounded-xl border bg-app-surface-muted/70 p-4 space-y-1.5">
            <div className="text-xs font-semibold text-app-text-muted uppercase tracking-wide mb-2">{t('businessSection.yourAnswers')}</div>
            {questions.map((bq, i) => {
              const answer = (answers[bq.id] || '').trim();
              if (!answer) return null;
              return (
                <button key={bq.id} type="button" onClick={() => onSetStep(i)}
                  className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left hover:bg-app-surface transition-colors group">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-app-info-soft text-[10px] font-bold text-app-accent-blue">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-app-text-subtle">{bq.question}</div>
                    <div className="mt-0.5 text-sm text-app-text truncate">{answer}</div>
                  </div>
                  <span className="text-[10px] text-app-text-subtle opacity-0 group-hover:opacity-100 transition-opacity mt-1">{t('businessSection.edit')}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Skip warning modal */}
      {skipWarningOpen && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-app-overlay">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-app-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-warning-soft">
                <svg className="h-5 w-5 text-app-warning" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-app-text">{t('skipWarning.title')}</h3>
            </div>
            <p className="text-sm text-app-text-muted">{t('skipWarning.body1')}</p>
            <p className="text-sm text-app-text-muted" dangerouslySetInnerHTML={{ __html: t('skipWarning.body2') }} />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={goBackAndAnswer}
                className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface-muted transition-colors">
                {t('skipWarning.goBack')}
              </button>
              <button type="button" onClick={confirmGenerate} disabled={!canAnalyze || running}
                className="rounded-lg bg-app-accent-blue px-4 py-2 text-sm font-semibold text-white hover:bg-app-accent-dark-blue disabled:opacity-50 transition-colors">
                {t('skipWarning.generateAnyway')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
