import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { ToastMessage } from '../types';
import { CheckCircle2, XCircle, Info, X } from './icons';

const ICONS: Record<ToastMessage['type'], { icon: React.ReactNode; className: string; label: string }> = {
  success: { icon: <CheckCircle2 />, className: 'text-success-text', label: 'Success' },
  error: { icon: <XCircle />, className: 'text-destructive-text', label: 'Error' },
  info: { icon: <Info />, className: 'text-info-text', label: 'Info' },
};

const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration ?? 0);
  const startedAt = useRef(0);

  // Auto-dismiss, pausing while the pointer or focus is on the toast.
  useEffect(() => {
    if (!toast.duration || toast.closing || paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (Date.now() - startedAt.current));
    };
  }, [toast.id, toast.duration, toast.closing, paused, onDismiss]);

  const meta = ICONS[toast.type];
  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-border bg-popover py-2.5 pl-3 pr-2 text-popover-foreground shadow-popover transition-[opacity,transform] duration-150 ${
        toast.closing ? 'opacity-0' : 'animate-slide-up-and-fade'
      }`}
    >
      <span className={`mt-px flex-shrink-0 [&_svg]:h-4 [&_svg]:w-4 ${meta.className}`} aria-hidden="true">
        {meta.icon}
      </span>
      <p className="min-w-0 flex-1 break-words text-[13px] leading-5 text-foreground">
        <span className="sr-only">{meta.label}: </span>
        {toast.message}
      </p>
      {toast.dismissible !== false && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-my-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-ring"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      // Mobile: top, full width (bottom sheets and the send bar live at the bottom). Desktop: bottom right.
      className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[9999] flex flex-col-reverse gap-2 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-auto sm:w-[360px] sm:flex-col"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </section>
  );
};
