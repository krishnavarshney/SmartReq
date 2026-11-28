import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Diff, Hunk, getChangeKey, markEdits, tokenize } from 'react-diff-view';
import type { ChangeData, HunkData } from 'react-diff-view';
import { structuredPatch } from 'diff';
import { GitCompareArrows } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ApiResponse, SingleRequestLog } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Checkbox } from '../ui/Checkbox';
import { Button, IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, CheckCircle2, History } from '../icons';
import { formatBytes, formatDuration } from '../../utils/formatters';
import { getStatusTone } from '../../utils/http-ui';
import { statusLabel } from '../response/utils';

interface ResponseDiffModalProps {
    currentResponse: ApiResponse;
    /** Earlier responses to choose from. Entries matching the current one are ignored. */
    history: SingleRequestLog[];
    onClose: () => void;
    currentLogId?: number;
    currentTimestamp?: string;
}

type Section = 'body' | 'headers' | 'changes';

const MAX_DIFF_CHARS = 400_000;

/** Theme react-diff-view through its CSS variables so both themes read well. */
const DIFF_THEME = {
    '--diff-background-color': 'transparent',
    '--diff-text-color': 'hsl(var(--foreground))',
    '--diff-font-family': "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
    '--diff-code-insert-background-color': 'hsl(var(--success) / 0.12)',
    '--diff-code-insert-text-color': 'hsl(var(--foreground))',
    '--diff-code-insert-edit-background-color': 'hsl(var(--success) / 0.3)',
    '--diff-code-insert-edit-text-color': 'hsl(var(--foreground))',
    '--diff-code-delete-background-color': 'hsl(var(--destructive) / 0.12)',
    '--diff-code-delete-text-color': 'hsl(var(--foreground))',
    '--diff-code-delete-edit-background-color': 'hsl(var(--destructive) / 0.3)',
    '--diff-code-delete-edit-text-color': 'hsl(var(--foreground))',
    '--diff-gutter-insert-background-color': 'hsl(var(--success) / 0.18)',
    '--diff-gutter-insert-text-color': 'hsl(var(--muted-foreground))',
    '--diff-gutter-delete-background-color': 'hsl(var(--destructive) / 0.18)',
    '--diff-gutter-delete-text-color': 'hsl(var(--muted-foreground))',
    '--diff-code-selected-background-color': 'hsl(var(--primary) / 0.15)',
    '--diff-gutter-selected-background-color': 'hsl(var(--primary) / 0.2)',
    '--diff-selection-background-color': 'hsl(var(--primary) / 0.3)',
    '--diff-omit-gutter-line-color': 'hsl(var(--border))',
} as React.CSSProperties;

