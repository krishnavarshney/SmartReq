import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Play, Stop, Download, Copy, Search, AlertTriangle } from '../icons';
import { HttpMethod } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { RawTextView } from '../response/RawTextView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Loader } from '../ui/Loader';
import { useDiscovery } from '../../context/DiscoveryContext';
import { useToast } from '../../context/ToastContext';

const getMethodClass = (method: HttpMethod) => {
    switch(method) {
        case 'GET': return 'bg-sky-500/10 text-sky-400';
        case 'POST': return 'bg-emerald-500/10 text-emerald-400';
        case 'PUT': return 'bg-amber-500/10 text-amber-400';
        case 'PATCH': return 'bg-orange-500/10 text-orange-400';
        case 'DELETE': return 'bg-rose-500/10 text-rose-400';
        default: return 'bg-muted text-muted-foreground';
    }
}

export const DiscoveryWorkspace: React.FC = () => {
    const { addToast } = useToast();
    const { session, start, stop } = useDiscovery();
    const [baseUrl, setBaseUrl] = useState(session?.baseUrl || '');

    useEffect(() => {
        if (session?.baseUrl) {
            setBaseUrl(session.baseUrl);
        }
    }, [session?.baseUrl]);

    const handleStart = () => {
        start(baseUrl);
    };

    const handleStop = () => {
        stop();
    };
    
    const handleCopySpec = () => {
        if(session?.generatedSpec) {
            navigator.clipboard.writeText(session.generatedSpec);
            addToast('Specification copied!', 'success');
        }
    }
    
    const handleDownloadSpec = () => {
        if(session?.generatedSpec) {
            const blob = new Blob([session.generatedSpec], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'openapi-spec.yaml';
            a.click();
            URL.revokeObjectURL(url);
        }
    }

    const currentSession = session;

    return (
        <div className="flex-grow flex flex-col overflow-hidden gap-4 h-full">
            <div className="flex-shrink-0 flex items-center gap-2 p-4 border border-border rounded-lg bg-card">
                <Input
                    placeholder="Enter base URL to start discovery (e.g., https://api.example.com)"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    disabled={currentSession?.status === 'running'}
                    className="!h-10"
                />
                {currentSession?.status === 'running' ? (
                    <Button onClick={handleStop} variant="destructive" className="w-32">
                        <Stop className="h-4 w-4 mr-2" /> Stop
                    </Button>
                ) : (
                    <Button onClick={handleStart} variant="primary" className="w-32">
                        <Play className="h-4 w-4 mr-2" /> Start
                    </Button>
                )}
            </div>
            <div className="flex-grow rounded-lg border border-border bg-card overflow-hidden">
                {!(import.meta as any).env.VITE_GEMINI_API_KEY ? (
                     <EmptyState
                        icon={<AlertTriangle className="h-12 w-12 text-destructive" />}
                        title="API Key Not Configured"
                        message="The Gemini API key is missing. This feature cannot be used."
                    />
                ) : !currentSession ? (
                    <EmptyState
                        icon={<Search className="h-12 w-12 stroke-1" />}
                        title="Ready to Discover"
                        message="Enter a base URL and start the discovery process to find API endpoints."
                    />
                ) : (
                    <Tabs defaultValue="endpoints" className="h-full flex flex-col">
                        <TabsList className="p-2">
                            <TabsTrigger value="endpoints" badge={currentSession.endpoints.length}>Discovered Endpoints</TabsTrigger>
                            <TabsTrigger value="log">Crawl Log</TabsTrigger>
                            <TabsTrigger value="spec" disabled={!currentSession.generatedSpec}>Generated Spec</TabsTrigger>
                        </TabsList>
                        <div className="flex-grow overflow-auto">
                            <TabsContent value="endpoints" className="p-4">
                                <div className="space-y-2">
                                {currentSession.endpoints.map(ep => (
                                    <div key={ep.id} className="flex items-center gap-3 p-2 bg-muted rounded-md font-mono text-sm">
                                        <span className={`px-2 py-0.5 rounded-sm font-sans font-bold text-xs ${getMethodClass(ep.method)}`}>{ep.method}</span>
                                        <span className="text-foreground">{ep.url}</span>
                                    </div>
                                ))}
                                {currentSession.status === 'running' && <Loader message="Crawling for new endpoints..." />}
                                </div>
                            </TabsContent>
                            <TabsContent value="log">
                                <RawTextView text={currentSession.log.join('\n')} searchTerm="" wordWrap={true} />
                            </TabsContent>
                             <TabsContent value="spec" className="h-full">
                                {currentSession.generatedSpec ? (
                                    <div className="relative h-full">
                                        <div className="absolute top-2 right-2 z-10 flex gap-2">
                                             <Button size="sm" variant="secondary" onClick={handleCopySpec}><Copy className="h-4 w-4 mr-2"/> Copy</Button>
                                             <Button size="sm" variant="secondary" onClick={handleDownloadSpec}><Download className="h-4 w-4 mr-2"/> Download</Button>
                                        </div>
                                        <RawTextView text={currentSession.generatedSpec} searchTerm="" wordWrap={true} />
                                    </div>
                                ): ( currentSession.status === 'finished' ? (
                                    <Loader message="Generating OpenAPI specification with AI..." />
                                  ) : (
                                    <EmptyState message="The OpenAPI spec will appear here once the discovery process is complete." />
                                  )
                                )}
                            </TabsContent>
                        </div>
                    </Tabs>
                )}
            </div>
        </div>
    );
};