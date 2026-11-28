import React, { createContext, useState, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { ToastMessage } from '../types';
import { STORAGE_ERROR_EVENT } from '../hooks/usePersistentState';

interface ToastContextType {
  /** Oldest first. */
  toasts: ToastMessage[];
  /** duration in ms (0 keeps it until dismissed). Errors default to a longer duration. */
  addToast: (message: string, type: ToastMessage['type'], duration?: number, dismissible?: boolean) => void;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 4;
const EXIT_MS = 180;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const seq = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.map((t) => (t.id === id ? { ...t, closing: true } : t)));
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const addToast = useCallback((message: string, type: ToastMessage['type'], duration?: number, dismissible: boolean = true) => {
    const id = Date.now() * 1000 + (seq.current++ % 1000);
    const toast: ToastMessage = { id, message, type, duration: duration ?? (type === 'error' ? 6000 : 3500), dismissible };
    setToasts((current) => {
      // Same message again: replace it (restarting its timer) instead of stacking duplicates.
      const rest = current.filter((t) => !(t.message === message && t.type === type));
      const next = [...rest, toast];
      const live = next.filter((t) => !t.closing);
      if (live.length <= MAX_TOASTS) return next;
      const drop = new Set(live.slice(0, live.length - MAX_TOASTS).map((t) => t.id));
      return next.filter((t) => !drop.has(t.id));
    });
  }, []);

  useEffect(() => {
    const onStorageError = () =>
      addToast('Browser storage is full. Recent changes are kept in memory but will be lost on reload. Export your workspace from Settings.', 'error', 0);
    window.addEventListener(STORAGE_ERROR_EVENT, onStorageError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onStorageError);
  }, [addToast]);

  const value = useMemo(() => ({ toasts, addToast, dismissToast }), [toasts, addToast, dismissToast]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
