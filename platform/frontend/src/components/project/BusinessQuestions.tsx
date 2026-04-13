import { useRef } from 'react';
import { createPortal } from 'react-dom';
import Button from '../ui/Button';
import { BUSINESS_QUESTIONS } from './projectConstants';

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
  const q = BUSINESS_QUESTIONS[step];
  const warningDismissedRef = useRef(false);

  const advance = () => {
    if (step < BUSINESS_QUESTIONS.length - 1) {
      onSetStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    if (step < BUSINESS_QUESTIONS.length - 1) {
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

    const basicSkipped = BASIC_INDICES.some((i) => !(answers[BUSINESS_QUESTIONS[i].id] || '').trim());
    const allExtraSkipped = EXTRA_INDICES
      .filter((i) => i < BUSINESS_QUESTIONS.length)
      .every((i) => !(answers[BUSINESS_QUESTIONS[i].id] || '').trim());

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
          <h2 className="text-lg font-semibold text-slate-900">3. Tell Us About Your Business</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Answer a few simple questions so we can build the right system for you.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {BUSINESS_QUESTIONS.map((bq, i) => {
            const answered = !!(answers[bq.id] || '').trim();
            const active = i === step;
            return (
              <button key={bq.id} type="button" onClick={() => onSetStep(i)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  active ? 'w-8 bg-indigo-500' : answered ? 'w-2.5 bg-indigo-300 hover:bg-indigo-400' : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                }`}
              />
            );
          })}
          <span className="ml-2 text-xs text-slate-400">{step + 1} of {BUSINESS_QUESTIONS.length}</span>
        </div>

        {/* Current question card */}
        <div className="rounded-xl border bg-white p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-medium text-indigo-500 uppercase tracking-wide">Question {step + 1}</span>
              <div className="mt-1 text-sm font-semibold text-slate-800">{q.question}</div>
              {q.hint && <div className="mt-1 text-xs text-slate-400">{q.hint}</div>}
            </div>
            <button
              type="button"
              onClick={() => onHelpWithQuestion(q.question, (answers[q.id] || '').trim())}
              className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              Need help answering?
            </button>
          </div>
          <textarea
            key={q.id}
            value={answers[q.id] || ''}
            onChange={(e) => { const id = q.id; onSetAnswers((prev) => ({ ...prev, [id]: e.target.value })); }}
            rows={3}
            className="w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
            placeholder={q.placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && step < BUSINESS_QUESTIONS.length - 1) {
                e.preventDefault();
                advance();
              }
            }}
            autoFocus
          />
          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={() => onSetStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity">
              &larr; Back
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSkip}
                disabled={!!(answers[q.id] || '').trim()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                Skip
              </button>
              {step < BUSINESS_QUESTIONS.length - 1 ? (
                <button type="button" onClick={advance}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors">
                  Next &rarr;
                </button>
              ) : (
                <Button onClick={tryGenerate} loading={running} disabled={!canAnalyze || running}>
                  Generate ERP
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Summary of answered questions */}
        {Object.values(answers).some((v) => v.trim()) && (
          <div className="rounded-xl border bg-slate-50/70 p-4 space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your Answers</div>
            {BUSINESS_QUESTIONS.map((bq, i) => {
              const answer = (answers[bq.id] || '').trim();
              if (!answer) return null;
              return (
                <button key={bq.id} type="button" onClick={() => onSetStep(i)}
                  className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left hover:bg-white transition-colors group">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-400">{bq.question}</div>
                    <div className="mt-0.5 text-sm text-slate-700 truncate">{answer}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1">edit</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Skip warning modal — portaled to body so it covers the entire page; z-40 keeps chatbot (z-50) above */}
      {skipWarningOpen && createPortal(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Some questions were skipped</h3>
            </div>
            <p className="text-sm text-slate-600">
              Skipping too many questions may result in a less accurate ERP. The more we know about your business, the better we can customize your system.
            </p>
            <p className="text-sm text-slate-600">
              If you need help answering, try our <strong>chatbot assistant</strong> — it&apos;s pulsing on the bottom-right of your screen right now.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={goBackAndAnswer}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                Go back &amp; answer
              </button>
              <button type="button" onClick={confirmGenerate} disabled={!canAnalyze || running}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                Generate anyway
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
