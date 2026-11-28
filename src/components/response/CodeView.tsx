import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from '../icons';
import { Button } from '../ui/Button';
import { CodeLine, CodeToken, lineText } from './utils';

export interface SearchResults {
  count: number;
  error: string | null;
  /** True when matching stopped at MAX_MATCHES. */
  capped?: boolean;
}

export interface FoldCommand {
  type: 'expand' | 'collapse';
  nonce: number;
}

interface CodeViewProps {
  lines: CodeLine[];
  wrap: boolean;
  /** Show fold toggles for lines that have a foldEnd. */
  foldable?: boolean;
  searchTerm?: string;
  isRegex?: boolean;
  activeMatchIndex?: number;
  onSearchResults?: (results: SearchResults) => void;
  foldCommand?: FoldCommand;
  /** Lines rendered before "Show more" kicks in. Keeps huge bodies from freezing the tab. */
  initialLimit?: number;
  className?: string;
  ariaLabel?: string;
}

interface Match {
  line: number;
  start: number;
  end: number;
  idx: number;
}

const MAX_MATCHES = 10000;
const CHUNK = 100;
const DEFAULT_LIMIT = 2000;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderPlain = (tokens: CodeToken[]) =>
  tokens.map((t, i) =>
    t.cls ? (
      <span key={i} className={t.cls}>
        {t.text}
      </span>
    ) : (
      <React.Fragment key={i}>{t.text}</React.Fragment>
    )
  );

const renderHighlighted = (tokens: CodeToken[], ranges: Match[] | undefined, active: number) => {
  if (!ranges || ranges.length === 0) return renderPlain(tokens);
  const out: React.ReactNode[] = [];
  let pos = 0;
  let r = 0;
  tokens.forEach((t, ti) => {
    const tStart = pos;
    const tEnd = pos + t.text.length;
    let cur = tStart;
    const parts: React.ReactNode[] = [];
    while (r < ranges.length && ranges[r].start < tEnd) {
      const rg = ranges[r];
      const s = Math.max(rg.start, cur);
      const e = Math.min(rg.end, tEnd);
      if (s > cur) parts.push(t.text.slice(cur - tStart, s - tStart));
      if (e > s) {
        parts.push(
          <mark key={`${ti}-${rg.idx}-${s}`} className={rg.idx === active ? 'active-match' : undefined} data-match={rg.idx}>
            {t.text.slice(s - tStart, e - tStart)}
          </mark>
        );
      }
      cur = Math.max(cur, e);
      if (rg.end <= tEnd) r++;
      else break;
    }
    if (cur < tEnd) parts.push(t.text.slice(cur - tStart));
    out.push(
      <span key={ti} className={t.cls}>
        {parts}
      </span>
    );
    pos = tEnd;
  });
  return out;
};

interface RowProps {
  line: CodeLine;
  index: number;
  isCollapsed: boolean;
  matches?: Match[];
  active: number;
  wrap: boolean;
  foldable: boolean;
  gutterCh: number;
  onToggle: (index: number) => void;
}

const Row = memo(({ line, index, isCollapsed, matches, active, wrap, foldable, gutterCh, onToggle }: RowProps) => {
  const canFold = foldable && line.foldEnd !== undefined;
  return (
    <div className="group/row flex hover:bg-accent/40">
      <span
        aria-hidden="true"
        className="sticky left-0 z-[1] shrink-0 select-none bg-card pl-3 pr-2 text-right tabular-nums text-muted-foreground/50 group-hover/row:text-muted-foreground"
        style={{ width: `calc(${gutterCh}ch + 1.25rem)` }}
      >
        {index + 1}
      </span>
      {foldable && (
        <span className="flex w-4 shrink-0 select-none items-start justify-center pt-[3px]">
          {canFold && (
            <button
              type="button"
              tabIndex={-1}
              aria-label={isCollapsed ? 'Expand' : 'Collapse'}
              aria-expanded={!isCollapsed}
              onClick={() => onToggle(index)}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-sm text-muted-foreground/70 hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className={`h-3 w-3 transition-transform duration-100 ${isCollapsed ? '' : 'rotate-90'}`} />
            </button>
          )}
        </span>
      )}
      <span
        className={`min-w-0 flex-1 pr-4 ${wrap ? 'whitespace-pre-wrap [overflow-wrap:anywhere]' : 'whitespace-pre'}`}
        style={line.depth ? { paddingLeft: `${line.depth * 2}ch` } : undefined}
      >
        {renderHighlighted(line.tokens, matches, active)}
        {canFold && isCollapsed && (
          <>
            <button
              type="button"
              tabIndex={-1}
              onClick={() => onToggle(index)}
              className="mx-1 select-none rounded bg-muted px-1.5 align-baseline font-sans text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {line.foldLabel}
            </button>
            {renderPlain(line.foldClose ?? [])}
          </>
        )}
        {line.tokens.length === 0 && !isCollapsed && '​'}
      </span>
    </div>
  );
});
Row.displayName = 'CodeRow';

/**
 * Line-based code viewer: line numbers stay aligned when wrapping, JSON nodes
 * fold, search highlights inline, and only `initialLimit` lines are rendered
 * until the user asks for more.
 */
