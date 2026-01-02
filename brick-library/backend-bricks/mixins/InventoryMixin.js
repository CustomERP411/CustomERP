module.exports = {
  // Dependencies this mixin relies on (e.g., other fields or services)
  dependencies: [],

  // Hook injections
  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      // InventoryMixin: Initialize quantity if not present
      if (data.quantity === undefined || data.quantity === null) {
        data.quantity = 0;
      }
      data.quantity = Number(data.quantity);
      if (isNaN(data.quantity)) throw new Error('Quantity must be a number');
    `,

    'BEFORE_UPDATE_VALIDATION': `
      // InventoryMixin: Validate quantity updates
      if (data.quantity !== undefined) {
        const newQty = Number(data.quantity);
        if (isNaN(newQty)) throw new Error('Quantity must be a number');
        
        // Prevent negative stock if strict mode is enabled (optional config)
        if (newQty < 0) {
           throw new Error('Stock cannot be negative');
        }
      }
    `
  },

  // Additional methods to inject into the Service class
  // The CodeWeaver will need to be smart enough to append these
  methods: `
  async adjustStock(id, delta) {
    const item = await this.repository.findById(this.slug, id);
    if (!item) throw new Error('Item not found');
    
    const currentQty = Number(item.quantity) || 0;
    const newQty = currentQty + delta;
    
    if (newQty < 0) throw new Error(\`Insufficient stock. Current: \${currentQty}, Delta: \${delta}\`);
    
    return this.repository.update(this.slug, id, { quantity: newQty });
  }
  `
};

