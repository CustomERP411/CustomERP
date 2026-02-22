module.exports = {
  dependencies: ['InventoryMixin'], // Batch tracking usually implies inventory logic

  hooks: {
    'BEFORE_CREATE_VALIDATION': `
      // BatchTrackingMixin: Ensure batch number is provided
      if (!data.batch_number) {
        throw new Error('Batch number is required for this item');
      }

      const batchConfig = this.mixinConfig?.batch_tracking || {};
      const requireExpiry = batchConfig.require_expiry === true || batchConfig.requireExpiry === true;
      const allowPastExpiry = batchConfig.allow_past_expiry !== false && batchConfig.allowPastExpiry !== false;

      if (requireExpiry && !data.expiry_date) {
        throw new Error('Expiry date is required for this item');
      }
      
      // BatchTrackingMixin: Validate expiry date if provided
      if (data.expiry_date) {
        const expiry = new Date(data.expiry_date);
        if (isNaN(expiry.getTime())) {
          throw new Error('Invalid expiry date format');
        }
        if (!allowPastExpiry && expiry < new Date()) {
          throw new Error('Expiry date cannot be in the past');
        }
        if (allowPastExpiry && expiry < new Date()) {
          console.warn('Warning: Creating item with past expiry date');
        }
      }
    `,

    'BEFORE_CREATE_TRANSFORMATION': `
      // BatchTrackingMixin: Normalize batch fields
      data.batch_number = String(data.batch_number).trim().toUpperCase();
      if (data.expiry_date) {
        data.expiry_date = new Date(data.expiry_date).toISOString();
      }
    `
  },

  methods: `
  async findByBatch(batchNumber) {
    return this.repository.findAll(this.slug, { batch_number: batchNumber });
  }

  async getExpiredItems() {
    const allItems = await this.repository.findAll(this.slug);
    const now = new Date();
    return allItems.filter(item => item.expiry_date && new Date(item.expiry_date) < now);
  }
  `
};

