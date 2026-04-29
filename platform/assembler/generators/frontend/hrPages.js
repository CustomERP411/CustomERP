// platform/assembler/generators/frontend/hrPages.js
const { tFor } = require('../../i18n/labels');

function _hrLabels(language) {
  const t = tFor(language || 'en');
  return {
    importCsv: t('list.importCsv'),
    exportCsv: t('list.exportCsv'),
    loading: t('common.loading'),
    filterAll: t('hrPages.filterAll'),
    filterPending: t('hrPages.filterPending'),
    filterApproved: t('hrPages.filterApproved'),
    filterRejected: t('hrPages.filterRejected'),
  };
}

function buildEmployeeListPage({ entity, entityName, importBase, hrConfig, enableCsvImport, enableCsvExport, fieldDefs, title, language = 'en' }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;
  const fields = Array.isArray(fieldDefs) ? fieldDefs : [];
  const t = tFor(language);
  const I18N = {
    subtitle: t('hrPages.employeesSubtitle'),
    importCsv: t('list.importCsv'),
    exportCsv: t('list.exportCsv'),
    newEmployee: t('hrPages.newEmployee'),
    statusActive: t('hrPages.statusActive'),
    statusOnLeave: t('hrPages.statusOnLeave'),
    statusTerminated: t('hrPages.statusTerminated'),
    filterAll: t('hrPages.filterAll'),
    loading: t('common.loading'),
    emptyAll: t('hrPages.employeesEmptyAll'),
    emptyFilter: t('hrPages.employeesEmptyFilter'),
    loadFailed: t('hrPages.employeesLoadFailed'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);

  const csvFieldNames = fields.length
    ? `['id', ${fields.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import EmployeeCard from '${base}/components/modules/hr/EmployeeCard';

const STATUS_OPTIONS = [
  { key: 'Active', label: ${JSON.stringify(I18N.statusActive)} },
  { key: 'On Leave', label: ${JSON.stringify(I18N.statusOnLeave)} },
  { key: 'Terminated', label: ${JSON.stringify(I18N.statusTerminated)} },
];
const I18N = ${i18nJson} as const;
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
        if (!cancelled) toast({ title: I18N.loadFailed, variant: 'error' });
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.importCsv}</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.exportCsv}</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{I18N.newEmployee}</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
        >
          {I18N.filterAll}
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status.key}
            onClick={() => setStatusFilter(status.key)}
            className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === status.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4">{I18N.loading}</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          {statusFilter === 'all' 
            ? I18N.emptyAll
            : \`\${I18N.emptyFilter} "\${statusFilter}".\`}
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

function buildDepartmentListPage({ entity, entityName, importBase, hrConfig, enableCsvImport, enableCsvExport, fieldDefs, title, language = 'en' }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;
  const fields = Array.isArray(fieldDefs) ? fieldDefs : [];
  const t = tFor(language);
  const I18N = {
    subtitle: t('hrPages.departmentsSubtitle'),
    importCsv: t('list.importCsv'),
    exportCsv: t('list.exportCsv'),
    newDepartment: t('hrPages.newDepartment'),
    loading: t('common.loading'),
    empty: t('hrPages.departmentsEmpty'),
    loadFailed: t('hrPages.departmentsLoadFailed'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);

  const csvFieldNames = fields.length
    ? `['id', ${fields.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import DepartmentCard from '${base}/components/modules/hr/DepartmentCard';

const I18N = ${i18nJson} as const;
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
        if (!cancelled) toast({ title: I18N.loadFailed, variant: 'error' });
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.importCsv}</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.exportCsv}</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{I18N.newDepartment}</Link>
        </div>
      </div>

      {loading ? (
        <div className="p-4">{I18N.loading}</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          {I18N.empty}
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

function buildLeaveListPage({ entity, entityName, importBase, hrConfig, enableCsvImport, enableCsvExport, fieldDefs, title, language = 'en' }) {
  const base = importBase || '..';
  const config = hrConfig && typeof hrConfig === 'object' ? hrConfig : {};
  const pageTitle = title || entityName;
  const fields = Array.isArray(fieldDefs) ? fieldDefs : [];
  const t = tFor(language);
  const I18N = {
    subtitle: t('hrPages.leaveSubtitle'),
    importCsv: t('list.importCsv'),
    exportCsv: t('list.exportCsv'),
    newRequest: t('hrPages.newLeaveRequest'),
    pendingApproval: t('hrPages.leavePendingApproval'),
    filterAll: t('hrPages.filterAll'),
    filterPending: t('hrPages.filterPending'),
    filterApproved: t('hrPages.filterApproved'),
    filterRejected: t('hrPages.filterRejected'),
    loading: t('common.loading'),
    emptyAll: t('hrPages.leaveEmptyAll'),
    emptyFilter: t('hrPages.leaveEmptyFilter'),
    loadFailed: t('hrPages.leaveLoadFailed'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);

  const csvFieldNames = fields.length
    ? `['id', ${fields.map((f) => `'${f.name}'`).join(', ')}]`
    : `['id']`;

  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';
import LeaveRequestCard from '${base}/components/modules/hr/LeaveRequestCard';

const STATUS_OPTIONS = [
  { key: 'Pending', label: ${JSON.stringify(I18N.filterPending)} },
  { key: 'Approved', label: ${JSON.stringify(I18N.filterApproved)} },
  { key: 'Rejected', label: ${JSON.stringify(I18N.filterRejected)} },
];
const I18N = ${i18nJson} as const;
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
        if (!cancelled) toast({ title: I18N.loadFailed, variant: 'error' });
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '${entity.slug}.csv'; a.style.display = 'none'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };` : ''}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${pageTitle}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
          {pendingCount > 0 ? (
            <p className="mt-1 text-sm font-semibold text-amber-700">{pendingCount} {I18N.pendingApproval}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
${enableCsvImport ? `          <Link to="/${entity.slug}/import" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.importCsv}</Link>` : ''}
${enableCsvExport ? `          <button onClick={exportCsv} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">{I18N.exportCsv}</button>` : ''}
          <Link to="/${entity.slug}/new" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">{I18N.newRequest}</Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
        >
          {I18N.filterAll}
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status.key}
            onClick={() => setStatusFilter(status.key)}
            className={\`rounded-lg px-3 py-2 text-sm font-semibold \${statusFilter === status.key ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}\`}
          >
            {status.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-4">{I18N.loading}</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-10 text-center text-sm text-slate-500">
          {statusFilter === 'all' 
            ? I18N.emptyAll
            : \`\${I18N.emptyFilter} "\${statusFilter}".\`}
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
