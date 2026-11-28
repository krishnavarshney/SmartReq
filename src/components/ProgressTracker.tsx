import React from 'react';
import { BulkProgress, BulkRunState } from '../types';
import { formatClock } from './bulk/bulkUtils';

interface ProgressTrackerProps {
  progress: BulkProgress;
  runState: BulkRunState;
  /** Active run time (pauses excluded), in ms. */
  elapsedMs?: number;
  /** Estimated time to completion, in ms. Shown only while running. */
  etaMs?: number | null;
  /** Rows abandoned by Stop; shown separately from completed. */
  cancelled?: number;
  className?: string;
}

const STATE_LABEL: Record<BulkRunState, string> = {
  idle: 'Ready',
  running: 'Running',
  paused: 'Paused',
  finished: 'Finished',
  stopped: 'Stopped',
};

const STATE_DOT: Record<BulkRunState, string> = {
  idle: 'bg-muted-foreground',
  running: 'bg-primary animate-pulse',
  paused: 'bg-warning',
  finished: 'bg-success',
  stopped: 'bg-muted-foreground',
};

const Stat: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className = '' }) => (
  <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${className}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono tabular-nums text-foreground">{children}</span>
  </span>
);

/** Live run status: state, completed/total, outcome split bar, throughput, elapsed and ETA. */
export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ progress, runState, elapsedMs, etaMs, cancelled = 0, className = '' }) => {
  const { total, completed, success, errors } = progress;
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  const successPct = total > 0 ? (success / total) * 100 : 0;
  const errorPct = total > 0 ? (errors / total) * 100 : 0;
  const cancelledPct = total > 0 ? (cancelled / total) * 100 : 0;
  const showRate = runState === 'running' && progress.rps !== undefined;

  return (
    <div className={`min-w-0 text-xs ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground" role="status" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[runState]}`} aria-hidden="true" />
          {STATE_LABEL[runState]}
        </span>
        <span className="font-mono tabular-nums text-foreground">
          {completed}
          <span className="text-muted-foreground"> / {total}</span>
          <span className="ml-1.5 text-muted-foreground">{Math.floor(pct)}%</span>
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          <span className="font-mono tabular-nums text-foreground">{success}</span>
          <span className="text-muted-foreground">ok</span>
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
          <span className="font-mono tabular-nums text-foreground">{errors}</span>
          <span className="text-muted-foreground">failed</span>
        </span>
        {cancelled > 0 && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />
            <span className="font-mono tabular-nums text-foreground">{cancelled}</span>
            <span className="text-muted-foreground">cancelled</span>
          </span>
        )}
        <span className="hidden flex-1 sm:block" />
        {showRate && <Stat label="Rate">{progress.rps!.toFixed(1)}/s</Stat>}
        {elapsedMs !== undefined && <Stat label="Elapsed">{formatClock(elapsedMs)}</Stat>}
        {runState === 'running' && <Stat label="ETA">{etaMs !== null && etaMs !== undefined ? formatClock(etaMs) : '--:--'}</Stat>}
      </div>
      <div
        className="mt-1.5 flex h-1 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Run progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-valuetext={`${completed} of ${total} requests completed, ${success} succeeded, ${errors} failed${cancelled ? `, ${cancelled} cancelled` : ''}`}
      >
        <div className="h-full bg-success transition-[width] duration-200" style={{ width: `${successPct}%` }} />
        <div className="h-full bg-destructive transition-[width] duration-200" style={{ width: `${errorPct}%` }} />
        <div className="h-full bg-muted-foreground/40 transition-[width] duration-200" style={{ width: `${Math.max(0, Math.max(pct - successPct - errorPct, cancelledPct))}%` }} />
      </div>
    </div>
  );
};
