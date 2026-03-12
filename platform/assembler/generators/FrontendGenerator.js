// platform/assembler/generators/FrontendGenerator.js
const fs = require('fs').promises;
const path = require('path');

const { buildDashboardHome } = require('./frontend/dashboardHome');
const { buildEntitiesRegistry } = require('./frontend/entitiesRegistry');
const { buildActivityLogPage } = require('./frontend/activityLogPage');
const { buildReportsPage } = require('./frontend/reportsPage');
const { buildApp } = require('./frontend/app');
const { buildSidebar } = require('./frontend/sidebar');
const { buildInvoiceListPage } = require('./frontend/invoicePages');
const {
  buildEmployeeListPage,
  buildDepartmentListPage,
  buildLeaveListPage,
} = require('./frontend/hrPages');
const {
  buildEntityListPage,
  buildEntityFormPage,
  buildEntityImportPage,
  buildReceivePage,
  buildIssuePage,
  buildAdjustPage,
  buildTransferPage,
  buildLabelsPage,
} = require('./frontend/entityPages');
const {
  buildReservationsPage,
  buildGrnPostingPage,
  buildCycleWorkflowPage,
} = require('./frontend/inventoryPriorityPages');
const {
  buildInvoiceWorkflowPage,
  buildInvoicePaymentsPage,
  buildInvoiceNotesPage,
  buildPaymentWorkflowPage,
  buildNoteWorkflowPage,
} = require('./frontend/invoicePriorityPages');

class FrontendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
    this.modules = {};
    this.moduleMap = {};
    this._moduleDirs = new Set();
  }

  setModules(modules) {
    this.modules = modules && typeof modules === 'object' ? modules : {};
  }

  setModuleMap(moduleMap) {
    this.moduleMap = moduleMap && typeof moduleMap === 'object' ? moduleMap : {};
  }

  _getModuleKey(entity) {
    const raw = entity && (entity.module || entity.module_slug || entity.moduleSlug);
    const cleaned = String(raw || 'inventory').trim().toLowerCase();
    return cleaned || 'inventory';
  }

  _isInventoryOpsEnabled(inv) {
    if (!inv || typeof inv !== 'object') return false;
    if (inv.enabled === true) return true;
    if (inv.enabled === false) return false;
    return Object.keys(inv).some((key) => key !== 'enabled');
  }

  _pickFirstString(...values) {
    for (const value of values) {
      const str = String(value || '').trim();
      if (str) return str;
    }
    return '';
  }

  _isPackEnabled(packCfg) {
    if (packCfg === true) return true;
    if (packCfg === false || packCfg === null || packCfg === undefined) return false;
    if (typeof packCfg === 'object') return packCfg.enabled !== false;
    return false;
  }

  _getInventoryPriorityAConfig(sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const inventory =
      modules.inventory && typeof modules.inventory === 'object'
        ? modules.inventory
        : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const reservations = normalizePack(
      inventory.reservations || inventory.reservation,
      {
        reservation_entity: 'stock_reservations',
        item_field: 'item_id',
        quantity_field: 'quantity',
        status_field: 'status',
        reserved_field: 'reserved_quantity',
        committed_field: 'committed_quantity',
        available_field: 'available_quantity',
      }
    );
    const transactions = normalizePack(
      inventory.transactions || inventory.transaction || inventory.stock_transactions || inventory.stockTransactions,
      {
        quantity_field: reservations.quantity_field || 'quantity',
      }
    );
    const inbound = normalizePack(
      inventory.inbound || inventory.receiving,
      {
        grn_entity: 'goods_receipts',
        grn_item_entity: 'goods_receipt_items',
        grn_item_parent_field: 'goods_receipt_id',
        grn_item_item_field: 'item_id',
        grn_item_received_field: 'received_quantity',
        grn_status_field: 'status',
      }
    );
    const cycleCounting = normalizePack(
      inventory.cycle_counting || inventory.cycleCounting || inventory.cycle_counts || inventory.cycleCounts,
      {
        session_entity: 'cycle_count_sessions',
        line_entity: 'cycle_count_lines',
        line_session_field: 'cycle_count_session_id',
        line_item_field: 'item_id',
        line_expected_field: 'expected_quantity',
        line_counted_field: 'counted_quantity',
        line_variance_field: 'variance_quantity',
      }
    );

    const stockEntity = this._pickFirstString(
      inventory.stock_entity,
      inventory.stockEntity,
      reservations.stock_entity,
      reservations.stockEntity,
      inbound.stock_entity,
      inbound.stockEntity,
      cycleCounting.stock_entity,
      cycleCounting.stockEntity,
      'products'
    );

    reservations.reservation_entity = this._pickFirstString(
      reservations.reservation_entity,
      reservations.reservationEntity,
      'stock_reservations'
    );
    reservations.item_field = this._pickFirstString(
      reservations.item_field,
      reservations.itemField,
      reservations.item_ref_field,
      reservations.itemRefField,
      'item_id'
    );
    reservations.quantity_field = this._pickFirstString(
      reservations.quantity_field,
      reservations.quantityField,
      'quantity'
    );
    reservations.status_field = this._pickFirstString(
      reservations.status_field,
      reservations.statusField,
      'status'
    );
    reservations.reserved_field = this._pickFirstString(
      reservations.reserved_field,
      reservations.reservedField,
      'reserved_quantity'
    );
    reservations.committed_field = this._pickFirstString(
      reservations.committed_field,
      reservations.committedField,
      'committed_quantity'
    );
    reservations.available_field = this._pickFirstString(
      reservations.available_field,
      reservations.availableField,
      'available_quantity'
    );

    transactions.quantity_field = this._pickFirstString(
      transactions.quantity_field,
      transactions.quantityField,
      reservations.quantity_field,
      'quantity'
    );

    inbound.grn_entity = this._pickFirstString(
      inbound.grn_entity,
      inbound.grnEntity,
      'goods_receipts'
    );
    inbound.grn_item_entity = this._pickFirstString(
      inbound.grn_item_entity,
      inbound.grnItemEntity,
      'goods_receipt_items'
    );
    inbound.grn_item_parent_field = this._pickFirstString(
      inbound.grn_item_parent_field,
      inbound.grnItemParentField,
      'goods_receipt_id'
    );
    inbound.grn_item_item_field = this._pickFirstString(
      inbound.grn_item_item_field,
      inbound.grnItemItemField,
      'item_id'
    );
    inbound.grn_item_received_field = this._pickFirstString(
      inbound.grn_item_received_field,
      inbound.grnItemReceivedField,
      'received_quantity'
    );
    inbound.grn_status_field = this._pickFirstString(
      inbound.grn_status_field,
      inbound.grnStatusField,
      'status'
    );

    cycleCounting.session_entity = this._pickFirstString(
      cycleCounting.session_entity,
      cycleCounting.sessionEntity,
      'cycle_count_sessions'
    );
    cycleCounting.line_entity = this._pickFirstString(
      cycleCounting.line_entity,
      cycleCounting.lineEntity,
      'cycle_count_lines'
    );
    cycleCounting.line_session_field = this._pickFirstString(
      cycleCounting.line_session_field,
      cycleCounting.lineSessionField,
      'cycle_count_session_id'
    );
    cycleCounting.line_item_field = this._pickFirstString(
      cycleCounting.line_item_field,
      cycleCounting.lineItemField,
      'item_id'
    );
    cycleCounting.line_expected_field = this._pickFirstString(
      cycleCounting.line_expected_field,
      cycleCounting.lineExpectedField,
      'expected_quantity'
    );
    cycleCounting.line_counted_field = this._pickFirstString(
      cycleCounting.line_counted_field,
      cycleCounting.lineCountedField,
      'counted_quantity'
    );
    cycleCounting.line_variance_field = this._pickFirstString(
      cycleCounting.line_variance_field,
      cycleCounting.lineVarianceField,
      'variance_quantity'
    );

    return {
      stockEntity,
      reservations,
      transactions,
      inbound,
      cycleCounting,
    };
  }

  _getInvoicePriorityAConfig(sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const invoice =
      modules.invoice && typeof modules.invoice === 'object'
        ? modules.invoice
        : {};

    const normalizePack = (rawValue, defaults = {}) => {
      if (rawValue === true) return { ...defaults, enabled: true };
      if (rawValue === false || rawValue === null || rawValue === undefined) {
        return { ...defaults, enabled: false };
      }
      if (typeof rawValue === 'object') {
        return {
          ...defaults,
          ...rawValue,
          enabled: rawValue.enabled !== false,
        };
      }
      return { ...defaults, enabled: false };
    };

    const transactions = normalizePack(
      invoice.transactions || invoice.transaction,
      {
        invoice_entity: 'invoices',
      }
    );
    const payments = normalizePack(
      invoice.payments || invoice.payment,
      {
        payment_entity: 'invoice_payments',
        allocation_entity: 'invoice_payment_allocations',
      }
    );
    const notes = normalizePack(
      invoice.notes || invoice.credit_debit_notes || invoice.creditDebitNotes,
      {
        note_entity: 'invoice_notes',
      }
    );
    const lifecycle = normalizePack(
      invoice.lifecycle || invoice.invoice_lifecycle || invoice.invoiceLifecycle,
      {
        statuses: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
      }
    );
    const calculationEngine = normalizePack(
      invoice.calculation_engine || invoice.calculationEngine || invoice.pricing_engine || invoice.pricingEngine,
      {
        invoice_item_entity: 'invoice_items',
      }
    );

    const invoiceEntity = this._pickFirstString(
      invoice.invoice_entity,
      invoice.invoiceEntity,
      transactions.invoice_entity,
      transactions.invoiceEntity,
      'invoices'
    );
    const paymentEntity = this._pickFirstString(
      payments.payment_entity,
      payments.paymentEntity,
      'invoice_payments'
    );
    const noteEntity = this._pickFirstString(
      notes.note_entity,
      notes.noteEntity,
      'invoice_notes'
    );
    const itemEntity = this._pickFirstString(
      invoice.invoice_item_entity,
      invoice.invoiceItemEntity,
      calculationEngine.invoice_item_entity,
      calculationEngine.invoiceItemEntity,
      'invoice_items'
    );
    lifecycle.statuses = Array.isArray(lifecycle.statuses) && lifecycle.statuses.length
      ? lifecycle.statuses
      : ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'];

    return {
      invoiceEntity,
      paymentEntity,
      noteEntity,
      itemEntity,
      transactions,
      payments,
      notes,
      lifecycle,
      calculationEngine,
    };
  }

  async _ensureModuleDirs(outputDir, moduleKey) {
    if (this._moduleDirs.has(moduleKey)) return;
    const modulePagesDir = path.join(outputDir, 'modules', moduleKey, 'pages');
    await fs.mkdir(modulePagesDir, { recursive: true });
    this._moduleDirs.add(moduleKey);
  }

  async scaffold(outputDir, sdf = {}) {
    const dirs = [
      'src/components',
      'src/components/layout',
      'src/components/tools',
      'src/components/ui',
      'src/config',
      'src/pages',
      'src/services',
      'src/utils',
      'public',
      'modules'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(outputDir, dir), { recursive: true });
    }

    await this._generateBaseFiles(outputDir, sdf);
    await this._generateSharedComponents(outputDir);
    await this._generateModuleComponents(outputDir);
  }

  async _generateBaseFiles(outputDir, sdf) {
    const entities = Array.isArray(sdf.entities) ? sdf.entities : [];
    const wantsQrLabels = entities.some((e) => e && e.labels && e.labels.enabled === true && e.labels.type === 'qrcode');

    // package.json for frontend
    const packageJson = {
      name: "generated-erp-frontend",
      version: "1.0.0",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.20.0",
        axios: "^1.6.0",
        papaparse: "^5.4.1",
        ...(wantsQrLabels ? { qrcode: "^1.5.3", jsqr: "^1.4.0" } : {})
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@types/papaparse": "^5.3.14",
        "@vitejs/plugin-react": "^4.2.0",
        autoprefixer: "^10.4.16",
        postcss: "^8.4.31",
        tailwindcss: "^3.3.5",
        typescript: "^5.2.2",
        vite: "^5.0.0"
      }
    };

    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated ERP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    await fs.writeFile(path.join(outputDir, 'index.html'), indexHtml);

    // main.tsx
    const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/toast';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);`;
    await fs.writeFile(path.join(outputDir, 'src/main.tsx'), mainTsx);

    // index.css (Tailwind)
    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Print support */
