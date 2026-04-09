import { MOD_STYLES } from './projectConstants';
import type { AiGatewaySdf } from '../../types/aiGateway';

export interface ModuleSummaryItem {
  key: string;
  label: string;
  caps: { label: string; enabled: boolean }[];
  config: Record<string, string>;
}

export interface PrefilledConfigSummaryProps {
  moduleSummary: ModuleSummaryItem[];
  showJson: boolean;
  prefilledSdf: AiGatewaySdf | null;
  onToggleJson: () => void;
}

export default function PrefilledConfigSummary({
  moduleSummary, showJson, prefilledSdf, onToggleJson,
}: PrefilledConfigSummaryProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Your ERP Configuration</h3>
          <p className="mt-0.5 text-xs text-slate-500">Auto-generated from your answers above. This is sent as a starting point for AI.</p>
        </div>
        <button type="button" onClick={onToggleJson} className="text-xs text-slate-500 underline hover:text-slate-700">
          {showJson ? 'Hide JSON' : 'Show JSON'}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {moduleSummary.map((ms) => {
          const styles = MOD_STYLES[ms.key] || MOD_STYLES.shared;
          return (
            <div key={ms.key} className={`rounded-xl border bg-white p-4 ${styles.left}`}>
              <div className="text-sm font-semibold text-slate-900">{ms.label}</div>
              {Object.entries(ms.config).length > 0 && (
                <div className="mt-2 space-y-1">{Object.entries(ms.config).map(([k, v]) => <div key={k} className="text-xs text-slate-600"><span className="font-medium">{k}:</span> {v}</div>)}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ms.caps.map((c) => <span key={c.label} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{c.label}</span>)}
              </div>
            </div>
          );
        })}
      </div>
      {showJson && <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(prefilledSdf, null, 2)}</pre>}
    </section>
  );
}
