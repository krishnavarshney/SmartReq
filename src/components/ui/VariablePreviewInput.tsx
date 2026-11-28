import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { KeyValueItem } from '../../types';
import { useLog } from '../../context/LogContext';
import { DYNAMIC_VARIABLES, resolveVariable, ResolvedVariable, VariableSource } from '../../utils/interpolation';
import { History } from '../icons';

interface VariablePreviewInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size' | 'onSubmit'> {
  url: string;
  onUrlChange: (url: string) => void;
  globals: KeyValueItem[];
  dataVariables?: Record<string, string>;
  /** Called on Enter when no suggestion is highlighted. */
  onSubmit?: () => void;
  /** Called when a `curl ...` command is pasted. Return true if it was handled (the paste is then not inserted). */
  onPasteCurl?: (command: string) => boolean | Promise<boolean>;
  /** Offer previously sent URLs while typing (default true). */
  showHistory?: boolean;
  /** Extra classes for the text field itself (height, padding...). */
  inputClassName?: string;
}

const TOKEN_RE = /(\{\{[^{}]*\}\})/g;
const PATH_VAR_RE = /(\/:[A-Za-z_][\w-]*)/g;

export const VARIABLE_TONE: Record<VariableSource, string> = {
  environment: 'text-info-text bg-info-bg',
  data: 'text-warning-text bg-warning-bg',
  dynamic: 'text-primary bg-primary/10',
  unresolved: 'text-destructive-text bg-destructive-bg',
};

export const VARIABLE_SOURCE_LABEL: Record<VariableSource, string> = {
  environment: 'Environment',
  data: 'Data row',
  dynamic: 'Dynamic',
  unresolved: 'Not defined',
};

interface Segment {
  text: string;
  kind: 'text' | 'var' | 'path';
  variable?: ResolvedVariable;
}

const segmentize = (text: string, globals: KeyValueItem[], data?: Record<string, string>): Segment[] => {
  const segments: Segment[] = [];
  text.split(TOKEN_RE).forEach((part) => {
    if (!part) return;
    if (/^\{\{[^{}]*\}\}$/.test(part)) {
      segments.push({ text: part, kind: 'var', variable: resolveVariable(part.slice(2, -2), globals, data) });
      return;
    }
    // Only highlight `:param` segments in the path (before ?), never a port.
    const qIdx = part.indexOf('?');
    const pathPart = qIdx >= 0 ? part.slice(0, qIdx) : part;
    const queryPart = qIdx >= 0 ? part.slice(qIdx) : '';
    pathPart.split(PATH_VAR_RE).forEach((p) => {
      if (!p) return;
      segments.push({ text: p, kind: PATH_VAR_RE.test(p) && /^\/:/.test(p) ? 'path' : 'text' });
      PATH_VAR_RE.lastIndex = 0;
    });
    if (queryPart) segments.push({ text: queryPart, kind: 'text' });
  });
  return segments;
};

/** Find an unclosed `{{query` immediately before the caret. */
const openVariableQuery = (text: string, caret: number): { start: number; query: string } | null => {
  const before = text.slice(0, caret);
  const open = before.lastIndexOf('{{');
  if (open < 0) return null;
  const between = before.slice(open + 2);
  if (between.includes('}}') || /[\s/?&=]/.test(between)) return null;
  return { start: open, query: between };
};

type Suggestion =
  | { type: 'variable'; name: string; detail: string; source: VariableSource }
  | { type: 'history'; url: string };

/**
 * Single-line URL field with `{{variable}}` highlighting. A native <input> handles
 * editing, selection, undo and paste; a mirrored layer behind it draws the colors.
 */
