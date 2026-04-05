import { Link } from 'react-router-dom';
import type { Project } from '../../types/project';

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
  return (
    <div className="group relative flex flex-col justify-between rounded-xl border bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
      <div>
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status] || 'bg-slate-100 text-slate-700'}`}>
            {project.status}
          </span>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-blue-600">
          <Link to={`/projects/${project.id}`} className="focus:outline-none hover:underline">
            {project.name}
          </Link>
        </h3>

        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{new Date(project.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onDelete?.(project)}
          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
        >
          Delete
        </button>
        <Link to={`/projects/${project.id}`} className="flex items-center gap-1 text-sm font-medium text-blue-600">
          Open Project &rarr;
        </Link>
      </div>
    </div>
  );
}
