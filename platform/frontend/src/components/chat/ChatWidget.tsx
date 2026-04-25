import { useRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatContext } from '../../context/ChatContext';

export default function ChatWidget() {
  const {
    isOpen, chatHistory, chatLoading, projectContext, pulsing, previewWideLayout,
    toggleChat, sendMessage,
  } = useChatContext();
  const { t } = useTranslation('chatbot');

  const quickPrompts: { key: string; text: string }[] = [
    { key: 'chooseModules', text: t('empty.quickPrompts.chooseModules') },
    { key: 'describeBusiness', text: t('empty.quickPrompts.describeBusiness') },
    { key: 'howToStart', text: t('empty.quickPrompts.howToStart') },
  ];

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50);
    }
  }, [isOpen]);

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    setInput('');
    void sendMessage(msg);
  };

  const hasProject = !!projectContext?.projectId;

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          type="button"
          onClick={toggleChat}
          className={
            previewWideLayout
              ? 'fixed bottom-6 left-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-app-accent-blue text-white shadow-lg hover:bg-app-accent-dark-blue hover:scale-105 active:scale-95 sm:left-6'
              : 'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-app-accent-blue text-white shadow-lg hover:bg-app-accent-dark-blue hover:scale-105 active:scale-95'
          }
          style={pulsing ? { animation: 'chatPulse 1s ease-in-out infinite' } : undefined}
          aria-label={t('openChat')}
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className={
            previewWideLayout
              ? 'fixed bottom-6 left-3 z-40 flex w-[min(640px,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl border border-app-border bg-app-surface shadow-2xl animate-in fade-in slide-in-from-left-2 duration-200 sm:left-6'
              : 'fixed bottom-6 right-3 z-40 flex w-[calc(100vw-1.5rem)] sm:right-6 sm:w-[400px] flex-col rounded-2xl border border-app-border bg-app-surface shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200'
          }
          style={
            previewWideLayout
              ? { height: 'min(480px, 85dvh)', maxHeight: 'calc(100dvh - 3rem)' }
              : { height: '520px', maxHeight: 'calc(100vh - 48px)' }
          }
        >
          {/* Header — single horizontal row in preview wide layout */}
          <div
            className={
              previewWideLayout
                ? 'flex flex-nowrap items-center justify-between gap-2 rounded-t-2xl border-b bg-app-accent-blue px-3 py-2.5 sm:px-4'
                : 'flex items-center justify-between rounded-t-2xl border-b bg-app-accent-blue px-4 py-3'
            }
          >
            <div
              className={
                previewWideLayout
                  ? 'flex min-w-0 flex-1 flex-nowrap items-center gap-2.5'
                  : 'flex items-center gap-2'
              }
            >
              <svg
                className={previewWideLayout ? 'h-5 w-5 shrink-0 text-white/80' : 'h-5 w-5 text-white/80'}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              {previewWideLayout ? (
                <div className="flex min-w-0 flex-1 flex-nowrap items-baseline gap-x-2 gap-y-0 overflow-hidden">
                  <span className="shrink-0 text-sm font-semibold text-white">{t('title')}</span>
                  {projectContext?.projectName && (
                    <>
                      <span className="shrink-0 text-white/50" aria-hidden>
                        |
                      </span>
                      <span className="min-w-0 truncate text-xs font-medium text-white/80">{projectContext.projectName}</span>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-sm font-semibold text-white">{t('title')}</div>
                  {projectContext?.projectName && (
                    <div className="text-[11px] text-white/70 truncate max-w-[240px]">{projectContext.projectName}</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleChat}
              className="shrink-0 rounded-lg p-1.5 text-white/80 hover:bg-app-surface/10 hover:text-white transition-colors"
              aria-label={t('closeChat')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {!hasProject && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center px-4">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-app-surface-hover">
                    <svg className="h-6 w-6 text-app-text-subtle" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-app-text">{t('empty.title')}</p>
                  <p className="mt-1 text-xs text-app-text-subtle">{t('empty.subtitle')}</p>
                </div>
              </div>
            )}

            {hasProject && chatHistory.length === 0 && !chatLoading && (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-app-info-soft">
                  <svg className="h-5 w-5 text-app-accent-blue" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                  </svg>
                </div>
                <p className="text-sm text-app-text-muted">{t('empty.subtitle')}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt.key}
                      type="button"
                      onClick={() => handleSend(prompt.text)}
                      className="rounded-full border border-app-border bg-app-surface px-2.5 py-1 text-[11px] text-app-text-muted hover:bg-app-surface-muted hover:border-app-border-strong transition-colors"
                    >
                      {prompt.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasProject && chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-app-accent-blue text-white'
                    : 'bg-app-surface-hover text-app-text'
                }`}>
                  {msg.unsupportedFeatures && msg.unsupportedFeatures.length > 0 && (
                    <div className="mb-2 rounded-lg bg-app-warning-soft border border-app-warning-border px-2.5 py-1.5 text-[11px] text-app-warning">
                      <span className="font-semibold">{t('recordedForFuture')}</span>{' '}
                      {msg.unsupportedFeatures.join(', ')}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-app-surface-hover px-3.5 py-2.5 text-sm text-app-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-app-text-subtle animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-app-text-subtle animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-app-text-subtle animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2.5">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={hasProject ? t('placeholder') : t('empty.title')}
                disabled={!hasProject || chatLoading}
                className="flex-1 rounded-xl border bg-app-surface-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-app-focus disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || !hasProject || chatLoading}
                className="rounded-xl bg-app-accent-blue px-3 py-2 text-white hover:bg-app-accent-dark-blue disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                aria-label={t('send')}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