export const CodeView: React.FC<CodeViewProps> = ({
  lines,
  wrap,
  foldable = false,
  searchTerm = '',
  isRegex = false,
  activeMatchIndex = -1,
  onSearchResults,
  foldCommand,
  initialLimit = DEFAULT_LIMIT,
  className = '',
  ariaLabel = 'Response body',
}) => {
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());
  const [limit, setLimit] = useState(initialLimit);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingReveal = useRef<number | null>(null);
  const [revealTick, setRevealTick] = useState(0);

  // New content: reset folds and render budget.
  useEffect(() => {
    setCollapsed(new Set());
    setLimit(initialLimit);
    scrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [lines, initialLimit]);

  useEffect(() => {
    if (!foldCommand) return;
    if (foldCommand.type === 'expand') setCollapsed(new Set());
    else {
      const next = new Set<number>();
      lines.forEach((l, i) => {
        if (l.foldEnd !== undefined && l.depth >= 1) next.add(i);
      });
      setCollapsed(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foldCommand?.nonce]);

  const visible = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < lines.length; ) {
      out.push(i);
      const end = lines[i].foldEnd;
      i = end !== undefined && collapsed.has(i) ? end + 1 : i + 1;
    }
    return out;
  }, [lines, collapsed]);

  const search = useMemo(() => {
    const empty = { list: [] as Match[], byLine: new Map<number, Match[]>(), error: null as string | null, capped: false };
    if (!searchTerm) return empty;
    let re: RegExp;
    try {
      re = new RegExp(isRegex ? searchTerm : escapeRegExp(searchTerm), 'gi');
    } catch (e: any) {
      return { ...empty, error: `Invalid regular expression: ${e.message}` };
    }
    const list: Match[] = [];
    const byLine = new Map<number, Match[]>();
    let capped = false;
    outer: for (let i = 0; i < lines.length; i++) {
      const text = lineText(lines[i]);
      if (!text) continue;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (m[0].length === 0) {
          re.lastIndex++;
          continue;
        }
        const match = { line: i, start: m.index, end: m.index + m[0].length, idx: list.length };
        list.push(match);
        const arr = byLine.get(i);
        if (arr) arr.push(match);
        else byLine.set(i, [match]);
        if (list.length >= MAX_MATCHES) {
          capped = true;
          break outer;
        }
      }
    }
    return { list, byLine, error: null, capped };
  }, [lines, searchTerm, isRegex]);

  useEffect(() => {
    onSearchResults?.({ count: search.list.length, error: search.error, capped: search.capped });
  }, [search, onSearchResults]);

  // Bring the active match into view: unfold its ancestors, extend the render budget, scroll.
  useEffect(() => {
    const m = search.list[activeMatchIndex];
    if (!m) return;
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      prev.forEach((o) => {
        const end = lines[o]?.foldEnd;
        if (end !== undefined && o < m.line && m.line <= end) {
          next.delete(o);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    pendingReveal.current = m.line;
    // Force a render so the layout effect below can scroll even when nothing else changed.
    setRevealTick((t) => t + 1);
  }, [activeMatchIndex, search, lines]);

  useLayoutEffect(() => {
    const line = pendingReveal.current;
    if (line === null) return;
    const pos = visible.indexOf(line);
    if (pos === -1) return;
    if (pos >= limit) {
      setLimit(pos + 200);
      return;
    }
    pendingReveal.current = null;
    const container = scrollRef.current;
    const el = container?.querySelector<HTMLElement>('mark.active-match');
    if (!container || !el) return;
    const c = container.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (r.top < c.top + 24 || r.bottom > c.bottom - 24) container.scrollTop += r.top - c.top - c.height / 2;
    if (!wrap && (r.left < c.left + 60 || r.right > c.right - 20)) container.scrollLeft += r.left - c.left - c.width / 2;
  }, [revealTick, visible, limit, wrap]);

  const onToggle = useCallback((index: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const gutterCh = String(lines.length).length;
  const shown = visible.length > limit ? visible.slice(0, limit) : visible;
  const activeLine = search.list[activeMatchIndex]?.line;

  const chunks: number[][] = [];
  for (let i = 0; i < shown.length; i += CHUNK) chunks.push(shown.slice(i, i + CHUNK));

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
      className={`relative h-full min-h-0 overflow-auto py-2 font-mono text-[12px] leading-5 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/50 ${className}`}
    >
      <div className={wrap ? 'w-full' : 'w-max min-w-full'}>
        {chunks.map((chunk, ci) => (
          <div key={ci} style={ci > 0 ? { contentVisibility: 'auto', containIntrinsicSize: `auto ${CHUNK * 20}px` } : undefined}>
            {chunk.map((i) => (
              <Row
                key={i}
                line={lines[i]}
                index={i}
                isCollapsed={collapsed.has(i)}
                matches={search.byLine.get(i)}
                active={activeLine === i ? activeMatchIndex : -1}
                wrap={wrap}
                foldable={foldable}
                gutterCh={gutterCh}
                onToggle={onToggle}
              />
            ))}
          </div>
        ))}
      </div>
      {visible.length > limit && (
        <div className="sticky left-0 mx-3 mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-muted/50 px-3 py-2 font-sans text-xs text-muted-foreground">
          <span className="mr-auto">
            Showing {limit.toLocaleString()} of {visible.length.toLocaleString()} lines to keep the tab responsive.
          </span>
          <span className="flex items-center gap-1">
          <Button size="xs" variant="secondary" onClick={() => setLimit((l) => l + 10000)}>
            Show {Math.min(10000, visible.length - limit).toLocaleString()} more
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setLimit(Number.MAX_SAFE_INTEGER)}>
            Show all
          </Button>
          </span>
        </div>
      )}
    </div>
  );
};
