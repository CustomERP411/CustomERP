export interface BuildModeConfirmDialogProps {
  open: boolean;
  canAnalyze: boolean;
  running: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function BuildModeConfirmDialog({
  open, canAnalyze, running, onClose, onConfirm,
}: BuildModeConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-900">Switch to Build Mode?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Build mode locks in your current answers for SDF generation. You can still switch back to
          chat mode if you want to revise business details before generating.
        </p>
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">Before switching:</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Review the module answers and business questions.</li>
            <li>Confirm your final intent for generation.</li>
            <li>Use Build Mode to enable "Generate My ERP Setup".</li>
          </ul>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Stay in Chat Mode
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canAnalyze || running}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirm & Switch to Build
          </button>
        </div>
      </div>
    </div>
  );
}
