// platform/assembler/generators/FrontendGenerator.js
const fs = require('fs').promises;
const path = require('path');

const { buildDashboardHome } = require('./frontend/dashboardHome');
const { buildEntitiesRegistry } = require('./frontend/entitiesRegistry');
const { buildActivityLogPage } = require('./frontend/activityLogPage');
const { buildReportsPage } = require('./frontend/reportsPage');
const { buildApp } = require('./frontend/app');
const { buildSidebar } = require('./frontend/sidebar');
const {
  buildAuthContext,
  buildLoginPage,
  buildRequireAuth,
  buildRequirePermission,
  buildUsersAdminPageConnected,
  buildGroupsAdminPageConnected,
} = require('./frontend/rbacPages');

const { normalizeLanguage, tFor } = require('../i18n/labels');

class FrontendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
    this.modules = {};
    this.moduleMap = {};
    this._moduleDirs = new Set();
    this._standalone = false;
    this._accessControlEnabled = false;
    this._language = 'en';
  }

  setStandalone(flag) {
    this._standalone = !!flag;
  }

  setLanguage(language) {
    this._language = normalizeLanguage(language);
  }

  _t(keyPath) {
    return tFor(this._language)(keyPath);
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
    return Object.keys(inv).length > 0;
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

  _computeChildSlugs(entities) {
    const childSlugs = new Set();
    for (const entity of (entities || [])) {
      if (!entity || !Array.isArray(entity.children)) continue;
      for (const ch of entity.children) {
        if (!ch || typeof ch !== 'object') continue;
        const childSlug = String(ch.entity || ch.slug || '').trim();
        if (childSlug) childSlugs.add(childSlug);
      }
    }
    return childSlugs;
  }

  _buildModuleMapFromEntities(visibleEntities) {
    const enabledModules = new Set();
    for (const e of visibleEntities) {
      const mod = this._getModuleKey(e);
      if (mod !== 'shared') enabledModules.add(mod);
    }
    return {
      enabled: [...enabledModules],
    };
  }

  _computeSharedModules(allEntities) {
    const sharedSlugs = new Set();
    const enabledModules = new Set();
    for (const e of allEntities) {
      const mod = this._getModuleKey(e);
      if (mod === 'shared') {
        sharedSlugs.add(e.slug);
      } else {
        enabledModules.add(mod);
      }
    }
    if (!sharedSlugs.size) return {};

    const result = {};
    for (const slug of sharedSlugs) result[slug] = new Set();

    for (const e of allEntities) {
      const mod = this._getModuleKey(e);
      if (mod === 'shared') continue;
      const fields = Array.isArray(e.fields) ? e.fields : [];
      for (const f of fields) {
        const ref = f.reference_entity || f.referenceEntity;
        if (ref && sharedSlugs.has(ref)) {
          result[ref].add(mod);
        }
      }
    }

    const final = {};
    const allEnabled = [...enabledModules];
    for (const [slug, mods] of Object.entries(result)) {
      final[slug] = mods.size > 0 ? [...mods] : allEnabled;
    }
    return final;
  }

  /* ── Directory scaffolding ──────────────────────────────── */

  async _ensureModuleDirs(outputDir, moduleKey) {
    if (this._moduleDirs.has(moduleKey)) return;
    const modulePagesDir = path.join(outputDir, 'modules', moduleKey, 'pages');
    await fs.mkdir(modulePagesDir, { recursive: true });
    this._moduleDirs.add(moduleKey);
  }

  async scaffold(outputDir, sdf = {}) {
    this._moduleDirs = new Set();

    const acConfig = (sdf && sdf.modules && sdf.modules.access_control) || {};
    this._accessControlEnabled = acConfig.enabled !== false;

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

    if (this._accessControlEnabled) {
      dirs.push('src/contexts', 'src/pages/admin');
    }

    for (const dir of dirs) {
      await fs.mkdir(path.join(outputDir, dir), { recursive: true });
    }

    await this._generateBaseFiles(outputDir, sdf);
    await this._generateSharedComponents(outputDir);
    await this._generateModuleComponents(outputDir);

    if (this._accessControlEnabled) {
      await this._generateRbacFrontend(outputDir);
    }
  }

  async _generateRbacFrontend(outputDir) {
    await fs.writeFile(path.join(outputDir, 'src/contexts/AuthContext.tsx'), buildAuthContext());
    await fs.writeFile(path.join(outputDir, 'src/pages/LoginPage.tsx'), buildLoginPage({ language: this._language }));
    await fs.writeFile(path.join(outputDir, 'src/components/RequireAuth.tsx'), buildRequireAuth());
    await fs.writeFile(path.join(outputDir, 'src/components/RequirePermission.tsx'), buildRequirePermission({ language: this._language }));
    await fs.writeFile(path.join(outputDir, 'src/pages/admin/UsersAdminPage.tsx'), buildUsersAdminPageConnected({ language: this._language }));
    await fs.writeFile(path.join(outputDir, 'src/pages/admin/GroupsAdminPage.tsx'), buildGroupsAdminPageConnected({ language: this._language }));
  }

  /* ── Base files generation ──────────────────────────────── */

  async _generateBaseFiles(outputDir, sdf) {
    const entities = Array.isArray(sdf.entities) ? sdf.entities : [];
    const wantsQrLabels = entities.some((e) => e && e.labels && e.labels.enabled === true && e.labels.type === 'qrcode');

    const packageJson = {
      name: "generated-erp-frontend",
      version: "1.0.0",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
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
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    const escapeHtml = (s) => String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    const htmlLang = this._t('meta.htmlLang') || this._language;
    const titleSuffix = this._t('meta.appTitleSuffix');
    const projectTitle = (sdf && sdf.project_name) ? `${sdf.project_name} · ${titleSuffix}` : `${this._t('topbar.fallbackAppName')} · ${titleSuffix}`;
    const indexHtml = `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(projectTitle)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
    await fs.writeFile(path.join(outputDir, 'index.html'), indexHtml);

    const authImport = this._accessControlEnabled
      ? `import { AuthProvider } from './contexts/AuthContext';\n`
      : '';
    const authOpen = this._accessControlEnabled ? `      <AuthProvider>\n` : '';
    const authClose = this._accessControlEnabled ? `      </AuthProvider>\n` : '';
    const mainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ToastProvider } from './components/ui/toast';
${authImport}import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
${authOpen}      <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || '/'}>
        <App />
      </BrowserRouter>
${authClose}    </ToastProvider>
  </React.StrictMode>
);`;
    await fs.writeFile(path.join(outputDir, 'src/main.tsx'), mainTsx);

    const indexCss = `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n@media print {\n  .no-print { display: none !important; }\n  body { background: white !important; }\n}\n`;
    await fs.writeFile(path.join(outputDir, 'src/index.css'), indexCss);

    const tailwindConfig = `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./modules/**/*.{js,ts,jsx,tsx}"],\n  theme: { extend: {} },\n  plugins: [],\n};`;
    await fs.writeFile(path.join(outputDir, 'tailwind.config.js'), tailwindConfig);

    const viteConfig = `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});`;
    await fs.writeFile(path.join(outputDir, 'vite.config.ts'), viteConfig);

    const tsConfig = {
      compilerOptions: {
        target: "ES2020", useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"], module: "ESNext",
        skipLibCheck: true, moduleResolution: "bundler",
        allowImportingTsExtensions: true, resolveJsonModule: true,
        isolatedModules: true, noEmit: true, jsx: "react-jsx", strict: true
      },
      include: ["src", "modules"]
    };
    await fs.writeFile(path.join(outputDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

    const defaultApiUrl = this._standalone ? '/api' : 'http://localhost:3000/api';
    const apiServiceLines = [
      `import axios from 'axios';`,
      ``,
      `const api = axios.create({`,
      `  baseURL: import.meta.env.VITE_API_URL || '${defaultApiUrl}',`,
      `});`,
    ];
    if (this._accessControlEnabled) {
      apiServiceLines.push(
        ``,
        `api.interceptors.request.use((config) => {`,
        `  const token = localStorage.getItem('erp_token');`,
        `  if (token) config.headers.Authorization = 'Bearer ' + token;`,
        `  return config;`,
        `});`,
      );
    }
    apiServiceLines.push(``, `export default api;`);
    await fs.writeFile(path.join(outputDir, 'src/services/api.ts'), apiServiceLines.join('\n'));

    const postcssConfig = `module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`;
    await fs.writeFile(path.join(outputDir, 'postcss.config.js'), postcssConfig);

    const viteEnvDts = `/// <reference types="vite/client" />\n`;
    await fs.writeFile(path.join(outputDir, 'src/vite-env.d.ts'), viteEnvDts);

    if (!this._standalone) {
      await fs.writeFile(path.join(outputDir, '.dockerignore'), `node_modules\ndist\n.git\n`);
      const dockerfile = `FROM node:20-alpine\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm install\n\nCOPY . .\n\nEXPOSE 5173\n\nCMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]\n`;
      await fs.writeFile(path.join(outputDir, 'Dockerfile'), dockerfile);
    }
  }

  /* ── Component scaffolding ─────────────────────────────── */

  async _generateSharedComponents(outputDir) {
    await this.brickRepo.copyFile('frontend-bricks/components/toast.tsx', path.join(outputDir, 'src/components/ui/toast.tsx'));
    await this.brickRepo.copyFile('frontend-bricks/components/Modal.tsx', path.join(outputDir, 'src/components/ui/Modal.tsx'));
    await this.brickRepo.copyFile('frontend-bricks/components/ImportCsvTool.tsx', path.join(outputDir, 'src/components/tools/ImportCsvTool.tsx'));
    await this.brickRepo.copyFile('frontend-bricks/components/ImportCsvModal.tsx', path.join(outputDir, 'src/components/tools/ImportCsvModal.tsx'));
    await this.brickRepo.copyFile('frontend-bricks/layouts/DashboardLayout.tsx', path.join(outputDir, 'src/components/layout/DashboardLayout.tsx'));
  }

  async generateTopbar(outputDir, sdf = {}) {
    const projectName = this._escapeJsString(
      (sdf && sdf.project_name) || this._t('topbar.fallbackAppName')
    );
    const rbac = this._accessControlEnabled;
    const toggleMenu = this._escapeJsString(this._t('topbar.toggleMenu'));
    const goBack = this._escapeJsString(this._t('topbar.goBack'));
    const goForward = this._escapeJsString(this._t('topbar.goForward'));
    const fallbackUser = this._escapeJsString(this._t('topbar.fallbackUser'));

    const topbar = `import { useNavigate } from 'react-router-dom';
import { useSidebar } from './DashboardLayout';
${rbac ? `import { useAuth } from '../../contexts/AuthContext';\n` : ''}
export default function Topbar() {
  const navigate = useNavigate();
  const { toggle } = useSidebar();
${rbac ? `  const { user } = useAuth();\n  const displayName = user?.display_name || user?.username || '${fallbackUser}';\n  const initials = displayName.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);\n` : ''}
  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="${toggleMenu}"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="${goBack}"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="${goForward}"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <div className="text-sm font-semibold text-slate-900 ml-1">${projectName}</div>
        </div>
        <div className="flex items-center gap-2">
${rbac
  ? `          <div className="hidden sm:block text-xs text-slate-600 font-medium">{displayName}</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">{initials}</div>`
  : `          <div className="h-8 w-8 rounded-full bg-slate-200" />`}
        </div>
      </div>
    </header>
  );
}
`;
    await fs.writeFile(path.join(outputDir, 'src/components/layout/Topbar.tsx'), topbar);
  }

  async _generateModuleComponents(outputDir) {
    const moduleComponents = [
      ['frontend-bricks/components/modules/invoice/InvoiceCard.tsx', 'src/components/modules/invoice/InvoiceCard.tsx'],
      ['frontend-bricks/components/modules/hr/EmployeeCard.tsx', 'src/components/modules/hr/EmployeeCard.tsx'],
      ['frontend-bricks/components/modules/hr/DepartmentCard.tsx', 'src/components/modules/hr/DepartmentCard.tsx'],
      ['frontend-bricks/components/modules/hr/LeaveRequestCard.tsx', 'src/components/modules/hr/LeaveRequestCard.tsx'],
      ['frontend-bricks/components/modules/inventory/InventoryAlertCard.tsx', 'src/components/modules/inventory/InventoryAlertCard.tsx'],
    ];
    for (const [sourcePath, destPath] of moduleComponents) {
      await this.brickRepo.copyFile(sourcePath, path.join(outputDir, destPath));
    }
  }

  /* ── Dashboard + App + Sidebar generation ──────────────── */

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
      enabled: activityCfgRaw.enabled === true || this._accessControlEnabled,
      limit: typeof activityCfgRaw.limit === 'number' ? activityCfgRaw.limit : 15,
    };
    const scheduledReportsCfg = modules.scheduled_reports || modules.scheduledReports || {};

    const dashboardHome = buildDashboardHome({ lowStockCfg, expiryCfg, activityCfg, enableReportsPage: scheduledReportsCfg.enabled === true, rbac: this._accessControlEnabled, language: this._language });
    await fs.writeFile(path.join(outputDir, 'src/pages/DashboardHome.tsx'), dashboardHome);
  }

  async generateApp(outputDir, entities, sdf = {}) {
    const visibleEntities = (entities || []).filter((e) => e && !String(e.slug || '').startsWith('__') && !(e.system && e.system.hidden));
    const modules = sdf && sdf.modules ? sdf.modules : {};
    const allEntities = Array.isArray(sdf.entities) ? sdf.entities : entities || [];
    const hasAuditLogsEntity = allEntities.some((e) => String(e?.slug || '') === '__audit_logs');
    const enableActivityLog = this._accessControlEnabled || hasAuditLogsEntity || (modules.activity_log || modules.activityLog || {}).enabled === true;
    const enableReports = (modules.scheduled_reports || modules.scheduledReports || {}).enabled === true;
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const invoicePriorityCfg = this._getInvoicePriorityAConfig(sdf);
    const hrPriorityCfg = this._getHRPriorityAConfig(sdf);
    const reservationsEnabled = this._isPackEnabled(priorityCfg.reservations);
    const inboundEnabled = this._isPackEnabled(priorityCfg.inbound);
    const cycleEnabled = this._isPackEnabled(priorityCfg.cycleCounting);
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);
    const hrLeaveEngineEnabled = this._isPackEnabled(hrPriorityCfg.leaveEngine);
    const hrLeaveApprovalsEnabled = this._isPackEnabled(hrPriorityCfg.leaveApprovals);
    const hrAttendanceEnabled = this._isPackEnabled(hrPriorityCfg.attendanceTime);

    const childSlugs = [...this._computeChildSlugs(allEntities)];
    const sharedModulesMap = this._computeSharedModules(allEntities);

    const entityRegistry = buildEntitiesRegistry({
      visibleEntities,
      childSlugs,
      escapeJsString: (s) => this._escapeJsString(s),
      capitalize: (s) => this._capitalize(s),
      guessDisplayField: (e) => this._guessDisplayField(e),
      sharedModulesMap,
      language: this._language,
    });
    await fs.writeFile(path.join(outputDir, 'src/config/entities.ts'), entityRegistry);

    await this.generateDashboardHome(outputDir, visibleEntities, sdf);

    if (enableActivityLog) {
      await fs.writeFile(path.join(outputDir, 'src/pages/ActivityLogPage.tsx'), buildActivityLogPage(this._language));
    }
    if (enableReports) {
      const scheduledCfg = modules.scheduled_reports || modules.scheduledReports || {};
      await fs.writeFile(path.join(outputDir, 'src/pages/ReportsPage.tsx'), buildReportsPage({ scheduledCfg, language: this._language }));
    }

    const featureFlags = { priorityCfg, invoicePriorityCfg, hrPriorityCfg, reservationsEnabled, inboundEnabled, cycleEnabled, invoiceTransactionsEnabled, invoicePaymentsEnabled, invoiceNotesEnabled, hrLeaveEngineEnabled, hrLeaveApprovalsEnabled, hrAttendanceEnabled };

    const toolImports = [
      enableActivityLog ? `import ActivityLogPage from './pages/ActivityLogPage';` : '',
      enableReports ? `import ReportsPage from './pages/ReportsPage';` : '',
    ].filter(Boolean).join('\n');

    const imports = visibleEntities.map((e) => this._buildEntityImports(e, featureFlags)).join('\n');

    const toolRoutes = [
      enableActivityLog ? (
        this._accessControlEnabled
          ? `        <Route path="/activity" element={<RequirePermission permission="__audit_logs.read"><ActivityLogPage /></RequirePermission>} />`
          : `        <Route path="/activity" element={<ActivityLogPage />} />`
      ) : '',
      enableReports ? `        <Route path="/reports" element={<ReportsPage />} />` : '',
    ].filter(Boolean).join('\n');

    const routes = visibleEntities.map((e) => this._buildEntityRoutes(e, featureFlags)).join('\n');

    const appContent = buildApp({ toolImports, imports, toolRoutes, routes, rbac: this._accessControlEnabled });
    await fs.writeFile(path.join(outputDir, 'src/App.tsx'), appContent);
  }

  _buildEntityImports(e, flags) {
    const cap = this._capitalize(e.slug);
    const moduleKey = this._getModuleKey(e);
    const modulePageBase = `../modules/${moduleKey}/pages/${cap}`;
    const wantImport = (e.ui || {}).csv_import !== false;
    const { enableReceive, enableIssue, enableAdjust, canTransfer, enableLabels } = this._resolveEntityOps(e);
    const featurePages = this._resolveEntityFeaturePages(e, moduleKey, flags);

    return [
      `import ${cap}Page from '${modulePageBase}Page';`,
      `import ${cap}FormPage from '${modulePageBase}FormPage';`,
      wantImport ? `import ${cap}ImportPage from '${modulePageBase}ImportPage';` : '',
      enableReceive ? `import ${cap}ReceivePage from '${modulePageBase}ReceivePage';` : '',
      enableIssue ? `import ${cap}IssuePage from '${modulePageBase}IssuePage';` : '',
      enableAdjust ? `import ${cap}AdjustPage from '${modulePageBase}AdjustPage';` : '',
      canTransfer ? `import ${cap}TransferPage from '${modulePageBase}TransferPage';` : '',
      enableLabels ? `import ${cap}LabelsPage from '${modulePageBase}LabelsPage';` : '',
      featurePages.reservations ? `import ${cap}ReservationsPage from '${modulePageBase}ReservationsPage';` : '',
      featurePages.grnPosting ? `import ${cap}PostingPage from '${modulePageBase}PostingPage';` : '',
      featurePages.cycleWorkflow ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
      featurePages.invoiceWorkflow ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
      featurePages.invoicePayments ? `import ${cap}PaymentsPage from '${modulePageBase}PaymentsPage';` : '',
      featurePages.invoiceNotes ? `import ${cap}NotesPage from '${modulePageBase}NotesPage';` : '',
      featurePages.paymentWorkflow ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
      featurePages.noteWorkflow ? `import ${cap}WorkflowPage from '${modulePageBase}WorkflowPage';` : '',
      featurePages.leaveApprovals ? `import ${cap}ApprovalsPage from '${modulePageBase}ApprovalsPage';` : '',
      featurePages.leaveBalances ? `import ${cap}BalancesPage from '${modulePageBase}BalancesPage';` : '',
      featurePages.attendance ? `import ${cap}AttendancePage from '${modulePageBase}AttendancePage';` : '',
    ].filter(Boolean).join('\n');
  }

  _buildEntityRoutes(e, flags) {
    const cap = this._capitalize(e.slug);
    const moduleKey = this._getModuleKey(e);
    const wantImport = (e.ui || {}).csv_import !== false;
    const { enableReceive, enableIssue, enableAdjust, canTransfer, enableLabels } = this._resolveEntityOps(e);
    const featurePages = this._resolveEntityFeaturePages(e, moduleKey, flags);
    const rbac = this._accessControlEnabled;
    const wrap = (pageJsx) => rbac
      ? `<RequirePermission permission="${e.slug}.read">${pageJsx}</RequirePermission>`
      : pageJsx;

    return [
      `          <Route path="/${e.slug}" element={${wrap(`<${cap}Page />`)}} />`,
      `          <Route path="/${e.slug}/new" element={${wrap(`<${cap}FormPage />`)}} />`,
      `          <Route path="/${e.slug}/:id/edit" element={${wrap(`<${cap}FormPage />`)}} />`,
      wantImport ? `          <Route path="/${e.slug}/import" element={${wrap(`<${cap}ImportPage />`)}} />` : '',
      enableReceive ? `          <Route path="/${e.slug}/receive" element={${wrap(`<${cap}ReceivePage />`)}} />` : '',
      enableIssue ? `          <Route path="/${e.slug}/issue" element={${wrap(`<${cap}IssuePage />`)}} />` : '',
      enableAdjust ? `          <Route path="/${e.slug}/adjust" element={${wrap(`<${cap}AdjustPage />`)}} />` : '',
      canTransfer ? `          <Route path="/${e.slug}/transfer" element={${wrap(`<${cap}TransferPage />`)}} />` : '',
      enableLabels ? `          <Route path="/${e.slug}/labels" element={${wrap(`<${cap}LabelsPage />`)}} />` : '',
      featurePages.reservations ? `          <Route path="/${e.slug}/reservations" element={${wrap(`<${cap}ReservationsPage />`)}} />` : '',
      featurePages.grnPosting ? `          <Route path="/${e.slug}/posting" element={${wrap(`<${cap}PostingPage />`)}} />` : '',
      featurePages.cycleWorkflow ? `          <Route path="/${e.slug}/workflow" element={${wrap(`<${cap}WorkflowPage />`)}} />` : '',
      featurePages.invoiceWorkflow ? `          <Route path="/${e.slug}/workflow" element={${wrap(`<${cap}WorkflowPage />`)}} />` : '',
      featurePages.invoicePayments ? `          <Route path="/${e.slug}/payments" element={${wrap(`<${cap}PaymentsPage />`)}} />` : '',
      featurePages.invoiceNotes ? `          <Route path="/${e.slug}/notes" element={${wrap(`<${cap}NotesPage />`)}} />` : '',
      featurePages.paymentWorkflow ? `          <Route path="/${e.slug}/workflow" element={${wrap(`<${cap}WorkflowPage />`)}} />` : '',
      featurePages.noteWorkflow ? `          <Route path="/${e.slug}/workflow" element={${wrap(`<${cap}WorkflowPage />`)}} />` : '',
      featurePages.leaveApprovals ? `          <Route path="/${e.slug}/approvals" element={${wrap(`<${cap}ApprovalsPage />`)}} />` : '',
      featurePages.leaveBalances ? `          <Route path="/${e.slug}/balances" element={${wrap(`<${cap}BalancesPage />`)}} />` : '',
      featurePages.attendance ? `          <Route path="/${e.slug}/attendance" element={${wrap(`<${cap}AttendancePage />`)}} />` : '',
    ].filter(Boolean).join('\n');
  }

  _resolveEntityOps(e) {
    const inv = e.inventory_ops || e.inventoryOps || {};
    const invEnabled = this._isInventoryOpsEnabled(inv);
    const issueCfg = inv.issue || inv.sell || inv.issue_stock || inv.issueStock || {};
    return {
      enableReceive: invEnabled && (inv.receive?.enabled !== false),
      enableIssue: invEnabled && issueCfg.enabled === true,
      enableAdjust: invEnabled && (inv.adjust?.enabled !== false),
      canTransfer: invEnabled && (inv.transfer?.enabled === true || (inv.transfer?.enabled !== false && ((e.features && e.features.multi_location) || (Array.isArray(e.fields) && e.fields.some((f) => f && String(f.name || '').includes('location')))))),
      enableLabels: e.labels && e.labels.enabled === true && e.labels.type === 'qrcode',
    };
  }

  _resolveEntityFeaturePages(e, moduleKey, flags) {
    const slug = String(e.slug || '');
    const { priorityCfg, invoicePriorityCfg, hrPriorityCfg, reservationsEnabled, inboundEnabled, cycleEnabled, invoiceTransactionsEnabled, invoicePaymentsEnabled, invoiceNotesEnabled, hrLeaveEngineEnabled, hrLeaveApprovalsEnabled, hrAttendanceEnabled } = flags;
    return {
      reservations: reservationsEnabled && moduleKey === 'inventory' && slug === String(priorityCfg.stockEntity || ''),
      grnPosting: inboundEnabled && moduleKey === 'inventory' && slug === String(priorityCfg.inbound.grn_entity || ''),
      cycleWorkflow: cycleEnabled && moduleKey === 'inventory' && slug === String(priorityCfg.cycleCounting.session_entity || ''),
      invoiceWorkflow: invoiceTransactionsEnabled && moduleKey === 'invoice' && slug === String(invoicePriorityCfg.invoiceEntity || 'invoices'),
      invoicePayments: invoicePaymentsEnabled && moduleKey === 'invoice' && slug === String(invoicePriorityCfg.invoiceEntity || 'invoices'),
      invoiceNotes: invoiceNotesEnabled && moduleKey === 'invoice' && slug === String(invoicePriorityCfg.invoiceEntity || 'invoices'),
      paymentWorkflow: invoicePaymentsEnabled && moduleKey === 'invoice' && slug === String(invoicePriorityCfg.paymentEntity || 'invoice_payments'),
      noteWorkflow: invoiceNotesEnabled && moduleKey === 'invoice' && slug === String(invoicePriorityCfg.noteEntity || 'invoice_notes'),
      leaveApprovals: hrLeaveApprovalsEnabled && moduleKey === 'hr' && slug === String(hrPriorityCfg.leaveEntity || 'leaves'),
      leaveBalances: hrLeaveEngineEnabled && (moduleKey === 'hr' || moduleKey === 'shared') && slug === String(hrPriorityCfg.employeeEntity || 'employees'),
      attendance: hrAttendanceEnabled && moduleKey === 'hr' && slug === String(hrPriorityCfg.attendanceTime?.attendance_entity || 'attendance_entries'),
    };
  }

  async generateSidebar(outputDir, entities, sdf = {}) {
    const visibleEntities = (entities || []).filter((e) => e && !String(e.slug || '').startsWith('__') && !(e.system && e.system.hidden));
    const priorityCfg = this._getInventoryPriorityAConfig(sdf);
    const invoicePriorityCfg = this._getInvoicePriorityAConfig(sdf);
    const hrPriorityCfg = this._getHRPriorityAConfig(sdf);
    const reservationsEnabled = this._isPackEnabled(priorityCfg.reservations);
    const inboundEnabled = this._isPackEnabled(priorityCfg.inbound);
    const cycleEnabled = this._isPackEnabled(priorityCfg.cycleCounting);
    const invoiceTransactionsEnabled = this._isPackEnabled(invoicePriorityCfg.transactions);
    const invoicePaymentsEnabled = this._isPackEnabled(invoicePriorityCfg.payments);
    const invoiceNotesEnabled = this._isPackEnabled(invoicePriorityCfg.notes);
    const hrLeaveEngineEnabled = this._isPackEnabled(hrPriorityCfg.leaveEngine);
    const hrLeaveApprovalsEnabled = this._isPackEnabled(hrPriorityCfg.leaveApprovals);
    const hrAttendanceEnabled = this._isPackEnabled(hrPriorityCfg.attendanceTime);

    const modules = sdf && sdf.modules ? sdf.modules : {};
    const allEntities = Array.isArray(sdf.entities) ? sdf.entities : visibleEntities || [];
    const hasAuditLogsEntity = allEntities.some((e) => String(e?.slug || '') === '__audit_logs');
    const enableActivityLog = this._accessControlEnabled || hasAuditLogsEntity || (modules.activity_log || modules.activityLog || {}).enabled === true;
    const enableReports = (modules.scheduled_reports || modules.scheduledReports || {}).enabled === true;

    const availableSlugs = new Set(visibleEntities.map((e) => String(e.slug || '')));

    const tWorkflow = (key) => this._t('sidebar.workflow.' + key);
    const workflowBadges = [];
    if (reservationsEnabled && availableSlugs.has(String(priorityCfg.stockEntity || ''))) {
      workflowBadges.push({ slug: priorityCfg.stockEntity, sub: 'reservations', label: tWorkflow('reservations') });
    }
    if (inboundEnabled && availableSlugs.has(String(priorityCfg.inbound.grn_entity || ''))) {
      workflowBadges.push({ slug: priorityCfg.inbound.grn_entity, sub: 'posting', label: tWorkflow('grnPosting') });
    }
    if (cycleEnabled && availableSlugs.has(String(priorityCfg.cycleCounting.session_entity || ''))) {
      workflowBadges.push({ slug: priorityCfg.cycleCounting.session_entity, sub: 'workflow', label: tWorkflow('cycleCount') });
    }
    if (invoiceTransactionsEnabled && availableSlugs.has(String(invoicePriorityCfg.invoiceEntity || ''))) {
      workflowBadges.push({ slug: invoicePriorityCfg.invoiceEntity, sub: 'workflow', label: tWorkflow('invoiceWorkflow') });
    }
    if (invoicePaymentsEnabled && availableSlugs.has(String(invoicePriorityCfg.invoiceEntity || ''))) {
      workflowBadges.push({ slug: invoicePriorityCfg.invoiceEntity, sub: 'payments', label: tWorkflow('payments') });
    }
    if (invoiceNotesEnabled && availableSlugs.has(String(invoicePriorityCfg.invoiceEntity || ''))) {
      workflowBadges.push({ slug: invoicePriorityCfg.invoiceEntity, sub: 'notes', label: tWorkflow('creditDebitNotes') });
    }
    if (invoicePaymentsEnabled && availableSlugs.has(String(invoicePriorityCfg.paymentEntity || ''))) {
      workflowBadges.push({ slug: invoicePriorityCfg.paymentEntity, sub: 'workflow', label: tWorkflow('paymentPosting') });
    }
    if (invoiceNotesEnabled && availableSlugs.has(String(invoicePriorityCfg.noteEntity || ''))) {
      workflowBadges.push({ slug: invoicePriorityCfg.noteEntity, sub: 'workflow', label: tWorkflow('notePosting') });
    }
    if (hrLeaveApprovalsEnabled && availableSlugs.has(String(hrPriorityCfg.leaveEntity || ''))) {
      workflowBadges.push({ slug: hrPriorityCfg.leaveEntity, sub: 'approvals', label: tWorkflow('leaveApprovals') });
    }
    if (hrLeaveEngineEnabled && availableSlugs.has(String(hrPriorityCfg.employeeEntity || ''))) {
      workflowBadges.push({ slug: hrPriorityCfg.employeeEntity, sub: 'balances', label: tWorkflow('leaveBalances') });
    }
    if (hrAttendanceEnabled && availableSlugs.has(String(hrPriorityCfg.attendanceTime?.attendance_entity || ''))) {
      workflowBadges.push({ slug: hrPriorityCfg.attendanceTime?.attendance_entity, sub: 'attendance', label: tWorkflow('attendance') });
    }

    const moduleMap = this._buildModuleMapFromEntities(visibleEntities);

    const toolsLinks = [];
    if (enableActivityLog) toolsLinks.push({ to: '/activity', label: this._t('sidebar.tools.activityLog'), permission: '__audit_logs.read' });
    if (enableReports) toolsLinks.push({ to: '/reports', label: this._t('sidebar.tools.reports') });

    const toolsHeading = this._t('sidebar.toolsHeading');
    const toolsBlock = toolsLinks.length > 0 ? `
        <div className="mt-4">
          <div className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">${toolsHeading}</div>
${toolsLinks.map((t) => `          ${this._accessControlEnabled && t.permission ? `{(isSuperadmin || hasPermission('${t.permission}')) && (` : ''}<Link
            to="${t.to}"
            className={[
              'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
              location.pathname === '${t.to}' ? 'bg-slate-700 text-white' : 'text-slate-700 hover:bg-slate-100',
            ].join(' ')}
          >
            ${t.label}
          </Link>${this._accessControlEnabled && t.permission ? `)}` : ''}`).join('\n')}
        </div>` : '';

    const sidebarContent = buildSidebar({
      toolsBlock,
      moduleMap,
      rbac: this._accessControlEnabled,
      language: this._language,
    });
    await fs.writeFile(path.join(outputDir, 'src/components/layout/Sidebar.tsx'), sidebarContent);
  }
}

// Merge extracted method groups onto the prototype
Object.assign(FrontendGenerator.prototype, require('./frontend/moduleConfigs'));
Object.assign(FrontendGenerator.prototype, require('./frontend/generateEntityPage'));
Object.assign(FrontendGenerator.prototype, require('./frontend/fieldUtils'));

module.exports = FrontendGenerator;
