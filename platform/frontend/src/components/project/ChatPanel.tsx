export interface ChatPanelProps {
  chatHistory: { role: string; content: string }[];
  chatInput: string;
  chatLoading: boolean;
  suggestedModules: string[];
  discussionPoints: string[];
  confidence: string;
  onInputChange: (value: string) => void;
  onSendMessage: (messageOverride?: string) => void;
}

export default function ChatPanel({
  chatHistory, chatInput, chatLoading,
  suggestedModules, discussionPoints, confidence,
  onInputChange, onSendMessage,
}: ChatPanelProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Discuss with AI</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Chat with the AI advisor to explore features, get suggestions, and refine your requirements before building.
        </p>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
          {chatHistory.length === 0 && (
            <div className="py-6 text-center text-sm text-slate-400">
              Ask the AI about ERP features, modules, or anything about your business setup.
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void onSendMessage(); } }}
              placeholder="Ask about features, modules, or your business needs..."
              className="flex-1 rounded-lg border bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={chatLoading}
            />
            <button
              type="button"
              onClick={() => void onSendMessage()}
              disabled={!chatInput.trim() || chatLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {chatHistory.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {[
            'What modules do you recommend for my business?',
            'What inventory features are available?',
            'Tell me about invoice capabilities',
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void onSendMessage(suggestion)}
              disabled={chatLoading}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {(suggestedModules.length > 0 || discussionPoints.length > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestedModules.length > 0 && (
            <div className="rounded-xl border bg-indigo-50/50 p-4">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Suggested Modules</div>
              <div className="flex flex-wrap gap-1.5">
                {suggestedModules.map((m) => (
                  <span key={m} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">{m}</span>
                ))}
              </div>
            </div>
          )}
          {discussionPoints.length > 0 && (
            <div className="rounded-xl border bg-amber-50/50 p-4">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                Still to Decide
                {confidence && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                    confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    Readiness: {confidence}
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {discussionPoints.map((point, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
