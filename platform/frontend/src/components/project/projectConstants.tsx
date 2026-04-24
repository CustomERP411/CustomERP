import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

// NOTE: keys ('inventory', 'invoice', 'hr') must stay English — they are used
// as module identifiers everywhere in the SDF / backend. Only labels are translated.
export const MODULE_KEYS = ['inventory', 'invoice', 'hr'] as const;

export function useModuleMeta(): Record<string, { label: string; desc: string }> {
  const { t } = useTranslation('projectDetail');
  return {
    inventory: { label: t('modules.inventory.label'), desc: t('modules.inventory.desc') },
    invoice:   { label: t('modules.invoice.label'),   desc: t('modules.invoice.desc') },
    hr:        { label: t('modules.hr.label'),        desc: t('modules.hr.desc') },
  };
}

// Legacy English-only fallback. Prefer `useModuleMeta()` for UI-facing code.
export const MODULE_META: Record<string, { label: string; desc: string }> = {
  inventory: { label: 'Inventory', desc: 'Track products, stock levels, purchases, and shipments' },
  invoice:   { label: 'Invoice',   desc: 'Create invoices, record payments, issue credit notes' },
  hr:        { label: 'HR',        desc: 'Manage employees, leave, attendance, and payroll prep' },
};

export function useSteps(): string[] {
  const { t } = useTranslation('projectDetail');
  return [
    t('steps.chooseModules'),
    t('steps.answerQuestions'),
    t('steps.describeBusiness'),
    t('steps.reviewGenerate'),
    t('steps.downloadRun'),
  ];
}

export const STEPS = ['Choose Modules', 'Answer Questions', 'Describe Your Business', 'Review & Generate', 'Download & Run'];

export type BusinessQuestion = { id: string; question: string; placeholder: string; hint?: string; optional?: boolean };

// Stable IDs — used for storing answers. Never change these.
export const BUSINESS_QUESTION_IDS: { id: string; optional?: boolean }[] = [
  { id: 'what_business' },
  { id: 'products_services' },
  { id: 'user_count' },
  { id: 'main_problem' },
  { id: 'special_rules' },
  { id: 'anything_else', optional: true },
];

export function useBusinessQuestions(): BusinessQuestion[] {
  const { t } = useTranslation('projectDetail');
  return BUSINESS_QUESTION_IDS.map((q) => {
    const hintKey = `businessQuestions.${q.id}.hint`;
    const translatedHint = t(hintKey);
    return {
      id: q.id,
      question: t(`businessQuestions.${q.id}.question`),
      placeholder: t(`businessQuestions.${q.id}.placeholder`),
      // i18next returns the key itself when missing — treat that as "no hint".
      hint: translatedHint && translatedHint !== hintKey ? translatedHint : undefined,
      optional: q.optional,
    };
  });
}

// Legacy English-only export for code paths that can't use hooks (e.g. outside
// components). Prefer `useBusinessQuestions()` wherever possible.
export const BUSINESS_QUESTIONS: BusinessQuestion[] = [
  { id: 'what_business', question: 'What does your business do?', placeholder: 'e.g. "We sell clothing in two small shops" or "We run a bakery with home delivery"' },
  { id: 'products_services', question: 'What products or services do you offer?', placeholder: 'e.g. "T-shirts, jeans, and accessories" or "Cakes, bread, pastries"' },
  { id: 'user_count', question: 'How many people will use this system?', placeholder: 'e.g. "3 people" or "Just me"' },
  { id: 'main_problem', question: 'What is the main problem you want this system to solve?', placeholder: 'e.g. "I lose track of what I have in stock" or "Creating invoices takes too long"' },
  { id: 'special_rules', question: 'Are there any special rules for how things work in your business?', placeholder: 'e.g. "My manager must approve big orders" or "We give discounts to regular customers"', hint: 'Think about any approval steps, discount rules, or special processes you follow.' },
  { id: 'anything_else', question: 'Anything else you\'d like us to know?', placeholder: 'Optional — anything that might help us build the right system for you', optional: true },
];

export const MOD_STYLES: Record<
  string,
  { sel: string; unsel: string; left: string; panel: string; badge: string; dot: string; icon: string }
