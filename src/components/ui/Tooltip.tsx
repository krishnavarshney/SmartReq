import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'right' | 'left';
  /** Keyboard hint rendered as a kbd chip after the content. */
  shortcut?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, side = 'top', shortcut, delay = 350 }) => {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [isVisible, setIsVisible] = useState(false);

  useLayoutEffect(() => {
    if (!isVisible || !triggerRef.current || !tooltipRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const gap = 6;
    let top = 0;
    let left = 0;
    if (side === 'top' || side === 'bottom') {
      top = side === 'top' ? t.top - tip.height - gap : t.bottom + gap;
      if (top < 4) top = t.bottom + gap;
      if (top + tip.height > window.innerHeight - 4) top = t.top - tip.height - gap;
      left = t.left + t.width / 2 - tip.width / 2;
    } else {
      left = side === 'right' ? t.right + gap : t.left - tip.width - gap;
      top = t.top + t.height / 2 - tip.height / 2;
    }
    left = Math.max(4, Math.min(left, window.innerWidth - tip.width - 4));
    tooltipRef.current.style.top = `${top}px`;
    tooltipRef.current.style.left = `${left}px`;
    tooltipRef.current.style.opacity = '1';
  }, [isVisible, side]);

  if (!content) return children;

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIsVisible(true), delay);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setIsVisible(false);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={(e) => {
          // Only keyboard focus shows the tooltip; a mouse click shouldn't leave it hanging.
          const target = e.target as HTMLElement;
          if (target.matches?.(':focus-visible')) show();
        }}
        onBlur={hide}
        onMouseDown={hide}
        aria-describedby={isVisible ? id : undefined}
        className="inline-flex"
      >
        {children}
      </span>
      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            id={id}
            style={{ opacity: 0 }}
            className="pointer-events-none fixed z-[9999] flex max-w-xs items-center gap-2 rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-popover transition-opacity duration-100"
          >
            <span>{content}</span>
            {shortcut && <Kbd>{shortcut}</Kbd>}
          </div>,
          document.body
        )}
    </>
  );
};

export const Kbd: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <kbd
    className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground ${className}`}
  >
    {children}
  </kbd>
);
