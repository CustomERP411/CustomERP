import type { Dispatch, SetStateAction } from 'react';
import type { AiGatewaySdf, ClarificationQuestion } from '../../types/aiGateway';
import type { ReviewHistoryItem } from './ReviewApprovalPanel';
import ClarificationQuestionsPanel from './ClarificationQuestions';
import ReviewApprovalPanel from './ReviewApprovalPanel';
import SdfPreviewSection from './SdfPreviewSection';
import { SlideIn } from './projectConstants';

export interface PostGenerationPanelProps {
  sdf: AiGatewaySdf;
  preview: any;

  questions: ClarificationQuestion[];
  answersById: Record<string, string>;
  canSubmitAnswers: boolean;
  clarifying: boolean;
  clarifyRound: number;
  sdfComplete: boolean;
  onSetAnswers: Dispatch<SetStateAction<Record<string, string>>>;
  onSubmitAnswers: () => void;
  onFinalize: () => void;

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
  questions, answersById, canSubmitAnswers, clarifying, clarifyRound, sdfComplete,
  onSetAnswers, onSubmitAnswers, onFinalize,
  projectStatus, sdfVersion, reviewHistory, running,
  onApproveReview, onRejectReview, onRequestRevision,
  onPreview,
  showAdvancedView, onToggleAdvancedView,
  detectedPlatform, standaloneRunning, downloadStarted,
  draftJson, draftError, aiEditText,
  onSaveDraft, onDownloadStandalone, onDownloadZip,
  onApplyAiEdit, onSetAiEditText, onSetDraftJson, onResetDraftJson,
}: PostGenerationPanelProps) {
  return (
    <>
      {(questions.length > 0 || sdfComplete) && (
        <ClarificationQuestionsPanel
          questions={questions} answersById={answersById} canSubmit={canSubmitAnswers}
          running={clarifying} clarifyRound={clarifyRound} sdfComplete={sdfComplete}
          onSetAnswers={onSetAnswers} onSubmit={onSubmitAnswers} onFinalize={onFinalize}
        />
      )}

      {!questions.length && !sdfComplete && (
        <div className="rounded-xl border bg-emerald-50 px-5 py-4">
          <div className="text-sm font-semibold text-emerald-800">No follow-up questions needed</div>
          <div className="mt-0.5 text-xs text-emerald-600">The AI generated a complete ERP setup from your inputs.</div>
        </div>
      )}

      {preview && sdf && (
        <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Your ERP is ready to preview</h3>
              <p className="mt-1 text-sm text-slate-600">
                We built a working version of your system. Preview it live to see how it works, then approve and download.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(preview.enabledModules || []).map((mod: string) => {
              const label = mod.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
              const colors: Record<string, string> = {
                inventory: 'bg-blue-100 text-blue-800 border-blue-200',
                invoice: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                hr: 'bg-violet-100 text-violet-800 border-violet-200',
              };
              return (
                <span key={mod} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${colors[mod] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {label}
                </span>
              );
            })}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {preview.entityCount} {preview.entityCount === 1 ? 'data type' : 'data types'}
            </span>
          </div>

          <button
            type="button"
            onClick={onPreview}
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Preview My ERP
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
            className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
          >
            {showAdvancedView ? 'Hide developer details' : 'Show developer details'}
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
