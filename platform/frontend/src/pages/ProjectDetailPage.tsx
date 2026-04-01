import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { projectService } from '../services/projectService';
import type { Project } from '../types/project';
import type { AiGatewaySdf, ClarificationAnswer, ClarificationQuestion } from '../types/aiGateway';
import type {
  DefaultModuleQuestion,
  DefaultQuestionCompletion,
  DefaultQuestionStateResponse,
} from '../types/defaultQuestions';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const MODULE_META: Record<string, { label: string; desc: string }> = {
  inventory: { label: 'Inventory', desc: 'Track products, stock levels, purchases, and shipments' },
  invoice:   { label: 'Invoice',   desc: 'Create invoices, record payments, issue credit notes' },
  hr:        { label: 'HR',        desc: 'Manage employees, leave, attendance, and payroll prep' },
};

const MODULE_KEYS = Object.keys(MODULE_META);

const STEPS = ['Choose Modules', 'Answer Questions', 'Describe Your Business', 'Review & Generate', 'Download & Run'];

function detectUserPlatform(): string {
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator as any).userAgentData?.platform?.toLowerCase?.() || navigator.platform?.toLowerCase?.() || '';
  if (plat.includes('mac') || ua.includes('macintosh')) {
    return ua.includes('arm') || (plat.includes('arm') || /apple\s*m[0-9]/i.test(ua)) ? 'macos-arm64' : 'macos-x64';
  }
  if (plat.includes('win') || ua.includes('windows')) return 'windows-x64';
  return 'linux-x64';
}

