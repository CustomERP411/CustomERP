import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/project';
import { normalizeLanguage } from '../../i18n';

interface ProjectCardProps {
  project: Project;
  onDelete?: (project: Project) => void;
}

const STATUS_COLORS: Record<Project['status'], string> = {
  Draft:      'bg-app-surface-hover text-app-text-muted',
  Analyzing:  'bg-app-info-soft text-app-info',
  Clarifying: 'bg-app-warning-soft text-app-warning',
  Ready:      'bg-app-mod-hr-soft text-app-mod-hr',
  Generated:  'bg-app-mod-invoice-soft text-app-mod-invoice',
  Approved:   'bg-app-success-soft text-app-success',
};

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t, i18n } = useTranslation(['projects', 'common']);
  const projectLang = normalizeLanguage(project.language);

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-app-border bg-app-surface p-5 shadow-sm transition-all hover:border-app-accent-blue/40 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status] || 'bg-app-surface-hover text-app-text-muted'}`}>
            {t(`projects:status.${project.status}`, { defaultValue: project.status })}
          </span>
          <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-app-text-muted">
            {t(`projects:card.languages.${projectLang}`)}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-app-text group-hover:text-app-accent-blue truncate">
          <Link to={`/projects/${project.id}`} className="focus:outline-none hover:underline block truncate" title={project.name}>
            {project.name}
          </Link>
        </h3>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-app-text-muted">
          <div className="flex items-center gap-1">
            <span>{new Date(project.created_at).toLocaleDateString(i18n.language)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>
              {new Date(project.updated_at).toLocaleTimeString(i18n.language, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-app-border pt-3 transition-opacity opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onDelete?.(project)}
          className="text-xs font-semibold text-app-danger hover:opacity-80"
        >
          {t('projects:card.delete')}
        </button>
        <Link to={`/projects/${project.id}`} className="flex items-center gap-1 text-sm font-medium text-app-accent-blue">
          {t('projects:card.open')} &rarr;
        </Link>
      </div>
    </div>
  );
}
