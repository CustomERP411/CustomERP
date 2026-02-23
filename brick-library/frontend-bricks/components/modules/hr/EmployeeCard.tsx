import { Link } from 'react-router-dom';

interface EmployeeCardProps {
  employee: Record<string, any>;
  to: string;
}

const statusClass = (status: string) => {
  switch (status) {
    case 'Active':
      return 'bg-emerald-100 text-emerald-700';
    case 'On Leave':
      return 'bg-amber-100 text-amber-700';
    case 'Terminated':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

export default function EmployeeCard({ employee, to }: EmployeeCardProps) {
  const status = String(employee?.status || 'Active');
  const name =
    [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') || employee?.id;

  return (
    <Link to={to} className="rounded-lg border bg-white p-4 shadow-sm hover:shadow">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">{name}</div>
        <span className={['rounded-full px-2 py-1 text-xs font-semibold', statusClass(status)].join(' ')}>
          {status}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div>Job Title: {employee?.job_title || '—'}</div>
        <div>Email: {employee?.email || '—'}</div>
        <div>Phone: {employee?.phone || '—'}</div>
        <div>Hire Date: {employee?.hire_date || '—'}</div>
      </div>
    </Link>
  );
}
