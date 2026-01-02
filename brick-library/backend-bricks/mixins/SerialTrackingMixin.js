module.exports = {
  dependencies: ['InventoryMixin'],

  hooks: {
    'BEFORE_CREATE_VALIDATION': `
      // SerialTrackingMixin: Serial number is mandatory and unique
      if (!data.serial_number) {
        throw new Error('Serial number is required');
      }
      
      const existing = await this.repository.findAll(this.slug, { serial_number: data.serial_number });
      if (existing.length > 0) {
        throw new Error(\`Serial number \${data.serial_number} already exists\`);
      }
      
      // Serialized items always have quantity 1
      data.quantity = 1;
    `,
    
    'BEFORE_UPDATE_VALIDATION': `
      // SerialTrackingMixin: Cannot change quantity of serialized item
      if (data.quantity !== undefined && data.quantity !== 1) {
        throw new Error('Serialized items must have quantity of 1');
      }
    `
  }
};

