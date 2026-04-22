import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../types/project';
import { LANGUAGE_LABELS, normalizeLanguage } from '../../i18n';

interface ProjectCardProps {
  project: Project;
  onDelete?: (project: Project) => void;
}

const STATUS_COLORS = {
  Draft: 'bg-slate-100 text-slate-700',
  Analyzing: 'bg-blue-100 text-blue-700',
  Clarifying: 'bg-amber-100 text-amber-700',
  Ready: 'bg-purple-100 text-purple-700',
  Generated: 'bg-green-100 text-green-700',
  Approved: 'bg-emerald-100 text-emerald-700',
};

export default function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t, i18n } = useTranslation(['projects', 'common']);
  const projectLang = normalizeLanguage(project.language);

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-700'}`}>
            {t(`projects:status.${project.status}`, { defaultValue: project.status })}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600">
            {LANGUAGE_LABELS[projectLang]}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-blue-600">
          <Link to={`/projects/${project.id}`} className="focus:outline-none hover:underline">
            {project.name}
          </Link>
        </h3>

        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
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

      <div className="mt-4 flex items-center justify-between border-t pt-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onDelete?.(project)}
          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
        >
          {t('projects:card.delete')}
        </button>
        <Link to={`/projects/${project.id}`} className="flex items-center gap-1 text-sm font-medium text-blue-600">
          {t('projects:card.open')} &rarr;
        </Link>
      </div>
    </div>
  );
}
