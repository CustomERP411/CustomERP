import React, { useEffect, useState } from 'react';

export const MODULE_META: Record<string, { label: string; desc: string }> = {
  inventory: { label: 'Inventory', desc: 'Track products, stock levels, purchases, and shipments' },
  invoice:   { label: 'Invoice',   desc: 'Create invoices, record payments, issue credit notes' },
  hr:        { label: 'HR',        desc: 'Manage employees, leave, attendance, and payroll prep' },
};

export const MODULE_KEYS = Object.keys(MODULE_META);

export const STEPS = ['Choose Modules', 'Answer Questions', 'Describe Your Business', 'Review & Generate', 'Download & Run'];

export const BUSINESS_QUESTIONS: { id: string; question: string; placeholder: string; hint?: string; optional?: boolean }[] = [
  { id: 'what_business', question: 'What does your business do?', placeholder: 'e.g. "We sell clothing in two small shops" or "We run a bakery with home delivery"' },
  { id: 'products_services', question: 'What products or services do you offer?', placeholder: 'e.g. "T-shirts, jeans, and accessories" or "Cakes, bread, pastries"' },
  { id: 'user_count', question: 'How many people will use this system?', placeholder: 'e.g. "3 people" or "Just me"' },
  { id: 'main_problem', question: 'What is the main problem you want this system to solve?', placeholder: 'e.g. "I lose track of what I have in stock" or "Creating invoices takes too long"' },
  { id: 'special_rules', question: 'Are there any special rules for how things work in your business?', placeholder: 'e.g. "My manager must approve big orders" or "We give discounts to regular customers"', hint: 'Think about any approval steps, discount rules, or special processes you follow.' },
  { id: 'anything_else', question: 'Anything else you\'d like us to know?', placeholder: 'Optional — anything that might help us build the right system for you', optional: true },
];

export const MOD_STYLES: Record<string, { sel: string; unsel: string; left: string; badge: string; dot: string; icon: string }> = {
  inventory: {
    sel:   'border-blue-500 bg-blue-50 ring-2 ring-blue-200',
    unsel: 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40',
    left:  'border-l-4 border-l-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    dot:   'bg-blue-500',
    icon:  'text-blue-600',
  },
  invoice: {
    sel:   'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200',
    unsel: 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40',
    left:  'border-l-4 border-l-emerald-500',
    badge: 'bg-emerald-100 text-emerald-800',
    dot:   'bg-emerald-500',
    icon:  'text-emerald-600',
  },
  hr: {
    sel:   'border-violet-500 bg-violet-50 ring-2 ring-violet-200',
    unsel: 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/40',
    left:  'border-l-4 border-l-violet-500',
    badge: 'bg-violet-100 text-violet-800',
    dot:   'bg-violet-500',
    icon:  'text-violet-600',
  },
  shared: {
    sel: '', unsel: '',
    left:  'border-l-4 border-l-slate-300',
    badge: 'bg-slate-100 text-slate-700',
    dot:   'bg-slate-400',
    icon:  'text-slate-500',
  },
};

export const AI_EDIT_CHIPS = [
  'Add a product category field',
  'Enable stock transfers between locations',
  'Change invoice currency to EUR',
  'Add employee document storage',
];

export function detectUserPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator as any).userAgentData?.platform?.toLowerCase?.() || navigator.platform?.toLowerCase?.() || '';
  if (plat.includes('mac') || ua.includes('macintosh')) {
    return ua.includes('arm') || (plat.includes('arm') || /apple\s*m[0-9]/i.test(ua)) ? 'macos-arm64' : 'macos-x64';
  }
  if (plat.includes('win') || ua.includes('windows')) return 'windows-x64';
  return 'linux-x64';
}

