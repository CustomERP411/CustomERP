import { useMemo, useState } from 'react';
import Button from '../ui/Button';
import type { ClarificationQuestion } from '../../types/aiGateway';
import { MODULE_ICONS } from './projectConstants';

const MODULE_LABELS: Record<string, string> = {
  hr: 'HR / People',
  invoice: 'Invoicing',
  inventory: 'Inventory',
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface Props {
  questions: ClarificationQuestion[];
  answersById: Record<string, string>;
  canSubmit: boolean;
  running: boolean;
  clarifyRound: number;
  sdfComplete: boolean;
  onSetAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSubmit: () => void;
  onFinalize: () => void;
}

export default function ClarificationQuestions({
  questions, answersById, canSubmit, running, clarifyRound, sdfComplete,
  onSetAnswers, onSubmit, onFinalize,
}: Props) {
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

  if (sdfComplete && questions.length === 0) {
    return (
      <section className="rounded-xl border bg-emerald-50 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-emerald-900">Your ERP Configuration is Complete</h2>
          <p className="mt-1 text-sm text-emerald-700">
            All modules have the information they need. You can review the setup below or generate the final SDF.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onFinalize} loading={running}>Generate Final SDF</Button>
          <button type="button" onClick={onSubmit}
            className="text-sm font-medium text-slate-600 underline hover:text-slate-800">
            I want to refine further
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-white p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Follow-up Questions</h2>
          <p className="mt-0.5 text-sm text-slate-500">The AI needs a bit more information to finalize your setup.</p>
        </div>
        {clarifyRound > 0 && (
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            Round {clarifyRound}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {groupKeys.map((mod) => {
          const qs = grouped[mod];
          const Ico = MODULE_ICONS[mod];
          const label = MODULE_LABELS[mod] || (mod === 'general' ? 'General' : mod);
          return (
            <div key={mod} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {Ico && <span className="text-slate-400"><Ico /></span>}
                <span>{label}</span>
                <span className="text-xs font-normal text-slate-400">({qs.length} question{qs.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="space-y-3 pl-1">
                {qs.map((q) => (
                  <QuestionRow key={q.id} q={q} answer={answersById[q.id] || ''}
                    isCustomActive={customActiveFor.has(q.id)}
                    onAnswer={(val) => onSetAnswers((prev) => ({ ...prev, [q.id]: val }))}
                    onToggleCustom={(active) => {
                      setCustomActiveFor((prev) => { const n = new Set(prev); active ? n.add(q.id) : n.delete(q.id); return n; });
                      if (active) onSetAnswers((prev) => ({ ...prev, [q.id]: '' }));
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-4 pt-2">
        {!sdfComplete && (
          <button type="button" onClick={onFinalize}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700">
            Skip remaining and finalize
          </button>
        )}
        <div className="ml-auto">
          <Button onClick={onSubmit} loading={running} disabled={!canSubmit || running}>Submit Answers</Button>
        </div>
      </div>
    </section>
  );
}

function QuestionRow({ q, answer, isCustomActive, onAnswer, onToggleCustom }: {
  q: ClarificationQuestion;
  answer: string;
  isCustomActive: boolean;
  onAnswer: (val: string) => void;
  onToggleCustom: (active: boolean) => void;
}) {
  const priorityBadge = q.priority === 'high'
    ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Required</span>
    : q.priority === 'low'
    ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">Optional</span>
    : null;

  return (
    <div className="rounded-lg border bg-slate-50 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-800">{q.question}</span>
        {priorityBadge}
      </div>
      {q.type === 'yes_no' ? (
        <div className="flex gap-2">
          {['yes', 'no'].map((val) => (
            <button key={val} type="button" onClick={() => onAnswer(val)}
              className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                answer === val
                  ? val === 'yes' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}>{val === 'yes' ? 'Yes' : 'No'}</button>
          ))}
        </div>
      ) : q.type === 'choice' && Array.isArray(q.options) && q.options.length ? (() => {
        const isCustom = isCustomActive || (answer && !q.options!.includes(answer));
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
