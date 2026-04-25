import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trainingService,
  type SessionSummary,
  type SessionDetail,
  type TrainingStats,
} from '../services/trainingService';
import ExportModal from '../components/training/ExportModal';

const AGENT_OPTIONS = ['reviewer', 'distributor', 'hr_generator', 'invoice_generator', 'inventory_generator', 'chatbot'];
const QUALITY_OPTIONS = ['good', 'bad', 'needs_edit'] as const;

function qualityColor(q: string | null) {
  if (q === 'good') return 'bg-app-success-soft text-app-success';
  if (q === 'bad') return 'bg-app-danger-soft text-app-danger';
  if (q === 'needs_edit') return 'bg-app-warning-soft text-app-warning';
  return 'bg-app-surface-hover text-app-text-muted';
}

function agentBadge(agent: string) {
  if (agent === 'reviewer') return 'bg-app-info-soft text-app-info';
  if (agent === 'distributor') return 'bg-app-warning-soft text-app-warning';
  if (agent.includes('hr')) return 'bg-app-mod-hr-soft text-app-mod-hr';
  if (agent.includes('invoice')) return 'bg-app-mod-invoice-soft text-app-mod-invoice';
  if (agent.includes('inventory')) return 'bg-app-mod-inventory-soft text-app-mod-inventory';
  if (agent === 'chatbot') return 'bg-app-info-soft text-app-info';
  return 'bg-app-surface-hover text-app-text-muted';
}

function agentLabel(agent: string) {
  return agent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function validateSdf(
  output: Record<string, any>,
  t: (key: string, opts?: any) => string,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!output) { issues.push(t('training.validation.empty')); return { valid: false, issues }; }
  if (!output.project_name) issues.push(t('training.validation.missingProjectName'));
  const entities = output.entities;
  if (!Array.isArray(entities) || entities.length === 0) {
    issues.push(t('training.validation.noEntities'));
  } else {
    for (const e of entities) {
      if (!e.slug) issues.push(t('training.validation.entityMissingSlug'));
      if (!Array.isArray(e.fields) || e.fields.length === 0) issues.push(t('training.validation.entityNoFields', { slug: e.slug || '?' }));
    }
  }
  if (!output.modules || typeof output.modules !== 'object') issues.push(t('training.validation.missingModules'));
  return { valid: issues.length === 0, issues };
}