export const VariablePreviewInput: React.FC<VariablePreviewInputProps> = ({
  url,
  onUrlChange,
  globals,
  dataVariables,
  placeholder,
  className = '',
  inputClassName = '',
  onSubmit,
  onPasteCurl,
  showHistory = true,
  onKeyDown,
  onBlur,
  onFocus,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();
  const { urlHistory } = useLog();

  const [menu, setMenu] = useState<{ kind: 'variable' | 'history'; query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<{ variable: ResolvedVariable; rect: DOMRect } | null>(null);

  const segments = useMemo(() => segmentize(url, globals, dataVariables), [url, globals, dataVariables]);

  const syncScroll = useCallback(() => {
    const input = inputRef.current;
    const mirror = mirrorRef.current;
    if (input && mirror) mirror.style.transform = `translateX(${-input.scrollLeft}px)`;
  }, []);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (input && pendingCaret.current !== null) {
      input.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
    syncScroll();
  }, [url, syncScroll]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!menu) return [];
    const q = menu.query.toLowerCase();
    if (menu.kind === 'variable') {
      const seen = new Set<string>();
      const items: Suggestion[] = [];
      const push = (name: string, detail: string, source: VariableSource) => {
        const key = name.toLowerCase();
        if (seen.has(key) || !key.includes(q)) return;
        seen.add(key);
        items.push({ type: 'variable', name, detail, source });
      };
      Object.entries(dataVariables || {}).forEach(([k, v]) => push(k, String(v), 'data'));
      [...globals].reverse().forEach((g) => g.enabled && g.key && push(g.key, g.value, 'environment'));
      Object.entries(DYNAMIC_VARIABLES).forEach(([k, v]) => {
        if (k !== '$randomuuid') push(k === '$isotimestamp' ? '$isoTimestamp' : k === '$randomint' ? '$randomInt' : k, v.description, 'dynamic');
      });
      return items.slice(0, 50);
    }
    if (!showHistory) return [];
    return urlHistory
      .filter((h) => h !== url && (!q || h.toLowerCase().includes(q)))
      .slice(0, 8)
      .map((h) => ({ type: 'history', url: h }) as Suggestion);
  }, [menu, globals, dataVariables, urlHistory, url, showHistory]);

  const isOpen = !!menu && suggestions.length > 0;
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // The menu is portalled so it is never clipped by scrolling/overflow-hidden parents.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 280);
      setMenuPos({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), width });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen]);

  useEffect(() => {
    setActive(menu?.kind === 'variable' ? 0 : -1);
  }, [menu?.kind, menu?.query]);

  useEffect(() => {
    if (!isOpen || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, isOpen]);

  const updateMenu = (text: string, caret: number) => {
    const open = openVariableQuery(text, caret);
    if (open) setMenu({ kind: 'variable', query: open.query, start: open.start });
    else if (showHistory && text.trim()) setMenu({ kind: 'history', query: text.trim(), start: 0 });
    else setMenu(null);
  };

  const apply = (s: Suggestion) => {
    if (s.type === 'variable' && menu?.kind === 'variable') {
      const input = inputRef.current;
      const caret = input?.selectionStart ?? url.length;
      let after = url.slice(caret);
      // Swallow an auto-typed closing `}}` right after the caret.
      if (after.startsWith('}}')) after = after.slice(2);
      const inserted = `{{${s.name}}}`;
      const next = url.slice(0, menu.start) + inserted + after;
      pendingCaret.current = menu.start + inserted.length;
      onUrlChange(next);
    } else if (s.type === 'history') {
      pendingCaret.current = s.url.length;
      onUrlChange(s.url);
    }
    setMenu(null);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[\r\n]+/g, '');
    onUrlChange(value);
    updateMenu(value, e.target.selectionStart ?? value.length);
    setHovered(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        return;
      }
      if ((e.key === 'Enter' || (e.key === 'Tab' && menu?.kind === 'variable')) && active >= 0 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        apply(suggestions[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMenu(null);
        return;
      }
    } else if (e.key === 'ArrowDown' && showHistory && urlHistory.length > 0) {
      e.preventDefault();
      setMenu({ kind: 'history', query: '', start: 0 });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      setMenu(null);
      // Ctrl/Cmd+Enter is handled by the global shortcut; avoid sending twice.
      if (!e.metaKey && !e.ctrlKey) onSubmit?.();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    const input = inputRef.current;
    const start = input?.selectionStart ?? url.length;
    const end = input?.selectionEnd ?? url.length;
    const isCurl = /^\s*curl\s/i.test(text);
    // Plain single-line text: let the browser insert it (keeps native undo).
    if (!isCurl && !/[\r\n]/.test(text)) return;
    e.preventDefault();
    if (isCurl && onPasteCurl && (await onPasteCurl(text.trim()))) return;
    let clean = text.replace(/\s*\\?\r?\n\s*/g, isCurl ? ' ' : '');
    if (url === '' || (start === 0 && end === url.length)) clean = clean.trim();
    pendingCaret.current = start + clean.length;
    onUrlChange(url.slice(0, start) + clean + url.slice(end));
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    const tokens = mirror.querySelectorAll<HTMLElement>('[data-var-index]');
    for (const el of Array.from(tokens)) {
      const rect = el.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top - 4 && e.clientY <= rect.bottom + 4) {
        const seg = segments[Number(el.dataset.varIndex)];
        if (seg?.variable) {
          if (hovered?.variable.name !== seg.variable.name || hovered.rect.left !== rect.left) setHovered({ variable: seg.variable, rect });
          return;
        }
      }
    }
    if (hovered) setHovered(null);
  };

  return (
    <div ref={wrapperRef} className={`relative min-w-0 ${className}`}>
      <div className="relative h-full w-full overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-2.5 font-mono text-[13px]">
          <span ref={mirrorRef} className="whitespace-pre text-foreground will-change-transform">
            {segments.map((seg, i) =>
              seg.kind === 'var' && seg.variable ? (
                <span key={i} data-var-index={i} className={`rounded-[3px] ${VARIABLE_TONE[seg.variable.source]}`}>
                  {seg.text}
                </span>
              ) : seg.kind === 'path' ? (
                <span key={i} className="text-primary">
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={url}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onScroll={syncScroll}
          onSelect={syncScroll}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
          onFocus={(e) => {
            onFocus?.(e);
            syncScroll();
          }}
          onBlur={(e) => {
            onBlur?.(e);
            setMenu(null);
            setHovered(null);
          }}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          aria-activedescendant={isOpen && active >= 0 ? `${listId}-${active}` : undefined}
          className={`relative block h-full w-full bg-transparent px-2.5 font-mono text-[13px] text-transparent caret-foreground outline-none selection:bg-primary/30 selection:text-transparent placeholder:font-sans placeholder:text-muted-foreground/70 ${inputClassName}`}
          {...props}
        />
      </div>

      {isOpen && menuPos && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          className="fixed z-[70] max-h-72 overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-popover animate-fade-in"
        >
          <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {menu?.kind === 'variable' ? 'Variables' : 'Recent URLs'}
          </div>
          {suggestions.map((s, i) => (
            <div
              key={s.type === 'variable' ? `v-${s.name}` : `h-${s.url}`}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => apply(s)}
              className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${i === active ? 'bg-accent text-accent-foreground' : ''}`}
            >
              {s.type === 'variable' ? (
                <>
                  <span className={`rounded-[3px] px-1 font-mono text-xs ${VARIABLE_TONE[s.source]}`}>{s.name}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{s.detail}</span>
                  <span className="flex-shrink-0 text-[11px] text-muted-foreground">{VARIABLE_SOURCE_LABEL[s.source]}</span>
                </>
              ) : (
                <>
                  <History className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{s.url}</span>
                </>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}

      {hovered &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: hovered.rect.bottom + 8, left: Math.max(8, Math.min(hovered.rect.left, window.innerWidth - 328)) }}
            className="pointer-events-none fixed z-[9999] w-max max-w-[320px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-popover animate-fade-in"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono font-medium">{hovered.variable.name}</span>
              <span className={`rounded px-1.5 py-px text-[10px] font-medium ${VARIABLE_TONE[hovered.variable.source]}`}>
                {VARIABLE_SOURCE_LABEL[hovered.variable.source]}
              </span>
            </div>
            <div className="mt-1 break-all font-mono text-muted-foreground">
              {hovered.variable.source === 'unresolved'
                ? 'Not set in the active environment or globals.'
                : hovered.variable.value === ''
                  ? '(empty)'
                  : hovered.variable.value}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
