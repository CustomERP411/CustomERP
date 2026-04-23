import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DefaultModuleQuestion, DefaultQuestionCompletion } from '../../types/defaultQuestions';
import { useModuleMeta, MODULE_KEYS, MOD_STYLES } from './projectConstants';

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
  onHelpWithQuestion?: (questionText: string, currentAnswer: string | string[]) => void;
}

export default function DefaultQuestions({
  answersById, completion, questionsByModule, moduleCompletionCounts,
  loading, saving, canSave,
  onUpdateAnswer, onToggleMultiChoice, onSave,
  onHelpWithQuestion,
}: Props) {
  const [customActiveFor, setCustomActiveFor] = useState<Set<string>>(new Set());
  const { t } = useTranslation('projectDetail');
  const MODULE_META = useModuleMeta();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-app-text">{t('defaultQuestions.title')}</h2>
          <p className="mt-0.5 text-sm text-app-text-muted">{t('defaultQuestions.subtitle')}</p>
        </div>
        {completion && (
          <span className={`self-start shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${completion.is_complete ? 'bg-app-success-soft text-app-success' : 'bg-app-warning-soft text-app-warning'}`}>
            {t('defaultQuestions.answeredCount', { answered: completion.answered_required_visible, total: completion.total_required_visible })}
          </span>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-app-surface-muted p-6 text-center text-sm text-app-text-muted">{t('defaultQuestions.loading')}</div>
      ) : (
        <div className="space-y-6">
          {MODULE_KEYS.filter((mod) => questionsByModule[mod]?.length).map((mod) => {
            const modQuestions = questionsByModule[mod];
            const meta = MODULE_META[mod];
            const styles = MOD_STYLES[mod];
            const counts = moduleCompletionCounts[mod] || { total: 0, answered: 0 };
            const allDone = counts.total > 0 && counts.answered === counts.total;

            return (
              <div key={mod} className={`rounded-xl border bg-app-surface overflow-hidden ${styles.left}`}>
                <div className="flex items-center justify-between gap-3 border-b bg-app-surface-muted/60 px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                    <span className="text-sm font-semibold text-app-text truncate">{meta.label}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${allDone ? 'bg-app-success-soft text-app-success' : 'bg-app-surface-hover text-app-text-muted'}`}>
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
                    // Option VALUES stay language-neutral (stored slugs). `option_labels`
                    // provides locale-specific display strings; fall back to the raw value
                    // when no translation is registered.
                    const labelFor = (opt: string) => q.option_labels?.[opt] ?? opt;

                    return (
                      <div key={q.id} id={`dq-${q.id}`} className="scroll-mt-6 px-4 py-4 sm:px-5">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-app-surface-hover text-[11px] font-bold text-app-text-muted">
                            {qi + 1}
                          </span>
                          <div className="flex-1 min-w-0 space-y-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                              <div className="text-sm font-medium text-app-text min-w-0 break-words">
                                {q.question}
                                {q.required && <span className="ml-1 text-app-danger">*</span>}
                              </div>
                              {onHelpWithQuestion && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    let currentAnswer: string | string[] = '';
                                    if (Array.isArray(rawAnswer)) {
                                      currentAnswer = rawAnswer.map((v) => labelFor(v));
                                    } else if (q.type === 'yes_no') {
                                      currentAnswer = answerString === 'yes'
                                        ? t('defaultQuestions.yes')
                                        : answerString === 'no'
                                          ? t('defaultQuestions.no')
                                          : '';
                                    } else if (q.type === 'choice' || q.type === 'multi_choice') {
                                      currentAnswer = answerString ? labelFor(answerString) : '';
                                    } else {
                                      currentAnswer = answerString;
                                    }
                                    onHelpWithQuestion(q.question, currentAnswer);
                                  }}
                                  className="self-start shrink-0 text-xs font-medium text-app-text-muted underline decoration-app-border underline-offset-2 hover:text-app-accent-blue hover:decoration-app-accent-blue/40 transition-colors"
                                >
                                  {t('defaultQuestions.needHelp')}
                                </button>
                              )}
                            </div>

                            {q.type === 'yes_no' && (
                              <div className="flex gap-2">
                                {['yes', 'no'].map((val) => (
                                  <button key={val} type="button" onClick={() => onUpdateAnswer(q.id, val)}
                                    className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                                      answerString === val
                                        ? val === 'yes' ? 'border-app-success bg-app-success-soft text-app-success' : 'border-app-danger bg-app-danger-soft text-app-danger'
                                        : 'border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
                                    }`}
                                  >
                                    {val === 'yes' ? t('defaultQuestions.yes') : t('defaultQuestions.no')}
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
                                        checked ? 'border-app-accent-blue bg-app-info-soft text-app-accent-dark-blue' : 'border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
                                      }`}
                                    >
                                      {labelFor(opt)}
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
                                          selectedKnownOption === opt && !isCustomActive ? 'border-app-accent-blue bg-app-info-soft text-app-accent-dark-blue' : 'border-app-border bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
                                        }`}
                                      >
                                        {labelFor(opt)}
                                      </button>
                                    ))}
                                    {q.allow_custom && (
                                      <button type="button"
                                        onClick={() => {
                                          setCustomActiveFor((prev) => { const n = new Set(prev); n.add(q.id); return n; });
                                          onUpdateAnswer(q.id, customValue || '');
                                        }}
                                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                          isCustomActive ? 'border-app-accent-blue bg-app-info-soft text-app-accent-dark-blue' : 'border-dashed border-app-border-strong bg-app-surface text-app-text-muted hover:bg-app-surface-muted'
                                        }`}
                                      >
                                        {t('defaultQuestions.custom')}
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
                                    className="w-full rounded-lg border bg-app-surface px-3 py-2 text-sm"
                                  >
                                    <option value="">{t('defaultQuestions.select')}</option>
                                    {options.map((opt) => <option key={opt} value={opt}>{labelFor(opt)}</option>)}
                                    {q.allow_custom && <option value="__custom__">{t('defaultQuestions.custom')}</option>}
                                  </select>
                                )}
                                {q.allow_custom && isCustomActive && (
                                  <input value={customValue} onChange={(e) => onUpdateAnswer(q.id, e.target.value)}
                                    className="w-full rounded-lg border bg-app-surface px-3 py-2 text-sm" placeholder={t('defaultQuestions.customPlaceholder')} autoFocus />
                                )}
                              </div>
                              );
                            })()}

                            {q.type === 'text' && (
                              <input value={answerString} onChange={(e) => onUpdateAnswer(q.id, e.target.value)}
                                className="w-full rounded-lg border bg-app-surface px-3 py-2 text-sm" placeholder={t('defaultQuestions.textPlaceholder')} />
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

      <div id="dq-continue-btn" className="scroll-mt-6 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className={`inline-flex items-center justify-center rounded-lg border-2 px-5 py-2 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-app-focus ${
            canSave && !saving
              ? 'border-app-accent-blue bg-app-accent-blue text-white shadow-sm hover:bg-app-accent-dark-blue hover:border-app-accent-dark-blue'
              : 'border-app-border-strong bg-app-surface text-app-text-subtle cursor-not-allowed opacity-60'
          }`}
        >
          {saving && (
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {t('defaultQuestions.continue')}
        </button>
      </div>
    </section>
  );
}
