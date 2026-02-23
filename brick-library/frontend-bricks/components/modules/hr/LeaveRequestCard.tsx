import { Link } from 'react-router-dom';

interface LeaveRequestCardProps {
  leave: Record<string, any>;
  to: string;
}

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
          Employee ID: {leave?.employee_id || '—'}
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
        <div>Start: {leave?.start_date || '—'}</div>
        <div>End: {leave?.end_date || '—'}</div>
        {leave?.reason ? <div className="text-xs italic">Reason: {leave.reason}</div> : null}
      </div>
    </Link>
  );
}
