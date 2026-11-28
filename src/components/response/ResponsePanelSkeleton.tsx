import React, { useEffect, useState } from 'react';
import { Spinner } from '../ui/Spinner';
import { formatDuration } from '../../utils/formatters';

interface ResponsePanelSkeletonProps {
    /** performance.now() / Date.now() timestamp when the request started. */
    startedAt?: number;
}

const WIDTHS = [38, 62, 54, 71, 46, 58, 33, 66, 49, 41];

/** Loading state: elapsed time plus a calm placeholder of the body. */
export const ResponsePanelSkeleton: React.FC<ResponsePanelSkeletonProps> = ({ startedAt }) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 100);
        return () => window.clearInterval(id);
    }, []);
    const elapsed = startedAt ? Math.max(0, now - startedAt) : 0;

    return (
        <div className="flex h-full min-h-0 flex-col" role="status" aria-live="polite" aria-label="Sending request">
            <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border px-3 text-xs">
                <Spinner className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium text-foreground">Sending request</span>
                {startedAt !== undefined && <span className="font-mono tabular-nums text-muted-foreground">{formatDuration(elapsed)}</span>}
                {elapsed > 5000 && <span className="hidden text-muted-foreground sm:inline">· still waiting for the server</span>}
            </div>
            <div className="flex h-9 flex-shrink-0 items-center gap-4 border-b border-border px-3">
                {[36, 52, 44, 32].map((w, i) => (
                    <div key={i} className="h-2.5 rounded bg-muted" style={{ width: w }} />
                ))}
            </div>
            <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-4 animate-pulse">
                {WIDTHS.map((w, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-2.5 w-4 rounded bg-muted/70" />
                        <div className="h-2.5 rounded bg-muted" style={{ width: `${w}%`, marginLeft: `${(i % 3) * 16}px` }} />
                    </div>
                ))}
            </div>
        </div>
    );
};
