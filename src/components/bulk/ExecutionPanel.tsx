import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BulkResult, BulkRunState, BulkSettings } from '../../types';
import { Button } from '../ui/Button';
import { Play, Pause, Stop, List, PieChart, Download, Settings } from '../icons';
import { DataTable } from '../ui/DataTable';
import { formatBytes } from '../../utils/formatters';
import { Tooltip } from '../ui/Tooltip';
import { ResultDetailModal } from './ResultDetailModal';
import { Slider } from '../ui/Slider';
import { Input } from '../ui/Input';
import { ProgressTracker } from '../ProgressTracker';
import { exportDataAsCsv } from '../../utils/export';
import { useToast } from '../../context/ToastContext';
import { SummaryDashboard } from './SummaryDashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';

interface ExecutionPanelProps {
    results: BulkResult[];
    runState: BulkRunState;
    onRun: () => void;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    settings: BulkSettings;
    onSettingsChange: (settings: BulkSettings) => void;
    data: Record<string, string>[];
}

const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-success';
    if (status >= 400 && status < 500) return 'text-warning';
    if (status >= 500) return 'text-destructive';
    return 'text-muted-foreground';
};

const baseColumns = [
    { accessorKey: 'id', header: '#' },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'response.status', header: 'Code' },
    { accessorKey: 'response.duration', header: 'Time (ms)' },
    { accessorKey: 'response.size.total', header: 'Size' },
];

const flattenObject = (obj: any, prefix = ''): Record<string, any> => {
    if (obj === null || typeof obj !== 'object') {
        return { [prefix || 'value']: obj };
    }

    return Object.entries(obj).reduce((acc, [key, value]) => {
        const newPrefix = prefix ? `${prefix}_${key}` : key;
        if (typeof value === 'object' && value !== null) {
            Object.assign(acc, flattenObject(value, newPrefix));
        } else {
            acc[newPrefix] = value;
        }
        return acc;
    }, {} as Record<string, any>);
};

