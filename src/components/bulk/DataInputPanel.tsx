import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Braces,
  CheckCircle2,
  ClipboardPaste,
  Columns3,
  Download,
  Ellipsis,
  Globe,
  Pencil,
  Plus,
  Rows3,
  Table2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button, IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { Textarea } from '../ui/Textarea';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/Modal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { useToast } from '../../context/ToastContext';
import { collectColumns, DataRow, downloadCsv, normalizeRows, parseTabularText, VariableCheck } from './bulkUtils';
import { useVirtualRows } from './useVirtualRows';

interface DataInputPanelProps {
  data: DataRow[];
  onDataChange: (data: DataRow[]) => void;
  /** Template variable analysis; used to mark referenced columns and offer missing ones. */
  variableCheck?: VariableCheck;
  /** Hide the panel's own header title (e.g. when a parent tab already labels it). */
  compactHeader?: boolean;
}

type Notice = { tone: 'error' | 'warning'; title: string; details?: string[] };

const ROW_HEIGHT = 32;
const COL_WIDTH = 168;
const INDEX_WIDTH = 48;
const ACTION_WIDTH = 40;

export const DataInputPanel: React.FC<DataInputPanelProps> = ({ data, onDataChange, variableCheck, compactHeader }) => {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<'grid' | 'paste'>('grid');
  const [pasteText, setPasteText] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'clear' } | { kind: 'column'; column: string }>(null);
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);

  const columns = useMemo(() => collectColumns(data), [data]);
  const { containerRef, start, end, padTop, padBottom, element: scroller } = useVirtualRows(data.length, ROW_HEIGHT);
  const setGridRef = useCallback(
    (node: HTMLDivElement | null) => {
      gridRef.current = node;
      containerRef(node);
    },
    [containerRef]
  );

  const pastePreview = useMemo(() => (pasteText.trim() ? parseTabularText(pasteText) : null), [pasteText]);

  // Move focus to a cell once it has been rendered (after add-row / Enter navigation).
  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || !gridRef.current) return;
    const el = gridRef.current.querySelector<HTMLInputElement>(`[data-cell="${target.row}:${target.col}"]`);
    if (el) {
      pendingFocus.current = null;
      el.focus();
      el.select();
    }
  });

  /* ---------------------------- import ---------------------------- */

  const applyImport = (text: string, source: string): boolean => {
    const outcome = parseTabularText(text);
    if (outcome.error) {
      setNotice({ tone: 'error', title: `Could not import ${source}`, details: [outcome.error] });
      return false;
    }
    onDataChange(outcome.rows);
    setNotice(outcome.warnings.length ? { tone: 'warning', title: `Imported ${outcome.rows.length} rows from ${source} with warnings`, details: outcome.warnings } : null);
    addToast(`Loaded ${outcome.rows.length} row${outcome.rows.length === 1 ? '' : 's'} (${outcome.columns.length} column${outcome.columns.length === 1 ? '' : 's'}) from ${source}`, 'success');
    scroller?.scrollTo({ top: 0 });
    return true;
  };

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!/\.(csv|tsv|txt|json)$/.test(name) && !/(csv|json|text)/.test(file.type)) {
      setNotice({ tone: 'error', title: `Unsupported file: ${file.name}`, details: ['Use a .csv, .tsv or .json file.'] });
      return;
    }
    try {
      const text = await file.text();
      if (applyImport(text, file.name)) setMode('grid');
    } catch (e) {
      setNotice({ tone: 'error', title: `Could not read ${file.name}`, details: [e instanceof Error ? e.message : String(e)] });
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const dragHasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragOver = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDraggingFile(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDraggingFile(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const submitPaste = () => {
    if (applyImport(pasteText, 'pasted data')) {
      setPasteText('');
      setMode('grid');
    }
  };

  /* ----------------------------- edits ---------------------------- */

  const setCell = (rowIndex: number, column: string, value: string) => {
    const next = data.slice();
    next[rowIndex] = { ...next[rowIndex], [column]: value };
    onDataChange(next);
  };

  const addRow = () => {
    const cols = columns.length ? columns : ['value'];
    const row: DataRow = Object.fromEntries(cols.map((c) => [c, '']));
    onDataChange([...data, row]);
    pendingFocus.current = { row: data.length, col: 0 };
    requestAnimationFrame(() => gridRef.current?.scrollTo({ top: gridRef.current.scrollHeight }));
  };

  const deleteRow = (rowIndex: number) => onDataChange(data.filter((_, i) => i !== rowIndex));

  const addColumns = (names: string[]) => {
    const fresh = names.map((n) => n.trim()).filter((n) => n && !columns.some((c) => c.toLowerCase() === n.toLowerCase()));
    if (fresh.length === 0) return false;
    const order = [...columns, ...fresh];
    const rows = data.length ? data : [{}];
    onDataChange(normalizeRows(rows, order));
    return true;
  };

  const commitNewColumn = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNewColumn(null);
      return;
    }
    if (columns.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      addToast(`Column "${trimmed}" already exists.`, 'error');
      return;
    }
    addColumns([trimmed]);
    setNewColumn(null);
  };

  const renameColumn = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    setEditingColumn(null);
    if (!trimmed || trimmed === oldName) return;
    if (columns.some((c) => c !== oldName && c.toLowerCase() === trimmed.toLowerCase())) {
      addToast(`Column "${trimmed}" already exists.`, 'error');
      return;
    }
    onDataChange(
      data.map((row) => {
        const out: DataRow = {};
        for (const c of columns) out[c === oldName ? trimmed : c] = row[c] ?? '';
        return out;
      })
    );
  };

  const moveColumn = (column: string, toIndex: number) => {
    const from = columns.indexOf(column);
    if (from < 0 || toIndex < 0 || toIndex >= columns.length || from === toIndex) return;
    const order = columns.slice();
    order.splice(from, 1);
    order.splice(toIndex, 0, column);
    onDataChange(normalizeRows(data, order));
  };

  const deleteColumn = (column: string) => {
    const order = columns.filter((c) => c !== column);
    onDataChange(order.length ? normalizeRows(data, order) : []);
  };

  const onCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = e.shiftKey ? row - 1 : row + 1;
      if (nextRow < 0) return;
      if (nextRow >= data.length) {
        addRow();
        pendingFocus.current = { row: nextRow, col };
        return;
      }
      const el = gridRef.current?.querySelector<HTMLInputElement>(`[data-cell="${nextRow}:${col}"]`);
      el?.focus();
      el?.select();
    }
  };

  /* ---------------------------- render ---------------------------- */

  const usedColumns = variableCheck?.usedColumns;
  const missing = variableCheck?.missing ?? [];
  const tableWidth = INDEX_WIDTH + columns.length * COL_WIDTH + ACTION_WIDTH;

  const header = (
    <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border px-3">
      {!compactHeader && (
        <>
          <StepBadge n={1} />
          <h2 className="text-[13px] font-semibold text-foreground">Data</h2>
        </>
      )}
      {data.length > 0 && (
        <span className="truncate text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{data.length.toLocaleString()}</span> row{data.length === 1 ? '' : 's'} ·{' '}
          <span className="font-mono tabular-nums">{columns.length}</span> col{columns.length === 1 ? '' : 's'}
        </span>
      )}
      <div className="ml-auto flex items-center gap-0.5">
        <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.tsv,.txt,.json,text/csv,application/json" onChange={onFileInput} tabIndex={-1} />
        <Tooltip content="Upload CSV or JSON">
          <IconButton size="sm" variant="ghost" className="max-lg:!h-8 max-lg:!w-8" aria-label="Upload CSV or JSON file" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip content="Paste CSV or JSON">
          <IconButton
            size="sm"
            variant={mode === 'paste' ? 'secondary' : 'ghost'}
            className="max-lg:!h-8 max-lg:!w-8"
            aria-label="Paste CSV or JSON"
            aria-pressed={mode === 'paste'}
            onClick={() => setMode(mode === 'paste' ? 'grid' : 'paste')}
          >
            <ClipboardPaste className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        {data.length > 0 && mode === 'grid' && (
          <Tooltip content="Add row">
            <IconButton size="sm" variant="ghost" className="max-lg:!h-8 max-lg:!w-8" aria-label="Add row" onClick={addRow}>
              <Plus className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        )}
        <DropdownMenu>
          <Tooltip content="More">
            <DropdownMenuTrigger asChild>
              <IconButton size="sm" variant="ghost" className="max-lg:!h-8 max-lg:!w-8" aria-label="More data actions">
                <Ellipsis className="h-4 w-4" />
              </IconButton>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="w-52">
            <DropdownMenuItem onClick={addRow}>
              <Rows3 /> Add row
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setMode('grid');
                setNewColumn('');
              }}
            >
              <Columns3 /> Add column
            </DropdownMenuItem>
            <DropdownMenuItem disabled={data.length === 0} onClick={() => downloadCsv(data, 'bulk-data.csv')}>
              <Download /> Download as CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={data.length === 0} onClick={() => setConfirm({ kind: 'clear' })}>
              <Trash2 /> Clear all data
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const noticeBanner = notice && (
    <div
      role={notice.tone === 'error' ? 'alert' : 'status'}
      className={`mx-3 mt-3 flex flex-shrink-0 items-start gap-2 rounded-md px-3 py-2 text-xs ${
        notice.tone === 'error' ? 'bg-destructive-bg text-destructive-text' : 'bg-warning-bg text-warning-text'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{notice.title}</p>
        {notice.details?.map((d, i) => (
          <p key={i} className="mt-0.5 break-words opacity-90">
            {d}
          </p>
        ))}
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="-mr-1 rounded p-0.5 hover:bg-black/5 focus-ring dark:hover:bg-white/5">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const pasteView = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <label htmlFor="bulk-paste" className="text-xs text-muted-foreground">
        Paste CSV/TSV with a header row, or a JSON array of objects. Copying cells from a spreadsheet works too.
      </label>
      <Textarea
        id="bulk-paste"
        autoFocus
        value={pasteText}
        onChange={(e) => setPasteText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && pastePreview && !pastePreview.error) submitPaste();
        }}
        spellCheck={false}
        className="min-h-[120px] flex-1 resize-none font-mono text-xs leading-5"
        placeholder={'id,name\n1,Ada\n2,Grace'}
        invalid={!!pastePreview?.error}
      />
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs" aria-live="polite">
          {!pastePreview ? (
            <span className="text-muted-foreground">Waiting for input</span>
          ) : pastePreview.error ? (
            <span className="text-destructive-text">{pastePreview.error}</span>
          ) : (
            <span className="text-muted-foreground">
              <span className="font-medium uppercase text-foreground">{pastePreview.format}</span> · {pastePreview.rows.length} rows ·{' '}
              <span className="font-mono">{pastePreview.columns.join(', ')}</span>
              {pastePreview.warnings.length > 0 && <span className="text-warning-text"> · {pastePreview.warnings[0]}</span>}
            </span>
          )}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMode('grid');
            setPasteText('');
          }}
        >
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={submitPaste} disabled={!pastePreview || !!pastePreview.error}>
          {data.length > 0 ? `Replace ${data.length} rows` : 'Import'}
        </Button>
      </div>
    </div>
  );

  const templateColumns = (variableCheck?.missing ?? []).map((v) => v.name);

  const emptyView = (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-auto p-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/60 text-muted-foreground">
        <Table2 className="h-5 w-5" />
      </div>
      <div>
        <h3 className="text-[13px] font-semibold text-foreground">Add rows to drive the run</h3>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          Each row sends one request. Column names become <span className="font-mono text-foreground">{'{{variables}}'}</span> in the template.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Upload file
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setMode('paste')}>
          <ClipboardPaste className="h-3.5 w-3.5" /> Paste data
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            addColumns(templateColumns.length ? templateColumns : ['value']);
            pendingFocus.current = { row: 0, col: 0 };
          }}
        >
          <Plus className="h-3.5 w-3.5" /> {templateColumns.length ? `Grid from ${templateColumns.length} variable${templateColumns.length === 1 ? '' : 's'}` : 'Blank grid'}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">or drop a .csv / .json file here</p>
    </div>
  );

  const gridView = (
    <div ref={setGridRef} className="relative min-h-0 flex-1 overflow-auto">
      <table className="table-fixed border-separate border-spacing-0 text-[13px]" style={{ width: Math.max(tableWidth, 0), minWidth: '100%' }} aria-label="Data rows">
        <colgroup>
          <col style={{ width: INDEX_WIDTH }} />
          {columns.map((c) => (
            <col key={c} style={{ width: COL_WIDTH }} />
          ))}
          <col style={{ width: ACTION_WIDTH }} />
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr>
            <th scope="col" className="h-8 border-b border-r border-border bg-card px-2 text-right text-[11px] font-medium text-muted-foreground">
              #
            </th>
            {columns.map((column, ci) => {
              const used = usedColumns?.has(column.toLowerCase());
              return (
                <th
                  key={column}
                  scope="col"
                  draggable={editingColumn !== column}
                  onDragStart={(e) => {
                    setDraggedColumn(column);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/x-bulk-column', column);
                  }}
                  onDragOver={(e) => {
                    if (draggedColumn) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!draggedColumn) return;
                    e.preventDefault();
                    moveColumn(draggedColumn, ci);
                    setDraggedColumn(null);
                  }}
                  onDragEnd={() => setDraggedColumn(null)}
                  className={`group h-8 border-b border-r border-border bg-card p-0 text-left text-xs font-medium text-foreground ${
                    draggedColumn === column ? 'opacity-40' : ''
                  }`}
                >
                  {editingColumn === column ? (
                    <div className="px-1">
                      <Input
                        size="sm"
                        autoFocus
                        defaultValue={column}
                        aria-label={`Rename column ${column}`}
                        onBlur={(e) => renameColumn(column, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameColumn(column, e.currentTarget.value);
                          if (e.key === 'Escape') setEditingColumn(null);
                        }}
                        className="!h-6 font-mono"
                      />
                    </div>
                  ) : (
                    <div className="flex h-8 cursor-grab items-center gap-1 pl-2.5 pr-1 active:cursor-grabbing" onDoubleClick={() => setEditingColumn(column)}>
                      <span className="min-w-0 flex-1 truncate font-mono" title={column}>
                        {column}
                      </span>
                      {used && (
                        <Tooltip content={`Used as {{${column}}} in the request`}>
                          <span className="flex h-4 items-center rounded bg-primary/10 px-1 text-primary" aria-label="Used in template">
                            <Braces className="h-3 w-3" />
                          </span>
                        </Tooltip>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            aria-label={`Column ${column} options`}
                            className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Ellipsis className="h-3.5 w-3.5" />
                          </IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-44">
                          <DropdownMenuItem onClick={() => setEditingColumn(column)}>
                            <Pencil /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={ci === 0} onClick={() => moveColumn(column, ci - 1)}>
                            <ArrowLeft /> Move left
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={ci === columns.length - 1} onClick={() => moveColumn(column, ci + 1)}>
                            <ArrowRight /> Move right
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem destructive onClick={() => setConfirm({ kind: 'column', column })}>
                            <Trash2 /> Delete column
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </th>
              );
            })}
            <th scope="col" className="h-8 border-b border-border bg-card p-0">
              {newColumn !== null ? (
                <span className="sr-only">New column</span>
              ) : (
                <Tooltip content="Add column">
                  <IconButton size="xs" variant="ghost" aria-label="Add column" onClick={() => setNewColumn('')} className="mx-auto">
                    <Plus className="h-3.5 w-3.5" />
                  </IconButton>
                </Tooltip>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden="true" style={{ height: padTop }}>
              <td colSpan={columns.length + 2} />
            </tr>
          )}
          {data.slice(start, end).map((row, i) => {
            const rowIndex = start + i;
            return (
              <tr key={rowIndex} className="group" style={{ height: ROW_HEIGHT }}>
                <td className="border-b border-r border-border/60 px-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{rowIndex + 1}</td>
                {columns.map((column, ci) => (
                  <td key={column} className="border-b border-r border-border/60 p-0">
                    <input
                      data-cell={`${rowIndex}:${ci}`}
                      value={row[column] ?? ''}
                      onChange={(e) => setCell(rowIndex, column, e.target.value)}
                      onKeyDown={(e) => onCellKeyDown(e, rowIndex, ci)}
                      aria-label={`Row ${rowIndex + 1}, ${column}`}
                      spellCheck={false}
                      className="block h-8 w-full truncate bg-transparent px-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 hover:bg-accent/40 focus:bg-background focus:shadow-[inset_0_0_0_1.5px_hsl(var(--ring))]"
                    />
                  </td>
                ))}
                <td className="border-b border-border/60 p-0 text-center">
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label={`Delete row ${rowIndex + 1}`}
                    onClick={() => deleteRow(rowIndex)}
                    className="opacity-0 hover:!text-destructive-text focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </td>
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden="true" style={{ height: padBottom }}>
              <td colSpan={columns.length + 2} />
            </tr>
          )}
        </tbody>
      </table>
      <button
        type="button"
        onClick={addRow}
        className="sticky left-0 flex h-8 w-full items-center gap-1.5 px-3 text-xs text-muted-foreground hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Plus className="h-3.5 w-3.5" /> Add row
      </button>
    </div>
  );

  const newColumnBar = newColumn !== null && (
    <div className="flex flex-shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
      <label htmlFor="bulk-new-col" className="whitespace-nowrap text-xs text-muted-foreground">
        New column
      </label>
      <Input
        id="bulk-new-col"
        size="sm"
        autoFocus
        value={newColumn}
        onChange={(e) => setNewColumn(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitNewColumn(newColumn);
          if (e.key === 'Escape') setNewColumn(null);
        }}
        placeholder="column_name"
        className="font-mono"
      />
      <Button size="sm" variant="primary" onClick={() => commitNewColumn(newColumn)} disabled={!newColumn.trim()}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setNewColumn(null)}>
        Cancel
      </Button>
    </div>
  );

  const variableStrip = variableCheck && variableCheck.variables.length > 0 && mode === 'grid' && (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 border-t border-border px-3 py-2">
      <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Variables</span>
      {variableCheck.fromData.map((v) => {
        const empties = variableCheck.emptyCounts.get(v.key);
        return (
          <Tooltip key={v.key} content={empties ? `${empties} row${empties === 1 ? ' has' : 's have'} an empty ${v.name}` : `From data column · used in ${v.locations.join(', ')}`}>
            <span
              tabIndex={0}
              className={`inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-mono text-[11px] focus-ring ${
                empties ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'
              }`}
            >
              {empties ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {v.name}
            </span>
          </Tooltip>
        );
      })}
      {variableCheck.fromGlobals.map((v) => (
        <Tooltip key={v.key} content="Resolved from globals / environment (same for every row)">
          <span tabIndex={0} className="inline-flex h-6 items-center gap-1 rounded-md bg-info-bg px-1.5 font-mono text-[11px] text-info-text focus-ring">
            <Globe className="h-3 w-3" />
            {v.name}
          </span>
        </Tooltip>
      ))}
      {missing.map((v) => (
        <Tooltip key={v.key} content={`Not a column or global. Click to add a "${v.name}" column.`}>
          <button
            type="button"
            onClick={() => addColumns([v.name])}
            className="inline-flex h-6 items-center gap-1 rounded-md bg-destructive-bg px-1.5 font-mono text-[11px] text-destructive-text hover:ring-1 hover:ring-destructive/40 focus-ring"
          >
            <Plus className="h-3 w-3" />
            {v.name}
          </button>
        </Tooltip>
      ))}
    </div>
  );

  return (
    <section
      aria-label="Data"
      className="relative flex h-full min-h-0 flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {header}
      {noticeBanner}
      {mode === 'paste' ? (
        pasteView
      ) : (
        <>
          {newColumnBar}
          {data.length > 0 ? gridView : emptyView}
        </>
      )}
      {variableStrip}
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-20 m-2 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/85 animate-fade-in">
          <div className="flex flex-col items-center gap-1 text-center">
            <Upload className="h-5 w-5 text-primary" />
            <p className="text-[13px] font-medium text-foreground">Drop to import</p>
            <p className="text-xs text-muted-foreground">CSV, TSV or JSON · replaces current rows</p>
          </div>
        </div>
      )}
      <ConfirmDialog
        show={confirm?.kind === 'clear'}
        title="Clear all data?"
        description={`This removes all ${data.length} rows and ${columns.length} columns. Results from the last run are kept.`}
        confirmLabel="Clear data"
        destructive
        onConfirm={() => {
          onDataChange([]);
          setConfirm(null);
          setNotice(null);
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        show={confirm?.kind === 'column'}
        title={`Delete column "${confirm?.kind === 'column' ? confirm.column : ''}"?`}
        description="Its values are removed from every row."
        confirmLabel="Delete column"
        destructive
        onConfirm={() => {
          if (confirm?.kind === 'column') deleteColumn(confirm.column);
          setConfirm(null);
        }}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
};

export const StepBadge: React.FC<{ n: number; done?: boolean }> = ({ n, done }) => (
  <span
    aria-hidden="true"
    className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${
      done ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground ring-1 ring-inset ring-border'
    }`}
  >
    {n}
  </span>
);
