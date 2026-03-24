function buildLeaveApprovalsPage({ entity, entityName, importBase, leaveCfg, approvalCfg }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const LEAVE_CFG = ${JSON.stringify(leaveCfg || {}, null, 2)} as const;
const APPROVAL_CFG = ${JSON.stringify(approvalCfg || {}, null, 2)} as const;

const STATUS_FIELD = APPROVAL_CFG.status_field || LEAVE_CFG.status_field || 'status';
const EMPLOYEE_FIELD = LEAVE_CFG.employee_field || 'employee_id';
const TYPE_FIELD = LEAVE_CFG.leave_type_field || 'leave_type';
const START_FIELD = LEAVE_CFG.start_date_field || 'start_date';
const END_FIELD = LEAVE_CFG.end_date_field || 'end_date';
const DAYS_FIELD = LEAVE_CFG.days_field || 'leave_days';
const APPROVER_FIELD = APPROVAL_CFG.approver_field || 'approver_id';

export default function ${entityName}ApprovalsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [showAll, setShowAll] = useState(false);

  const fetchRows = async () => {
    try {
      const params = showAll ? {} : { [STATUS_FIELD]: 'Pending' };
      const res = await api.get('/' + ENTITY_SLUG, { params });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      toast({ title: 'Failed to load requests', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [showAll]);

  const pendingCount = useMemo(
    () => rows.filter((x) => String(x?.[STATUS_FIELD] || '').toLowerCase() === 'pending').length,
    [rows]
  );

  const runDecision = async (id: string, action: 'approve' | 'reject' | 'cancel') => {
    if (!id) return;
    const label = action.charAt(0).toUpperCase() + action.slice(1);
    const reason =
      action === 'reject'
        ? (window.prompt('Optional rejection reason:') || '').trim()
        : '';
    if (!confirm(label + ' selected leave request?')) return;

    setWorkingId(id);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + id + '/' + action, {
        [APPROVER_FIELD]: 'manager',
        reason: reason || undefined,
        decision_key: action + '-' + id,
      });
      toast({ title: 'Leave request ' + label.toLowerCase() + 'd', variant: 'success' });
      await fetchRows();
    } catch (error: any) {
      toast({ title: label + ' failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Approvals</h1>
          <p className="text-sm text-slate-600">Review requests, approve/reject, and keep approval audit fields consistent.</p>
          <p className="mt-1 text-sm font-semibold text-amber-700">Pending: {pendingCount}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {showAll ? 'Show Pending Only' : 'Show All Statuses'}
          </button>
          <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            Back to ${entityName}
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500">No leave requests to review.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Days</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const id = String(row?.id || '');
                  const status = String(row?.[STATUS_FIELD] || 'Pending');
                  const isPending = status.toLowerCase() === 'pending';
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2">{String(row?.[EMPLOYEE_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[TYPE_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[START_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[END_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[DAYS_FIELD] ?? '—')}</td>
                      <td className="px-3 py-2">
                        <span className={status === 'Approved' ? 'rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700' : status === 'Rejected' ? 'rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700' : 'rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700'}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-3">
                          {isPending ? (
                            <>
                              <button type="button" onClick={() => runDecision(id, 'approve')} disabled={workingId === id} className="text-emerald-700 hover:underline disabled:opacity-50">Approve</button>
                              <button type="button" onClick={() => runDecision(id, 'reject')} disabled={workingId === id} className="text-rose-700 hover:underline disabled:opacity-50">Reject</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => runDecision(id, 'cancel')} disabled={workingId === id} className="text-slate-600 hover:underline disabled:opacity-50">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

function buildLeaveBalancesPage({ entity, entityName, importBase, leaveCfg }) {
  const base = importBase || '..';
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const EMPLOYEE_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(leaveCfg || {}, null, 2)} as const;

const LEAVE_TYPE_FIELD = CFG.leave_type_field || 'leave_type';
const YEAR_FIELD = CFG.fiscal_year_field || 'year';
const AVAILABLE_FIELD = CFG.available_field || 'available_days';
const ACCRUED_FIELD = CFG.accrued_field || 'accrued_days';
const CONSUMED_FIELD = CFG.consumed_field || 'consumed_days';

export default function ${entityName}BalancesPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState({
    leaveType: 'Annual',
    year: String(new Date().getFullYear()),
    amount: '',
    note: '',
  });

  const selectedEmployee = useMemo(
    () => employees.find((x) => String(x.id) === String(selectedId)) || null,
    [employees, selectedId]
  );

  const fetchEmployees = async () => {
    const res = await api.get('/' + EMPLOYEE_SLUG);
    const rows = Array.isArray(res.data) ? res.data : [];
    setEmployees(rows);
    if (!selectedId && rows.length) setSelectedId(String(rows[0].id));
  };

  const fetchBalances = async (employeeId: string) => {
    if (!employeeId) {
      setBalances([]);
      return;
    }
    const res = await api.get('/' + EMPLOYEE_SLUG + '/' + employeeId + '/leave-balance');
    const rows = Array.isArray(res.data) ? res.data : [];
    setBalances(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchEmployees();
      } catch (error: any) {
        toast({ title: 'Failed to load employees', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchBalances(selectedId).catch((error: any) => {
      toast({ title: 'Failed to load leave balances', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    });
  }, [selectedId]);

  const runBalanceAction = async (action: 'accrue' | 'adjust') => {
    if (!selectedId) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      toast({ title: 'Amount must be non-zero', variant: 'warning' });
      return;
    }
    setWorking(true);
    try {
      await api.post('/' + EMPLOYEE_SLUG + '/' + selectedId + '/leave-balance/' + action, {
        leave_type: form.leaveType,
        year: form.year,
        amount,
        note: form.note || undefined,
      });
      toast({ title: action === 'accrue' ? 'Balance accrued' : 'Balance adjusted', variant: 'success' });
      setForm((prev) => ({ ...prev, amount: '', note: '' }));
      await fetchBalances(selectedId);
    } catch (error: any) {
      toast({ title: action === 'accrue' ? 'Accrual failed' : 'Adjustment failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Balances</h1>
          <p className="text-sm text-slate-600">Manage accrual and manual adjustments for employee leave balances.</p>
        </div>
        <Link to={'/' + EMPLOYEE_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          Back to ${entityName}
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">Employee</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2">
          {!employees.length && <option value="">No employees</option>}
          {employees.map((emp) => (
            <option key={String(emp.id)} value={String(emp.id)}>
              {String(emp.first_name || '')} {String(emp.last_name || '')} ({String(emp.id)})
            </option>
          ))}
        </select>
        {selectedEmployee ? (
          <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Selected: {String(selectedEmployee.first_name || '')} {String(selectedEmployee.last_name || '')}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Accrue / Adjust</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={form.leaveType}
            onChange={(e) => setForm((prev) => ({ ...prev, leaveType: e.target.value }))}
            placeholder="Leave type"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={form.year}
            onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
            placeholder="Year"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder="Amount (+/-)"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder="Note"
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => runBalanceAction('accrue')} disabled={!selectedId || working} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            Accrue
          </button>
          <button type="button" onClick={() => runBalanceAction('adjust')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            Adjust
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Current Balances</h2>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : balances.length === 0 ? (
          <div className="text-sm text-slate-500">No balances found for selected employee.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Year</th>
                  <th className="px-3 py-2 text-left">Accrued</th>
                  <th className="px-3 py-2 text-left">Consumed</th>
                  <th className="px-3 py-2 text-left">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {balances.map((row) => (
                  <tr key={String(row.id)}>
                    <td className="px-3 py-2">{String(row?.[LEAVE_TYPE_FIELD] || '—')}</td>
                    <td className="px-3 py-2">{String(row?.[YEAR_FIELD] || '—')}</td>
                    <td className="px-3 py-2">{String(row?.[ACCRUED_FIELD] ?? 0)}</td>
                    <td className="px-3 py-2">{String(row?.[CONSUMED_FIELD] ?? 0)}</td>
                    <td className="px-3 py-2 font-semibold text-emerald-700">{String(row?.[AVAILABLE_FIELD] ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

function buildAttendanceEntriesPage({ entity, entityName, importBase, attendanceCfg }) {
  const base = importBase || '..';
  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(attendanceCfg || {}, null, 2)} as const;

const EMPLOYEE_ENTITY = CFG.employee_entity || 'employees';
const EMPLOYEE_FIELD = CFG.attendance_employee_field || 'employee_id';
const DATE_FIELD = CFG.attendance_date_field || 'work_date';
const CHECKIN_FIELD = CFG.check_in_field || 'check_in_at';
const CHECKOUT_FIELD = CFG.check_out_field || 'check_out_at';
const HOURS_FIELD = CFG.worked_hours_field || 'worked_hours';
const STATUS_FIELD = CFG.attendance_status_field || 'status';

export default function ${entityName}AttendancePage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');
  const [form, setForm] = useState({
    employeeId: '',
    workDate: new Date().toISOString().slice(0, 10),
    checkInAt: '',
    checkOutAt: '',
    status: 'Present',
    note: '',
  });

  const fetchAll = async () => {
    const [empRes, attendanceRes] = await Promise.all([
      api.get('/' + EMPLOYEE_ENTITY),
      api.get('/' + ENTITY_SLUG),
    ]);
    const empRows = Array.isArray(empRes.data) ? empRes.data : [];
    const attendanceRows = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
    setEmployees(empRows);
    setRows(attendanceRows);
    if (!form.employeeId && empRows.length) {
      setForm((prev) => ({ ...prev, employeeId: String(empRows[0].id) }));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchAll();
      } catch (error: any) {
        toast({ title: 'Failed to load attendance context', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recordAttendance = async () => {
    if (!form.employeeId) {
      toast({ title: 'Select employee first', variant: 'warning' });
      return;
    }
    setWorkingId('record');
    try {
      await api.post('/' + ENTITY_SLUG + '/record', {
        [EMPLOYEE_FIELD]: form.employeeId,
        [DATE_FIELD]: form.workDate,
        [CHECKIN_FIELD]: form.checkInAt || undefined,
        [CHECKOUT_FIELD]: form.checkOutAt || undefined,
        [STATUS_FIELD]: form.status || undefined,
        note: form.note || undefined,
      });
      toast({ title: 'Attendance recorded', variant: 'success' });
      setForm((prev) => ({ ...prev, checkInAt: '', checkOutAt: '', note: '' }));
      await fetchAll();
    } catch (error: any) {
      toast({ title: 'Attendance record failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorkingId('');
    }
  };

  const recalculate = async (id: string) => {
    if (!id) return;
    setWorkingId(id);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + id + '/recalculate', {});
      toast({ title: 'Attendance recomputed', variant: 'success' });
      await fetchAll();
    } catch (error: any) {
      toast({ title: 'Recompute failed', description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Entries</h1>
          <p className="text-sm text-slate-600">Capture attendance and keep timesheets synced from worked hours.</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          Back to ${entityName}
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Record Attendance</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            {!employees.length && <option value="">No employees</option>}
            {employees.map((emp) => (
              <option key={String(emp.id)} value={String(emp.id)}>
                {String(emp.first_name || '')} {String(emp.last_name || '')}
              </option>
            ))}
          </select>
          <input type="date" value={form.workDate} onChange={(e) => setForm((prev) => ({ ...prev, workDate: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="Half Day">Half Day</option>
            <option value="On Leave">On Leave</option>
          </select>
          <input type="datetime-local" value={form.checkInAt} onChange={(e) => setForm((prev) => ({ ...prev, checkInAt: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
          <input type="datetime-local" value={form.checkOutAt} onChange={(e) => setForm((prev) => ({ ...prev, checkOutAt: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
          <input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Note (optional)" className="rounded border px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={recordAttendance} disabled={workingId === 'record'} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            Record
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent Entries</h2>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500">No attendance entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Check In</th>
                  <th className="px-3 py-2 text-left">Check Out</th>
                  <th className="px-3 py-2 text-left">Worked Hours</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const id = String(row?.id || '');
                  return (
                    <tr key={id}>
                      <td className="px-3 py-2">{String(row?.[EMPLOYEE_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[DATE_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[CHECKIN_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[CHECKOUT_FIELD] || '—')}</td>
                      <td className="px-3 py-2">{String(row?.[HOURS_FIELD] ?? 0)}</td>
                      <td className="px-3 py-2">{String(row?.[STATUS_FIELD] || '—')}</td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => recalculate(id)} disabled={workingId === id} className="text-blue-600 hover:underline disabled:opacity-50">
                          Recalculate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
`;
}

module.exports = {
  buildLeaveApprovalsPage,
  buildLeaveBalancesPage,
  buildAttendanceEntriesPage,
};
