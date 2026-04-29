import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  featureRequestService,
  resolveFeatureName,
  type FeatureRequest,
  type FeatureRequestDetail,
  type FeatureStatus,
} from '../services/featureRequestService';

function statusColor(s: string) {
  if (s === 'recorded') return 'bg-app-surface-hover text-app-text-muted';
  if (s === 'denied') return 'bg-app-danger-soft text-app-danger';
  if (s === 'in_progress') return 'bg-app-info-soft text-app-info';
  if (s === 'completed') return 'bg-app-success-soft text-app-success';
  return 'bg-app-surface-hover text-app-text-muted';
}

function statusIcon(s: string) {
  if (s === 'recorded') return (
    <svg className="h-4 w-4 text-app-text-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  if (s === 'denied') return (
    <svg className="h-4 w-4 text-app-danger" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
  if (s === 'in_progress') return (
    <svg className="h-4 w-4 text-app-info" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 4.97m-5.1 5.1H20" />
    </svg>
  );
  if (s === 'completed') return (
    <svg className="h-4 w-4 text-app-success" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
  return null;
}

export default function MyRequestsPage() {
  const { t, i18n } = useTranslation('myRequests');
  const STATUS_LABELS: Record<FeatureStatus, string> = {
    recorded: t('statusLabels.recorded'),
    denied: t('statusLabels.denied'),
    in_progress: t('statusLabels.in_progress'),
    completed: t('statusLabels.completed'),
  };
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FeatureRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    featureRequestService.listMine()
      .then((data) => setRequests(data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setMsgText('');
    try {
      const d = await featureRequestService.getMyDetail(id);
      setDetail(d);
    } catch (e) { console.error(e); }
    finally { setDetailLoading(false); }
  };

  useEffect(() => {
    if (detail?.messages?.length) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail?.messages?.length]);

  const handleSendMessage = async () => {
    if (!detail || !msgText.trim()) return;
    setMsgSending(true);
    try {
      await featureRequestService.addUserMessage(detail.id, msgText.trim());
      const d = await featureRequestService.getMyDetail(detail.id);
      setDetail(d);
      setMsgText('');
    } catch (e: any) { alert(e?.response?.data?.error || e?.message || t('sendFailed')); }
    finally { setMsgSending(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-app-text">{t('title')}</h1>
        <p className="mt-1 text-sm text-app-text-muted">
          {t('subtitle')}
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-app-text-subtle">{t('loading')}</div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-app-border-strong bg-app-surface py-12 text-center">
          <svg className="mx-auto h-10 w-10 text-app-text-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-sm text-app-text-muted">{t('empty')}</p>
          <p className="mt-1 text-xs text-app-text-subtle">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-app-border bg-app-surface overflow-hidden transition-colors hover:border-app-border-strong">
              <button
                type="button"
                onClick={() => toggleExpand(r.id)}
                className="flex w-full items-start justify-between gap-3 px-4 sm:px-5 py-4 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {statusIcon(r.status)}
                  <span className="font-medium text-app-text truncate">{resolveFeatureName(r, i18n.language)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${statusColor(r.status)}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                  <svg className={`h-4 w-4 text-app-text-subtle transition-transform ${expandedId === r.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedId === r.id && (
                <div className="border-t border-app-border px-4 sm:px-5 py-4 bg-app-surface-muted space-y-4">
                  {detailLoading ? (
                    <p className="text-sm text-app-text-subtle text-center py-4">{t('loading')}</p>
                  ) : detail ? (
                    <>
                      <div className="flex flex-wrap gap-3 text-xs text-app-text-muted">
                        <span className="capitalize">{r.source === 'chatbot' ? t('source.chatbot') : t('source.erp')}</span>
                        {r.project_name && <span>{t('projectLabel')}: {r.project_name}</span>}
                        <span>{new Date(r.created_at).toLocaleDateString(i18n.language)}</span>
                      </div>

                      {detail.user_prompt && (
                        <div>
                          <p className="text-xs font-medium text-app-text-muted mb-1">{t('yourPrompt')}</p>
                          <div className="rounded-lg border border-app-border bg-app-surface p-3">
                            <p className="text-sm text-app-text whitespace-pre-wrap">{detail.user_prompt}</p>
                          </div>
                        </div>
                      )}

                      {/* Chat */}
                      <div>
                        <p className="text-xs font-medium text-app-text-muted mb-1">
                          {t('conversation')} {detail.messages.length === 0 ? '' : `(${detail.messages.length})`}
                        </p>
                        <div className="rounded-lg border border-app-border bg-app-surface max-h-64 overflow-y-auto">
                          {detail.messages.length === 0 ? (
                            <p className="p-4 text-xs text-app-text-subtle text-center">{t('noMessages')}</p>
                          ) : (
                            <div className="p-3 space-y-2.5">
                              {detail.messages.map((m) => (
                                <div key={m.id} className={`flex ${m.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                                    m.sender_role === 'user'
                                      ? 'bg-app-accent-blue text-app-text-inverse'
                                      : 'bg-app-surface-hover text-app-text'
                                  }`}>
                                    <p className="text-[13px] whitespace-pre-wrap">{m.body}</p>
                                    <p className={`mt-1 text-[10px] ${m.sender_role === 'user' ? 'text-app-text-inverse/70' : 'text-app-text-subtle'}`}>
                                      {m.sender_role === 'admin' ? t('admin') : t('you')} · {new Date(m.created_at).toLocaleString(i18n.language)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              <div ref={chatEndRef} />
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={msgText}
                            onChange={(e) => setMsgText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                            placeholder={t('replyPlaceholder')}
                            className="flex-1 min-w-0 rounded-lg border border-app-border bg-app-surface-muted px-3 py-2 text-sm text-app-text focus:border-app-accent-blue focus:outline-none focus:ring-1 focus:ring-app-focus"
                          />
                          <button
                            onClick={handleSendMessage}
                            disabled={!msgText.trim() || msgSending}
                            className="rounded-lg bg-app-accent-blue px-4 py-2 text-sm font-medium text-app-text-inverse hover:bg-app-accent-dark-blue disabled:opacity-50 transition-colors sm:w-auto"
                          >
                            {msgSending ? '...' : t('send')}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
