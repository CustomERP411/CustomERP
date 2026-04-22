import { useTranslation } from 'react-i18next';
import { useModuleMeta, MODULE_KEYS, MOD_STYLES, MODULE_ICONS, IconCheck } from './projectConstants';

export interface ModuleSelectorProps {
  selectedModules: string[];
  onToggleModule: (key: string) => void;
}

export default function ModuleSelector({ selectedModules, onToggleModule }: ModuleSelectorProps) {
  const { t } = useTranslation('projectDetail');
  const MODULE_META = useModuleMeta();
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{t('moduleSelector.title')}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{t('moduleSelector.subtitle')}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {MODULE_KEYS.map((key) => {
          const meta = MODULE_META[key]; const styles = MOD_STYLES[key]; const selected = selectedModules.includes(key);
          const Ico = MODULE_ICONS[key];
          return (
            <button key={key} type="button" onClick={() => onToggleModule(key)}
              className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all ${selected ? styles.sel : styles.unsel}`}>
              {selected && <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"><IconCheck className="h-3 w-3" /></div>}
              <div className={styles.icon}><Ico /></div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                <div className="mt-0.5 text-xs text-slate-500">{meta.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
