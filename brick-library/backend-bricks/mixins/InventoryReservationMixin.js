module.exports = {
  dependencies: ['InventoryMixin'],

  hooks: {
    'BEFORE_CREATE_VALIDATION': `
      const __cfg = this.mixinConfig?.inventory_reservation || this.mixinConfig?.inventoryReservation || {};
      const __qtyField = __cfg.quantity_field || __cfg.quantityField || 'quantity';
      const __reservedField = __cfg.reserved_field || __cfg.reservedField || 'reserved_quantity';
      const __committedField = __cfg.committed_field || __cfg.committedField || 'committed_quantity';
      const __availableField = __cfg.available_field || __cfg.availableField || 'available_quantity';
      const __autoAvailable = __cfg.auto_calculate_available === true || __cfg.autoCalculateAvailable === true;
      const __enforce = __cfg.enforce !== false && __cfg.enforceRules !== false;

      const __readNumber = (value) => {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
      };

      const __qty = __readNumber(data[__qtyField]);
      const __reserved = __readNumber(data[__reservedField]);
      const __committed = __readNumber(data[__committedField]);
      const __hasReservations = __reserved !== null || __committed !== null;

      if (__enforce && __qty !== null && __hasReservations) {
        const __reservedVal = __reserved ?? 0;
        const __committedVal = __committed ?? 0;
        if (__reservedVal < 0 || __committedVal < 0) {
          throw new Error('Reserved and committed quantities cannot be negative');
        }
        if (__reservedVal + __committedVal > __qty) {
          throw new Error('Reserved + committed quantities cannot exceed on-hand quantity');
        }
      }

      if (__autoAvailable && __qty !== null && __hasReservations && __availableField) {
        const __reservedVal = __reserved ?? 0;
        const __committedVal = __committed ?? 0;
        data[__availableField] = __qty - __reservedVal - __committedVal;
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      const __cfg = this.mixinConfig?.inventory_reservation || this.mixinConfig?.inventoryReservation || {};
      const __qtyField = __cfg.quantity_field || __cfg.quantityField || 'quantity';
      const __reservedField = __cfg.reserved_field || __cfg.reservedField || 'reserved_quantity';
      const __committedField = __cfg.committed_field || __cfg.committedField || 'committed_quantity';
      const __availableField = __cfg.available_field || __cfg.availableField || 'available_quantity';
      const __autoAvailable = __cfg.auto_calculate_available === true || __cfg.autoCalculateAvailable === true;
      const __enforce = __cfg.enforce !== false && __cfg.enforceRules !== false;

      const __existing = await this.repository.findById(this.slug, id);

      const __readNumber = (value) => {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isNaN(num) ? null : num;
      };

      const __getValue = (field) => {
        if (data && data[field] !== undefined) return __readNumber(data[field]);
        if (__existing && __existing[field] !== undefined) return __readNumber(__existing[field]);
        return null;
      };

      const __qty = __getValue(__qtyField);
      const __reserved = __getValue(__reservedField);
      const __committed = __getValue(__committedField);
      const __hasReservations = __reserved !== null || __committed !== null;

      if (__enforce && __qty !== null && __hasReservations) {
        const __reservedVal = __reserved ?? 0;
        const __committedVal = __committed ?? 0;
        if (__reservedVal < 0 || __committedVal < 0) {
          throw new Error('Reserved and committed quantities cannot be negative');
        }
        if (__reservedVal + __committedVal > __qty) {
          throw new Error('Reserved + committed quantities cannot exceed on-hand quantity');
        }
      }

      if (__autoAvailable && __qty !== null && __hasReservations && __availableField) {
        const __reservedVal = __reserved ?? 0;
        const __committedVal = __committed ?? 0;
        data[__availableField] = __qty - __reservedVal - __committedVal;
      }
    `,
  },
};
