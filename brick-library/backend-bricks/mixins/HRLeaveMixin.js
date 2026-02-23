module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_VALIDATION': `
      // HRLeaveMixin: Basic date range validation
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date);
        const end = new Date(data.end_date);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new Error('Invalid leave date range');
        }
        if (end.getTime() < start.getTime()) {
          throw new Error('Leave end_date must be on or after start_date');
        }
      }
    `,

    'BEFORE_CREATE_TRANSFORMATION': `
      // HRLeaveMixin: Normalize dates
      if (data.start_date) {
        const start = new Date(data.start_date);
        if (!isNaN(start.getTime())) {
          data.start_date = start.toISOString();
        }
      }
      if (data.end_date) {
        const end = new Date(data.end_date);
        if (!isNaN(end.getTime())) {
          data.end_date = end.toISOString();
        }
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      // HRLeaveMixin: Validate and normalize updates
      const hasStart = data.start_date !== undefined && data.start_date !== null;
      const hasEnd = data.end_date !== undefined && data.end_date !== null;
      let rangeStart = null;
      let rangeEnd = null;
      if (hasStart) {
        const start = new Date(data.start_date);
        if (isNaN(start.getTime())) {
          throw new Error('Invalid start_date');
        }
        data.start_date = start.toISOString();
        rangeStart = data.start_date;
      }
      if (hasEnd) {
        const end = new Date(data.end_date);
        if (isNaN(end.getTime())) {
          throw new Error('Invalid end_date');
        }
        data.end_date = end.toISOString();
        rangeEnd = data.end_date;
      }
      if (hasStart || hasEnd) {
        if (!rangeStart || !rangeEnd) {
          const existing = await this.repository.findById(this.slug, id);
          if (existing) {
            if (!rangeStart && existing.start_date) {
              rangeStart = existing.start_date;
            }
            if (!rangeEnd && existing.end_date) {
              rangeEnd = existing.end_date;
            }
          }
        }
        if (rangeStart && rangeEnd) {
          const start = new Date(rangeStart);
          const end = new Date(rangeEnd);
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error('Invalid leave date range');
          }
          if (end.getTime() < start.getTime()) {
            throw new Error('Leave end_date must be on or after start_date');
          }
        }
      }
    `,
  },
};
