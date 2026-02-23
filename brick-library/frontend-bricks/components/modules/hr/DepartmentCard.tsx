import { Link } from 'react-router-dom';

interface DepartmentCardProps {
  department: Record<string, any>;
  to: string;
}

export default function DepartmentCard({ department, to }: DepartmentCardProps) {
  return (
    <Link to={to} className="rounded-lg border bg-white p-4 shadow-sm hover:shadow">
      <div className="text-sm font-semibold text-slate-900">
        {department?.name || department?.id}
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div>Location: {department?.location || '—'}</div>
        <div>Manager ID: {department?.manager_id || '—'}</div>
      </div>
    </Link>
  );
}