> = {
  inventory: {
    sel:   'border-app-mod-inventory bg-app-mod-inventory-soft ring-2 ring-app-mod-inventory-ring',
    unsel: 'border-app-border bg-app-surface hover:border-app-mod-inventory-border hover:bg-app-mod-inventory-soft/40',
    left:  'border-l-4 border-l-app-mod-inventory',
    panel: 'border-app-mod-inventory-border bg-app-mod-inventory-soft',
    badge: 'bg-app-mod-inventory-soft text-app-mod-inventory',
    dot:   'bg-app-mod-inventory',
    icon:  'text-app-mod-inventory',
  },
  invoice: {
    sel:   'border-app-mod-invoice bg-app-mod-invoice-soft ring-2 ring-app-mod-invoice-ring',
    unsel: 'border-app-border bg-app-surface hover:border-app-mod-invoice-border hover:bg-app-mod-invoice-soft/40',
    left:  'border-l-4 border-l-app-mod-invoice',
    panel: 'border-app-mod-invoice-border bg-app-mod-invoice-soft',
    badge: 'bg-app-mod-invoice-soft text-app-mod-invoice',
    dot:   'bg-app-mod-invoice',
    icon:  'text-app-mod-invoice',
  },
  hr: {
    sel:   'border-app-mod-hr bg-app-mod-hr-soft ring-2 ring-app-mod-hr-ring',
    unsel: 'border-app-border bg-app-surface hover:border-app-mod-hr-border hover:bg-app-mod-hr-soft/40',
    left:  'border-l-4 border-l-app-mod-hr',
    panel: 'border-app-mod-hr-border bg-app-mod-hr-soft',
    badge: 'bg-app-mod-hr-soft text-app-mod-hr',
    dot:   'bg-app-mod-hr',
    icon:  'text-app-mod-hr',
  },
  shared: {
    sel: '',
    unsel: '',
    left:  'border-l-4 border-l-app-border-strong',
    panel: 'border-app-border bg-app-surface',
    badge: 'bg-app-surface-hover text-app-text',
    dot:   'bg-app-text-subtle',
    icon:  'text-app-text-muted',
  },
};

export function useAiEditChips(): string[] {
  const { t } = useTranslation('projectDetail');
  return [
    t('aiEditChips.productCategory'),
    t('aiEditChips.stockTransfers'),
    t('aiEditChips.invoiceCurrency'),
    t('aiEditChips.employeeDocs'),
  ];
}

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