export const PLATFORM_INFO: Record<string, { label: string; icon: string; startFile: string; extractTip: string }> = {
  'macos-arm64': { label: 'macOS (Apple Silicon)', icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.command', extractTip: 'Double-click the .zip file in Finder to extract it.' },
  'macos-x64':   { label: 'macOS (Intel)',         icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.command', extractTip: 'Double-click the .zip file in Finder to extract it.' },
  'windows-x64': { label: 'Windows',               icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.bat',     extractTip: 'Right-click the .zip file and choose "Extract All..."' },
  'linux-x64':   { label: 'Linux',                 icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.sh',      extractTip: 'Run: unzip your-erp.zip  (or use your file manager)' },
};

/* ── Reusable slide animation wrapper ─────────────────────── */

export function SlideIn({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  const [shouldRender, setShouldRender] = useState(show);
  const [animate, setAnimate] = useState(show);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (show) {
      setShouldRender(true);
      timer = setTimeout(() => setAnimate(true), 30);
    } else {
      setAnimate(false);
      timer = setTimeout(() => setShouldRender(false), 500);
    }
    return () => clearTimeout(timer);
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div className={`transition-all duration-500 ease-out ${animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}${className ? ' ' + className : ''}`}>
      {children}
    </div>
  );
}

/* ── Inline SVG icons ─────────────────────────────────────── */

export function IconInventory({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7.5V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V7.5m18 0L12 2.25 3 7.5m18 0l-9 4.5-9-4.5m9 4.5v9" />
    </svg>
  );
}

export function IconInvoice({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function IconHR({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export const MODULE_ICONS: Record<string, (p: { className?: string }) => JSX.Element> = {
  inventory: IconInventory,
  invoice: IconInvoice,
  hr: IconHR,
};

/* ── Preview helpers ──────────────────────────────────────── */

export function summarizeModulesForPreview(modules: Record<string, any>, entities?: any[]) {
  const out: { key: string; label: string; caps: { label: string; enabled: boolean }[]; config: Record<string, string> }[] = [];
  const ents = Array.isArray(entities) ? entities : [];
  const findEntity = (slug: string) => ents.find((e: any) => e.slug === slug) || {} as any;

  if (modules.inventory?.enabled) {
    const stockSlug = modules.inventory.stock_entity || 'products';
    const stockEnt = findEntity(stockSlug);
    const feat = stockEnt.features || {};
    const dash = modules.inventory_dashboard || {};
    out.push({
      key: 'inventory', label: 'Inventory',
      caps: [
        { label: 'Transaction safety', enabled: !!modules.inventory.transactions?.enabled },
        { label: 'Reservations',       enabled: !!modules.inventory.reservations?.enabled },
        { label: 'Purchase receiving',  enabled: !!modules.inventory.inbound?.enabled },
        { label: 'Stock counts',        enabled: !!modules.inventory.cycle_counting?.enabled },
        { label: 'Batch tracking',      enabled: !!feat.batch_tracking },
        { label: 'Serial tracking',     enabled: !!feat.serial_tracking },
        { label: 'Expiry alerts',       enabled: !!dash.expiry?.enabled },
        { label: 'Low stock alerts',    enabled: !!dash.low_stock?.enabled },
        { label: 'QR labels',           enabled: !!stockEnt.labels?.enabled },
      ],
      config: {},
    });
  }

  if (modules.invoice?.enabled) {
    const invoiceEnt = findEntity('invoices');
    const invFeat = invoiceEnt.features || {};
    out.push({
      key: 'invoice', label: 'Invoice',
      caps: [
        { label: 'Transaction safety',  enabled: !!modules.invoice.transactions?.enabled },
        { label: 'Payments',             enabled: !!modules.invoice.payments?.enabled },
        { label: 'Credit / debit notes', enabled: !!modules.invoice.notes?.enabled },
        { label: 'Status workflow',      enabled: !!modules.invoice.lifecycle?.enabled },
        { label: 'Line discounts',       enabled: !!modules.invoice.calculation_engine?.enabled },
        { label: 'Print / PDF',          enabled: !!invFeat.print_invoice },
      ],
      config: {
        Currency: String(modules.invoice.currency || 'USD'),
        'Tax rate': modules.invoice.tax_rate != null ? `${modules.invoice.tax_rate}%` : '-',
      },
    });
  }

  if (modules.hr?.enabled) {
    const wd = Array.isArray(modules.hr.work_days) ? modules.hr.work_days.join(', ') : '-';
    out.push({
      key: 'hr', label: 'HR',
      caps: [
        { label: 'Leave tracking',   enabled: !!modules.hr.leave_engine?.enabled },
        { label: 'Leave approvals',   enabled: !!modules.hr.leave_approvals?.enabled },
        { label: 'Attendance & time', enabled: !!modules.hr.attendance_time?.enabled },
        { label: 'Payroll prep',      enabled: !!modules.hr.compensation_ledger?.enabled },
      ],
      config: {
        'Work days': wd,
        'Hours / day': modules.hr.daily_hours != null ? String(modules.hr.daily_hours) : '-',
      },
    });
  }

  return out;
}
