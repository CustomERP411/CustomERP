import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import { normalizeLanguage } from '../../i18n';
import type { Project, ProjectLanguage } from '../../types/project';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export default function NewProjectModal({ isOpen, onClose, onProjectCreated }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation(['projects', 'common']);
  const { user } = useAuth();

  if (!isOpen) return null;

  // Silently inherit the user's preferred language, but show a notice so they know
  // which language the project (and its generated ERP) will be locked to.
  const projectLanguage: ProjectLanguage = normalizeLanguage(user?.preferred_language);
  const languageLabel = t(`projects:card.languages.${projectLanguage}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('projects:newModal.errorName'));
      return;
    }

    try {
      setLoading(true);
      setError('');
      const project = await projectService.createProject({ name, language: projectLanguage });
      onProjectCreated(project);
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || t('projects:newModal.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm !m-0">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900">{t('projects:newModal.title')}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label={t('common:close')}
          >
            <span aria-hidden="true" className="text-2xl leading-none">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('projects:newModal.nameLabel')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projects:newModal.namePlaceholder')}
            required
            autoFocus
          />

          <div className="rounded-md border-l-4 border-blue-500 bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900">
            {t('projects:newModal.languageNotice', { language: languageLabel })}
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              {t('projects:newModal.cancel')}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />}
              {loading ? t('projects:newModal.creating') : t('projects:newModal.create')}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
