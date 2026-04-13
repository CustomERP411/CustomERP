import { useState, useEffect, useCallback } from 'react';
import {
  trainingService,
  type SessionSummary,
  type SessionDetail,
  type TrainingStats,
} from '../services/trainingService';
import ExportModal from '../components/training/ExportModal';

const AGENT_OPTIONS = ['distributor', 'hr_generator', 'invoice_generator', 'inventory_generator', 'chatbot'];
const QUALITY_OPTIONS = ['good', 'bad', 'needs_edit'] as const;

function qualityColor(q: string | null) {
  if (q === 'good') return 'bg-emerald-100 text-emerald-800';
  if (q === 'bad') return 'bg-red-100 text-red-800';
  if (q === 'needs_edit') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-500';
}

function agentBadge(agent: string) {
  if (agent === 'distributor') return 'bg-orange-100 text-orange-700';
  if (agent.includes('hr')) return 'bg-pink-100 text-pink-700';
  if (agent.includes('invoice')) return 'bg-cyan-100 text-cyan-700';
  if (agent.includes('inventory')) return 'bg-lime-100 text-lime-700';
  if (agent === 'chatbot') return 'bg-teal-100 text-teal-700';
  return 'bg-slate-100 text-slate-500';
}

function agentLabel(agent: string) {
  return agent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function validateSdf(output: Record<string, any>): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!output) { issues.push('Output is empty'); return { valid: false, issues }; }
  if (!output.project_name) issues.push('Missing project_name');
  const entities = output.entities;
  if (!Array.isArray(entities) || entities.length === 0) {
    issues.push('No entities defined');
  } else {
    for (const e of entities) {
      if (!e.slug) issues.push(`Entity missing slug`);
      if (!Array.isArray(e.fields) || e.fields.length === 0) issues.push(`Entity "${e.slug || '?'}" has no fields`);
    }
  }
  if (!output.modules || typeof output.modules !== 'object') issues.push('Missing modules object');
  return { valid: issues.length === 0, issues };
}

