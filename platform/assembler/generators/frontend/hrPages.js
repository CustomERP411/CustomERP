// platform/assembler/generators/frontend/hrPages.js

function buildEmployeeListPage({ entity, entityName, importBase, hrConfig, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import EmployeeCard from '${base}/components/modules/hr/EmployeeCard';

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
            <EmployeeCard
              key={String(employee.id)}
              employee={employee}
              to={'/${entity.slug}/' + employee.id}
            />
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
import DepartmentCard from '${base}/components/modules/hr/DepartmentCard';

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
            <DepartmentCard
              key={String(dept.id)}
              department={dept}
              to={'/${entity.slug}/' + dept.id}
            />
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
import LeaveRequestCard from '${base}/components/modules/hr/LeaveRequestCard';

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
            <LeaveRequestCard
              key={String(leave.id)}
              leave={leave}
              to={'/${entity.slug}/' + leave.id}
            />
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
