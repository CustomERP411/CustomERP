import { useMemo, useState } from 'react';

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
}

const ACTION_LABELS: Record<ReviewHistoryItem['action'], string> = {
  generated: 'Generated',
  clarified: 'Clarification Applied',
  manual_save: 'Manual Save',
  ai_revision: 'AI Revision',
  approved: 'Approved',
  rejected: 'Rejected',
  revision_requested: 'Revision Requested',
};

export default function ReviewApprovalPanel({
  preview,
  projectStatus,
  currentVersion,
  history,
  running,
  onApprove,
  onReject,
  onRequestRevision,
}: ReviewApprovalPanelProps) {
  const [revisionInstructions, setRevisionInstructions] = useState('');

  const checklist = useMemo(() => {
    const relationCount = Array.isArray(preview.entities)
      ? preview.entities.reduce((acc, entity) => acc + (Array.isArray(entity.relationFields) ? entity.relationFields.length : 0), 0)
      : 0;
    const warnings = Array.isArray(preview.warnings) ? preview.warnings.length : 0;
    const modules = Array.isArray(preview.moduleSummaries) ? preview.moduleSummaries.length : 0;
    const entities = Number(preview.entityCount || 0);
    return { relationCount, warnings, modules, entities };
  }, [preview]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">5. Review & Approval</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Check schema, modules, and relationships before final approval.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-900">Current Build Snapshot</div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              Status: {projectStatus}
            </span>
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              SDF v{currentVersion ?? '-'}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500">Schema Check</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{checklist.entities} entities</div>
            <div className="mt-1 text-xs text-slate-600">
              {checklist.entities > 0 ? 'Entity schema exists and is reviewable.' : 'No entities found in SDF.'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500">Module Check</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{checklist.modules} modules</div>
            <div className="mt-1 text-xs text-slate-600">
              {checklist.modules > 0 ? 'Module capabilities detected.' : 'No active module summary found.'}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-medium text-slate-500">Relation Check</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{checklist.relationCount} links</div>
            <div className="mt-1 text-xs text-slate-600">
              {checklist.relationCount > 0 ? 'Cross-entity links are present.' : 'No explicit relations detected.'}
            </div>
          </div>
        </div>

        {checklist.warnings > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {checklist.warnings} warning(s) are still present in this SDF. Review them before approval.
          </div>
        )}

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-500">Request Revision</div>
          <textarea
            rows={3}
            value={revisionInstructions}
            onChange={(event) => setRevisionInstructions(event.target.value)}
            placeholder="Describe what should be changed before approval..."
            className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onReject}
              disabled={running}
              className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reject
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
              className="rounded-lg border border-indigo-300 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Request AI Revision
            </button>
            <button
              type="button"
              onClick={onApprove}
              disabled={running}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Approve
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold text-slate-900">Revision History</div>
        {history.length === 0 ? (
          <div className="mt-2 text-xs text-slate-500">No revisions tracked yet.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">{ACTION_LABELS[entry.action]}</div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 text-[11px] text-slate-600">
                  SDF v{entry.version ?? '-'} | status: {entry.status || '-'}
                </div>
                {entry.note && <div className="mt-1 text-xs text-slate-700">{entry.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