const PLATFORM_INFO: Record<string, { label: string; icon: string; startFile: string; extractTip: string }> = {
  'macos-arm64': { label: 'macOS (Apple Silicon)', icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.command', extractTip: 'Double-click the .zip file in Finder to extract it.' },
  'macos-x64':   { label: 'macOS (Intel)',         icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.command', extractTip: 'Double-click the .zip file in Finder to extract it.' },
  'windows-x64': { label: 'Windows',               icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.bat',     extractTip: 'Right-click the .zip file and choose "Extract All..."' },
  'linux-x64':   { label: 'Linux',                 icon: '\uD83D\uDDA5\uFE0F', startFile: 'start.sh',      extractTip: 'Run: unzip your-erp.zip  (or use your file manager)' },
};

const MOD_STYLES: Record<string, { sel: string; unsel: string; left: string; badge: string; dot: string; icon: string }> = {
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

const AI_EDIT_CHIPS = [
  'Add a product category field',
  'Enable stock transfers between locations',
  'Change invoice currency to EUR',
  'Add employee document storage',
];

const DESCRIPTION_PLACEHOLDER =
  'Example: We are a small electronics retail store with 2 locations. We sell phones, laptops, and accessories. We have 8 employees. We need to track inventory across both stores, create invoices for B2B customers with net-30 payment terms, and manage employee leave requests. Stock transfers between stores happen weekly.';

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                  */
/* ------------------------------------------------------------------ */

function IconInventory({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7.5V18a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V7.5m18 0L12 2.25 3 7.5m18 0l-9 4.5-9-4.5m9 4.5v9" />
    </svg>
  );
}

function IconInvoice({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function IconHR({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

const MODULE_ICONS: Record<string, (p: { className?: string }) => JSX.Element> = {
  inventory: IconInventory,
  invoice: IconInvoice,
  hr: IconHR,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function summarizeModulesForPreview(modules: Record<string, any>, entities?: any[]) {
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

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id || '');

  const [project, setProject] = useState<Project | null>(null);
  const [description, setDescription] = useState('');
  const [sdf, setSdf] = useState<AiGatewaySdf | null>(null);
  const [prefilledSdf, setPrefilledSdf] = useState<AiGatewaySdf | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>(MODULE_KEYS);
  const [defaultQuestions, setDefaultQuestions] = useState<DefaultModuleQuestion[]>([]);
  const [defaultAnswersById, setDefaultAnswersById] = useState<Record<string, string | string[]>>({});
  const [defaultCompletion, setDefaultCompletion] = useState<DefaultQuestionCompletion | null>(null);
  const [loadingDefaultQuestions, setLoadingDefaultQuestions] = useState(false);
  const [savingDefaultAnswers, setSavingDefaultAnswers] = useState(false);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [standaloneRunning, setStandaloneRunning] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [showPrefilledJson, setShowPrefilledJson] = useState(false);
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [draftJson, setDraftJson] = useState('');
  const [draftError, setDraftError] = useState('');
  const [aiEditText, setAiEditText] = useState('');
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);
  const [showDockerAdvanced, setShowDockerAdvanced] = useState(false);

  const detectedPlatform = useMemo(() => detectUserPlatform(), []);

  /* -------- helpers ------------------------------------------------ */

  const filterQuestions = (raw: any[]): ClarificationQuestion[] => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.filter((q: any) => {
      const id = String(q?.id || '');
      const text = String(q?.question || '');
      return !/chat\s*bot|chatbot|sohbet\s*botu|sohbetbot/i.test(id + ' ' + text);
    }) as ClarificationQuestion[];
  };

  const applyDefaultQuestionState = (payload: DefaultQuestionStateResponse) => {
    const questionList = Array.isArray(payload?.questions) ? payload.questions : [];
    const answers: Record<string, string | string[]> = {};
    for (const question of questionList) {
      if (Array.isArray(question.answer)) {
        answers[question.id] = question.answer;
      } else if (typeof question.answer === 'string') {
        answers[question.id] = question.answer;
      } else {
        answers[question.id] = question.type === 'multi_choice' ? [] : '';
      }
    }
    setDefaultQuestions(questionList);
    setDefaultAnswersById(answers);
    setPrefilledSdf(payload?.prefilled_sdf || null);
    setDefaultCompletion(payload?.prefill_validation || payload?.completion || null);
  };

  const evaluateQuestionVisibility = (question: DefaultModuleQuestion) => {
    const condition = question.condition;
    if (!condition || !Array.isArray(condition.rules) || !condition.rules.length) return true;
    const byKey = Object.fromEntries(defaultQuestions.map((item) => [item.key, defaultAnswersById[item.id]]));
    const checks = condition.rules.map((rule) => {
      const actual = byKey[rule.question_key];
      const expected = String(rule.equals || '').trim().toLowerCase();
      if (Array.isArray(actual)) return actual.map((item) => String(item).trim().toLowerCase()).includes(expected);
      return String(actual || '').trim().toLowerCase() === expected;
    });
    return condition.op === 'any' ? checks.some(Boolean) : checks.every(Boolean);
  };

  /* -------- effects ------------------------------------------------ */

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!projectId) return;
      setLoading(true);
      setError('');
      try {
        const p = await projectService.getProject(projectId);
        const latest = await projectService.getLatestSdf(projectId).catch(() => ({ sdf: null, sdf_version: null }));
        if (cancelled) return;
        setProject(p);
        setDescription(String(p.description || ''));
        if (latest?.sdf) {
          setSdf(latest.sdf);
          setQuestions(filterQuestions(Array.isArray(latest.sdf.clarifications_needed) ? latest.sdf.clarifications_needed : []));
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || 'Failed to load project');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [projectId]);

  const selectedModulesKey = useMemo(() => selectedModules.slice().sort().join(','), [selectedModules]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!projectId || !selectedModules.length) return;
      setLoadingDefaultQuestions(true);
      setError('');
      try {
        const payload = await projectService.getDefaultQuestions(projectId, selectedModules);
        if (cancelled) return;
        applyDefaultQuestionState(payload);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.response?.data?.error || err?.message || 'Failed to load default module questions');
      } finally {
        if (!cancelled) setLoadingDefaultQuestions(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [projectId, selectedModulesKey]);

  useEffect(() => {
    if (!sdf) return;
    setDraftJson(JSON.stringify(sdf, null, 2));
    setDraftError('');
  }, [sdf]);

  /* -------- derived state ----------------------------------------- */

  const visibleDefaultQuestions = useMemo(
    () => defaultQuestions.filter((question) => evaluateQuestionVisibility(question)),
    [defaultQuestions, defaultAnswersById]
  );

  const canAnalyze = useMemo(
    () => description.trim().length >= 10 && defaultCompletion?.is_complete === true && selectedModules.length > 0,
    [description, defaultCompletion, selectedModules.length]
  );

  const canSaveDefaultAnswers = useMemo(
    () => selectedModules.length > 0 && defaultQuestions.length > 0,
    [selectedModules.length, defaultQuestions.length]
  );

  const canSubmitAnswers = useMemo(() => {
    if (!sdf) return false;
    if (!questions.length) return false;
    return questions.every((q) => (answersById[q.id] || '').trim().length > 0);
  }, [sdf, questions, answersById]);

  const currentStep = useMemo(() => {
    if (!selectedModules.length) return 0;
    if (!defaultCompletion?.is_complete) return 1;
    if (description.trim().length < 10) return 2;
    if (sdf) return 4;
    return 3;
  }, [selectedModules, defaultCompletion, description, sdf]);

  const questionsByModule = useMemo(() => {
    const groups: Record<string, DefaultModuleQuestion[]> = {};
    for (const q of visibleDefaultQuestions) {
      const mod = q.module || 'general';
      if (!groups[mod]) groups[mod] = [];
      groups[mod].push(q);
    }
    return groups;
  }, [visibleDefaultQuestions]);

  const moduleCompletionCounts = useMemo(() => {
    const counts: Record<string, { total: number; answered: number }> = {};
    for (const q of visibleDefaultQuestions) {
      const mod = q.module || 'general';
      if (!counts[mod]) counts[mod] = { total: 0, answered: 0 };
      counts[mod].total++;
      const raw = defaultAnswersById[q.id];
      const filled = Array.isArray(raw) ? raw.length > 0 : (typeof raw === 'string' && raw.trim().length > 0);
      if (filled) counts[mod].answered++;
    }
    return counts;
  }, [visibleDefaultQuestions, defaultAnswersById]);

  const descCharCount = description.trim().length;

  const prefilledModuleSummary = useMemo(
    () => prefilledSdf ? summarizeModulesForPreview((prefilledSdf as any).modules || {}, (prefilledSdf as any).entities) : [],
    [prefilledSdf]
  );

  /* -------- SDF preview ------------------------------------------- */

  const preview = useMemo(() => {
    if (!sdf) return null;

    const formatLabel = (name: string) =>
      String(name || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    const entities = Array.isArray((sdf as any).entities) ? (sdf as any).entities : [];
    const modules = (sdf as any).modules && typeof (sdf as any).modules === 'object' ? (sdf as any).modules : {};
    const warningsRaw = (sdf as any).warnings;
    const warnings = Array.isArray(warningsRaw) ? warningsRaw.map(String).map((s) => s.trim()).filter(Boolean) : [];

    const entityBySlug: Record<string, any> = Object.fromEntries(
      entities.map((e: any) => [String(e?.slug || ''), e] as const).filter(([slug]: readonly [string, any]) => Boolean(slug))
    );

    const resolveRefSlug = (field: any) => {
      const explicit = field?.reference_entity || field?.referenceEntity;
      if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
      const name = String(field?.name || '');
      const base = name.replace(/_ids?$/, '');
      if (!base) return null;
      const slugCandidates = [base, base + 's', base + 'es', base.endsWith('y') ? base.slice(0, -1) + 'ies' : null].filter(Boolean) as string[];
      for (const c of slugCandidates) { if (entityBySlug[c]) return c; }
      return Object.keys(entityBySlug).find((s) => s.startsWith(base)) || null;
    };

    const guessDisplayField = (entity: any) => {
      const df = entity?.display_field || entity?.displayField;
      if (df) return String(df);
      const fields = Array.isArray(entity?.fields) ? entity.fields : [];
      if (fields.some((f: any) => f?.name === 'name')) return 'name';
      if (fields.some((f: any) => f?.name === 'sku')) return 'sku';
      const first = fields.find((f: any) => f?.name && !['id', 'created_at', 'updated_at'].includes(String(f.name)));
      return first ? String(first.name) : 'id';
    };

    const summarizeEntity = (entity: any) => {
      const slug = String(entity?.slug || '');
      const name = entity?.display_name ? String(entity.display_name) : formatLabel(slug);
      const mod = String(entity?.module || 'shared');
      const fields = Array.isArray(entity?.fields) ? entity.fields : [];
      const ui = entity?.ui || {};
      const searchEnabled = ui.search !== false;
      const csvImportEnabled = ui.csv_import !== false;
      const csvExportEnabled = ui.csv_export !== false;
      const printEnabled = ui.print !== false;

      const configuredCols = Array.isArray(entity?.list?.columns) ? entity.list.columns : null;
      const defaultCols = fields.filter((f: any) => f?.name && f.name !== 'id').slice(0, 5).map((f: any) => String(f.name));
      const columns: string[] = (configuredCols && configuredCols.length ? configuredCols : defaultCols).map(String).filter((c: string) => c && c !== 'id');
      const fieldByName: Record<string, any> = Object.fromEntries(fields.map((f: any) => [String(f?.name || ''), f]));
      const columnLabels = columns.map((c: string) => { const f = fieldByName[c]; return f?.label ? String(f.label) : formatLabel(c); });

      const requiredFields = fields.filter((f: any) => f?.required === true).map((f: any) => (f?.label ? String(f.label) : formatLabel(String(f?.name || '')))).filter(Boolean);
      const uniqueFields = fields.filter((f: any) => f?.unique === true).map((f: any) => (f?.label ? String(f.label) : formatLabel(String(f?.name || '')))).filter(Boolean);

      const choiceFields = fields.map((f: any) => {
        const raw = f?.options ?? f?.enum;
        const options = Array.isArray(raw) ? raw.map(String).map((s) => s.trim()).filter(Boolean) : [];
        if (!options.length) return null;
        return { label: f?.label ? String(f.label) : formatLabel(String(f?.name || '')), options };
      }).filter(Boolean) as { label: string; options: string[] }[];

      const relationFields = fields.map((f: any) => {
        const type = String(f?.type || '');
        const fname = String(f?.name || '');
        const isRefish = type === 'reference' || fname.endsWith('_id') || fname.endsWith('_ids') || !!(f?.reference_entity || f?.referenceEntity);
        if (!isRefish) return null;
        const targetSlug = resolveRefSlug(f);
        if (!targetSlug) return null;
        const target = entityBySlug[targetSlug];
        const targetName = target?.display_name ? String(target.display_name) : formatLabel(targetSlug);
        const multiple = f?.multiple === true || fname.endsWith('_ids');
        return { label: f?.label ? String(f.label) : formatLabel(fname), targetSlug, targetName, multiple };
      }).filter(Boolean) as { label: string; targetSlug: string; targetName: string; multiple: boolean }[];

      const inv = entity?.inventory_ops || entity?.inventoryOps || {};
      const invEnabled = inv?.enabled === true;
      const receiveEnabled = invEnabled && (inv?.receive?.enabled !== false);
      const adjustEnabled = invEnabled && (inv?.adjust?.enabled !== false);
      const issueCfg = inv?.issue || inv?.sell || inv?.issue_stock || inv?.issueStock || {};
      const sellEnabled = invEnabled && issueCfg?.enabled === true;
      const sellLabel = issueCfg?.label || issueCfg?.display_name || issueCfg?.displayName || issueCfg?.name || 'Sell';
      const features = entity?.features || {};
      const transferEnabled = invEnabled && (inv?.transfer?.enabled === true || (inv?.transfer?.enabled !== false && (features?.multi_location === true || fields.some((f: any) => f && String(f.name || '').includes('location')))));
      const labels = entity?.labels || {};
      const labelsEnabled = labels?.enabled === true && labels?.type === 'qrcode';

      const quickCfg = inv?.quick_actions || inv?.quickActions || {};
      const quickAll = quickCfg === true;
      const quickReceive = receiveEnabled && (quickAll || quickCfg?.receive === true || quickCfg?.add === true || quickCfg?.in === true);
      const quickSell = sellEnabled && (quickAll || quickCfg?.issue === true || quickCfg?.sell === true || quickCfg?.out === true);

      const bulk = entity?.bulk_actions || entity?.bulkActions || {};
      const bulkEnabled = bulk?.enabled === true;
      const bulkDelete = bulkEnabled && bulk?.delete !== false;
      const bulkUpdateFields = Array.isArray(bulk?.update_fields) ? bulk.update_fields.map(String) : [];
      const bulkUpdate = bulkEnabled && bulkUpdateFields.length > 0;

      const screens: string[] = ['List page', 'Create / Edit form'];
      if (csvImportEnabled) screens.push('CSV import page');
      if (csvExportEnabled) screens.push('CSV export (download)');
      if (printEnabled) screens.push('Print / PDF');
      if (receiveEnabled) screens.push('Receive stock');
      if (sellEnabled) screens.push(sellLabel);
      if (adjustEnabled) screens.push('Adjust stock (corrections)');
      if (transferEnabled) screens.push('Transfer stock');
      if (labelsEnabled) screens.push('QR Labels');

      return {
        slug, name, mod, displayField: guessDisplayField(entity), searchEnabled, csvImportEnabled, csvExportEnabled, printEnabled,
        columns: columnLabels, requiredFields, uniqueFields, choiceFields, relationFields, screens,
        inv: { enabled: invEnabled, receiveEnabled, sellEnabled, sellLabel, adjustEnabled, transferEnabled, quickReceive, quickSell },
        bulk: { enabled: bulkEnabled, delete: bulkDelete, update: bulkUpdate, updateFields: bulkUpdateFields.map((n: string) => { const f = fieldByName[n]; return f?.label ? String(f.label) : formatLabel(n); }) },
        labelsEnabled,
      };
    };

    const enabledModules: { title: string; description: string }[] = [];
    const activity = (modules as any).activity_log || (modules as any).activityLog || {};
    if (activity?.enabled === true) enabledModules.push({ title: 'Activity log', description: 'A feed of recent changes.' });
    const invDash = (modules as any).inventory_dashboard || (modules as any).inventoryDashboard || {};
    if (invDash?.low_stock?.enabled) enabledModules.push({ title: 'Low stock alerts', description: 'Dashboard shows items running low.' });
    if (invDash?.expiry?.enabled) enabledModules.push({ title: 'Expiry alerts', description: 'Dashboard shows items expiring soon.' });
    const sched = (modules as any).scheduled_reports || (modules as any).scheduledReports || {};
    if (sched?.enabled === true) enabledModules.push({ title: 'Reports', description: 'Reports screen with inventory metrics.' });

    const entitySummaries = entities.map((e: any) => summarizeEntity(e)).filter((e: any) => e && e.slug);
    const projectName = String((sdf as any).project_name || '');
    const screensTotal = 1 + (enabledModules.some((m) => m.title === 'Activity log') ? 1 : 0) + (enabledModules.some((m) => m.title === 'Reports') ? 1 : 0) + entitySummaries.reduce((acc: number, e: any) => acc + e.screens.length, 0);

    const moduleSummaries = summarizeModulesForPreview(modules, entities);

    return { projectName, entityCount: entitySummaries.length, screensTotal, enabledModules, warnings, entities: entitySummaries, moduleSummaries };
  }, [sdf]);

  /* -------- handlers ---------------------------------------------- */

  const updateDefaultAnswer = (questionId: string, value: string | string[]) => {
    setDefaultAnswersById((prev) => ({ ...prev, [questionId]: value }));
  };

  const toggleMultiChoiceAnswer = (questionId: string, option: string, enabled: boolean) => {
    setDefaultAnswersById((prev) => {
      const existing = Array.isArray(prev[questionId]) ? (prev[questionId] as string[]) : [];
      const next = enabled ? Array.from(new Set([...existing, option])) : existing.filter((item) => item !== option);
      return { ...prev, [questionId]: next };
    });
  };

  const toggleModule = (key: string) => {
    setSelectedModules((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]);
  };

  const saveDefaultAnswers = async () => {
    if (!projectId || !selectedModules.length) return;
    setSavingDefaultAnswers(true);
    setError('');
    try {
      const payload = await projectService.saveDefaultAnswers(projectId, {
        modules: selectedModules,
        answers: defaultQuestions.map((question) => ({ question_id: question.id, answer: defaultAnswersById[question.id] ?? (question.type === 'multi_choice' ? [] : '') })),
      });
      applyDefaultQuestionState(payload);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save answers');
    } finally {
      setSavingDefaultAnswers(false);
    }
  };

  const analyze = async () => {
    if (!projectId) return;
    setRunning(true);
    setError('');
    try {
      const latestDefaults = await projectService.saveDefaultAnswers(projectId, {
        modules: selectedModules,
        answers: defaultQuestions.map((question) => ({ question_id: question.id, answer: defaultAnswersById[question.id] ?? (question.type === 'multi_choice' ? [] : '') })),
      });
      applyDefaultQuestionState(latestDefaults);
      const latestCompletion = latestDefaults.prefill_validation || latestDefaults.completion;
      if (!latestCompletion?.is_complete) {
        setError('Please answer all required questions before generating.');
        return;
      }
      const res = await projectService.analyzeProject(projectId, description.trim(), {
        modules: selectedModules,
        default_question_answers: latestDefaults.mandatory_answers,
        prefilled_sdf: latestDefaults.prefilled_sdf || undefined,
      });
      setProject(res.project);
      setSdf(res.sdf);
      setQuestions(filterQuestions(res.questions || []));
      setAnswersById({});
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Generation failed');
    } finally {
      setRunning(false);
    }
  };

  const submitAnswers = async () => {
    if (!projectId || !sdf) return;
    setRunning(true);
    setError('');
    try {
      const answers: ClarificationAnswer[] = questions.map((q) => ({ question_id: q.id, answer: (answersById[q.id] || '').trim() }));
      const res = await projectService.clarifyProject(projectId, sdf, answers, description.trim());
      setProject(res.project);
      setSdf(res.sdf);
      setQuestions(filterQuestions(res.questions || []));
      setAnswersById({});
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Clarify failed');
    } finally {
      setRunning(false);
    }
  };

  const saveDraft = async () => {
    if (!projectId || !draftJson) return;
    setRunning(true);
    setError('');
    setDraftError('');
    try {
      let parsed: any;
      try { parsed = JSON.parse(draftJson); } catch (e: any) { setDraftError('Invalid JSON: ' + (e?.message || 'Parse error')); return; }
      const res = await projectService.saveSdf(projectId, parsed);
      setProject(res.project);
      setSdf(res.sdf);
      setQuestions(filterQuestions(res.questions || []));
      setAnswersById({});
      setDraftJson(JSON.stringify(res.sdf, null, 2));
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Save failed');
    } finally {
      setRunning(false);
    }
  };

  const applyAiEdit = async () => {
    if (!projectId || !aiEditText.trim()) return;
    setRunning(true);
    setError('');
    try {
      const res = await projectService.aiEditSdf(projectId, aiEditText.trim(), sdf || undefined);
      setProject(res.project);
      setSdf(res.sdf);
      setQuestions(filterQuestions(res.questions || []));
      setAnswersById({});
      setAiEditText('');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'AI edit failed');
    } finally {
      setRunning(false);
    }
  };

  const downloadZip = async () => {
    if (!projectId) return;
    setRunning(true);
    setError('');
    try {
      const blob = await projectService.generateErpZip(projectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ((sdf as any)?.project_name || project?.name || 'custom-erp') + '.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      try {
        const text = await (err?.response?.data instanceof Blob ? err.response.data.text() : Promise.resolve(''));
        const parsed = text ? JSON.parse(text) : null;
        setError(parsed?.error || err?.message || 'Generate failed');
      } catch {
        setError(err?.response?.data?.error || err?.message || 'Generate failed');
      }
    } finally {
      setRunning(false);
    }
  };

  const downloadStandalone = async (platform: string) => {
    if (!projectId) return;
    setStandaloneRunning(platform);
    setError('');
    try {
      const blob = await projectService.generateStandaloneErpZip(projectId, platform);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(sdf as any)?.project_name || project?.name || 'custom-erp'}-${platform}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadStarted(platform);
    } catch (err: any) {
      try {
        const text = await (err?.response?.data instanceof Blob ? err.response.data.text() : Promise.resolve(''));
        const parsed = text ? JSON.parse(text) : null;
        setError(parsed?.error || err?.message || 'Standalone generation failed');
      } catch {
        setError(err?.response?.data?.error || err?.message || 'Standalone generation failed');
      }
    } finally {
      setStandaloneRunning(null);
    }
  };

  /* ================================================================ */
  /*  RENDER                                                          */
  /* ================================================================ */

  if (loading) return <div className="flex items-center justify-center py-20 text-slate-500">Loading project...</div>;

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Project</h1>
          <Link to="/" className="text-sm font-semibold text-indigo-600 hover:underline">Back</Link>
        </div>
        <div className="rounded-lg border bg-white p-4 text-sm text-red-600">{error || 'Project not found'}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Set up your ERP step by step</p>
        </div>
        <Link to="/" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          Back to Projects
        </Link>
      </div>

      {/* ── Step Progress Bar ──────────────────────────────────── */}
      <nav className="flex items-center gap-1">
        {STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex items-center gap-2">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? 'bg-indigo-600 text-white' : active ? 'border-2 border-indigo-600 text-indigo-600' : 'border-2 border-slate-300 text-slate-400'}`}>
                  {done ? <IconCheck className="h-4 w-4" /> : i + 1}
                </div>
                <span className={`hidden text-xs font-medium sm:block ${done ? 'text-indigo-600' : active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`mx-2 h-0.5 flex-1 rounded ${done ? 'bg-indigo-600' : 'bg-slate-200'}`} />}
            </div>
          );
        })}
      </nav>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* ── Step 1: Choose Modules ─────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">1. Choose Modules</h2>
          <p className="mt-0.5 text-sm text-slate-500">Select which parts of the ERP you need. You can always change this later.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODULE_KEYS.map((key) => {
            const meta = MODULE_META[key];
            const styles = MOD_STYLES[key];
            const selected = selectedModules.includes(key);
            const Ico = MODULE_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleModule(key)}
                className={`relative flex flex-col items-start gap-3 rounded-xl border-2 p-5 text-left transition-all ${selected ? styles.sel : styles.unsel}`}
              >
                {selected && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <IconCheck className="h-3 w-3" />
                  </div>
                )}
                <div className={styles.icon}><Ico /></div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{meta.label}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{meta.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Step 2: Answer Questions ───────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">2. Answer Questions</h2>
            <p className="mt-0.5 text-sm text-slate-500">These answers directly configure your ERP. Answer all to continue.</p>
          </div>
          {defaultCompletion && (
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${defaultCompletion.is_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {defaultCompletion.answered_required_visible}/{defaultCompletion.total_required_visible} answered
            </span>
          )}
        </div>

        {loadingDefaultQuestions ? (
          <div className="rounded-xl border bg-slate-50 p-6 text-center text-sm text-slate-500">Loading questions...</div>
        ) : (
          <div className="space-y-6">
            {MODULE_KEYS.filter((mod) => questionsByModule[mod]?.length).map((mod) => {
              const modQuestions = questionsByModule[mod];
              const meta = MODULE_META[mod];
              const styles = MOD_STYLES[mod];
              const counts = moduleCompletionCounts[mod] || { total: 0, answered: 0 };
              const allDone = counts.total > 0 && counts.answered === counts.total;

              return (
                <div key={mod} className={`rounded-xl border bg-white overflow-hidden ${styles.left}`}>
                  <div className="flex items-center justify-between gap-3 border-b bg-slate-50/60 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${styles.dot}`} />
                      <span className="text-sm font-semibold text-slate-900">{meta.label}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {counts.answered}/{counts.total}
                    </span>
                  </div>

                  <div className="divide-y">
                    {modQuestions.map((q, qi) => {
                      const rawAnswer = defaultAnswersById[q.id];
                      const answerString = Array.isArray(rawAnswer) ? '' : String(rawAnswer || '');
                      const options = Array.isArray(q.options) ? q.options : [];
                      const multiValues = Array.isArray(rawAnswer) ? rawAnswer : [];
                      const selectedKnownOption = options.includes(answerString) ? answerString : '';
                      const customValue = options.includes(answerString) ? '' : answerString;

                      return (
                        <div key={q.id} className="px-5 py-4">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                              {qi + 1}
                            </span>
                            <div className="flex-1 space-y-2.5">
                              <div className="text-sm font-medium text-slate-800">
                                {q.question}
                                {q.required && <span className="ml-1 text-red-500">*</span>}
                              </div>

                              {/* yes / no pills */}
                              {q.type === 'yes_no' && (
                                <div className="flex gap-2">
                                  {['yes', 'no'].map((val) => (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() => updateDefaultAnswer(q.id, val)}
                                      className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                                        answerString === val
                                          ? val === 'yes' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      {val === 'yes' ? 'Yes' : 'No'}
                                    </button>
                                  ))}
                                </div>
                              )}

                              {/* multi choice pills */}
                              {q.type === 'multi_choice' && (
                                <div className="flex flex-wrap gap-2">
                                  {options.map((opt) => {
                                    const checked = multiValues.includes(opt);
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => toggleMultiChoiceAnswer(q.id, opt, !checked)}
                                        className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                          checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* choice (segmented or dropdown) */}
                              {q.type === 'choice' && options.length > 0 && (
                                <div className="space-y-2">
                                  {options.length <= 6 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {options.map((opt) => (
                                        <button
                                          key={opt}
                                          type="button"
                                          onClick={() => updateDefaultAnswer(q.id, opt)}
                                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                                            selectedKnownOption === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                          }`}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <select
                                      value={selectedKnownOption}
                                      onChange={(e) => updateDefaultAnswer(q.id, e.target.value)}
                                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                                    >
                                      <option value="">Select...</option>
                                      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                  )}
                                  {q.allow_custom && (
                                    <input
                                      value={customValue}
                                      onChange={(e) => updateDefaultAnswer(q.id, e.target.value)}
                                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                                      placeholder="Or type a custom value..."
                                    />
                                  )}
                                </div>
                              )}

                              {/* text fallback */}
                              {q.type === 'text' && (
                                <input
                                  value={answerString}
                                  onChange={(e) => updateDefaultAnswer(q.id, e.target.value)}
                                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                                  placeholder="Your answer..."
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={saveDefaultAnswers} loading={savingDefaultAnswers} disabled={!canSaveDefaultAnswers || savingDefaultAnswers}>
            Save Answers
          </Button>
        </div>
      </section>

      {/* ── Prefilled Config Summary ──────────────────────────── */}
      {prefilledModuleSummary.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Your ERP Configuration</h3>
              <p className="mt-0.5 text-xs text-slate-500">Auto-generated from your answers above. This is sent as a starting point for AI.</p>
            </div>
            <button type="button" onClick={() => setShowPrefilledJson((v) => !v)} className="text-xs text-slate-500 underline hover:text-slate-700">
              {showPrefilledJson ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {prefilledModuleSummary.map((ms) => {
              const styles = MOD_STYLES[ms.key] || MOD_STYLES.shared;
              return (
                <div key={ms.key} className={`rounded-xl border bg-white p-4 ${styles.left}`}>
                  <div className="text-sm font-semibold text-slate-900">{ms.label}</div>
                  {Object.entries(ms.config).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(ms.config).map(([k, v]) => (
                        <div key={k} className="text-xs text-slate-600"><span className="font-medium">{k}:</span> {v}</div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {ms.caps.map((c) => (
                      <span key={c.label} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {showPrefilledJson && (
            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(prefilledSdf, null, 2)}
            </pre>
          )}
        </section>
      )}

      {/* ── Step 3: Describe Your Business ─────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">3. Describe Your Business</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            This description is sent to AI along with your answers to generate the full ERP setup.
          </p>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-slate-700 space-y-2">
          <div className="font-semibold text-indigo-900">Help us understand your business. Try to mention:</div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>What does your business do? <span className="text-slate-400">(e.g. "We are a wholesale food distributor")</span></li>
            <li>What products or services do you offer?</li>
            <li>How many people will use the system?</li>
            <li>What is the main problem you want the ERP to solve?</li>
            <li>Any special workflows? <span className="text-slate-400">(e.g. "Orders must be approved by a manager before shipping")</span></li>
          </ul>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition-shadow focus:ring-2 focus:ring-indigo-500"
          placeholder={DESCRIPTION_PLACEHOLDER}
        />

        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${descCharCount < 10 ? 'text-red-500' : descCharCount < 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
            {descCharCount} character{descCharCount !== 1 ? 's' : ''}{descCharCount < 10 ? ' (minimum 10)' : descCharCount < 50 ? ' (try to write more for better results)' : ''}
          </span>
          <Button onClick={analyze} loading={running} disabled={!canAnalyze || running}>
            Generate My ERP Setup
          </Button>
        </div>
      </section>

      {/* ── Clarification Questions ────────────────────────────── */}
      {questions.length > 0 && (
        <section className="rounded-xl border bg-white p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Follow-up Questions</h2>
            <p className="mt-0.5 text-sm text-slate-500">The AI needs a bit more information to finalize your setup.</p>
          </div>

          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="rounded-lg border bg-slate-50 p-4 space-y-2">
                <div className="text-sm font-medium text-slate-800">{q.question}</div>
                {q.type === 'yes_no' ? (
                  <div className="flex gap-2">
                    {['yes', 'no'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAnswersById((prev) => ({ ...prev, [q.id]: val }))}
                        className={`rounded-lg border px-5 py-2 text-sm font-medium transition-colors ${
                          answersById[q.id] === val
                            ? val === 'yes' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-400 bg-red-50 text-red-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {val === 'yes' ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                ) : q.type === 'choice' && Array.isArray(q.options) && q.options.length ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAnswersById((prev) => ({ ...prev, [q.id]: opt }))}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                            answersById[q.id] === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={q.options.includes(answersById[q.id] || '') ? '' : (answersById[q.id] || '')}
                      onChange={(e) => setAnswersById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      rows={2}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                      placeholder="Or type a custom answer..."
                    />
                  </div>
                ) : (
                  <input
                    value={answersById[q.id] || ''}
                    onChange={(e) => setAnswersById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    placeholder="Your answer..."
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={submitAnswers} loading={running} disabled={!canSubmitAnswers || running}>
              Submit Answers
            </Button>
          </div>
        </section>
      )}

      {!questions.length && sdf && (
        <div className="rounded-xl border bg-emerald-50 px-5 py-4">
          <div className="text-sm font-semibold text-emerald-800">No follow-up questions needed</div>
          <div className="mt-0.5 text-xs text-emerald-600">The AI generated a complete ERP setup from your inputs.</div>
        </div>
      )}

      {/* ── Generated ERP Preview ──────────────────────────────── */}
      {sdf && preview && (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">4. Your ERP Setup</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Project: <span className="font-medium text-slate-700">{preview.projectName}</span>{' '}
                &middot; {preview.entityCount} data sections &middot; ~{preview.screensTotal} screens
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={saveDraft} loading={running} disabled={running || !!standaloneRunning}>
              Save Configuration
            </Button>
          </div>

          {/* ── 5. Download & Run ────────────────────────────── */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-emerald-900">5. Download & Run Your ERP</h3>
              <p className="text-sm text-emerald-700">
                Your ERP is ready. Download it, extract the ZIP, and double-click to start.
                <br />
                <span className="font-medium">No extra software, no internet connection, and no technical knowledge required.</span>
              </p>
            </div>

            {(() => {
              const rec = PLATFORM_INFO[detectedPlatform] || PLATFORM_INFO['windows-x64'];
              const otherPlatforms = Object.entries(PLATFORM_INFO).filter(([k]) => k !== detectedPlatform);
              return (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Recommended for your computer</span>
                    </div>
                    <button
                      onClick={() => downloadStandalone(detectedPlatform)}
                      disabled={running || !!standaloneRunning}
                      className={`w-full rounded-xl border-2 px-5 py-4 text-left font-semibold shadow-sm transition
                        ${standaloneRunning === detectedPlatform
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 cursor-wait'
                          : 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
                        }`}
                    >
                      <div className="text-base">{standaloneRunning === detectedPlatform ? 'Building your ERP...' : `Download for ${rec.label}`}</div>
                      <div className={`mt-0.5 text-xs font-normal ${standaloneRunning === detectedPlatform ? 'text-emerald-600' : 'text-emerald-100'}`}>
                        Self-contained bundle &middot; includes everything needed to run
                      </div>
                    </button>
                    {standaloneRunning === detectedPlatform && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                        Packaging your ERP with all dependencies. This may take a minute or two...
                      </div>
                    )}
                  </div>

                  <details className="group">
                    <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none">
                      Download for a different operating system
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {otherPlatforms.map(([key, info]) => (
                        <button
                          key={key}
                          onClick={() => downloadStandalone(key)}
                          disabled={running || !!standaloneRunning}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition
                            ${standaloneRunning === key
                              ? 'border-slate-300 bg-slate-100 text-slate-600 cursor-wait'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'
                            }`}
                        >
                          {standaloneRunning === key ? 'Building...' : info.label}
                        </button>
                      ))}
                    </div>
                  </details>
                </div>
              );
            })()}

            {downloadStarted && (() => {
              const dlInfo = PLATFORM_INFO[downloadStarted] || PLATFORM_INFO['windows-x64'];
              return (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
                  <div className="text-sm font-bold text-blue-900">How to start your ERP</div>
                  <ol className="space-y-3 text-sm text-blue-800">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">1</span>
                      <div>
                        <div className="font-semibold">Find and extract the downloaded ZIP file</div>
                        <div className="mt-0.5 text-xs text-blue-600">{dlInfo.extractTip}</div>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">2</span>
                      <div>
                        <div className="font-semibold">Open the extracted folder and double-click <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">{dlInfo.startFile}</code></div>
                        <div className="mt-0.5 text-xs text-blue-600">
                          {downloadStarted.startsWith('macos') && 'If macOS shows a security warning, right-click the file and choose "Open" instead.'}
                          {downloadStarted.startsWith('windows') && 'If Windows shows a SmartScreen warning, click "More info" then "Run anyway".'}
                          {downloadStarted.startsWith('linux') && 'You may need to run: chmod +x start.sh first, then ./start.sh'}
                        </div>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">3</span>
                      <div>
                        <div className="font-semibold">Your browser will open automatically at <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">http://localhost:3000</code></div>
                        <div className="mt-0.5 text-xs text-blue-600">That is your ERP. You can start adding data right away.</div>
                      </div>
                    </li>
                  </ol>
                  <div className="rounded-lg border border-blue-100 bg-white/60 p-3 text-xs text-blue-700">
                    <span className="font-semibold">About your data:</span> Everything is stored locally on your computer in the <code className="rounded bg-blue-100 px-1 py-0.5 font-mono">app/data</code> folder.
                    To back up, simply copy that folder to a safe location. No cloud account needed.
                  </div>
                </div>
              );
            })()}

            <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-left hover:bg-slate-50 select-none">
                <span className="text-xs font-medium text-slate-500">Advanced: Docker Setup (for developers)</span>
                <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
              </summary>
              <div className="border-t px-4 py-3 space-y-2">
                <p className="text-xs text-slate-500">
                  This downloads a Docker-based version that requires Docker Desktop to be installed.
                  Only use this if you are a developer or IT professional.
                </p>
                <Button variant="outline" size="sm" onClick={downloadZip} loading={running} disabled={running || !!standaloneRunning}>
                  Download Docker ZIP
                </Button>
              </div>
            </details>

            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">What is this download?</span>{' '}
              It is a complete, self-contained application that runs entirely on your computer.
              It includes its own server, database, and interface. No internet connection is needed after downloading.
              You do not need to install any other software.
            </div>
          </div>

          {preview.warnings?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-900">Warnings</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-800 space-y-1">
                {preview.warnings.slice(0, 8).map((w: string) => <li key={w}>{w}</li>)}
                {preview.warnings.length > 8 && <li>+ {preview.warnings.length - 8} more</li>}
              </ul>
            </div>
          )}

          {/* Module summary cards */}
          {preview.moduleSummaries.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {preview.moduleSummaries.map((ms: any) => {
                const styles = MOD_STYLES[ms.key] || MOD_STYLES.shared;
                return (
                  <div key={ms.key} className={`rounded-xl border bg-white p-4 ${styles.left}`}>
                    <div className="text-sm font-semibold text-slate-900">{ms.label} Module</div>
                    {Object.entries(ms.config).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(ms.config).map(([k, v]) => (
                          <div key={k} className="text-xs text-slate-600"><span className="font-medium">{k}:</span> {String(v)}</div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {ms.caps.map((c: any) => (
                        <span key={c.label} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Included features */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {preview.enabledModules.length > 0 && (
              <div className="rounded-xl border bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Extra Features</div>
                <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                  {preview.enabledModules.map((m: any) => (
                    <li key={m.title}><span className="font-medium">{m.title}:</span> {m.description}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="rounded-xl border bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">What You Can Do</div>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                <li><span className="font-medium">Add / edit records</span> using simple forms</li>
                <li><span className="font-medium">Search &amp; sort</span> inside list tables</li>
                <li><span className="font-medium">Import / export CSV</span> for bulk data</li>
                <li><span className="font-medium">Stock actions</span> like Receive and Issue (if inventory is enabled)</li>
              </ul>
            </div>
          </div>

          {/* Entity details */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900">What You Will See in Your ERP</h3>
            {preview.entities.map((e: any) => {
              const eStyles = MOD_STYLES[e.mod] || MOD_STYLES.shared;
              return (
                <details key={e.slug} className="group rounded-xl border bg-white">
                  <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 select-none">
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${eStyles.dot}`} />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-slate-900">{e.name}</span>
                      <span className="ml-2 text-xs text-slate-400">({e.columns.slice(0, 4).join(', ')}{e.columns.length > 4 ? ` +${e.columns.length - 4}` : ''})</span>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${eStyles.badge}`}>
                      {(MODULE_META[e.mod]?.label || e.mod || 'shared').toLowerCase()}
                    </span>
                    <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                  </summary>

                  <div className="border-t px-5 py-4 space-y-4 text-sm text-slate-700">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Table columns</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.columns.map((c: string) => <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{c}</span>)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Available actions</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.csvImportEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Import CSV</span>}
                        {e.csvExportEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Export CSV</span>}
                        {e.printEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Print / PDF</span>}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Add</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Edit</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Delete</span>
                        {e.bulk?.enabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">Bulk actions</span>}
                        {e.labelsEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">QR labels</span>}
                      </div>
                    </div>

                    {e.inv?.enabled && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Stock actions</div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {e.inv.receiveEnabled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">Receive</span>}
                          {e.inv.sellEnabled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{e.inv.sellLabel}</span>}
                          {e.inv.adjustEnabled && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">Adjust</span>}
                          {e.inv.transferEnabled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">Transfer</span>}
                        </div>
                        {(e.inv.quickReceive || e.inv.quickSell) && (
                          <div className="mt-1.5 text-xs text-slate-500">
                            Quick buttons on each row: {e.inv.quickReceive ? 'Receive' : ''}{e.inv.quickReceive && e.inv.quickSell ? ', ' : ''}{e.inv.quickSell ? e.inv.sellLabel : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {e.relationFields.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Links to other data</div>
                        <ul className="mt-1.5 space-y-1">
                          {e.relationFields.map((r: any) => (
                            <li key={r.label + r.targetSlug}><span className="font-medium">{r.label}:</span> {r.multiple ? 'multiple ' : ''}{r.targetName}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {e.choiceFields.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pick-from-a-list fields</div>
                        <ul className="mt-1.5 space-y-1">
                          {e.choiceFields.map((c: any) => (
                            <li key={c.label}><span className="font-medium">{c.label}:</span> {c.options.join(' / ')}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(e.requiredFields.length > 0 || e.uniqueFields.length > 0) && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Data rules</div>
                        {e.requiredFields.length > 0 && <div className="mt-1"><span className="font-medium">Required:</span> {e.requiredFields.slice(0, 6).join(', ')}{e.requiredFields.length > 6 ? ` +${e.requiredFields.length - 6} more` : ''}</div>}
                        {e.uniqueFields.length > 0 && <div className="mt-1"><span className="font-medium">Must be unique:</span> {e.uniqueFields.slice(0, 6).join(', ')}{e.uniqueFields.length > 6 ? ` +${e.uniqueFields.length - 6} more` : ''}</div>}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>

          {/* Ask AI to make changes */}
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Ask AI to Make Changes</div>
            <p className="text-xs text-slate-500">Describe what you want to add, remove, or change and the AI will update your setup.</p>
            <div className="flex flex-wrap gap-2">
              {AI_EDIT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setAiEditText(chip)}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              value={aiEditText}
              onChange={(e) => setAiEditText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the changes you want..."
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={applyAiEdit} loading={running} disabled={running || !aiEditText.trim()}>
                Apply Changes
              </Button>
            </div>
          </div>

          {/* JSON editor (collapsed by default) */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setShowJsonEditor((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-semibold text-slate-700">Advanced: Edit JSON Directly</span>
              <svg className={`h-4 w-4 text-slate-400 transition-transform ${showJsonEditor ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </button>
            {showJsonEditor && (
              <div className="border-t p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">Edit the raw JSON configuration. For advanced users only.</div>
                  <Button variant="ghost" size="sm" onClick={() => setDraftJson(JSON.stringify(sdf, null, 2))} disabled={running}>
                    Reset
                  </Button>
                </div>
                {draftError && <div className="rounded-lg border bg-red-50 p-3 text-sm text-red-700">{draftError}</div>}
                <textarea
                  value={draftJson}
                  onChange={(e) => setDraftJson(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  spellCheck={false}
                />
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={saveDraft} loading={running} disabled={running}>
                    Save Configuration
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Raw JSON toggle */}
          <div className="flex justify-end">
            <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-xs text-slate-500 underline hover:text-slate-700">
              {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
            </button>
          </div>
          {showRaw && (
            <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
              {JSON.stringify(sdf, null, 2)}
            </pre>
          )}
        </section>
      )}
    </div>
  );
}
