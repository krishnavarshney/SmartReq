import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal fixed-height row windowing for long tables. Attach `containerRef` to the
 * scrolling element; render rows [start, end) between spacers of padTop/padBottom.
 */
export const useVirtualRows = (count: number, rowHeight: number, overscan = 8) => {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 800 });

  const containerRef = useCallback((node: HTMLDivElement | null) => setEl(node), []);

  useEffect(() => {
    if (!el) return;
    const measure = () =>
      setViewport((prev) =>
        prev.scrollTop === el.scrollTop && prev.height === el.clientHeight ? prev : { scrollTop: el.scrollTop, height: el.clientHeight || prev.height }
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [el]);

  const start = Math.min(count, Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan));
  const end = Math.min(count, Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + overscan);
  return {
    containerRef,
    element: el,
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
  };
};