export function usePlatformInfo(): typeof PLATFORM_INFO {
  const { t } = useTranslation('projectDetail');
  return {
    'macos-arm64': { label: t('platforms.macosArm'),  icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.command', extractTip: t('platforms.extractTip.mac') },
    'macos-x64':   { label: t('platforms.macosX64'),  icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.command', extractTip: t('platforms.extractTip.mac') },
    'windows-x64': { label: t('platforms.windows'),   icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.bat',     extractTip: t('platforms.extractTip.windows') },
    'linux-x64':   { label: t('platforms.linux'),     icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.sh',      extractTip: t('platforms.extractTip.linux') },
  };
}

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

export type PreviewTranslator = (key: string) => string;

function defaultPreviewT(key: string): string {
  const map: Record<string, string> = {
    'modules.inventory.label': 'Inventory',
    'modules.invoice.label': 'Invoice',
    'modules.hr.label': 'HR',
    'preview.caps.transactionSafety': 'Transaction safety',
    'preview.caps.reservations': 'Reservations',
    'preview.caps.purchaseReceiving': 'Purchase receiving',
    'preview.caps.stockCounts': 'Stock counts',
    'preview.caps.batchTracking': 'Batch tracking',
    'preview.caps.serialTracking': 'Serial tracking',
    'preview.caps.expiryAlerts': 'Expiry alerts',
    'preview.caps.lowStockAlerts': 'Low stock alerts',
    'preview.caps.qrLabels': 'QR labels',
    'preview.caps.payments': 'Payments',
    'preview.caps.creditNotes': 'Credit / debit notes',
    'preview.caps.statusWorkflow': 'Status workflow',
    'preview.caps.lineDiscounts': 'Line discounts',
    'preview.caps.printPdf': 'Print / PDF',
    'preview.caps.leaveTracking': 'Leave tracking',
    'preview.caps.leaveApprovals': 'Leave approvals',
    'preview.caps.attendanceTime': 'Attendance & time',
    'preview.caps.payrollPrep': 'Payroll prep',
    'preview.config.currency': 'Currency',
    'preview.config.taxRate': 'Tax rate',
    'preview.config.workDays': 'Work days',
    'preview.config.hoursPerDay': 'Hours / day',
  };
  return map[key] ?? key;
}

export function summarizeModulesForPreview(
  modules: Record<string, any>,
  entities?: any[],
  t: PreviewTranslator = defaultPreviewT,
) {
  const out: { key: string; label: string; caps: { label: string; enabled: boolean }[]; config: Record<string, string> }[] = [];
  const ents = Array.isArray(entities) ? entities : [];
  const findEntity = (slug: string) => ents.find((e: any) => e.slug === slug) || {} as any;

  if (modules.inventory?.enabled) {
    const stockSlug = modules.inventory.stock_entity || 'products';
    const stockEnt = findEntity(stockSlug);
    const feat = stockEnt.features || {};
    const dash = modules.inventory_dashboard || {};
    out.push({
      key: 'inventory', label: t('modules.inventory.label'),
      caps: [
        { label: t('preview.caps.transactionSafety'), enabled: !!modules.inventory.transactions?.enabled },
        { label: t('preview.caps.reservations'),       enabled: !!modules.inventory.reservations?.enabled },
        { label: t('preview.caps.purchaseReceiving'),  enabled: !!modules.inventory.inbound?.enabled },
        { label: t('preview.caps.stockCounts'),        enabled: !!modules.inventory.cycle_counting?.enabled },
        { label: t('preview.caps.batchTracking'),      enabled: !!feat.batch_tracking },
        { label: t('preview.caps.serialTracking'),     enabled: !!feat.serial_tracking },
        { label: t('preview.caps.expiryAlerts'),       enabled: !!dash.expiry?.enabled },
        { label: t('preview.caps.lowStockAlerts'),     enabled: !!dash.low_stock?.enabled },
        { label: t('preview.caps.qrLabels'),           enabled: !!stockEnt.labels?.enabled },
      ],
      config: {},
    });
  }

  if (modules.invoice?.enabled) {
    const invoiceEnt = findEntity('invoices');
    const invFeat = invoiceEnt.features || {};
    out.push({
      key: 'invoice', label: t('modules.invoice.label'),
      caps: [
        { label: t('preview.caps.transactionSafety'),  enabled: !!modules.invoice.transactions?.enabled },
        { label: t('preview.caps.payments'),           enabled: !!modules.invoice.payments?.enabled },
        { label: t('preview.caps.creditNotes'),        enabled: !!modules.invoice.notes?.enabled },
        { label: t('preview.caps.statusWorkflow'),     enabled: !!modules.invoice.lifecycle?.enabled },
        { label: t('preview.caps.lineDiscounts'),      enabled: !!modules.invoice.calculation_engine?.enabled },
        { label: t('preview.caps.printPdf'),           enabled: !!invFeat.print_invoice },
      ],
      config: {
        [t('preview.config.currency')]: String(modules.invoice.currency || 'USD'),
        [t('preview.config.taxRate')]: modules.invoice.tax_rate != null ? `${modules.invoice.tax_rate}%` : '-',
      },
    });
  }

  if (modules.hr?.enabled) {
    const wd = Array.isArray(modules.hr.work_days) ? modules.hr.work_days.join(', ') : '-';
    out.push({
      key: 'hr', label: t('modules.hr.label'),
      caps: [
        { label: t('preview.caps.leaveTracking'),   enabled: !!modules.hr.leave_engine?.enabled },
        { label: t('preview.caps.leaveApprovals'),  enabled: !!modules.hr.leave_approvals?.enabled },
        { label: t('preview.caps.attendanceTime'),  enabled: !!modules.hr.attendance_time?.enabled },
        { label: t('preview.caps.payrollPrep'),     enabled: !!modules.hr.compensation_ledger?.enabled },
      ],
      config: {
        [t('preview.config.workDays')]: wd,
        [t('preview.config.hoursPerDay')]: modules.hr.daily_hours != null ? String(modules.hr.daily_hours) : '-',
      },
    });
  }

  return out;
}
