import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { ApiResponse, SingleRequestLog } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Diff, getChangeKey } from 'react-diff-view';
import { createTwoFilesPatch, parsePatch } from 'diff';
import { ArrowDown, ArrowUp, Database, Timer } from '../icons';
import { formatBytes } from '../../utils/formatters';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';

interface ResponseDiffModalProps {
    currentResponse: ApiResponse;
    history: SingleRequestLog[];
    onClose: () => void;
}

const tryParseJson = (value: unknown): any | null => {
    if (typeof value === 'object' && value !== null) return value;
    if (typeof value !== 'string') return null;
    try { return JSON.parse(value); } catch { return null; }
};

const stableStringify = (obj: any): string => {
    const seen = new WeakSet();
    const sorter = (value: any): any => {
        if (value && typeof value === 'object') {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
            if (Array.isArray(value)) return value.map(sorter);
            return Object.keys(value).sort().reduce((acc: any, key) => {
                acc[key] = sorter(value[key]);
                return acc;
            }, {});
        }
        return value;
    };
    return JSON.stringify(sorter(obj), null, 2);
};

const formatHeadersForDiff = (response: ApiResponse) => {
    return Object.entries(response.headers)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
};

const formatBodyForDiff = (response: ApiResponse, normalizeJson: boolean) => {
    const raw = typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2);
    if (!normalizeJson) return raw;
    const parsed = tryParseJson(response.body ?? raw);
    if (parsed == null) return raw;
    return stableStringify(parsed);
};

const convertHunks = (hunks: any[]) => {
  return hunks.map(hunk => {
    let oldLine = hunk.oldStart;
    let newLine = hunk.newStart;
    const changes = hunk.lines.map((line: string) => {
      const type = line[0];
      const content = line.slice(1);
      const change: any = { content };
      if (type === '+') {
        change.type = 'add';
        change.isInsert = true;
        change.newLineNumber = newLine++;
      } else if (type === '-') {
        change.type = 'del';
        change.isDelete = true;
        change.oldLineNumber = oldLine++;
      } else {
        change.type = 'normal';
        change.isNormal = true;
        change.oldLineNumber = oldLine++;
        change.newLineNumber = newLine++;
      }
      return change;
    });
    return { ...hunk, changes };
  });
};

const StatusBadge: React.FC<{ status: number, statusText: string }> = ({ status, statusText }) => {
  const isSuccess = status >= 200 && status < 300;
  const colorClasses = isSuccess ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive';
  return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>{status} {statusText}</span>;
};

