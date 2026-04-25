import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ReviewHistoryItem {
  id: string;
  action: 'generated' | 'clarified' | 'manual_save' | 'ai_revision' | 'approved' | 'rejected' | 'revision_requested';
  version: number | null;
  status: string | null;
  note: string;
  createdAt: string;
}

interface ReviewEntitySummary {
  relationFields?: unknown[];
}

interface ReviewPreview {
  entityCount: number;
  moduleSummaries: unknown[];
  warnings?: string[] | null;
  entities: ReviewEntitySummary[];
}

interface ReviewApprovalPanelProps {
  preview: ReviewPreview;
  projectStatus: string;
  currentVersion: number | null;
  history: ReviewHistoryItem[];
  running: boolean;
  onApprove: () => void;
  onReject: () => void;
  onRequestRevision: (instructions: string) => void;
  historyOnly?: boolean;
}

export default function ReviewApprovalPanel({
  preview,
  projectStatus,
  currentVersion,
  history,
  running,
  onApprove,
  onReject,
  onRequestRevision,
  historyOnly = false,
}: ReviewApprovalPanelProps) {
  const [revisionInstructions, setRevisionInstructions] = useState('');
  const { t, i18n } = useTranslation('projectDetail');

  const ACTION_LABELS: Record<ReviewHistoryItem['action'], string> = {
    generated: t('review.actions.generated'),
    clarified: t('review.actions.clarified'),
    manual_save: t('review.actions.manual_save'),
    ai_revision: t('review.actions.ai_revision'),
    approved: t('review.actions.approved'),
    rejected: t('review.actions.rejected'),
    revision_requested: t('review.actions.revision_requested'),
  };

  // In historyOnly mode, just render the revision history
  if (historyOnly) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border bg-app-surface p-4">
          <div className="text-sm font-semibold text-app-text">{t('review.historyTitle')}</div>
          {history.length === 0 ? (
            <div className="mt-2 text-xs text-app-text-muted">{t('review.noHistory')}</div>
          ) : (
            <div className="mt-3 space-y-2">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-app-border bg-app-surface-muted px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-app-text">{ACTION_LABELS[entry.action]}</div>
                    <div className="text-[11px] text-app-text-muted">
                      {new Date(entry.createdAt).toLocaleString(i18n.language)}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-app-text-muted">
                    {t('review.versionStatus', { version: entry.version ?? '-', status: entry.status || '-' })}
                  </div>
                  {entry.note && <div className="mt-1 text-xs text-app-text">{entry.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  const checklist = (() => {
    const relationCount = Array.isArray(preview.entities)
      ? preview.entities.reduce((acc, entity) => acc + (Array.isArray(entity.relationFields) ? entity.relationFields.length : 0), 0)
      : 0;
    const warnings = Array.isArray(preview.warnings) ? preview.warnings.length : 0;
    const modules = Array.isArray(preview.moduleSummaries) ? preview.moduleSummaries.length : 0;
    const entities = Number(preview.entityCount || 0);
    return { relationCount, warnings, modules, entities };
  })();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-app-text">{t('review.title')}</h2>
        <p className="mt-0.5 text-sm text-app-text-muted">{t('review.subtitle')}</p>
      </div>

      <div className="rounded-xl border bg-app-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-app-text">{t('review.snapshot')}</div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-app-surface-hover px-2.5 py-0.5 text-xs font-medium text-app-text">
              {t('review.statusLabel', { status: projectStatus })}
            </span>
            <span className="rounded-full bg-app-info-soft px-2.5 py-0.5 text-xs font-medium text-app-accent-dark-blue">
              {t('review.sdfVersion', { version: currentVersion ?? '-' })}
            </span>
          </div>
        </div>

        {checklist.warnings > 0 && (
          <div className="mt-3 rounded-lg border border-app-warning-border bg-app-warning-soft px-3 py-2 text-xs text-app-warning">
            {t('review.warningsPresent', { count: checklist.warnings })}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-app-border bg-app-surface-muted p-3">
          <div className="text-xs font-medium text-app-text-muted">{t('review.requestRevision')}</div>
          <textarea
            rows={3}
            value={revisionInstructions}
            onChange={(event) => setRevisionInstructions(event.target.value)}
            placeholder={t('review.revisionPlaceholder')}
            className="mt-2 w-full rounded-lg border bg-app-surface px-3 py-2 text-sm text-app-text outline-none focus:ring-2 focus:ring-app-focus"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onReject}
              disabled={running}
              className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-app-danger hover:bg-app-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('review.reject')}
            </button>
            <button
              type="button"
              onClick={() => {
                const instruction = revisionInstructions.trim();
                if (!instruction) return;
                onRequestRevision(instruction);
                setRevisionInstructions('');
              }}
              disabled={running || !revisionInstructions.trim()}
              className="rounded-lg border border-app-info-border px-3 py-2 text-xs font-semibold text-app-accent-dark-blue hover:bg-app-info-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('review.requestAiRevision')}
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={running}
              className="rounded-lg bg-app-success px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('review.approve')}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-app-surface p-4">
        <div className="text-sm font-semibold text-app-text">{t('review.historyTitle')}</div>
        {history.length === 0 ? (
          <div className="mt-2 text-xs text-app-text-muted">{t('review.noHistory')}</div>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-app-border bg-app-surface-muted px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-app-text">{ACTION_LABELS[entry.action]}</div>
                  <div className="text-[11px] text-app-text-muted">
                    {new Date(entry.createdAt).toLocaleString(i18n.language)}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-app-text-muted">
                  {t('review.versionStatus', { version: entry.version ?? '-', status: entry.status || '-' })}
                </div>
                {entry.note && <div className="mt-1 text-xs text-app-text">{entry.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
