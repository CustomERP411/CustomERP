module.exports = {
  dependencies: ['InventoryMixin'],

  hooks: {
    'BEFORE_CREATE_VALIDATION': `
      // LocationMixin: Ensure location reference is present
      // Supports either a single location_id or multiple location_ids (array of IDs).
      const locationConfig = this.mixinConfig?.location || {};
      const requireLocation = locationConfig.require_location !== false && locationConfig.requireLocation !== false;
      if (requireLocation) {
        const hasSingle = data.location_id !== undefined && data.location_id !== null && String(data.location_id).trim() !== '';
        const hasMulti = Array.isArray(data.location_ids) && data.location_ids.length > 0;
        if (!hasSingle && !hasMulti) {
          throw new Error('Location is required');
        }
      }
      // Optional: Verify location exists (requires repository access)
      // const loc = await this.repository.findById('locations', data.location_id);
      // if (!loc) throw new Error('Invalid location ID');
    `
  },

  methods: `
  async moveStock(itemId, targetLocationId, quantity) {
    const item = await this.repository.findById(this.slug, itemId);
    if (!item) throw new Error('Item not found');
    
    // Check if we are moving from valid location
    // Note: This logic assumes 'item' REPRESENTS stock at a location.
    // In a sophisticated system, 'item' is the SKU, and we have a separate 'StockQuant' entity.
    // For this Increment 1 Flat-File implementation, we treat the Item record as the stock record at a location.
    
    if (item.quantity < quantity) throw new Error('Insufficient quantity to move');
    
    // Deduct from current
    await this.update(itemId, { quantity: item.quantity - quantity });
    
    // Add to target (Find existing record at target or create new)
    const targetItems = await this.repository.findAll(this.slug, { 
      sku: item.sku, 
      location_id: targetLocationId 
    });
    
    if (targetItems.length > 0) {
      const targetItem = targetItems[0];
      await this.update(targetItem.id, { quantity: targetItem.quantity + quantity });
    } else {
      // Clone item but at new location
      const { id, ...itemData } = item;
      await this.create({ ...itemData, location_id: targetLocationId, quantity: quantity });
    }
  }
  `
};

