import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
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
  if (s === 'recorded') return 'bg-slate-100 text-slate-700';
  if (s === 'denied') return 'bg-red-100 text-red-700';
  if (s === 'in_progress') return 'bg-blue-100 text-blue-700';
  if (s === 'completed') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function sourceBadge(s: string) {
  return s === 'chatbot' ? 'bg-teal-100 text-teal-700' : 'bg-violet-100 text-violet-700';
}

export default function FeatureRequestsAdminPage() {
  const { user } = useAuth();
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
    } catch (e: any) { alert(e?.message || t('featureRequests.detail.sendFailed')); }
    finally { setMsgSending(false); }
  };

  if (!user?.is_admin) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">{t('featureRequests.accessDenied')}</h1>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 border-b bg-white px-5 py-3">
        <h1 className="text-lg font-bold text-slate-800">{t('featureRequests.title')}</h1>
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
        <div className="flex w-[420px] flex-shrink-0 flex-col border-r bg-slate-50 overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 border-b px-3 py-2 bg-white">
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setOffset(0); }} className="rounded border px-2 py-1 text-xs">
              <option value="">{t('featureRequests.filters.allStatuses')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select value={filterSource} onChange={(e) => { setFilterSource(e.target.value); setOffset(0); }} className="rounded border px-2 py-1 text-xs">
              <option value="">{t('featureRequests.filters.allSources')}</option>
              {SOURCES.map((s) => <option key={s} value={s}>{s === 'chatbot' ? t('featureRequests.sources.chatbot') : t('featureRequests.sources.sdfGeneration')}</option>)}
            </select>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">{t('featureRequests.list.loading')}</div>
            ) : requests.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">{t('featureRequests.list.empty')}</div>
            ) : (
              requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => openDetail(r.id)}
                  className={`w-full text-left border-b px-3 py-3 transition-colors hover:bg-slate-100 ${
                    detail?.id === r.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-medium ${sourceBadge(r.source)}`}>
                      {r.source === 'chatbot' ? t('featureRequests.sources.chatbot') : t('featureRequests.sources.sdfShort')}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor(r.status)}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                    <span className="ml-auto text-slate-400">{new Date(r.created_at).toLocaleDateString(i18n.language)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800 line-clamp-2">{r.feature_name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{r.user_name || r.user_email || '—'} {r.project_name ? `· ${r.project_name}` : ''}</p>
                </button>
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t bg-white px-3 py-2 text-xs text-slate-500">
            <span>{t('featureRequests.list.total', { count: total })}</span>
            <div className="flex gap-1">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="rounded border px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100">{t('featureRequests.list.prev')}</button>
              <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="rounded border px-2 py-0.5 disabled:opacity-40 hover:bg-slate-100">{t('featureRequests.list.next')}</button>
            </div>
          </div>
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto bg-white">
          {!detail && !detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              {t('featureRequests.detail.empty')}
            </div>
          ) : detailLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">{t('featureRequests.list.loading')}</div>
          ) : detail ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="border-b bg-slate-50 px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-900">{detail.feature_name}</h2>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusColor(detail.status)}`}>
                    {STATUS_LABELS[detail.status]}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
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
                    <p className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">{detail.user_prompt}</p>
                  </Section>
                )}

                {/* Source detail */}
                {detail.source_detail && (
                  <Section title={t('featureRequests.detail.sourceDetail')}>
                    <p className="whitespace-pre-wrap text-xs text-slate-600">{detail.source_detail}</p>
                  </Section>
                )}

                {/* Status + Notes */}
                <Section title={t('featureRequests.detail.statusAndNotes')}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">{t('featureRequests.detail.status')}</label>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as FeatureStatus)} className="w-full rounded border px-3 py-2 text-sm">
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">{t('featureRequests.detail.adminNotes')}</label>
                      <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} className="w-full rounded border px-3 py-2 text-sm" placeholder={t('featureRequests.detail.notesPlaceholder')} />
                    </div>
                  </div>
                  <button onClick={handleSave} disabled={saving} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {saving ? t('featureRequests.detail.saving') : t('featureRequests.detail.saveChanges')}
                  </button>
                </Section>

                {/* Chat thread */}
                <Section title={t('featureRequests.detail.conversation')}>
                  <div className="rounded-lg border bg-slate-50 max-h-80 overflow-y-auto">
                    {detail.messages.length === 0 ? (
                      <p className="p-4 text-xs text-slate-400 text-center">{t('featureRequests.detail.noMessages')}</p>
                    ) : (
                      <div className="p-3 space-y-2.5">
                        {detail.messages.map((m) => (
                          <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                              m.sender_role === 'admin'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border text-slate-800'
                            }`}>
                              <p className="text-[13px] whitespace-pre-wrap">{m.body}</p>
                              <p className={`mt-1 text-[10px] ${m.sender_role === 'admin' ? 'text-blue-200' : 'text-slate-400'}`}>
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
                      className="flex-1 rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!msgText.trim() || msgSending}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
      <h3 className="text-sm font-semibold text-slate-700 mb-2">{title}</h3>
      <div className="rounded-lg border bg-white p-4">{children}</div>
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: number; color?: string }) {
  const bg = color === 'green' ? 'bg-emerald-100 text-emerald-800'
    : color === 'red' ? 'bg-red-100 text-red-800'
    : color === 'blue' ? 'bg-blue-100 text-blue-800'
    : 'bg-slate-100 text-slate-700';
  return (
    <div className={`rounded-full px-3 py-0.5 text-xs font-medium ${bg}`}>
      {label}: <span className="font-bold">{value}</span>
    </div>
  );
}
