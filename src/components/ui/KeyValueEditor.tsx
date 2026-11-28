import React, { useId, useMemo, useRef, useState } from 'react';
import { KeyValueItem } from '../../types';
import { Input } from './Input';
import { IconButton, Button } from './Button';
import { Plus, Trash2, Edit3, AlertTriangle, List } from '../icons';
import { Eye, EyeOff } from 'lucide-react';
import { Checkbox } from './Checkbox';
import { Tooltip } from './Tooltip';
import { Textarea } from './Textarea';
import { VariablePreviewInput } from './VariablePreviewInput';

interface KeyValueEditorProps {
  items: KeyValueItem[];
  onItemsChange: (items: KeyValueItem[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  keySuggestions?: string[];
  /** table: grid with an always-present empty row for quick entry. stacked: compact cards (narrow panels). */
  layout?: 'table' | 'stacked';
  /** Per-row toggle for URL-encoding the value (query params). */
  showEncodingToggle?: boolean;
  /** Offer a `key: value` text mode for pasting many rows. */
  showBulkEdit?: boolean;
  /** When given, values get `{{variable}}` highlighting and autocomplete. */
  variables?: KeyValueItem[];
  /** Optional warning per row (e.g. a header the browser refuses to send). */
  getRowWarning?: (item: KeyValueItem) => string | undefined;
  /** Label of the add button in stacked layout. */
  addLabel?: string;
  /** Accessible name for the whole editor, e.g. "Query parameters". */
  'aria-label'?: string;
  /** Mask values of rows whose key matches (stacked layout), with a reveal toggle. */
  isSecret?: (key: string) => boolean;
}

/** Default heuristic for secret-looking variable names. */
export const looksSecret = (key: string) => /token|secret|password|passwd|api[-_]?key|auth|credential|private/i.test(key);

let idCounter = 0;
/** Unique numeric ids even when many rows are created in the same millisecond. */
export const newKeyValueId = () => Date.now() * 1000 + (idCounter++ % 1000);

const isEmptyRow = (item: KeyValueItem) => !item.key && !item.value;

const toBulkText = (items: KeyValueItem[]) =>
  items
    .filter((i) => i.key || i.value)
    .map((i) => `${i.enabled ? '' : '//'}${i.key}: ${i.value}`)
    .join('\n');

/** Parse `key: value` lines (`//` prefix = disabled), reusing ids/flags of rows with the same key. */
export const parseBulkText = (text: string, previous: KeyValueItem[]): KeyValueItem[] =>
  text
    .split('\n')
    .filter((line) => line.trim())
    .map((line, index) => {
      let raw = line;
      let enabled = true;
      if (raw.trimStart().startsWith('//')) {
        enabled = false;
        raw = raw.trimStart().slice(2);
      }
      const sep = raw.indexOf(':');
      const key = (sep >= 0 ? raw.slice(0, sep) : raw).trim();
      const value = sep >= 0 ? raw.slice(sep + 1).trim() : '';
      const prev = previous.find((p) => p.key === key) ?? previous[index];
      return { id: prev?.id ?? newKeyValueId(), key, value, enabled, encode: prev?.encode ?? true };
    });

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onItemsChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  keySuggestions,
  layout = 'stacked',
  showEncodingToggle = false,
  showBulkEdit = false,
  variables,
  getRowWarning,
  addLabel = 'Add variable',
  'aria-label': ariaLabel,
  isSecret,
}) => {
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());
  const toggleReveal = (id: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const listId = useId();
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const ghostId = useRef(newKeyValueId());
  const currentLayout = layout;

  const update = (id: number, patch: Partial<KeyValueItem>) => onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id: number) => onItemsChange(items.filter((item) => item.id !== id));
  const add = () => onItemsChange([...items, { id: newKeyValueId(), key: '', value: '', enabled: true, encode: true }]);

  const createFromGhost = (patch: Partial<KeyValueItem>) => {
    const id = ghostId.current;
    ghostId.current = newKeyValueId();
    onItemsChange([...items, { id, key: '', value: '', enabled: true, encode: true, ...patch }]);
  };

  const openBulk = () => {
    setBulkText(toBulkText(items));
    setBulkMode(true);
  };

  const keyList = keySuggestions && keySuggestions.length > 0 ? `${listId}-keys` : undefined;

  // Stable React keys even if ids collide (e.g. rows built with id 0).
  const rowKeys = useMemo(() => {
    const seen = new Set<number>();
    return items.map((item, i) => {
      if (seen.has(item.id)) return `${item.id}-${i}`;
      seen.add(item.id);
      return String(item.id);
    });
  }, [items]);

  const renderValueInput = (item: KeyValueItem, onChange: (value: string) => void, className: string) =>
    variables ? (
      <VariablePreviewInput
        url={item.value}
        onUrlChange={onChange}
        globals={variables}
        showHistory={false}
        placeholder={valuePlaceholder}
        aria-label={`${item.key || 'New'} value`}
        className={`${className} !font-mono`}
        inputClassName="!px-2 !text-xs"
      />
    ) : (
      <input
        type="text"
        value={item.value}
        placeholder={valuePlaceholder}
        aria-label={`${item.key || 'New'} value`}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className={`${className} bg-transparent px-2 font-mono text-xs text-foreground outline-none placeholder:font-sans placeholder:text-muted-foreground/60`}
      />
    );

  const datalist = keyList && (
    <datalist id={keyList}>
      {keySuggestions!.map((s) => (
        <option key={s} value={s} />
      ))}
    </datalist>
  );

  if (bulkMode) {
    return (
      <div className="space-y-2" aria-label={ariaLabel}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            One <code className="font-mono text-foreground">key: value</code> per line. Prefix a line with <code className="font-mono text-foreground">//</code> to disable it.
          </p>
          <Button variant="ghost" size="xs" onClick={() => setBulkMode(false)}>
            <List /> Table
          </Button>
        </div>
        <Textarea
          value={bulkText}
          onChange={(e) => {
            setBulkText(e.target.value);
            onItemsChange(parseBulkText(e.target.value, items));
          }}
          placeholder={'Content-Type: application/json\n//X-Disabled: value'}
          spellCheck={false}
          autoFocus
          className="min-h-[180px] font-mono text-xs leading-5"
        />
      </div>
    );
  }

  if (currentLayout === 'stacked') {
    return (
      <div className="space-y-1.5" aria-label={ariaLabel} role="group">
        {items.map((item, index) => {
          const warning = getRowWarning?.(item);
          return (
            <div
              key={rowKeys[index]}
              className={`group flex items-start gap-2 rounded-md border border-border bg-background/40 p-2 transition-colors hover:border-input ${item.enabled ? '' : 'opacity-60'}`}
            >
              <Checkbox
                checked={item.enabled}
                onCheckedChange={(checked) => update(item.id, { enabled: checked })}
                aria-label={item.enabled ? 'Disable row' : 'Enable row'}
                className="mt-2"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input
                  size="sm"
                  placeholder={keyPlaceholder}
                  value={item.key}
                  onChange={(e) => update(item.id, { key: e.target.value })}
                  className="font-mono"
                  list={keyList}
                  aria-label="Key"
                  spellCheck={false}
                />
                <div className="flex items-center gap-1">
                  <Input
                    size="sm"
                    type={isSecret?.(item.key) && !revealed.has(item.id) ? 'password' : 'text'}
                    autoComplete="off"
                    placeholder={valuePlaceholder}
                    value={item.value}
                    onChange={(e) => update(item.id, { value: e.target.value })}
                    className="min-w-0 flex-1 font-mono"
                    aria-label="Value"
                    spellCheck={false}
                  />
                  {isSecret?.(item.key) && (
                    <Tooltip content={revealed.has(item.id) ? 'Hide value' : 'Show value'}>
                      <IconButton
                        size="sm"
                        onClick={() => toggleReveal(item.id)}
                        aria-label={revealed.has(item.id) ? 'Hide value' : 'Show value'}
                        aria-pressed={revealed.has(item.id)}
                      >
                        {revealed.has(item.id) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </IconButton>
                    </Tooltip>
                  )}
                  {showEncodingToggle && (
                    <Tooltip content={item.encode !== false ? 'Value is URL-encoded' : 'Value is sent as typed'}>
                      <button
                        type="button"
                        onClick={() => update(item.id, { encode: item.encode === false })}
                        aria-pressed={item.encode !== false}
                        aria-label="URL-encode value"
                        className={`h-7 flex-shrink-0 rounded-md px-1.5 font-mono text-[10px] font-semibold focus-ring ${
                          item.encode !== false ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        %20
                      </button>
                    </Tooltip>
                  )}
                </div>
                {warning && (
                  <p className="flex items-center gap-1 text-[11px] text-warning-text">
                    <AlertTriangle className="h-3 w-3" /> {warning}
                  </p>
                )}
              </div>
              <IconButton
                size="sm"
                onClick={() => remove(item.id)}
                className="text-muted-foreground hover:text-destructive-text sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                aria-label={`Delete ${item.key || 'row'}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          );
        })}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={add} className="flex-1">
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </Button>
          {showBulkEdit && (
            <Button variant="ghost" size="sm" onClick={openBulk}>
              <Edit3 className="h-3.5 w-3.5" />
              Bulk edit
            </Button>
          )}
        </div>
        {datalist}
      </div>
    );
  }

  // Table layout. An empty trailing row is always shown; typing into it creates a real row
  // with the id the ghost row was rendered with, so the focused input stays mounted.
  const lastIsEmpty = items.length > 0 && isEmptyRow(items[items.length - 1]);
  const rows: { item: KeyValueItem; key: string; ghost: boolean }[] = items.map((item, i) => ({ item, key: rowKeys[i], ghost: false }));
  if (!lastIsEmpty) {
    rows.push({ item: { id: ghostId.current, key: '', value: '', enabled: true, encode: true }, key: String(ghostId.current), ghost: true });
  }
  const gridCols = showEncodingToggle
    ? 'grid-cols-[28px_minmax(0,1fr)_minmax(0,1.5fr)_64px] sm:grid-cols-[32px_minmax(0,1fr)_minmax(0,1.5fr)_72px]'
    : 'grid-cols-[28px_minmax(0,1fr)_minmax(0,1.5fr)_40px] sm:grid-cols-[32px_minmax(0,1fr)_minmax(0,1.5fr)_56px]';

  return (
    <div className="overflow-hidden rounded-md border border-border" role="table" aria-label={ariaLabel}>
      <div role="row" className={`grid ${gridCols} h-8 items-center border-b border-border bg-muted/50 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
        <span role="columnheader">
          <span className="sr-only">Enabled</span>
        </span>
        <span role="columnheader" className="px-2">
          {keyPlaceholder}
        </span>
        <span role="columnheader" className="border-l border-border px-2">
          {valuePlaceholder}
        </span>
        <span role="columnheader" className="flex justify-end pr-1">
          {showBulkEdit && (
            <Tooltip content="Edit as text">
              <IconButton size="xs" onClick={openBulk} aria-label="Bulk edit as text">
                <Edit3 />
              </IconButton>
            </Tooltip>
          )}
        </span>
      </div>
      {rows.map(({ item, key, ghost }, index) => {
        const warning = ghost ? undefined : getRowWarning?.(item);
        const isPlaceholderRow = ghost || (index === rows.length - 1 && isEmptyRow(item));
        const set = (patch: Partial<KeyValueItem>) => (ghost ? createFromGhost(patch) : update(item.id, patch));
        return (
          <div
            key={key}
            role="row"
            className={`group grid ${gridCols} h-8 items-stretch border-b border-border last:border-b-0 focus-within:bg-accent/40 hover:bg-accent/30`}
          >
            <div role="cell" className="flex items-center justify-center">
              {!isPlaceholderRow && (
                <Checkbox checked={item.enabled} onCheckedChange={(checked) => set({ enabled: checked })} aria-label={item.enabled ? 'Disable row' : 'Enable row'} />
              )}
            </div>
            <div role="cell" className={`min-w-0 ${item.enabled ? '' : 'opacity-50'}`}>
              <input
                type="text"
                value={item.key}
                placeholder={isPlaceholderRow ? `Add ${keyPlaceholder.toLowerCase()}` : keyPlaceholder}
                aria-label={isPlaceholderRow ? `New ${keyPlaceholder.toLowerCase()}` : 'Key'}
                onChange={(e) => set({ key: e.target.value })}
                list={keyList}
                spellCheck={false}
                className={`h-full w-full bg-transparent px-2 font-mono text-xs outline-none placeholder:font-sans placeholder:text-muted-foreground/60 ${
                  warning ? 'text-warning-text' : 'text-foreground'
                }`}
              />
            </div>
            <div role="cell" className={`min-w-0 border-l border-border ${item.enabled ? '' : 'opacity-50'}`}>
              {renderValueInput(item, (value) => set({ value }), 'h-full w-full')}
            </div>
            <div role="cell" className="flex items-center justify-end gap-0.5 pr-1">
              {warning && (
                <Tooltip content={warning}>
                  <span className="flex h-6 w-6 items-center justify-center text-warning-text" aria-label={warning} role="img">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                </Tooltip>
              )}
              {showEncodingToggle && !isPlaceholderRow && (
                <Tooltip content={item.encode !== false ? 'Value is URL-encoded (click to send as typed)' : 'Value is sent as typed (click to URL-encode)'}>
                  <button
                    type="button"
                    onClick={() => set({ encode: item.encode === false })}
                    aria-pressed={item.encode !== false}
                    aria-label="URL-encode value"
                    className={`h-6 rounded px-1 font-mono text-[10px] font-semibold focus-ring ${
                      item.encode !== false ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    %20
                  </button>
                </Tooltip>
              )}
              {!isPlaceholderRow && (
                <IconButton
                  size="xs"
                  onClick={() => remove(item.id)}
                  className="text-muted-foreground opacity-0 hover:text-destructive-text focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  aria-label={`Delete ${item.key || 'row'}`}
                >
                  <Trash2 />
                </IconButton>
              )}
            </div>
          </div>
        );
      })}
      {datalist}
    </div>
  );
};