@media print {
  .no-print {
    display: none !important;
  }

  body {
    background: white !important;
  }
}
`;
    await fs.writeFile(path.join(outputDir, 'src/index.css'), indexCss);

    // tailwind.config.js
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./modules/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};`;
    await fs.writeFile(path.join(outputDir, 'tailwind.config.js'), tailwindConfig);

    // vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});`;
    await fs.writeFile(path.join(outputDir, 'vite.config.ts'), viteConfig);

    // tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true
      },
      include: ["src", "modules"]
    };
    await fs.writeFile(path.join(outputDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

    // API service
    const apiService = `import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

export default api;`;
    await fs.writeFile(path.join(outputDir, 'src/services/api.ts'), apiService);

    // postcss.config.js
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
    await fs.writeFile(path.join(outputDir, 'postcss.config.js'), postcssConfig);

    // .dockerignore
    const dockerIgnore = `node_modules
dist
.git
`;
    await fs.writeFile(path.join(outputDir, '.dockerignore'), dockerIgnore);

    // Dockerfile (Vite dev server)
    const dockerfile = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
`;
    await fs.writeFile(path.join(outputDir, 'Dockerfile'), dockerfile);
  }

  async _generateSharedComponents(outputDir) {
    // Prefer frontend-bricks templates (keeps generator modular).
    await this.brickRepo.copyFile(
      'frontend-bricks/components/toast.tsx',
      path.join(outputDir, 'src/components/ui/toast.tsx')
    );
    await this.brickRepo.copyFile(
      'frontend-bricks/components/Modal.tsx',
      path.join(outputDir, 'src/components/ui/Modal.tsx')
    );
    await this.brickRepo.copyFile(
      'frontend-bricks/components/ImportCsvTool.tsx',
      path.join(outputDir, 'src/components/tools/ImportCsvTool.tsx')
    );
    await this.brickRepo.copyFile(
      'frontend-bricks/components/ImportCsvModal.tsx',
      path.join(outputDir, 'src/components/tools/ImportCsvModal.tsx')
    );
    await this.brickRepo.copyFile(
      'frontend-bricks/layouts/DashboardLayout.tsx',
      path.join(outputDir, 'src/components/layout/DashboardLayout.tsx')
    );
    await this.brickRepo.copyFile(
      'frontend-bricks/layouts/Topbar.tsx',
      path.join(outputDir, 'src/components/layout/Topbar.tsx')
    );
  }

  async _generateModuleComponents(outputDir) {
    const moduleComponents = [
      [
        'frontend-bricks/components/modules/invoice/InvoiceCard.tsx',
        'src/components/modules/invoice/InvoiceCard.tsx',
      ],
      [
        'frontend-bricks/components/modules/hr/EmployeeCard.tsx',
        'src/components/modules/hr/EmployeeCard.tsx',
      ],
      [
        'frontend-bricks/components/modules/hr/DepartmentCard.tsx',
        'src/components/modules/hr/DepartmentCard.tsx',
      ],
      [
        'frontend-bricks/components/modules/hr/LeaveRequestCard.tsx',
        'src/components/modules/hr/LeaveRequestCard.tsx',
      ],
      [
        'frontend-bricks/components/modules/inventory/InventoryAlertCard.tsx',
        'src/components/modules/inventory/InventoryAlertCard.tsx',
      ],
    ];

    for (const [sourcePath, destPath] of moduleComponents) {
      await this.brickRepo.copyFile(sourcePath, path.join(outputDir, destPath));
    }
  }

  async generateDashboardHome(outputDir, entities, sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const inventoryDash = modules.inventory_dashboard || modules.dashboard || {};

    const lowStockCfgRaw = inventoryDash.low_stock || inventoryDash.lowStock || {};
    const expiryCfgRaw = inventoryDash.expiry || {};
    const activityCfgRaw = modules.activity_log || modules.activityLog || {};

    const lowStockCfg = {
      enabled: lowStockCfgRaw.enabled === true,
      entity: lowStockCfgRaw.entity || 'products',
      quantity_field: lowStockCfgRaw.quantity_field || 'quantity',
      reorder_point_field: lowStockCfgRaw.reorder_point_field || 'reorder_point',
      limit: typeof lowStockCfgRaw.limit === 'number' ? lowStockCfgRaw.limit : 10,
      suggestion_multiplier: typeof lowStockCfgRaw.suggestion_multiplier === 'number' ? lowStockCfgRaw.suggestion_multiplier : 1,
    };

    const expiryCfg = {
      enabled: expiryCfgRaw.enabled === true,
      entity: expiryCfgRaw.entity || 'products',
      expiry_field: expiryCfgRaw.expiry_field || 'expiry_date',
      within_days: typeof expiryCfgRaw.within_days === 'number' ? expiryCfgRaw.within_days : 30,
      limit: typeof expiryCfgRaw.limit === 'number' ? expiryCfgRaw.limit : 10,
    };

    const activityCfg = {
      enabled: activityCfgRaw.enabled === true,
      limit: typeof activityCfgRaw.limit === 'number' ? activityCfgRaw.limit : 15,
    };

    const scheduledReportsCfg = modules.scheduled_reports || modules.scheduledReports || {};
    const enableReportsPage = scheduledReportsCfg.enabled === true;

    const dashboardHome = buildDashboardHome({
      lowStockCfg,
      expiryCfg,
      activityCfg,
      enableReportsPage,
    });
    await fs.writeFile(path.join(outputDir, 'src/pages/DashboardHome.tsx'), dashboardHome);
  }

  async generateApp(outputDir, entities, sdf = {}) {
    const visibleEntities = (entities || []).filter((e) => e && !String(e.slug || '').startsWith('__') && !(e.system && e.system.hidden));
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const enableActivityLog = (modules.activity_log || modules.activityLog || {}).enabled === true;
    const enableReports = (modules.scheduled_reports || modules.scheduledReports || {}).enabled === true;
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const invoicePriorityCfg = this._getInvoicePriorityAConfig(sdf);
    const reservationsEnabled = this._isPackEnabled(priorityCfg.reservations);
    const inboundEnabled = this._isPackEnabled(priorityCfg.inbound);
    const cycleEnabled = this._isPackEnabled(priorityCfg.cycleCounting);
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);

    // Shared entity registry (navigation + display fields)
    const entityRegistry = buildEntitiesRegistry({
      visibleEntities,
      escapeJsString: (s) => this._escapeJsString(s),
      capitalize: (s) => this._capitalize(s),
      guessDisplayField: (e) => this._guessDisplayField(e),
    });
    await fs.writeFile(path.join(outputDir, 'src/config/entities.ts'), entityRegistry);

    // Ensure dashboard home exists after ENTITIES is generated
    await this.generateDashboardHome(outputDir, visibleEntities, sdf);

    if (enableActivityLog) {
      const activityLogPage = buildActivityLogPage();
      await fs.writeFile(path.join(outputDir, 'src/pages/ActivityLogPage.tsx'), activityLogPage);
    }

    if (enableReports) {
      const scheduledCfg = modules.scheduled_reports || modules.scheduledReports || {};
      const reportsPage = buildReportsPage({ scheduledCfg });
      await fs.writeFile(path.join(outputDir, 'src/pages/ReportsPage.tsx'), reportsPage);
    }

    const toolImports = [
      enableActivityLog ? `import ActivityLogPage from './pages/ActivityLogPage';` : '',
      enableReports ? `import ReportsPage from './pages/ReportsPage';` : '',
    ].filter(Boolean).join('\n');

    const imports = visibleEntities
      .map((e) => {
        const cap = this._capitalize(e.slug);
        const moduleKey = this._getModuleKey(e);
        const modulePageBase = `../modules/${moduleKey}/pages/${cap}`;
        const wantImport = (e.ui || {}).csv_import !== false;
        const inv = e.inventory_ops || e.inventoryOps || {};
        const invEnabled = this._isInventoryOpsEnabled(inv);
        const issueCfg = inv.issue || inv.sell || inv.issue_stock || inv.issueStock || {};
        const enableIssue = invEnabled && issueCfg.enabled === true;
        const canTransfer =
          invEnabled &&
          (inv.transfer?.enabled === true ||
            (inv.transfer?.enabled !== false &&
              ((e.features && e.features.multi_location) ||
                (Array.isArray(e.fields) && e.fields.some((f) => f && String(f.name || '').includes('location'))))));
        const enableReceive = invEnabled && (inv.receive?.enabled !== false);
        const enableAdjust = invEnabled && (inv.adjust?.enabled !== false);
        const labels = e.labels || {};
        const enableLabels = labels.enabled === true && labels.type === 'qrcode';
        const enableReservationsPage =
          reservationsEnabled &&
          moduleKey === 'inventory' &&
          String(e.slug || '') === String(priorityCfg.stockEntity || '');
        const enableGrnPostingPage =
          inboundEnabled &&
          moduleKey === 'inventory' &&
          String(e.slug || '') === String(priorityCfg.inbound.grn_entity || '');
        const enableCycleWorkflowPage =
          cycleEnabled &&
          moduleKey === 'inventory' &&
          String(e.slug || '') === String(priorityCfg.cycleCounting.session_entity || '');
        const enableInvoiceWorkflowPage =
          invoiceTransactionsEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
        const enableInvoicePaymentsPage =
          invoicePaymentsEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
        const enableInvoiceNotesPage =
          invoiceNotesEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
        const enablePaymentWorkflowPage =
          invoicePaymentsEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.paymentEntity || 'invoice_payments');
        const enableNoteWorkflowPage =
          invoiceNotesEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.noteEntity || 'invoice_notes');
        return [
          `import ${cap}Page from '${modulePageBase}Page';`,
          `import ${cap}FormPage from '${modulePageBase}FormPage';`,
          wantImport ? `import ${cap}ImportPage from '${modulePageBase}ImportPage';` : '',
          enableReceive ? `import ${cap}ReceivePage from '${modulePageBase}ReceivePage';` : '',
          enableIssue ? `import ${cap}IssuePage from '${modulePageBase}IssuePage';` : '',
          enableAdjust ? `import ${cap}AdjustPage from '${modulePageBase}AdjustPage';` : '',
          canTransfer ? `import ${cap}TransferPage from '${modulePageBase}TransferPage';` : '',
          enableLabels ? `import ${cap}LabelsPage from '${modulePageBase}LabelsPage';` : '',
          enableReservationsPage ? `import ${cap}ReservationsPage from '${modulePageBase}ReservationsPage';` : '',
          enableGrnPostingPage ? `import ${cap}PostingPage from '${modulePageBase}PostingPage';` : '',
          enableCycleWorkflowPage ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
          enableInvoiceWorkflowPage ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
          enableInvoicePaymentsPage ? `import ${cap}PaymentsPage from '${modulePageBase}PaymentsPage';` : '',
          enableInvoiceNotesPage ? `import ${cap}NotesPage from '${modulePageBase}NotesPage';` : '',
          enablePaymentWorkflowPage ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
          enableNoteWorkflowPage ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
        ].filter(Boolean).join('\n');
      })
      .join('\n');

    const toolRoutes = [
      enableActivityLog ? `        <Route path="/activity" element={<ActivityLogPage />} />` : '',
      enableReports ? `        <Route path="/reports" element={<ReportsPage />} />` : '',
    ].filter(Boolean).join('\n');

    const routes = visibleEntities
      .map((e) => {
        const cap = this._capitalize(e.slug);
        const moduleKey = this._getModuleKey(e);
        const wantImport = (e.ui || {}).csv_import !== false;
        const inv = e.inventory_ops || e.inventoryOps || {};
        const invEnabled = this._isInventoryOpsEnabled(inv);
        const issueCfg = inv.issue || inv.sell || inv.issue_stock || inv.issueStock || {};
        const enableIssue = invEnabled && issueCfg.enabled === true;
        const canTransfer =
          invEnabled &&
          (inv.transfer?.enabled === true ||
            (inv.transfer?.enabled !== false &&
              ((e.features && e.features.multi_location) ||
                (Array.isArray(e.fields) && e.fields.some((f) => f && String(f.name || '').includes('location'))))));
        const enableReceive = invEnabled && (inv.receive?.enabled !== false);
        const enableAdjust = invEnabled && (inv.adjust?.enabled !== false);
        const labels = e.labels || {};
        const enableLabels = labels.enabled === true && labels.type === 'qrcode';
        const enableReservationsPage =
          reservationsEnabled &&
          moduleKey === 'inventory' &&
          String(e.slug || '') === String(priorityCfg.stockEntity || '');
        const enableGrnPostingPage =
          inboundEnabled &&
          moduleKey === 'inventory' &&
          String(e.slug || '') === String(priorityCfg.inbound.grn_entity || '');
        const enableCycleWorkflowPage =
          cycleEnabled &&
          moduleKey === 'inventory' &&
          String(e.slug || '') === String(priorityCfg.cycleCounting.session_entity || '');
        const enableInvoiceWorkflowPage =
          invoiceTransactionsEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
        const enableInvoicePaymentsPage =
          invoicePaymentsEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
        const enableInvoiceNotesPage =
          invoiceNotesEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
        const enablePaymentWorkflowPage =
          invoicePaymentsEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.paymentEntity || 'invoice_payments');
        const enableNoteWorkflowPage =
          invoiceNotesEnabled &&
          moduleKey === 'invoice' &&
          String(e.slug || '') === String(invoicePriorityCfg.noteEntity || 'invoice_notes');
        return [
          `          <Route path="/${e.slug}" element={<${cap}Page />} />`,
          `          <Route path="/${e.slug}/new" element={<${cap}FormPage />} />`,
          `          <Route path="/${e.slug}/:id/edit" element={<${cap}FormPage />} />`,
          wantImport ? `          <Route path="/${e.slug}/import" element={<${cap}ImportPage />} />` : '',
          enableReceive ? `          <Route path="/${e.slug}/receive" element={<${cap}ReceivePage />} />` : '',
          enableIssue ? `          <Route path="/${e.slug}/issue" element={<${cap}IssuePage />} />` : '',
          enableAdjust ? `          <Route path="/${e.slug}/adjust" element={<${cap}AdjustPage />} />` : '',
          canTransfer ? `          <Route path="/${e.slug}/transfer" element={<${cap}TransferPage />} />` : '',
          enableLabels ? `          <Route path="/${e.slug}/labels" element={<${cap}LabelsPage />} />` : '',
          enableReservationsPage ? `          <Route path="/${e.slug}/reservations" element={<${cap}ReservationsPage />} />` : '',
          enableGrnPostingPage ? `          <Route path="/${e.slug}/posting" element={<${cap}PostingPage />} />` : '',
          enableCycleWorkflowPage ? `          <Route path="/${e.slug}/workflow" element={<${cap}WorkflowPage />} />` : '',
          enableInvoiceWorkflowPage ? `          <Route path="/${e.slug}/workflow" element={<${cap}WorkflowPage />} />` : '',
          enableInvoicePaymentsPage ? `          <Route path="/${e.slug}/payments" element={<${cap}PaymentsPage />} />` : '',
          enableInvoiceNotesPage ? `          <Route path="/${e.slug}/notes" element={<${cap}NotesPage />} />` : '',
          enablePaymentWorkflowPage ? `          <Route path="/${e.slug}/workflow" element={<${cap}WorkflowPage />} />` : '',
          enableNoteWorkflowPage ? `          <Route path="/${e.slug}/workflow" element={<${cap}WorkflowPage />} />` : '',
        ].filter(Boolean).join('\n');
      })
      .join('\n');

    const appContent = buildApp({ toolImports, imports, toolRoutes, routes });

    await fs.writeFile(path.join(outputDir, 'src/App.tsx'), appContent);
  }

  async generateSidebar(outputDir, entities, sdf = {}) {
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const enableActivityLog = (modules.activity_log || modules.activityLog || {}).enabled === true;
    const enableReports = (modules.scheduled_reports || modules.scheduledReports || {}).enabled === true;
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const invoicePriorityCfg = this._getInvoicePriorityAConfig(sdf);
    const reservationsEnabled = this._isPackEnabled(priorityCfg.reservations);
    const inboundEnabled = this._isPackEnabled(priorityCfg.inbound);
    const cycleEnabled = this._isPackEnabled(priorityCfg.cycleCounting);
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);
    const availableSlugs = new Set((entities || []).map((e) => String((e && e.slug) || '')).filter(Boolean));

    const toolsBlock = (enableActivityLog || enableReports)
      ? `
        <div className="my-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Tools</div>
        ${enableActivityLog ? `
        <Link
          to="/activity"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname === '/activity' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Activity Log
        </Link>` : ''}
        ${enableReports ? `
        <Link
          to="/reports"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname === '/reports' ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Reports
        </Link>` : ''}
      `
      : '';

    const workflowLinks = [];
    if (reservationsEnabled && availableSlugs.has(String(priorityCfg.stockEntity || ''))) {
      workflowLinks.push({ path: `/${priorityCfg.stockEntity}/reservations`, label: 'Reservations' });
    }
    if (inboundEnabled && availableSlugs.has(String(priorityCfg.inbound.grn_entity || ''))) {
      workflowLinks.push({ path: `/${priorityCfg.inbound.grn_entity}/posting`, label: 'PO / GRN Posting' });
    }
    if (cycleEnabled && availableSlugs.has(String(priorityCfg.cycleCounting.session_entity || ''))) {
      workflowLinks.push({ path: `/${priorityCfg.cycleCounting.session_entity}/workflow`, label: 'Cycle Count Workflow' });
    }
    const invoiceWorkflowLinks = [];
    if (invoiceTransactionsEnabled && availableSlugs.has(String(invoicePriorityCfg.invoiceEntity || ''))) {
      invoiceWorkflowLinks.push({ path: `/${invoicePriorityCfg.invoiceEntity}/workflow`, label: 'Invoice Lifecycle' });
    }
    if (invoicePaymentsEnabled && availableSlugs.has(String(invoicePriorityCfg.invoiceEntity || ''))) {
      invoiceWorkflowLinks.push({ path: `/${invoicePriorityCfg.invoiceEntity}/payments`, label: 'Invoice Payments' });
    }
    if (invoiceNotesEnabled && availableSlugs.has(String(invoicePriorityCfg.invoiceEntity || ''))) {
      invoiceWorkflowLinks.push({ path: `/${invoicePriorityCfg.invoiceEntity}/notes`, label: 'Invoice Notes' });
    }
    if (invoicePaymentsEnabled && availableSlugs.has(String(invoicePriorityCfg.paymentEntity || ''))) {
      invoiceWorkflowLinks.push({ path: `/${invoicePriorityCfg.paymentEntity}/workflow`, label: 'Payment Posting' });
    }
    if (invoiceNotesEnabled && availableSlugs.has(String(invoicePriorityCfg.noteEntity || ''))) {
      invoiceWorkflowLinks.push({ path: `/${invoicePriorityCfg.noteEntity}/workflow`, label: 'Note Posting' });
    }

    const workflowBlock = workflowLinks.length
      ? `
        <div className="my-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Inventory Workflows</div>
        ${workflowLinks.map((entry) => `
        <Link
          to="${entry.path}"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname.startsWith('${entry.path}') ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          ${entry.label}
        </Link>`).join('')}
      `
      : '';
    const invoiceWorkflowBlock = invoiceWorkflowLinks.length
      ? `
        <div className="my-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Invoice Workflows</div>
        ${invoiceWorkflowLinks.map((entry) => `
        <Link
          to="${entry.path}"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname.startsWith('${entry.path}') ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          ${entry.label}
        </Link>`).join('')}
      `
      : '';

    const fullToolsBlock = [toolsBlock, workflowBlock, invoiceWorkflowBlock].filter(Boolean).join('\n');

    const sidebarContent = buildSidebar({ 
      toolsBlock: fullToolsBlock,
      moduleMap: this.moduleMap 
    });

    await fs.writeFile(path.join(outputDir, 'src/components/Sidebar.tsx'), sidebarContent);
  }

  async generateEntityPage(outputDir, entity, allEntities, sdf = {}) {
    const moduleKey = this._getModuleKey(entity);
    await this._ensureModuleDirs(outputDir, moduleKey);
    const modulePagesDir = path.join(outputDir, 'modules', moduleKey, 'pages');
    const importBase = '../../../src';
    const invoicePriorityCfg = this._getInvoicePriorityAConfig(sdf);
    const isInvoiceEntity =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
    const rawInvoiceConfig = sdf && sdf.modules ? sdf.modules.invoice : null;
    const invoiceConfig = rawInvoiceConfig && typeof rawInvoiceConfig === 'object' ? rawInvoiceConfig : {};
    const enablePrintInvoice =
      isInvoiceEntity &&
      ((entity.features && (entity.features.print_invoice === true || entity.features.printInvoice === true)) || false);

    // HR entity detection
    const isHrModule = moduleKey === 'hr';
    const entitySlug = String(entity.slug || '');
    const isEmployeeEntity = isHrModule && entitySlug === 'employees';
    const isDepartmentEntity = isHrModule && entitySlug === 'departments';
    const isLeaveEntity = isHrModule && (entitySlug === 'leaves' || entitySlug === 'leave_requests');
    const rawHrConfig = sdf && sdf.modules ? sdf.modules.hr : null;
    const hrConfig = rawHrConfig && typeof rawHrConfig === 'object' ? rawHrConfig : {};
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const transactionsEnabled = this._isPackEnabled(priorityCfg.transactions);
    const reservationsEnabled = this._isPackEnabled(priorityCfg.reservations);
    const inboundEnabled = this._isPackEnabled(priorityCfg.inbound);
    const cycleEnabled = this._isPackEnabled(priorityCfg.cycleCounting);
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);

    const entityName = this._capitalize(entity.slug);
    const fields = Array.isArray(entity.fields) ? entity.fields : [];

    const fieldDefs = this._generateFieldDefinitions(fields, entity.features || {}, allEntities);

    const ui = entity.ui || {};
    const enableSearch = ui.search !== false;
    const enableCsvImport = ui.csv_import !== false;
    const enableCsvExport = ui.csv_export !== false;
    const enablePrint = ui.print !== false;

    // Tier 2 optional features (per-entity)
    const bulk = entity.bulk_actions || entity.bulkActions || {};
    const enableBulkActions = bulk.enabled === true;
    const enableBulkDelete = enableBulkActions && bulk.delete !== false;
    const bulkUpdateFields = Array.isArray(bulk.update_fields) ? bulk.update_fields : [];
    const enableBulkUpdate = enableBulkActions && bulkUpdateFields.length > 0;

    const inv = entity.inventory_ops || entity.inventoryOps || {};
    const enableInventoryOps = this._isInventoryOpsEnabled(inv);
    const enableReceive = enableInventoryOps && (inv.receive?.enabled !== false);
    const enableAdjust = enableInventoryOps && (inv.adjust?.enabled !== false);
    const issueCfg = inv.issue || inv.sell || inv.issue_stock || inv.issueStock || {};
    const enableIssue = enableInventoryOps && issueCfg.enabled === true;
    const issueLabel =
      issueCfg.label ||
      issueCfg.display_name ||
      issueCfg.displayName ||
      issueCfg.name ||
      'Sell';
    const quickCfg = inv.quick_actions || inv.quickActions || {};
    const quickAll = quickCfg === true;
    const enableQuickReceive =
      enableReceive &&
      (quickAll ||
        quickCfg.receive === true ||
        quickCfg.add === true ||
        quickCfg.in === true);
    const enableQuickIssue =
      enableIssue &&
      (quickAll ||
        quickCfg.issue === true ||
        quickCfg.sell === true ||
        quickCfg.out === true);
    const canTransfer =
      enableInventoryOps &&
      (inv.transfer?.enabled === true ||
        (inv.transfer?.enabled !== false &&
          ((entity.features && entity.features.multi_location) ||
            (fields.some((f) => f && String(f.name || '').includes('location'))))));

    const labels = entity.labels || {};
    const enableQrLabels = labels.enabled === true && labels.type === 'qrcode';

    // Detect mixin capabilities for UI support
    const mixinConfig = entity.mixins || {};
    const hasReservationMixin = fields.some((f) => 
      f && (f.name === 'reserved_quantity' || f.name === 'committed_quantity' || f.name === 'available_quantity')
    );
    const hasReservationFields = hasReservationMixin || (mixinConfig.inventory_reservation || mixinConfig.inventoryReservation);

    const hasStatusField = fields.some((f) => f && f.name === 'status');
    let statusTransitions = null;
    if (hasStatusField) {
      // Check for lifecycle mixin config
      const invLifecycle = mixinConfig.inventory_lifecycle || mixinConfig.inventoryLifecycle;
      const invoiceLifecycle = mixinConfig.invoice_lifecycle || mixinConfig.invoiceLifecycle;
      const hrEmployeeStatus = mixinConfig.hr_employee_status || mixinConfig.hrEmployeeStatus;
      const hrLeaveApproval = mixinConfig.hr_leave_approval || mixinConfig.hrLeaveApproval;

      if (invLifecycle && invLifecycle.transitions) {
        statusTransitions = invLifecycle.transitions;
      } else if (invLifecycle && invLifecycle.use_default_transitions) {
        statusTransitions = {
          Draft: ['Active', 'Obsolete'],
          Active: ['Obsolete'],
          Obsolete: [],
        };
      } else if (invoiceLifecycle) {
        const custom = invoiceLifecycle.transitions;
        statusTransitions = custom || {
          Draft: ['Sent', 'Cancelled'],
          Sent: ['Paid', 'Overdue', 'Cancelled'],
          Overdue: ['Paid', 'Cancelled'],
          Paid: [],
          Cancelled: [],
        };
      } else if (hrEmployeeStatus) {
        const custom = hrEmployeeStatus.transitions;
        statusTransitions = custom || {
          Active: ['On Leave', 'Terminated'],
          'On Leave': ['Active', 'Terminated'],
          Terminated: [],
        };
      } else if (hrLeaveApproval) {
        const custom = hrLeaveApproval.transitions;
        statusTransitions = custom || {
          Pending: ['Approved', 'Rejected'],
          Approved: [],
          Rejected: [],
        };
      }
    }

    // Check for approval workflow (HR leave requests)
    const isLeaveApprovalEntity = isLeaveEntity && hasStatusField;
    const approvalConfig = isLeaveApprovalEntity ? { statusField: 'status', actions: ['approve', 'reject'] } : null;

    const configuredColumns = Array.isArray(entity.list && entity.list.columns) ? entity.list.columns : null;
    const defaultColumns = fields.filter((f) => f && f.name !== 'id').slice(0, 5).map((f) => f.name);
    const finalColumns = (configuredColumns && configuredColumns.length ? configuredColumns : defaultColumns).filter((c) => c && c !== 'id');

    const tableColumns = finalColumns
      .map((colName) => {
        const defField = fields.find((f) => f && f.name === colName);
        const label = this._escapeJsString(defField && defField.label ? String(defField.label) : this._formatLabel(colName));
        return `    { key: '${colName}', label: '${label}' },`;
      })
      .join('\n');

    const listPageContent = isInvoiceEntity
      ? buildInvoiceListPage({
          entity,
          entityName,
          importBase,
          invoiceConfig,
          invoicePriorityCfg,
          title: this._escapeJsString(entity.display_name || entityName),
        })
      : isEmployeeEntity
      ? buildEmployeeListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
          title: this._escapeJsString(entity.display_name || entityName),
        })
      : isDepartmentEntity
      ? buildDepartmentListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
          title: this._escapeJsString(entity.display_name || entityName),
        })
      : isLeaveEntity
      ? buildLeaveListPage({
          entity,
          entityName,
          importBase,
          hrConfig,
          title: this._escapeJsString(entity.display_name || entityName),
        })
      : buildEntityListPage({
          entity,
          entityName,
          fieldDefs,
          tableColumns,
          enableSearch,
          enableCsvImport,
          enableCsvExport,
          enablePrint,
          enableReceive,
          enableQuickReceive,
          enableIssue,
          enableQuickIssue,
          issueLabel,
          enableAdjust,
          canTransfer,
          enableQrLabels,
          enableBulkActions,
          enableBulkDelete,
          enableBulkUpdate,
          bulkUpdateFields,
          escapeJsString: (s) => this._escapeJsString(s),
          importBase,
          hasReservationFields,
          hasStatusField,
        });

    // Optional embedded children/line-items sections (generic)
    const childSections = [];
    if (Array.isArray(entity.children) && entity.children.length) {
      for (const ch of entity.children) {
        if (!ch || typeof ch !== 'object') continue;
        const childSlug = String(ch.entity || ch.slug || '').trim();
        const foreignKey = String(ch.foreign_key || ch.foreignKey || '').trim();
        if (!childSlug || !foreignKey) continue;

        const childEntity = (allEntities || []).find((e) => e && String(e.slug) === childSlug);
        if (!childEntity) continue;

        const childFields = Array.isArray(childEntity.fields) ? childEntity.fields : [];
        const rawCols = Array.isArray(ch.columns) ? ch.columns : (Array.isArray(childEntity.list && childEntity.list.columns) ? childEntity.list.columns : null);
        const fallbackCols = childFields.filter((f) => f && f.name !== 'id' && f.name !== foreignKey).slice(0, 4).map((f) => f.name);
        const cols = (rawCols && rawCols.length ? rawCols : fallbackCols)
          .map(String)
          .filter((c) => c && c !== 'id');

        const columnDefs = cols.map((colName) => {
          const defField = childFields.find((f) => f && f.name === colName);
          const label = this._escapeJsString(defField && defField.label ? String(defField.label) : this._formatLabel(colName));
          const rawOptions = defField ? (defField.options ?? defField.enum ?? defField.allowed_values ?? defField.allowedValues) : null;
          const options = Array.isArray(rawOptions) ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean) : null;
          const isReference = defField && (defField.type === 'reference' || String(defField.name || '').endsWith('_id') || String(defField.name || '').endsWith('_ids'));
          let referenceEntity = null;
          if (isReference) {
            const explicitRef = defField.reference_entity || defField.referenceEntity;
            const inferredBase = String(defField.name).replace(/_ids?$/, '');
            const baseName = String(explicitRef || inferredBase);
            const targetEntity = (allEntities || []).find((e) =>
              e.slug === baseName ||
              e.slug === baseName + 's' ||
              e.slug === baseName + 'es' ||
              (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
              e.slug.startsWith(baseName)
            );
            referenceEntity = targetEntity ? targetEntity.slug : (explicitRef ? String(explicitRef) : null);
          }
          const multiple = defField && (defField.multiple === true || defField.is_array === true || String(defField.name || '').endsWith('_ids'));
          return {
            key: colName,
            label,
            referenceEntity,
            multiple,
          };
        });

        // DynamicForm field defs for child create/edit in modal (exclude FK; we'll enforce it in submit)
        const childFormFields = this._generateFieldDefinitions(
          childFields.filter((f) => f && f.name !== foreignKey),
          childEntity.features || {},
          allEntities
        );

        childSections.push({
          childSlug,
          foreignKey,
          label: String(ch.label || childEntity.display_name || this._formatLabel(childSlug)),
          columns: columnDefs,
          formFields: childFormFields,
        });
      }
    }

    const formPageContent = buildEntityFormPage({
      entity,
      entityName,
      fieldDefs,
      childSections,
      escapeJsString: (s) => this._escapeJsString(s),
      importBase,
      invoiceConfig: isInvoiceEntity ? invoiceConfig : null,
      enablePrintInvoice,
      statusTransitions,
      hasReservationFields,
      approvalConfig,
    });

    await fs.writeFile(path.join(modulePagesDir, `${entityName}Page.tsx`), listPageContent);
    await fs.writeFile(path.join(modulePagesDir, `${entityName}FormPage.tsx`), formPageContent);

    if (enableCsvImport) {
      const importPageContent = buildEntityImportPage({
        entity,
        entityName,
        fieldDefs,
        escapeJsString: (s) => this._escapeJsString(s),
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ImportPage.tsx`), importPageContent);
    }

    // ===================== Tier 2: Inventory ops wizards (optional) =====================
    if (enableInventoryOps) {
      const singular = String(entity.slug).endsWith('s') ? String(entity.slug).slice(0, -1) : String(entity.slug);
      const rawMode = inv.quantity_mode || inv.quantityMode || inv.movement_quantity_mode || inv.movementQuantityMode || 'delta';
      const modeStr = String(rawMode || 'delta').toLowerCase();
      const normalizedMode = (modeStr === 'absolute' || modeStr === 'abs') ? 'absolute' : 'delta';
      const invCfg = {
        movement_entity: inv.movement_entity || inv.movementEntity || 'stock_movements',
        location_entity: inv.location_entity || inv.locationEntity || 'locations',
        quantity_field: inv.quantity_field || inv.quantityField || 'quantity',
        location_ids_field: inv.location_ids_field || inv.locationIdsField || 'location_ids',
        quantity_mode: normalizedMode,
        use_workflow_api:
          transactionsEnabled &&
          String(entity.slug || '') === String(priorityCfg.stockEntity || ''),
        issue: {
          allow_negative_stock:
            issueCfg.allow_negative_stock === true ||
            issueCfg.allowNegativeStock === true ||
            false,
        },
        fields: {
          item_ref: (inv.fields && (inv.fields.item_ref || inv.fields.itemRef)) || inv.item_ref_field || inv.itemRefField || `${singular}_id`,
          qty: (inv.fields && inv.fields.qty) || inv.qty_field || inv.qtyField || 'quantity',
          type: (inv.fields && inv.fields.type) || inv.type_field || inv.typeField || 'movement_type',
          location: (inv.fields && (inv.fields.location || inv.fields.location_id || inv.fields.locationId)) || inv.location_field || inv.locationField || 'location_id',
          reason: (inv.fields && inv.fields.reason) || inv.reason_field || inv.reasonField || 'reason',
          reference_number:
            (inv.fields && (inv.fields.reference_number || inv.fields.referenceNumber)) ||
            inv.reference_number_field ||
            inv.referenceNumberField ||
            'reference_number',
          date: (inv.fields && (inv.fields.date || inv.fields.movement_date || inv.fields.movementDate)) || inv.date_field || inv.dateField || 'movement_date',
          from_location:
            (inv.fields && (inv.fields.from_location || inv.fields.fromLocation || inv.fields.from_location_id || inv.fields.fromLocationId)) ||
            inv.from_location_field ||
            inv.fromLocationField ||
            'from_location_id',
          to_location:
            (inv.fields && (inv.fields.to_location || inv.fields.toLocation || inv.fields.to_location_id || inv.fields.toLocationId)) ||
            inv.to_location_field ||
            inv.toLocationField ||
            'to_location_id',
        },
        movement_types: {
          receive: (inv.movement_types && (inv.movement_types.receive || inv.movement_types.in)) || inv.receive_type || inv.receiveType || 'IN',
          issue: (inv.movement_types && (inv.movement_types.issue || inv.movement_types.out)) || inv.issue_type || inv.issueType || 'OUT',
          adjust: (inv.movement_types && inv.movement_types.adjust) || inv.adjust_type || inv.adjustType || 'ADJUSTMENT',
          adjust_in:
            (inv.movement_types && (inv.movement_types.adjust_in || inv.movement_types.adjustIn)) ||
            inv.adjust_in_type ||
            inv.adjustInType ||
            null,
          adjust_out:
            (inv.movement_types && (inv.movement_types.adjust_out || inv.movement_types.adjustOut)) ||
            inv.adjust_out_type ||
            inv.adjustOutType ||
            null,
          transfer_out:
            (inv.movement_types && (inv.movement_types.transfer_out || inv.movement_types.transferOut)) ||
            inv.transfer_out_type ||
            inv.transferOutType ||
            'TRANSFER_OUT',
          transfer_in:
            (inv.movement_types && (inv.movement_types.transfer_in || inv.movement_types.transferIn)) ||
            inv.transfer_in_type ||
            inv.transferInType ||
            'TRANSFER_IN',
        },
        adjust: {
          reason_codes:
            (inv.adjust && (inv.adjust.reason_codes || inv.adjust.reasonCodes)) ||
            inv.reason_codes ||
            inv.reasonCodes ||
            ['COUNT', 'DAMAGED', 'EXPIRED', 'RETURN', 'OTHER'],
        },
      };

      const explicitEntityLocationField =
        inv.location_ids_field ||
        inv.locationIdsField ||
        inv.location_id_field ||
        inv.locationIdField ||
        inv.entity_location_field ||
        inv.entityLocationField ||
        null;

      const entityHasLocationIds = fields.some((f) => f && f.name === 'location_ids');
      const entityHasLocationId = fields.some((f) => f && f.name === 'location_id');
      const entityLocationField =
        explicitEntityLocationField ||
        (entityHasLocationIds ? 'location_ids' : (entityHasLocationId ? 'location_id' : null));

      if (enableReceive) {
        const receivePageContent = buildReceivePage({ entity, entityName, invCfg, entityLocationField, importBase });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}ReceivePage.tsx`), receivePageContent);
      }

      if (enableIssue) {
        const issuePageContent = buildIssuePage({
          entity,
          entityName,
          invCfg,
          entityLocationField,
          issueLabel,
          escapeJsString: (s) => this._escapeJsString(s),
          importBase,
        });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}IssuePage.tsx`), issuePageContent);
      }

      if (enableAdjust) {
        const adjustPageContent = buildAdjustPage({ entity, entityName, invCfg, importBase });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}AdjustPage.tsx`), adjustPageContent);
      }

      if (canTransfer) {
        const transferPageContent = buildTransferPage({ entity, entityName, invCfg, entityLocationField, importBase });
        await fs.writeFile(path.join(modulePagesDir, `${entityName}TransferPage.tsx`), transferPageContent);
      }
    }

    // ===================== Tier 2: QR labels (optional) =====================
    if (enableQrLabels) {
      const labelsCfg = {
        enabled: labels.enabled === true,
        type: labels.type || 'qrcode',
        value_field: labels.value_field || labels.valueField || this._guessDisplayField(entity),
        text_fields: Array.isArray(labels.text_fields) ? labels.text_fields : (Array.isArray(labels.textFields) ? labels.textFields : []),
        columns: typeof labels.columns === 'number' ? labels.columns : 3,
        size: typeof labels.size === 'number' ? labels.size : 160,
        scan: labels.scan === true,
      };

      const labelsPageContent = buildLabelsPage({ entity, entityName, labelsCfg, importBase });

      await fs.writeFile(path.join(modulePagesDir, `${entityName}LabelsPage.tsx`), labelsPageContent);
    }

    // ===================== Inventory Priority A workflow pages =====================
    const isReservationHost =
      moduleKey === 'inventory' &&
      reservationsEnabled &&
      String(entity.slug || '') === String(priorityCfg.stockEntity || '');
    const isGrnHost =
      moduleKey === 'inventory' &&
      inboundEnabled &&
      String(entity.slug || '') === String(priorityCfg.inbound.grn_entity || '');
    const isCycleSessionHost =
      moduleKey === 'inventory' &&
      cycleEnabled &&
      String(entity.slug || '') === String(priorityCfg.cycleCounting.session_entity || '');

    if (isReservationHost) {
      const reservationsPageContent = buildReservationsPage({
        entity,
        entityName,
        importBase,
        reservationsCfg: priorityCfg.reservations,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}ReservationsPage.tsx`), reservationsPageContent);
    }

    if (isGrnHost) {
      const postingPageContent = buildGrnPostingPage({
        entity,
        entityName,
        importBase,
        inboundCfg: priorityCfg.inbound,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}PostingPage.tsx`), postingPageContent);
    }

    if (isCycleSessionHost) {
      const workflowPageContent = buildCycleWorkflowPage({
        entity,
        entityName,
        importBase,
        cycleCfg: priorityCfg.cycleCounting,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }

    // ===================== Invoice Priority A workflow pages =====================
    const isInvoiceHost =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.invoiceEntity || 'invoices');
    const isPaymentHost =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.paymentEntity || 'invoice_payments');
    const isNoteHost =
      moduleKey === 'invoice' &&
      String(entity.slug || '') === String(invoicePriorityCfg.noteEntity || 'invoice_notes');

    if (isInvoiceHost && invoiceTransactionsEnabled) {
      const workflowPageContent = buildInvoiceWorkflowPage({
        entity,
        entityName,
        importBase,
        lifecycleCfg: invoicePriorityCfg.lifecycle,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
    if (isInvoiceHost && invoicePaymentsEnabled) {
      const paymentsPageContent = buildInvoicePaymentsPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}PaymentsPage.tsx`), paymentsPageContent);
    }
    if (isInvoiceHost && invoiceNotesEnabled) {
      const notesPageContent = buildInvoiceNotesPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}NotesPage.tsx`), notesPageContent);
    }
    if (isPaymentHost && invoicePaymentsEnabled) {
      const workflowPageContent = buildPaymentWorkflowPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
    if (isNoteHost && invoiceNotesEnabled) {
      const workflowPageContent = buildNoteWorkflowPage({
        entity,
        entityName,
        importBase,
      });
      await fs.writeFile(path.join(modulePagesDir, `${entityName}WorkflowPage.tsx`), workflowPageContent);
    }
  }

  async generateDynamicForm(outputDir) {
    // Prefer frontend-bricks template (keeps generator modular).
    await this.brickRepo.copyFile(
      'frontend-bricks/components/DynamicForm.tsx',
      path.join(outputDir, 'src/components/DynamicForm.tsx')
    );
  }

  _generateFieldDefinitions(fields, features, allEntities) {
    const defs = [];

    for (const field of fields) {
      if (!field || ['id', 'created_at', 'updated_at'].includes(field.name)) continue;

      const rawOptions = field.options ?? field.enum ?? field.allowed_values ?? field.allowedValues;
      const options = Array.isArray(rawOptions)
        ? rawOptions.map((x) => String(x)).map((s) => s.trim()).filter(Boolean)
        : null;

      let widget = field.widget || this._getWidgetForType(field.type);
      if (typeof widget === 'string' && widget.length) {
        const w = widget.trim();
        const wNorm = w.toLowerCase();
        const widgetMap = {
          input: 'Input',
          textinput: 'Input',
          textarea: 'TextArea',
          number: 'NumberInput',
          numberinput: 'NumberInput',
          checkbox: 'Checkbox',
          date: 'DatePicker',
          datepicker: 'DatePicker',
          select: 'Select',
          dropdown: 'Select',
          radiogroup: 'RadioGroup',
          radio: 'RadioGroup',
          entityselect: 'EntitySelect',
        };
        widget = widgetMap[wNorm] || w;
      }
      if (!field.widget && options && options.length) {
        // Fast tap-friendly UX for small enums, dropdown for larger.
        widget = options.length <= 4 ? 'RadioGroup' : 'Select';
      }
      const label = this._escapeJsString(field.label ? String(field.label) : this._formatLabel(field.name));

      const extraParts = [];

      const minLength = field.min_length ?? field.minLength;
      const maxLength = field.max_length ?? field.maxLength;
      const min = field.min ?? field.min_value ?? field.minValue;
      const max = field.max ?? field.max_value ?? field.maxValue;
      const pattern = field.pattern ?? field.regex;
      const unique = field.unique === true;

      if (typeof minLength === 'number') extraParts.push(`minLength: ${minLength}`);
      if (typeof maxLength === 'number') extraParts.push(`maxLength: ${maxLength}`);
      if (typeof min === 'number') extraParts.push(`min: ${min}`);
      if (typeof max === 'number') extraParts.push(`max: ${max}`);
      if (typeof pattern === 'string' && pattern.length) extraParts.push(`pattern: '${this._escapeJsString(pattern)}'`);
      if (unique) extraParts.push(`unique: true`);

      if (options && options.length) {
        const opts = options.map((v) => `'${this._escapeJsString(v)}'`).join(', ');
        extraParts.push(`options: [${opts}]`);
      }

      const isReference = field.type === 'reference' || field.name.endsWith('_id') || field.name.endsWith('_ids');
      if (isReference) {
        const explicitRef = field.reference_entity || field.referenceEntity;
        const inferredBase = String(field.name).replace(/_ids?$/, '');
        const baseName = String(explicitRef || inferredBase);
        const targetEntity = (allEntities || []).find((e) =>
          e.slug === baseName ||
          e.slug === baseName + 's' ||
          e.slug === baseName + 'es' ||
          (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
          e.slug.startsWith(baseName)
        );
        if (targetEntity) {
          extraParts.push(`referenceEntity: '${targetEntity.slug}'`);
        } else if (explicitRef) {
          extraParts.push(`referenceEntity: '${this._escapeJsString(explicitRef)}'`);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`Could not resolve reference for field ${field.name}`);
        }

        const multiple = field.multiple === true || field.is_array === true || field.name.endsWith('_ids');
        if (multiple) extraParts.push(`multiple: true`);
      }

      const extraProps = extraParts.length ? `, ${extraParts.join(', ')}` : '';
      defs.push(`  { name: '${field.name}', label: '${label}', type: '${field.type}', widget: '${widget}', required: ${field.required || false}${extraProps} },`);
    }

    // Feature-specific fields (backwards compat)
    if (features && features.batch_tracking) {
      const hasBatch = fields.some((f) => f && f.name === 'batch_number');
      const hasExpiry = fields.some((f) => f && f.name === 'expiry_date');
      if (!hasBatch) defs.push(`  { name: 'batch_number', label: 'Batch Number', type: 'string', widget: 'Input', required: true },`);
      if (!hasExpiry) defs.push(`  { name: 'expiry_date', label: 'Expiry Date', type: 'date', widget: 'DatePicker', required: false },`);
    }

    if (features && features.serial_tracking) {
      const hasSerial = fields.some((f) => f && f.name === 'serial_number');
      if (!hasSerial) defs.push(`  { name: 'serial_number', label: 'Serial Number', type: 'string', widget: 'Input', required: true },`);
    }

    if (features && features.multi_location) {
      const hasLocationRef = fields.some((f) => {
        if (!f) return false;
        const ref = f.reference_entity || f.referenceEntity;
        return f.name === 'location_id' || f.name === 'location_ids' || ref === 'locations';
      });
      if (!hasLocationRef) {
        defs.push(`  { name: 'location_id', label: 'Location', type: 'reference', widget: 'EntitySelect', required: true, referenceEntity: 'locations' },`);
      }
    }

    return defs.join('\n');
  }

  _getWidgetForType(type) {
    const widgetMap = {
      string: 'Input',
      integer: 'NumberInput',
      decimal: 'NumberInput',
      number: 'NumberInput',
      boolean: 'Checkbox',
      date: 'DatePicker',
      datetime: 'DatePicker',
      reference: 'EntitySelect',
      text: 'TextArea'
    };
    return widgetMap[type] || 'Input';
  }

  _capitalize(str) {
    return String(str).charAt(0).toUpperCase() + String(str).slice(1);
  }

  _formatLabel(str) {
    return String(str).replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  _guessDisplayField(entity) {
    if (!entity) return 'id';
    if (entity.display_field) return String(entity.display_field);
    if (entity.displayField) return String(entity.displayField);

    const fields = Array.isArray(entity.fields) ? entity.fields : [];
    if (fields.some((f) => f && f.name === 'name')) return 'name';
    if (fields.some((f) => f && f.name === 'sku')) return 'sku';
    const first = fields.find((f) => f && !['id', 'created_at', 'updated_at'].includes(f.name));
    return first ? String(first.name) : 'id';
  }

  _escapeJsString(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
      .replace(/'/g, "\\'");
  }
}

module.exports = FrontendGenerator;