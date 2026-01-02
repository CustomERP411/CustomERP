import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs?: number;
}

interface ToastContextValue {
  toast: (msg: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(16).slice(2);
    const durationMs = msg.durationMs ?? 3500;
    const toastMsg: ToastMessage = { id, durationMs, ...msg };
    setToasts((prev) => [...prev, toastMsg]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] space-y-2 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'w-[320px] rounded-lg border shadow-lg bg-white p-3',
              t.variant === 'success' ? 'border-emerald-200' : '',
              t.variant === 'error' ? 'border-red-200' : '',
              t.variant === 'info' ? 'border-blue-200' : '',
              t.variant === 'warning' ? 'border-amber-200' : '',
            ].join(' ')}
          >
            <div className="text-sm font-semibold text-slate-900">{t.title}</div>
            {t.description ? (
              <div className="mt-1 text-sm text-slate-600">{t.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}


