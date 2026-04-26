import { Link } from 'react-router-dom';

interface LeaveRequestCardProps {
  leave: Record<string, any>;
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

const statusClass = (status: string) => {
  switch (status) {
    case 'Approved':
      return 'bg-emerald-100 text-emerald-700';
    case 'Pending':
      return 'bg-amber-100 text-amber-700';
    case 'Rejected':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const leaveTypeClass = (type: string) => {
  switch (type) {
    case 'Vacation':
      return 'bg-blue-50 text-blue-700';
    case 'Sick':
      return 'bg-rose-50 text-rose-700';
    case 'Unpaid':
      return 'bg-slate-50 text-slate-700';
    default:
      return 'bg-slate-50 text-slate-700';
  }
};

export default function LeaveRequestCard({ leave, to }: LeaveRequestCardProps) {
  const status = String(leave?.status || 'Pending');
  const leaveType = String(leave?.leave_type || '');

  return (
    <Link to={to} className="rounded-lg border bg-white p-4 shadow-sm hover:shadow">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500">
          Employee ID: {displayText(leave?.employee_id)}
        </div>
        <span className={['rounded-full px-2 py-1 text-xs font-semibold', statusClass(status)].join(' ')}>
          {status}
        </span>
      </div>
      <div className="mt-2">
        <span className={['inline-block rounded px-2 py-1 text-xs font-semibold', leaveTypeClass(leaveType)].join(' ')}>
          {leaveType || '—'}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        <div>Start: {displayText(leave?.start_date)}</div>
        <div>End: {displayText(leave?.end_date)}</div>
        {leave?.reason ? <div className="text-xs italic">Reason: {displayText(leave.reason)}</div> : null}
      </div>
    </Link>
  );
}
