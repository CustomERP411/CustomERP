import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import { projectService } from '../services/projectService';
import type { Project } from '../types/project';
import type { AiGatewaySdf, ClarificationAnswer, ClarificationQuestion } from '../types/aiGateway';

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = String(params.id || '');

  const [project, setProject] = useState<Project | null>(null);
  const [description, setDescription] = useState('');
  const [sdf, setSdf] = useState<AiGatewaySdf | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answersById, setAnswersById] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(true);
  const [draftJson, setDraftJson] = useState('');
  const [draftError, setDraftError] = useState('');
  const [aiEditText, setAiEditText] = useState('');

  const filterQuestions = (raw: any[]): ClarificationQuestion[] => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.filter((q: any) => {
      const id = String(q?.id || '');
      const text = String(q?.question || '');
      // Don't ask about features we explicitly don't support (chatbot).
      return !/chat\s*bot|chatbot|sohbet\s*botu|sohbetbot/i.test(id + ' ' + text);
    }) as ClarificationQuestion[];
  };

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
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!sdf) return;
    setDraftJson(JSON.stringify(sdf, null, 2));
    setDraftError('');
  }, [sdf]);

  const canAnalyze = useMemo(() => description.trim().length >= 10, [description]);
  const canSubmitAnswers = useMemo(() => {
    if (!sdf) return false;
    if (!questions.length) return false;
    return questions.every((q) => (answersById[q.id] || '').trim().length > 0);
  }, [sdf, questions, answersById]);

  const preview = useMemo(() => {
    if (!sdf) return null;

    const formatLabel = (name: string) =>
      String(name || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());

    const entities = Array.isArray((sdf as any).entities) ? (sdf as any).entities : [];
    const modules = (sdf as any).modules && typeof (sdf as any).modules === 'object' ? (sdf as any).modules : {};
    const warningsRaw = (sdf as any).warnings;
    const warnings = Array.isArray(warningsRaw) ? warningsRaw.map(String).map((s) => s.trim()).filter(Boolean) : [];

    const entityBySlug: Record<string, any> = Object.fromEntries(
      entities
        .map((e: any) => [String(e?.slug || ''), e] as const)
        .filter(([slug]: readonly [string, any]) => Boolean(slug))
    );

    const resolveRefSlug = (field: any) => {
      const explicit = field?.reference_entity || field?.referenceEntity;
      if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();

      const name = String(field?.name || '');
      const base = name.replace(/_ids?$/, '');
      if (!base) return null;

      const slugCandidates = [
        base,
        base + 's',
        base + 'es',
        base.endsWith('y') ? base.slice(0, -1) + 'ies' : null,
      ].filter(Boolean) as string[];

      for (const c of slugCandidates) {
        if (entityBySlug[c]) return c;
      }
      const starts = Object.keys(entityBySlug).find((s) => s.startsWith(base));
      return starts || null;
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
      const fields = Array.isArray(entity?.fields) ? entity.fields : [];

      const ui = entity?.ui || {};
      const searchEnabled = ui.search !== false;
      const csvImportEnabled = ui.csv_import !== false;
      const csvExportEnabled = ui.csv_export !== false;
      const printEnabled = ui.print !== false;

      const configuredCols = Array.isArray(entity?.list?.columns) ? entity.list.columns : null;
      const defaultCols = fields
        .filter((f: any) => f?.name && f.name !== 'id')
        .slice(0, 5)
        .map((f: any) => String(f.name));
      const columns: string[] = (configuredCols && configuredCols.length ? configuredCols : defaultCols)
        .map(String)
        .filter((c: string) => c && c !== 'id');

      const fieldByName: Record<string, any> = Object.fromEntries(fields.map((f: any) => [String(f?.name || ''), f]));
      const columnLabels = columns.map((c: string) => {
        const f = fieldByName[c];
        return f?.label ? String(f.label) : formatLabel(c);
      });

      const requiredFields = fields
        .filter((f: any) => f?.required === true)
        .map((f: any) => (f?.label ? String(f.label) : formatLabel(String(f?.name || ''))))
        .filter(Boolean);

      const uniqueFields = fields
        .filter((f: any) => f?.unique === true)
        .map((f: any) => (f?.label ? String(f.label) : formatLabel(String(f?.name || ''))))
        .filter(Boolean);

      const choiceFields = fields
        .map((f: any) => {
          const raw = f?.options ?? f?.enum;
          const options = Array.isArray(raw) ? raw.map(String).map((s) => s.trim()).filter(Boolean) : [];
          if (!options.length) return null;
          return {
            label: f?.label ? String(f.label) : formatLabel(String(f?.name || '')),
            options,
          };
        })
        .filter(Boolean) as { label: string; options: string[] }[];

      const relationFields = fields
        .map((f: any) => {
          const type = String(f?.type || '');
          const name = String(f?.name || '');
          const isRefish = type === 'reference' || name.endsWith('_id') || name.endsWith('_ids') || !!(f?.reference_entity || f?.referenceEntity);
          if (!isRefish) return null;
          const targetSlug = resolveRefSlug(f);
          if (!targetSlug) return null;
          const target = entityBySlug[targetSlug];
          const targetName = target?.display_name ? String(target.display_name) : formatLabel(targetSlug);
          const multiple = f?.multiple === true || name.endsWith('_ids');
          return {
            label: f?.label ? String(f.label) : formatLabel(name),
            targetSlug,
            targetName,
            multiple,
          };
        })
        .filter(Boolean) as { label: string; targetSlug: string; targetName: string; multiple: boolean }[];

      const bulk = entity?.bulk_actions || entity?.bulkActions || {};
      const bulkEnabled = bulk?.enabled === true;
      const bulkDelete = bulkEnabled && bulk?.delete !== false;
      const bulkUpdateFields = Array.isArray(bulk?.update_fields) ? bulk.update_fields.map(String) : [];
      const bulkUpdate = bulkEnabled && bulkUpdateFields.length > 0;

      const inv = entity?.inventory_ops || entity?.inventoryOps || {};
      const invEnabled = inv?.enabled === true;
      const receiveEnabled = invEnabled && (inv?.receive?.enabled !== false);
      const adjustEnabled = invEnabled && (inv?.adjust?.enabled !== false);
      const issueCfg = inv?.issue || inv?.sell || inv?.issue_stock || inv?.issueStock || {};
      const sellEnabled = invEnabled && issueCfg?.enabled === true;
      const sellLabel =
        issueCfg?.label ||
        issueCfg?.display_name ||
        issueCfg?.displayName ||
        issueCfg?.name ||
        'Sell';

      const features = entity?.features || {};
      const transferEnabled =
        invEnabled &&
        (inv?.transfer?.enabled === true ||
          (inv?.transfer?.enabled !== false &&
            (features?.multi_location === true ||
              fields.some((f: any) => f && String(f.name || '').includes('location')))));

      const labels = entity?.labels || {};
      const labelsEnabled = labels?.enabled === true && labels?.type === 'qrcode';

      const quickCfg = inv?.quick_actions || inv?.quickActions || {};
      const quickAll = quickCfg === true;
      const quickReceive = receiveEnabled && (quickAll || quickCfg?.receive === true || quickCfg?.add === true || quickCfg?.in === true);
      const quickSell = sellEnabled && (quickAll || quickCfg?.issue === true || quickCfg?.sell === true || quickCfg?.out === true);

      const screens: string[] = [];
      screens.push('List page');
      screens.push('Create / Edit form');
      if (csvImportEnabled) screens.push('CSV import page');
      if (csvExportEnabled) screens.push('CSV export (download)');
      if (printEnabled) screens.push('Print / PDF');
      if (receiveEnabled) screens.push('Receive stock');
      if (sellEnabled) screens.push(sellLabel);
      if (adjustEnabled) screens.push('Adjust stock (corrections)');
      if (transferEnabled) screens.push('Transfer stock');
      if (labelsEnabled) screens.push('QR Labels');

      return {
        slug,
        name,
        displayField: guessDisplayField(entity),
        searchEnabled,
        csvImportEnabled,
        csvExportEnabled,
        printEnabled,
        columns: columnLabels,
        requiredFields,
        uniqueFields,
        choiceFields,
        relationFields,
        screens,
        inv: {
          enabled: invEnabled,
          receiveEnabled,
          sellEnabled,
          sellLabel,
          adjustEnabled,
          transferEnabled,
          quickReceive,
          quickSell,
        },
        bulk: {
          enabled: bulkEnabled,
          delete: bulkDelete,
          update: bulkUpdate,
          updateFields: bulkUpdateFields.map((n: string) => {
            const f = fieldByName[n];
            return f?.label ? String(f.label) : formatLabel(n);
          }),
        },
        labelsEnabled,
      };
    };

    const enabledModules: { title: string; description: string }[] = [];
    const activity = (modules as any).activity_log || (modules as any).activityLog || {};
    if (activity?.enabled === true) {
      enabledModules.push({ title: 'Activity log', description: 'A feed of recent changes (who changed what).' });
    }
    const invDash = (modules as any).inventory_dashboard || (modules as any).inventoryDashboard || {};
    if (invDash?.low_stock?.enabled) {
      enabledModules.push({ title: 'Low stock alerts', description: 'Dashboard shows items that are running low.' });
    }
    if (invDash?.expiry?.enabled) {
      enabledModules.push({ title: 'Expiry alerts', description: 'Dashboard shows items expiring soon (if enabled).' });
    }
    const sched = (modules as any).scheduled_reports || (modules as any).scheduledReports || {};
    if (sched?.enabled === true) {
      enabledModules.push({ title: 'Reports', description: 'Reports screen with inventory metrics and date-range comparisons (if configured).' });
    }

    const entitySummaries = entities
      .map((e: any) => summarizeEntity(e))
      .filter((e: any) => e && e.slug);

    const projectName = String((sdf as any).project_name || '');

    const screensTotal =
      1 + // dashboard home
      (enabledModules.some((m) => m.title === 'Activity log') ? 1 : 0) +
      (enabledModules.some((m) => m.title === 'Reports') ? 1 : 0) +
      entitySummaries.reduce((acc: number, e: any) => acc + e.screens.length, 0);

    return {
      projectName,
      entityCount: entitySummaries.length,
      screensTotal,
      enabledModules,
      warnings,
      entities: entitySummaries,
    };
  }, [sdf]);

  const analyze = async () => {
    if (!projectId) return;
    setRunning(true);
    setError('');
    try {
      const res = await projectService.analyzeProject(projectId, description.trim());
      setProject(res.project);
      setSdf(res.sdf);
      setQuestions(filterQuestions(res.questions || []));
      setAnswersById({});
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Analyze failed');
    } finally {
      setRunning(false);
    }
  };

  const submitAnswers = async () => {
    if (!projectId || !sdf) return;
    setRunning(true);
    setError('');
    try {
      const answers: ClarificationAnswer[] = questions.map((q) => ({
        question_id: q.id,
        answer: (answersById[q.id] || '').trim(),
      }));
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
      try {
        parsed = JSON.parse(draftJson);
      } catch (e: any) {
        setDraftError('Invalid JSON: ' + (e?.message || 'Parse error'));
        return;
      }

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
      // When backend returns JSON error, axios still gives a blob. Try to decode it.
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

  if (loading) {
    return <div className="text-slate-600">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Project</h1>
          <Link to="/" className="text-sm font-semibold text-indigo-600 hover:underline">Back</Link>
        </div>
        <div className="rounded-lg border bg-white p-4 text-sm text-red-600">
          {error || 'Project not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          <div className="mt-1 text-sm text-slate-600">
            Status: <span className="font-semibold">{project.status}</span>
          </div>
        </div>
        <Link to="/" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
          Back to Projects
        </Link>
      </div>

      {error ? (
        <div className="rounded-lg border bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Business description</div>
          <div className="mt-1 text-xs text-slate-500">
            This will be sent to the AI Gateway to generate an SDF and clarification questions.
          </div>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={8}
          className="w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Describe your business and what you want the ERP to do..."
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-500">
            Tip: add entities, workflows, and constraints. (Min ~10 chars here; AI Gateway may enforce more.)
          </div>
          <Button onClick={analyze} loading={running} disabled={!canAnalyze || running}>
            Analyze
          </Button>
        </div>
      </div>

      {questions.length ? (
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Clarification questions</div>
            <div className="mt-1 text-xs text-slate-500">Answer these so the AI can refine the SDF.</div>
          </div>

          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="rounded-lg border bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{q.question}</div>
                <div className="mt-2">
                  {q.type === 'yes_no' ? (
                    <select
                      value={answersById[q.id] || ''}
                      onChange={(e) => setAnswersById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : q.type === 'choice' && Array.isArray(q.options) && q.options.length ? (
                    <div className="space-y-2">
                      <select
                        value={q.options.includes(answersById[q.id] || '') ? (answersById[q.id] || '') : ''}
                        onChange={(e) => setAnswersById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Select...</option>
                        {q.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <textarea
                        value={q.options.includes(answersById[q.id] || '') ? '' : (answersById[q.id] || '')}
                        onChange={(e) => setAnswersById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                        rows={2}
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                        placeholder="Custom answer (use this for “Other”, or type multiple options separated by commas)…"
                      />
                      <div className="text-xs text-slate-500">
                        Tip: you can type something like “Remove X, add Y, add Z”.
                      </div>
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
                <div className="mt-1 text-xs text-slate-500">id: {q.id} · type: {q.type}</div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={submitAnswers} loading={running} disabled={!canSubmitAnswers || running}>
              Submit answers
            </Button>
          </div>
        </div>
      ) : sdf ? (
        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">No clarification questions</div>
          <div className="mt-1 text-xs text-slate-500">The AI returned a complete SDF.</div>
        </div>
      ) : null}

      {sdf ? (
        <div className="rounded-xl border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Generated SDF (AI Gateway output)</div>
              <div className="mt-1 text-xs text-slate-500">This is the generator SDF shape (`project_name`, `modules`, `entities`) with optional `clarifications_needed`.</div>
            </div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              {showRaw ? 'Hide JSON' : 'Show JSON'}
            </button>
          </div>

          {preview ? (
            <div className="rounded-lg border bg-slate-50 p-4 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Preview (what will be generated)</div>
                  <div className="mt-1 text-xs text-slate-600">
                    Project: <span className="font-semibold">{preview.projectName}</span> · Entities: <span className="font-semibold">{preview.entityCount}</span> · Screens: <span className="font-semibold">{preview.screensTotal}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    This is written for non-technical users. It describes what you’ll see and do after generation.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={saveDraft} loading={running} disabled={running}>
                    Save SDF
                  </Button>
                  <Button onClick={downloadZip} loading={running} disabled={running}>
                    Generate & Download ZIP
                  </Button>
                </div>
              </div>

              {preview.warnings?.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-900">Warnings / limitations</div>
                  <ul className="mt-2 list-disc pl-5 text-sm text-amber-900 space-y-1">
                    {preview.warnings.slice(0, 8).map((w: string) => (
                      <li key={w}>{w}</li>
                    ))}
                    {preview.warnings.length > 8 ? (
                      <li>+ {preview.warnings.length - 8} more… (open JSON to see all)</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Included features</div>
                  {preview.enabledModules.length ? (
                    <ul className="mt-2 space-y-2 text-sm text-slate-700">
                      {preview.enabledModules.map((m: any) => (
                        <li key={m.title}>
                          <span className="font-semibold">{m.title}:</span> {m.description}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2 text-sm text-slate-600">No global modules enabled.</div>
                  )}
                </div>
                <div className="rounded-lg border bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">What users can do</div>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    <li><span className="font-semibold">Add / edit records</span> using simple forms.</li>
                    <li><span className="font-semibold">Search & sort</span> inside list tables.</li>
                    <li><span className="font-semibold">Import / export CSV</span> (if enabled per entity).</li>
                    <li><span className="font-semibold">Stock actions</span> like Receive and Sell (if enabled per inventory entity).</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Screens (by section)</div>
                <div className="space-y-3">
                  {preview.entities.map((e: any) => (
                    <details key={e.slug} className="rounded-lg border bg-white p-4">
                      <summary className="cursor-pointer select-none flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{e.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Table columns: {e.columns.slice(0, 5).join(', ')}{e.columns.length > 5 ? ` + ${e.columns.length - 5} more` : ''}
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{e.slug}</div>
                      </summary>

                      <div className="mt-4 space-y-4 text-sm text-slate-700">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Table columns</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {e.columns.map((c: string) => (
                              <span key={c} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{c}</span>
                            ))}
                          </div>
                          {e.searchEnabled ? (
                            <div className="mt-1 text-xs text-slate-500">Search will search inside these columns.</div>
                          ) : (
                            <div className="mt-1 text-xs text-slate-500">Search is disabled for this screen.</div>
                          )}
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Available actions</div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {e.csvImportEnabled ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Import CSV</span> : null}
                            {e.csvExportEnabled ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Export CSV</span> : null}
                            {e.printEnabled ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Print / PDF</span> : null}
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Add</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Edit</span>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Delete</span>
                            {e.bulk?.enabled ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Bulk actions</span> : null}
                            {e.labelsEnabled ? <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">QR labels</span> : null}
                          </div>
                        </div>

                        {e.inv?.enabled ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Stock actions (inventory)</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {e.inv.receiveEnabled ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">Receive</span> : null}
                              {e.inv.sellEnabled ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">{e.inv.sellLabel}</span> : null}
                              {e.inv.adjustEnabled ? <span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">Adjust (corrections)</span> : null}
                              {e.inv.transferEnabled ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">Transfer</span> : null}
                            </div>
                            {(e.inv.quickReceive || e.inv.quickSell) ? (
                              <div className="mt-2 text-xs text-slate-500">
                                Row quick buttons next to Edit/Delete: {e.inv.quickReceive ? 'Receive' : null}{e.inv.quickReceive && e.inv.quickSell ? ' + ' : null}{e.inv.quickSell ? e.inv.sellLabel : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {e.relationFields.length ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Links to other data</div>
                            <ul className="mt-1 space-y-1 text-sm text-slate-700">
                              {e.relationFields.map((r: any) => (
                                <li key={r.label + r.targetSlug}>
                                  <span className="font-semibold">{r.label}:</span> {r.multiple ? 'multiple ' : ''}{r.targetName}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {e.choiceFields.length ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pick-from-a-list fields</div>
                            <ul className="mt-1 space-y-1 text-sm text-slate-700">
                              {e.choiceFields.map((c: any) => (
                                <li key={c.label}>
                                  <span className="font-semibold">{c.label}:</span> {c.options.join(' / ')}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {(e.requiredFields.length || e.uniqueFields.length) ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Data rules</div>
                            {e.requiredFields.length ? (
                              <div className="mt-1 text-sm text-slate-700">
                                <span className="font-semibold">Required:</span> {e.requiredFields.slice(0, 6).join(', ')}{e.requiredFields.length > 6 ? ` + ${e.requiredFields.length - 6} more` : ''}
                              </div>
                            ) : null}
                            {e.uniqueFields.length ? (
                              <div className="mt-1 text-sm text-slate-700">
                                <span className="font-semibold">Must be unique:</span> {e.uniqueFields.slice(0, 6).join(', ')}{e.uniqueFields.length > 6 ? ` + ${e.uniqueFields.length - 6} more` : ''}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-white p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Ask AI to make changes</div>
            <div className="text-xs text-slate-500">
              Example: “Rename tires to tire_skus, add locations, enable Sell button on rows, make condition options New/Used.”
            </div>
            <textarea
              value={aiEditText}
              onChange={(e) => setAiEditText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe the changes you want..."
            />
            <div className="flex justify-end">
              <Button onClick={applyAiEdit} loading={running} disabled={running || !aiEditText.trim()}>
                Apply AI changes
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">Edit SDF (JSON)</div>
              <Button variant="outline" onClick={() => setDraftJson(JSON.stringify(sdf, null, 2))} disabled={running}>
                Reset editor
              </Button>
            </div>
            {draftError ? (
              <div className="rounded-lg border bg-red-50 p-3 text-sm text-red-700">{draftError}</div>
            ) : null}
            <textarea
              value={draftJson}
              onChange={(e) => setDraftJson(e.target.value)}
              rows={12}
              className="w-full rounded-lg border bg-slate-50 px-4 py-3 font-mono text-xs text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
              spellCheck={false}
            />
            <div className="flex justify-end">
              <Button variant="outline" onClick={saveDraft} loading={running} disabled={running}>
                Save SDF
              </Button>
            </div>
          </div>

          {showRaw ? (
            <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-50 p-4 text-xs text-slate-800">
              {JSON.stringify(sdf, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


