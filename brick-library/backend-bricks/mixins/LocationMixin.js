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
    const locationConfig = this.mixinConfig?.location || {};
    const displayField = locationConfig.display_field || locationConfig.displayField || 'name';

    const doMove = async (client) => {
      const findById = client
        ? (slug, id) => this.repository.findByIdForUpdate(slug, id, client)
        : (slug, id) => this.repository.findById(slug, id);
      const update = client
        ? (slug, id, patch) => this.repository.updateWithClient(slug, id, patch, client)
        : (slug, id, patch) => this.repository.update(slug, id, patch);
      const findAll = client
        ? (slug, filter) => this.repository.findAllWithClient(slug, filter, client)
        : (slug, filter) => this.repository.findAll(slug, filter);
      const create = client
        ? (slug, data) => this.repository.createWithClient(slug, data, client)
        : (slug, data) => this.repository.create(slug, data);

      const item = await findById(this.slug, itemId);
      if (!item) throw new Error('Item not found');

      const currentQty = Number(item.quantity) || 0;
      if (currentQty < quantity) throw new Error('Insufficient quantity to move');

      await update(this.slug, itemId, { quantity: currentQty - quantity });

      const matchField = item[displayField] ? displayField : (item.name ? 'name' : null);
      const filter = { location_id: targetLocationId };
      if (matchField) filter[matchField] = item[matchField];

      const targetItems = await findAll(this.slug, filter);

      if (targetItems.length > 0) {
        const targetItem = targetItems[0];
        const targetQty = Number(targetItem.quantity) || 0;
        await update(this.slug, targetItem.id, { quantity: targetQty + quantity });
        return targetItem;
      } else {
        const { id: _discardId, ...itemData } = item;
        return create(this.slug, { ...itemData, location_id: targetLocationId, quantity: quantity });
      }
    };

    if (typeof this.repository.withTransaction === 'function') {
      return this.repository.withTransaction(doMove);
    }
    return doMove(null);
  }
  `
};

