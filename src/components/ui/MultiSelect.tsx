import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, X } from '../icons';
import { Checkbox } from './Checkbox';

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  'aria-label'?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ options, selected, onSelectionChange, placeholder = 'Select…', ...rest }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const toggleOption = (option: string) =>
    onSelectionChange(selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef} onKeyDown={(e) => e.key === 'Escape' && isOpen && (e.stopPropagation(), setIsOpen(false))}>
      <div className="flex min-h-8 w-full items-center gap-1 rounded-md border border-input bg-background p-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selected.length > 0 ? (
            selected.map((sel) => (
              <span key={sel} className="inline-flex h-6 items-center gap-1 rounded bg-muted pl-2 pr-1 font-mono text-xs">
                {sel}
                <button type="button" onClick={() => toggleOption(sel)} aria-label={`Remove ${sel}`} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="px-1.5 text-sm text-muted-foreground/70">{placeholder}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-label={rest['aria-label'] ?? 'Choose options'}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent focus-ring"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div id={listId} role="listbox" aria-multiselectable="true" className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-popover animate-fade-in">
          {options.length > 0 ? (
            options.map((option) => (
              <label key={option} role="option" aria-selected={selected.includes(option)} className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent">
                <Checkbox checked={selected.includes(option)} onCheckedChange={() => toggleOption(option)} />
                <span className="font-mono text-xs">{option}</span>
              </label>
            ))
          ) : (
            <div className="p-2 text-center text-xs text-muted-foreground">No options available.</div>
          )}
        </div>
      )}
    </div>
  );
};
