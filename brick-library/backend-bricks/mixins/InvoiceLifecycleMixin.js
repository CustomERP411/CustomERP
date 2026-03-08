module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_UPDATE_VALIDATION': `
      const __cfg = this.mixinConfig?.invoice_lifecycle || this.mixinConfig?.invoiceLifecycle || {};
      const __statusField = __cfg.status_field || __cfg.statusField || 'status';
      const __enforceTransitions = __cfg.enforce_transitions === true || __cfg.enforceTransitions === true;
      const __statusList = Array.isArray(__cfg.statuses) && __cfg.statuses.length
        ? __cfg.statuses
        : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];
      const __customTransitions = __cfg.transitions && typeof __cfg.transitions === 'object' ? __cfg.transitions : null;
      const __defaultTransitions = {
        Draft: ['Sent', 'Cancelled'],
        Sent: ['Paid', 'Overdue', 'Cancelled'],
        Overdue: ['Paid', 'Cancelled'],
        Paid: [],
        Cancelled: [],
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
