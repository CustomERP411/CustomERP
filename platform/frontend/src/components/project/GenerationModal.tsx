import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ClarificationQuestion } from '../../types/aiGateway';

const STEP_ORDER: { key: string; label: string }[] = [
  { key: 'starting', label: 'Saving your answers' },
  { key: 'distributor', label: 'Analyzing your business requirements' },
  { key: 'clarifications', label: 'Waiting for your answers' },
  { key: 'generators', label: 'Generating module configurations' },
  { key: 'finalizing', label: 'Checking for follow-up questions' },
  { key: 'normalizing', label: 'Validating & normalizing your ERP' },
  { key: 'validating', label: 'Finalizing your ERP' },
  { key: 'done', label: 'Complete' },
];

const MODULE_LABELS: Record<string, string> = {
  hr: 'HR / People',
  invoice: 'Invoicing',
  inventory: 'Inventory',
};

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
  if (!phase && !result) return null;

  const hasQuestions = questions.length > 0 && !result;
  const step = progress?.step || 'starting';
  const pct = result === 'success' ? 100 : (progress?.pct ?? 5);
  const detail = progress?.detail || phase;

  const activeIdx = STEP_ORDER.findIndex((s) => s.key === step);
  const currentIdx = activeIdx >= 0 ? activeIdx : 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 !m-0">
      <div className={`w-full rounded-2xl border border-slate-200 bg-white shadow-2xl text-center transition-all duration-500 ease-in-out ${
        hasQuestions ? 'max-w-2xl p-6' : 'max-w-md p-8'
      }`}>

        {/* Progress mode */}
        {!result && !hasQuestions && (
          <>
            <div className="mx-auto mb-5 h-14 w-14 flex items-center justify-center">
              <svg className="h-14 w-14 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">Generating Your ERP</h3>
            <p className="text-sm text-slate-500 mb-5">{detail}</p>

            <div className="w-full rounded-full bg-slate-100 h-2.5 mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="space-y-1.5 mb-4">
              {STEP_ORDER.filter((s) => s.key !== 'done').map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={s.key} className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${done ? 'opacity-40' : active ? 'opacity-100' : 'opacity-25'}`}>
                    {done ? (
                      <svg className="h-3.5 w-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : active ? (
                      <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                        <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                      </div>
                    ) : (
                      <div className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                      </div>
                    )}
                    <span className={`${active ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                      {active && progress?.detail ? progress.detail : s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-slate-400">{pct}% complete</p>
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
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-9 w-9 text-emerald-600 animate-[checkPop_0.4s_ease-out]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" className="animate-[checkDraw_0.5s_ease-out]" style={{ strokeDasharray: 30, strokeDashoffset: 0 }} />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">ERP Generated Successfully</h3>
            <p className="mt-2 text-sm text-slate-500">Your ERP configuration is ready.</p>
            <div className="w-full rounded-full bg-slate-100 h-2.5 mt-4 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 w-full transition-all duration-500" />
            </div>
          </>
        )}

        {/* Error */}
        {result === 'error' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-9 w-9 text-red-600 animate-[checkPop_0.4s_ease-out]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Generation Failed</h3>
            <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Close
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
  const [customActiveFor, setCustomActiveFor] = useState<Set<string>>(new Set());

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
        <div className="mx-auto mb-3 h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
          <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-slate-900">We need a bit more information</h3>
        <p className="mt-1 text-sm text-slate-500">Please answer these questions so we can build the right ERP for you.</p>
      </div>

      <div className="max-h-[55vh] overflow-y-auto space-y-5 pr-1">
        {groupKeys.map((mod) => {
          const qs = grouped[mod];
          const label = MODULE_LABELS[mod] || (mod === 'general' ? 'General' : mod);
          return (
            <div key={mod} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span>{label}</span>
                <span className="text-xs font-normal text-slate-400">({qs.length})</span>
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
          className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {submitting && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          Submit Answers
        </button>
      </div>
    </div>
  );
}

function ModalQuestionRow({ q, answer, isCustomActive, onAnswer, onToggleCustom }: {
  q: ClarificationQuestion; answer: string; isCustomActive: boolean;
  onAnswer: (val: string) => void; onToggleCustom: (active: boolean) => void;
}) {
  const priorityBadge = q.priority === 'high'
    ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Required</span>
    : null;

  return (
    <div className="rounded-lg border bg-slate-50 p-3.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-800">{q.question}</span>
        {priorityBadge}
      </div>
      {q.type === 'yes_no' ? (
        <div className="flex gap-2">
          {['yes', 'no'].map((val) => (
            <button key={val} type="button" onClick={() => onAnswer(val)}
              className={`rounded-lg border px-5 py-1.5 text-sm font-medium transition-colors ${
                answer === val
                  ? val === 'yes' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>{val === 'yes' ? 'Yes' : 'No'}</button>
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
                    answer === opt && !isCustom ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}>{opt}</button>
              ))}
              <button type="button" onClick={() => onToggleCustom(true)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  isCustom ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                }`}>Custom...</button>
            </div>
            {isCustom && (
              <textarea value={q.options!.includes(answer) ? '' : answer}
                onChange={(e) => onAnswer(e.target.value)}
                rows={2} className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                placeholder="Type your custom answer..." autoFocus />
            )}
          </div>
        );
      })() : (
        <input value={answer} onChange={(e) => onAnswer(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Your answer..." />
      )}
    </div>
  );
}