const MetricCard: React.FC<{title: string, response: ApiResponse, timestamp: string}> = ({ title, response, timestamp }) => (
    <div className="bg-muted/50 p-4 rounded-lg border border-border h-full">
        <h3 className="font-bold text-foreground mb-3">{title}</h3>
        <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Timestamp</span>
                <span className="font-mono">{new Date(timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={response.status} statusText={response.statusText} />
            </div>
            <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Time</span>
                <span className="font-mono flex items-center gap-1"><Timer className="h-3.5 w-3.5" /> {response.duration} ms</span>
            </div>
             <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Size</span>
                <span className="font-mono flex items-center gap-1"><Database className="h-3.5 w-3.5" /> {formatBytes(response.size?.total || 0)}</span>
            </div>
        </div>
    </div>
);

const DiffMetric: React.FC<{title: string, current: number, previous: number, unit: string, higherIsBetter?: boolean}> = ({ title, current, previous, unit, higherIsBetter = false }) => {
    const diff = current - previous;
    const isImprovement = higherIsBetter ? diff > 0 : diff < 0;
    const isRegression = higherIsBetter ? diff < 0 : diff > 0;
    
    const colorClass = isImprovement ? 'text-success' : isRegression ? 'text-destructive' : 'text-muted-foreground';
    
    return (
        <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">{title}</div>
            <div className={`text-xl font-bold flex items-center justify-center gap-1 ${colorClass}`}>
                {isRegression && <ArrowUp className="h-4 w-4" />}
                {isImprovement && <ArrowDown className="h-4 w-4" />}
                {Math.abs(diff).toFixed(0)} {unit}
            </div>
            <div className="text-xs font-mono text-muted-foreground/80">({previous}{unit} → {current}{unit})</div>
        </div>
    );
}

export const ResponseDiffModal: React.FC<ResponseDiffModalProps> = ({ currentResponse, history, onClose }) => {
    const [selectedLogId, setSelectedLogId] = useState<string>(String(history.find(h => h.response !== currentResponse)?.id || ''));
    const [viewType, setViewType] = useState<'split' | 'unified'>('split');
    const [normalizeJson, setNormalizeJson] = useState(true);
    const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
    const [activeSection, setActiveSection] = useState<'body' | 'headers' | 'summary'>('body');
    const [cursorIndex, setCursorIndex] = useState(0);

    const selectedLog = useMemo(() => {
        return history.find(log => String(log.id) === selectedLogId);
    }, [history, selectedLogId]);
    const selectedResponse = selectedLog?.response;

    // Build diffs separately for headers and body
    const headersDiffText = useMemo(() => {
        if (!selectedResponse) return '';
        const oldText = formatHeadersForDiff(selectedResponse);
        const newText = formatHeadersForDiff(currentResponse);
        if (oldText === newText) return '';
        return createTwoFilesPatch('headers', 'headers', oldText, newText, '', '', { context: 5 });
    }, [currentResponse, selectedResponse]);

    const bodyDiffText = useMemo(() => {
        if (!selectedResponse) return '';
        let oldText = formatBodyForDiff(selectedResponse, normalizeJson);
        let newText = formatBodyForDiff(currentResponse, normalizeJson);
        if (ignoreWhitespace) {
            oldText = oldText.replace(/\s+$/gm, '');
            newText = newText.replace(/\s+$/gm, '');
        }
        if (oldText === newText) return '';
        return createTwoFilesPatch('body', 'body', oldText, newText, '', '', { context: 5 });
    }, [currentResponse, selectedResponse, normalizeJson, ignoreWhitespace]);

    const headerFiles = useMemo(() => headersDiffText ? parsePatch(headersDiffText) : [], [headersDiffText]);
    const bodyFiles = useMemo(() => bodyDiffText ? parsePatch(bodyDiffText) : [], [bodyDiffText]);

    const convertedHeaderFiles = useMemo(() => headerFiles.map(f => ({ ...f, hunks: convertHunks(f.hunks) })), [headerFiles]);
    const convertedBodyFiles = useMemo(() => bodyFiles.map(f => ({ ...f, hunks: convertHunks(f.hunks) })), [bodyFiles]);

    // Compute linear change keys for navigation
    const changeKeys = useMemo(() => {
        const files = activeSection === 'headers' ? convertedHeaderFiles : convertedBodyFiles;
        const keys: string[] = [];
        files.forEach(file => file.hunks.forEach((h: any) => h.changes.forEach((c: any) => {
            if (c.isInsert || c.isDelete) {
                const k = getChangeKey({
                    type: c.isInsert ? 'insert' : c.isDelete ? 'delete' : 'normal',
                    lineNumber: c.newLineNumber,
                    oldLineNumber: c.oldLineNumber,
                    content: c.content,
                } as any);
                if (k) keys.push(String(k));
            }
        })));
        return keys;
    }, [activeSection, convertedHeaderFiles, convertedBodyFiles]);

    const generateAnchorID = (change: any) => {
        const key = getChangeKey(change as any);
        return key ? `diff-${key}` : undefined;
    };

    const scrollToCursor = (index: number) => {
        const id = changeKeys[index];
        if (!id) return;
        const el = document.getElementById(`diff-${id}`);
        if (el) el.scrollIntoView({ block: 'center' });
    };

    const gotoPrev = () => {
        if (changeKeys.length === 0) return;
        setCursorIndex(prev => {
            const next = (prev - 1 + changeKeys.length) % changeKeys.length;
            setTimeout(() => scrollToCursor(next), 0);
            return next;
        });
    };

    const gotoNext = () => {
        if (changeKeys.length === 0) return;
        setCursorIndex(prev => {
            const next = (prev + 1) % changeKeys.length;
            setTimeout(() => scrollToCursor(next), 0);
            return next;
        });
    };

    // Compute a simple JSON change summary if JSON
    const jsonSummary = useMemo(() => {
        if (!selectedResponse) return [] as { path: string, type: 'added' | 'removed' | 'changed', before?: any, after?: any }[];
        const a = tryParseJson(formatBodyForDiff(selectedResponse, true));
        const b = tryParseJson(formatBodyForDiff(currentResponse, true));
        if (a == null || b == null) return [];
        const changes: { path: string, type: 'added' | 'removed' | 'changed', before?: any, after?: any }[] = [];
        const walk = (pa: any, pb: any, prefix: string) => {
            const keys = Array.from(new Set([...(Object.keys(pa||{})), ...(Object.keys(pb||{}))])).sort();
            keys.forEach(k => {
                const na = pa?.[k];
                const nb = pb?.[k];
                const path = prefix ? `${prefix}.${k}` : k;
                if (na === undefined && nb !== undefined) changes.push({ path, type: 'added', after: nb });
                else if (na !== undefined && nb === undefined) changes.push({ path, type: 'removed', before: na });
                else if (typeof na === 'object' && na !== null && typeof nb === 'object' && nb !== null) walk(na, nb, path);
                else if (JSON.stringify(na) !== JSON.stringify(nb)) changes.push({ path, type: 'changed', before: na, after: nb });
            });
        };
        walk(a, b, '');
        return changes;
    }, [currentResponse, selectedResponse]);

    return (
        <Modal show={true} onClose={onClose} size="5xl">
            <div className="flex justify-between items-center pb-3 border-b border-border">
                <h2 className="text-lg font-bold">Compare Responses</h2>
                <button onClick={onClose} className="text-2xl text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="mt-4 space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="text-sm font-medium">Compare Current Response with:</label>
                        <Select value={selectedLogId} onValueChange={setSelectedLogId}>
                            <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select a past response..." />
                            </SelectTrigger>
                            <SelectContent>
                                {history.filter(h => h.response !== currentResponse).map(log => (
                                    <SelectItem key={log.id} value={String(log.id)}>
                                        {new Date(log.timestamp).toLocaleString()} - {log.response.status} {log.response.statusText}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                {selectedResponse && selectedLog && (
                    <div className="grid md:grid-cols-3 gap-4 animate-fade-in">
                        <MetricCard title="Previous" response={selectedResponse} timestamp={selectedLog.timestamp} />
                        <div className="bg-muted/50 p-4 rounded-lg border border-border h-full flex flex-col justify-center items-center gap-6">
                            <DiffMetric title="Time Difference" current={currentResponse.duration} previous={selectedResponse.duration} unit="ms" />
                            <DiffMetric title="Size Difference" current={currentResponse.size?.total || 0} previous={selectedResponse.size?.total || 0} unit="B" />
                        </div>
                        <MetricCard title="Current" response={currentResponse} timestamp={history.find(h => h.response === currentResponse)?.timestamp || new Date().toISOString()} />
                    </div>
                )}

                <div className="flex flex-wrap items-center justify-between pt-2 gap-2">
                    <div className="inline-flex items-center gap-2 bg-muted p-1 rounded-md border border-border">
                        <button onClick={() => setActiveSection('body')} className={`px-2 py-1 text-xs rounded ${activeSection==='body'?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-background'}`}>Body</button>
                        <button onClick={() => setActiveSection('headers')} className={`px-2 py-1 text-xs rounded ${activeSection==='headers'?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-background'}`}>Headers</button>
                        <button onClick={() => setActiveSection('summary')} className={`px-2 py-1 text-xs rounded ${activeSection==='summary'?'bg-primary text-primary-foreground':'text-muted-foreground hover:bg-background'}`}>Summary</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-md border border-border">
                            <label className="text-xs px-2 py-1">
                                <input type="checkbox" className="mr-1 align-middle" checked={normalizeJson} onChange={e=>setNormalizeJson(e.target.checked)} /> Normalize JSON
                            </label>
                            <label className="text-xs px-2 py-1">
                                <input type="checkbox" className="mr-1 align-middle" checked={ignoreWhitespace} onChange={e=>setIgnoreWhitespace(e.target.checked)} /> Ignore trailing WS
                            </label>
                        </div>
                        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-md border border-border">
                            <button className="px-2 py-1 text-xs rounded text-muted-foreground hover:bg-background" onClick={gotoPrev}>Prev change</button>
                            <span className="text-xs text-muted-foreground">{changeKeys.length ? `${cursorIndex+1}/${changeKeys.length}` : '0/0'}</span>
                            <button className="px-2 py-1 text-xs rounded text-muted-foreground hover:bg-background" onClick={gotoNext}>Next change</button>
                        </div>
                    </div>
                    <div className="flex-1" />
                    <div>
                        <Tabs value={viewType} onValueChange={setViewType as (value: string) => void}>
                            <TabsList>
                                <TabsTrigger value="split">Split View</TabsTrigger>
                                <TabsTrigger value="unified">Unified View</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div className="h-[50vh] overflow-auto border border-border rounded-lg bg-card">
                    {activeSection === 'summary' && (
                        <div className="p-4 text-sm space-y-2">
                            {jsonSummary.length === 0 ? (
                                <div className="text-muted-foreground">No structured JSON differences or non-JSON content.</div>
                            ) : (
                                jsonSummary.map((c, idx) => (
                                    <div key={idx} className="flex items-start justify-between gap-4 border-b border-border/60 py-1">
                                        <div className="font-mono text-foreground break-all">{c.path}</div>
                                        <div className={`text-xs ${c.type==='added'?'text-success':c.type==='removed'?'text-destructive':'text-amber-400'}`}>{c.type.toUpperCase()}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {activeSection === 'headers' && (
                        <div className="h-full">
                            {convertedHeaderFiles.length > 0 ? (
                                convertedHeaderFiles.map(({ hunks }, i) => (
                                    <Diff key={i} viewType={viewType} diffType={'modify'} hunks={hunks} gutterType="anchor" generateAnchorID={generateAnchorID} />
                                ))
                            ) : selectedResponse ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">No header differences found.</div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">Select a response to begin comparison.</div>
                            )}
                        </div>
                    )}
                    {activeSection === 'body' && (
                        <div className="h-full">
                            {convertedBodyFiles.length > 0 ? (
                                convertedBodyFiles.map(({ hunks }, i) => (
                                    <Diff key={i} viewType={viewType} diffType={'modify'} hunks={hunks} gutterType="anchor" generateAnchorID={generateAnchorID} />
                                ))
                            ) : selectedResponse ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">No body differences found.</div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">Select a response to begin comparison.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
