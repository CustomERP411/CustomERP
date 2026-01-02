// platform/backend/src/assembler/generators/FrontendGenerator.js
const fs = require('fs').promises;
const path = require('path');
const TemplateEngine = require('../TemplateEngine');

class FrontendGenerator {
  constructor(brickRepo) {
    this.brickRepo = brickRepo;
  }

  async scaffold(outputDir) {
    const dirs = [
      'src/components',
      'src/components/layout',
      'src/components/tools',
      'src/components/ui',
      'src/config',
      'src/pages',
      'src/services',
      'src/utils',
      'public'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(outputDir, dir), { recursive: true });
    }

    // Copy static files
    await this._generateBaseFiles(outputDir);
    await this._generateSharedComponents(outputDir);
  }

  async _generateBaseFiles(outputDir) {
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
        papaparse: "^5.4.1"
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
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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
      include: ["src"]
    };
    await fs.writeFile(path.join(outputDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

    // API service
    const apiService = `import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

export default api;`;
    await fs.writeFile(path.join(outputDir, 'src/services/api.ts'), apiService);

    // postcss.config.js (Tailwind)
    // Tailwind's @tailwind directives require the PostCSS plugin configured.
    const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
    await fs.writeFile(path.join(outputDir, 'postcss.config.js'), postcssConfig);

    // .dockerignore (keep Docker builds fast)
    const dockerIgnore = `node_modules
dist
.git
`;
    await fs.writeFile(path.join(outputDir, '.dockerignore'), dockerIgnore);

    // Dockerfile for frontend (Vite dev server)
    // Note: Vite must bind to 0.0.0.0 so the host can reach it via published ports.
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
    // Toast system (success/error feedback)
    const toastContent = `import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  toast: (msg: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    const durationMs = msg.durationMs ?? 3500;
    const toastMsg: ToastMessage = { id, durationMs, ...msg };
    setToasts((prev) => [...prev, toastMsg]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'w-[320px] rounded-lg border shadow-lg bg-white p-3',
              t.variant === 'success' ? 'border-emerald-200' : '',
              t.variant === 'error' ? 'border-red-200' : '',
              t.variant === 'info' ? 'border-blue-200' : '',
              t.variant === 'warning' ? 'border-amber-200' : '',
            ].join(' ')}
          >
            <div className="text-sm font-semibold text-slate-900">{t.title}</div>
            {t.description ? (
              <div className="mt-1 text-sm text-slate-600">{t.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
`;
    await fs.writeFile(path.join(outputDir, 'src/components/ui/toast.tsx'), toastContent);

    // Simple modal (used for Import CSV and other tools)
    const modalContent = `import React from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export default function Modal({ isOpen, title, children, onClose }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 no-print">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
`;
    await fs.writeFile(path.join(outputDir, 'src/components/ui/Modal.tsx'), modalContent);

    // CSV import modal (Excel-compatible CSV)
    const importCsvContent = `import React, { useMemo, useState } from 'react';
import Papa from 'papaparse';
import api from '../../services/api';
import Modal from '../ui/Modal';
import { useToast } from '../ui/toast';

export interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  widget: string;
  required?: boolean;
  referenceEntity?: string;
}

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  entitySlug: string;
  fields: FieldDefinition[];
  onImported: () => void;
}

export default function ImportCsvModal({ isOpen, onClose, entitySlug, fields, onImported }: ImportCsvModalProps) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState<string>('');
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const expectedHeaders = useMemo(() => {
    return fields
      .filter((f) => !['id', 'created_at', 'updated_at'].includes(f.name))
      .map((f) => f.name);
  }, [fields]);

  const requiredHeaders = useMemo(() => {
    return fields.filter((f) => f.required).map((f) => f.name);
  }, [fields]);

  const downloadTemplate = () => {
    const header = expectedHeaders.join(',');
    const blob = new Blob([header + '\\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entitySlug + '_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileSelected = (file: File) => {
    setFileName(file.name);
    setErrors([]);
    setRows([]);

    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const newErrors: string[] = [];
        const parsedRows = result.data || [];

        const headers = (result.meta.fields || []).filter(Boolean) as string[];
        const missingRequired = requiredHeaders.filter((h) => !headers.includes(h));
        if (missingRequired.length > 0) {
          newErrors.push('Missing required columns: ' + missingRequired.join(', '));
        }

        const unknownHeaders = headers.filter((h) => !expectedHeaders.includes(h));
        if (unknownHeaders.length > 0) {
          newErrors.push('Unknown columns (will be ignored): ' + unknownHeaders.join(', '));
        }

        if (result.errors?.length) {
          newErrors.push(...result.errors.map((e) => e.message));
        }

        setErrors(newErrors);
        setRows(parsedRows);
      },
    });
  };

  const transformRow = (row: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const f of fields) {
      if (!expectedHeaders.includes(f.name)) continue;
      const raw = row[f.name];
      if (raw === undefined || raw === null || raw === '') continue;

      if (['integer', 'decimal', 'number'].includes(f.type)) {
        const n = Number(raw);
        if (Number.isNaN(n)) throw new Error(\`Field \${f.name} must be a number\`);
        out[f.name] = n;
      } else if (f.type === 'boolean') {
        const v = String(raw).trim().toLowerCase();
        out[f.name] = v === 'true' || v === '1' || v === 'yes';
      } else {
        out[f.name] = raw;
      }
    }

    // Validate required fields
    for (const req of requiredHeaders) {
      if (out[req] === undefined || out[req] === null || out[req] === '') {
        throw new Error(\`Missing required field: \${req}\`);
      }
    }

    return out;
  };

  const importRows = async () => {
    if (rows.length === 0) {
      toast({ title: 'No rows to import', variant: 'warning' });
      return;
    }
    if (errors.length > 0) {
      toast({ title: 'Fix CSV errors before importing', variant: 'error' });
      return;
    }

    setIsImporting(true);
    setProgress({ done: 0, total: rows.length });
    try {
      let done = 0;
      for (const row of rows) {
        const payload = transformRow(row);
        await api.post('/' + entitySlug, payload);
        done += 1;
        setProgress({ done, total: rows.length });
      }

      toast({ title: 'Import completed', description: \`\${rows.length} rows imported\`, variant: 'success' });
      onImported();
      onClose();
      setRows([]);
      setFileName('');
    } catch (e: any) {
      toast({ title: 'Import failed', description: e?.message || 'Unknown error', variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title={\`Import CSV → \${entitySlug}\`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">How to import</div>
          <ul className="mt-1 list-disc pl-5">
            <li>Download the template to get correct column headers.</li>
            <li>CSV must include required columns. Extra columns are ignored.</li>
            <li>For reference fields (like <code>category_id</code>), use the referenced record <code>id</code>.</li>
          </ul>
          <button
            type="button"
            onClick={downloadTemplate}
            className="mt-2 inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
          >
            Download Template CSV
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileSelected(f);
            }}
            className="mt-1 block w-full text-sm"
          />
          {fileName ? <div className="mt-1 text-xs text-slate-500">Selected: {fileName}</div> : null}
        </div>

        {errors.length > 0 ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <div className="font-semibold">CSV issues</div>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Preview</div>
              <div className="text-xs text-slate-500">{rows.length} rows</div>
            </div>
            <div className="mt-2 max-h-44 overflow-auto text-xs">
              <pre className="whitespace-pre-wrap">{JSON.stringify(rows.slice(0, 5), null, 2)}</pre>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          {isImporting ? (
            <div className="text-sm text-slate-600">
              Importing… {progress.done}/{progress.total}
            </div>
          ) : (
            <div className="text-xs text-slate-500">Excel tip: export as CSV, then import here.</div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={importRows}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={isImporting}
            >
              Import
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
`;
    await fs.writeFile(path.join(outputDir, 'src/components/tools/ImportCsvModal.tsx'), importCsvContent);

    // Dashboard layout
    const dashboardLayout = `import { Outlet } from 'react-router-dom';
import Sidebar from '../Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex">
        <div className="no-print">
          <Sidebar />
        </div>
        <div className="min-w-0 flex-1">
          <div className="no-print">
            <Topbar />
          </div>
          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
`;
    await fs.writeFile(path.join(outputDir, 'src/components/layout/DashboardLayout.tsx'), dashboardLayout);

    // Topbar
    const topbar = `export default function Topbar() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <div className="text-sm font-semibold text-slate-900">Inventory</div>
          <div className="text-xs text-slate-500">Generated by CustomERP</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block text-xs text-slate-500">User</div>
          <div className="h-8 w-8 rounded-full bg-slate-200" />
        </div>
      </div>
    </header>
  );
}
`;
    await fs.writeFile(path.join(outputDir, 'src/components/layout/Topbar.tsx'), topbar);

    // Dashboard Home
    const dashboardHome = `import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { ENTITIES } from '../config/entities';

export default function DashboardHome() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const entries = await Promise.all(
          ENTITIES.map(async (e) => {
            const res = await api.get('/' + e.slug);
            return [e.slug, Array.isArray(res.data) ? res.data.length : 0] as const;
          })
        );
        setCounts(Object.fromEntries(entries));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-6 text-white shadow">
        <div className="text-sm opacity-90">Welcome</div>
        <div className="mt-1 text-2xl font-bold">Your Inventory Workspace</div>
        <div className="mt-2 text-sm opacity-90">
          Use the sidebar to manage entities. Import/export CSV to move data quickly.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ENTITIES.map((e) => (
          <Link
            key={e.slug}
            to={'/' + e.slug}
            className="rounded-xl border bg-white p-4 shadow-sm transition hover:shadow"
          >
            <div className="text-sm font-semibold text-slate-900">{e.displayName}</div>
            <div className="mt-2 text-3xl font-bold text-slate-900">
              {loading ? '…' : String(counts[e.slug] ?? 0)}
            </div>
            <div className="mt-1 text-xs text-slate-500">records</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
`;
    await fs.writeFile(path.join(outputDir, 'src/pages/DashboardHome.tsx'), dashboardHome);
  }

  async generateApp(outputDir, entities) {
    // Shared entity registry (navigation + dashboard cards)
    const entityRegistry = `export interface EntityNavItem {
  slug: string;
  displayName: string;
}

export const ENTITIES: EntityNavItem[] = [
${entities
  .map((e) => `  { slug: '${e.slug}', displayName: '${(e.display_name || this._capitalize(e.slug)).replace(/'/g, "\\'")}' },`)
  .join('\n')}
];
`;
    await fs.writeFile(path.join(outputDir, 'src/config/entities.ts'), entityRegistry);

    // Generate imports
    const imports = entities.map(e => 
      `import ${this._capitalize(e.slug)}Page from './pages/${this._capitalize(e.slug)}Page';`
    ).join('\n');

    // Generate routes
    const routes = entities.map(e => 
      `          <Route path="/${e.slug}" element={<${this._capitalize(e.slug)}Page />} />`
    ).join('\n');

    const appContent = `import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
