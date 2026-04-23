import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trainingService, type TrainingStats } from '../../services/trainingService';

const AGENT_TYPES = [
  { id: 'distributor', labelKey: 'exportModal.agents.distributor' },
  { id: 'hr_generator', labelKey: 'exportModal.agents.hr_generator' },
  { id: 'invoice_generator', labelKey: 'exportModal.agents.invoice_generator' },
  { id: 'inventory_generator', labelKey: 'exportModal.agents.inventory_generator' },
  { id: 'chatbot', labelKey: 'exportModal.agents.chatbot' },
];

interface Props {
  stats: TrainingStats | null;
  onClose: () => void;
}

export default function ExportModal({ stats, onClose }: Props) {
  const { t } = useTranslation('admin');
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set(AGENT_TYPES.map(a => a.id)));
  const [qualityFilter, setQualityFilter] = useState<'good' | 'good_and_edited'>('good');
  const [exporting, setExporting] = useState(false);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const previewCount = (() => {
    if (!stats?.by_agent) return 0;
    let count = 0;
    for (const agentId of selectedAgents) {
      const a = stats.by_agent[agentId];
      if (!a) continue;
      count += qualityFilter === 'good' ? a.good : (a.good + a.needs_edit);
    }
    return count;
  })();

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = async () => {
    if (selectedAgents.size === 0) return;
    setExporting(true);
    try {
      const blob = await trainingService.exportAzure({
        agent_types: Array.from(selectedAgents),
        quality_filter: qualityFilter,
      });
      const filename = blob.type.includes('zip') ? 'training_export.zip' : `${Array.from(selectedAgents)[0]}.jsonl`;
      downloadBlob(blob, filename);
      onClose();
    } catch (e: any) {
      alert(e?.message || t('exportModal.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleExportSingle = async (agentId: string) => {
    setExporting(true);
    try {
      const blob = await trainingService.exportAzure({
        agent_types: [agentId],
        quality_filter: qualityFilter,
      });
      downloadBlob(blob, `${agentId}.jsonl`);
    } catch (e: any) {
      alert(e?.message || t('exportModal.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-app-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-app-text mb-4">{t('exportModal.title')}</h2>
        <p className="text-xs text-app-text-muted mb-4">{t('exportModal.subtitle')}</p>

        {/* Quality filter */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-app-text mb-2">{t('exportModal.qualityFilter')}</label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quality_filter"
                checked={qualityFilter === 'good'}
                onChange={() => setQualityFilter('good')}
                className="text-app-accent-blue focus:ring-app-focus"
              />
              {t('exportModal.goodOnly')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quality_filter"
                checked={qualityFilter === 'good_and_edited'}
                onChange={() => setQualityFilter('good_and_edited')}
                className="text-app-accent-blue focus:ring-app-focus"
              />
              {t('exportModal.goodAndEdited')}
            </label>
          </div>
        </div>

        {/* Per-agent export */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-app-text mb-2">{t('exportModal.exportPerAgent')}</label>
          <div className="space-y-1.5">
            {AGENT_TYPES.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-app-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedAgents.has(a.id)}
                    onChange={() => toggleAgent(a.id)}
                    className="rounded border-app-border-strong text-app-accent-blue focus:ring-app-focus"
                  />
                  <span className="text-sm text-app-text">{t(a.labelKey)}</span>
                </div>
                <button
                  onClick={() => handleExportSingle(a.id)}
                  disabled={exporting}
                  className="rounded border border-app-border-strong px-2.5 py-1 text-xs font-medium text-app-text-muted hover:bg-app-surface-muted disabled:opacity-40 transition-colors"
                >
                  {a.id}.jsonl
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Preview count */}
        <div className="mb-5 rounded-lg bg-app-surface-muted p-3 text-sm text-app-text-muted">
          {t('exportModal.estimatedSessions')}: <span className="font-bold text-app-text">{previewCount}</span>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-app-border-strong px-4 py-2 text-sm font-medium text-app-text-muted hover:bg-app-surface-muted transition-colors"
          >
            {t('exportModal.cancel')}
          </button>
          <button
            onClick={handleExportAll}
            disabled={selectedAgents.size === 0 || exporting || previewCount === 0}
            className="rounded-lg bg-app-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-app-accent-dark-blue disabled:opacity-50 transition-colors"
          >
            {exporting ? t('exportModal.exporting') : selectedAgents.size > 1 ? t('exportModal.downloadZip') : t('exportModal.download')}
          </button>
        </div>
      </div>
    </div>
  );
}
