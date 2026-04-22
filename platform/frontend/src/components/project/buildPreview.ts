import type { AiGatewaySdf } from '../../types/aiGateway';
import { summarizeModulesForPreview } from './projectConstants';

export interface BuildPreviewLabels {
  listPage: string;
  createEditForm: string;
  csvImportPage: string;
  csvExportPage: string;
  printPdf: string;
  receiveStock: string;
  sellDefault: string;
  adjustStock: string;
  transferStock: string;
  qrLabels: string;
  activityLog: string;
  activityLogDesc: string;
  lowStockAlerts: string;
  lowStockDesc: string;
  expiryAlerts: string;
  expiryDesc: string;
  reports: string;
  reportsDesc: string;
}

const DEFAULT_LABELS: BuildPreviewLabels = {
  listPage: 'List page',
  createEditForm: 'Create / Edit form',
  csvImportPage: 'CSV import page',
  csvExportPage: 'CSV export (download)',
  printPdf: 'Print / PDF',
  receiveStock: 'Receive stock',
  sellDefault: 'Sell',
  adjustStock: 'Adjust stock (corrections)',
  transferStock: 'Transfer stock',
  qrLabels: 'QR Labels',
  activityLog: 'Activity log',
  activityLogDesc: 'A feed of recent changes.',
  lowStockAlerts: 'Low stock alerts',
  lowStockDesc: 'Dashboard shows items running low.',
  expiryAlerts: 'Expiry alerts',
  expiryDesc: 'Dashboard shows items expiring soon.',
  reports: 'Reports',
  reportsDesc: 'Reports screen with inventory metrics.',
};

export function buildPreview(sdf: AiGatewaySdf, labels: Partial<BuildPreviewLabels> = {}) {
  const L: BuildPreviewLabels = { ...DEFAULT_LABELS, ...labels };
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
      const type = String(f?.type || ''); const fname = String(f?.name || '');
      const isRefish = type === 'reference' || fname.endsWith('_id') || fname.endsWith('_ids') || !!(f?.reference_entity || f?.referenceEntity);
      if (!isRefish) return null;
      const targetSlug = resolveRefSlug(f);
      if (!targetSlug) return null;
      const target = entityBySlug[targetSlug];
      const targetName = target?.display_name ? String(target.display_name) : formatLabel(targetSlug);
      return { label: f?.label ? String(f.label) : formatLabel(fname), targetSlug, targetName, multiple: f?.multiple === true || fname.endsWith('_ids') };
    }).filter(Boolean) as { label: string; targetSlug: string; targetName: string; multiple: boolean }[];

    const inv = entity?.inventory_ops || entity?.inventoryOps || {};
    const invEnabled = inv?.enabled === true;
    const receiveEnabled = invEnabled && inv?.receive?.enabled !== false;
    const adjustEnabled = invEnabled && inv?.adjust?.enabled !== false;
    const issueCfg = inv?.issue || inv?.sell || inv?.issue_stock || inv?.issueStock || {};
    const sellEnabled = invEnabled && issueCfg?.enabled === true;
    const sellLabel = issueCfg?.label || issueCfg?.display_name || issueCfg?.displayName || issueCfg?.name || L.sellDefault;
    const features = entity?.features || {};
    const transferEnabled = invEnabled && (inv?.transfer?.enabled === true || (inv?.transfer?.enabled !== false && (features?.multi_location === true || fields.some((f: any) => f && String(f.name || '').includes('location')))));
    const labelsEnabled = (entity?.labels?.enabled === true && entity?.labels?.type === 'qrcode');
    const quickCfg = inv?.quick_actions || inv?.quickActions || {};
    const quickAll = quickCfg === true;
    const quickReceive = receiveEnabled && (quickAll || quickCfg?.receive === true || quickCfg?.add === true || quickCfg?.in === true);
    const quickSell = sellEnabled && (quickAll || quickCfg?.issue === true || quickCfg?.sell === true || quickCfg?.out === true);
    const bulk = entity?.bulk_actions || entity?.bulkActions || {};
    const bulkEnabled = bulk?.enabled === true;

    const screens: string[] = [L.listPage, L.createEditForm];
    if (csvImportEnabled) screens.push(L.csvImportPage);
    if (csvExportEnabled) screens.push(L.csvExportPage);
    if (printEnabled) screens.push(L.printPdf);
    if (receiveEnabled) screens.push(L.receiveStock);
    if (sellEnabled) screens.push(sellLabel);
    if (adjustEnabled) screens.push(L.adjustStock);
    if (transferEnabled) screens.push(L.transferStock);
    if (labelsEnabled) screens.push(L.qrLabels);

    return {
      slug, name, mod, displayField: guessDisplayField(entity), csvImportEnabled, csvExportEnabled, printEnabled,
      columns: columnLabels, requiredFields, uniqueFields, choiceFields, relationFields, screens,
      inv: { enabled: invEnabled, receiveEnabled, sellEnabled, sellLabel, adjustEnabled, transferEnabled, quickReceive, quickSell },
      bulk: { enabled: bulkEnabled, delete: bulkEnabled && bulk?.delete !== false, update: bulkEnabled && Array.isArray(bulk?.update_fields) && bulk.update_fields.length > 0 },
      labelsEnabled,
    };
  };

  const enabledModules: { title: string; description: string }[] = [];
  const activity = (modules as any).activity_log || (modules as any).activityLog || {};
  if (activity?.enabled === true) enabledModules.push({ title: L.activityLog, description: L.activityLogDesc });
  const invDash = (modules as any).inventory_dashboard || (modules as any).inventoryDashboard || {};
  if (invDash?.low_stock?.enabled) enabledModules.push({ title: L.lowStockAlerts, description: L.lowStockDesc });
  if (invDash?.expiry?.enabled) enabledModules.push({ title: L.expiryAlerts, description: L.expiryDesc });
  const sched = (modules as any).scheduled_reports || (modules as any).scheduledReports || {};
  if (sched?.enabled === true) enabledModules.push({ title: L.reports, description: L.reportsDesc });

  const entitySummaries = entities.map(summarizeEntity).filter((e: any) => e && e.slug);
  const projectName = String((sdf as any).project_name || '');
  const screensTotal = 1 + (enabledModules.some((m) => m.title === L.activityLog) ? 1 : 0) + (enabledModules.some((m) => m.title === L.reports) ? 1 : 0) + entitySummaries.reduce((acc: number, e: any) => acc + e.screens.length, 0);
  const moduleSummaries = summarizeModulesForPreview(modules, entities);

  return { projectName, entityCount: entitySummaries.length, screensTotal, enabledModules, warnings, entities: entitySummaries, moduleSummaries };
}
