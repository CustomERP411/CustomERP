import { createPortal } from 'react-dom';

interface GenerationModalProps {
  phase: string;
  result: 'success' | 'error' | null;
  errorMessage: string;
  onClose: () => void;
}

export default function GenerationModal({ phase, result, errorMessage, onClose }: GenerationModalProps) {
  if (!phase && !result) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-900/60 backdrop-blur-sm pt-32 px-4 !m-0">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl text-center">

        {/* Loading state */}
        {!result && (
          <>
            <div className="mx-auto mb-5 h-14 w-14 flex items-center justify-center">
              <svg className="h-14 w-14 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Generating Your ERP</h3>
            <p className="mt-2 text-sm text-slate-500 transition-all duration-300">{phase}</p>
          </>
        )}

        {/* Success state */}
        {result === 'success' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg className="h-9 w-9 text-emerald-600 animate-[checkPop_0.4s_ease-out]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" className="animate-[checkDraw_0.5s_ease-out]" style={{ strokeDasharray: 30, strokeDashoffset: 0 }} />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">ERP Generated Successfully</h3>
            <p className="mt-2 text-sm text-slate-500">Your ERP configuration is ready.</p>
          </>
        )}

        {/* Error state */}
        {result === 'error' && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-9 w-9 text-red-600 animate-[checkPop_0.4s_ease-out]" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Generation Failed</h3>
            <p className="mt-2 text-sm text-slate-500">{errorMessage}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </>
        )}
      </div>

      {/* Keyframe animations injected as a style tag */}
      <style>{`
        @keyframes checkPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkDraw {
          0% { stroke-dashoffset: 30; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>,
    document.body,
  );
}
