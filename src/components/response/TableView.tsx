import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { Table as TableIcon, ChevronRight } from '../icons';
import { Button } from '../ui/Button';
import { JsonNode } from './JsonNode';

interface TableViewProps {
  data: any;
  /** Called with path segments relative to `data` when a nested value is opened. */
  onDrillDown?: (segments: string[]) => void;
  /** @deprecated kept for backwards compatibility; nesting is handled by drill-down. */
  nestingLevel?: number;
}

const ROW_LIMIT = 500;
const MAX_COLUMNS = 60;

const isPlainObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isContainer = (v: unknown): v is object => typeof v === 'object' && v !== null;
const sizeOf = (v: object) => (Array.isArray(v) ? v.length : Object.keys(v).length);

/** Shape description used by the toolbar ("8 rows × 5 columns"). */
export const describeTableData = (data: any): string | null => {
  if (Array.isArray(data)) {
    const cols = data.length && data.every(isPlainObject) ? new Set(data.slice(0, 1000).flatMap((r) => Object.keys(r))).size : 1;
    return `${data.length.toLocaleString()} row${data.length === 1 ? '' : 's'} × ${cols} column${cols === 1 ? '' : 's'}`;
  }
  if (isPlainObject(data)) {
    const n = Object.keys(data).length;
    return `${n} key${n === 1 ? '' : 's'}`;
  }
  return null;
};

/** True when the value can be shown as a table (object or array). */
export const isTabular = (data: any) => isContainer(data);

const Cell: React.FC<{ value: any; onDrill?: () => void; name?: string }> = ({ value, onDrill, name }) => {
  if (isContainer(value)) {
    const n = sizeOf(value);
    const isArr = Array.isArray(value);
    if (n === 0) return <span className="token punctuation">{isArr ? '[]' : '{}'}</span>;
    const label = isArr ? `${n} item${n === 1 ? '' : 's'}` : `${n} key${n === 1 ? '' : 's'}`;
    if (!onDrill) return <JsonNode data={value} />;
    return (
      <button
        type="button"
        onClick={onDrill}
        title={`Open ${isArr ? 'array' : 'object'} as table`}
        aria-label={`Open ${name ?? (isArr ? 'array' : 'object')} (${label})`}
        className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted/60 px-1.5 font-sans text-[11px] font-medium text-muted-foreground hover:border-input hover:bg-accent hover:text-foreground focus-ring"
      >
        <span className="font-mono text-[10px] opacity-70">{isArr ? '[ ]' : '{ }'}</span>
        {label}
        <ChevronRight className="h-3 w-3" />
      </button>
    );
  }
  if (value === null) return <span className="token null italic">null</span>;
  if (value === undefined) return <span className="text-muted-foreground/40">—</span>;
  if (typeof value === 'string') {
    if (value === '') return <span className="italic text-muted-foreground/60">empty</span>;
    return (
      <span className="block max-w-[28rem] truncate text-foreground" title={value.length > 40 ? value : undefined}>
        {value}
      </span>
    );
  }
  if (typeof value === 'number') return <span className="token number tabular-nums">{value}</span>;
  if (typeof value === 'boolean') return <span className="token boolean">{String(value)}</span>;
  return <span>{String(value)}</span>;
};

const th = 'sticky top-0 z-[2] h-8 whitespace-nowrap border-b border-border bg-card px-3 text-left align-middle text-[11px] font-medium text-muted-foreground';
const td = 'h-8 whitespace-nowrap border-b border-border/60 px-3 py-1 align-middle';

