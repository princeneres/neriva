'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { id, kind, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const apiValue = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={apiValue}>
      {children}
      <div className="nv-toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="nv-toast" data-kind={toast.kind}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return value;
}
