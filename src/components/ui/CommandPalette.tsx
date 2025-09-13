import React, { useEffect, useMemo, useState } from 'react';

export interface CommandItem {
  id: string;
  title: string;
  shortcut?: string;
  group?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, items }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          onClose();
          item.action();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, activeIndex]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.title.toLowerCase().includes(q) || (i.group && i.group.toLowerCase().includes(q))
    );
  }, [query, items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-24 bg-background/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-xl glass-surface elev-3 rounded-lg p-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <span className="hidden sm:inline text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5">Esc</span>
        </div>
        <div className="max-h-80 overflow-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No results</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm ${idx === activeIndex ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'} transition-colors`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => { onClose(); item.action(); }}
              >
                <div className="flex items-center gap-2">
                  {item.group && <span className="text-xs text-muted-foreground">{item.group}</span>}
                  <span className="text-foreground">{item.title}</span>
                </div>
                {item.shortcut && (
                  <span className="text-[10px] text-muted-foreground border border-border rounded px-1 py-0.5">{item.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};


