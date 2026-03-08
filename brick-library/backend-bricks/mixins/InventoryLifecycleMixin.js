module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      const __cfg = this.mixinConfig?.inventory_lifecycle || this.mixinConfig?.inventoryLifecycle || {};
      const __statusField = __cfg.status_field || __cfg.statusField || 'status';
      const __statuses = Array.isArray(__cfg.statuses) && __cfg.statuses.length ? __cfg.statuses : null;
      const __defaultStatus = __cfg.default_status || __cfg.defaultStatus;

      if (data && data[__statusField] === undefined && __defaultStatus) {
        data[__statusField] = __defaultStatus;
      }

      if (__statuses && data && data[__statusField] !== undefined && !__statuses.includes(data[__statusField])) {
        throw new Error(\`\${__statusField} must be one of: \${__statuses.join(', ')}\`);
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      const __cfg = this.mixinConfig?.inventory_lifecycle || this.mixinConfig?.inventoryLifecycle || {};
      const __statusField = __cfg.status_field || __cfg.statusField || 'status';
      const __statuses = Array.isArray(__cfg.statuses) && __cfg.statuses.length ? __cfg.statuses : null;
      const __enforceTransitions = __cfg.enforce_transitions === true || __cfg.enforceTransitions === true;
      const __customTransitions = __cfg.transitions && typeof __cfg.transitions === 'object' ? __cfg.transitions : null;
      const __defaultTransitions = {
        Draft: ['Active', 'Obsolete'],
        Active: ['Obsolete'],
        Obsolete: [],
      };
      const __transitions = __customTransitions || (__cfg.use_default_transitions === true || __cfg.useDefaultTransitions === true ? __defaultTransitions : null);

      if (data && data[__statusField] !== undefined) {
        const __nextStatus = data[__statusField];
        if (__statuses && !__statuses.includes(__nextStatus)) {
          throw new Error(\`\${__statusField} must be one of: \${__statuses.join(', ')}\`);
        }

        if (__enforceTransitions && __transitions) {
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
