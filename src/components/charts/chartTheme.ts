import { useEffect, useState } from 'react';

/** Chart colors resolved from the design tokens in src/styles/index.css. */
export interface ChartTheme {
  foreground: string;
  muted: string;
  grid: string;
  surface: string;
  popover: string;
  popoverForeground: string;
  border: string;
  primary: string;
  primarySoft: string;
  success: string;
  info: string;
  warning: string;
  destructive: string;
  neutral: string;
  fontSans: string;
  fontMono: string;
}

const readTheme = (): ChartTheme => {
  const css = getComputedStyle(document.documentElement);
  // Triplet tokens ("240 5% 93%") become hsl(); full color tokens are used as-is.
  const hsl = (name: string, alpha?: number) => {
    const v = css.getPropertyValue(name).trim();
    if (!v) return 'transparent';
    return alpha === undefined ? `hsl(${v})` : `hsl(${v} / ${alpha})`;
  };
  return {
    foreground: hsl('--foreground'),
    muted: hsl('--muted-foreground'),
    grid: hsl('--border', 0.7),
    surface: hsl('--card'),
    popover: hsl('--popover'),
    popoverForeground: hsl('--popover-foreground'),
    border: hsl('--border'),
    primary: hsl('--primary'),
    primarySoft: hsl('--primary', 0.75),
    success: hsl('--success'),
    info: hsl('--info'),
    warning: hsl('--warning'),
    destructive: hsl('--destructive'),
    neutral: hsl('--muted-foreground', 0.6),
    fontSans: getComputedStyle(document.body).fontFamily || 'Inter, system-ui, sans-serif',
    fontMono: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace',
  };
};

/**
 * Reads the chart palette from CSS variables and re-reads it whenever the theme
 * class on <html> changes, so light and dark both render with the right tokens.
 */
export const useChartTheme = (): ChartTheme => {
  const [theme, setTheme] = useState<ChartTheme>(readTheme);
  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
};

/** Shared tooltip styling so chart.js tooltips look like app popovers. */
export const tooltipStyle = (t: ChartTheme) => ({
  backgroundColor: t.popover,
  titleColor: t.popoverForeground,
  bodyColor: t.popoverForeground,
  borderColor: t.border,
  borderWidth: 1,
  padding: 8,
  cornerRadius: 6,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 4,
  usePointStyle: true,
  titleFont: { family: t.fontSans, size: 12, weight: 600 as const },
  bodyFont: { family: t.fontMono, size: 12 },
});
