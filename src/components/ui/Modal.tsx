import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '../icons';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full';

interface ModalProps {
  show: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: ModalSize;
  /** When provided, a standard header with title and close button is rendered. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional icon shown left of the title. */
  icon?: React.ReactNode;
  /** Right-aligned footer, typically action buttons. */
  footer?: React.ReactNode;
  /** Remove body padding (for content that manages its own, like editors). */
  flush?: boolean;
  className?: string;
  /** Prevent closing on backdrop click / Escape (e.g. while saving). */
  dismissible?: boolean;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-[min(1400px,calc(100vw-2rem))]',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

// Track stacked modals so only the top one reacts to Escape.
const modalStack: string[] = [];

export const Modal: React.FC<ModalProps> = ({
  show,
  onClose,
  children,
  size = 'md',
  title,
  description,
  icon,
  footer,
  flush = false,
  className = '',
  dismissible = true,
}) => {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!show) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalStack.push(id);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first meaningful control, falling back to the panel itself.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const autofocus = panel.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      const first = autofocus ?? panel.querySelector<HTMLElement>(`[data-modal-body] ${FOCUSABLE}`) ?? panel;
      first.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== id) return;
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (n) => n.offsetParent !== null || n === document.activeElement
        );
        if (nodes.length === 0) {
          event.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown, true);
      const idx = modalStack.lastIndexOf(id);
      if (idx >= 0) modalStack.splice(idx, 1);
      if (modalStack.length === 0) document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [show, id, dismissible]);

  if (!show) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/50 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative flex w-full max-h-[92vh] sm:max-h-[min(860px,calc(100vh-3rem))] flex-col overflow-hidden bg-popover text-popover-foreground border border-border rounded-t-xl sm:rounded-xl elev-3 animate-scale-in outline-none ${SIZE_CLASSES[size]} ${className}`}
      >
        {title ? (
          <>
            <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-border flex-shrink-0">
              {icon && <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">{icon}</div>}
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-[15px] font-semibold leading-6 text-foreground">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-0.5 text-[13px] text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              {dismissible && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="-mr-1.5 -mt-0.5 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div data-modal-body className={`min-h-0 flex-1 overflow-auto ${flush ? '' : 'px-5 py-4'}`}>
              {children}
            </div>
            {footer && (
              <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-card/50 px-5 py-3">
                {footer}
              </div>
            )}
          </>
        ) : (
          <div data-modal-body className={`min-h-0 flex-1 overflow-auto ${flush ? '' : 'p-5'}`}>
            {children}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

interface ConfirmDialogProps {
  show: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Replacement for window.confirm. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  show,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => (
  <Modal show={show} onClose={onCancel} size="sm" title={title}>
    {description && <div className="text-sm text-muted-foreground">{description}</div>}
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="h-8 rounded-md border border-border bg-secondary px-3 text-sm font-medium text-secondary-foreground hover:bg-accent focus-ring"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        data-autofocus
        onClick={onConfirm}
        className={`h-8 rounded-md px-3 text-sm font-medium focus-ring ${
          destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  </Modal>
);
