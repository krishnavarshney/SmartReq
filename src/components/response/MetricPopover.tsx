import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface MetricPopoverProps {
  /** Trigger content (rendered inside a button). */
  children: React.ReactNode;
  content: React.ReactNode;
  label: string;
  className?: string;
}

/**
 * Small hover/focus card for status bar metrics (time, size). Unlike Tooltip
 * it keeps rich content and stays open while the pointer is over it.
 */
export const MetricPopover: React.FC<MetricPopoverProps> = ({ children, content, label, className = '' }) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), 120);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !cardRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const c = cardRef.current.getBoundingClientRect();
    let top = t.bottom + 6;
    if (top + c.height > window.innerHeight - 8) top = t.top - c.height - 6;
    let left = t.left + t.width / 2 - c.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - c.width - 8));
    cardRef.current.style.top = `${top}px`;
    cardRef.current.style.left = `${left}px`;
    cardRef.current.style.opacity = '1';
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground focus-ring ${className}`}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            ref={cardRef}
            id={id}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{ opacity: 0, top: 0, left: 0 }}
            className="fixed z-[70] w-80 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-popover transition-opacity duration-100"
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
};
