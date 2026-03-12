module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      const __cfg =
        this.mixinConfig?.inventory_cycle_count_line ||
        this.mixinConfig?.inventoryCycleCountLine ||
        this.mixinConfig?.inventory_cycle_count ||
        this.mixinConfig?.inventoryCycleCount ||
        {};
      const __expectedField = __cfg.line_expected_field || __cfg.lineExpectedField || 'expected_quantity';
      const __countedField = __cfg.line_counted_field || __cfg.lineCountedField || 'counted_quantity';
      const __varianceField = __cfg.line_variance_field || __cfg.lineVarianceField || 'variance_quantity';
      const __statusField = __cfg.line_status_field || __cfg.lineStatusField || 'status';

      const __toNum = (raw, fieldName) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(\`\${fieldName} must be numeric\`);
        return n;
      };

      if (data[__expectedField] === undefined || data[__expectedField] === null || data[__expectedField] === '') {
        data[__expectedField] = 0;
      }
      const __expected = __toNum(data[__expectedField], __expectedField);
      if (__expected < 0) throw new Error(\`\${__expectedField} cannot be negative\`);

      if (data[__statusField] === undefined) {
        data[__statusField] = 'Pending';
      }

      const __hasCount =
        data[__countedField] !== undefined &&
        data[__countedField] !== null &&
        data[__countedField] !== '';
      if (__hasCount) {
        const __counted = __toNum(data[__countedField], __countedField);
        if (__counted < 0) throw new Error(\`\${__countedField} cannot be negative\`);
        data[__varianceField] = __counted - __expected;
        data[__statusField] = 'Counted';
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      const __cfg =
        this.mixinConfig?.inventory_cycle_count_line ||
        this.mixinConfig?.inventoryCycleCountLine ||
        this.mixinConfig?.inventory_cycle_count ||
        this.mixinConfig?.inventoryCycleCount ||
        {};
      const __expectedField = __cfg.line_expected_field || __cfg.lineExpectedField || 'expected_quantity';
      const __countedField = __cfg.line_counted_field || __cfg.lineCountedField || 'counted_quantity';
      const __varianceField = __cfg.line_variance_field || __cfg.lineVarianceField || 'variance_quantity';
      const __statusField = __cfg.line_status_field || __cfg.lineStatusField || 'status';

      const __existing = await this.repository.findById(this.slug, id);
      if (!__existing) return null;

      const __toNum = (raw, fieldName) => {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(\`\${fieldName} must be numeric\`);
        return n;
      };

      const __expectedRaw =
        data[__expectedField] !== undefined ? data[__expectedField] : __existing[__expectedField];
      const __countedRaw =
        data[__countedField] !== undefined ? data[__countedField] : __existing[__countedField];

      const __expected = __toNum(__expectedRaw, __expectedField);
      if (__expected < 0) throw new Error(\`\${__expectedField} cannot be negative\`);

      const __hasCount =
        __countedRaw !== undefined &&
        __countedRaw !== null &&
        __countedRaw !== '';
      if (__hasCount) {
        const __counted = __toNum(__countedRaw, __countedField);
        if (__counted < 0) throw new Error(\`\${__countedField} cannot be negative\`);
        data[__varianceField] = __counted - __expected;
        if (!data[__statusField]) data[__statusField] = 'Counted';
      } else if (!data[__statusField] && !__existing[__statusField]) {
        data[__statusField] = 'Pending';
      }
    `,
  },
};
