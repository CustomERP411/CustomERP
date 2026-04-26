import { Link } from 'react-router-dom';

interface DepartmentCardProps {
  department: Record<string, any>;
  to: string;
}

const displayText = (value: any, fallback = '—') => {
  if (value === undefined || value === null || value === '') return fallback;
  if (Array.isArray(value)) return value.map((v) => displayText(v, '')).filter(Boolean).join(', ') || fallback;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    return String(value.name || value.display_name || value.title || value.id || JSON.stringify(value));
  }
  return String(value);
};

export default function DepartmentCard({ department, to }: DepartmentCardProps) {
  return (
    <Link to={to} className="rounded-lg border bg-white p-4 shadow-sm hover:shadow">
      <div className="text-sm font-semibold text-slate-900">
        {displayText(department?.name || department?.id)}
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div>Location: {displayText(department?.location)}</div>
        <div>Manager ID: {displayText(department?.manager_id)}</div>
      </div>
    </Link>
  );
}
