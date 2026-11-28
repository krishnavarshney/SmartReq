import React, { useEffect, useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { EmptyState } from '../ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ChartBar } from '../icons';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, PointElement, LineElement, Filler);

interface VisualizationPanelProps {
  data: any;
}

interface Candidate {
  path: string;
  array: Record<string, any>[];
  labelKeys: string[];
  valueKeys: string[];
}

const MAX_POINTS = 200;

const analyze = (path: string, array: any[]): Candidate | null => {
  const rows = array.filter((r) => typeof r === 'object' && r !== null && !Array.isArray(r));
  if (rows.length < 1 || rows.length < array.length * 0.8) return null;
  const sample = rows.slice(0, 200);
  const keys = Array.from(new Set(sample.flatMap((r) => Object.keys(r))));
  const valueKeys = keys.filter((k) => sample.some((r) => typeof r[k] === 'number') && sample.every((r) => r[k] == null || typeof r[k] === 'number'));
  const labelKeys = keys.filter((k) => sample.every((r) => r[k] == null || typeof r[k] === 'string' || typeof r[k] === 'number'));
  if (valueKeys.length === 0) return null;
  return { path, array: rows, labelKeys, valueKeys };
};

/** Arrays of objects with at least one numeric field, at the root or one level down. */
export const findVisualizableData = (data: any): Candidate[] => {
  const out: Candidate[] = [];
  if (Array.isArray(data)) {
    const c = analyze('root', data);
    if (c) out.push(c);
  } else if (typeof data === 'object' && data !== null) {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        const c = analyze(key, data[key]);
        if (c) out.push(c);
      }
    }
  }
  return out;
};

const readVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Re-read theme colors whenever the <html> class (light/dark) changes. */
const useThemeColors = () => {
  const read = () => ({
    primary: `hsl(${readVar('--primary')})`,
    primaryHover: `hsl(${readVar('--primary')} / 0.8)`,
    primaryFill: `hsl(${readVar('--primary')} / 0.12)`,
    text: `hsl(${readVar('--muted-foreground')})`,
    grid: `hsl(${readVar('--border')})`,
    surface: `hsl(${readVar('--card')})`,
    popover: `hsl(${readVar('--popover')})`,
    popoverText: `hsl(${readVar('--popover-foreground')})`,
  });
  const [colors, setColors] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    return () => obs.disconnect();
  }, []);
  return colors;
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex min-w-[9rem] flex-1 flex-col gap-1 sm:max-w-[14rem]">
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    {children}
  </label>
);

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ data }) => {
  const candidates = useMemo(() => findVisualizableData(data), [data]);
  const [path, setPath] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [labelKey, setLabelKey] = useState('');
  const [valueKey, setValueKey] = useState('');
  const colors = useThemeColors();

  const current = candidates.find((c) => c.path === path) ?? candidates[0];

  // Pick sensible defaults whenever the data set changes.
  useEffect(() => {
    if (!current) return;
    if (!current.labelKeys.includes(labelKey)) {
      const preferred = current.labelKeys.find((k) => /name|title|label|date|time|key/i.test(k)) ?? current.labelKeys.find((k) => k !== current.valueKeys[0]) ?? '';
      setLabelKey(preferred);
    }
    if (!current.valueKeys.includes(valueKey)) setValueKey(current.valueKeys.find((k) => !/^id$/i.test(k)) ?? current.valueKeys[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) {
    return (
      <EmptyState
        icon={<ChartBar />}
        title="Nothing to chart"
        message="Visualize works with an array of objects that has at least one numeric field, at the root or one level down."
      />
    );
  }

  const rows = current.array.slice(0, MAX_POINTS);
  const labels = rows.map((r, i) => (labelKey ? String(r[labelKey] ?? `#${i}`) : `#${i}`));
  const values = rows.map((r) => (typeof r[valueKey] === 'number' ? r[valueKey] : null));

  const chartData = {
    labels,
    datasets: [
      {
        label: valueKey,
        data: values,
        backgroundColor: chartType === 'bar' ? colors.primary : colors.primaryFill,
        hoverBackgroundColor: colors.primaryHover,
        borderColor: colors.primary,
        borderWidth: chartType === 'line' ? 2 : 0,
        borderRadius: 4,
        maxBarThickness: 28,
        pointRadius: rows.length > 40 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: colors.primary,
        pointBorderColor: colors.surface,
        pointBorderWidth: 2,
        fill: chartType === 'line',
        tension: 0.25,
        spanGaps: true,
      },
    ],
  };

  const options: any = {
    maintainAspectRatio: false,
    animation: { duration: 200 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: colors.popover,
        titleColor: colors.popoverText,
        bodyColor: colors.popoverText,
        borderColor: colors.grid,
        borderWidth: 1,
        padding: 8,
        displayColors: false,
        callbacks: { label: (ctx: any) => `${valueKey}: ${ctx.raw ?? 'null'}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: colors.grid }, ticks: { color: colors.text, maxRotation: 0, autoSkipPadding: 12, font: { size: 11 } } },
      y: { beginAtZero: true, grid: { color: colors.grid }, border: { display: false }, ticks: { color: colors.text, font: { size: 11 } } },
    },
  };

  const nullCount = values.filter((v) => v === null).length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-3">
        {candidates.length > 1 && (
          <Field label="Data">
            <Select value={current.path} onValueChange={setPath}>
              <SelectTrigger aria-label="Data set">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.path} value={c.path}>
                    {c.path === 'root' ? 'root' : c.path} ({c.array.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label="Label">
          <Select value={labelKey} onValueChange={setLabelKey}>
            <SelectTrigger aria-label="Label field">
              <SelectValue placeholder="Index" />
            </SelectTrigger>
            <SelectContent>
              {current.labelKeys.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Value">
          <Select value={valueKey} onValueChange={setValueKey}>
            <SelectTrigger aria-label="Value field">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {current.valueKeys.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <SegmentedControl
          aria-label="Chart type"
          value={chartType}
          onChange={(v) => setChartType(v as 'bar' | 'line')}
          options={[
            { value: 'bar', label: 'Bar' },
            { value: 'line', label: 'Line' },
          ]}
        />
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-medium text-foreground">
          {valueKey} <span className="text-muted-foreground">by {labelKey || 'index'}</span>
        </h3>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {current.array.length > MAX_POINTS ? `First ${MAX_POINTS} of ${current.array.length}` : `${rows.length} points`}
          {nullCount > 0 ? ` · ${nullCount} empty` : ''}
        </span>
      </div>
      <div className="relative mt-2 min-h-[240px] flex-1">
        {chartType === 'bar' ? <Bar data={chartData} options={options} /> : <Line data={chartData} options={options} />}
      </div>
    </div>
  );
};
