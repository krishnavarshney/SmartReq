import React, { useMemo, useState } from 'react';
import { Copy, Check, Search, Info } from '../icons';
import { IconButton, Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../context/ToastContext';

interface HeadersPanelProps {
    headers: Record<string, string>;
    requestUrl?: string;
}

const isCrossOrigin = (url?: string) => {
    try {
        return !!url && new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
};

export const HeadersPanel: React.FC<HeadersPanelProps> = ({ headers, requestUrl }) => {
    const [filter, setFilter] = useState('');
    const [copied, setCopied] = useState<string | null>(null);
    const { addToast } = useToast();
    const entries = useMemo(() => Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)), [headers]);
    const shown = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return entries;
        return entries.filter(([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q));
    }, [entries, filter]);

    const copy = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(
            () => {
                setCopied(key);
                window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
            },
            () => addToast('Could not copy to the clipboard.', 'error')
        );
    };

    const crossOrigin = isCrossOrigin(requestUrl);
    const exposesAll = Object.keys(headers).some((k) => k.toLowerCase() === 'access-control-expose-headers');

    if (entries.length === 0) {
        return <EmptyState compact icon={<Info />} title="No headers" message="The response didn't include any headers the browser could read." />;
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border px-2">
                <div className="w-full max-w-[16rem]">
                    <Input size="sm" icon={<Search />} placeholder="Filter headers" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter headers" />
                </div>
                <span className="flex-1" />
                <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
                    {shown.length === entries.length ? `${entries.length} headers` : `${shown.length} of ${entries.length}`}
                </span>
                <Button size="sm" variant="ghost" onClick={() => copy(entries.map(([k, v]) => `${k}: ${v}`).join('\n'), '__all')}>
                    {copied === '__all' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy all
                </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
                {shown.length === 0 ? (
                    <EmptyState compact message={`No headers match "${filter}".`} />
                ) : (
                    <table className="w-full border-separate border-spacing-0 font-mono text-xs">
                        <tbody>
                            {shown.map(([k, v]) => (
                                <tr key={k} className="group hover:[&>td]:bg-accent/40">
                                    <td className="w-[35%] min-w-[9rem] border-b border-border/60 py-1.5 pl-3 pr-3 align-top text-muted-foreground [overflow-wrap:anywhere]">{k}</td>
                                    <td className="border-b border-border/60 py-1.5 pr-1 align-top text-foreground [overflow-wrap:anywhere]">{String(v)}</td>
                                    <td className="w-9 border-b border-border/60 py-0.5 pr-1 align-top">
                                        <Tooltip content={copied === k ? 'Copied' : 'Copy value'}>
                                            <IconButton
                                                size="xs"
                                                aria-label={`Copy ${k} value`}
                                                onClick={() => copy(String(v), k)}
                                                className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                                            >
                                                {copied === k ? <Check /> : <Copy />}
                                            </IconButton>
                                        </Tooltip>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {crossOrigin && (
                    <p className="flex items-start gap-1.5 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
                        <Info className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                        <span>
                            Cross-origin response: the browser only exposes CORS-safelisted headers plus those the server lists in{' '}
                            <code className="font-mono">Access-Control-Expose-Headers</code>
                            {exposesAll ? '.' : ', so some headers the server sent may be missing here.'}
                        </span>
                    </p>
                )}
            </div>
        </div>
    );
};