const tryParseJson = (value: unknown): any | null => {
    if (typeof value === 'object' && value !== null) return value;
    if (typeof value !== 'string') return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const stableStringify = (obj: any): string => {
    const seen = new WeakSet();
    const sorter = (value: any): any => {
        if (value && typeof value === 'object') {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
            if (Array.isArray(value)) return value.map(sorter);
            return Object.keys(value)
                .sort()
                .reduce((acc: any, key) => {
                    acc[key] = sorter(value[key]);
                    return acc;
                }, {});
        }
        return value;
    };
    return JSON.stringify(sorter(obj), null, 2);
};

const formatHeadersForDiff = (response: ApiResponse) =>
    Object.entries(response.headers || {})
        .filter(([k]) => k.toLowerCase() !== 'date')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

const formatBodyForDiff = (response: ApiResponse, normalizeJson: boolean) => {
    const parsed = tryParseJson(response.body);
    if (parsed !== null) return normalizeJson ? stableStringify(parsed) : JSON.stringify(parsed, null, 2);
    return typeof response.body === 'string' ? response.body : String(response.body ?? '');
};

/** jsdiff structured hunks -> react-diff-view (gitdiff-parser) hunks. */
const toHunks = (oldText: string, newText: string): HunkData[] => {
    if (oldText === newText) return [];
    const patch = structuredPatch('a', 'b', oldText, newText, '', '', { context: 4 });
    return patch.hunks.map((h) => {
        let oldLine = h.oldStart;
        let newLine = h.newStart;
        const changes: ChangeData[] = [];
        h.lines.forEach((line) => {
            const sign = line[0];
            const content = line.slice(1);
            if (sign === '+') changes.push({ type: 'insert', isInsert: true, lineNumber: newLine++, content });
            else if (sign === '-') changes.push({ type: 'delete', isDelete: true, lineNumber: oldLine++, content });
            else if (sign === ' ') changes.push({ type: 'normal', isNormal: true, oldLineNumber: oldLine++, newLineNumber: newLine++, content });
        });
        return {
            content: `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
            oldStart: h.oldStart,
            newStart: h.newStart,
            oldLines: h.oldLines,
            newLines: h.newLines,
            changes,
        };
    });
};

/** Keys of the first line of each contiguous block of changes, for prev/next navigation. */
const changeBlocks = (hunks: HunkData[]) => {
    const keys: string[] = [];
    let inBlock = false;
    hunks.forEach((h) => {
        h.changes.forEach((c) => {
            const changed = c.type !== 'normal';
            if (changed && !inBlock) keys.push(getChangeKey(c));
            inBlock = changed;
        });
        inBlock = false;
    });
    return keys;
};

const countLines = (hunks: HunkData[]) => {
    let added = 0;
    let removed = 0;
    hunks.forEach((h) =>
        h.changes.forEach((c) => {
            if (c.type === 'insert') added++;
            else if (c.type === 'delete') removed++;
        })
    );
    return { added, removed };
};

interface JsonChange {
    path: string;
    type: 'added' | 'removed' | 'changed';
    before?: any;
    after?: any;
}

const jsonChanges = (a: any, b: any): JsonChange[] => {
    const changes: JsonChange[] = [];
    const walk = (pa: any, pb: any, prefix: string) => {
        const isArr = Array.isArray(pa) && Array.isArray(pb);
        const keys = Array.from(new Set([...Object.keys(pa || {}), ...Object.keys(pb || {})]));
        if (!isArr) keys.sort();
        keys.forEach((k) => {
            const na = pa?.[k];
            const nb = pb?.[k];
            const path = isArr ? `${prefix}[${k}]` : prefix ? `${prefix}.${k}` : k;
            if (na === undefined && nb !== undefined) changes.push({ path, type: 'added', after: nb });
            else if (na !== undefined && nb === undefined) changes.push({ path, type: 'removed', before: na });
            else if (typeof na === 'object' && na !== null && typeof nb === 'object' && nb !== null && Array.isArray(na) === Array.isArray(nb)) walk(na, nb, path);
            else if (JSON.stringify(na) !== JSON.stringify(nb)) changes.push({ path, type: 'changed', before: na, after: nb });
        });
    };
    if (typeof a === 'object' && typeof b === 'object') walk(a, b, '');
    return changes;
};

const preview = (v: any) => {
    const s = JSON.stringify(v);
    if (s === undefined) return 'undefined';
    return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

const formatWhen = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return sameDay ? d.toLocaleTimeString() : d.toLocaleString();
};

const Delta: React.FC<{ before: number; after: number; format: (n: number) => string }> = ({ before, after, format }) => {
    const diff = after - before;
    if (Math.abs(diff) < 0.5) return <span className="text-[11px] text-muted-foreground">no change</span>;
    const worse = diff > 0;
    return (
        <span className={`inline-flex items-center gap-0.5 font-mono text-[11px] tabular-nums ${worse ? 'text-warning-text' : 'text-success-text'}`}>
            {worse ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {format(Math.abs(diff))}
        </span>
    );
};

const Metric: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="min-w-0 flex-1 px-4 py-2.5">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">{children}</div>
    </div>
);

export const ResponseDiffModal: React.FC<ResponseDiffModalProps> = ({ currentResponse, history, onClose, currentLogId, currentTimestamp }) => {
    const candidates = useMemo(
        () =>
            history
                .filter((h) => h?.response && h.response !== currentResponse && (currentLogId === undefined || h.id !== currentLogId || currentLogId === 0))
                .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
        [history, currentResponse, currentLogId]
    );
    const [selectedLogId, setSelectedLogId] = useState<string>(candidates[0] ? String(candidates[0].id) : '');
    const [viewType, setViewType] = useState<'split' | 'unified'>(() => (window.innerWidth < 900 ? 'unified' : 'split'));
    const [normalizeJson, setNormalizeJson] = useState(true);
    const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
    const [section, setSection] = useState<Section>('body');
    const [cursor, setCursor] = useState(-1);
    const scrollRef = useRef<HTMLDivElement>(null);

    const selectedLog = candidates.find((log) => String(log.id) === selectedLogId);
    const previous = selectedLog?.response;

    const prepared = useMemo(() => {
        if (!previous) return null;
        let oldBody = formatBodyForDiff(previous, normalizeJson);
        let newBody = formatBodyForDiff(currentResponse, normalizeJson);
        const truncated = oldBody.length > MAX_DIFF_CHARS || newBody.length > MAX_DIFF_CHARS;
        oldBody = oldBody.slice(0, MAX_DIFF_CHARS);
        newBody = newBody.slice(0, MAX_DIFF_CHARS);
        if (ignoreWhitespace) {
            oldBody = oldBody.replace(/[ \t]+$/gm, '');
            newBody = newBody.replace(/[ \t]+$/gm, '');
        }
        const bodyHunks = toHunks(oldBody, newBody);
        const headerHunks = toHunks(formatHeadersForDiff(previous), formatHeadersForDiff(currentResponse));
        const a = tryParseJson(previous.body);
        const b = tryParseJson(currentResponse.body);
        return {
            truncated,
            bodyHunks,
            headerHunks,
            bodyStats: countLines(bodyHunks),
            headerStats: countLines(headerHunks),
            isJson: a !== null && b !== null,
            summary: a !== null && b !== null ? jsonChanges(a, b) : [],
        };
    }, [previous, currentResponse, normalizeJson, ignoreWhitespace]);

    const hunks = prepared ? (section === 'headers' ? prepared.headerHunks : prepared.bodyHunks) : [];
    const tokens = useMemo(() => {
        if (hunks.length === 0) return undefined;
        try {
            return tokenize(hunks, { enhancers: [markEdits(hunks, { type: 'block' })] });
        } catch {
            return undefined;
        }
    }, [hunks]);
    const blocks = useMemo(() => changeBlocks(hunks), [hunks]);

    useEffect(() => setCursor(-1), [section, selectedLogId, normalizeJson, ignoreWhitespace]);

    const goTo = (index: number) => {
        if (blocks.length === 0) return;
        const next = (index + blocks.length) % blocks.length;
        setCursor(next);
        const el = scrollRef.current?.querySelector<HTMLElement>(`#diff-${blocks[next]}`);
        if (el && scrollRef.current) {
            const c = scrollRef.current.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            scrollRef.current.scrollTop += r.top - c.top - c.height / 3;
        }
    };

    const footer = <Button variant="secondary" onClick={onClose}>Close</Button>;

    if (candidates.length === 0) {
        return (
            <Modal show onClose={onClose} size="md" title="Compare responses" icon={<GitCompareArrows />} footer={footer}>
                <EmptyState
                    compact
                    icon={<History />}
                    title="Nothing to compare yet"
                    message="Responses of saved requests are kept in their history. Send this request again to compare the new response with this one."
                />
            </Modal>
        );
    }

    const stats = prepared ? (section === 'headers' ? prepared.headerStats : prepared.bodyStats) : { added: 0, removed: 0 };
    const sectionOptions = [
        { value: 'body', label: `Body${prepared && (prepared.bodyStats.added || prepared.bodyStats.removed) ? ' •' : ''}` },
        { value: 'headers', label: `Headers${prepared && (prepared.headerStats.added || prepared.headerStats.removed) ? ' •' : ''}` },
        ...(prepared?.isJson ? [{ value: 'changes', label: `Changed fields${prepared.summary.length ? ` (${prepared.summary.length})` : ''}` }] : []),
    ];

    return (
        <Modal
            show
            onClose={onClose}
            size="6xl"
            flush
            icon={<GitCompareArrows />}
            title="Compare responses"
            description="See what changed between an earlier response and the current one."
            footer={footer}
            className="sm:h-[min(860px,calc(100vh-3rem))]"
        >
            <div className="flex h-full min-h-0 flex-col">
                <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-3">
                    <label className="flex min-w-[14rem] flex-1 flex-col gap-1 sm:max-w-sm">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Earlier response</span>
                        <Select value={selectedLogId} onValueChange={setSelectedLogId}>
                            <SelectTrigger aria-label="Earlier response to compare with">
                                <SelectValue placeholder="Choose a response" />
                            </SelectTrigger>
                            <SelectContent>
                                {candidates.map((log) => (
                                    <SelectItem key={log.id} value={String(log.id)}>
                                        {formatWhen(log.timestamp)} · {statusLabel(log.response.status, log.response.statusText)} · {formatDuration(log.response.duration)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    <span className="hidden flex-1 sm:block" />
                    <SegmentedControl aria-label="Diff layout" size="sm" value={viewType} onChange={(v) => setViewType(v as 'split' | 'unified')} options={[{ value: 'split', label: 'Split' }, { value: 'unified', label: 'Unified' }]} />
                </div>

                {previous && (
                    <div className="flex flex-wrap divide-x divide-border border-b border-border bg-muted/30">
                        <Metric label="Status">
                            <Badge tone={getStatusTone(previous.status)}>{statusLabel(previous.status, previous.statusText)}</Badge>
                            <span className="text-muted-foreground">→</span>
                            <Badge tone={getStatusTone(currentResponse.status)}>{statusLabel(currentResponse.status, currentResponse.statusText)}</Badge>
                        </Metric>
                        <Metric label="Time">
                            <span className="font-mono tabular-nums text-muted-foreground">{formatDuration(previous.duration)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono tabular-nums">{formatDuration(currentResponse.duration)}</span>
                            <Delta before={previous.duration} after={currentResponse.duration} format={formatDuration} />
                        </Metric>
                        <Metric label="Size">
                            <span className="font-mono tabular-nums text-muted-foreground">{formatBytes(previous.size?.total || 0)}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono tabular-nums">{formatBytes(currentResponse.size?.total || 0)}</span>
                            <Delta before={previous.size?.total || 0} after={currentResponse.size?.total || 0} format={(n) => formatBytes(n)} />
                        </Metric>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5 py-2">
                    <SegmentedControl aria-label="What to compare" size="sm" value={section} onChange={(v) => setSection(v as Section)} options={sectionOptions} />
                    {section !== 'changes' && (stats.added > 0 || stats.removed > 0) && (
                        <span className="font-mono text-[11px] tabular-nums">
                            <span className="text-success-text">+{stats.added}</span> <span className="text-destructive-text">−{stats.removed}</span>
                        </span>
                    )}
                    <span className="flex-1" />
                    {section === 'body' && (
                        <>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                                <Checkbox checked={normalizeJson} onCheckedChange={setNormalizeJson} aria-label="Sort JSON keys" />
                                Sort JSON keys
                            </label>
                            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                                <Checkbox checked={ignoreWhitespace} onCheckedChange={setIgnoreWhitespace} aria-label="Ignore trailing whitespace" />
                                Ignore trailing whitespace
                            </label>
                        </>
                    )}
                    {section !== 'changes' && blocks.length > 0 && (
                        <span className="flex items-center gap-0.5">
                            <span className="mr-1 text-[11px] tabular-nums text-muted-foreground">
                                {cursor >= 0 ? `${cursor + 1} of ${blocks.length}` : `${blocks.length} change${blocks.length === 1 ? '' : 's'}`}
                            </span>
                            <Tooltip content="Previous change">
                                <IconButton size="xs" aria-label="Previous change" onClick={() => goTo(cursor <= 0 ? blocks.length - 1 : cursor - 1)}>
                                    <ChevronUp />
                                </IconButton>
                            </Tooltip>
                            <Tooltip content="Next change">
                                <IconButton size="xs" aria-label="Next change" onClick={() => goTo(cursor + 1)}>
                                    <ChevronDown />
                                </IconButton>
                            </Tooltip>
                        </span>
                    )}
                </div>

                <div ref={scrollRef} className="min-h-[16rem] flex-1 overflow-auto bg-card" style={DIFF_THEME}>
                    {!prepared ? (
                        <EmptyState compact message="Choose an earlier response to compare." />
                    ) : section === 'changes' ? (
                        prepared.summary.length === 0 ? (
                            <EmptyState compact icon={<CheckCircle2 />} title="No field changes" message="Both JSON bodies have the same fields and values." />
                        ) : (
                            <table className="w-full border-separate border-spacing-0 text-xs">
                                <thead>
                                    <tr className="text-left text-[11px] text-muted-foreground">
                                        <th className="sticky top-0 border-b border-border bg-card px-5 py-2 font-medium">Field</th>
                                        <th className="sticky top-0 border-b border-border bg-card px-3 py-2 font-medium">Change</th>
                                        <th className="sticky top-0 border-b border-border bg-card px-3 py-2 font-medium">Before</th>
                                        <th className="sticky top-0 border-b border-border bg-card px-3 py-2 font-medium">After</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {prepared.summary.slice(0, 2000).map((c, i) => (
                                        <tr key={i} className="align-top hover:[&>td]:bg-accent/40">
                                            <td className="border-b border-border/60 px-5 py-1.5 text-foreground [overflow-wrap:anywhere]">{c.path}</td>
                                            <td className="border-b border-border/60 px-3 py-1.5 font-sans">
                                                <Badge tone={c.type === 'added' ? 'success' : c.type === 'removed' ? 'error' : 'warning'}>{c.type}</Badge>
                                            </td>
                                            <td className="border-b border-border/60 px-3 py-1.5 text-muted-foreground [overflow-wrap:anywhere]">{c.type === 'added' ? '' : preview(c.before)}</td>
                                            <td className="border-b border-border/60 px-3 py-1.5 text-foreground [overflow-wrap:anywhere]">{c.type === 'removed' ? '' : preview(c.after)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : hunks.length === 0 ? (
                        <EmptyState
                            compact
                            icon={<CheckCircle2 />}
                            title={section === 'headers' ? 'Headers are identical' : 'Bodies are identical'}
                            message={section === 'headers' ? 'The Date header is ignored since it changes on every response.' : 'No differences with the current options.'}
                        />
                    ) : (
                        <>
                            {section === 'body' && prepared.truncated && (
                                <p className="border-b border-border bg-warning-bg px-5 py-1.5 text-xs text-warning-text">
                                    Large bodies: only the first {formatBytes(MAX_DIFF_CHARS)} of each are compared.
                                </p>
                            )}
                            <Diff
                                key={`${section}-${viewType}`}
                                viewType={viewType}
                                diffType="modify"
                                hunks={hunks}
                                tokens={tokens}
                                gutterType="anchor"
                                generateAnchorID={(change) => `diff-${getChangeKey(change)}`}
                            >
                                {(hs) => hs.map((h) => <Hunk key={h.content} hunk={h} />)}
                            </Diff>
                        </>
                    )}
                </div>
                {currentTimestamp && previous && (
                    <div className="flex-shrink-0 border-t border-border px-5 py-1.5 text-[11px] text-muted-foreground">
                        Comparing {formatWhen(selectedLog?.timestamp)} (left) with {formatWhen(currentTimestamp)} (right)
                    </div>
                )}
            </div>
        </Modal>
    );
};
