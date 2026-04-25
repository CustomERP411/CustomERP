import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  featureRequestService,
  type FeatureRequest,
  type FeatureRequestDetail,
  type FeatureRequestStats,
  type FeatureStatus,
} from '../services/featureRequestService';

const STATUSES: FeatureStatus[] = ['recorded', 'denied', 'in_progress', 'completed'];
const SOURCES = ['chatbot', 'sdf_generation'];

function statusColor(s: string) {
  if (s === 'recorded') return 'bg-app-surface-hover text-app-text';
  if (s === 'denied') return 'bg-app-danger-soft text-app-danger';
  if (s === 'in_progress') return 'bg-app-info-soft text-app-info';
  if (s === 'completed') return 'bg-app-success-soft text-app-success';
  return 'bg-app-surface-hover text-app-text-muted';
}

function sourceBadge(s: string) {
  return s === 'chatbot' ? 'bg-app-info-soft text-app-info' : 'bg-app-mod-hr-soft text-app-mod-hr';
}

export default function FeatureRequestsAdminPage() {
  const { t, i18n } = useTranslation('admin');
  const STATUS_LABELS: Record<FeatureStatus, string> = {
    recorded: t('featureRequests.statusLabels.recorded'),
    denied: t('featureRequests.statusLabels.denied'),
    in_progress: t('featureRequests.statusLabels.in_progress'),
    completed: t('featureRequests.statusLabels.completed'),
  };
  const [stats, setStats] = useState<FeatureRequestStats | null>(null);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [detail, setDetail] = useState<FeatureRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editStatus, setEditStatus] = useState<FeatureStatus>('recorded');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const limit = 30;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await featureRequestService.listAll({
        status: filterStatus || undefined,
        source: filterSource || undefined,
        limit, offset,
      });
      setRequests(data.requests);
      setTotal(data.total);
    } catch (e) { console.error('Failed to load feature requests', e); }
    finally { setLoading(false); }
  }, [offset, filterStatus, filterSource]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { featureRequestService.getStats().then(setStats).catch(console.error); }, []);

  const openDetail = async (id: string) => {
    if (detail?.id === id) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const d = await featureRequestService.getDetail(id);
      setDetail(d);
      setEditStatus(d.status);
      setEditNotes(d.admin_notes || '');
      setMsgText('');
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => {
    if (detail?.messages?.length) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await featureRequestService.updateStatus(detail.id, { status: editStatus, admin_notes: editNotes || null });
      const d = await featureRequestService.getDetail(detail.id);
      setDetail(d);
      fetchList();
      featureRequestService.getStats().then(setStats);
    } catch (e: any) { alert(e?.message || t('featureRequests.detail.saveFailed')); }
    finally { setSaving(false); }
  };

  const handleSendMessage = async () => {
    if (!detail || !msgText.trim()) return;
    setMsgSending(true);
    try {
      await featureRequestService.addAdminMessage(detail.id, msgText.trim());
      const d = await featureRequestService.getDetail(detail.id);
      setDetail(d);
      setMsgText('');
    } catch (e: any) { alert(e?.response?.data?.error || e?.message || t('featureRequests.detail.sendFailed')); }
    finally { setMsgSending(false); }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 border-b border-app-border bg-app-surface px-5 py-3">
        <h1 className="text-lg font-bold text-app-text">{t('featureRequests.title')}</h1>
        {stats && (
          <>
            <Pill label={t('featureRequests.stats.total')} value={stats.total} />
            <Pill label={t('featureRequests.stats.recorded')} value={stats.by_status?.recorded ?? 0} />
            <Pill label={t('featureRequests.stats.inProgress')} value={stats.by_status?.in_progress ?? 0} color="blue" />
            <Pill label={t('featureRequests.stats.done')} value={stats.by_status?.completed ?? 0} color="green" />
            <Pill label={t('featureRequests.stats.notPlanned')} value={stats.by_status?.denied ?? 0} color="red" />
          </>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: list */}
        <div className={`${detail ? 'hidden md:flex' : 'flex'} w-full md:w-[420px] flex-shrink-0 flex-col border-r border-app-border bg-app-surface-muted overflow-hidden`}>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 border-b border-app-border px-3 py-2 bg-app-surface">
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }} className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text">
              <option value="">{t('featureRequests.filters.allStatuses')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setOffset(0); }} className="rounded border border-app-border bg-app-surface px-2 py-1 text-xs text-app-text">
              <option value="">{t('featureRequests.filters.allSources')}</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s === 'chatbot' ? t('featureRequests.sources.chatbot') : t('featureRequests.sources.sdfGeneration')}</option>)}
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-app-text-subtle">{t('featureRequests.list.loading')}</div>
            ) : requests.length === 0 ? (
              <div className="p-6 text-center text-sm text-app-text-subtle">{t('featureRequests.list.empty')}</div>
            ) : (
              requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className={`w-full text-left border-b border-app-border px-3 py-3 transition-colors hover:bg-app-surface-hover ${
                    detail?.id === r.id ? 'bg-app-info-soft border-l-2 border-l-app-accent-blue' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${sourceBadge(r.source)}`}>
                      {r.source === 'chatbot' ? t('featureRequests.sources.chatbot') : t('featureRequests.sources.sdfShort')}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor(r.status)}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                    <span className="ml-auto text-app-text-subtle">{new Date(r.created_at).toLocaleDateString(i18n.language)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-app-text line-clamp-2">{r.feature_name}</p>
                  <p className="mt-0.5 text-[11px] text-app-text-muted">{r.user_name || r.user_email || '—'} {r.project_name ? `· ${r.project_name}` : ''}</p>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-app-border bg-app-surface px-3 py-2 text-xs text-app-text-muted">
            <span>{t('featureRequests.list.total', { count: total })}</span>
            <div className="flex gap-1">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="rounded border border-app-border bg-app-surface px-2 py-0.5 text-app-text disabled:opacity-40 hover:bg-app-surface-hover">{t('featureRequests.list.prev')}</button>
              <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="rounded border border-app-border bg-app-surface px-2 py-0.5 text-app-text disabled:opacity-40 hover:bg-app-surface-hover">{t('featureRequests.list.next')}</button>
            </div>
          </div>
        </div>

        {/* Right: detail */}
        <div className={`${detail || detailLoading ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto bg-app-surface min-w-0`}>
          {!detail && !detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-app-text-subtle">
              {t('featureRequests.detail.empty')}
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-app-text-subtle">{t('featureRequests.list.loading')}</div>
          ) : detail ? (
            <div className="flex flex-col h-full min-w-0">
              {/* Header */}
              <div className="border-b border-app-border bg-app-surface-muted px-4 sm:px-6 py-4">
                <button
                  type="button"
                  onClick={() => setDetail(null)}
                  className="md:hidden mb-2 flex items-center gap-1 text-xs font-medium text-app-text-muted hover:text-app-text"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>{t('training.backToList')}</span>
                </button>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-app-text min-w-0 break-words">{detail.feature_name}</h2>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusColor(detail.status)}`}>
                    {STATUS_LABELS[detail.status]}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-app-text-muted">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${sourceBadge(detail.source)}`}>
                    {detail.source === 'chatbot' ? t('featureRequests.sources.chatbot') : t('featureRequests.sources.sdfGeneration')}
                  </span>
                  <span>{t('featureRequests.detail.byUser', { user: detail.user_name || detail.user_email })}</span>
                  {detail.project_name && <span>{t('featureRequests.detail.projectLabel')}: {detail.project_name}</span>}
                  <span>{new Date(detail.created_at).toLocaleString(i18n.language)}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* User prompt */}
                {detail.user_prompt && (
                  <Section title={t('featureRequests.detail.userPrompt')}>
                    <p className="whitespace-pre-wrap text-sm text-app-text leading-relaxed">{detail.user_prompt}</p>
                  </Section>
                )}

                {/* Source detail */}
                {detail.source_detail && (
                  <Section title={t('featureRequests.detail.sourceDetail')}>
                    <p className="whitespace-pre-wrap text-xs text-app-text-muted">{detail.source_detail}</p>
                  </Section>
                )}

                {/* Status + Notes */}
                <Section title={t('featureRequests.detail.statusAndNotes')}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-app-text-muted mb-1">{t('featureRequests.detail.status')}</label>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as FeatureStatus)} className="w-full rounded border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text">
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-app-text-muted mb-1">{t('featureRequests.detail.adminNotes')}</label>
                      <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full rounded border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-text-subtle" placeholder={t('featureRequests.detail.notesPlaceholder')} />
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving} className="mt-3 rounded-lg bg-app-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-app-accent-dark-blue disabled:opacity-50 transition-colors">
                    {saving ? t('featureRequests.detail.saving') : t('featureRequests.detail.saveChanges')}
                  </button>
                </Section>

                {/* Chat thread */}
                <Section title={t('featureRequests.detail.conversation')}>
                  <div className="rounded-lg border border-app-border bg-app-surface-muted max-h-80 overflow-y-auto">
                    {detail.messages.length === 0 ? (
                      <p className="p-4 text-xs text-app-text-subtle text-center">{t('featureRequests.detail.noMessages')}</p>
                    ) : (
                      <div className="p-3 space-y-2.5">
                        {detail.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                              m.sender_role === 'admin'
                                ? 'bg-app-accent-blue text-white'
                                : 'bg-app-surface border text-app-text'
                            }`}>
                              <p className="text-[13px] whitespace-pre-wrap">{m.body}</p>
                              <p className={`mt-1 text-[10px] ${m.sender_role === 'admin' ? 'text-app-text-inverse/70' : 'text-app-text-subtle'}`}>
                                {m.sender_name || m.sender_email} · {new Date(m.created_at).toLocaleString(i18n.language)}
                              </p>
                            </div>
                          </div>
                        ))}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder={t('featureRequests.detail.messagePlaceholder')}
                      className="flex-1 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text placeholder:text-app-text-subtle focus:border-app-accent-blue focus:outline-none focus:ring-1 focus:ring-app-focus"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!msgText.trim() || msgSending}
                      className="rounded-lg bg-app-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-app-accent-dark-blue disabled:opacity-50 transition-colors"
                    >
                      {msgSending ? '...' : t('featureRequests.detail.send')}
                    </button>
                  </div>
                </Section>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-app-text mb-2">{title}</h3>
      <div className="rounded-lg border border-app-border bg-app-surface p-4">{children}</div>
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: number; color?: string }) {
  const bg = color === 'green' ? 'bg-app-success-soft text-app-success'
    : color === 'red' ? 'bg-app-danger-soft text-app-danger'
    : color === 'blue' ? 'bg-app-info-soft text-app-info'
    : 'bg-app-surface-hover text-app-text';
  return (
    <div className={`rounded-full px-3 py-0.5 text-xs font-medium ${bg}`}>
      {label}: <span className="font-bold">{value}</span>
    </div>
  );
}
