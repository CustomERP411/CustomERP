module.exports = {
  dependencies: ['InventoryMixin'],

  hooks: {
    'BEFORE_CREATE_VALIDATION': `
      // SerialTrackingMixin: Serial number is mandatory and unique
      if (!data.serial_number) {
        throw new Error('Serial number is required');
      }
      
      const serialConfig = this.mixinConfig?.serial_tracking || {};
      const enforceUnique = serialConfig.enforce_unique !== false && serialConfig.enforceUnique !== false;
      const quantityPolicy = serialConfig.quantity_policy || serialConfig.quantityPolicy || 'fixed_one';

      if (enforceUnique) {
        const existing = await this.repository.findAll(this.slug, { serial_number: data.serial_number });
        if (existing.length > 0) {
          throw new Error(\`Serial number \${data.serial_number} already exists\`);
        }
      }
      
      // Serialized items default to quantity 1 unless policy allows overrides
      if (quantityPolicy !== 'allow_any') {
        data.quantity = 1;
      }
    `,
    
    'BEFORE_UPDATE_VALIDATION': `
      // SerialTrackingMixin: Cannot change quantity of serialized item
      const serialConfig = this.mixinConfig?.serial_tracking || {};
      const quantityPolicy = serialConfig.quantity_policy || serialConfig.quantityPolicy || 'fixed_one';
      if (quantityPolicy !== 'allow_any') {
        if (data.quantity !== undefined && data.quantity !== 1) {
          throw new Error('Serialized items must have quantity of 1');
        }
      }
    `
  }
};

