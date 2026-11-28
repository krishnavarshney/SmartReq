import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { Kbd } from './Tooltip';

export interface CommandItem {
  id: string;
  title: string;
  shortcut?: string;
  group?: string;
  icon?: React.ReactNode;
  /** Extra search terms not shown in the UI. */
  keywords?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

const MAX_PER_GROUP = 50;

/** Higher is better; 0 means no match. */
const score = (item: CommandItem, q: string): number => {
  if (!q) return 1;
  const title = item.title.toLowerCase();
  if (title === q) return 100;
  if (title.startsWith(q)) return 80;
  if (title.split(/[\s/:._-]+/).some((w) => w.startsWith(q))) return 60;
  if (title.includes(q)) return 40;
  const rest = `${item.group ?? ''} ${item.keywords ?? ''}`.toLowerCase();
  if (rest.includes(q)) return 20;
  // All words present somewhere (e.g. "get user").
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => `${title} ${rest}`.includes(w))) return 10;
  return 0;
};

const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const idx = query ? text.toLowerCase().indexOf(query) : -1;
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
};

/** State lives in the inner component, so every opening starts fresh. */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, items }) =>
  open ? <PaletteDialog onClose={onClose} items={items} /> : null;

const PaletteDialog: React.FC<Omit<CommandPaletteProps, 'open'>> = ({ onClose, items }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const scored = items.map((item, order) => ({ item, order, s: score(item, q) })).filter((x) => x.s > 0);
    if (q) scored.sort((a, b) => b.s - a.s || a.order - b.order);
    const map = new Map<string, CommandItem[]>();
    for (const { item } of scored) {
      const g = item.group ?? 'Commands';
      const list = map.get(g) ?? [];
      if (list.length < MAX_PER_GROUP) list.push(item);
      map.set(g, list);
    }
    return [...map.entries()].map(([name, list]) => ({ name, items: list }));
  }, [items, q]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => setActiveIndex(0), [q]);

  // Focus on open and restore focus on close, like a modal.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const run = (item: CommandItem | undefined) => {
    if (!item) return;
    onClose();
    // Let the palette unmount and restore focus before the action moves it.
    requestAnimationFrame(() => item.action());
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    } else if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'PageDown' || e.key === 'End') {
      e.preventDefault();
      setActiveIndex((i) => (e.key === 'End' ? flat.length - 1 : Math.min(i + 8, flat.length - 1)));
    } else if (e.key === 'PageUp' || e.key === 'Home') {
      e.preventDefault();
      setActiveIndex((i) => (e.key === 'Home' ? 0 : Math.max(i - 8, 0)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(flat[activeIndex]);
    } else if (e.key === 'Tab') {
      e.preventDefault(); // keep focus in the palette
    }
  };

  const listboxId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  let index = -1;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-3 pt-[12vh] animate-fade-in sm:px-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="flex max-h-[min(560px,72vh)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground elev-3 animate-scale-in"
      >
        <div className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-border px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search requests, commands and settings…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={flat.length ? optionId(activeIndex) : undefined}
            aria-autocomplete="list"
            spellCheck={false}
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Kbd className="hidden sm:inline-flex">Esc</Kbd>
        </div>

        <div ref={listRef} id={listboxId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {flat.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <p className="text-sm text-foreground">No results for “{query.trim()}”</p>
              <p className="text-xs text-muted-foreground">Try a request name, a URL fragment, or a command like “import”.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.name} role="group" aria-labelledby={`${baseId}-g-${group.name}`} className="mb-1 last:mb-0">
                <div id={`${baseId}-g-${group.name}`} className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </div>
                {group.items.map((item) => {
                  index += 1;
                  const i = index;
                  const active = i === activeIndex;
                  return (
                    <div
                      key={item.id}
                      id={optionId(i)}
                      role="option"
                      aria-selected={active}
                      data-index={i}
                      onMouseMove={() => !active && setActiveIndex(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => run(item)}
                      className={`flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] ${
                        active ? 'bg-accent text-foreground' : 'text-foreground/90'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 ${active ? 'text-foreground' : 'text-muted-foreground'}`}
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <Highlight text={item.title} query={q} />
                      </span>
                      {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                      {active && !item.shortcut && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden h-9 flex-shrink-0 items-center gap-4 border-t border-border bg-card/50 px-4 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <Kbd>
              <ArrowUp className="h-3 w-3" />
            </Kbd>
            <Kbd>
              <ArrowDown className="h-3 w-3" />
            </Kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="h-3 w-3" />
            </Kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Esc</Kbd>
            close
          </span>
          <span className="ml-auto tabular-nums">
            {flat.length} result{flat.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};
