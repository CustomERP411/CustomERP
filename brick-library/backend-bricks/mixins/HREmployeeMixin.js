module.exports = {
  dependencies: [],

  hooks: {
    'BEFORE_CREATE_TRANSFORMATION': `
      // HREmployeeMixin: Normalize core fields
      if (data.first_name !== undefined && data.first_name !== null) {
        data.first_name = String(data.first_name).trim();
      }
      if (data.last_name !== undefined && data.last_name !== null) {
        data.last_name = String(data.last_name).trim();
      }
      if (data.job_title !== undefined && data.job_title !== null) {
        data.job_title = String(data.job_title).trim();
      }
      if (data.email !== undefined && data.email !== null) {
        data.email = String(data.email).trim().toLowerCase();
      }
      if (data.hire_date) {
        const parsed = new Date(data.hire_date);
        if (!isNaN(parsed.getTime())) {
          data.hire_date = parsed.toISOString();
        }
      }
    `,

    'BEFORE_UPDATE_VALIDATION': `
      // HREmployeeMixin: Basic validation guardrails
      if (data.email !== undefined && data.email !== null) {
        const normalizedEmail = String(data.email).trim().toLowerCase();
        if (!normalizedEmail) {
          throw new Error('Email cannot be empty');
        }
        data.email = normalizedEmail;
      }
      if (data.first_name !== undefined && data.first_name !== null) {
        data.first_name = String(data.first_name).trim();
      }
      if (data.last_name !== undefined && data.last_name !== null) {
        data.last_name = String(data.last_name).trim();
      }
      if (data.job_title !== undefined && data.job_title !== null) {
        data.job_title = String(data.job_title).trim();
      }
      if (data.hire_date) {
        const parsed = new Date(data.hire_date);
        if (isNaN(parsed.getTime())) {
          throw new Error('Invalid hire_date');
        }
        data.hire_date = parsed.toISOString();
      }
    `,
  },
};
