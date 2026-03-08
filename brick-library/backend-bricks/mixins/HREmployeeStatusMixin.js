module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      const __cfg = this.mixinConfig?.hr_employee_status || this.mixinConfig?.hrEmployeeStatus || {};
      const __statusField = __cfg.status_field || __cfg.statusField || 'status';
      const __defaultStatus = __cfg.default_status || __cfg.defaultStatus;
      const __statusList = Array.isArray(__cfg.statuses) && __cfg.statuses.length ? __cfg.statuses : null;

      if (data && data[__statusField] === undefined && __defaultStatus) {
        data[__statusField] = __defaultStatus;
      }

      if (__statusList && data && data[__statusField] !== undefined && !__statusList.includes(data[__statusField])) {
        throw new Error(\`\${__statusField} must be one of: \${__statusList.join(', ')}\`);
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      const __cfg = this.mixinConfig?.hr_employee_status || this.mixinConfig?.hrEmployeeStatus || {};
      const __statusField = __cfg.status_field || __cfg.statusField || 'status';
      const __enforceTransitions = __cfg.enforce_transitions === true || __cfg.enforceTransitions === true;
      const __statusList = Array.isArray(__cfg.statuses) && __cfg.statuses.length
        ? __cfg.statuses
        : ['Active', 'On Leave', 'Terminated'];
      const __customTransitions = __cfg.transitions && typeof __cfg.transitions === 'object' ? __cfg.transitions : null;
      const __defaultTransitions = {
        Active: ['On Leave', 'Terminated'],
        'On Leave': ['Active', 'Terminated'],
        Terminated: [],
      };
      const __transitions = __customTransitions || __defaultTransitions;

      if (data && data[__statusField] !== undefined) {
        const __nextStatus = data[__statusField];
        if (__statusList && !__statusList.includes(__nextStatus)) {
          throw new Error(\`\${__statusField} must be one of: \${__statusList.join(', ')}\`);
        }

        if (__enforceTransitions) {
          const __existing = await this.repository.findById(this.slug, id);
          const __currentStatus = __existing ? __existing[__statusField] : null;

          if (__currentStatus && __currentStatus !== __nextStatus) {
            const __allowed = Array.isArray(__transitions[__currentStatus]) ? __transitions[__currentStatus] : [];
            if (!__allowed.includes(__nextStatus)) {
              throw new Error(\`Invalid status transition: \${__currentStatus} -> \${__nextStatus}\`);
            }
          }
        }
      }
    `,
  },
};
