import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import type { AiGatewaySdf } from '../../types/aiGateway';
import { useModuleMeta, MOD_STYLES, useAiEditChips, usePlatformInfo } from './projectConstants';

interface Props {
  sdf: AiGatewaySdf;
  preview: any;
  detectedPlatform: string;
  running: boolean;
  standaloneRunning: string | null;
  downloadStarted: string | null;
  draftJson: string;
  draftError: string;
  aiEditText: string;
  onSaveDraft: () => void;
  onDownloadStandalone: (platform: string) => void;
  onDownloadZip: () => void;
  onApplyAiEdit: () => void;
  onSetAiEditText: (v: string) => void;
  onSetDraftJson: (v: string) => void;
  onResetDraftJson: () => void;
}

export default function SdfPreviewSection({
  sdf, preview, detectedPlatform, running, standaloneRunning, downloadStarted,
  draftJson, draftError, aiEditText,
  onSaveDraft, onDownloadStandalone, onDownloadZip, onApplyAiEdit,
  onSetAiEditText, onSetDraftJson, onResetDraftJson,
}: Props) {
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const { t } = useTranslation('projectDetail');
  const AI_EDIT_CHIPS = useAiEditChips();

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('sdfPreview.title')}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {t('sdfPreview.projectLabel')}: <span className="font-medium text-slate-700">{preview.projectName}</span>{' '}
            &middot; {t('sdfPreview.dataSections', { count: preview.entityCount })} &middot; {t('sdfPreview.screens', { count: preview.screensTotal })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onSaveDraft} loading={running} disabled={running || !!standaloneRunning}>
          {t('sdfPreview.saveConfig')}
        </Button>
      </div>

      {/* ── Download & Run ──────────────────────────────── */}
      <DownloadWizard
        detectedPlatform={detectedPlatform} running={running}
        standaloneRunning={standaloneRunning} downloadStarted={downloadStarted}
        onDownloadStandalone={onDownloadStandalone} onDownloadZip={onDownloadZip}
      />

      {preview.warnings?.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">{t('sdfPreview.warnings')}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800 space-y-1">
            {preview.warnings.slice(0, 8).map((w: string) => <li key={w}>{w}</li>)}
            {preview.warnings.length > 8 && <li>{t('sdfPreview.moreItems', { count: preview.warnings.length - 8 })}</li>}
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
                <div className="text-sm font-semibold text-slate-900">{t('sdfPreview.moduleCard', { label: ms.label })}</div>
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

      {/* Features + capabilities */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {preview.enabledModules.length > 0 && (
          <div className="rounded-xl border bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">{t('sdfPreview.extraFeatures')}</div>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {preview.enabledModules.map((m: any) => (
                <li key={m.title}><span className="font-medium">{m.title}:</span> {m.description}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-xl border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">{t('sdfPreview.whatYouCanDo.title')}</div>
          <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
            <li><span className="font-medium">{t('sdfPreview.whatYouCanDo.item1Strong')}</span> {t('sdfPreview.whatYouCanDo.item1Rest')}</li>
            <li><span className="font-medium">{t('sdfPreview.whatYouCanDo.item2Strong')}</span> {t('sdfPreview.whatYouCanDo.item2Rest')}</li>
            <li><span className="font-medium">{t('sdfPreview.whatYouCanDo.item3Strong')}</span> {t('sdfPreview.whatYouCanDo.item3Rest')}</li>
            <li><span className="font-medium">{t('sdfPreview.whatYouCanDo.item4Strong')}</span> {t('sdfPreview.whatYouCanDo.item4Rest')}</li>
          </ul>
        </div>
      </div>

      {/* Entity details */}
      <EntityDetails entities={preview.entities} />

      {/* Ask AI */}
      <div className="rounded-xl border bg-white p-5 space-y-3">
        <div className="text-sm font-semibold text-slate-900">{t('sdfPreview.askAi.title')}</div>
        <p className="text-xs text-slate-500">{t('sdfPreview.askAi.subtitle')}</p>
        <div className="flex flex-wrap gap-2">
          {AI_EDIT_CHIPS.map((chip) => (
            <button key={chip} type="button" onClick={() => onSetAiEditText(chip)}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
              {chip}
            </button>
          ))}
        </div>
        <textarea value={aiEditText} onChange={(e) => onSetAiEditText(e.target.value)} rows={3}
          className="w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={t('sdfPreview.askAi.placeholder')} />
        <div className="flex justify-end">
          <Button size="sm" onClick={onApplyAiEdit} loading={running} disabled={running || !aiEditText.trim()}>{t('sdfPreview.askAi.apply')}</Button>
        </div>
      </div>

      {/* JSON editor */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <button type="button" onClick={() => setShowJsonEditor((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-slate-50">
          <span className="text-sm font-semibold text-slate-700">{t('sdfPreview.jsonEditor.title')}</span>
          <svg className={`h-4 w-4 text-slate-400 transition-transform ${showJsonEditor ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        </button>
        {showJsonEditor && (
          <div className="border-t p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">{t('sdfPreview.jsonEditor.hint')}</div>
              <Button variant="ghost" size="sm" onClick={onResetDraftJson} disabled={running}>{t('sdfPreview.jsonEditor.reset')}</Button>
            </div>
            {draftError && <div className="rounded-lg border bg-red-50 p-3 text-sm text-red-700">{draftError}</div>}
            <textarea value={draftJson} onChange={(e) => onSetDraftJson(e.target.value)} rows={12}
              className="w-full rounded-lg border bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" spellCheck={false} />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onSaveDraft} loading={running} disabled={running}>{t('sdfPreview.saveConfig')}</Button>
            </div>
          </div>
        )}
      </div>

      {/* Raw JSON toggle */}
      <div className="flex justify-end">
        <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-xs text-slate-500 underline hover:text-slate-700">
          {showRaw ? t('sdfPreview.hideRawJson') : t('sdfPreview.showRawJson')}
        </button>
      </div>
      {showRaw && (
        <pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-slate-700">
          {JSON.stringify(sdf, null, 2)}
        </pre>
      )}
    </section>
  );
}

/* ── Download wizard sub-component ──────────────────────────── */

function DownloadWizard({ detectedPlatform, running, standaloneRunning, downloadStarted, onDownloadStandalone, onDownloadZip }: {
  detectedPlatform: string; running: boolean; standaloneRunning: string | null; downloadStarted: string | null;
  onDownloadStandalone: (platform: string) => void; onDownloadZip: () => void;
}) {
  const { t, i18n } = useTranslation('projectDetail');
  const PLATFORM_INFO = usePlatformInfo();
  const rec = PLATFORM_INFO[detectedPlatform] || PLATFORM_INFO['windows-x64'];
  const otherPlatforms = Object.entries(PLATFORM_INFO).filter(([k]) => k !== detectedPlatform);
  const [healthUrl, setHealthUrl] = useState('http://localhost:3000/health');
  const [autoTrack, setAutoTrack] = useState(false);
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'healthy' | 'unreachable' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState(() => t('sdfPreview.download.startThenCheck'));
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    const trimmed = healthUrl.trim();
    if (!trimmed) {
      setCheckState('error');
      setStatusMessage(t('sdfPreview.download.urlRequired'));
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      setCheckState('error');
      setStatusMessage(t('sdfPreview.download.urlInvalid'));
      return;
    }

    setCheckState('checking');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      parsed.searchParams.set('_t', Date.now().toString());
      const response = await fetch(parsed.toString(), {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok) {
        setCheckState('error');
        setStatusMessage(t('sdfPreview.download.httpError', { status: response.status }));
      } else if (payload && typeof payload === 'object' && payload.status === 'ok') {
        const serviceName = typeof payload.service === 'string' ? payload.service : 'generated-erp';
        setCheckState('healthy');
        setStatusMessage(t('sdfPreview.download.healthy', { service: serviceName }));
      } else {
        setCheckState('error');
        setStatusMessage(t('sdfPreview.download.payloadUnrecognized'));
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        setCheckState('unreachable');
        setStatusMessage(t('sdfPreview.download.timeout'));
      } else {
        setCheckState('unreachable');
        setStatusMessage(t('sdfPreview.download.unreachable'));
      }
    } finally {
      window.clearTimeout(timeout);
      setLastCheckedAt(new Date().toLocaleTimeString(i18n.language));
    }
  }, [healthUrl, i18n.language, t]);

  useEffect(() => {
    if (!downloadStarted) return;
    setAutoTrack(true);
    void checkHealth();
  }, [downloadStarted, checkHealth]);

  useEffect(() => {
    if (!autoTrack) return;
    const id = window.setInterval(() => {
      void checkHealth();
    }, 7000);
    return () => window.clearInterval(id);
  }, [autoTrack, checkHealth]);

  const runtimeBadge = useMemo(() => {
    if (checkState === 'healthy') {
      return { text: t('sdfPreview.download.badgeRunning'), cls: 'bg-emerald-100 text-emerald-700' };
    }
    if (checkState === 'checking') {
      return { text: t('sdfPreview.download.badgeChecking'), cls: 'bg-indigo-100 text-indigo-700' };
    }
    if (checkState === 'error') {
      return { text: t('sdfPreview.download.badgeUnhealthy'), cls: 'bg-rose-100 text-rose-700' };
    }
    if (checkState === 'unreachable') {
      return { text: t('sdfPreview.download.badgeUnreachable'), cls: 'bg-amber-100 text-amber-700' };
    }
    if (downloadStarted) {
      return { text: t('sdfPreview.download.badgeStarting'), cls: 'bg-slate-100 text-slate-700' };
    }
    return { text: t('sdfPreview.download.badgeNotStarted'), cls: 'bg-slate-100 text-slate-700' };
  }, [checkState, downloadStarted, t]);

  return (
    <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 space-y-5">
      <div className="space-y-1">
        <h3 className="text-lg font-bold text-emerald-900">{t('sdfPreview.download.title')}</h3>
        <p className="text-sm text-emerald-700">
          {t('sdfPreview.download.subtitle')}
          <br /><span className="font-medium">{t('sdfPreview.download.noExtras')}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-white p-4 space-y-3">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">{t('sdfPreview.download.recommended')}</span>
          <button onClick={() => onDownloadStandalone(detectedPlatform)} disabled={running || !!standaloneRunning}
            className={`w-full rounded-xl border-2 px-5 py-4 text-left font-semibold shadow-sm transition ${
              standaloneRunning === detectedPlatform
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 cursor-wait'
                : 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'
            }`}>
            <div className="text-base">{standaloneRunning === detectedPlatform ? t('sdfPreview.download.buildingYourErp') : t('sdfPreview.download.downloadFor', { platform: rec.label })}</div>
            <div className={`mt-0.5 text-xs font-normal ${standaloneRunning === detectedPlatform ? 'text-emerald-600' : 'text-emerald-100'}`}>
              {t('sdfPreview.download.selfContained')}
            </div>
          </button>
          {standaloneRunning === detectedPlatform && (
            <div className="flex items-center gap-2 text-xs text-emerald-600">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
              {t('sdfPreview.download.packaging')}
            </div>
          )}
        </div>

        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700 select-none">
            {t('sdfPreview.download.differentOs')}
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {otherPlatforms.map(([key, info]) => (
              <button key={key} onClick={() => onDownloadStandalone(key)} disabled={running || !!standaloneRunning}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                  standaloneRunning === key ? 'border-slate-300 bg-slate-100 text-slate-600 cursor-wait' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50'
                }`}>
                {standaloneRunning === key ? t('sdfPreview.download.building') : info.label}
              </button>
            ))}
          </div>
        </details>
      </div>

      {downloadStarted && <PostDownloadInstructions platform={downloadStarted} />}

      <div className="rounded-xl border border-emerald-200 bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">{t('sdfPreview.download.runtimeStatus')}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t('sdfPreview.download.runtimeStatusDesc')}</div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${runtimeBadge.cls}`}>
            {runtimeBadge.text}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={healthUrl}
            onChange={(e) => setHealthUrl(e.target.value)}
            placeholder="http://localhost:3000/health"
            className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={() => { void checkHealth(); }}
            disabled={checkState === 'checking'}
            className="rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {checkState === 'checking' ? t('sdfPreview.download.checkingEllipsis') : t('sdfPreview.download.checkHealth')}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={autoTrack}
              onChange={(e) => setAutoTrack(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            {t('sdfPreview.download.autoCheck')}
          </label>
          {lastCheckedAt && <span className="text-xs text-slate-400">{t('sdfPreview.download.lastChecked', { time: lastCheckedAt })}</span>}
        </div>

        <div className={`rounded-lg px-3 py-2 text-xs ${
          checkState === 'healthy'
            ? 'bg-emerald-50 text-emerald-700'
            : checkState === 'checking'
              ? 'bg-indigo-50 text-indigo-700'
              : checkState === 'idle'
                ? 'bg-slate-50 text-slate-600'
                : 'bg-amber-50 text-amber-700'
        }`}>
          {statusMessage}
        </div>
      </div>

      <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-left hover:bg-slate-50 select-none">
          <span className="text-xs font-medium text-slate-500">{t('sdfPreview.download.dockerAdvanced')}</span>
          <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        </summary>
        <div className="border-t px-4 py-3 space-y-2">
          <p className="text-xs text-slate-500">{t('sdfPreview.download.dockerDesc')}</p>
          <Button variant="outline" size="sm" onClick={onDownloadZip} loading={running} disabled={running || !!standaloneRunning}>{t('sdfPreview.download.dockerZip')}</Button>
        </div>
      </details>

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        <span className="font-semibold text-slate-600">{t('sdfPreview.download.whatIsTitle')}</span>{' '}
        {t('sdfPreview.download.whatIsBody')}
      </div>
    </div>
  );
}

/* ── Post-download instructions ─────────────────────────────── */

function PostDownloadInstructions({ platform }: { platform: string }) {
  const { t } = useTranslation('projectDetail');
  const PLATFORM_INFO = usePlatformInfo();
  const dlInfo = PLATFORM_INFO[platform] || PLATFORM_INFO['windows-x64'];
  const platformTip =
    platform.startsWith('macos') ? t('sdfPreview.postDownload.macOsTip')
    : platform.startsWith('windows') ? t('sdfPreview.postDownload.windowsTip')
    : platform.startsWith('linux') ? t('sdfPreview.postDownload.linuxTip')
    : '';
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
      <div className="text-sm font-bold text-blue-900">{t('sdfPreview.postDownload.title')}</div>
      <ol className="space-y-3 text-sm text-blue-800">
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">1</span>
          <div>
            <div className="font-semibold">{t('sdfPreview.postDownload.step1Title')}</div>
            <div className="mt-0.5 text-xs text-blue-600">{dlInfo.extractTip}</div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">2</span>
          <div>
            <div className="font-semibold">
              {t('sdfPreview.postDownload.step2Title')} <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">{dlInfo.startFile}</code>
            </div>
            <div className="mt-0.5 text-xs text-blue-600">{platformTip}</div>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-800">3</span>
          <div>
            <div className="font-semibold">
              {t('sdfPreview.postDownload.step3Title')} <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-mono">http://localhost:3000</code>
            </div>
            <div className="mt-0.5 text-xs text-blue-600">{t('sdfPreview.postDownload.step3Desc')}</div>
          </div>
        </li>
      </ol>
      <div className="rounded-lg border border-blue-100 bg-white/60 p-3 text-xs text-blue-700">
        <span className="font-semibold">{t('sdfPreview.postDownload.dataTitle')}</span> {t('sdfPreview.postDownload.dataBody1')} <code className="rounded bg-blue-100 px-1 py-0.5 font-mono">app/data</code> {t('sdfPreview.postDownload.dataBody2')}
      </div>
    </div>
  );
}

/* ── Entity detail accordion ────────────────────────────────── */

function EntityDetails({ entities }: { entities: any[] }) {
  const { t } = useTranslation('projectDetail');
  const MODULE_META = useModuleMeta();
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-slate-900">{t('sdfPreview.entityDetails.title')}</h3>
      {entities.map((e: any) => {
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
                {(MODULE_META[e.mod as keyof typeof MODULE_META]?.label || e.mod || 'shared').toLowerCase()}
              </span>
              <svg className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
            </summary>

            <div className="border-t px-5 py-4 space-y-4 text-sm text-slate-700">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('sdfPreview.entityDetails.columns')}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.columns.map((c: string) => <span key={c} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{c}</span>)}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('sdfPreview.entityDetails.actions')}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.csvImportEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.importCsv')}</span>}
                  {e.csvExportEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.exportCsv')}</span>}
                  {e.printEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.printPdf')}</span>}
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.add')}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.edit')}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.delete')}</span>
                  {e.bulk?.enabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.bulk')}</span>}
                  {e.labelsEnabled && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{t('sdfPreview.entityDetails.qr')}</span>}
                </div>
              </div>

              {e.inv?.enabled && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('sdfPreview.entityDetails.stock')}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {e.inv.receiveEnabled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{t('sdfPreview.entityDetails.receive')}</span>}
                    {e.inv.sellEnabled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{e.inv.sellLabel}</span>}
                    {e.inv.adjustEnabled && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800">{t('sdfPreview.entityDetails.adjust')}</span>}
                    {e.inv.transferEnabled && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800">{t('sdfPreview.entityDetails.transfer')}</span>}
                  </div>
                  {(e.inv.quickReceive || e.inv.quickSell) && (
                    <div className="mt-1.5 text-xs text-slate-500">
                      {t('sdfPreview.entityDetails.quickButtons')}: {e.inv.quickReceive ? t('sdfPreview.entityDetails.receive') : ''}{e.inv.quickReceive && e.inv.quickSell ? ', ' : ''}{e.inv.quickSell ? e.inv.sellLabel : ''}
                    </div>
                  )}
                </div>
              )}

              {e.relationFields.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('sdfPreview.entityDetails.links')}</div>
                  <ul className="mt-1.5 space-y-1">
                    {e.relationFields.map((r: any) => <li key={r.label + r.targetSlug}><span className="font-medium">{r.label}:</span> {r.multiple ? t('sdfPreview.entityDetails.multiple') + ' ' : ''}{r.targetName}</li>)}
                  </ul>
                </div>
              )}

              {e.choiceFields.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('sdfPreview.entityDetails.choiceFields')}</div>
                  <ul className="mt-1.5 space-y-1">
                    {e.choiceFields.map((c: any) => <li key={c.label}><span className="font-medium">{c.label}:</span> {c.options.join(' / ')}</li>)}
                  </ul>
                </div>
              )}

              {(e.requiredFields.length > 0 || e.uniqueFields.length > 0) && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('sdfPreview.entityDetails.rules')}</div>
                  {e.requiredFields.length > 0 && <div className="mt-1"><span className="font-medium">{t('sdfPreview.entityDetails.required')}:</span> {e.requiredFields.slice(0, 6).join(', ')}{e.requiredFields.length > 6 ? ` ${t('sdfPreview.entityDetails.moreCount', { count: e.requiredFields.length - 6 })}` : ''}</div>}
                  {e.uniqueFields.length > 0 && <div className="mt-1"><span className="font-medium">{t('sdfPreview.entityDetails.unique')}:</span> {e.uniqueFields.slice(0, 6).join(', ')}{e.uniqueFields.length > 6 ? ` ${t('sdfPreview.entityDetails.moreCount', { count: e.uniqueFields.length - 6 })}` : ''}</div>}
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}
