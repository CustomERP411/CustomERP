import { useTranslation } from 'react-i18next';
import type { AiGatewaySdf } from '../../types/aiGateway';
import type { ReviewHistoryItem } from './ReviewApprovalPanel';
import ReviewApprovalPanel from './ReviewApprovalPanel';
import SdfPreviewSection from './SdfPreviewSection';
import { SlideIn } from './projectConstants';

export interface PostGenerationPanelProps {
  sdf: AiGatewaySdf;
  preview: any;

  projectStatus: string;
  sdfVersion: number | null;
  reviewHistory: ReviewHistoryItem[];
  running: boolean;
  onApproveReview: () => void;
  onRejectReview: () => void;
  onRequestRevision: (instructions: string) => void;

  onPreview: () => void;

  showAdvancedView: boolean;
  onToggleAdvancedView: () => void;
  detectedPlatform: string;
  standaloneRunning: string | null;
  downloadStarted: string | null;
  draftJson: string;
  draftError: string;
  aiEditText: string;
  onSaveDraft: () => void;
  onDownloadStandalone: (platform: string) => void;
  onDownloadZip: () => void;
  onApplyAiEdit: () => void;
  onSetAiEditText: (text: string) => void;
  onSetDraftJson: (json: string) => void;
  onResetDraftJson: () => void;
}

export default function PostGenerationPanel({
  sdf, preview,
  projectStatus, sdfVersion, reviewHistory, running,
  onApproveReview, onRejectReview, onRequestRevision,
  onPreview,
  showAdvancedView, onToggleAdvancedView,
  detectedPlatform, standaloneRunning, downloadStarted,
  draftJson, draftError, aiEditText,
  onSaveDraft, onDownloadStandalone, onDownloadZip,
  onApplyAiEdit, onSetAiEditText, onSetDraftJson, onResetDraftJson,
}: PostGenerationPanelProps) {
  const { t } = useTranslation('projectDetail');
  return (
    <>
      {preview && sdf && (
        <section className="rounded-2xl border border-app-success-border bg-app-success-soft p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-app-success-soft flex items-center justify-center">
              <svg className="h-6 w-6 text-app-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-app-text">{t('postGeneration.readyTitle')}</h3>
              <p className="mt-1 text-sm text-app-text-muted">
                {t('postGeneration.readyBody')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(preview.enabledModules || []).map((mod: any, idx: number) => {
              const key = typeof mod === 'string' ? mod : (mod?.title || `mod-${idx}`);
              const label = typeof mod === 'string'
                ? mod.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                : (mod?.title || t('postGeneration.moduleFallback'));
              const colorKey = key.toLowerCase().replace(/\s+/g, '_');
              const colors: Record<string, string> = {
                inventory: 'bg-app-info-soft text-app-info border-app-info-border',
                invoice: 'bg-app-success-soft text-app-success border-app-success-border',
                hr: 'bg-app-mod-hr-soft text-app-mod-hr border-app-mod-hr-border',
              };
              return (
                <span key={key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${colors[colorKey] || 'bg-app-surface-hover text-app-text border-app-border'}`}>
                  {label}
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-app-surface-hover text-app-text-muted border border-app-border">
              {t('postGeneration.dataTypes', { count: preview.entityCount })}
            </span>
          </div>

          <button
            type="button"
            onClick={onPreview}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-app-accent-blue px-8 py-4 text-base font-semibold text-white shadow-lg hover:bg-app-accent-dark-blue hover:shadow-xl transition-all"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            {t('postGeneration.previewBtn')}
          </button>
        </section>
      )}

      {preview && sdf && reviewHistory.length > 0 && (
        <ReviewApprovalPanel
          preview={preview}
          projectStatus={projectStatus}
          currentVersion={sdfVersion}
          history={reviewHistory}
          running={running}
          onApprove={onApproveReview}
          onReject={onRejectReview}
          onRequestRevision={onRequestRevision}
          historyOnly
        />
      )}

      {preview && sdf && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onToggleAdvancedView}
            className="text-xs text-app-text-subtle hover:text-app-text-muted underline underline-offset-2 transition-colors"
          >
            {showAdvancedView ? t('postGeneration.hideDevDetails') : t('postGeneration.showDevDetails')}
          </button>
          <SlideIn show={showAdvancedView} className="mt-4 space-y-8">
            <SdfPreviewSection
              sdf={sdf} preview={preview} detectedPlatform={detectedPlatform}
              running={running} standaloneRunning={standaloneRunning} downloadStarted={downloadStarted}
              draftJson={draftJson} draftError={draftError} aiEditText={aiEditText}
              onSaveDraft={onSaveDraft} onDownloadStandalone={onDownloadStandalone} onDownloadZip={onDownloadZip}
              onApplyAiEdit={onApplyAiEdit} onSetAiEditText={onSetAiEditText} onSetDraftJson={onSetDraftJson}
              onResetDraftJson={onResetDraftJson}
            />
          </SlideIn>
        </div>
      )}
    </>
  );
}
