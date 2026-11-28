import React from 'react';
import { Check, X, Minus, Ban } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { StepRunStatus, FlowRun } from './flowRunner';

export const formatMs = (ms?: number): string => {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
};

export const formatBytes = (bytes?: number): string => {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Path + query of a URL for compact display; falls back to the raw string for templated URLs. */
export const displayPath = (url: string): string => {
  if (!url) return '';
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/i, '') || url;
  }
};

export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    const m = /^https?:\/\/([^/?#]+)/i.exec(url);
    return m ? m[1] : 'server';
  }
};

const STATUS_LABEL: Record<StepRunStatus, string> = {
  pending: 'Waiting',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
};

export const stepStatusLabel = (s: StepRunStatus) => STATUS_LABEL[s];

/** Numbered circle that turns into a status glyph once the step has run. */
export const StepMarker: React.FC<{ index: number; status?: StepRunStatus; className?: string }> = ({ index, status, className = '' }) => {
  const base = `flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${className}`;
  const label = status ? `Step ${index + 1}: ${STATUS_LABEL[status]}` : `Step ${index + 1}`;
  switch (status) {
    case 'running':
      return (
        <span className={`${base} bg-primary/10 text-primary`} role="img" aria-label={label}>
          <Spinner className="h-3.5 w-3.5" />
        </span>
      );
    case 'passed':
      return (
        <span className={`${base} bg-success-bg text-success-text`} role="img" aria-label={label}>
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      );
    case 'failed':
      return (
        <span className={`${base} bg-destructive-bg text-destructive-text`} role="img" aria-label={label}>
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      );
    case 'cancelled':
      return (
        <span className={`${base} bg-muted text-muted-foreground`} role="img" aria-label={label}>
          <Ban className="h-3.5 w-3.5" />
        </span>
      );
    case 'skipped':
      return (
        <span className={`${base} border border-dashed border-border text-muted-foreground`} role="img" aria-label={label}>
          <Minus className="h-3.5 w-3.5" />
        </span>
      );
    default:
      return (
        <span className={`${base} border border-border bg-card text-muted-foreground`} aria-label={label}>
          {index + 1}
        </span>
      );
  }
};

export const summarizeRun = (run?: FlowRun) => {
  if (!run) return null;
  const passed = run.steps.filter((s) => s.status === 'passed').length;
  const failed = run.steps.filter((s) => s.status === 'failed').length;
  const skipped = run.steps.filter((s) => s.status === 'skipped' || s.status === 'cancelled').length;
  const total = run.steps.reduce((sum, s) => sum + (s.duration ?? 0), 0);
  const done = run.steps.filter((s) => s.status !== 'pending' && s.status !== 'running').length;
  return { passed, failed, skipped, total, done, count: run.steps.length };
};

export const sectionLabel = 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground';
