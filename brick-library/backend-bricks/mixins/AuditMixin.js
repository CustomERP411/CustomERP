module.exports = {
  dependencies: [],

  hooks: {
    'AFTER_CREATE_LOGGING': `
      // AuditMixin: Log creation
      const __auditAt = new Date().toISOString();
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
          meta: JSON.stringify({ id: result.id })
        });
      } catch (e) {
        console.warn('[AUDIT] Failed to persist audit log:', e?.message || e);
      }
    `,

    'AFTER_UPDATE_LOGGING': `
      // AuditMixin: Log update
      const __auditAt = new Date().toISOString();
      console.log(\`[AUDIT] Updated \${this.slug} ID \${id} at \${__auditAt}\`);
      try {
        await this.repository.create('__audit_logs', {
          at: __auditAt,
          action: 'UPDATE',
          entity: this.slug,
          entity_id: id,
          message: \`Updated \${this.slug}\`,
          meta: JSON.stringify({ id })
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

