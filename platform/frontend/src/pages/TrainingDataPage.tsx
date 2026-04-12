import { useState, useEffect, useCallback } from 'react';
import {
  trainingService,
  type SessionSummary,
  type SessionDetail,
  type TrainingStats,
} from '../services/trainingService';
import ExportModal from '../components/training/ExportModal';

const ENDPOINTS = ['/ai/analyze', '/ai/clarify', '/ai/chat'];
const QUALITY_OPTIONS = ['good', 'bad', 'needs_edit'] as const;

function qualityColor(q: string | null) {
  if (q === 'good') return 'bg-emerald-100 text-emerald-800';
  if (q === 'bad') return 'bg-red-100 text-red-800';
  if (q === 'needs_edit') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-500';
}

function endpointBadge(ep: string) {
  if (ep.includes('analyze')) return 'bg-blue-100 text-blue-700';
  if (ep.includes('clarify')) return 'bg-violet-100 text-violet-700';
  if (ep.includes('chat')) return 'bg-teal-100 text-teal-700';
  return 'bg-slate-100 text-slate-600';
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
  const [detailTab, setDetailTab] = useState<'overview' | 'pipeline' | 'review'>('overview');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Filters
  const [filterEndpoint, setFilterEndpoint] = useState('');
  const [filterQuality, setFilterQuality] = useState('');
  const [filterReviewed, setFilterReviewed] = useState('');

  // Review form
  const [reviewQuality, setReviewQuality] = useState<'good' | 'bad' | 'needs_edit' | ''>('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewCorrective, setReviewCorrective] = useState('');
  const [reviewEdited, setReviewEdited] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);

  // Pipeline accordion
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const limit = 30;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await trainingService.listSessions({
        limit,
        offset,
        endpoint: filterEndpoint || undefined,
        quality: filterQuality || undefined,
        reviewed: filterReviewed || undefined,
      });
      setSessions(data.sessions);
      setTotal(data.total);
    } catch (e) {
      console.error('Failed to load sessions', e);
    } finally {
      setLoading(false);
    }
  }, [offset, filterEndpoint, filterQuality, filterReviewed]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    trainingService.getStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    trainingService.getSession(selectedId).then((d) => {
      setDetail(d);
      setReviewQuality(d.review?.quality || '');
      setReviewNotes(d.review?.reviewer_notes || '');
      setReviewCorrective(d.review?.corrective_instruction || '');
      setReviewEdited(d.review?.edited_output ? JSON.stringify(d.review.edited_output, null, 2) : '');
      setExpandedSteps(new Set());
      setDetailTab('overview');
    }).catch(console.error).finally(() => setDetailLoading(false));
  }, [selectedId]);

  const handleSaveReview = async () => {
    if (!selectedId || !reviewQuality) return;
    setReviewSaving(true);
    try {
      let editedOutput: Record<string, any> | undefined;
      if (reviewQuality === 'needs_edit' && reviewEdited.trim()) {
        editedOutput = JSON.parse(reviewEdited);
      }
      await trainingService.saveReview(selectedId, {
        quality: reviewQuality as 'good' | 'bad' | 'needs_edit',
        notes: reviewNotes || undefined,
        corrective_instruction: reviewCorrective || undefined,
        edited_output: editedOutput,
      });
      fetchSessions();
      const d = await trainingService.getSession(selectedId);
      setDetail(d);
      trainingService.getStats().then(setStats);
    } catch (e: any) {
      alert(e?.message || 'Failed to save review');
    } finally {
      setReviewSaving(false);
    }
  };

  const toggleStep = (i: number) => {
    setExpandedSteps((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  };

  const sdfValidation = detail?.output ? validateSdf(detail.output) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 border-b bg-white px-5 py-3">
        <h1 className="text-lg font-bold text-slate-800">Training Data</h1>
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
              value={filterEndpoint}
              onChange={(e) => { setFilterEndpoint(e.target.value); setOffset(0); }}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">All endpoints</option>
              {ENDPOINTS.map((ep) => <option key={ep} value={ep}>{ep}</option>)}
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
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${endpointBadge(s.endpoint)}`}>
                      {s.endpoint.replace('/ai/', '')}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${qualityColor(s.quality)}`}>
                      {s.quality || 'unreviewed'}
                    </span>
                    <span className="ml-auto text-slate-400">
                      {s.step_count} step{s.step_count !== 1 ? 's' : ''}
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
                {(['overview', 'pipeline', 'review'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 ${
                      detailTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >{tab}</button>
                ))}
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 pr-2">
                  <span>{detail.endpoint}</span>
                  <span>{new Date(detail.timestamp).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {/* Overview Tab */}
                {detailTab === 'overview' && (
                  <div className="space-y-4">
                    {/* SDF Validation */}
                    {detail.endpoint !== '/ai/chat' && sdfValidation && (
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

                    {/* Token usage */}
                    <div className="rounded-lg border p-3">
                      <h3 className="text-sm font-semibold text-slate-700 mb-2">Token Usage</h3>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {Object.entries(detail.token_usage || {}).map(([key, val]) => (
                          <div key={key} className="rounded bg-slate-100 px-2 py-1">
                            <span className="font-medium">{key}:</span>{' '}
                            {typeof val === 'object' ? `${val.total || 0} tokens` : val}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Input */}
                    <JsonSection title="Input" data={detail.input} defaultExpanded />

                    {/* Output */}
                    <JsonSection title="Output" data={detail.output} defaultExpanded />
                  </div>
                )}

                {/* Pipeline Tab */}
                {detailTab === 'pipeline' && (
                  <div className="space-y-2">
                    {(!detail.step_logs || detail.step_logs.length === 0) ? (
                      <p className="text-sm text-slate-400">No step logs available for this session.</p>
                    ) : (
                      detail.step_logs.map((step, i) => (
                        <div key={i} className="rounded-lg border">
                          <button
                            onClick={() => toggleStep(i)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-slate-700">{step.agent}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{step.model}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">t={step.temperature}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>{step.tokens_in + step.tokens_out} tokens</span>
                              <span>{step.duration_ms}ms</span>
                              <svg className={`h-4 w-4 transition-transform ${expandedSteps.has(i) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          {expandedSteps.has(i) && (
                            <div className="border-t px-4 py-3 space-y-3">
                              <JsonSection title="Input" data={step.input_summary} defaultExpanded />
                              <JsonSection title="Parsed Output" data={step.output_parsed} defaultExpanded />
                              <CollapsibleText title="Raw Response" text={step.raw_response} />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Review Tab */}
                {detailTab === 'review' && (
                  <div className="max-w-xl space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Quality Rating</label>
                      <div className="flex gap-2">
                        {QUALITY_OPTIONS.map((q) => (
                          <button
                            key={q}
                            onClick={() => setReviewQuality(q)}
                            className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                              reviewQuality === q
                                ? q === 'good' ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : q === 'bad' ? 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-amber-500 bg-amber-50 text-amber-700'
                                : 'border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >{q.replace('_', ' ')}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Reviewer Notes</label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Internal notes for yourself (not used in training)..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Correction Notes
                        <span className="ml-1.5 text-xs font-normal text-slate-400">(personal reference — not included in exported training data)</span>
                      </label>
                      <textarea
                        value={reviewCorrective}
                        onChange={(e) => setReviewCorrective(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g. Chatbot hallucinated about shift-based payroll. Edited output fixes this by stating HR only tracks shift assignments..."
                      />
                    </div>

                    {reviewQuality === 'needs_edit' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Edited Output (JSON)</label>
                        <textarea
                          value={reviewEdited}
                          onChange={(e) => setReviewEdited(e.target.value)}
                          rows={12}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Paste corrected JSON output here..."
                        />
                        {reviewEdited.trim() && (() => {
                          try { JSON.parse(reviewEdited); return <p className="mt-1 text-xs text-emerald-600">Valid JSON</p>; }
                          catch { return <p className="mt-1 text-xs text-red-600">Invalid JSON</p>; }
                        })()}
                      </div>
                    )}

                    <button
                      onClick={handleSaveReview}
                      disabled={!reviewQuality || reviewSaving}
                      className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {reviewSaving ? 'Saving...' : 'Save Review'}
                    </button>

                    {detail.review?.reviewed_at && (
                      <p className="text-xs text-slate-400">
                        Last reviewed: {new Date(detail.review.reviewed_at).toLocaleString()}
                      </p>
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

function CollapsibleText({ title, text }: { title: string; text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
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
        <pre className="border-t bg-slate-50 p-3 text-xs text-slate-600 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
          {text}
        </pre>
      )}
    </div>
  );
}
