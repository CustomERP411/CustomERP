import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { projectService } from '../services/projectService';
import ProjectCard from '../components/projects/ProjectCard';
import NewProjectModal from '../components/projects/NewProjectModal';
import Button from '../components/ui/Button';
import type { Project } from '../types/project';

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as {
      response?: { data?: { error?: unknown } };
      message?: unknown;
    };
    if (typeof candidate.response?.data?.error === 'string') {
      return candidate.response.data.error;
    }
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
  }
  return fallback;
}

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useTranslation(['projects', 'common', 'errors']);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err) {
      setError(t('errors:generic'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectCreated = (newProject: Project) => {
    setProjects((prev) => [newProject, ...prev]);
  };

  const openDeleteModal = (project: Project) => {
    setProjectToDelete(project);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (deletingProjectId) return;
    setProjectToDelete(null);
    setDeleteConfirmText('');
    setDeleteError('');
  };

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    if (deleteConfirmText.trim() !== projectToDelete.name.trim()) {
      setDeleteError(t('projects:card.confirmDelete'));
      return;
    }

    try {
      setDeletingProjectId(projectToDelete.id);
      setDeleteError('');
      await projectService.deleteProject(projectToDelete.id);
      setProjects((prev) => prev.filter((item) => item.id !== projectToDelete.id));
      setProjectToDelete(null);
      setDeleteConfirmText('');
    } catch (err: unknown) {
      setDeleteError(getErrorMessage(err, t('errors:generic')));
    } finally {
      setDeletingProjectId(null);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{t('projects:title')}</h1>
          <p className="text-slate-500">{t('projects:subtitle')}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
          {t('projects:newProject')}
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
          <div className="rounded-full bg-white p-4 shadow-sm">
            <div className="h-8 w-8 rounded-full bg-slate-100" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">{t('projects:empty.title')}</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm">{t('projects:empty.subtitle')}</p>
          <div className="mt-6">
            <Button onClick={() => setIsModalOpen(true)}>{t('projects:empty.cta')}</Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onDelete={openDeleteModal} />
          ))}
        </div>
      )}

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {projectToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">{t('projects:card.delete')}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {t('projects:card.confirmDelete')}{' '}
              <span className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-900">
                {projectToDelete.name}
              </span>
            </p>
            <input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              className="mt-4 w-full rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
              placeholder={projectToDelete.name}
            />
            {deleteError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {deleteError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={!!deletingProjectId}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void confirmDeleteProject(); }}
                disabled={!!deletingProjectId}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingProjectId ? t('projects:card.deleting') : t('projects:card.delete')}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

