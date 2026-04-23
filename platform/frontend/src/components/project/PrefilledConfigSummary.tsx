import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('projectDetail');
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-app-text">{t('prefilledConfig.title')}</h3>
          <p className="mt-0.5 text-xs text-app-text-muted">{t('prefilledConfig.subtitle')}</p>
        </div>
        <button type="button" onClick={onToggleJson} className="shrink-0 text-xs text-app-text-muted underline hover:text-app-text">
          {showJson ? t('prefilledConfig.hideJson') : t('prefilledConfig.showJson')}
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {moduleSummary.map((ms) => {
          const styles = MOD_STYLES[ms.key] || MOD_STYLES.shared;
          return (
            <div key={ms.key} className={`rounded-xl border bg-app-surface p-4 ${styles.left}`}>
              <div className="text-sm font-semibold text-app-text">{ms.label}</div>
              {Object.entries(ms.config).length > 0 && (
                <div className="mt-2 space-y-1">{Object.entries(ms.config).map(([k, v]) => <div key={k} className="text-xs text-app-text-muted"><span className="font-medium">{k}:</span> {v}</div>)}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {ms.caps.map((c) => <span key={c.label} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.enabled ? 'bg-app-success-soft text-app-success' : 'bg-app-surface-hover text-app-text-subtle'}`}>{c.label}</span>)}
              </div>
            </div>
          );
        })}
      </div>
      {showJson && <pre className="max-h-64 overflow-auto rounded-lg bg-app-surface-muted p-3 text-xs text-app-text">{JSON.stringify(prefilledSdf, null, 2)}</pre>}
    </section>
  );
}