export default function TrainingDataPage() {
  const { t, i18n } = useTranslation('admin');
  const lang = i18n.language;
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'agents'>('agents');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [filterAgent, setFilterAgent] = useState('');
  const [filterQuality, setFilterQuality] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('');

  const [stepReviewState, setStepReviewState] = useState<Record<string, {
    quality: 'good' | 'bad' | 'needs_edit' | '';
    notes: string;
    corrective: string;
    edited: string;
    saving: boolean;
  }>>({});

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const limit = 30;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await trainingService.listSessions({
        limit,
        offset,
        quality: filterQuality || undefined,
        reviewed: filterReviewed || undefined,
        agent: filterAgent || undefined,
      });
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [offset, filterAgent, filterQuality, filterReviewed]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);
  useEffect(() => { trainingService.getStats().then(setStats).catch(console.error); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    trainingService.getSession(selectedId).then((d) => {
      let aiSteps = (d.step_logs || []).filter(s => s.model !== 'deterministic');

      if (aiSteps.length === 0 && d.endpoint === '/ai/chat') {
        aiSteps = [{
          agent: 'chatbot',
          model: 'chatbot',
          temperature: 0,
          prompt_text: '',
          input_summary: d.input || {},
          output_parsed: d.output || {},
          raw_response: '',
          tokens_in: d.token_usage?.total?.prompt ?? 0,
          tokens_out: d.token_usage?.total?.completion ?? 0,
          duration_ms: 0,
        }];
        d.step_logs = aiSteps;
      }

      setDetail(d);
      const initState: typeof stepReviewState = {};
      for (const step of aiSteps) {
        const existing = d.step_reviews?.[step.agent];
        initState[step.agent] = {
          quality: existing?.quality || '',
          notes: existing?.reviewer_notes || '',
          corrective: existing?.corrective_instruction || '',
          edited: existing?.edited_output ? JSON.stringify(existing.edited_output, null, 2) : '',
          saving: false,
        };
      }
      setStepReviewState(initState);
      setExpandedSteps(new Set());
      setExpandedSections(new Set());
      setDetailTab('agents');
    }).catch(console.error).finally(() => setDetailLoading(false));
  }, [selectedId]);

  const handleSaveStepReview = async (agent: string) => {
    if (!selectedId) return;
    const s = stepReviewState[agent];
    if (!s?.quality) return;
    setStepReviewState(prev => ({ ...prev, [agent]: { ...prev[agent], saving: true } }));
    try {
      let editedOutput: Record<string, any> | undefined;
      if (s.quality === 'needs_edit' && s.edited.trim()) {
        editedOutput = JSON.parse(s.edited);
      }
      await trainingService.saveStepReview(selectedId, agent, {
        quality: s.quality as 'good' | 'bad' | 'needs_edit',
        notes: s.notes || undefined,
        corrective_instruction: s.corrective || undefined,
        edited_output: editedOutput,
      });
      fetchSessions();
      trainingService.getStats().then(setStats);
    } catch (e: any) {
      alert(e?.message || t('training.agentsTab.failedToSave'));
    } finally {
      setStepReviewState(prev => ({ ...prev, [agent]: { ...prev[agent], saving: false } }));
    }
  };

  const updateStepReview = (agent: string, field: string, value: string) => {
    setStepReviewState(prev => ({
      ...prev,
      [agent]: { ...prev[agent], [field]: value },
    }));
  };

  const toggleStep = (i: number) => {
    setExpandedSteps((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const sdfValidation = detail?.output ? validateSdf(detail.output, t) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-app-border bg-app-surface px-5 py-3">
        <h1 className="text-lg font-bold text-app-text">{t('training.title')}</h1>
        {stats && (
          <>
            <Pill label={t('training.stats.sessions')} value={stats.total_sessions ?? 0} />
            <Pill label={t('training.stats.reviewed')} value={stats.reviewed?.total ?? 0} color="blue" />
            <Pill label={t('training.stats.good')} value={stats.reviewed?.good ?? 0} color="green" />
            <Pill label={t('training.stats.bad')} value={stats.reviewed?.bad ?? 0} color="red" />
            <Pill label={t('training.stats.needsEdit')} value={stats.reviewed?.needs_edit ?? 0} color="amber" />
            <Pill label={t('training.stats.tokens')} value={(stats.total_tokens ?? 0).toLocaleString(lang)} />
          </>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setShowExport(true)}
            className="rounded-lg bg-app-accent-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-app-accent-dark-blue transition-colors"
          >
            {t('training.export')}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: session list */}
        <div className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full md:w-96 flex-shrink-0 flex-col border-r border-app-border bg-app-surface-muted overflow-hidden`}>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 border-b border-app-border px-3 py-2 bg-app-surface">
            <select
              value={filterAgent}
              onChange={(e) => { setFilterAgent(e.target.value); setOffset(0); }}
              className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
            >
              <option value="">{t('training.filters.allAgents')}</option>
              {AGENT_OPTIONS.map((a) => <option key={a} value={a}>{agentLabel(a)}</option>)}
            </select>
            <select
              value={filterQuality}
              onChange={(e) => { setFilterQuality(e.target.value); setOffset(0); }}
              className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
            >
              <option value="">{t('training.filters.allQuality')}</option>
              {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <select
              value={filterReviewed}
              onChange={(e) => { setFilterReviewed(e.target.value); setOffset(0); }}
              className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text"
            >
              <option value="">{t('training.filters.all')}</option>
              <option value="true">{t('training.filters.reviewed')}</option>
              <option value="false">{t('training.filters.unreviewed')}</option>
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-app-text-subtle">{t('training.loading')}</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-app-text-subtle">{t('training.noSessions')}</div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => setSelectedId(s.session_id)}
                  className={`w-full text-left border-b border-app-border px-3 py-2.5 transition-colors hover:bg-app-surface-hover ${
                    selectedId === s.session_id ? 'bg-app-info-soft border-l-2 border-l-app-accent-blue' : ''
                  }`}
                >
                  <div className="flex flex-wrap gap-1">
                    {(s.agents && s.agents.length > 0)
                      ? s.agents.filter(a => a !== 'integrator').map((a, i) => (
                          <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${agentBadge(a)}`}>
                            {agentLabel(a).replace(' Generator', '')}
                          </span>
                        ))
                      : <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-app-surface-hover text-app-text-muted">{t('training.sessionItem.pipeline')}</span>
                    }
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${qualityColor(s.quality)}`}>
                      {s.quality || t('training.sessionItem.unreviewed')}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-app-text-muted line-clamp-2">{s.description_snippet || t('training.sessionItem.noDescription')}</p>
                  <p className="mt-0.5 text-[10px] text-app-text-subtle">{new Date(s.timestamp).toLocaleString(lang)}</p>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-app-border bg-app-surface px-3 py-2 text-xs text-app-text-muted">
            <span>{t('training.sessionsTotal', { count: total })}</span>
            <div className="flex gap-1">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded border border-app-border bg-app-surface px-2 py-0.5 text-app-text disabled:opacity-40 hover:bg-app-surface-hover"
              >{t('training.prev')}</button>
              <button
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="rounded border border-app-border bg-app-surface px-2 py-0.5 text-app-text disabled:opacity-40 hover:bg-app-surface-hover"
              >{t('training.next')}</button>
            </div>
          </div>
        </div>

        {/* Right panel: detail */}
        <div className={`${selectedId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto bg-app-surface min-w-0`}>
          {!selectedId ? (
            <div className="flex h-full items-center justify-center text-sm text-app-text-subtle">
              {t('training.selectSession')}
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-app-text-subtle">{t('training.loadingSession')}</div>
          ) : detail ? (
            <div className="flex flex-col h-full min-w-0">
              {/* Tabs */}
              <div className="flex items-center border-b border-app-border bg-app-surface-muted px-2 sm:px-4 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden mr-1 flex items-center gap-1 px-2 py-2 text-xs font-medium text-app-text-muted hover:text-app-text"
                  aria-label={t('training.backToList')}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="whitespace-nowrap">{t('training.backToList')}</span>
                </button>
                {(['overview', 'agents'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
                      detailTab === tab
                        ? 'border-app-accent-blue text-app-accent-blue'
                        : 'border-transparent text-app-text-muted hover:text-app-text'
                    }`}
                  >
                    {tab === 'agents' ? t('training.tabs.agents', { count: detail.step_logs?.filter(s => s.model !== 'deterministic').length || 0 }) : t('training.tabs.overview')}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 text-xs text-app-text-subtle pr-2">
                  <span>{new Date(detail.timestamp).toLocaleString(lang)}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Overview Tab */}
                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    {sdfValidation && (
                      <div className={`rounded-lg border p-3 ${sdfValidation.valid ? 'border-app-success-border bg-app-success-soft' : 'border-app-danger-border bg-app-danger-soft'}`}>
                        <h3 className="text-sm font-semibold">
                          {sdfValidation.valid ? t('training.overview.sdfValid') : t('training.overview.sdfIssues')}
                        </h3>
                        {!sdfValidation.valid && (
                          <ul className="mt-1 list-disc pl-5 text-xs text-app-danger">
                            {sdfValidation.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-app-border bg-app-surface p-3">
                      <h3 className="text-sm font-semibold text-app-text mb-2">{t('training.overview.tokenUsage')}</h3>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {Object.entries(detail.token_usage || {}).map(([key, val]) => {
                          if (typeof val !== 'object' || val === null) {
                            return (
                              <div key={key} className="rounded bg-app-surface-hover px-2 py-1">
                                <span className="font-medium">{key}:</span> {val}
                              </div>
                            );
                          }
                          const prompt = val.prompt ?? 0;
                          const completion = val.completion ?? 0;
                          const totalTok = val.total ?? (prompt + completion);
                          return (
                            <div key={key} className="rounded bg-app-surface-hover px-2.5 py-1">
                              <span className="font-medium">{key}:</span>{' '}
                              {totalTok.toLocaleString(lang)} {t('training.overview.tokens')}
                              <span className="ml-1 text-app-text-subtle">{t('training.overview.inOut', { in_: prompt.toLocaleString(lang), out: completion.toLocaleString(lang) })}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <JsonSection title={t('training.overview.inputTopLevel')} data={detail.input} defaultExpanded />
                    <JsonSection title={t('training.overview.outputFinal')} data={detail.output} defaultExpanded />
                  </div>
                )}

                {/* Agents Tab */}
                {detailTab === 'agents' && (
                  <div className="space-y-4">
                    {(!detail.step_logs || detail.step_logs.filter(s => s.model !== 'deterministic').length === 0) ? (
                      <p className="text-sm text-app-text-subtle">{t('training.agentsTab.noAgentLogs')}</p>
                    ) : (
                      detail.step_logs.filter(s => s.model !== 'deterministic').map((step, i) => {
                        const isExpanded = expandedSteps.has(i);
                        const promptKey = `${i}-prompt`;
                        const inputKey = `${i}-input`;
                        const outputKey = `${i}-output`;
                        const rawKey = `${i}-raw`;
                        const sr = stepReviewState[step.agent] || { quality: '', notes: '', corrective: '', edited: '', saving: false };
                        const existingReview = detail.step_reviews?.[step.agent];
                        return (
                          <div key={i} className="rounded-xl border border-app-border overflow-hidden">
                            <button
                              onClick={() => toggleStep(i)}
                              className="flex w-full items-center justify-between px-4 py-3 bg-app-surface-muted hover:bg-app-surface-hover transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${agentBadge(step.agent)}`}>
                                  {agentLabel(step.agent)}
                                </span>
                                <span className="rounded bg-app-surface-hover px-1.5 py-0.5 text-[10px] font-mono text-app-text-muted">{step.model}</span>
                                <span className="rounded bg-app-surface-hover px-1.5 py-0.5 text-[10px] text-app-text-muted">t={step.temperature}</span>
                                {existingReview?.quality && (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${qualityColor(existingReview.quality)}`}>
                                    {existingReview.quality.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-app-text-muted">
                                <span className="font-medium">{t('training.agentsTab.tokens', { count: (step.tokens_in + step.tokens_out).toLocaleString(lang) as any })}</span>
                                <span className="text-app-text-subtle">{t('training.agentsTab.tokensInOut', { in_: step.tokens_in.toLocaleString(lang), out: step.tokens_out.toLocaleString(lang) })}</span>
                                <span>{(step.duration_ms / 1000).toFixed(1)}s</span>
                                <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t border-app-border">
                                {/* Data sections (collapsible) */}
                                <div className="divide-y divide-app-border">
                                  {step.prompt_text && (
                                    <SectionToggle
                                      title={t('training.agentsTab.promptSent')}
                                      sectionKey={promptKey}
                                      expanded={expandedSections.has(promptKey)}
                                      onToggle={toggleSection}
                                      color="blue"
                                    >
                                      <pre className="bg-app-info-soft p-3 text-xs text-app-text overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words">
                                        {step.prompt_text}
                                      </pre>
                                    </SectionToggle>
                                  )}

                                  <SectionToggle
                                    title={t('training.agentsTab.inputData')}
                                    sectionKey={inputKey}
                                    expanded={expandedSections.has(inputKey)}
                                    onToggle={toggleSection}
                                    color="slate"
                                  >
                                    <pre className="bg-app-surface-muted p-3 text-xs text-app-text overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                                      {JSON.stringify(step.input_summary, null, 2)}
                                    </pre>
                                  </SectionToggle>

                                  <SectionToggle
                                    title={t('training.agentsTab.parsedOutput')}
                                    sectionKey={outputKey}
                                    expanded={expandedSections.has(outputKey)}
                                    onToggle={toggleSection}
                                    color="emerald"
                                  >
                                    <pre className="bg-app-success-soft p-3 text-xs text-app-text overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                                      {JSON.stringify(step.output_parsed, null, 2)}
                                    </pre>
                                  </SectionToggle>

                                  {step.raw_response && (
                                    <SectionToggle
                                      title={t('training.agentsTab.rawResponse')}
                                      sectionKey={rawKey}
                                      expanded={expandedSections.has(rawKey)}
                                      onToggle={toggleSection}
                                      color="amber"
                                    >
                                      <pre className="bg-app-warning-soft p-3 text-xs text-app-text-muted overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                                        {step.raw_response}
                                      </pre>
                                    </SectionToggle>
                                  )}
                                </div>

                                {/* Review — always visible when expanded */}
                                <div className="border-t border-app-border bg-app-surface px-4 py-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-app-text">{t('training.agentsTab.review')}</span>
                                    {existingReview?.reviewed_at && (
                                      <span className="text-[10px] text-app-text-subtle">
                                        {t('training.agentsTab.lastSaved', { date: new Date(existingReview.reviewed_at).toLocaleDateString(lang) })}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {QUALITY_OPTIONS.map((q) => (
                                      <button
                                        key={q}
                                        onClick={() => updateStepReview(step.agent, 'quality', sr.quality === q ? '' : q)}
                                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                                          sr.quality === q
                                            ? q === 'good' ? 'border-app-success bg-app-success-soft text-app-success'
                                              : q === 'bad' ? 'border-app-danger bg-app-danger-soft text-app-danger'
                                              : 'border-app-warning bg-app-warning-soft text-app-warning'
                                            : 'border-app-border text-app-text-muted hover:border-app-border-strong'
                                        }`}
                                      >{q.replace('_', ' ')}</button>
                                    ))}
                                    <div className="flex-1" />
                                    <button
                                      onClick={() => handleSaveStepReview(step.agent)}
                                      disabled={!sr.quality || sr.saving}
                                      className="rounded-lg bg-app-accent-blue px-4 py-1.5 text-xs font-medium text-white hover:bg-app-accent-dark-blue disabled:opacity-50 transition-colors"
                                    >
                                      {sr.saving ? t('training.agentsTab.saving') : t('training.agentsTab.save')}
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <textarea
                                      value={sr.notes}
                                      onChange={(e) => updateStepReview(step.agent, 'notes', e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-app-border-strong px-3 py-2 text-xs focus:border-app-accent-blue focus:outline-none focus:ring-1 focus:ring-app-focus"
                                      placeholder={t('training.agentsTab.notesPlaceholder')}
                                    />
                                    <textarea
                                      value={sr.corrective}
                                      onChange={(e) => updateStepReview(step.agent, 'corrective', e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-app-border-strong px-3 py-2 text-xs focus:border-app-accent-blue focus:outline-none focus:ring-1 focus:ring-app-focus"
                                      placeholder={t('training.agentsTab.correctivePlaceholder')}
                                    />
                                  </div>

                                  {sr.quality === 'needs_edit' && (
                                    <div>
                                      <textarea
                                        value={sr.edited}
                                        onChange={(e) => updateStepReview(step.agent, 'edited', e.target.value)}
                                        rows={8}
                                        className="w-full rounded-lg border border-app-border-strong px-3 py-2 font-mono text-xs focus:border-app-accent-blue focus:outline-none focus:ring-1 focus:ring-app-focus"
                                        placeholder={t('training.agentsTab.editedPlaceholder')}
                                      />
                                      {sr.edited.trim() && (() => {
                                        try { JSON.parse(sr.edited); return <p className="mt-1 text-xs text-app-success">{t('training.agentsTab.validJson')}</p>; }
                                        catch { return <p className="mt-1 text-xs text-app-danger">{t('training.agentsTab.invalidJson')}</p>; }
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {showExport && (
        <ExportModal
          stats={stats}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function Pill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const bg = color === 'green' ? 'bg-app-success-soft text-app-success'
    : color === 'red' ? 'bg-app-danger-soft text-app-danger'
    : color === 'amber' ? 'bg-app-warning-soft text-app-warning'
    : color === 'blue' ? 'bg-app-info-soft text-app-info'
    : 'bg-app-surface-hover text-app-text';
  return (
    <div className={`rounded-full px-3 py-0.5 text-xs font-medium ${bg}`}>
      {label}: <span className="font-bold">{value}</span>
    </div>
  );
}

function JsonSection({ title, data, defaultExpanded = false }: {
  title: string;
  data: Record<string, any> | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  if (!data) return null;
  const text = JSON.stringify(data, null, 2);
  return (
    <div className="rounded-lg border border-app-border bg-app-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-app-text hover:bg-app-surface-muted"
      >
        {title}
        <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <pre className="border-t border-app-border bg-app-surface-muted p-3 text-xs text-app-text overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
          {text}
        </pre>
      )}
    </div>
  );
}

function SectionToggle({ title, sectionKey, expanded, onToggle, color = 'slate', defaultOpen = false, children }: {
  title: string;
  sectionKey: string;
  expanded: boolean;
  onToggle: (key: string) => void;
  color?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const isOpen = expanded || localOpen;

  const handleToggle = () => {
    if (expanded) {
      onToggle(sectionKey);
    } else if (localOpen) {
      setLocalOpen(false);
    } else {
      onToggle(sectionKey);
      setLocalOpen(true);
    }
  };

  const colorMap: Record<string, string> = {
    blue: 'text-app-info bg-app-info-soft/50',
    emerald: 'text-app-success bg-app-success-soft/50',
    amber: 'text-app-warning bg-app-warning-soft/50',
    slate: 'text-app-text bg-app-surface-muted/50',
  };

  return (
    <div>
      <button
        onClick={handleToggle}
        className={`flex w-full items-center justify-between px-4 py-2 text-xs font-semibold ${colorMap[color] || colorMap.slate} hover:opacity-80 transition-opacity`}
      >
        {title}
        <svg className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && children}
    </div>
  );
}
