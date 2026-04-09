// System entities, access control, root files & runtime config – extracted from ProjectAssembler
const path = require('path');

module.exports = {
  _withSystemEntities(userEntities, sdf) {
    const entities = Array.isArray(userEntities) ? [...userEntities] : [];
    const modules = (sdf && sdf.modules) ? sdf.modules : {};

    const wantsActivityLog =
      modules?.activity_log?.enabled === true ||
      entities.some((e) => e && e.features && e.features.audit_trail);

    const wantsScheduledReports = modules?.scheduled_reports?.enabled === true;
    const reportsSlug =
      (modules?.scheduled_reports && (modules.scheduled_reports.target_slug || modules.scheduled_reports.targetSlug)) ||
      '__reports';

    if (wantsActivityLog && !entities.some((e) => e && e.slug === '__audit_logs')) {
      entities.push({
        slug: '__audit_logs',
        display_name: 'Audit Logs',
        display_field: 'at',
        module: 'shared',
        system: { hidden: true },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['at', 'action', 'entity', 'entity_id', 'message'] },
        fields: [
          { name: 'at', type: 'string', label: 'At', required: true },
          { name: 'action', type: 'string', label: 'Action', required: true },
          { name: 'entity', type: 'string', label: 'Entity', required: true },
          { name: 'entity_id', type: 'string', label: 'Entity ID', required: false },
          { name: 'message', type: 'string', label: 'Message', required: false },
          { name: 'meta', type: 'text', label: 'Meta', required: false },
        ],
        features: {},
      });
    }

    if (wantsScheduledReports && !entities.some((e) => e && e.slug === reportsSlug)) {
      entities.push({
        slug: reportsSlug,
        display_name: 'Reports',
        display_field: 'report_date',
        module: 'shared',
        system: { hidden: true },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['report_date', 'report_type'] },
        fields: [
          { name: 'report_date', type: 'string', label: 'Report Date', required: true },
          { name: 'report_type', type: 'string', label: 'Report Type', required: true },
          { name: 'generated_at', type: 'string', label: 'Generated At', required: true },
          { name: 'data', type: 'text', label: 'Data (JSON)', required: false },
        ],
        features: {},
      });
    }

    this._withInventoryPriorityAEntities(entities, sdf);
    this._withInvoicePriorityAEntities(entities, sdf);
    this._withHRPriorityAEntities(entities, sdf);
    this._withAccessControlEntities(entities, sdf);

    return entities;
  },

  _withAccessControlEntities(entities, sdf) {
    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const acConfig = modules.access_control || {};
    const enabled = acConfig.enabled !== false;
    if (!enabled) return;

    const bySlug = new Map();
    for (const e of entities) {
      if (e && e.slug) bySlug.set(e.slug, e);
    }

    if (!bySlug.has('__erp_users')) {
      entities.push({
        slug: '__erp_users',
        display_name: 'Users',
        display_field: 'username',
        module: 'shared',
        system: { hidden: false },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['username', 'email', 'display_name', 'is_active'] },
        fields: [
          { name: 'username', type: 'string', label: 'Username', required: true, unique: true },
          { name: 'email', type: 'string', label: 'Email', required: false },
          { name: 'display_name', type: 'string', label: 'Display Name', required: false },
          { name: 'password_hash', type: 'string', label: 'Password Hash', required: false },
          { name: 'is_active', type: 'boolean', label: 'Active', required: false },
        ],
        features: {},
      });
    }

    if (!bySlug.has('__erp_groups')) {
      entities.push({
        slug: '__erp_groups',
        display_name: 'Groups',
        display_field: 'name',
        module: 'shared',
        system: { hidden: false },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['name', 'description'] },
        fields: [
          { name: 'name', type: 'string', label: 'Name', required: true, unique: true },
          { name: 'description', type: 'string', label: 'Description', required: false },
        ],
        features: {},
      });
    }

    if (!bySlug.has('__erp_permissions')) {
      entities.push({
        slug: '__erp_permissions',
        display_name: 'Permissions',
        display_field: 'key',
        module: 'shared',
        system: { hidden: false },
        ui: { search: true, csv_import: false, csv_export: false, print: false },
        list: { columns: ['key', 'label', 'scope'] },
        fields: [
          { name: 'key', type: 'string', label: 'Key', required: true, unique: true },
          { name: 'label', type: 'string', label: 'Label', required: false },
          { name: 'scope', type: 'string', label: 'Scope', required: false },
          { name: 'description', type: 'string', label: 'Description', required: false },
        ],
        features: {},
      });
    }

    if (!bySlug.has('__erp_user_groups')) {
      entities.push({
        slug: '__erp_user_groups',
        display_name: 'User Groups',
        display_field: 'user_id',
        module: 'shared',
        system: { hidden: true },
        ui: { search: false, csv_import: false, csv_export: false, print: false },
        list: { columns: ['user_id', 'group_id'] },
        fields: [
          { name: 'user_id', type: 'reference', label: 'User', required: true, reference: { entity: '__erp_users', display_field: 'username' } },
          { name: 'group_id', type: 'reference', label: 'Group', required: true, reference: { entity: '__erp_groups', display_field: 'name' } },
        ],
        features: {},
      });
    }

    if (!bySlug.has('__erp_group_permissions')) {
      entities.push({
        slug: '__erp_group_permissions',
        display_name: 'Group Permissions',
        display_field: 'group_id',
        module: 'shared',
        system: { hidden: true },
        ui: { search: false, csv_import: false, csv_export: false, print: false },
        list: { columns: ['group_id', 'permission_id'] },
        fields: [
          { name: 'group_id', type: 'reference', label: 'Group', required: true, reference: { entity: '__erp_groups', display_field: 'name' } },
          { name: 'permission_id', type: 'reference', label: 'Permission', required: true, reference: { entity: '__erp_permissions', display_field: 'key' } },
        ],
        features: {},
      });
    }
  },

  async _generateRootFiles(outputDir, projectId, options = {}) {
    const fs = require('fs').promises;
    const standalone = !!options.standalone;

    if (standalone) {
      try {
        const readmeTpl = await this.brickRepo.getTemplate('standalone/README.md');
        await fs.writeFile(path.join(outputDir, 'README.md'), readmeTpl);
      } catch (e) {
        console.warn('Warning: Could not generate standalone README', e);
      }
      return;
    }

    const dockerCompose = `version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=erpdb
      - POSTGRES_USER=erpuser
      - POSTGRES_PASSWORD=erppassword
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      - PORT=3000
      - PGHOST=postgres
      - PGPORT=5432
      - PGDATABASE=erpdb
      - PGUSER=erpuser
      - PGPASSWORD=erppassword
    command: sh -c "npm run migrate && npm start"

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000/api
    depends_on:
      - backend

volumes:
  postgres_data:
`;
    await fs.writeFile(path.join(outputDir, 'docker-compose.yml'), dockerCompose);

    // Root README
    const readme = `# ${projectId}

This ERP was automatically generated by CustomERP.

## Quick Start (Docker, recommended)

### Windows (PowerShell)
\`\`\`powershell
.\\dev.ps1 start
\`\`\`

### Linux/macOS
\`\`\`bash
chmod +x dev.sh
./dev.sh start
\`\`\`

Services:
- PostgreSQL: http://localhost:5432
- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

## Manual Start (without Docker)

1) Backend
\`\`\`bash
cd backend
npm install
npm run migrate
npm start
\`\`\`

2) Frontend
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

Backend env vars (example):
\`\`\`env
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=erpdb
PGUSER=erpuser
PGPASSWORD=erppassword
\`\`\`

## Commands

- \`start\`: Build and start containers
- \`stop\`: Stop all services
- \`logs\`: View live logs
- \`clean\`: Remove containers and volumes
`;
    await fs.writeFile(path.join(outputDir, 'README.md'), readme);

    // Development Scripts
    // NOTE: Kept for backward-compat; templates are loaded via brickRepo.
    const templateEngine = require('../TemplateEngine'); // Require locally if not passed

    try {
      const devShTemplate = await this.brickRepo.getTemplate('dev.sh.template');
      const devPs1Template = await this.brickRepo.getTemplate('dev.ps1.template');

      const devSh = devShTemplate.replace(/\{\{projectId\}\}/g, projectId);
      const devPs1 = devPs1Template.replace(/\{\{projectId\}\}/g, projectId);

      await fs.writeFile(path.join(outputDir, 'dev.sh'), devSh);
      await fs.writeFile(path.join(outputDir, 'dev.ps1'), devPs1);

      // Make shell script executable (on Unix-like systems)
      try {
        await fs.chmod(path.join(outputDir, 'dev.sh'), '755');
      } catch (e) {
        // Ignore on Windows
      }
    } catch (e) {
      console.warn('Warning: Could not generate dev scripts', e);
    }
  },

  async _applyBackendRuntimeModules(backendDir, sdf, backendEntities) {
    const fs = require('fs').promises;
    const path = require('path');

    const modules = (sdf && sdf.modules) ? sdf.modules : {};
    const scheduled = modules?.scheduled_reports || {};
    const inventoryCfg = this._getInventoryPriorityAConfig(sdf);
    const inventoryPriority = {
      stock_entity: inventoryCfg.stockEntity,
      reservations: {
        enabled: this._isPackEnabled(inventoryCfg.reservations),
        reservation_entity: inventoryCfg.reservations.reservation_entity,
        item_field: inventoryCfg.reservations.item_field,
        quantity_field: inventoryCfg.reservations.quantity_field,
        status_field: inventoryCfg.reservations.status_field,
      },
      transactions: {
        enabled: this._isPackEnabled(inventoryCfg.transactions),
        quantity_field: inventoryCfg.transactions.quantity_field,
      },
      inbound: {
        enabled: this._isPackEnabled(inventoryCfg.inbound),
        purchase_order_entity: inventoryCfg.inbound.purchase_order_entity,
        purchase_order_item_entity: inventoryCfg.inbound.purchase_order_item_entity,
        grn_entity: inventoryCfg.inbound.grn_entity,
        grn_item_entity: inventoryCfg.inbound.grn_item_entity,
      },
      cycle_counting: {
        enabled: this._isPackEnabled(inventoryCfg.cycleCounting),
        session_entity: inventoryCfg.cycleCounting.session_entity,
        line_entity: inventoryCfg.cycleCounting.line_entity,
      },
    };

    const invoiceCfg = this._getInvoicePriorityAConfig(sdf);
    const invoicePriority = {
      invoice_entity: invoiceCfg.invoiceEntity,
      invoice_item_entity: invoiceCfg.itemEntity,
      transactions: {
        enabled: this._isPackEnabled(invoiceCfg.transactions),
        invoice_number_field: invoiceCfg.invoice_number_field,
        idempotency_field: invoiceCfg.idempotency_field,
      },
      payments: {
        enabled: this._isPackEnabled(invoiceCfg.payments),
        payment_entity: invoiceCfg.payments.payment_entity,
        allocation_entity: invoiceCfg.payments.allocation_entity,
      },
      notes: {
        enabled: this._isPackEnabled(invoiceCfg.notes),
        note_entity: invoiceCfg.notes.note_entity,
      },
      lifecycle: {
        enabled: this._isPackEnabled(invoiceCfg.lifecycle),
        status_field: invoiceCfg.status_field,
        statuses: invoiceCfg.lifecycle.statuses,
      },
      calculation_engine: {
        enabled: this._isPackEnabled(invoiceCfg.calculationEngine),
        line_total_field: invoiceCfg.item_line_total_field,
      },
    };

    const hrCfg = this._getHRPriorityAConfig(sdf);
    const hrPriority = {
      employee_entity: hrCfg.employeeEntity,
      leave_entity: hrCfg.leaveEntity,
      leave_engine: {
        enabled: this._isPackEnabled(hrCfg.leaveEngine),
        balance_entity: hrCfg.leaveEngine.balance_entity,
        employee_field: hrCfg.leaveEngine.employee_field,
        leave_type_field: hrCfg.leaveEngine.leave_type_field,
        available_field: hrCfg.leaveEngine.available_field,
        fiscal_year_field: hrCfg.leaveEngine.fiscal_year_field,
      },
      leave_approvals: {
        enabled: this._isPackEnabled(hrCfg.leaveApprovals),
        status_field: hrCfg.leaveApprovals.status_field,
        approver_field: hrCfg.leaveApprovals.approver_field,
        statuses: hrCfg.leaveApprovals.statuses,
      },
      attendance_time: {
        enabled: this._isPackEnabled(hrCfg.attendanceTime),
        attendance_entity: hrCfg.attendanceTime.attendance_entity,
        shift_entity: hrCfg.attendanceTime.shift_entity,
        timesheet_entity: hrCfg.attendanceTime.timesheet_entity,
        work_days: hrCfg.attendanceTime.work_days,
        daily_hours: hrCfg.attendanceTime.daily_hours,
      },
      compensation_ledger: {
        enabled: this._isPackEnabled(hrCfg.compensationLedger),
        ledger_entity: hrCfg.compensationLedger.ledger_entity,
        snapshot_entity: hrCfg.compensationLedger.snapshot_entity,
      },
    };

    // Generate optional runtime config for the backend entrypoint (scheduler, etc.)
    const systemConfig = {
      modules: {
        inventory_priority_a: inventoryPriority,
        invoice_priority_a: invoicePriority,
        hr_priority_a: hrPriority,
        scheduled_reports: {
          enabled: scheduled.enabled === true,
          cron: scheduled.cron || '0 0 * * *',
          target_slug: scheduled.target_slug || '__reports',
          report_type: scheduled.report_type || 'daily_summary',
          entities: Array.isArray(scheduled.entities) ? scheduled.entities : [],
          low_stock: scheduled.low_stock || scheduled.lowStock || null,
          expiry: scheduled.expiry || null,
          inventory_value:
            scheduled.inventory_value ||
            scheduled.inventoryValue ||
            scheduled.valuation ||
            scheduled.inventory_valuation ||
            null,
          movements:
            scheduled.movements ||
            scheduled.movement_summary ||
            scheduled.movementSummary ||
            null,
          entity_snapshots:
            (Array.isArray(scheduled.entity_snapshots) ? scheduled.entity_snapshots : null) ||
            (Array.isArray(scheduled.entitySnapshots) ? scheduled.entitySnapshots : []) ||
            [],
        },
      },
    };

    const acModConfig = (sdf && sdf.modules && sdf.modules.access_control) || {};
    const acEnabled = acModConfig.enabled !== false;
    if (acEnabled) {
      const entitySlugs = (backendEntities || []).map((e) => e && e.slug).filter(Boolean);
      const userGroups = Array.isArray(acModConfig.groups) ? acModConfig.groups : [];
      systemConfig.rbac = { entitySlugs, groups: userGroups };
    }

    const shouldWriteConfig =
      acEnabled ||
      systemConfig.modules.scheduled_reports.enabled === true ||
      systemConfig.modules.inventory_priority_a.reservations.enabled === true ||
      systemConfig.modules.inventory_priority_a.transactions.enabled === true ||
      systemConfig.modules.inventory_priority_a.inbound.enabled === true ||
      systemConfig.modules.inventory_priority_a.cycle_counting.enabled === true ||
      systemConfig.modules.invoice_priority_a.transactions.enabled === true ||
      systemConfig.modules.invoice_priority_a.payments.enabled === true ||
      systemConfig.modules.invoice_priority_a.notes.enabled === true ||
      systemConfig.modules.invoice_priority_a.lifecycle.enabled === true ||
      systemConfig.modules.invoice_priority_a.calculation_engine.enabled === true ||
      systemConfig.modules.hr_priority_a.leave_engine.enabled === true ||
      systemConfig.modules.hr_priority_a.leave_approvals.enabled === true ||
      systemConfig.modules.hr_priority_a.attendance_time.enabled === true ||
      systemConfig.modules.hr_priority_a.compensation_ledger.enabled === true;

    if (shouldWriteConfig) {
      await fs.writeFile(
        path.join(backendDir, 'src/systemConfig.js'),
        'module.exports = ' + JSON.stringify(systemConfig, null, 2) + ';\n'
      );

      if (systemConfig.modules.scheduled_reports.enabled === true) {
        const pkgPath = path.join(backendDir, 'package.json');
        const pkgRaw = await fs.readFile(pkgPath, 'utf8');
        const pkg = JSON.parse(pkgRaw);
        pkg.dependencies = pkg.dependencies || {};
        if (!pkg.dependencies['node-cron']) {
          pkg.dependencies['node-cron'] = '^3.0.3';
        }
        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
      }
    }

    if (acEnabled) {
      const pkgPath = path.join(backendDir, 'package.json');
      const pkgRaw = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgRaw);
      pkg.dependencies = pkg.dependencies || {};
      if (!pkg.dependencies['jsonwebtoken']) {
        pkg.dependencies['jsonwebtoken'] = '^9.0.2';
      }
      if (!pkg.dependencies['bcryptjs']) {
        pkg.dependencies['bcryptjs'] = '^2.4.3';
      }
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
    }
  },
};
