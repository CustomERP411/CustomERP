// platform/assembler/generators/frontend/hrPages.js

function buildEmployeeListPage({ entity, entityName, importBase, hrConfig, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

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

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get('/${entity.slug}');
        if (!cancelled) {
          setItems(Array.isArray(res.data) ? res.data : []);
        }
      } catch (e) {
        if (!cancelled) toast({ title: 'Failed to load employees', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Manage employee records and information.</p>
        </div>
        <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          New Employee
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          No employees yet. Add your first employee to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((employee) => (
            <Link
              key={String(employee.id)}
              to={'/${entity.slug}/' + employee.id}
              className="rounded-lg border bg-white p-4 shadow-sm hover:shadow"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  {[employee.first_name, employee.last_name].filter(Boolean).join(' ') || employee.id}
                </div>
                <span className={['rounded-full px-2 py-1 text-xs font-semibold', statusClass(String(employee.status || 'Active'))].join(' ')}>
                  {employee.status || 'Active'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>Job Title: {employee.job_title || '—'}</div>
                <div>Email: {employee.email || '—'}</div>
                <div>Phone: {employee.phone || '—'}</div>
                <div>Hire Date: {employee.hire_date || '—'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

function buildDepartmentListPage({ entity, entityName, importBase, hrConfig, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get('/${entity.slug}');
        if (!cancelled) {
          setItems(Array.isArray(res.data) ? res.data : []);
        }
      } catch (e) {
        if (!cancelled) toast({ title: 'Failed to load departments', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Manage organizational departments.</p>
        </div>
        <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          New Department
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          No departments yet. Create your first department to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((dept) => (
            <Link
              key={String(dept.id)}
              to={'/${entity.slug}/' + dept.id}
              className="rounded-lg border bg-white p-4 shadow-sm hover:shadow"
            >
              <div className="text-sm font-semibold text-slate-900">
                {dept.name || dept.id}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>Location: {dept.location || '—'}</div>
                <div>Manager ID: {dept.manager_id || '—'}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

function buildLeaveListPage({ entity, entityName, importBase, hrConfig, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

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

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await api.get('/${entity.slug}');
        if (!cancelled) {
          setItems(Array.isArray(res.data) ? res.data : []);
        }
      } catch (e) {
        if (!cancelled) toast({ title: 'Failed to load leave requests', variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Track and manage employee leave requests.</p>
        </div>
        <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          New Leave Request
        </Link>
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          No leave requests yet. Submit your first leave request to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((leave) => (
            <Link
              key={String(leave.id)}
              to={'/${entity.slug}/' + leave.id}
              className="rounded-lg border bg-white p-4 shadow-sm hover:shadow"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-500">
                  Employee ID: {leave.employee_id || '—'}
                </div>
                <span className={['rounded-full px-2 py-1 text-xs font-semibold', statusClass(String(leave.status || 'Pending'))].join(' ')}>
                  {leave.status || 'Pending'}
                </span>
              </div>
              <div className="mt-2">
                <span className={['inline-block rounded px-2 py-1 text-xs font-semibold', leaveTypeClass(String(leave.leave_type || ''))].join(' ')}>
                  {leave.leave_type || '—'}
                </span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>Start: {leave.start_date || '—'}</div>
                <div>End: {leave.end_date || '—'}</div>
                {leave.reason && <div className="text-xs italic">Reason: {leave.reason}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

module.exports = {
  buildEmployeeListPage,
  buildDepartmentListPage,
  buildLeaveListPage,
};
