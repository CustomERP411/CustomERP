module.exports = (config = {}) => {
  const defaults = {
    employee_entity: 'employees',
    user_entity: '__erp_users',
    user_group_entity: '__erp_user_groups',
    group_entity: '__erp_groups',
    employee_user_field: 'user_id',
    min_password_length: 4,
  };
  const merged = {
    ...defaults,
    ...(config && typeof config === 'object' ? config : {}),
  };

  return {
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
          if (!data.email) {
            throw new Error('Email cannot be empty');
          }
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

    methods: `
  _hrEmployeeCfg() {
    const cfg =
      this.mixinConfig?.hr_employee ||
      this.mixinConfig?.hrEmployee ||
      {};
    return {
      employee_entity: cfg.employee_entity || cfg.employeeEntity || '${merged.employee_entity}',
      user_entity: cfg.user_entity || cfg.userEntity || '${merged.user_entity}',
      user_group_entity: cfg.user_group_entity || cfg.userGroupEntity || '${merged.user_group_entity}',
      group_entity: cfg.group_entity || cfg.groupEntity || '${merged.group_entity}',
      employee_user_field: cfg.employee_user_field || cfg.employeeUserField || '${merged.employee_user_field}',
      min_password_length: Number(cfg.min_password_length || cfg.minPasswordLength || ${Number(merged.min_password_length) || 4}) || ${Number(merged.min_password_length) || 4},
    };
  }

  _hrEmployeeErr(message, statusCode = 400) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
  }

  _hrEmployeeHashPassword(plain) {
    try {
      const bcrypt = require('bcryptjs');
      return bcrypt.hashSync(String(plain), 10);
    } catch (_) {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(String(plain)).digest('hex');
    }
  }

  async _hrEmployeeCreateUserAndMemberships(companion, employeeFields, client) {
    const CFG = this._hrEmployeeCfg();
    const username = String((companion && companion.username) || '').trim();
    const password = String((companion && companion.password) || '');

    if (!username) {
      throw this._hrEmployeeErr('Username is required', 400);
    }
    if (password.length < CFG.min_password_length) {
      throw this._hrEmployeeErr(\`Password must be at least \${CFG.min_password_length} characters\`, 400);
    }

    const existing = await this.repository.findAllWithClient(CFG.user_entity, { username }, client);
    if (existing && existing.length > 0) {
      throw this._hrEmployeeErr(\`Username '\${username}' is already taken\`, 409);
    }

    const rawGroupIds = Array.isArray(companion.group_ids) ? companion.group_ids : [];
    if (rawGroupIds.length) {
      const allGroups = await this.repository.findAllWithClient(CFG.group_entity, {}, client);
      const validIds = new Set(allGroups.map((g) => String(g.id)));
      const invalid = rawGroupIds.filter((gid) => !validIds.has(String(gid)));
      if (invalid.length) {
        throw this._hrEmployeeErr(\`Unknown group id(s): \${invalid.join(', ')}\`, 400);
      }
    }

    const displayName = (
      String(employeeFields.first_name || '').trim() +
      ' ' +
      String(employeeFields.last_name || '').trim()
    ).trim();

    const newUser = await this.repository.createWithClient(CFG.user_entity, {
      username,
      email: String((companion.email || employeeFields.email || '')).trim().toLowerCase(),
      display_name: displayName || username,
      password_hash: this._hrEmployeeHashPassword(password),
      is_active: companion.is_active === false ? 0 : 1,
    }, client);

    for (const gid of rawGroupIds) {
      await this.repository.createWithClient(CFG.user_group_entity, {
        user_id: newUser.id,
        group_id: gid,
      }, client);
    }

    return newUser;
  }

  async createWithCompanionUser(payload) {
    const CFG = this._hrEmployeeCfg();
    if (this.slug !== CFG.employee_entity) {
      throw this._hrEmployeeErr(
        \`createWithCompanionUser can only run on '\${CFG.employee_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const body = payload && typeof payload === 'object' ? payload : {};
    const employee = (body.employee && typeof body.employee === 'object') ? { ...body.employee } : {};
    const companion = body.companion_user || body.companionUser || null;

    if (!companion || typeof companion !== 'object') {
      throw this._hrEmployeeErr('companion_user is required', 400);
    }

    const runner = (client) => (async () => {
      const newUser = await this._hrEmployeeCreateUserAndMemberships(companion, employee, client);
      const createdEmployee = await this.repository.createWithClient(this.slug, {
        ...employee,
        [CFG.employee_user_field]: newUser.id,
      }, client);
      return { employee: createdEmployee, user: newUser };
    })();

    if (typeof this.repository.withTransaction === 'function') {
      return this.repository.withTransaction(runner);
    }
    return runner(null);
  }

  async linkUser(employeeId, companion) {
    const CFG = this._hrEmployeeCfg();
    if (this.slug !== CFG.employee_entity) {
      throw this._hrEmployeeErr(
        \`linkUser can only run on '\${CFG.employee_entity}' service. Current entity: '\${this.slug}'.\`,
        400
      );
    }

    const id = employeeId != null ? String(employeeId) : '';
    if (!id) {
      throw this._hrEmployeeErr('Employee id is required', 400);
    }

    if (!companion || typeof companion !== 'object') {
      throw this._hrEmployeeErr('companion_user is required', 400);
    }

    const employee = await this.repository.findById(this.slug, id);
    if (!employee) {
      throw this._hrEmployeeErr('Employee not found', 404);
    }
    if (employee[CFG.employee_user_field]) {
      throw this._hrEmployeeErr('Employee already has a linked user account', 409);
    }

    const runner = (client) => (async () => {
      const newUser = await this._hrEmployeeCreateUserAndMemberships(companion, employee, client);
      const updatedEmployee = await this.repository.updateWithClient(this.slug, id, {
        [CFG.employee_user_field]: newUser.id,
      }, client);
      return { employee: updatedEmployee, user: newUser };
    })();

    if (typeof this.repository.withTransaction === 'function') {
      return this.repository.withTransaction(runner);
    }
    return runner(null);
  }
`,
  };
};
