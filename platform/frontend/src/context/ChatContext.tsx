import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import i18n from '../i18n';
import { projectService } from '../services/projectService';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  unsupportedFeatures?: string[];
}

export interface ProjectContext {
  projectId: string;
  projectName: string;
  description: string;
  selectedModules: string[];
  businessAnswers: Record<string, { question: string; answer: string }>;
  currentStep: string;
  sdfStatus: 'none' | 'generated' | 'reviewed' | 'approved';
}

interface ChatContextType {
  isOpen: boolean;
  chatHistory: ChatMessage[];
  chatLoading: boolean;
  projectContext: ProjectContext | null;
  pulsing: boolean;
  /** True when the live preview is in phone “wide / horizontal” (rotated) layout — chat FAB anchors bottom-left. */
  previewWideLayout: boolean;
  setPreviewWideLayout: (v: boolean) => void;
  toggleChat: () => void;
  openChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  setProjectContext: (ctx: ProjectContext | null) => void;
  clearChat: () => void;
  setPulsing: (v: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

const HISTORY_STORAGE_PREFIX = 'chat_history:';
const MAX_STORED_MESSAGES = 50;

function loadHistory(projectId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_STORAGE_PREFIX}${projectId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(projectId: string, history: ChatMessage[]) {
  try {
    const trimmed = history.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(`${HISTORY_STORAGE_PREFIX}${projectId}`, JSON.stringify(trimmed));
  } catch { /* quota exceeded — ignore */ }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [projectContext, setProjectContextState] = useState<ProjectContext | null>(null);
  const [pulsing, setPulsing] = useState(false);
  const [previewWideLayout, setPreviewWideLayout] = useState(false);
  const projectContextRef = useRef<ProjectContext | null>(null);

  useEffect(() => {
    projectContextRef.current = projectContext;
  }, [projectContext]);

  // When project context changes, load the stored history for that project
  useEffect(() => {
    if (projectContext?.projectId) {
      setChatHistory(loadHistory(projectContext.projectId));
    } else {
      setChatHistory([]);
    }
  }, [projectContext?.projectId]);

  // Persist history whenever it changes
  useEffect(() => {
    const pid = projectContextRef.current?.projectId;
    if (pid && chatHistory.length > 0) {
      saveHistory(pid, chatHistory);
    }
  }, [chatHistory]);

  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), []);
  const openChat = useCallback(() => setIsOpen(true), []);

  const setProjectContext = useCallback((ctx: ProjectContext | null) => {
    setProjectContextState(ctx);
  }, []);

  const setPreviewWideLayoutFn = useCallback((v: boolean) => {
    setPreviewWideLayout(v);
  }, []);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    const pid = projectContextRef.current?.projectId;
    if (pid) {
      try { localStorage.removeItem(`${HISTORY_STORAGE_PREFIX}${pid}`); } catch { /* ignore */ }
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const msg = text.trim();
    if (!msg || chatLoading) return;

    const ctx = projectContextRef.current;
    if (!ctx?.projectId) return;

    setChatLoading(true);

    const userMessage: ChatMessage = { role: 'user', content: msg };
    setChatHistory((prev) => [...prev, userMessage]);

    try {
      const res = await projectService.chatWithProject(ctx.projectId, msg, {
        conversation_history: [...chatHistory, userMessage].slice(-10),
        selected_modules: ctx.selectedModules,
        business_answers: ctx.businessAnswers,
        current_step: ctx.currentStep,
        sdf_status: ctx.sdfStatus,
      });
      const unsupported = Array.isArray(res.unsupported_features) ? res.unsupported_features : [];
      setChatHistory((prev) => [...prev, {
        role: 'assistant',
        content: res.reply,
        ...(unsupported.length > 0 ? { unsupportedFeatures: unsupported } : {}),
      }]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', content: i18n.t('chatbot:errorFallback') },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [chatLoading, chatHistory]);

  return (
    <ChatContext.Provider value={{
      isOpen,
      chatHistory,
      chatLoading,
      projectContext,
      pulsing,
      previewWideLayout,
      setPreviewWideLayout: setPreviewWideLayoutFn,
      toggleChat,
      openChat,
      sendMessage,
      setProjectContext,
      clearChat,
      setPulsing,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}

export default ChatContext;
