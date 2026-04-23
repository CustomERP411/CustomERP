import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import type { ClarificationQuestion } from '../../types/aiGateway';
import { MODULE_ICONS } from './projectConstants';

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

  if (questions.length === 0) return null;

  return (
    <section className="rounded-xl border bg-white p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{t('clarificationQuestions.title')}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{t('clarificationQuestions.subtitle')}</p>
        </div>
        {clarifyRound > 0 && (
          <span className="self-start rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
            {t('clarificationQuestions.round', { n: clarifyRound })}
          </span>
        )}
      </div>

      <div className="space-y-6">
        {groupKeys.map((mod) => {
          const qs = grouped[mod];
          const Ico = MODULE_ICONS[mod];
          const label = moduleLabels[mod] || (mod === 'general' ? t('generationModal.general') : mod);
          return (
            <div key={mod} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {Ico && <span className="text-slate-400"><Ico /></span>}
                <span>{label}</span>
                <span className="text-xs font-normal text-slate-400">({t('clarificationQuestions.questionCount', { count: qs.length })})</span>
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

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        {!sdfComplete && (
          <button type="button" onClick={onFinalize}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700">
            {t('clarificationQuestions.skipAndFinalize')}
          </button>
        )}
        <div className="ml-auto">
          <Button onClick={onSubmit} loading={running} disabled={!canSubmit || running}>{t('generationModal.submitAnswers')}</Button>
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
  const { t } = useTranslation('projectDetail');
  const priorityBadge = q.priority === 'high'
    ? <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">{t('generationModal.required')}</span>
    : q.priority === 'low'
    ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">{t('clarificationQuestions.optional')}</span>
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
              }`}>{val === 'yes' ? t('defaultQuestions.yes') : t('defaultQuestions.no')}</button>
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
                }`}>{t('defaultQuestions.custom')}</button>
            </div>
            {isCustom && (
              <textarea value={q.options!.includes(answer) ? '' : answer}
                onChange={(e) => onAnswer(e.target.value)}
                rows={2} className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                placeholder={t('generationModal.customAnswerPlaceholder')} autoFocus />
            )}
          </div>
        );
      })() : (
        <input value={answer} onChange={(e) => onAnswer(e.target.value)}
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder={t('defaultQuestions.textPlaceholder')} />
      )}
    </div>
  );
}
