import React from 'react';
import { EmptyState } from '../ui/EmptyState';
import { Timer } from '../icons';
import { formatDuration, formatMs } from '../../utils/formatters';
import { PHASE_HINTS, hasTiming, layoutPhases } from './utils';

interface WaterfallPanelProps {
  timing?: Record<string, number>;
  total: number;
}

const niceStep = (span: number) => {
  const raw = span / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 0.001))));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
};

/**
 * Request timeline built only from the browser's PerformanceResourceTiming
 * entry. When the browser withholds it, say so instead of inventing numbers.
 */
export const WaterfallPanel: React.FC<WaterfallPanelProps> = ({ timing, total }) => {
  if (!hasTiming(timing)) {
    return (
      <EmptyState
        icon={<Timer />}
        title="Timing breakdown unavailable"
        message={
          <>
            The browser only shares per-phase timings (DNS, connect, TLS, time to first byte) for cross-origin requests when the server sends a{' '}
            <code className="rounded bg-muted px-1 font-mono text-[12px] text-foreground">Timing-Allow-Origin</code> header that allows this page. Total time
            measured by SmartReq: <span className="font-mono text-foreground">{formatDuration(total)}</span>.
          </>
        }
      />
    );
  }

  const phases = layoutPhases(timing);
  const measured = phases.reduce((end, p) => Math.max(end, p.start + p.duration), 0);
  const span = Math.max(measured, 0.001);
  const step = niceStep(span);
  const ticks: number[] = [];
  for (let t = 0; t <= span + 1e-9; t += step) ticks.push(t);
  const overhead = Math.max(0, total - measured);

  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Network</div>
          <div className="font-mono text-lg font-semibold tabular-nums">{formatMs(measured)}</div>
        </div>
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="font-mono text-lg font-semibold tabular-nums">{formatDuration(total)}</div>
        </div>
        <p className="min-w-[14rem] flex-1 text-xs text-muted-foreground">
          From the browser's resource timing entry. Total also includes queueing, redirects and reading the body
          {overhead > 0 ? ` (${formatMs(overhead)} outside the measured phases)` : ''}.
        </p>
      </div>

      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-[minmax(7rem,9rem)_1fr_4.5rem] items-center gap-3 border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Phase</span>
          <div className="relative h-4">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2 font-mono tabular-nums first:translate-x-0" style={{ left: `${(t / span) * 100}%` }}>
                {t === 0 ? '0' : formatMs(t).replace(' ms', '')}
              </span>
            ))}
          </div>
          <span className="text-right font-medium uppercase tracking-wide">ms</span>
        </div>
        <ul>
          {phases.map((p) => (
            <li
              key={p.name}
              className="grid grid-cols-[minmax(7rem,9rem)_1fr_4.5rem] items-center gap-3 border-b border-border/60 px-3 py-2 last:border-b-0"
              title={PHASE_HINTS[p.name]}
            >
              <span className="flex items-center gap-2 text-xs text-foreground">
                <span className={`h-2 w-2 flex-shrink-0 rounded-sm ${p.color}`} aria-hidden="true" />
                <span className="truncate">{p.name}</span>
              </span>
              <div className="relative h-5">
                {ticks.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-border/60" style={{ left: `${(t / span) * 100}%` }} aria-hidden="true" />
                ))}
                {p.duration > 0 && (
                  <span
                    className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-sm ${p.color}`}
                    style={{ left: `${(p.start / span) * 100}%`, width: `max(2px, ${(p.duration / span) * 100}%)` }}
                  />
                )}
              </div>
              <span className={`text-right font-mono text-xs tabular-nums ${p.duration > 0 ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                {formatMs(p.duration)}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
        {phases.map((p) =>
          PHASE_HINTS[p.name] ? (
            <div key={p.name} className="flex gap-2">
              <dt className="flex-shrink-0 text-foreground">{p.name}</dt>
              <dd className="text-muted-foreground">{PHASE_HINTS[p.name]}</dd>
            </div>
          ) : null
        )}
      </dl>
    </div>
  );
};