export const ExecutionPanel: React.FC<ExecutionPanelProps> = (props) => {
    const [activeTab, setActiveTab] = useState('results');
    const [showSettings, setShowSettings] = useState(false);
    const [selectedResult, setSelectedResult] = useState<BulkResult | null>(null);
    const [rps, setRps] = useState(0);
    const completedCountRef = useRef(0);
    const lastUpdateTimeRef = useRef<number>(0);
    const { addToast } = useToast();

    const progress = useMemo(() => {
        const completed = props.results.filter(r => r.status !== 'pending').length;
        const success = props.results.filter(r => r.status === 'success').length;
        return {
            total: props.results.length || props.data.length,
            completed,
            success,
            errors: completed - success,
            rps: rps,
        };
    }, [props.results, rps, props.data.length]);

    const dynamicColumns = useMemo(() => {
        if (props.data.length === 0) {
            return baseColumns;
        }
        const dataHeaders = Object.keys(props.data[0]);
        const dataColumns = dataHeaders.map(header => ({
            accessorKey: `data.${header}`,
            header: header.toUpperCase(),
        }));
        
        const newColumns = [...baseColumns];
        newColumns.splice(1, 0, ...dataColumns);
        return newColumns;
    }, [props.data]);

    useEffect(() => {
        let interval: number | undefined;
        if (props.runState === 'running') {
            lastUpdateTimeRef.current = Date.now();
            completedCountRef.current = progress.completed;
            interval = window.setInterval(() => {
                const now = Date.now();
                const elapsed = (now - lastUpdateTimeRef.current) / 1000;
                const completedSinceLast = progress.completed - completedCountRef.current;
                
                if (elapsed > 0) {
                    setRps(completedSinceLast / elapsed);
                }
                
                lastUpdateTimeRef.current = now;
                completedCountRef.current = progress.completed;
            }, 1000);
        } else {
            setRps(0);
        }
        return () => {
            if (interval !== undefined) {
                window.clearInterval(interval);
            }
        };
    }, [props.runState, progress.completed]);

    const resultsForTable = useMemo(() => {
        return props.results.map(res => ({
            ...res,
            'response.status': res.response.status > 0 ? `${res.response.status} ${res.response.statusText}` : 'N/A',
            'response.duration': typeof res.response.duration === 'number' ? res.response.duration.toFixed(0) : '...',
            'response.size.total': formatBytes(res.response.size?.total || 0)
        }));
    }, [props.results]);

    const handleExport = () => {
        if (props.results.length === 0) {
            addToast('No results to export.', 'info');
            return;
        }
        
        const dataToExport = props.results.map(r => {
            const flattenedBody = (typeof r.response.body === 'object' && r.response.body !== null)
                ? flattenObject(r.response.body, 'response_body')
                : { 'response_body': r.response.body };

            return {
                iteration: r.id,
                ...r.data,
                response_status_code: r.response.status,
                response_status_text: r.response.statusText,
                response_duration_ms: r.response.duration,
                response_size_bytes: r.response.size?.total,
                ...flattenedBody
            };
        });

        exportDataAsCsv(dataToExport, `bulk-run-results-${new Date().toISOString()}.csv`);
        addToast('Results exported successfully!', 'success');
    };

    const isRunning = props.runState === 'running' || props.runState === 'paused';
    const hasFinished = props.runState === 'finished' || props.runState === 'stopped';

    const renderRunDashboard = () => (
        <div className="flex items-center justify-between p-2 border-b border-border bg-card">
            <div className="flex items-center gap-2">
                 {props.runState === 'idle' && !hasFinished && (
                    <Button onClick={props.onRun} size="sm" disabled={props.data.length === 0}>
                        <Play className="h-4 w-4 mr-2" /> Start Run ({props.data.length} rows)
                    </Button>
                )}
                {props.runState === 'running' && (
                    <Button onClick={props.onPause} size="sm" variant="secondary">
                        <Pause className="h-4 w-4 mr-2" /> Pause
                    </Button>
                )}
                {props.runState === 'paused' && (
                    <Button onClick={props.onResume} size="sm" variant="secondary">
                        <Play className="h-4 w-4 mr-2" /> Resume
                    </Button>
                )}
                {isRunning && (
                    <Button onClick={props.onStop} size="sm" variant="destructive">
                        <Stop className="h-4 w-4 mr-2" /> Stop
                    </Button>
                )}
                {hasFinished && (
                     <Button onClick={props.onRun} size="sm" variant="secondary">
                        <Play className="h-4 w-4 mr-2" /> Run Again
                    </Button>
                )}
                 <Tooltip content="Execution Settings">
                    <Button
                        size="sm"
                        variant={showSettings ? 'secondary' : 'ghost'}
                        onClick={() => setShowSettings(!showSettings)}
                        disabled={isRunning}
                    >
                        <Settings className="h-4 w-4" />
                    </Button>
                </Tooltip>
            </div>
             <div className="flex-grow px-4">
                {(isRunning || hasFinished || props.results.length > 0) && (
                    <ProgressTracker progress={progress} runState={props.runState} />
                )}
            </div>
             <div className="flex items-center gap-2">
                {hasFinished && (
                    <Button size="sm" variant="secondary" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-2" /> Export Results
                    </Button>
                )}
            </div>
        </div>
    );
    
    const renderSettings = () => (
        <div className={`p-4 border-b border-border bg-muted/50 transition-all duration-300 ease-in-out overflow-hidden ${showSettings ? 'max-h-[200px]' : 'max-h-0'}`}>
            <div className="grid grid-cols-2 gap-8 max-w-lg mx-auto">
                <div className="space-y-2">
                    <label className="text-sm font-medium">Concurrency</label>
                    <div className="flex items-center gap-4">
                        <Slider
                            min={1} max={50} step={1}
                            value={[props.settings.concurrency]}
                            onValueChange={([val]) => props.onSettingsChange({ ...props.settings, concurrency: val })}
                        />
                        <span className="font-mono text-sm w-10 text-center">{props.settings.concurrency}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Number of requests to run in parallel.</p>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Request Delay (ms)</label>
                     <Input
                        type="number"
                        min={0} step={50}
                        value={props.settings.delay}
                        onChange={(e) => props.onSettingsChange({ ...props.settings, delay: parseInt(e.target.value, 10) || 0 })}
                        className="!h-8"
                    />
                    <p className="text-xs text-muted-foreground">Time to wait between each request.</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col rounded-lg border border-border bg-card">
            {renderRunDashboard()}
            {showSettings && renderSettings()}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-grow flex flex-col">
                <TabsList className="flex-shrink-0 border-b border-border bg-card flex justify-end p-2">
                    <TabsTrigger value="results">Results</TabsTrigger>
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                </TabsList>
                <TabsContent value="results" className="flex-grow overflow-auto">
                    <DataTable
                        columns={dynamicColumns}
                        data={resultsForTable}
                        onRowClick={(row) => setSelectedResult(row.original as BulkResult)}
                        cellRenderers={{
                            'status': (info) => (
                                <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    info.getValue() === 'success' ? 'bg-success-bg text-success-text' : 
                                    info.getValue() === 'error' ? 'bg-destructive-bg text-destructive-text' : 
                                    'bg-muted text-muted-foreground'}`}>{info.getValue() as string}</span>
                            ),
                            'response.status': (info) => <span className={getStatusColor(info.row.original.response.status)}>{info.getValue() as string}</span>,
                            ...dynamicColumns.filter(c => c.accessorKey.startsWith('data.'))
                                .reduce((acc, col) => {
                                    acc[col.accessorKey] = (info) => <span className="truncate block max-w-[200px]" title={info.getValue() as string}>{info.getValue() as string}</span>;
                                    return acc;
                                }, {} as Record<string, (info: any) => React.ReactNode>)
                        }}
                     />
                </TabsContent>
                <TabsContent value="summary" className="flex-grow overflow-auto">
                    <SummaryDashboard results={props.results} />
                </TabsContent>
            </Tabs>
            {selectedResult && (
                <ResultDetailModal 
                    result={selectedResult}
                    onClose={() => setSelectedResult(null)}
                />
            )}
        </div>
    );
};