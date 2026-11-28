import React, { useMemo } from 'react';
import { BulkResult, BulkRunState } from '../../types';
import { KPICard } from '../ui/KPICard';
import { EmptyState } from '../ui/EmptyState';
import { PieChart } from '../icons';
import { formatBytes } from '../../utils/formatters';
import { StatusCodeDistributionChart } from '../charts/StatusCodeDistributionChart';
import { ResponseTimeHistogram } from '../charts/ResponseTimeHistogram';
import { computeStats, formatClock, formatMs } from './bulkUtils';
import { RunClock } from './useRunClock';

interface SummaryDashboardProps {
  results: BulkResult[];
  clock?: RunClock;
  runState?: BulkRunState;
}

const ChartCard: React.FC<{ title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, meta, children, className = '' }) => (
  <div className={`flex min-w-0 flex-col rounded-lg border border-border bg-card ${className}`}>
    <div className="flex h-10 flex-shrink-0 items-center justify-between gap-2 border-b border-border px-3">
      <h3 className="text-[13px] font-semibold text-foreground">{title}</h3>
      {meta && <div className="truncate text-xs text-muted-foreground">{meta}</div>}
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
  </div>
);

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ results, clock, runState }) => {
  const s = useMemo(() => computeStats(results), [results]);

  if (results.length === 0) {
    return <EmptyState compact icon={<PieChart />} title="No run yet" message="Success rate, latency percentiles and status code breakdown appear here once a run starts." />;
  }

  const successRate = s.settled ? (s.success / s.settled) * 100 : 0;
  const showClock = clock?.available && clock.elapsedMs > 0;
  const throughput = showClock ? s.settled / Math.max(0.001, clock!.elapsedMs / 1000) : null;

  return (
    <div className="grid min-h-full grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(320px,0.9fr)_minmax(260px,1fr)_minmax(320px,1.4fr)]">
      <div className="grid auto-rows-min grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-2">
        <KPICard
          title="Success rate"
          value={s.settled ? `${successRate.toFixed(successRate === 100 || successRate === 0 ? 0 : 1)}%` : '-'}
          description={`${s.success} of ${s.settled} completed`}
        />
        <KPICard title="Failed" value={s.error} description={s.cancelled ? `${s.cancelled} cancelled` : s.pending + s.running ? `${s.pending + s.running} still queued` : 'non-2xx or no response'} />
        <KPICard title="p50 latency" value={s.durations.length ? formatMs(s.p50) : '-'} description={s.durations.length ? `avg ${formatMs(s.avg)}` : 'no responses yet'} />
        <KPICard title="p95 latency" value={s.durations.length ? formatMs(s.p95) : '-'} description={s.durations.length ? `max ${formatMs(s.max)}` : 'no responses yet'} />
        <KPICard
          title="Throughput"
          value={throughput !== null ? `${throughput.toFixed(1)}/s` : '-'}
          description={showClock ? `${formatClock(clock!.elapsedMs)} ${runState === 'running' ? 'elapsed' : 'active time'}` : 'not timed (restored run)'}
        />
        <KPICard title="Data received" value={formatBytes(s.totalBytes, 1)} description={s.settled ? `avg ${formatBytes(s.totalBytes / s.settled, 1)} / response` : '-'} />
      </div>
      <ChartCard title="Status codes" meta={`${s.settled} responses`} className="min-h-[220px]">
        <StatusCodeDistributionChart results={results} />
      </ChartCard>
      <ChartCard
        title="Response time"
        meta={
          s.durations.length ? (
            <span className="font-mono tabular-nums">
              p50 {Math.round(s.p50)} · p95 {Math.round(s.p95)} ms
            </span>
          ) : undefined
        }
        className="min-h-[220px]"
      >
        <div className="h-full min-h-[180px]">
          <ResponseTimeHistogram results={results} />
        </div>
      </ChartCard>
    </div>
  );
};
