import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { AnswerIssue, AnswerReview } from '../../types/aiGateway';
import { useBusinessQuestions } from './projectConstants';

interface Props {
  review: AnswerReview;
  /** Current answers keyed by business question id — shown so the user can re-read what they wrote. */
  answers: Record<string, string>;
  /** True while the analyze re-submit is in flight (after Acknowledge & generate). */
  running: boolean;
  /**
   * Edit a specific question. The page should close the modal and jump the
   * stepper to the offending question.
   */
  onEditQuestion: (questionId: string | null) => void;
  /**
   * Acknowledge the listed unsupported features and re-run analyze. Receives
   * the feature names (plain English) the user accepted.
   */
  onAcknowledgeAndContinue: (acknowledgedFeatures: string[]) => void;
  onClose: () => void;
}

interface QuestionGroup {
  questionId: string | null;
  questionText: string;
  answer: string;
  issues: AnswerIssue[];
}

export default function ReviewFeedbackModal({
  review, answers, running, onEditQuestion, onAcknowledgeAndContinue, onClose,
}: Props) {
  const { t } = useTranslation('projectDetail');
  const businessQuestions = useBusinessQuestions();
  const [acknowledgedFeatures, setAcknowledgedFeatures] = useState<Set<string>>(new Set());

  const questionTextById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const q of businessQuestions) map[q.id] = q.question;
    return map;
  }, [businessQuestions]);

  const groups: QuestionGroup[] = useMemo(() => {
    const byQid = new Map<string, QuestionGroup>();
    const general: QuestionGroup = {
      questionId: null,
      questionText: t('answerReview.generalGroup'),
      answer: '',
      issues: [],
    };
    for (const issue of review.issues) {
      const qid = issue.question_id || null;
      if (!qid) {
        general.issues.push(issue);
        continue;
      }
      const existing = byQid.get(qid);
      if (existing) {
        existing.issues.push(issue);
      } else {
        byQid.set(qid, {
          questionId: qid,
          questionText: questionTextById[qid] || qid,
          answer: answers[qid] || '',
          issues: [issue],
        });
      }
    }
    const ordered: QuestionGroup[] = [];
    if (general.issues.length) ordered.push(general);
    // Maintain BUSINESS_QUESTION_IDS order for per-question groups, then any unknown ids.
    for (const q of businessQuestions) {
      const g = byQid.get(q.id);
      if (g) {
        ordered.push(g);
        byQid.delete(q.id);
      }
    }
    for (const g of byQid.values()) ordered.push(g);
    return ordered;
  }, [review.issues, answers, questionTextById, businessQuestions, t]);

  const blockingIssues = useMemo(
    () => review.issues.filter((i) => i.severity === 'block'),
    [review.issues],
  );
  const unsupportedFeatures = useMemo(() => {
    const seen = new Set<string>();
    const out: AnswerIssue[] = [];
    for (const i of review.issues) {
      if (i.kind !== 'unsupported_feature') continue;
      const name = (i.related_feature || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(i);
    }
    return out;
  }, [review.issues]);

  const allUnsupportedAcknowledged = useMemo(
    () => unsupportedFeatures.every((i) => acknowledgedFeatures.has((i.related_feature || '').toLowerCase())),
    [unsupportedFeatures, acknowledgedFeatures],
  );

  const canContinue = blockingIssues.length === 0 && allUnsupportedAcknowledged;

  const toggleFeature = (name: string) => {
    const key = name.toLowerCase();
    setAcknowledgedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAcknowledge = () => {
    if (!canContinue || running) return;
    const original = unsupportedFeatures
      .map((i) => (i.related_feature || '').trim())
      .filter(Boolean);
    onAcknowledgeAndContinue(original);
  };

  const handleEditFirst = () => {
    const firstBlocking = blockingIssues.find((i) => i.question_id) || blockingIssues[0];
    onEditQuestion(firstBlocking?.question_id ?? null);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-app-surface-sunken/60 backdrop-blur-sm px-4 !m-0">
      <div className="w-full max-w-2xl rounded-2xl border border-app-border bg-app-surface shadow-2xl text-left p-4 sm:p-6">
        <div className="text-center mb-4">
          <div className={`mx-auto mb-3 h-12 w-12 flex items-center justify-center rounded-full ${
            blockingIssues.length ? 'bg-app-warning-soft' : 'bg-app-info-soft'
          }`}>
            <svg
              className={`h-6 w-6 ${blockingIssues.length ? 'text-app-warning' : 'text-app-accent-blue'}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-app-text">
            {blockingIssues.length
              ? t('answerReview.titleBlocking')
              : t('answerReview.titleAcknowledge')}
          </h3>
          <p className="mt-1 text-sm text-app-text-muted">
            {review.summary || (
              blockingIssues.length
                ? t('answerReview.subtitleBlocking')
                : t('answerReview.subtitleAcknowledge')
            )}
          </p>
        </div>

        <div className="max-h-[55vh] overflow-y-auto space-y-4 pr-1">
          {groups.map((g) => (
            <div
              key={g.questionId || 'general'}
              className="rounded-lg border border-app-border bg-app-surface-muted p-3.5 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-app-text-subtle">
                    {g.questionId
                      ? t('answerReview.questionLabel')
                      : t('answerReview.generalLabel')}
                  </div>
                  <div className="text-sm font-medium text-app-text break-words">
                    {g.questionText}
                  </div>
                </div>
                {g.questionId && (
                  <button
                    type="button"
                    onClick={() => onEditQuestion(g.questionId)}
                    disabled={running}
                    className="shrink-0 rounded-md border border-app-border bg-app-surface px-2.5 py-1 text-xs font-semibold text-app-text-muted hover:bg-app-surface-hover disabled:opacity-50"
                  >
                    {t('answerReview.editButton')}
                  </button>
                )}
              </div>

              {g.questionId && (
                <div className="text-xs text-app-text-subtle">
                  <span className="font-semibold">{t('answerReview.yourAnswer')}: </span>
                  <span className="italic">
                    {g.answer.trim() || t('answerReview.noAnswer')}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {g.issues.map((issue, idx) => (
                  <IssueRow
                    key={`${g.questionId || 'general'}-${idx}`}
                    issue={issue}
                    acknowledged={
                      issue.kind === 'unsupported_feature' &&
                      acknowledgedFeatures.has((issue.related_feature || '').toLowerCase())
                    }
                    onToggleAcknowledge={
                      issue.kind === 'unsupported_feature' && issue.related_feature
                        ? () => toggleFeature(issue.related_feature || '')
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={handleEditFirst}
            disabled={running}
            className="rounded-lg border border-app-border bg-app-surface px-5 py-2 text-sm font-semibold text-app-text hover:bg-app-surface-hover disabled:opacity-50"
          >
            {t('answerReview.editAnswers')}
          </button>
          {blockingIssues.length === 0 && unsupportedFeatures.length > 0 && (
            <button
              type="button"
              onClick={handleAcknowledge}
              disabled={!canContinue || running}
              className="rounded-lg bg-app-accent-blue px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-app-accent-dark-blue disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {running && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {t('answerReview.acknowledgeAndGenerate')}
            </button>
          )}
          {blockingIssues.length > 0 && (
            <button
              type="button"
              onClick={onClose}
              disabled={running}
              className="rounded-lg border border-app-border bg-app-surface px-5 py-2 text-sm font-semibold text-app-text hover:bg-app-surface-hover transition-colors disabled:opacity-50"
            >
              {t('answerReview.dismiss')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function IssueRow({
  issue, acknowledged, onToggleAcknowledge,
}: {
  issue: AnswerIssue;
  acknowledged: boolean;
  onToggleAcknowledge?: () => void;
}) {
  const { t } = useTranslation('projectDetail');
  const isBlock = issue.severity === 'block';
  const containerClass = isBlock
    ? 'border-app-danger-border bg-app-danger-soft/50'
    : 'border-app-warning-border bg-app-warning-soft/50';

  return (
    <div className={`rounded-md border ${containerClass} p-2.5 text-sm`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          isBlock ? 'bg-app-danger-soft text-app-danger' : 'bg-app-warning-soft text-app-warning'
        }`}>
          {t(`answerReview.kind.${issue.kind}`)}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-app-text break-words">{issue.message}</div>
          {issue.suggested_fix && (
            <div className="text-xs text-app-text-muted">
              <span className="font-semibold">{t('answerReview.suggestion')}: </span>
              {issue.suggested_fix}
            </div>
          )}
          {issue.kind === 'unsupported_feature' && issue.related_feature && onToggleAcknowledge && (
            <label className="mt-1 flex items-start gap-2 text-xs text-app-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={onToggleAcknowledge}
                className="mt-0.5"
              />
              <span>
                {t('answerReview.acknowledgeFeature', { feature: issue.related_feature })}
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
