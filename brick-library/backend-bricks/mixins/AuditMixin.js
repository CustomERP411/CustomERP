module.exports = {
  dependencies: [],

  hooks: {
    'AFTER_CREATE_LOGGING': `
      // AuditMixin: Log creation
      const __auditAt = new Date().toISOString();
      const __auditConfig = this.mixinConfig?.audit || {};
      const __auditFields = Array.isArray(__auditConfig.audit_fields)
        ? __auditConfig.audit_fields
        : (Array.isArray(__auditConfig.auditFields) ? __auditConfig.auditFields : []);
      const __auditMeta = { id: result.id };
      if (__auditFields.length) {
        __auditFields.forEach(field => {
          if (result && Object.prototype.hasOwnProperty.call(result, field)) {
            __auditMeta[field] = result[field];
          } else if (data && Object.prototype.hasOwnProperty.call(data, field)) {
            __auditMeta[field] = data[field];
          }
        });
      }
      console.log(\`[AUDIT] Created \${this.slug} with ID \${result.id} at \${__auditAt}\`);
      // Persist audit logs into a system entity for the generated UI (Activity Log).
      // This remains optional because the mixin is only applied when features.audit_trail is enabled.
      try {
        await this.repository.create('__audit_logs', {
          at: __auditAt,
          action: 'CREATE',
          entity: this.slug,
          entity_id: result.id,
          message: \`Created \${this.slug}\`,
          meta: JSON.stringify(__auditMeta)
        });
      } catch (e) {
        console.warn('[AUDIT] Failed to persist audit log:', e?.message || e);
      }
    `,

    'AFTER_UPDATE_LOGGING': `
      // AuditMixin: Log update
      const __auditAt = new Date().toISOString();
      const __auditConfig = this.mixinConfig?.audit || {};
      const __auditFields = Array.isArray(__auditConfig.audit_fields)
        ? __auditConfig.audit_fields
        : (Array.isArray(__auditConfig.auditFields) ? __auditConfig.auditFields : []);
      const __auditMeta = { id };
      if (__auditFields.length) {
        __auditFields.forEach(field => {
          if (result && Object.prototype.hasOwnProperty.call(result, field)) {
            __auditMeta[field] = result[field];
          } else if (data && Object.prototype.hasOwnProperty.call(data, field)) {
            __auditMeta[field] = data[field];
          }
        });
      }
      console.log(\`[AUDIT] Updated \${this.slug} ID \${id} at \${__auditAt}\`);
      try {
        await this.repository.create('__audit_logs', {
          at: __auditAt,
          action: 'UPDATE',
          entity: this.slug,
          entity_id: id,
          message: \`Updated \${this.slug}\`,
          meta: JSON.stringify(__auditMeta)
        });
      } catch (e) {
        console.warn('[AUDIT] Failed to persist audit log:', e?.message || e);
      }
    `,

    'AFTER_DELETE_LOGGING': `
      // AuditMixin: Log deletion
      const __auditAt = new Date().toISOString();
      console.log(\`[AUDIT] Deleted \${this.slug} ID \${id} at \${__auditAt}\`);
      try {
        await this.repository.create('__audit_logs', {
          at: __auditAt,
          action: 'DELETE',
          entity: this.slug,
          entity_id: id,
          message: \`Deleted \${this.slug}\`,
          meta: JSON.stringify({ id })
        });
      } catch (e) {
        console.warn('[AUDIT] Failed to persist audit log:', e?.message || e);
      }
    `
  }
};

