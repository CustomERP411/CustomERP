import Button from '../ui/Button';
import { BUSINESS_QUESTIONS } from './projectConstants';

interface Props {
  answers: Record<string, string>;
  step: number;
  canAnalyze: boolean;
  running: boolean;
  onSetAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSetStep: React.Dispatch<React.SetStateAction<number>>;
  onAnalyze: () => void;
}

export default function BusinessQuestions({ answers, step, canAnalyze, running, onSetAnswers, onSetStep, onAnalyze }: Props) {
  const q = BUSINESS_QUESTIONS[step];

  return (
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
        <div>
          <span className="text-xs font-medium text-indigo-500 uppercase tracking-wide">Question {step + 1}</span>
          <div className="mt-1 text-sm font-semibold text-slate-800">{q.question}</div>
          {q.hint && <div className="mt-1 text-xs text-slate-400">{q.hint}</div>}
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
              onSetStep((s) => s + 1);
            }
          }}
          autoFocus
        />
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => onSetStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity">
            &larr; Back
          </button>
          <div className="flex items-center gap-3">
            {q.optional && <span className="text-xs text-slate-400">Optional</span>}
            {step < BUSINESS_QUESTIONS.length - 1 ? (
              <button type="button" onClick={() => onSetStep((s) => s + 1)}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm transition-colors">
                Next &rarr;
              </button>
            ) : (
              <Button onClick={onAnalyze} loading={running} disabled={!canAnalyze || running}>
                Generate My ERP Setup
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

      {step === BUSINESS_QUESTIONS.length - 1 && canAnalyze && (
        <div className="flex justify-end pt-2">
          <Button onClick={onAnalyze} loading={running} disabled={running}>Generate My ERP Setup</Button>
        </div>
      )}
    </section>
  );
}
