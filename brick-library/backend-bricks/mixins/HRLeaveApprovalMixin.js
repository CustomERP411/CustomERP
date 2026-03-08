module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      const __cfg = this.mixinConfig?.hr_leave_approval || this.mixinConfig?.hrLeaveApproval || {};
      const __durationField = __cfg.duration_field || __cfg.durationField;
      const __startField = __cfg.start_date_field || __cfg.startDateField || 'start_date';
      const __endField = __cfg.end_date_field || __cfg.endDateField || 'end_date';
      const __calcDuration = __cfg.calculate_duration === true || __cfg.calculateDuration === true;

      if (__calcDuration && __durationField && data && data[__startField] && data[__endField]) {
        const __start = new Date(data[__startField]);
        const __end = new Date(data[__endField]);
        if (!isNaN(__start.getTime()) && !isNaN(__end.getTime())) {
          const __diff = Math.floor((__end - __start) / (1000 * 60 * 60 * 24));
          if (__diff >= 0) {
            data[__durationField] = __diff + 1;
          }
        }
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      const __cfg = this.mixinConfig?.hr_leave_approval || this.mixinConfig?.hrLeaveApproval || {};
      const __statusField = __cfg.status_field || __cfg.statusField || 'status';
      const __enforceTransitions = __cfg.enforce_transitions === true || __cfg.enforceTransitions === true;
      const __statusList = Array.isArray(__cfg.statuses) && __cfg.statuses.length
        ? __cfg.statuses
        : ['Pending', 'Approved', 'Rejected'];
      const __customTransitions = __cfg.transitions && typeof __cfg.transitions === 'object' ? __cfg.transitions : null;
      const __defaultTransitions = {
        Pending: ['Approved', 'Rejected'],
        Approved: [],
        Rejected: [],
      };
      const __transitions = __customTransitions || __defaultTransitions;

      const __approvedAtField = __cfg.approved_at_field || __cfg.approvedAtField;
      const __rejectedAtField = __cfg.rejected_at_field || __cfg.rejectedAtField;

      const __durationField = __cfg.duration_field || __cfg.durationField;
      const __startField = __cfg.start_date_field || __cfg.startDateField || 'start_date';
      const __endField = __cfg.end_date_field || __cfg.endDateField || 'end_date';
      const __calcDuration = __cfg.calculate_duration === true || __cfg.calculateDuration === true;

      const __existing = await this.repository.findById(this.slug, id);

      if (data && data[__statusField] !== undefined) {
        const __nextStatus = data[__statusField];
        if (__statusList && !__statusList.includes(__nextStatus)) {
          throw new Error(\`\${__statusField} must be one of: \${__statusList.join(', ')}\`);
        }

        if (__enforceTransitions) {
          const __currentStatus = __existing ? __existing[__statusField] : null;
          if (__currentStatus && __currentStatus !== __nextStatus) {
            const __allowed = Array.isArray(__transitions[__currentStatus]) ? __transitions[__currentStatus] : [];
            if (!__allowed.includes(__nextStatus)) {
              throw new Error(\`Invalid status transition: \${__currentStatus} -> \${__nextStatus}\`);
            }
          }
        }

        if (__nextStatus === 'Approved' && __approvedAtField && data[__approvedAtField] === undefined) {
          data[__approvedAtField] = new Date().toISOString();
        }
        if (__nextStatus === 'Rejected' && __rejectedAtField && data[__rejectedAtField] === undefined) {
          data[__rejectedAtField] = new Date().toISOString();
        }
      }

      if (__calcDuration && __durationField) {
        const __startRaw = (data && data[__startField] !== undefined)
          ? data[__startField]
          : (__existing ? __existing[__startField] : null);
        const __endRaw = (data && data[__endField] !== undefined)
          ? data[__endField]
          : (__existing ? __existing[__endField] : null);

        if (__startRaw && __endRaw) {
          const __start = new Date(__startRaw);
          const __end = new Date(__endRaw);
          if (!isNaN(__start.getTime()) && !isNaN(__end.getTime())) {
            const __diff = Math.floor((__end - __start) / (1000 * 60 * 60 * 24));
            if (__diff >= 0) {
              data[__durationField] = __diff + 1;
            }
          }
        }
      }
    `,
  },
};
