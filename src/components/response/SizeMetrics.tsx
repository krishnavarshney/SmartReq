import React from 'react';
import { ApiResponse, FinalApiRequest } from '../../types';
import { formatBytes } from '../../utils/formatters';

interface SizeMetricsProps {
    requestSize?: FinalApiRequest['size'];
    responseSize?: ApiResponse['size'];
}

const Section: React.FC<{ title: string; size?: { headers: number; body: number; total: number } }> = ({ title, size }) => (
    <div className="space-y-1">
        <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
            <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{size ? formatBytes(size.total) : '—'}</span>
        </div>
        {size && (
            <>
                <div className="flex justify-between text-muted-foreground">
                    <span>Headers</span>
                    <span className="font-mono tabular-nums">{formatBytes(size.headers)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                    <span>Body</span>
                    <span className="font-mono tabular-nums">{formatBytes(size.body)}</span>
                </div>
            </>
        )}
    </div>
);

/** Size breakdown for the status bar popover. Sizes are of the decoded content. */
export const SizeMetrics: React.FC<SizeMetricsProps> = ({ requestSize, responseSize }) => (
    <div className="space-y-3">
        <Section title="Response" size={responseSize} />
        {requestSize && (
            <>
                <div className="h-px bg-border" />
                <Section title="Request" size={requestSize} />
            </>
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">Measured on the decoded body; transfer size over the wire may be smaller when compressed.</p>
    </div>
);
