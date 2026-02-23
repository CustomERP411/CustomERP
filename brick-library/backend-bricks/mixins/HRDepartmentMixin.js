module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      // HRDepartmentMixin: Normalize core fields
      if (data.name !== undefined && data.name !== null) {
        data.name = String(data.name).trim();
      }
      if (data.location !== undefined && data.location !== null) {
        data.location = String(data.location).trim();
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      // HRDepartmentMixin: Basic validation guardrails
      if (data.name !== undefined && data.name !== null) {
        data.name = String(data.name).trim();
      }
      if (data.location !== undefined && data.location !== null) {
        data.location = String(data.location).trim();
      }
    `,
  },
};
