import { useState } from 'react';
import Button from '../ui/Button';
import type { DefaultModuleQuestion, DefaultQuestionCompletion } from '../../types/defaultQuestions';
import { MODULE_META, MODULE_KEYS, MOD_STYLES } from './projectConstants';

interface Props {

  answersById: Record<string, string | string[]>;
  completion: DefaultQuestionCompletion | null;
  questionsByModule: Record<string, DefaultModuleQuestion[]>;
  moduleCompletionCounts: Record<string, { total: number; answered: number }>;
  loading: boolean;
  saving: boolean;
  canSave: boolean;
  onUpdateAnswer: (questionId: string, value: string | string[]) => void;
  onToggleMultiChoice: (questionId: string, option: string, enabled: boolean) => void;
  onSave: () => void;
}

export default function DefaultQuestions({
  answersById, completion, questionsByModule, moduleCompletionCounts,
  loading, saving, canSave,
  onUpdateAnswer, onToggleMultiChoice, onSave,
}: Props) {
  const [customActiveFor, setCustomActiveFor] = useState<Set<string>>(new Set());

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">2. Answer Questions</h2>
          <p className="mt-0.5 text-sm text-slate-500">These answers directly configure your ERP. Answer all to continue.</p>
        </div>
        {completion && (
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${completion.is_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {completion.answered_required_visible}/{completion.total_required_visible} answered
          </span>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-slate-50 p-6 text-center text-sm text-slate-500">Loading questions...</div>
      ) : (
        <div className="space-y-6">
          {MODULE_KEYS.filter((mod) => questionsByModule[mod]?.length).map((mod) => {
            const modQuestions = questionsByModule[mod];
            const meta = MODULE_META[mod];
            const styles = MOD_STYLES[mod];
            const counts = moduleCompletionCounts[mod] || { total: 0, answered: 0 };
            const allDone = counts.total > 0 && counts.answered === counts.total;

            return (
              <div key={mod} className={`rounded-xl border bg-white overflow-hidden ${styles.left}`}>
                <div className="flex items-center justify-between gap-3 border-b bg-slate-50/60 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                    <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {counts.answered}/{counts.total}
                  </span>
                </div>

                <div className="divide-y">
                  {modQuestions.map((q, qi) => {
                    const rawAnswer = answersById[q.id];
                    const answerString = Array.isArray(rawAnswer) ? '' : String(rawAnswer || '');
                    const options = Array.isArray(q.options) ? q.options : [];
                    const multiValues = Array.isArray(rawAnswer) ? rawAnswer : [];
                    const selectedKnownOption = options.includes(answerString) ? answerString : '';
                    const customValue = options.includes(answerString) ? '' : answerString;

                    return (
                      <div key={q.id} className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                            {qi + 1}
                          </span>
                          <div className="flex-1 space-y-2.5">
                            <div className="text-sm font-medium text-slate-800">
                              {q.question}
                              {q.required && <span className="ml-1 text-red-500">*</span>}
                            </div>

                            {q.type === 'yes_no' && (
                              <div className="flex gap-2">
                                {['yes', 'no'].map((val) => (
                                  <button key={val} type="button" onClick={() => onUpdateAnswer(q.id, val)}
                                    className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                                      answerString === val
                                        ? val === 'yes' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    {val === 'yes' ? 'Yes' : 'No'}
                                  </button>
                                ))}
                              </div>
                            )}

                            {q.type === 'multi_choice' && (
                              <div className="flex flex-wrap gap-2">
                                {options.map((opt) => {
                                  const checked = multiValues.includes(opt);
                                  return (
                                    <button key={opt} type="button" onClick={() => onToggleMultiChoice(q.id, opt, !checked)}
                                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                        checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {q.type === 'choice' && options.length > 0 && (() => {
                              const isCustomActive = customActiveFor.has(q.id) || (answerString !== '' && !options.includes(answerString));
                              return (
                              <div className="space-y-2">
                                {options.length <= 6 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {options.map((opt) => (
                                      <button key={opt} type="button"
                                        onClick={() => {
                                          onUpdateAnswer(q.id, opt);
                                          setCustomActiveFor((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
                                        }}
                                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                          selectedKnownOption === opt && !isCustomActive ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                    {q.allow_custom && (
                                      <button type="button"
                                        onClick={() => {
                                          setCustomActiveFor((prev) => { const n = new Set(prev); n.add(q.id); return n; });
                                          onUpdateAnswer(q.id, customValue || '');
                                        }}
                                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                          isCustomActive ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-dashed border-slate-300 bg-white text-slate-500 hover:bg-slate-50'
                                        }`}
                                      >
                                        Custom...
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <select
                                    value={isCustomActive ? '__custom__' : selectedKnownOption}
                                    onChange={(e) => {
                                      if (e.target.value === '__custom__') {
                                        setCustomActiveFor((prev) => { const n = new Set(prev); n.add(q.id); return n; });
                                        onUpdateAnswer(q.id, '');
                                      } else {
                                        setCustomActiveFor((prev) => { const n = new Set(prev); n.delete(q.id); return n; });
                                        onUpdateAnswer(q.id, e.target.value);
                                      }
                                    }}
                                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                                  >
                                    <option value="">Select...</option>
                                    {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    {q.allow_custom && <option value="__custom__">Custom...</option>}
                                  </select>
                                )}
                                {q.allow_custom && isCustomActive && (
                                  <input value={customValue} onChange={(e) => onUpdateAnswer(q.id, e.target.value)}
                                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Type your custom value..." autoFocus />
                                )}
                              </div>
                              );
                            })()}

                            {q.type === 'text' && (
                              <input value={answerString} onChange={(e) => onUpdateAnswer(q.id, e.target.value)}
                                className="w-full rounded-lg border bg-white px-3 py-2 text-sm" placeholder="Your answer..." />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onSave} loading={saving} disabled={!canSave || saving}>
          Save Answers
        </Button>
      </div>
    </section>
  );
}
