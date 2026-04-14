// platform/assembler/generators/frontend/hrPages.js

function buildEmployeeListPage({ entity, entityName, importBase, hrConfig, enableCsvImport, enableCsvExport, fieldDefs, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  const csvFieldNames = fieldDefs
    ? `['id', ${fieldDefs.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import EmployeeCard from '${base}/components/modules/hr/EmployeeCard';

const STATUS_OPTIONS = ['Active', 'On Leave', 'Terminated'];
${enableCsvExport ? `const CSV_HEADERS = ${csvFieldNames};` : ''}

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const filteredItems = statusFilter === 'all' 
    ? items 
    : items.filter((emp) => String(emp?.status || 'Active').toLowerCase().replace(/\\s+/g, '') === statusFilter.toLowerCase().replace(/\\s+/g, ''));

${enableCsvExport ? `  const exportCsv = () => {
    const escape = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [CSV_HEADERS.join(','), ...items.map((r) => CSV_HEADERS.map((h) => escape(r[h])).join(','))];
    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.click(); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Manage employee records and information.</p>
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Import CSV</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Export CSV</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">New Employee</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
        >
          All
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          {statusFilter === 'all' 
            ? 'No employees yet. Add your first employee to get started.' 
            : \`No employees with status "\${statusFilter}".\`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((employee) => (
            <EmployeeCard
              key={String(employee.id)}
              employee={employee}
              to={'/${entity.slug}/' + employee.id + '/edit'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

function buildDepartmentListPage({ entity, entityName, importBase, hrConfig, enableCsvImport, enableCsvExport, fieldDefs, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  const csvFieldNames = fieldDefs
    ? `['id', ${fieldDefs.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import DepartmentCard from '${base}/components/modules/hr/DepartmentCard';

${enableCsvExport ? `const CSV_HEADERS = ${csvFieldNames};` : ''}

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

${enableCsvExport ? `  const exportCsv = () => {
    const escape = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [CSV_HEADERS.join(','), ...items.map((r) => CSV_HEADERS.map((h) => escape(r[h])).join(','))];
    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.click(); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Manage organizational departments.</p>
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Import CSV</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Export CSV</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">New Department</Link>
        </div>
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
              to={'/${entity.slug}/' + dept.id + '/edit'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
`;
}

function buildLeaveListPage({ entity, entityName, importBase, hrConfig, enableCsvImport, enableCsvExport, fieldDefs, title }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;

  const csvFieldNames = fieldDefs
    ? `['id', ${fieldDefs.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import LeaveRequestCard from '${base}/components/modules/hr/LeaveRequestCard';

const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected'];
${enableCsvExport ? `const CSV_HEADERS = ${csvFieldNames};` : ''}

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

  const filteredItems = statusFilter === 'all' 
    ? items 
    : items.filter((leave) => String(leave?.status || 'Pending').toLowerCase() === statusFilter.toLowerCase());

  const pendingCount = items.filter((l) => String(l?.status || 'Pending') === 'Pending').length;

${enableCsvExport ? `  const exportCsv = () => {
    const escape = (v: any) => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [CSV_HEADERS.join(','), ...items.map((r) => CSV_HEADERS.map((h) => escape(r[h])).join(','))];
    const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.click(); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">Track and manage employee leave requests.</p>
          {pendingCount > 0 ? (
            <p className="mt-1 text-sm font-semibold text-amber-700">{pendingCount} pending approval</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Import CSV</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Export CSV</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">New Leave Request</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
        >
          All
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === status ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
          >
            {status}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4">Loading…</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          {statusFilter === 'all' 
            ? 'No leave requests yet. Submit your first leave request to get started.' 
            : \`No leave requests with status "\${statusFilter}".\`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((leave) => (
            <LeaveRequestCard
              key={String(leave.id)}
              leave={leave}
              to={'/${entity.slug}/' + leave.id + '/edit'}
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
