module.exports = (config = {}) => {
  const defaults = {
    employee_entity: 'employees',
    attendance_entity: 'attendance_entries',
    shift_entity: 'shift_assignments',
    timesheet_entity: 'timesheet_entries',
    attendance_employee_field: 'employee_id',
    attendance_date_field: 'work_date',
    check_in_field: 'check_in_at',
    check_out_field: 'check_out_at',
    worked_hours_field: 'worked_hours',
    attendance_status_field: 'status',
    timesheet_employee_field: 'employee_id',
    timesheet_date_field: 'work_date',
    timesheet_hours_field: 'regular_hours',
    timesheet_overtime_field: 'overtime_hours',
    timesheet_status_field: 'status',
    timesheet_attendance_field: 'attendance_id',
    timesheet_approved_at_field: 'approved_at',
    timesheet_approved_by_field: 'approved_by',
    daily_hours: 8,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
    dependencies: [],
    hooks: {
      BEFORE_CREATE_TRANSFORMATION: `
      const __cfg = this._hrAttCfg();
      if (this.slug === __cfg.attendance_entity && data) {
        const __worked = this._hrAttCalcHours(data[__cfg.check_in_field], data[__cfg.check_out_field]);
        if (__worked !== null && data[__cfg.worked_hours_field] === undefined) {
          data[__cfg.worked_hours_field] = __worked;
        }
        if (data[__cfg.attendance_status_field] === undefined || data[__cfg.attendance_status_field] === null || data[__cfg.attendance_status_field] === '') {
          data[__cfg.attendance_status_field] = 'Present';
        }
      }
      if (this.slug === __cfg.timesheet_entity && data) {
        if (data[__cfg.timesheet_status_field] === undefined || data[__cfg.timesheet_status_field] === null || data[__cfg.timesheet_status_field] === '') {
          data[__cfg.timesheet_status_field] = 'Draft';
        }
      }
    `,
    },
    methods: `
  _hrAttCfg() {
    const cfg =
      this.mixinConfig?.hr_attendance_timesheet ||
      this.mixinConfig?.hrAttendanceTimesheet ||
      this.mixinConfig?.hr_attendance_time ||
      this.mixinConfig?.hrAttendanceTime ||
      {};
    return {
      employee_entity: cfg.employee_entity || cfg.employeeEntity || '${merged.employee_entity}',
      attendance_entity: cfg.attendance_entity || cfg.attendanceEntity || '${merged.attendance_entity}',
      shift_entity: cfg.shift_entity || cfg.shiftEntity || '${merged.shift_entity}',
      timesheet_entity: cfg.timesheet_entity || cfg.timesheetEntity || '${merged.timesheet_entity}',
      attendance_employee_field: cfg.attendance_employee_field || cfg.attendanceEmployeeField || '${merged.attendance_employee_field}',
      attendance_date_field: cfg.attendance_date_field || cfg.attendanceDateField || '${merged.attendance_date_field}',
      check_in_field: cfg.check_in_field || cfg.checkInField || '${merged.check_in_field}',
      check_out_field: cfg.check_out_field || cfg.checkOutField || '${merged.check_out_field}',
      worked_hours_field: cfg.worked_hours_field || cfg.workedHoursField || '${merged.worked_hours_field}',
      attendance_status_field: cfg.attendance_status_field || cfg.attendanceStatusField || '${merged.attendance_status_field}',
      timesheet_employee_field: cfg.timesheet_employee_field || cfg.timesheetEmployeeField || '${merged.timesheet_employee_field}',
      timesheet_date_field: cfg.timesheet_date_field || cfg.timesheetDateField || '${merged.timesheet_date_field}',
      timesheet_hours_field: cfg.timesheet_hours_field || cfg.timesheetHoursField || '${merged.timesheet_hours_field}',
      timesheet_overtime_field: cfg.timesheet_overtime_field || cfg.timesheetOvertimeField || '${merged.timesheet_overtime_field}',
      timesheet_status_field: cfg.timesheet_status_field || cfg.timesheetStatusField || '${merged.timesheet_status_field}',
      timesheet_attendance_field: cfg.timesheet_attendance_field || cfg.timesheetAttendanceField || '${merged.timesheet_attendance_field}',
      timesheet_approved_at_field: cfg.timesheet_approved_at_field || cfg.timesheetApprovedAtField || '${merged.timesheet_approved_at_field}',
      timesheet_approved_by_field: cfg.timesheet_approved_by_field || cfg.timesheetApprovedByField || '${merged.timesheet_approved_by_field}',
      daily_hours: Number(cfg.daily_hours || cfg.dailyHours || ${Number(merged.daily_hours) || 8}) || ${Number(merged.daily_hours) || 8},
    };
  }

  _hrAttErr(message, statusCode = 400, details = null) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (details) err.details = details;
    return err;
  }

  _hrAttRound(rawValue) {
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(2));
  }

  _hrAttCalcHours(checkInRaw, checkOutRaw) {
    if (!checkInRaw || !checkOutRaw) return null;
    const inDate = new Date(checkInRaw);
    const outDate = new Date(checkOutRaw);
    if (!Number.isFinite(inDate.getTime()) || !Number.isFinite(outDate.getTime())) {
      throw this._hrAttErr('Invalid check-in/check-out datetime values', 400);
    }
    if (outDate.getTime() < inDate.getTime()) {
      throw this._hrAttErr('check_out_at must be on or after check_in_at', 400);
    }
    const hours = (outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60);
    return this._hrAttRound(hours);
  }

  async recordAttendance(payload = {}) {
    const cfg = this._hrAttCfg();
    if (this.slug !== cfg.attendance_entity) {
      throw this._hrAttErr(
        \`Attendance record can only run on '\${cfg.attendance_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const employeeId = payload[cfg.attendance_employee_field] || payload.employee_id || payload.employeeId;
    const workDate = payload[cfg.attendance_date_field] || payload.work_date || payload.workDate;
    if (!employeeId) throw this._hrAttErr('employee_id is required', 400);
    if (!workDate) throw this._hrAttErr('work_date is required', 400);

    return this.repository.withTransaction(async (client) => {
      if (this.repository && typeof this.repository.atomicUpsertAttendanceTimesheet === 'function') {
        return this.repository.atomicUpsertAttendanceTimesheet(
          cfg.attendance_entity,
          cfg.timesheet_entity,
          {
            employee_id: employeeId,
            work_date: workDate,
            attendance_employee_field: cfg.attendance_employee_field,
            attendance_date_field: cfg.attendance_date_field,
            check_in_field: cfg.check_in_field,
            check_out_field: cfg.check_out_field,
            worked_hours_field: cfg.worked_hours_field,
            attendance_status_field: cfg.attendance_status_field,
            timesheet_employee_field: cfg.timesheet_employee_field,
            timesheet_date_field: cfg.timesheet_date_field,
            timesheet_hours_field: cfg.timesheet_hours_field,
            timesheet_overtime_field: cfg.timesheet_overtime_field,
            timesheet_status_field: cfg.timesheet_status_field,
            timesheet_attendance_field: cfg.timesheet_attendance_field,
            daily_hours: cfg.daily_hours,
            attendance_patch: payload,
          },
          client
        );
      }

      const existing = await this.repository.findAllWithClient(cfg.attendance_entity, {
        [cfg.attendance_employee_field]: employeeId,
        [cfg.attendance_date_field]: workDate,
      }, client);
      const current = Array.isArray(existing) && existing.length ? existing[0] : null;

      const checkIn = payload[cfg.check_in_field] ?? payload.check_in_at ?? payload.checkInAt ?? (current ? current[cfg.check_in_field] : null);
      const checkOut = payload[cfg.check_out_field] ?? payload.check_out_at ?? payload.checkOutAt ?? (current ? current[cfg.check_out_field] : null);
      const workedHoursRaw = payload[cfg.worked_hours_field] ?? payload.worked_hours;
      const workedHours = workedHoursRaw !== undefined ? this._hrAttRound(workedHoursRaw) : this._hrAttCalcHours(checkIn, checkOut);
      const attendancePayload = {
        [cfg.attendance_employee_field]: employeeId,
        [cfg.attendance_date_field]: workDate,
        [cfg.check_in_field]: checkIn || null,
        [cfg.check_out_field]: checkOut || null,
        [cfg.worked_hours_field]: workedHours !== null ? workedHours : 0,
        [cfg.attendance_status_field]:
          payload[cfg.attendance_status_field] ||
          payload.status ||
          (current ? current[cfg.attendance_status_field] : null) ||
          'Present',
      };
      if (payload.note !== undefined) attendancePayload.note = payload.note;

      const attendance = current
        ? await this.repository.updateWithClient(cfg.attendance_entity, current.id, attendancePayload, client)
        : await this.repository.createWithClient(cfg.attendance_entity, attendancePayload, client);

      const worked = this._hrAttRound(attendance[cfg.worked_hours_field] || 0);
      const regular = this._hrAttRound(Math.min(worked, cfg.daily_hours));
      const overtime = this._hrAttRound(Math.max(worked - cfg.daily_hours, 0));
      const existingTimesheets = await this.repository.findAllWithClient(cfg.timesheet_entity, {
        [cfg.timesheet_employee_field]: employeeId,
        [cfg.timesheet_date_field]: workDate,
      }, client);
      const currentTimesheet = Array.isArray(existingTimesheets) && existingTimesheets.length ? existingTimesheets[0] : null;
      const timesheetPayload = {
        [cfg.timesheet_employee_field]: employeeId,
        [cfg.timesheet_date_field]: workDate,
        [cfg.timesheet_hours_field]: regular,
        [cfg.timesheet_overtime_field]: overtime,
        [cfg.timesheet_status_field]: currentTimesheet ? currentTimesheet[cfg.timesheet_status_field] || 'Draft' : 'Draft',
        [cfg.timesheet_attendance_field]: attendance.id,
      };
      const timesheet = currentTimesheet
        ? await this.repository.updateWithClient(cfg.timesheet_entity, currentTimesheet.id, timesheetPayload, client)
        : await this.repository.createWithClient(cfg.timesheet_entity, timesheetPayload, client);

      return {
        attendance,
        timesheet,
      };
    });
  }

  async recalculateAttendance(attendanceId, payload = {}) {
    const cfg = this._hrAttCfg();
    if (this.slug !== cfg.attendance_entity) {
      throw this._hrAttErr(
        \`Attendance recalculation can only run on '\${cfg.attendance_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const attendance = await this.repository.findByIdForUpdate(cfg.attendance_entity, attendanceId, client);
      if (!attendance) throw this._hrAttErr('Attendance entry not found', 404);

      const checkIn = payload[cfg.check_in_field] ?? attendance[cfg.check_in_field];
      const checkOut = payload[cfg.check_out_field] ?? attendance[cfg.check_out_field];
      const workedHours = this._hrAttCalcHours(checkIn, checkOut);

      const updatedAttendance = await this.repository.updateWithClient(cfg.attendance_entity, attendanceId, {
        [cfg.check_in_field]: checkIn || null,
        [cfg.check_out_field]: checkOut || null,
        [cfg.worked_hours_field]: workedHours !== null ? workedHours : attendance[cfg.worked_hours_field] || 0,
      }, client);

      const employeeId = updatedAttendance[cfg.attendance_employee_field];
      const workDate = updatedAttendance[cfg.attendance_date_field];
      const regular = this._hrAttRound(Math.min(updatedAttendance[cfg.worked_hours_field] || 0, cfg.daily_hours));
      const overtime = this._hrAttRound(Math.max((updatedAttendance[cfg.worked_hours_field] || 0) - cfg.daily_hours, 0));
      const existingTimesheets = await this.repository.findAllWithClient(cfg.timesheet_entity, {
        [cfg.timesheet_employee_field]: employeeId,
        [cfg.timesheet_date_field]: workDate,
      }, client);
      const currentTimesheet = Array.isArray(existingTimesheets) && existingTimesheets.length ? existingTimesheets[0] : null;
      const timesheetPayload = {
        [cfg.timesheet_employee_field]: employeeId,
        [cfg.timesheet_date_field]: workDate,
        [cfg.timesheet_hours_field]: regular,
        [cfg.timesheet_overtime_field]: overtime,
        [cfg.timesheet_attendance_field]: updatedAttendance.id,
      };
      const timesheet = currentTimesheet
        ? await this.repository.updateWithClient(cfg.timesheet_entity, currentTimesheet.id, timesheetPayload, client)
        : await this.repository.createWithClient(cfg.timesheet_entity, {
            ...timesheetPayload,
            [cfg.timesheet_status_field]: 'Draft',
          }, client);

      return {
        attendance: updatedAttendance,
        timesheet,
      };
    });
  }

  async syncTimesheetWindow(payload = {}) {
    const cfg = this._hrAttCfg();
    if (this.slug !== cfg.timesheet_entity) {
      throw this._hrAttErr(
        \`Timesheet sync can only run on '\${cfg.timesheet_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }
    const employeeId = payload[cfg.attendance_employee_field] || payload.employee_id || payload.employeeId;
    if (!employeeId) throw this._hrAttErr('employee_id is required for timesheet sync', 400);

    const fromDate = payload.from_date || payload.fromDate || null;
    const toDate = payload.to_date || payload.toDate || null;

    return this.repository.withTransaction(async (client) => {
      const attendanceRows = await this.repository.findAllWithClient(cfg.attendance_entity, {
        [cfg.attendance_employee_field]: employeeId,
      }, client);
      const filtered = (Array.isArray(attendanceRows) ? attendanceRows : []).filter((row) => {
        const day = String(row[cfg.attendance_date_field] || '');
        if (!day) return false;
        if (fromDate && day < String(fromDate)) return false;
        if (toDate && day > String(toDate)) return false;
        return true;
      });

      let synced = 0;
      for (const row of filtered) {
        const workDate = row[cfg.attendance_date_field];
        const regular = this._hrAttRound(Math.min(row[cfg.worked_hours_field] || 0, cfg.daily_hours));
        const overtime = this._hrAttRound(Math.max((row[cfg.worked_hours_field] || 0) - cfg.daily_hours, 0));
        const existingTimesheets = await this.repository.findAllWithClient(cfg.timesheet_entity, {
          [cfg.timesheet_employee_field]: employeeId,
          [cfg.timesheet_date_field]: workDate,
        }, client);
        const current = Array.isArray(existingTimesheets) && existingTimesheets.length ? existingTimesheets[0] : null;
        const patch = {
          [cfg.timesheet_employee_field]: employeeId,
          [cfg.timesheet_date_field]: workDate,
          [cfg.timesheet_hours_field]: regular,
          [cfg.timesheet_overtime_field]: overtime,
          [cfg.timesheet_attendance_field]: row.id,
        };
        if (current) {
          await this.repository.updateWithClient(cfg.timesheet_entity, current.id, patch, client);
        } else {
          await this.repository.createWithClient(cfg.timesheet_entity, {
            ...patch,
            [cfg.timesheet_status_field]: 'Draft',
          }, client);
        }
        synced += 1;
      }

      return {
        employee_id: employeeId,
        synced_entries: synced,
      };
    });
  }

  async approveTimesheetEntry(timesheetId, payload = {}) {
    const cfg = this._hrAttCfg();
    if (this.slug !== cfg.timesheet_entity) {
      throw this._hrAttErr(
        \`Timesheet approval can only run on '\${cfg.timesheet_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    return this.repository.withTransaction(async (client) => {
      const row = await this.repository.findByIdForUpdate(cfg.timesheet_entity, timesheetId, client);
      if (!row) throw this._hrAttErr('Timesheet entry not found', 404);
      const updated = await this.repository.updateWithClient(cfg.timesheet_entity, timesheetId, {
        [cfg.timesheet_status_field]: 'Approved',
        [cfg.timesheet_approved_at_field]: new Date().toISOString(),
        [cfg.timesheet_approved_by_field]: payload.approved_by || payload.approvedBy || payload[cfg.timesheet_approved_by_field] || null,
      }, client);
      return {
        timesheet: updated,
      };
    });
  }
    `,
  };
};
