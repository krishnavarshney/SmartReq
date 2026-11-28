import React, { useRef, useState } from 'react';
import { X } from '../icons';

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  'aria-label'?: string;
}

/** Free-form values as chips. Enter or comma adds; Backspace on an empty field removes the last; pasted lists are split. */
export const TagInput: React.FC<TagInputProps> = ({ tags, onTagsChange, placeholder = 'Type a value, press Enter', ...rest }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addTags = (values: string[]) => {
    const next = [...tags];
    values.map((v) => v.trim()).filter(Boolean).forEach((v) => {
      if (!next.includes(v)) next.push(v);
    });
    if (next.length !== tags.length) onTagsChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTags(inputValue.split(','));
      setInputValue('');
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (/[,\n\t]/.test(text)) {
      e.preventDefault();
      addTags(text.split(/[,\n\t]/));
    }
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className="flex min-h-8 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-input bg-background p-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25"
    >
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-6 max-w-full items-center gap-1 rounded bg-muted pl-2 pr-1 font-mono text-xs">
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTagsChange(tags.filter((t) => t !== tag));
            }}
            aria-label={`Remove ${tag}`}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => {
          if (inputValue.trim()) {
            addTags(inputValue.split(','));
            setInputValue('');
          }
        }}
        aria-label={rest['aria-label'] ?? 'Add value'}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="h-6 min-w-[120px] flex-1 bg-transparent px-1.5 font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/70"
      />
    </div>
  );
};
