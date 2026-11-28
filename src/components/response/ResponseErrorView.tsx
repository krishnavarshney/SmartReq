import React from 'react';
import { WifiOff, Clock, Ban } from 'lucide-react';
import { ExternalLink, Copy } from '../icons';
import { ApiResponse, FinalApiRequest } from '../../types';
import { Button } from '../ui/Button';
import { getMethodClass } from '../../utils/http-ui';
import { formatDuration } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

interface ResponseErrorViewProps {
    response: ApiResponse;
    request?: FinalApiRequest;
}

const getMessage = (body: unknown): string => {
    if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.message === 'string' && b.message) return b.message;
        if (typeof b.error === 'string' && b.error) return b.error;
    }
    if (typeof body === 'string' && body) return body;
    return 'The request did not complete.';
};

const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <code className="rounded bg-muted px-1 font-mono text-[12px] text-foreground">{children}</code>
);

/** Shown when the request never produced an HTTP response (status 0). */
export const ResponseErrorView: React.FC<ResponseErrorViewProps> = ({ response, request }) => {
    const { addToast } = useToast();
    const message = getMessage(response.body);
    const statusText = (response.statusText || '').toLowerCase();
    const isTimeout = statusText.includes('timeout') || /timed? ?out/i.test(message);
    const isCancelled = !isTimeout && (statusText.includes('cancel') || statusText.includes('abort') || /aborted|cancel/i.test(message));
    const url = request?.url || '';
    let target: URL | null = null;
    try {
        target = url ? new URL(url) : null;
    } catch {
        target = null;
    }
    const invalidUrl = !!url && !target;
    const mixedContent = window.location.protocol === 'https:' && target?.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(target.hostname);
    const timeoutMs = request?.settings?.timeoutMs;

    let Icon = WifiOff;
    let title = 'Could not get a response';
    let lead = "The browser couldn't complete this request, and for security reasons it doesn't say exactly why. The most common causes:";
    const hints: React.ReactNode[] = [];

    if (isTimeout) {
        Icon = Clock;
        title = 'Request timed out';
        lead = `No response arrived within ${timeoutMs ? formatDuration(timeoutMs) : 'the time limit'}.`;
        hints.push(<>The server may be slow or unreachable. Check that it is running and responding.</>);
        hints.push(<>Increase the timeout in the request's Settings tab if this endpoint is expected to be slow.</>);
    } else if (isCancelled) {
        Icon = Ban;
        title = 'Request cancelled';
        lead = 'The request was stopped before a response arrived.';
    } else if (invalidUrl) {
        title = 'Invalid URL';
        lead = 'The URL could not be parsed. Make sure it starts with http:// or https:// and that all variables resolve.';
    } else {
        hints.push(
            <>
                <span className="font-medium text-foreground">Server unreachable.</span> Check that the URL is right and that the server
                {target ? (
                    <>
                        {' '}at <Code>{target.host}</Code>
                    </>
                ) : null}{' '}
                is running.
            </>
        );
        hints.push(
            <>
                <span className="font-medium text-foreground">CORS.</span> Cross-origin APIs must answer with <Code>Access-Control-Allow-Origin</Code> allowing{' '}
                <Code>{window.location.origin}</Code>, and handle the <Code>OPTIONS</Code> preflight for custom headers or methods.
            </>
        );
        if (mixedContent) {
            hints.push(
                <>
                    <span className="font-medium text-foreground">Mixed content.</span> This page is served over HTTPS, so the browser blocks plain{' '}
                    <Code>http://</Code> requests. Use the HTTPS endpoint.
                </>
            );
        }
        if (target?.protocol === 'https:') {
            hints.push(
                <>
                    <span className="font-medium text-foreground">Certificate.</span> Self-signed or invalid TLS certificates are rejected. Open the URL in a
                    new tab to inspect or accept it.
                </>
            );
        }
        hints.push(<>The browser console (DevTools) shows the exact reason the request was blocked.</>);
    }

    const copyDetails = () => {
        const text = [`${request?.method ?? ''} ${url}`.trim(), `${response.statusText}: ${message}`].join('\n');
        navigator.clipboard.writeText(text).then(
            () => addToast('Error details copied.', 'success'),
            () => addToast('Could not copy to the clipboard.', 'error')
        );
    };

    return (
        <div className="h-full min-h-0 overflow-auto">
            <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8 sm:py-10 animate-fade-in">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-destructive/25 bg-destructive-bg text-destructive-text">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{lead}</p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                    {url && (
                        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 font-mono text-xs">
                            {request?.method && <span className={`font-semibold ${getMethodClass(request.method)}`}>{request.method}</span>}
                            <span className="min-w-0 truncate text-foreground" title={url}>
                                {url}
                            </span>
                        </div>
                    )}
                    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <p className="min-w-0 break-words font-mono text-xs text-destructive-text">{message}</p>
                        <span className="flex-shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">after {formatDuration(response.duration)}</span>
                    </div>
                </div>

                {hints.length > 0 && (
                    <ul className="space-y-2 text-[13px] leading-relaxed text-muted-foreground">
                        {hints.map((h, i) => (
                            <li key={i} className="flex gap-2.5">
                                <span className="mt-[9px] h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
                                <span>{h}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={copyDetails}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy error
                    </Button>
                    {target && (target.protocol === 'http:' || target.protocol === 'https:') && (
                        <Button size="sm" variant="ghost" onClick={() => window.open(target!.href, '_blank', 'noopener,noreferrer')}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open URL in new tab
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
