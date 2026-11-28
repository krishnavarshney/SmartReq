import React from 'react';
import { formatDuration, formatMs } from '../../utils/formatters';
import { hasTiming, layoutPhases } from './utils';

interface TimeMetricsProps {
    timing?: Record<string, number>;
    total: number;
}

/** Compact timing breakdown for the status bar popover. */
export const TimeMetrics: React.FC<TimeMetricsProps> = ({ timing, total }) => {
    const available = hasTiming(timing);
    const phases = available ? layoutPhases(timing) : [];
    const span = Math.max(total, ...phases.map((p) => p.start + p.duration), 1);

    return (
        <div className="space-y-2.5">
            <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Response time</span>
                <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{formatDuration(total)}</span>
            </div>
            {available ? (
                <div className="space-y-1.5">
                    {phases.map((p) => (
                        <div key={p.name} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-2">
                            <span className="truncate text-muted-foreground">{p.name}</span>
                            <div className="relative h-1.5 rounded-full bg-muted">
                                <div
                                    className={`absolute inset-y-0 rounded-full ${p.color}`}
                                    style={{ left: `${(p.start / span) * 100}%`, width: `${Math.max((p.duration / span) * 100, p.duration > 0 ? 1.5 : 0)}%` }}
                                />
                            </div>
                            <span className="text-right font-mono tabular-nums text-foreground">{formatMs(p.duration)}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="leading-relaxed text-muted-foreground">
                    Phase breakdown unavailable. Browsers only expose DNS, connect and TTFB timings for cross-origin requests when the server sends a{' '}
                    <code className="rounded bg-muted px-1 font-mono text-[11px] text-foreground">Timing-Allow-Origin</code> header.
                </p>
            )}
        </div>
    );
};
