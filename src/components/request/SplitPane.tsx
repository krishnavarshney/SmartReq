import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical';
  /** localStorage key; the ratio is remembered per direction. */
  storageKey?: string;
  defaultRatio?: number;
  /** Minimum size of each pane in px. */
  minSize?: number;
  first: React.ReactNode;
  second: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const readRatio = (key: string | undefined, fallback: number) => {
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 && n < 1 ? n : fallback;
  } catch {
    return fallback;
  }
};

/**
 * Two panes with a draggable, keyboard-accessible divider.
 * horizontal = side by side; vertical = stacked. Double-click the divider to reset.
 */
export const SplitPane: React.FC<SplitPaneProps> = ({
  direction,
  storageKey,
  defaultRatio = 0.5,
  minSize = 220,
  first,
  second,
  className = '',
  'aria-label': ariaLabel = 'Resize panes',
}) => {
  const key = storageKey ? `${storageKey}:${direction}` : undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => readRatio(key, defaultRatio));
  const [dragging, setDragging] = useState(false);
  const horizontal = direction === 'horizontal';

  useEffect(() => {
    setRatio(readRatio(key, defaultRatio));
  }, [key, defaultRatio]);

  const persist = useCallback(
    (value: number) => {
      if (!key) return;
      try {
        window.localStorage.setItem(key, value.toFixed(4));
      } catch {
        /* storage unavailable */
      }
    },
    [key]
  );

  const limits = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const total = rect ? (horizontal ? rect.width : rect.height) : 0;
    if (!rect || total <= minSize * 2) return { rect, min: 0.15, max: 0.85 };
    return { rect, min: minSize / total, max: 1 - minSize / total };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const { rect, min, max } = limits();
    if (!rect) return;
    const pos = horizontal ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height;
    setRatio(clamp(pos, min, max));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    persist(ratio);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dec = horizontal ? 'ArrowLeft' : 'ArrowUp';
    const inc = horizontal ? 'ArrowRight' : 'ArrowDown';
    const { min, max } = limits();
    let next: number | null = null;
    if (e.key === dec) next = ratio - (e.shiftKey ? 0.1 : 0.02);
    else if (e.key === inc) next = ratio + (e.shiftKey ? 0.1 : 0.02);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'Enter') next = defaultRatio;
    if (next === null) return;
    e.preventDefault();
    next = clamp(next, min, max);
    setRatio(next);
    persist(next);
  };

  const percent = `${(ratio * 100).toFixed(2)}%`;

  return (
    <div ref={containerRef} className={`flex min-h-0 min-w-0 flex-1 ${horizontal ? 'flex-row' : 'flex-col'} ${dragging ? 'select-none' : ''} ${className}`}>
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden" style={{ flex: `0 0 ${percent}` }}>
        {first}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => {
          setRatio(defaultRatio);
          persist(defaultRatio);
        }}
        onKeyDown={onKeyDown}
        className={`group relative z-10 flex-shrink-0 touch-none outline-none ${horizontal ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'} bg-border`}
      >
        {/* Wider invisible hit area */}
        <span aria-hidden="true" className={`absolute ${horizontal ? '-left-1.5 -right-1.5 inset-y-0' : '-top-1.5 -bottom-1.5 inset-x-0'}`} />
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute transition-colors duration-150 ${horizontal ? '-left-px -right-px inset-y-0' : '-top-px -bottom-px inset-x-0'} ${
            dragging ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/60 group-focus-visible:bg-primary'
          }`}
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{second}</div>
    </div>
  );
};
