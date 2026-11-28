import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useVirtualRows } from '../bulk/useVirtualRows';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Plain-text header for aria labels when `header` is not a string. */
  label?: string;
  cell: (row: T) => React.ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  /** Fixed column width in px (the table scrolls horizontally when columns overflow). */
  width: number;
  align?: 'left' | 'right' | 'center';
  /** Extra classes for body cells. */
  className?: string;
}

export interface DataTableSort {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** Accessible name for each row (announced when focused). */
  getRowLabel?: (row: T) => string;
  /** Highlight a row (e.g. the one open in a detail view). */
  activeRowKey?: string | number | null;
  /** Rendered in the body when `rows` is empty. */
  empty?: React.ReactNode;
  rowHeight?: number;
  initialSort?: DataTableSort | null;
  ariaLabel?: string;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const compare = (a: string | number, b: string | number) => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
};

/**
 * Sortable, virtualized table with sticky header. Columns have fixed widths so
 * windowed rows never shift layout. Rows are focusable and open with Enter/Space.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  getRowLabel,
  activeRowKey,
  empty,
  rowHeight = 32,
  initialSort = null,
  ariaLabel,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<DataTableSort | null>(initialSort);

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const dir = sort.direction === 'asc' ? 1 : -1;
    // Copy before sorting: never mutate the caller's array.
    return rows
      .map((row, i) => ({ row, i, v: col.sortValue!(row) }))
      .sort((a, b) => compare(a.v, b.v) * dir || a.i - b.i)
      .map((x) => x.row);
  }, [rows, sort, columns]);

  const { containerRef, start, end, padTop, padBottom } = useVirtualRows(sorted.length, rowHeight);
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);

  const toggleSort = (key: string) =>
    setSort((prev) => (prev?.key !== key ? { key, direction: 'asc' } : prev.direction === 'asc' ? { key, direction: 'desc' } : null));

  const alignClass = (align?: 'left' | 'right' | 'center') => (align === 'right' ? 'text-right justify-end' : align === 'center' ? 'text-center justify-center' : 'text-left');
  // Right-aligned headers put the sort icon first so the label lines up with the values.
  const headerFlow = (align?: 'left' | 'right' | 'center') => (align === 'right' ? 'flex-row-reverse justify-start' : alignClass(align));

  return (
    <div ref={containerRef} className="relative h-full min-h-0 overflow-auto">
      <table className="w-full table-fixed border-separate border-spacing-0 text-[13px]" style={{ minWidth: totalWidth }} aria-label={ariaLabel} aria-rowcount={sorted.length + 1}>
        <colgroup>
          {columns.map((c, i) => (
            // Last column absorbs extra width.
            <col key={c.key} style={i === columns.length - 1 ? undefined : { width: c.width }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key;
              const ariaSort = active ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : col.sortValue ? 'none' : undefined;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`h-8 border-b border-border bg-card px-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${alignClass(col.align)}`}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`group flex h-8 w-full items-center gap-1 px-3 uppercase tracking-wide hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${headerFlow(col.align)} ${active ? 'text-foreground' : ''}`}
                      title={`Sort by ${col.label ?? (typeof col.header === 'string' ? col.header : col.key)}`}
                    >
                      <span className="truncate">{col.header}</span>
                      {active ? (
                        sort!.direction === 'asc' ? <ArrowUp className="h-3 w-3 flex-shrink-0" /> : <ArrowDown className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60" />
                      )}
                    </button>
                  ) : (
                    <span className={`flex h-8 items-center px-3 ${alignClass(col.align)}`}>{col.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden="true" style={{ height: padTop }}>
              <td colSpan={columns.length} />
            </tr>
          )}
          {sorted.slice(start, end).map((row, i) => {
            const key = getRowKey(row);
            const active = activeRowKey !== undefined && activeRowKey !== null && key === activeRowKey;
            return (
              <tr
                key={key}
                aria-rowindex={start + i + 2}
                aria-label={getRowLabel?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                style={{ height: rowHeight }}
                className={`group outline-none ${onRowClick ? 'cursor-pointer' : ''} ${active ? 'bg-primary/10' : 'hover:bg-accent/60'} focus-visible:bg-accent focus-visible:shadow-[inset_2px_0_0_hsl(var(--primary))]`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`truncate border-b border-border/60 px-3 align-middle ${alignClass(col.align)} ${col.className ?? ''}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr aria-hidden="true" style={{ height: padBottom }}>
              <td colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
      {sorted.length === 0 && empty && <div className="sticky left-0 w-full">{empty}</div>}
    </div>
  );
}
