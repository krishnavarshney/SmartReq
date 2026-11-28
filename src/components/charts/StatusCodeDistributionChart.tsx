import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BulkResult } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { ChartBar } from '../icons';
import { getStatusTone, StatusTone } from '../../utils/http-ui';
import { tooltipStyle, useChartTheme } from './chartTheme';

interface StatusCodeDistributionChartProps {
  results: BulkResult[];
}

interface Bucket {
  key: string;
  /** Short axis label: the code, or the failure reason when there was no response. */
  label: string;
  /** Full label for tooltips and the accessible summary. */
  title: string;
  count: number;
  tone: StatusTone;
}

/** Count of settled results per exact status code (network failures grouped by reason). */
export const getStatusBuckets = (results: BulkResult[]): Bucket[] => {
  const map = new Map<string, Bucket>();
  for (const r of results) {
    if (r.status !== 'success' && r.status !== 'error') continue;
    const code = r.response.status;
    const key = code > 0 ? String(code) : `0-${r.response.statusText || 'Failed'}`;
    const label = code > 0 ? String(code) : r.response.statusText || 'Failed';
    const title = code > 0 ? `${code}${r.response.statusText ? ` ${r.response.statusText}` : ''}` : `${label} (no response)`;
    const existing = map.get(key);
    if (existing) existing.count++;
    else map.set(key, { key, label, title, count: 1, tone: getStatusTone(code) });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
};

export const StatusCodeDistributionChart: React.FC<StatusCodeDistributionChartProps> = ({ results }) => {
  const theme = useChartTheme();
  const buckets = useMemo(() => getStatusBuckets(results), [results]);

  if (buckets.length === 0) {
    return <EmptyState compact icon={<ChartBar />} message="Status codes appear here once requests complete." />;
  }

  const toneColor: Record<StatusTone, string> = {
    success: theme.success,
    info: theme.info,
    warning: theme.warning,
    error: theme.destructive,
    neutral: theme.neutral,
  };
  const total = buckets.reduce((a, b) => a + b.count, 0);

  const data = {
    labels: buckets.map((b) => b.label),
    datasets: [
      {
        label: 'Requests',
        data: buckets.map((b) => b.count),
        backgroundColor: buckets.map((b) => toneColor[b.tone]),
        borderRadius: 4,
        borderSkipped: 'start' as const,
        barThickness: 18,
        maxBarThickness: 18,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle(theme),
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => buckets[items[0]?.dataIndex ?? 0]?.title ?? '',
          label: (ctx: { parsed: { x: number } }) => `${ctx.parsed.x} request${ctx.parsed.x === 1 ? '' : 's'} (${Math.round((ctx.parsed.x / total) * 100)}%)`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { color: theme.muted, precision: 0, font: { family: theme.fontMono, size: 11 } },
        grid: { color: theme.grid },
        border: { display: false },
      },
      y: {
        ticks: { color: theme.foreground, font: { family: theme.fontMono, size: 11 } },
        grid: { display: false },
        border: { color: theme.border },
      },
    },
  };

  const summary = buckets.map((b) => `${b.title}: ${b.count}`).join(', ');
  // Keep bar height constant; the card scrolls if there are many distinct codes.
  const height = Math.max(120, buckets.length * 30 + 40);

  return (
    <div className="w-full" style={{ height }} role="img" aria-label={`Status code distribution. ${summary}.`}>
      <Bar data={data} options={options} />
    </div>
  );
};
