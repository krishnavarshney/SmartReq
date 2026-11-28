import React, { useEffect, useMemo, useState } from 'react';
import { LogEntry } from '../../types';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { IconButton, Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/Modal';
import { Copy, History, Search, Trash2, X, ExternalLink } from '../icons';
import { MoreHorizontal } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/ContextMenu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { useLog } from '../../context/LogContext';
import { getMethodClass, getMethodShort, getStatusTone } from '../../utils/http-ui';

interface LogPanelProps {
  onLogClick: (log: LogEntry) => void;
}

const splitUrl = (raw: string): { path: string; host: string } => {
  try {
    const url = new URL(raw);
    let path = `${url.pathname}${url.search}` || '/';
    try {
      path = decodeURI(path); // show {{variables}} instead of %7B%7B…
    } catch {
      /* keep encoded form */
    }
    return { path, host: url.host };
  } catch {
    return { path: raw || '(no URL)', host: '' };
  }
};

const formatDuration = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 2)} s` : `${Math.round(ms)} ms`);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const dayLabel = (ts: number, now: number) => {
  const diffDays = Math.round((startOfDay(new Date(now)) - startOfDay(new Date(ts))) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  const d = new Date(ts);
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
};

const timeLabel = (ts: number, now: number) => {
  const diff = now - ts;
  if (diff < 45_000) return 'just now';
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const logUrl = (log: LogEntry) => (log.mode === 'single' ? log.request.url : log.requestTemplate.url);
const logMethod = (log: LogEntry) => (log.mode === 'single' ? log.request.method : log.requestTemplate.method);

const matchesQuery = (log: LogEntry, q: string) => {
  if (!q) return true;
  const hay =
    log.mode === 'single'
      ? `${log.request.method} ${log.request.url} ${log.response.status} ${log.response.statusText}`
      : `bulk ${log.requestTemplate.method} ${log.requestTemplate.url}`;
  return hay.toLowerCase().includes(q);
};

const LogRow: React.FC<{ log: LogEntry; now: number; onOpen: () => void; onCopyUrl: () => void; onCopyBody?: () => void; onDelete: () => void }> = ({
  log,
  now,
  onOpen,
  onCopyUrl,
  onCopyBody,
  onDelete,
}) => {
  const ts = new Date(log.timestamp).getTime();
  const { path, host } = splitUrl(logUrl(log));
  const method = logMethod(log);

  let right: React.ReactNode;
  let meta: React.ReactNode;
  if (log.mode === 'single') {
    const status = log.response.status;
    right = (
      <Badge tone={getStatusTone(status)} title={`${status || 'No response'} ${log.response.statusText || ''}`.trim()}>
        {status || 'ERR'}
      </Badge>
    );
    meta = (
      <>
        {host && <span className="min-w-0 truncate">{host}</span>}
        {host && <span aria-hidden="true">·</span>}
        <span className="flex-shrink-0 tabular-nums">{formatDuration(log.response.duration || 0)}</span>
      </>
    );
  } else {
    const total = log.results.length;
    const ok = log.results.filter((r) => r.status === 'success').length;
    const failed = log.results.filter((r) => r.status === 'error').length;
    right = <Badge tone={failed > 0 ? 'error' : ok === total && total > 0 ? 'success' : 'neutral'}>{failed > 0 ? `${failed} failed` : `${ok}/${total}`}</Badge>;
    meta = (
      <span className="min-w-0 truncate tabular-nums">
        {total} request{total === 1 ? '' : 's'} · {ok} ok{failed ? ` · ${failed} failed` : ''}
      </span>
    );
  }

  const menu = (Item: React.ComponentType<React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }>, Sep: React.ComponentType) => (
    <>
      <Item onClick={onOpen}>
        <ExternalLink /> {log.mode === 'single' ? 'Open in new tab' : 'Load bulk run'}
      </Item>
      <Item onClick={onCopyUrl}>
        <Copy /> Copy URL
      </Item>
      {onCopyBody && (
        <Item onClick={onCopyBody}>
          <Copy /> Copy response body
        </Item>
      )}
      <Sep />
      <Item destructive onClick={onDelete}>
        <Trash2 /> Remove from history
      </Item>
    </>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="group relative">
          <button
            type="button"
            onClick={onOpen}
            title={`${method} ${logUrl(log)}\n${new Date(ts).toLocaleString()}`}
            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {log.mode === 'single' ? (
              <span className={`w-[34px] flex-shrink-0 pt-[3px] font-mono text-[10px] font-semibold ${getMethodClass(method)}`}>{getMethodShort(method)}</span>
            ) : (
              <span className="w-[34px] flex-shrink-0 pt-px">
                <span className="inline-flex h-4 items-center rounded bg-primary/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-primary">Bulk</span>
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{path}</span>
                <span className="flex-shrink-0 group-hover:invisible group-has-[[aria-expanded=true]]:invisible">{right}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {meta}
                <span className="ml-auto flex-shrink-0 pl-2 tabular-nums">{timeLabel(ts, now)}</span>
              </span>
            </span>
          </button>
          <span className="absolute right-1.5 top-1 hidden group-hover:flex has-[[aria-expanded=true]]:flex">
            <DropdownMenu>
              <DropdownMenuTrigger
                tabIndex={-1}
                aria-label="History item actions"
                className="flex h-6 w-6 items-center justify-center rounded bg-accent text-muted-foreground hover:text-foreground focus-ring"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-52">{menu(DropdownMenuItem, DropdownMenuSeparator)}</DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">{menu(ContextMenuItem, ContextMenuSeparator)}</ContextMenuContent>
    </ContextMenu>
  );
};

export const LogPanel: React.FC<LogPanelProps> = ({ onLogClick }) => {
  const { logs, deleteLog, clearLogs } = useLog();
  const [filter, setFilter] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { addToast } = useToast();

  // Keep relative times fresh.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [logs]);

  const q = filter.trim().toLowerCase();
  const groups = useMemo(() => {
    const out: { label: string; items: LogEntry[] }[] = [];
    for (const log of logs) {
      if (!matchesQuery(log, q)) continue;
      const label = dayLabel(new Date(log.timestamp).getTime(), now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(log);
      else out.push({ label, items: [log] });
    }
    return out;
  }, [logs, q, now]);

  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => addToast(`${what} copied`, 'success'),
      () => addToast('Could not copy to clipboard', 'error')
    );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-b border-border pl-3 pr-1.5">
        <h2 className="truncate text-[13px] font-semibold text-foreground">
          History
          {logs.length > 0 && <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">{logs.length}</span>}
        </h2>
        <Tooltip content="Clear history" side="bottom">
          <IconButton size="sm" aria-label="Clear history" onClick={() => setConfirmClear(true)} disabled={logs.length === 0}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>

      {logs.length > 0 && (
        <div className="flex-shrink-0 px-2 pb-1 pt-2">
          <div className="relative">
            <Input
              size="sm"
              icon={<Search />}
              placeholder="Search URL, method or status"
              aria-label="Search history"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && filter && (e.stopPropagation(), setFilter(''))}
              className="pr-7"
            />
            {filter && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setFilter('')}
                className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-2">
        {logs.length === 0 ? (
          <EmptyState compact icon={<History />} title="No history yet" message="Requests you send appear here, grouped by day. Click one to reopen it with its response." />
        ) : groups.length === 0 ? (
          <EmptyState compact icon={<Search />} message={<>Nothing in history matches “{filter.trim()}”.</>}>
            <Button size="sm" variant="ghost" onClick={() => setFilter('')}>
              Clear search
            </Button>
          </EmptyState>
        ) : (
          groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h3 className="sticky top-0 z-10 bg-card px-2 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{group.label}</h3>
              <div className="flex flex-col">
                {group.items.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    now={now}
                    onOpen={() => onLogClick(log)}
                    onCopyUrl={() => copy(logUrl(log), 'URL')}
                    onCopyBody={
                      log.mode === 'single'
                        ? () => copy(typeof log.response.body === 'string' ? log.response.body : JSON.stringify(log.response.body, null, 2), 'Response body')
                        : undefined
                    }
                    onDelete={() => deleteLog(log.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      <ConfirmDialog
        show={confirmClear}
        title="Clear history?"
        description={`All ${logs.length} entr${logs.length === 1 ? 'y' : 'ies'} will be removed. Saved requests in collections are not affected.`}
        confirmLabel="Clear history"
        destructive
        onConfirm={() => {
          clearLogs();
          setConfirmClear(false);
          setFilter('');
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};
