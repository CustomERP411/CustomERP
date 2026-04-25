const { tFor } = require('../../i18n/labels');

function buildLeaveApprovalsPage({ entity, entityName, importBase, leaveCfg, approvalCfg, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const I18N = {
    title: t('leaveApprovals.title'),
    subtitle: t('leaveApprovals.subtitle'),
    pending: t('leaveApprovals.pending'),
    showPendingOnly: t('leaveApprovals.showPendingOnly'),
    showAllStatuses: t('leaveApprovals.showAllStatuses'),
    backTo: t('leaveApprovals.backTo').replace('{{entity}}', entityName),
    noRequests: t('leaveApprovals.noRequests'),
    loading: t('common.loading'),
    loadFailed: t('leaveApprovals.loadFailed'),
    approved: t('leaveApprovals.approved'),
    rejected: t('leaveApprovals.rejected'),
    cancelled: t('leaveApprovals.cancelled'),
    rejectionPrompt: t('leaveApprovals.rejectionPrompt'),
    columnEmployee: t('leaveApprovals.columns.employee'),
    columnType: t('leaveApprovals.columns.type'),
    columnStart: t('leaveApprovals.columns.start'),
    columnEnd: t('leaveApprovals.columns.end'),
    columnDays: t('leaveApprovals.columns.days'),
    columnStatus: t('leaveApprovals.columns.status'),
    columnActions: t('leaveApprovals.columns.actions'),
    actionApprove: t('leaveApprovals.actions.approve'),
    actionReject: t('leaveApprovals.actions.reject'),
    actionCancel: t('leaveApprovals.actions.cancel'),
    confirmApprove: t('leaveApprovals.confirmDecision').replace('{{action}}', t('leaveApprovals.actions.approve')),
    confirmReject: t('leaveApprovals.confirmDecision').replace('{{action}}', t('leaveApprovals.actions.reject')),
    confirmCancel: t('leaveApprovals.confirmDecision').replace('{{action}}', t('leaveApprovals.actions.cancel')),
    approveFailed: t('leaveApprovals.actionFailed').replace('{{action}}', t('leaveApprovals.actions.approve')),
    rejectFailed: t('leaveApprovals.actionFailed').replace('{{action}}', t('leaveApprovals.actions.reject')),
    cancelFailed: t('leaveApprovals.actionFailed').replace('{{action}}', t('leaveApprovals.actions.cancel')),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const LEAVE_CFG = ${JSON.stringify(leaveCfg || {}, null, 2)} as const;
const APPROVAL_CFG = ${JSON.stringify(approvalCfg || {}, null, 2)} as const;
const I18N = ${i18nJson} as const;

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
      toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
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
    const reason =
      action === 'reject'
        ? (window.prompt(I18N.rejectionPrompt) || '').trim()
        : '';
    const confirmMsg = action === 'approve' ? I18N.confirmApprove : action === 'reject' ? I18N.confirmReject : I18N.confirmCancel;
    if (!confirm(confirmMsg)) return;

    setWorkingId(id);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + id + '/' + action, {
        [APPROVER_FIELD]: 'manager',
        reason: reason || undefined,
        decision_key: action + '-' + id,
      });
      const successMsg = action === 'approve' ? I18N.approved : action === 'reject' ? I18N.rejected : I18N.cancelled;
      toast({ title: successMsg, variant: 'success' });
      await fetchRows();
    } catch (error: any) {
      const failMsg = action === 'approve' ? I18N.approveFailed : action === 'reject' ? I18N.rejectFailed : I18N.cancelFailed;
      toast({ title: failMsg, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
          <p className="mt-1 text-sm font-semibold text-amber-700">{I18N.pending}: {pendingCount}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            {showAll ? I18N.showPendingOnly : I18N.showAllStatuses}
          </button>
          <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
            {I18N.backTo}
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        {loading ? (
          <div className="text-sm text-slate-500">{I18N.loading}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500">{I18N.noRequests}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">{I18N.columnEmployee}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnType}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnStart}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnEnd}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnDays}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnStatus}</th>
                  <th className="px-3 py-2 text-right">{I18N.columnActions}</th>
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
                              <button type="button" onClick={() => runDecision(id, 'approve')} disabled={workingId === id} className="text-emerald-700 hover:underline disabled:opacity-50">{I18N.actionApprove}</button>
                              <button type="button" onClick={() => runDecision(id, 'reject')} disabled={workingId === id} className="text-rose-700 hover:underline disabled:opacity-50">{I18N.actionReject}</button>
                            </>
                          ) : (
                            <button type="button" onClick={() => runDecision(id, 'cancel')} disabled={workingId === id} className="text-slate-600 hover:underline disabled:opacity-50">{I18N.actionCancel}</button>
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

function buildLeaveBalancesPage({ entity, entityName, importBase, leaveCfg, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const I18N = {
    title: t('leaveBalances.title'),
    subtitle: t('leaveBalances.subtitle'),
    backTo: t('leaveBalances.backTo').replace('{{entity}}', entityName),
    employee: t('leaveBalances.employee'),
    noEmployees: t('leaveBalances.noEmployees'),
    selected: t('leaveBalances.selected'),
    accrueAdjustHeading: t('leaveBalances.accrueAdjustHeading'),
    leaveTypePlaceholder: t('leaveBalances.leaveTypePlaceholder'),
    yearPlaceholder: t('leaveBalances.yearPlaceholder'),
    amountPlaceholder: t('leaveBalances.amountPlaceholder'),
    notePlaceholder: t('leaveBalances.notePlaceholder'),
    accrue: t('leaveBalances.accrue'),
    adjust: t('leaveBalances.adjust'),
    currentHeading: t('leaveBalances.currentHeading'),
    noBalances: t('leaveBalances.noBalances'),
    loading: t('common.loading'),
    amountMustBeNonZero: t('leaveBalances.amountMustBeNonZero'),
    accrued: t('leaveBalances.accrued'),
    adjusted: t('leaveBalances.adjusted'),
    accrueFailed: t('leaveBalances.accrueFailed'),
    adjustFailed: t('leaveBalances.adjustFailed'),
    loadEmployeesFailed: t('leaveBalances.loadEmployeesFailed'),
    loadBalancesFailed: t('leaveBalances.loadBalancesFailed'),
    columnType: t('leaveBalances.columns.type'),
    columnYear: t('leaveBalances.columns.year'),
    columnAccrued: t('leaveBalances.columns.accrued'),
    columnConsumed: t('leaveBalances.columns.consumed'),
    columnAvailable: t('leaveBalances.columns.available'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const EMPLOYEE_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(leaveCfg || {}, null, 2)} as const;
const I18N = ${i18nJson} as const;

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
        toast({ title: I18N.loadEmployeesFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchBalances(selectedId).catch((error: any) => {
      toast({ title: I18N.loadBalancesFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    });
  }, [selectedId]);

  const runBalanceAction = async (action: 'accrue' | 'adjust') => {
    if (!selectedId) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      toast({ title: I18N.amountMustBeNonZero, variant: 'warning' });
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
      toast({ title: action === 'accrue' ? I18N.accrued : I18N.adjusted, variant: 'success' });
      setForm((prev) => ({ ...prev, amount: '', note: '' }));
      await fetchBalances(selectedId);
    } catch (error: any) {
      toast({ title: action === 'accrue' ? I18N.accrueFailed : I18N.adjustFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to={'/' + EMPLOYEE_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          {I18N.backTo}
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <label className="block text-sm font-medium text-slate-700">{I18N.employee}</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded border px-3 py-2">
          {!employees.length && <option value="">{I18N.noEmployees}</option>}
          {employees.map((emp) => (
            <option key={String(emp.id)} value={String(emp.id)}>
              {String(emp.first_name || '')} {String(emp.last_name || '')} ({String(emp.id)})
            </option>
          ))}
        </select>
        {selectedEmployee ? (
          <div className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {I18N.selected}: {String(selectedEmployee.first_name || '')} {String(selectedEmployee.last_name || '')}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{I18N.accrueAdjustHeading}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={form.leaveType}
            onChange={(e) => setForm((prev) => ({ ...prev, leaveType: e.target.value }))}
            placeholder={I18N.leaveTypePlaceholder}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={form.year}
            onChange={(e) => setForm((prev) => ({ ...prev, year: e.target.value }))}
            placeholder={I18N.yearPlaceholder}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            placeholder={I18N.amountPlaceholder}
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            placeholder={I18N.notePlaceholder}
            className="rounded border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => runBalanceAction('accrue')} disabled={!selectedId || working} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {I18N.accrue}
          </button>
          <button type="button" onClick={() => runBalanceAction('adjust')} disabled={!selectedId || working} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {I18N.adjust}
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{I18N.currentHeading}</h2>
        {loading ? (
          <div className="text-sm text-slate-500">{I18N.loading}</div>
        ) : balances.length === 0 ? (
          <div className="text-sm text-slate-500">{I18N.noBalances}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">{I18N.columnType}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnYear}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnAccrued}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnConsumed}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnAvailable}</th>
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

function buildAttendanceEntriesPage({ entity, entityName, importBase, attendanceCfg, language = 'en' }) {
  const base = importBase || '..';
  const t = tFor(language);
  const I18N = {
    title: t('attendance.title'),
    subtitle: t('attendance.subtitle'),
    backTo: t('attendance.backTo').replace('{{entity}}', entityName),
    recordHeading: t('attendance.recordHeading'),
    noEmployees: t('attendance.noEmployees'),
    notePlaceholder: t('attendance.notePlaceholder'),
    record: t('attendance.record'),
    recentHeading: t('attendance.recentHeading'),
    noEntries: t('attendance.noEntries'),
    loading: t('common.loading'),
    loadFailed: t('attendance.loadFailed'),
    recorded: t('attendance.recorded'),
    recordFailed: t('attendance.recordFailed'),
    recomputed: t('attendance.recomputed'),
    recomputeFailed: t('attendance.recomputeFailed'),
    selectEmployeeFirst: t('attendance.selectEmployeeFirst'),
    recalculate: t('attendance.recalculate'),
    statusPresent: t('attendance.statusOptions.present'),
    statusAbsent: t('attendance.statusOptions.absent'),
    statusHalfDay: t('attendance.statusOptions.halfDay'),
    statusOnLeave: t('attendance.statusOptions.onLeave'),
    columnEmployee: t('attendance.columns.employee'),
    columnDate: t('attendance.columns.date'),
    columnCheckIn: t('attendance.columns.checkIn'),
    columnCheckOut: t('attendance.columns.checkOut'),
    columnHours: t('attendance.columns.hours'),
    columnStatus: t('attendance.columns.status'),
    columnActions: t('attendance.columns.actions'),
  };
  const i18nJson = JSON.stringify(I18N, null, 2);
  return `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '${base}/services/api';
import { useToast } from '${base}/components/ui/toast';

const ENTITY_SLUG = '${entity.slug}' as const;
const CFG = ${JSON.stringify(attendanceCfg || {}, null, 2)} as const;
const I18N = ${i18nJson} as const;

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
        toast({ title: I18N.loadFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recordAttendance = async () => {
    if (!form.employeeId) {
      toast({ title: I18N.selectEmployeeFirst, variant: 'warning' });
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
      toast({ title: I18N.recorded, variant: 'success' });
      setForm((prev) => ({ ...prev, checkInAt: '', checkOutAt: '', note: '' }));
      await fetchAll();
    } catch (error: any) {
      toast({ title: I18N.recordFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorkingId('');
    }
  };

  const recalculate = async (id: string) => {
    if (!id) return;
    setWorkingId(id);
    try {
      await api.post('/' + ENTITY_SLUG + '/' + id + '/recalculate', {});
      toast({ title: I18N.recomputed, variant: 'success' });
      await fetchAll();
    } catch (error: any) {
      toast({ title: I18N.recomputeFailed, description: error?.response?.data?.error || error?.message || 'Unknown error', variant: 'error' });
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{I18N.title}</h1>
          <p className="text-sm text-slate-600">{I18N.subtitle}</p>
        </div>
        <Link to={'/' + ENTITY_SLUG} className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50">
          {I18N.backTo}
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{I18N.recordHeading}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={form.employeeId} onChange={(e) => setForm((prev) => ({ ...prev, employeeId: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            {!employees.length && <option value="">{I18N.noEmployees}</option>}
            {employees.map((emp) => (
              <option key={String(emp.id)} value={String(emp.id)}>
                {String(emp.first_name || '')} {String(emp.last_name || '')}
              </option>
            ))}
          </select>
          <input type="date" value={form.workDate} onChange={(e) => setForm((prev) => ({ ...prev, workDate: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="rounded border px-3 py-2 text-sm">
            <option value="Present">{I18N.statusPresent}</option>
            <option value="Absent">{I18N.statusAbsent}</option>
            <option value="Half Day">{I18N.statusHalfDay}</option>
            <option value="On Leave">{I18N.statusOnLeave}</option>
          </select>
          <input type="datetime-local" value={form.checkInAt} onChange={(e) => setForm((prev) => ({ ...prev, checkInAt: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
          <input type="datetime-local" value={form.checkOutAt} onChange={(e) => setForm((prev) => ({ ...prev, checkOutAt: e.target.value }))} className="rounded border px-3 py-2 text-sm" />
          <input value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder={I18N.notePlaceholder} className="rounded border px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={recordAttendance} disabled={workingId === 'record'} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {I18N.record}
          </button>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">{I18N.recentHeading}</h2>
        {loading ? (
          <div className="text-sm text-slate-500">{I18N.loading}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-slate-500">{I18N.noEntries}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">{I18N.columnEmployee}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnDate}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnCheckIn}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnCheckOut}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnHours}</th>
                  <th className="px-3 py-2 text-left">{I18N.columnStatus}</th>
                  <th className="px-3 py-2 text-right">{I18N.columnActions}</th>
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
                          {I18N.recalculate}
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