export default function TrainingDataPage() {
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
      alert(e?.message || 'Failed to save review');
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

  const sdfValidation = detail?.output ? validateSdf(detail.output) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 border-b bg-white px-5 py-3">
        <h1 className="text-lg font-bold text-slate-800">AI Training Data</h1>
        {stats && (
          <>
            <Pill label="Sessions" value={stats.total_sessions ?? 0} />
            <Pill label="Reviewed" value={stats.reviewed?.total ?? 0} color="blue" />
            <Pill label="Good" value={stats.reviewed?.good ?? 0} color="green" />
            <Pill label="Bad" value={stats.reviewed?.bad ?? 0} color="red" />
            <Pill label="Needs Edit" value={stats.reviewed?.needs_edit ?? 0} color="amber" />
            <Pill label="Tokens" value={(stats.total_tokens ?? 0).toLocaleString()} />
          </>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setShowExport(true)}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Export for Azure
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: session list */}
        <div className="flex w-96 flex-shrink-0 flex-col border-r bg-slate-50 overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 border-b px-3 py-2 bg-white">
            <select
              value={filterAgent}
              onChange={(e) => { setFilterAgent(e.target.value); setOffset(0); }}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">All agents</option>
              {AGENT_OPTIONS.map((a) => <option key={a} value={a}>{agentLabel(a)}</option>)}
            </select>
            <select
              value={filterQuality}
              onChange={(e) => { setFilterQuality(e.target.value); setOffset(0); }}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">All quality</option>
              {QUALITY_OPTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
            <select
              value={filterReviewed}
              onChange={(e) => { setFilterReviewed(e.target.value); setOffset(0); }}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">All</option>
              <option value="true">Reviewed</option>
              <option value="false">Unreviewed</option>
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No sessions found</div>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => setSelectedId(s.session_id)}
                  className={`w-full text-left border-b px-3 py-2.5 transition-colors hover:bg-slate-100 ${
                    selectedId === s.session_id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex flex-wrap gap-1">
                    {(s.agents && s.agents.length > 0)
                      ? s.agents.filter(a => a !== 'integrator').map((a, i) => (
                          <span key={i} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${agentBadge(a)}`}>
                            {agentLabel(a).replace(' Generator', '')}
                          </span>
                        ))
                      : <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500">Pipeline</span>
                    }
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${qualityColor(s.quality)}`}>
                      {s.quality || 'unreviewed'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">{s.description_snippet || '(no description)'}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{new Date(s.timestamp).toLocaleString()}</p>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t bg-white px-3 py-2 text-xs text-slate-500">
            <span>{total} total</span>
            <div className="flex gap-1">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                className="rounded border px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100"
              >Prev</button>
              <button
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                className="rounded border px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100"
              >Next</button>
            </div>
          </div>
        </div>

        {/* Right panel: detail */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!selectedId ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select a session to view details
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading session...</div>
          ) : detail ? (
            <div className="flex flex-col h-full">
              {/* Tabs */}
              <div className="flex border-b bg-slate-50 px-4">
                {(['overview', 'agents'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
                      detailTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'agents' ? `Agents (${detail.step_logs?.filter(s => s.model !== 'deterministic').length || 0})` : tab}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 pr-2">
                  <span>{new Date(detail.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Overview Tab */}
                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    {sdfValidation && (
                      <div className={`rounded-lg border p-3 ${sdfValidation.valid ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                        <h3 className="text-sm font-semibold">
                          {sdfValidation.valid ? 'SDF Valid' : 'SDF Validation Issues'}
                        </h3>
                        {!sdfValidation.valid && (
                          <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
                            {sdfValidation.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                          </ul>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border p-3">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Token Usage</h3>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {Object.entries(detail.token_usage || {}).map(([key, val]) => {
                          if (typeof val !== 'object' || val === null) {
                            return (
                              <div key={key} className="rounded bg-slate-100 px-2 py-1">
                                <span className="font-medium">{key}:</span> {val}
                              </div>
                            );
                          }
                          const prompt = val.prompt ?? 0;
                          const completion = val.completion ?? 0;
                          const t = val.total ?? (prompt + completion);
                          return (
                            <div key={key} className="rounded bg-slate-100 px-2.5 py-1">
                              <span className="font-medium">{key}:</span>{' '}
                              {t.toLocaleString()} tokens
                              <span className="ml-1 text-slate-400">({prompt.toLocaleString()} in / {completion.toLocaleString()} out)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <JsonSection title="Input (top-level)" data={detail.input} defaultExpanded />
                    <JsonSection title="Output (final SDF)" data={detail.output} defaultExpanded />
                  </div>
                )}

                {/* Agents Tab */}
                {detailTab === 'agents' && (
                  <div className="space-y-4">
                    {(!detail.step_logs || detail.step_logs.filter(s => s.model !== 'deterministic').length === 0) ? (
                      <p className="text-sm text-slate-400">No agent step logs available for this session.</p>
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
                          <div key={i} className="rounded-xl border border-slate-200 overflow-hidden">
                            <button
                              onClick={() => toggleStep(i)}
                              className="flex w-full items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${agentBadge(step.agent)}`}>
                                  {agentLabel(step.agent)}
                                </span>
                                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">{step.model}</span>
                                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">t={step.temperature}</span>
                                {existingReview?.quality && (
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${qualityColor(existingReview.quality)}`}>
                                    {existingReview.quality.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="font-medium">{(step.tokens_in + step.tokens_out).toLocaleString()} tokens</span>
                                <span className="text-slate-400">{step.tokens_in.toLocaleString()} in / {step.tokens_out.toLocaleString()} out</span>
                                <span>{(step.duration_ms / 1000).toFixed(1)}s</span>
                                <svg className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="border-t">
                                {/* Data sections (collapsible) */}
                                <div className="divide-y">
                                  {step.prompt_text && (
                                    <SectionToggle
                                      title="Prompt Sent to AI"
                                      sectionKey={promptKey}
                                      expanded={expandedSections.has(promptKey)}
                                      onToggle={toggleSection}
                                      color="blue"
                                    >
                                      <pre className="bg-blue-50 p-3 text-xs text-slate-700 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap break-words">
                                        {step.prompt_text}
                                      </pre>
                                    </SectionToggle>
                                  )}

                                  <SectionToggle
                                    title="Input Data (structured)"
                                    sectionKey={inputKey}
                                    expanded={expandedSections.has(inputKey)}
                                    onToggle={toggleSection}
                                    color="slate"
                                  >
                                    <pre className="bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                                      {JSON.stringify(step.input_summary, null, 2)}
                                    </pre>
                                  </SectionToggle>

                                  <SectionToggle
                                    title="Parsed Output (JSON)"
                                    sectionKey={outputKey}
                                    expanded={expandedSections.has(outputKey)}
                                    onToggle={toggleSection}
                                    color="emerald"
                                  >
                                    <pre className="bg-emerald-50 p-3 text-xs text-slate-700 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                                      {JSON.stringify(step.output_parsed, null, 2)}
                                    </pre>
                                  </SectionToggle>

                                  {step.raw_response && (
                                    <SectionToggle
                                      title="Raw AI Response"
                                      sectionKey={rawKey}
                                      expanded={expandedSections.has(rawKey)}
                                      onToggle={toggleSection}
                                      color="amber"
                                    >
                                      <pre className="bg-amber-50 p-3 text-xs text-slate-600 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                                        {step.raw_response}
                                      </pre>
                                    </SectionToggle>
                                  )}
                                </div>

                                {/* Review — always visible when expanded */}
                                <div className="border-t bg-white px-4 py-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700">Review</span>
                                    {existingReview?.reviewed_at && (
                                      <span className="text-[10px] text-slate-400">
                                        Last saved {new Date(existingReview.reviewed_at).toLocaleDateString()}
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
                                            ? q === 'good' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                              : q === 'bad' ? 'border-red-500 bg-red-50 text-red-700'
                                              : 'border-amber-500 bg-amber-50 text-amber-700'
                                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                        }`}
                                      >{q.replace('_', ' ')}</button>
                                    ))}
                                    <div className="flex-1" />
                                    <button
                                      onClick={() => handleSaveStepReview(step.agent)}
                                      disabled={!sr.quality || sr.saving}
                                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                    >
                                      {sr.saving ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <textarea
                                      value={sr.notes}
                                      onChange={(e) => updateStepReview(step.agent, 'notes', e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Notes (not used in training)..."
                                    />
                                    <textarea
                                      value={sr.corrective}
                                      onChange={(e) => updateStepReview(step.agent, 'corrective', e.target.value)}
                                      rows={2}
                                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Correction notes (personal reference)..."
                                    />
                                  </div>

                                  {sr.quality === 'needs_edit' && (
                                    <div>
                                      <textarea
                                        value={sr.edited}
                                        onChange={(e) => updateStepReview(step.agent, 'edited', e.target.value)}
                                        rows={8}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Paste corrected JSON output for this agent..."
                                      />
                                      {sr.edited.trim() && (() => {
                                        try { JSON.parse(sr.edited); return <p className="mt-1 text-xs text-emerald-600">Valid JSON</p>; }
                                        catch { return <p className="mt-1 text-xs text-red-600">Invalid JSON</p>; }
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
  const bg = color === 'green' ? 'bg-emerald-100 text-emerald-800'
    : color === 'red' ? 'bg-red-100 text-red-800'
    : color === 'amber' ? 'bg-amber-100 text-amber-800'
    : color === 'blue' ? 'bg-blue-100 text-blue-800'
    : 'bg-slate-100 text-slate-700';
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
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {title}
        <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <pre className="border-t bg-slate-50 p-3 text-xs text-slate-700 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
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
    blue: 'text-blue-700 bg-blue-50/50',
    emerald: 'text-emerald-700 bg-emerald-50/50',
    amber: 'text-amber-700 bg-amber-50/50',
    slate: 'text-slate-700 bg-slate-50/50',
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
