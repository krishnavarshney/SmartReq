import React, { useMemo, useState } from 'react';
import { AlertTriangle, Ban, Download, Info, ListChecks, Maximize2, Minimize2, Pause, Play, RotateCcw, Search, Square } from 'lucide-react';
import { BulkResult, BulkRunState, BulkSettings } from '../../types';
import { Button, IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { Input } from '../ui/Input';
import { Slider } from '../ui/Slider';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/Modal';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { SegmentedControl } from '../ui/SegmentedControl';
import { DataTable, DataTableColumn } from '../ui/DataTable';
import { ProgressTracker } from '../ProgressTracker';
import { useToast } from '../../context/ToastContext';
import { formatBytes } from '../../utils/formatters';
import { getStatusBadgeClass } from '../../utils/http-ui';
import { ResultDetailModal } from './ResultDetailModal';
import { SummaryDashboard } from './SummaryDashboard';
import { StepBadge } from './DataInputPanel';
import { collectColumns, computeStats, DataRow, downloadCsv, flattenResultsForExport, isSettled, VariableCheck } from './bulkUtils';
import { RunClock } from './useRunClock';

interface ExecutionPanelProps {
  results: BulkResult[];
  runState: BulkRunState;
  onRun: (options?: { rows?: number[] }) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  settings: BulkSettings;
  onSettingsChange: (settings: BulkSettings) => void;
  data: DataRow[];
  /** Resolved request URL template, used to explain why Run is disabled. */
  url?: string;
  variableCheck?: VariableCheck;
  clock?: RunClock;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  /** Hide step number + title (mobile tab already labels it). */
  compactHeader?: boolean;
}

type StatusFilter = 'all' | 'failed' | 'success' | 'active' | 'cancelled';

const RESULT_META: Record<BulkResult['status'], { label: string; tone: 'success' | 'error' | 'neutral' | 'info' | 'warning'; order: number }> = {
  error: { label: 'Failed', tone: 'error', order: 0 },
  success: { label: 'OK', tone: 'success', order: 1 },
  running: { label: 'Running', tone: 'info', order: 2 },
  pending: { label: 'Queued', tone: 'neutral', order: 3 },
  cancelled: { label: 'Cancelled', tone: 'neutral', order: 4 },
};

const ResultPill: React.FC<{ status: BulkResult['status'] }> = ({ status }) => {
  const meta = RESULT_META[status];
  if (status === 'running')
    return (
      <Badge tone="info">
        <Spinner className="h-3 w-3" /> Running
      </Badge>
    );
  if (status === 'cancelled')
    return (
      <Badge tone="neutral">
        <Ban className="h-3 w-3" /> Cancelled
      </Badge>
    );
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const ExecutionPanel: React.FC<ExecutionPanelProps> = (props) => {
  const { results, runState, settings, data, variableCheck, clock } = props;
  const { addToast } = useToast();
  const [tab, setTab] = useState('results');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [confirmMissing, setConfirmMissing] = useState(false);
  const [concurrencyDraft, setConcurrencyDraft] = useState<string | null>(null);
  const [delayDraft, setDelayDraft] = useState<string | null>(null);

  const stats = useMemo(() => computeStats(results), [results]);
  const isActive = runState === 'running' || runState === 'paused';
  const retryRows = useMemo(
    () => (results.length === data.length ? results.flatMap((r, i) => (r.status === 'error' || r.status === 'cancelled' ? [i] : [])) : []),
    [results, data.length]
  );

  /* --------------------------- readiness --------------------------- */

  const blocker = data.length === 0 ? 'Add at least one data row.' : !props.url?.trim() ? 'Enter a request URL.' : null;
  const missing = variableCheck?.missing ?? [];

  const run = (options?: { rows?: number[] }) => {
    if (blocker) return;
    setSelectedId(null);
    setStatusFilter('all');
    props.onRun(options);
  };

  const requestRun = () => {
    if (missing.length > 0) setConfirmMissing(true);
    else run();
  };

  /* ---------------------------- results ---------------------------- */

  const dataColumns = useMemo(() => {
    const fromResults = results.length ? collectColumns(results.slice(0, 50).map((r) => r.data)) : [];
    return fromResults.length ? fromResults : collectColumns(data.slice(0, 50));
  }, [results, data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return results.filter((r) => {
      if (statusFilter === 'failed' && r.status !== 'error') return false;
      if (statusFilter === 'success' && r.status !== 'success') return false;
      if (statusFilter === 'active' && r.status !== 'pending' && r.status !== 'running') return false;
      if (statusFilter === 'cancelled' && r.status !== 'cancelled') return false;
      if (!q) return true;
      if (String(r.id) === q) return true;
      const hay = [...Object.values(r.data), String(r.response.status || ''), r.response.statusText, r.request?.url ?? ''].join('\u0001').toLowerCase();
      return hay.includes(q);
    });
  }, [results, statusFilter, query]);

  const columns = useMemo<DataTableColumn<BulkResult>[]>(
    () => [
      { key: 'id', header: '#', width: 56, align: 'right', sortValue: (r) => r.id, cell: (r) => <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.id}</span> },
      { key: 'result', header: 'Result', width: 112, sortValue: (r) => RESULT_META[r.status].order, cell: (r) => <ResultPill status={r.status} /> },
      ...dataColumns.map<DataTableColumn<BulkResult>>((c) => ({
        key: `data:${c}`,
        header: <span className="normal-case">{c}</span>,
        label: c,
        width: 140,
        sortValue: (r) => r.data[c] ?? '',
        cell: (r) => (
          <span className="font-mono text-xs text-foreground" title={r.data[c]}>
            {r.data[c]}
          </span>
        ),
      })),
      {
        key: 'code',
        header: 'Status',
        width: 208,
        sortValue: (r) => (isSettled(r) ? r.response.status : -1),
        cell: (r) =>
          isSettled(r) ? (
            r.response.status > 0 ? (
              <span className={`inline-flex h-5 max-w-full items-center truncate rounded px-1.5 font-mono text-[11px] font-semibold tabular-nums ${getStatusBadgeClass(r.response.status)}`}>
                {r.response.status} {r.response.statusText}
              </span>
            ) : (
              <span className="text-xs text-destructive-text">{r.response.statusText || 'No response'}</span>
            )
          ) : (
            <span className="text-xs text-muted-foreground/60">-</span>
          ),
      },
      {
        key: 'time',
        header: 'Time',
        width: 88,
        align: 'right',
        sortValue: (r) => (isSettled(r) ? r.response.duration : -1),
        cell: (r) => (isSettled(r) ? <span className="font-mono text-xs tabular-nums">{Math.round(r.response.duration)} ms</span> : <span className="text-xs text-muted-foreground/60">-</span>),
      },
      {
        key: 'size',
        header: 'Size',
        width: 96,
        align: 'right',
        sortValue: (r) => r.response.size?.total ?? -1,
        cell: (r) =>
          r.response.size ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatBytes(r.response.size.total, 1)}</span> : <span className="text-xs text-muted-foreground/60">-</span>,
      },
    ],
    [dataColumns]
  );

  const exportCsv = () => {
    const settled = results.filter((r) => r.status !== 'pending');
    if (settled.length === 0) {
      addToast('Nothing to export yet.', 'info');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadCsv(flattenResultsForExport(results), `bulk-run-${stamp}.csv`);
    addToast(`Exported ${results.length} rows to CSV`, 'success');
  };

  const selectedIndex = selectedId === null ? -1 : filtered.findIndex((r) => r.id === selectedId);
  const selected = selectedId === null ? null : results.find((r) => r.id === selectedId) ?? null;

  /* ---------------------------- settings --------------------------- */

  const commitConcurrency = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n)) props.onSettingsChange({ ...settings, concurrency: clamp(n, 1, 50) });
    setConcurrencyDraft(null);
  };
  const commitDelay = (raw: string) => {
    const n = parseInt(raw, 10);
    props.onSettingsChange({ ...settings, delay: Number.isFinite(n) ? clamp(n, 0, 60000) : 0 });
    setDelayDraft(null);
  };
  const lockedHint = isActive ? 'Settings are locked while a run is in progress' : undefined;

  /* ----------------------------- render ---------------------------- */

  const runButtons = (
    <div className="flex items-center gap-1.5">
      {runState === 'running' && (
        <>
          <Button size="sm" variant="secondary" className="max-lg:!h-8" onClick={props.onPause}>
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
          <Button size="sm" variant="outline" onClick={props.onStop} className="text-destructive-text hover:bg-destructive-bg max-lg:!h-8">
            <Square className="h-3 w-3 fill-current" /> Stop
          </Button>
        </>
      )}
      {runState === 'paused' && (
        <>
          <Button size="sm" variant="primary" className="max-lg:!h-8" onClick={props.onResume}>
            <Play className="h-3.5 w-3.5" /> Resume
          </Button>
          <Button size="sm" variant="outline" onClick={props.onStop} className="text-destructive-text hover:bg-destructive-bg max-lg:!h-8">
            <Square className="h-3 w-3 fill-current" /> Stop
          </Button>
        </>
      )}
      {!isActive && (
        <>
          {blocker ? (
            <Tooltip content={blocker}>
              {/* span wrapper keeps the tooltip working on a disabled button */}
              <span tabIndex={0} className="rounded-md focus-ring">
                <Button size="sm" variant="primary" disabled className="pointer-events-none">
                  <Play className="h-3.5 w-3.5" /> Run
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button size="sm" variant="primary" className="max-lg:!h-8" onClick={requestRun}>
              {results.length > 0 ? <RotateCcw className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {results.length > 0 ? 'Run again' : 'Run'} <span className="font-mono tabular-nums opacity-80">{data.length}</span>
            </Button>
          )}
          {retryRows.length > 0 && !blocker && (
            <Tooltip content="Re-send only failed and cancelled rows; successful results are kept">
              <Button size="sm" variant="secondary" className="max-lg:!h-8" onClick={() => run({ rows: retryRows })}>
                <RotateCcw className="h-3.5 w-3.5" /> Retry {retryRows.length}
              </Button>
            </Tooltip>
          )}
        </>
      )}
    </div>
  );

  const settingsControls = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" title={lockedHint}>
      <div className="flex items-center gap-2">
        <label htmlFor="bulk-concurrency" className="text-xs text-muted-foreground">
          Concurrency
        </label>
        <Slider
          aria-label="Concurrency slider"
          min={1}
          max={50}
          step={1}
          value={[settings.concurrency]}
          disabled={isActive}
          onValueChange={([v]) => props.onSettingsChange({ ...settings, concurrency: v })}
          className="!w-24"
        />
        <Input
          id="bulk-concurrency"
          size="sm"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          disabled={isActive}
          value={concurrencyDraft ?? String(settings.concurrency)}
          onChange={(e) => setConcurrencyDraft(e.target.value)}
          onBlur={(e) => commitConcurrency(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commitConcurrency(e.currentTarget.value)}
          className="!w-12 text-center font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          aria-describedby="bulk-settings-help"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="bulk-delay" className="text-xs text-muted-foreground">
          Delay
        </label>
        <div className="relative">
          <Input
            id="bulk-delay"
            size="sm"
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            disabled={isActive}
            value={delayDraft ?? String(settings.delay)}
            onChange={(e) => setDelayDraft(e.target.value)}
            onBlur={(e) => commitDelay(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitDelay(e.currentTarget.value)}
            className="!w-20 !pr-7 font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-describedby="bulk-settings-help"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">ms</span>
        </div>
        <Tooltip
          content={
            <span className="block max-w-[260px]">
              Up to <b>{settings.concurrency}</b> request{settings.concurrency === 1 ? '' : 's'} in flight at once. Each worker waits <b>{settings.delay} ms</b> after a
              response before sending its next request. Settings are frozen when a run starts.
            </span>
          }
        >
          <button type="button" aria-label="How concurrency and delay work" className="rounded text-muted-foreground hover:text-foreground focus-ring">
            <Info className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <span id="bulk-settings-help" className="sr-only">
          Concurrency is the number of parallel requests (1 to 50). Delay is the pause in milliseconds each worker takes between requests.
        </span>
      </div>
    </div>
  );

  const readiness =
    !isActive && (blocker || missing.length > 0) ? (
      <div
        className={`flex flex-shrink-0 items-start gap-2 border-b border-border px-3 py-2 text-xs ${blocker ? 'text-muted-foreground' : 'bg-warning-bg text-warning-text'}`}
        role={blocker ? undefined : 'status'}
      >
        {blocker ? <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" />}
        <p className="min-w-0">
          {blocker ?? (
            <>
              {missing.length === 1 ? 'Variable ' : 'Variables '}
              {missing.map((v, i) => (
                <React.Fragment key={v.key}>
                  {i > 0 && ', '}
                  <code className="font-mono font-semibold">{`{{${v.name}}}`}</code>
                </React.Fragment>
              ))}{' '}
              {missing.length === 1 ? 'is' : 'are'} not a data column or global and will be sent literally.
            </>
          )}
        </p>
      </div>
    ) : null;

  const statusOptions = [
    { value: 'all', label: `All ${stats.total}` },
    { value: 'failed', label: `Failed ${stats.error}` },
    { value: 'success', label: `OK ${stats.success}` },
    ...(stats.pending + stats.running > 0 ? [{ value: 'active', label: `Queued ${stats.pending + stats.running}` }] : []),
    ...(stats.cancelled > 0 ? [{ value: 'cancelled', label: `Cancelled ${stats.cancelled}` }] : []),
  ];
  const effectiveFilter = statusOptions.some((o) => o.value === statusFilter) ? statusFilter : 'all';

  const resultsEmpty =
    results.length === 0 ? (
      <EmptyState
        compact
        icon={<ListChecks />}
        title={blocker ? 'Not ready to run' : `Ready to send ${data.length} request${data.length === 1 ? '' : 's'}`}
        message={
          blocker
            ? blocker
            : 'Each data row fills the {{variables}} in the request template. Results stream in here with status, timing and size; click a row to inspect it.'
        }
      />
    ) : (
      <EmptyState compact icon={<Search />} message="No rows match this filter." />
    );

  return (
    <section aria-label="Run and results" className="flex h-full min-h-0 flex-col">
      {/* Run bar */}
      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-1.5 min-h-10">
        {!props.compactHeader && (
          <div className="flex items-center gap-2">
            <StepBadge n={3} />
            <h2 className="text-[13px] font-semibold text-foreground">Run</h2>
          </div>
        )}
        {runButtons}
        <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        {settingsControls}
        {props.onToggleMaximize && (
          <Tooltip content={props.isMaximized ? 'Show data and template' : 'Expand results'}>
            <IconButton size="sm" variant="ghost" className="ml-auto" aria-label={props.isMaximized ? 'Show data and template' : 'Expand results'} aria-pressed={props.isMaximized} onClick={props.onToggleMaximize}>
              {props.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </IconButton>
          </Tooltip>
        )}
      </div>

      {readiness}

      {results.length > 0 && (
        <div className="flex-shrink-0 border-b border-border px-3 py-2">
          <ProgressTracker
            cancelled={stats.cancelled}
            progress={{ total: stats.total, completed: stats.settled, success: stats.success, errors: stats.error, rps: clock?.rps }}
            runState={runState}
            elapsedMs={clock?.available ? clock.elapsedMs : undefined}
            etaMs={clock?.etaMs}
          />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3">
          <TabsList className="!border-b-0">
            <TabsTrigger value="results" badge={results.length || undefined}>
              Results
            </TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          {tab === 'results' && results.length > 0 && (
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 pb-2 lg:w-auto lg:flex-1 lg:justify-end lg:py-1.5">
              <div className="no-scrollbar min-w-0 max-w-full overflow-x-auto">
                <SegmentedControl size="sm" aria-label="Filter by result" options={statusOptions} value={effectiveFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} />
              </div>
              <div className="min-w-[140px] flex-1 lg:w-48 lg:flex-none">
                <Input size="sm" icon={<Search />} placeholder="Filter rows" aria-label="Filter rows" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" onClick={exportCsv} disabled={stats.settled === 0}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
          )}
        </div>
        <TabsContent value="results" className="min-h-0 flex-1">
          {results.length === 0 ? (
            resultsEmpty
          ) : (
          <DataTable
            ariaLabel="Run results"
            columns={columns}
            rows={filtered}
            getRowKey={(r) => r.id}
            getRowLabel={(r) => `Row ${r.id}, ${RESULT_META[r.status].label}${r.response.status ? `, status ${r.response.status}` : ''}`}
            onRowClick={(r) => setSelectedId(r.id)}
            activeRowKey={selectedId}
            empty={resultsEmpty}
          />
          )}
        </TabsContent>
        <TabsContent value="summary" className="min-h-0 flex-1 overflow-auto">
          <SummaryDashboard results={results} clock={clock} runState={runState} />
        </TabsContent>
      </Tabs>

      {selected && (
        <ResultDetailModal
          result={selected}
          position={selectedIndex >= 0 ? { index: selectedIndex, total: filtered.length } : undefined}
          onPrev={selectedIndex > 0 ? () => setSelectedId(filtered[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? () => setSelectedId(filtered[selectedIndex + 1].id) : undefined}
          onClose={() => setSelectedId(null)}
        />
      )}

      <ConfirmDialog
        show={confirmMissing}
        title="Run with unresolved variables?"
        description={
          <>
            {missing.map((v) => `{{${v.name}}}`).join(', ')} {missing.length === 1 ? 'is' : 'are'} not defined by a data column or a global, so{' '}
            {missing.length === 1 ? 'it' : 'they'} will be sent as literal text in every request.
          </>
        }
        confirmLabel="Run anyway"
        onConfirm={() => {
          setConfirmMissing(false);
          run();
        }}
        onCancel={() => setConfirmMissing(false)}
      />
    </section>
  );
};