${imports}

function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<DashboardHome />} />
${routes}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;`;

    await fs.writeFile(path.join(outputDir, 'src/App.tsx'), appContent);
  }

  async generateSidebar(outputDir, entities) {
    const sidebarContent = `import { Link, useLocation } from 'react-router-dom';
import { ENTITIES } from '../config/entities';

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-white">
      <div className="px-4 py-4">
        <div className="text-lg font-bold text-slate-900">Inventory</div>
        <div className="text-xs text-slate-500">CustomERP generated</div>
      </div>
      <nav className="px-2 pb-4">
        <Link
          to="/"
          className={[
            'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
            location.pathname === '/' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100',
          ].join(' ')}
        >
          Dashboard
        </Link>
        <div className="my-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Entities</div>
        {ENTITIES.map((e) => {
          const active = location.pathname === '/' + e.slug;
          return (
            <Link
              key={e.slug}
              to={'/' + e.slug}
              className={[
                'mb-1 block rounded-lg px-3 py-2 text-sm font-medium',
                active ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {e.displayName}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
`;

    await fs.writeFile(path.join(outputDir, 'src/components/Sidebar.tsx'), sidebarContent);
  }

  async generateEntityPage(outputDir, entity, allEntities) {
    const entityName = this._capitalize(entity.slug);
    const fields = entity.fields || [];

    // Generate field definitions for the form
    const fieldDefs = this._generateFieldDefinitions(fields, entity.features || {}, allEntities);

    // Generate table columns
    const tableColumns = fields
      .filter(f => f.name !== 'id')
      .slice(0, 5) // Limit columns for readability
      .map(f => {
        // If it's a reference field (e.g., category_id), try to show the name instead of ID
        // This is complex for a simple table without joins, so for now we stick to raw value or basic rendering
        return `    { key: '${f.name}', label: '${this._formatLabel(f.name)}' },`;
      })
      .join('\n');

    const pageContent = `import { useMemo, useState, useEffect } from 'react';
import api from '../services/api';
import DynamicForm from '../components/DynamicForm';
import ImportCsvModal from '../components/tools/ImportCsvModal';
import { useToast } from '../components/ui/toast';

interface ${entityName}Item {
  id: string;
  [key: string]: any;
}

const fieldDefinitions = [
${fieldDefs}
];

const tableColumns = [
${tableColumns}
];

export default function ${entityName}Page() {
  const { toast } = useToast();
  const [items, setItems] = useState<${entityName}Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<${entityName}Item | null>(null);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await api.get('/${entity.slug}');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
      toast({ title: 'Failed to load', description: 'Could not load ${entity.slug}', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSubmit = async (data: any) => {
    try {
      if (editingItem) {
        await api.put(\`/${entity.slug}/\${editingItem.id}\`, data);
        toast({ title: 'Saved', description: 'Record updated', variant: 'success' });
      } else {
        await api.post('/${entity.slug}', data);
        toast({ title: 'Created', description: 'Record created', variant: 'success' });
      }
      setShowForm(false);
      setEditingItem(null);
      fetchItems();
    } catch (err: any) {
      toast({ title: 'Operation failed', description: err.response?.data?.error || err.message || 'Unknown error', variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(\`/${entity.slug}/\${id}\`);
      toast({ title: 'Deleted', variant: 'success' });
      fetchItems();
    } catch (err) {
      console.error('Delete failed:', err);
      toast({ title: 'Delete failed', description: 'Could not delete record', variant: 'error' });
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      Object.values(item).some((v) => String(v ?? '').toLowerCase().includes(term))
    );
  }, [items, search]);

  const exportCsv = () => {
    const headers = fieldDefinitions.map((f: any) => f.name);
    const escapeCsv = (val: any) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('\"') || s.includes('\\n')) {
        return '\"' + s.replace(/\"/g, '\"\"') + '\"';
      }
      return s;
    };
    const lines = [
      headers.join(','),
      ...items.map((it: any) => headers.map((h: string) => escapeCsv(it[h])).join(',')),
    ];
    const blob = new Blob([lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '${entity.slug}.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported CSV', variant: 'success' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">${entity.display_name || entityName}</h1>
          <p className="text-sm text-slate-600">Manage records, import/export CSV, and print.</p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Import CSV
          </button>
          <button
            onClick={exportCsv}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Print / PDF
          </button>
          <button
            onClick={() => { setEditingItem(null); setShowForm(true); }}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Add New
          </button>
        </div>
      </div>

      <div className="no-print">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:max-w-md"
        />
      </div>

      <ImportCsvModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        entitySlug="${entity.slug}"
        fields={fieldDefinitions as any}
        onImported={() => fetchItems()}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">{editingItem ? 'Edit' : 'Create'} ${entityName}</h2>
            <DynamicForm
              fields={fieldDefinitions}
              initialData={editingItem || {}}
              onSubmit={handleSubmit}
              onCancel={() => { setShowForm(false); setEditingItem(null); }}
            />
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {tableColumns.map(col => (
                <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {col.label}
                </th>
              ))}
              <th className="px-6 py-3 text-right no-print">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleItems.map(item => (
              <tr key={item.id} className="hover:bg-gray-50">
                {tableColumns.map(col => (
                  <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {String(item[col.key] ?? '')}
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm no-print">
                  <button onClick={() => { setEditingItem(item); setShowForm(true); }} className="text-blue-600 hover:underline mr-4">Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr><td colSpan={tableColumns.length + 1} className="px-6 py-4 text-center text-gray-500">No items yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}`;

    await fs.writeFile(path.join(outputDir, `src/pages/${entityName}Page.tsx`), pageContent);
  }

  _generateFieldDefinitions(fields, features, allEntities) {
    const defs = [];

    // Add standard fields
    for (const field of fields) {
      if (field.name === 'id' || field.name === 'created_at' || field.name === 'updated_at') continue;
      
      const widget = this._getWidgetForType(field.type);
      let extraProps = '';

      if (field.type === 'reference' || field.name.endsWith('_id')) {
        // Try to infer reference entity
        // 1. Check if we have an entity matching the field name (e.g., "category" from "category_id")
        const baseName = field.name.replace(/_id$/, '');
        
        // Find matching entity in SDF
        // Robust matching strategy:
        // 1. Exact match (slug == baseName)
        // 2. Simple plural (slug == baseName + 's')
        // 3. 'es' plural (slug == baseName + 'es')
        // 4. 'y' to 'ies' plural (category -> categories)
        // 5. Slug starts with baseName (loose match)
        const targetEntity = allEntities.find(e => 
          e.slug === baseName || 
          e.slug === baseName + 's' || 
          e.slug === baseName + 'es' ||
          (baseName.endsWith('y') && e.slug === baseName.slice(0, -1) + 'ies') ||
          e.slug.startsWith(baseName)
        );

        if (targetEntity) {
           extraProps = `, referenceEntity: '${targetEntity.slug}'`;
        } else {
           console.warn(`Could not resolve reference for field ${field.name}`);
        }
      }

      defs.push(`  { name: '${field.name}', label: '${this._formatLabel(field.name)}', type: '${field.type}', widget: '${widget}', required: ${field.required || false}${extraProps} },`);
    }

    // Add feature-specific fields
    if (features.batch_tracking) {
      defs.push(`  { name: 'batch_number', label: 'Batch Number', type: 'string', widget: 'Input', required: true },`);
      defs.push(`  { name: 'expiry_date', label: 'Expiry Date', type: 'date', widget: 'DatePicker', required: false },`);
    }

    if (features.serial_tracking) {
      defs.push(`  { name: 'serial_number', label: 'Serial Number', type: 'string', widget: 'Input', required: true },`);
    }

    if (features.multi_location) {
      defs.push(`  { name: 'location_id', label: 'Location', type: 'reference', widget: 'EntitySelect', required: true, referenceEntity: 'locations' },`);
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

  async generateDynamicForm(outputDir) {
    const formContent = `import { useState, useEffect } from 'react';
import api from '../services/api';

interface FieldDefinition {
  name: string;
  label: string;
  type: string;
  widget: string;
  required?: boolean;
  referenceEntity?: string;
}

interface DynamicFormProps {
  fields: FieldDefinition[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
}

export default function DynamicForm({ fields, initialData = {}, onSubmit, onCancel }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [referenceOptions, setReferenceOptions] = useState<Record<string, any[]>>({});

  useEffect(() => {
    // Load reference options for EntitySelect fields
    const refFields = fields.filter(f => f.widget === 'EntitySelect' && f.referenceEntity);
    refFields.forEach(async (field) => {
      try {
        const res = await api.get(\`/\${field.referenceEntity}\`);
        setReferenceOptions(prev => ({ ...prev, [field.name]: res.data }));
      } catch (err) {
        console.error(\`Failed to load options for \${field.name}\`);
      }
    });
  }, [fields]);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const renderWidget = (field: FieldDefinition) => {
    const value = formData[field.name] ?? '';

    switch (field.widget) {
      case 'NumberInput':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.valueAsNumber)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={field.required}
          />
        );

      case 'DatePicker':
        return (
          <input
            type="date"
            value={value ? value.split('T')[0] : ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={field.required}
          />
        );

      case 'EntitySelect':
        const options = referenceOptions[field.name] || [];
        return (
          <select
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={field.required}
          >
            <option value="">Select...</option>
            {options.map((opt: any) => (
              <option key={opt.id} value={opt.id}>{opt.name || opt.id}</option>
            ))}
          </select>
        );

      case 'TextArea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            required={field.required}
          />
        );

      case 'Checkbox':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleChange(field.name, e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
        );

      default: // Input
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required={field.required}
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {renderWidget(field)}
        </div>
      ))}
      <div className="flex justify-end space-x-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Save
        </button>
      </div>
    </form>
  );
}`;

    await fs.writeFile(path.join(outputDir, 'src/components/DynamicForm.tsx'), formContent);
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _formatLabel(str) {
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

module.exports = FrontendGenerator;