export const TableView: React.FC<TableViewProps> = ({ data, onDrillDown }) => {
  const [limit, setLimit] = useState(ROW_LIMIT);
  useEffect(() => setLimit(ROW_LIMIT), [data]);

  const model = useMemo(() => {
    if (Array.isArray(data)) {
      if (data.length > 0 && data.every(isPlainObject)) {
        const cols = Array.from(new Set(data.slice(0, 1000).flatMap((r) => Object.keys(r))));
        return { kind: 'records' as const, columns: cols.slice(0, MAX_COLUMNS), hiddenColumns: Math.max(0, cols.length - MAX_COLUMNS) };
      }
      return { kind: 'list' as const };
    }
    if (isPlainObject(data)) return { kind: 'object' as const };
    return { kind: 'primitive' as const };
  }, [data]);

  if (model.kind === 'primitive') {
    return (
      <EmptyState
        compact
        icon={<TableIcon />}
        title="Single value"
        message={
          <span className="inline-flex flex-col items-center gap-2">
            <span>This path holds a single value, not a table.</span>
            <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs">
              <JsonNode data={data} />
            </span>
          </span>
        }
      />
    );
  }

  if (isContainer(data) && sizeOf(data) === 0) {
    return <EmptyState compact icon={<TableIcon />} title={Array.isArray(data) ? 'Empty array' : 'Empty object'} message="There is nothing to show at this path." />;
  }

  const rowNumTh = `${th} sticky left-0 z-[3] w-10 pr-2 text-right`;
  const rowNumTd = `${td} sticky left-0 z-[1] bg-card pr-2 text-right text-[11px] tabular-nums text-muted-foreground/70`;

  let table: React.ReactNode;
  let total = 0;

  if (model.kind === 'records') {
    const rows = data as Record<string, any>[];
    total = rows.length;
    table = (
      <table className="min-w-full border-separate border-spacing-0 font-mono text-xs">
        <thead>
          <tr>
            <th scope="col" className={rowNumTh}>
              #
            </th>
            {model.columns.map((c) => (
              <th key={c} scope="col" className={th}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, r) => (
            <tr key={r} className="group hover:[&>td]:bg-accent/50">
              <td className={rowNumTd}>{r}</td>
              {model.columns.map((c) => (
                <td key={c} className={td}>
                  <Cell value={row[c]} name={`${r}.${c}`} onDrill={onDrillDown && isContainer(row[c]) ? () => onDrillDown([String(r), c]) : undefined} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else if (model.kind === 'list') {
    const rows = data as any[];
    total = rows.length;
    table = (
      <table className="min-w-full border-separate border-spacing-0 font-mono text-xs">
        <thead>
          <tr>
            <th scope="col" className={rowNumTh}>
              #
            </th>
            <th scope="col" className={`${th} w-full`}>
              value
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((v, r) => (
            <tr key={r} className="hover:[&>td]:bg-accent/50">
              <td className={rowNumTd}>{r}</td>
              <td className={td}>
                <Cell value={v} name={`[${r}]`} onDrill={onDrillDown && isContainer(v) ? () => onDrillDown([String(r)]) : undefined} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } else {
    const entries = Object.entries(data as Record<string, any>);
    total = entries.length;
    table = (
      <table className="min-w-full border-separate border-spacing-0 font-mono text-xs">
        <thead>
          <tr>
            <th scope="col" className={`${th} w-1/4 min-w-[8rem]`}>
              key
            </th>
            <th scope="col" className={th}>
              value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, limit).map(([k, v]) => (
            <tr key={k} className="hover:[&>td]:bg-accent/50">
              <td className={`${td} token key`}>{k}</td>
              <td className={`${td} w-full`}>
                <Cell value={v} name={k} onDrill={onDrillDown && isContainer(v) ? () => onDrillDown([k]) : undefined} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const hiddenColumns = model.kind === 'records' ? model.hiddenColumns : 0;

  return (
    <div className="h-full min-h-0 overflow-auto">
      {table}
      {(total > limit || hiddenColumns > 0) && (
        <div className="sticky left-0 flex flex-wrap items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
          {total > limit && (
            <>
              <span>
                Showing {limit.toLocaleString()} of {total.toLocaleString()} rows.
              </span>
              <Button size="xs" variant="secondary" onClick={() => setLimit((l) => l + 2000)}>
                Show more
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setLimit(Number.MAX_SAFE_INTEGER)}>
                Show all
              </Button>
            </>
          )}
          {hiddenColumns > 0 && <span>{hiddenColumns} more columns hidden. Use Export to see every column.</span>}
        </div>
      )}
    </div>
  );
};
