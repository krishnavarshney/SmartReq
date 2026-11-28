import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { BulkResult } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Timer } from '../icons';
import { tooltipStyle, useChartTheme } from './chartTheme';

interface ResponseTimeHistogramProps {
  results: BulkResult[];
}

/** "Nice" bin width (1, 2, 5 x 10^n) so labels read cleanly. */
const niceStep = (raw: number) => {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  for (const m of [1, 2, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
};

export const buildHistogram = (durations: number[]) => {
  if (durations.length === 0) return null;
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const target = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(durations.length))));
  const step = niceStep((max - min) / target || 1);
  const start = Math.floor(min / step) * step;
  const binCount = Math.max(1, Math.floor((max - start) / step) + 1);
  const bins = new Array(binCount).fill(0) as number[];
  for (const d of durations) bins[Math.min(binCount - 1, Math.floor((d - start) / step))]++;
  const labels = bins.map((_, i) => `${start + i * step}`);
  const ranges = bins.map((_, i) => `${start + i * step}–${start + (i + 1) * step} ms`);
  return { bins, labels, ranges };
};

export const ResponseTimeHistogram: React.FC<ResponseTimeHistogramProps> = ({ results }) => {
  const theme = useChartTheme();
  const hist = useMemo(
    () =>
      buildHistogram(
        results.filter((r) => (r.status === 'success' || r.status === 'error') && r.response.status > 0).map((r) => r.response.duration)
      ),
    [results]
  );

  if (!hist) {
    return <EmptyState compact icon={<Timer />} message="Response times appear here once requests complete." />;
  }

  const data = {
    labels: hist.labels,
    datasets: [
      {
        label: 'Requests',
        data: hist.bins,
        backgroundColor: theme.primarySoft,
        hoverBackgroundColor: theme.primary,
        borderRadius: 4,
        borderSkipped: 'start' as const,
        categoryPercentage: 0.9,
        barPercentage: 0.92,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle(theme),
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => hist.ranges[items[0]?.dataIndex ?? 0],
          label: (ctx: { parsed: { y: number } }) => `${ctx.parsed.y} request${ctx.parsed.y === 1 ? '' : 's'}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Response time (ms, bin start)', color: theme.muted, font: { family: theme.fontSans, size: 11 } },
        ticks: { color: theme.muted, font: { family: theme.fontMono, size: 11 }, maxRotation: 0, autoSkipPadding: 8 },
        grid: { display: false },
        border: { color: theme.border },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Requests', color: theme.muted, font: { family: theme.fontSans, size: 11 } },
        ticks: { color: theme.muted, precision: 0, font: { family: theme.fontMono, size: 11 } },
        grid: { color: theme.grid },
        border: { display: false },
      },
    },
  };

  const summary = hist.bins.map((n, i) => `${hist.ranges[i]}: ${n}`).join(', ');
  return (
    <div className="h-full w-full" role="img" aria-label={`Response time histogram. ${summary}.`}>
      <Bar data={data} options={options} />
    </div>
  );
};
