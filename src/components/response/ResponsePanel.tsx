import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { SingleRequestLog } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { formatBytes } from '../../utils/formatters';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/HoverCard';
import { TimeMetrics } from './TimeMetrics';
import { SizeMetrics } from './SizeMetrics';
import { TestResultsPanel } from './TestResultsPanel';
import { CookiesPanel } from './CookiesPanel';
import { RawTextView } from './RawTextView';
import { useToast } from '../../context/ToastContext';
import { ResponseControls } from './ResponseControls';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { Download, Rocket, Search, WrapText, History, Timer, Database, Asterisk, ChevronUp, ChevronDown } from '../icons';
import { TableView } from './TableView';
import { HtmlPreview } from './HtmlPreview';
import { Input } from '../ui/Input';
import { Tooltip } from '../ui/Tooltip';
import { Button, IconButton } from '../ui/Button';
import { Breadcrumbs } from './Breadcrumbs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { exportDataAsCsv } from '../../utils/export';
import { VisualizationPanel } from './VisualizationPanel';
import { WaterfallPanel } from './WaterfallPanel';
import { ResponseDiffModal } from '../modals/ResponseDiffModal';
import { ResponsePanelSkeleton } from './ResponsePanelSkeleton';
import { AiResponseInsightsModal } from '../modals/AiResponseInsightsModal';
import { useDebounce } from '../../hooks/useDebounce';

interface ResponsePanelProps {
  currentLog: SingleRequestLog | null;
  isLoading: boolean;
  responseHistory: SingleRequestLog[];
  onGenerateTests: () => void;
  isGeneratingTests: boolean;
}

type ViewMode = 'raw' | 'table' | 'preview' | 'image' | 'csv';
type ContentType = 'json' | 'html' | 'xml' | 'text' | 'image' | 'csv';

const StatusBadge: React.FC<{ status: number, statusText: string }> = ({ status, statusText }) => {
  if (status === 0) {
      return <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full bg-muted text-muted-foreground`}>{statusText.toUpperCase()}</span>;
  }
  const isSuccess = status >= 200 && status < 300;
  const isRedirect = status >= 300 && status < 400;
  const isClientError = status >= 400 && status < 500;
  
  const colorClasses = isSuccess 
      ? 'bg-success/10 text-success' 
      : isClientError 
      ? 'bg-warning/10 text-warning'
      : isRedirect
      ? 'bg-blue-500/10 text-blue-400'
      : 'bg-destructive/10 text-destructive';

  return <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${colorClasses}`}>{status} {statusText}</span>;
};

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ currentLog, isLoading, responseHistory, onGenerateTests, isGeneratingTests }) => {
  const [activeTab, setActiveTab] = useState('body');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 200);
  const [wordWrap, setWordWrap] = useState(true);
  const { addToast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('raw');
  const [contentType, setContentType] = useState<ContentType>('text');
  const [dataPath, setDataPath] = useState<string[]>([]);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isAiInsightsModalOpen, setIsAiInsightsModalOpen] = useState(false);
  
  const [isRegex, setIsRegex] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);

  const response = currentLog?.response;
  const prevResponseRef = useRef<typeof response | null>(null);
  
  const responseBodyString = useMemo(() => {
    if (!response?.body) return '';
    return typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2);
  }, [response?.body]);
  
  const parsedBody = useMemo(() => {
    if (!response?.body) return null;
    if (typeof response.body === 'object' && response.body !== null) return response.body;
    try {
        return JSON.parse(responseBodyString);
    } catch {
        return responseBodyString;
    }
  }, [response?.body, responseBodyString]);

  const dataForView = useMemo(() => {
    if (!parsedBody) return null;
    try {
        return dataPath.reduce((acc: any, key: string) => acc?.[key], parsedBody);
    } catch (e) {
        return { error: "Invalid path in data" };
    }
  }, [parsedBody, dataPath]);
  
  const isJsonDataForTable = useMemo(() => {
      if (contentType !== 'json' || !parsedBody) return false;
      const data = parsedBody;
      return (Array.isArray(data)) || (typeof data === 'object' && data !== null && !Array.isArray(data));
  }, [contentType, parsedBody]);

  const viewOptions = useMemo(() => {
      const options = [{ value: 'raw' as ViewMode, label: 'Raw' }];
      if (contentType === 'json' && isJsonDataForTable) {
          options.push({ value: 'table', label: 'Table' });
      }
      if (contentType === 'html') {
          options.push({ value: 'preview', label: 'Preview' });
      }
      if (contentType === 'image') {
          options.push({ value: 'image', label: 'Image' });
      }
      if (contentType === 'csv') {
          options.push({ value: 'csv', label: 'CSV' });
      }
      return options;
  }, [contentType, isJsonDataForTable]);

  useEffect(() => {
    if (response !== prevResponseRef.current) {
      let detectedContentType: ContentType = 'text';
      if (currentLog?.response?.headers) {
          const type = currentLog.response.headers['content-type'] || '';
          if (type.startsWith('image/')) detectedContentType = 'image';
          else if (type.includes('text/csv') || type.includes('application/csv')) detectedContentType = 'csv';
          else if (type.includes('application/json')) detectedContentType = 'json';
          else if (type.includes('text/html')) detectedContentType = 'html';
          else if (type.includes('application/xml') || type.includes('text/xml')) detectedContentType = 'xml';
      }
      setContentType(detectedContentType);
      setViewMode('raw');
      setActiveTab('body');
      setDataPath([]);
      setSearchTerm('');
      setMatchCount(0);
      setActiveMatchIndex(-1);
      setSearchError(null);
      prevResponseRef.current = response || null;
    }
  }, [response, currentLog]);

  const testResults = response?.testResults || [];
  const passedTests = testResults.filter(r => r.passed).length;
  const cookies = response?.cookies || [];

  const handleExport = () => {
    if (!response) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(responseBodyString)}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = `response-${new Date().toISOString()}.json`;
    link.click();
    addToast('Response exported successfully!', 'success');
  };

  const handleCopy = () => {
    if (!response) return;
    navigator.clipboard.writeText(responseBodyString).then(() => {
      addToast('Response body copied to clipboard!', 'success');
    }, (err) => {
      addToast('Failed to copy response body.', 'error');
      console.error('Could not copy text: ', err);
    });
  };
  
  const handleDrillDown = (segments: string[]) => setDataPath(prev => [...prev, ...segments]);
  const handlePathChange = (index: number) => setDataPath(prev => prev.slice(0, index + 1));
  const handleGoToRoot = () => setDataPath([]);
  
  const handleExportTable = (fileType: 'csv' | 'xls') => {
    if (!dataForView) {
      addToast('No data to export.', 'error');
      return;
    }
    const filename = `export-${new Date().toISOString()}.${fileType}`;
    try {
      exportDataAsCsv(dataForView, filename);
      addToast('Table exported successfully!', 'success');
    } catch (e: any) {
      addToast(`Export failed: ${e.message}`, 'error');
      console.error('Export failed', e);
    }
  };

  const handleSearchResults = useCallback((results: { count: number; error: string | null }) => {
    setSearchError(results.error);
    setMatchCount(results.count);
    setActiveMatchIndex(results.count > 0 ? 0 : -1);
  }, []);

  const handleNextMatch = () => {
      if (matchCount > 0) {
          setActiveMatchIndex(prev => (prev + 1) % matchCount);
      }
  };

  const handlePrevMatch = () => {
      if (matchCount > 0) {
          setActiveMatchIndex(prev => (prev - 1 + matchCount) % matchCount);
      }
  };

  const renderContent = () => {
    if (isLoading) {
      return <ResponsePanelSkeleton />;
    }

    if (!response) {
      return (
         <EmptyState 
            icon={<Rocket className="h-12 w-12 text-muted-foreground mb-4 stroke-1" />}
            title="Ready to Send"
            message="Execute a request to view the response here."
        />
      );
    }
    
    return (
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-2 flex-shrink-0 sticky top-0 z-10 bg-card">
            <TabsList>
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="headers" badge={Object.keys(response.headers).length}>Headers</TabsTrigger>
                {cookies.length > 0 && <TabsTrigger value="cookies" badge={cookies.length}>Cookies</TabsTrigger>}
                {testResults.length > 0 && <TabsTrigger value="tests" badge={`${passedTests}/${testResults.length}`}>Tests</TabsTrigger>}
                <TabsTrigger value="visualize">Visualize</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1 p-1">
                {activeTab === 'body' && viewMode === 'raw' && (
                    <div className="flex items-center gap-2 bg-muted p-1 rounded-md border border-border">
                        <div className="relative">
                            <Tooltip content={searchError}>
                                <Input 
                                    type="text" 
                                    placeholder="Search" 
                                    className={`py-1 pl-8 pr-20 w-48 text-sm h-8 bg-background ${searchError ? 'border-destructive ring-destructive ring-1' : 'border-border'}`} 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                             </Tooltip>
                            <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none">
                                <Search className="h-4 w-4 text-muted-foreground" />
                            </div>
                            {searchTerm && !searchError && (
                                <div className="absolute inset-y-0 right-0 flex items-center pr-2 text-xs text-muted-foreground">
                                    {matchCount > 0 ? `${activeMatchIndex + 1} / ${matchCount}` : 'No results'}
                                </div>
                            )}
                        </div>
                        <Tooltip content="Use Regex">
                            <IconButton 
                                size="sm" 
                                variant={isRegex ? "secondary" : "ghost"}
                                onClick={() => setIsRegex(!isRegex)}
                            >
                                <Asterisk className="h-4 w-4" />
                            </IconButton>
                        </Tooltip>
                        <IconButton size="sm" variant="ghost" onClick={handlePrevMatch} disabled={matchCount === 0}>
                            <ChevronUp className="h-4 w-4" />
                        </IconButton>
                        <IconButton size="sm" variant="ghost" onClick={handleNextMatch} disabled={matchCount === 0}>
                            <ChevronDown className="h-4 w-4" />
                        </IconButton>
                         <Tooltip content="Toggle Word Wrap">
                            <IconButton 
                                size="sm" 
                                variant={wordWrap ? "secondary" : "ghost"}
                                onClick={() => setWordWrap(!wordWrap)}
                            >
                                <WrapText className="h-4 w-4" />
                            </IconButton>
                        </Tooltip>
                    </div>
                )}
                {activeTab === 'body' && viewMode === 'table' && dataForView && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="secondary" className="h-8">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleExportTable('csv')}>
                            Export as CSV
                        </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
        <div className="overflow-auto flex-grow">
           <TabsContent value="body" className="h-full flex flex-col">
               <div className="flex-grow overflow-auto">
                    {viewMode === 'raw' && (
                        <RawTextView 
                            text={responseBodyString} 
                            searchTerm={debouncedSearchTerm} 
                            wordWrap={wordWrap} 
                            isRegex={isRegex}
                            activeMatchIndex={activeMatchIndex}
                            onSearchResults={handleSearchResults}
                        />
                    )}
                    {viewMode === 'table' && (
                        <div className="h-full flex flex-col">
                            {dataPath.length > 0 && (
                                <Breadcrumbs path={dataPath} onPathClick={handlePathChange} onRootClick={handleGoToRoot} />
                            )}
                            <TableView data={dataForView} onDrillDown={handleDrillDown} />
                        </div>
                    )}
                    {viewMode === 'preview' && <HtmlPreview html={responseBodyString} />}
                    {viewMode === 'image' && typeof response?.body === 'string' && response.body.startsWith('data:image') && (
                        <div className="p-4">
                            <img src={response.body} alt="Response" className="max-w-full h-auto rounded border border-border" />
                        </div>
                    )}
                    {viewMode === 'csv' && (
                        <div className="p-4 overflow-auto">
                            <table className="w-full text-sm">
                                <tbody>
                                {responseBodyString.split('\n').filter(r => r.length > 0).map((row, i) => (
                                    <tr key={i} className="border-b border-border/50">
                                        {row.split(',').map((cell, j) => (
                                            <td key={j} className="p-2 font-mono whitespace-pre">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    )}
               </div>
          </TabsContent>
          <TabsContent value="headers">
             <div className="font-mono text-sm space-y-1 p-4">
                {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="flex items-start">
                        <span className="text-sky-400 mr-2 flex-shrink-0">{key}:</span>
                        <span className="text-amber-400 break-all">{String(value)}</span>
                    </div>
                ))}
            </div>
          </TabsContent>
          <TabsContent value="cookies"><CookiesPanel cookies={cookies} /></TabsContent>
          <TabsContent value="tests"><TestResultsPanel results={testResults} /></TabsContent>
          <TabsContent value="visualize"><VisualizationPanel data={response.body} /></TabsContent>
          <TabsContent value="timeline"><WaterfallPanel timing={response.timing} total={response.duration} /></TabsContent>
        </div>
      </Tabs>
    );
  };
  
  const headerMetrics = response && !isLoading && currentLog && (
    <div key={currentLog.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-4 text-sm animate-fade-in w-full max-w-lg">
        <div className="p-3 rounded-lg bg-card flex flex-col items-center justify-center text-center">
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <div className="font-semibold text-base">
                <StatusBadge status={response.status} statusText={response.statusText} />
            </div>
        </div>

        <HoverCard>
            <HoverCardTrigger>
                <div className="p-3 rounded-lg bg-card cursor-pointer hover:bg-muted transition-colors flex flex-col items-center justify-center">
                    <div className="text-xs text-muted-foreground mb-1">Time</div>
                    <div className="font-bold text-lg text-foreground flex items-center justify-center gap-1.5">
                        <Timer className="h-4 w-4" />
                        {response.duration.toFixed(0)} ms
                    </div>
                </div>
            </HoverCardTrigger>
            <HoverCardContent><TimeMetrics timing={response.timing} total={response.duration} /></HoverCardContent>
        </HoverCard>

        <HoverCard>
            <HoverCardTrigger>
                 <div className="p-3 rounded-lg bg-card cursor-pointer hover:bg-muted transition-colors flex flex-col items-center justify-center">
                    <div className="text-xs text-muted-foreground mb-1">Size</div>
                    <div className="font-bold text-lg text-foreground flex items-center justify-center gap-1.5">
                      <Database className="h-4 w-4" />
                      {formatBytes(response.size?.total || 0)}
                    </div>
                </div>
            </HoverCardTrigger>
            <HoverCardContent><SizeMetrics requestSize={currentLog.request.size} responseSize={response.size} /></HoverCardContent>
        </HoverCard>
    </div>
  );

  const loadingIndicator = (
    <div className="flex items-center justify-center gap-3 text-sm">
      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      <span className="text-muted-foreground">Loading response...</span>
    </div>
  );

  return (
    <div className="h-full flex flex-col rounded-lg overflow-auto bg-card border border-border relative">
        {/* Progress Bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40 overflow-hidden z-10">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                 style={{
                   animation: 'shimmer 1.5s ease-in-out infinite'
                 }}
            />
          </div>
        )}
        
        <div className="flex items-center justify-between p-3 md:p-4 border-b border-border flex-shrink-0 min-h-[72px] flex-wrap gap-2">
            <div className="flex items-center gap-2 self-start mt-1.5 order-2 md:order-1">
                <div className="flex items-center gap-2">
                    {viewOptions.length > 1 && (
                        <div className="flex items-center gap-1 p-1 bg-muted rounded-md">
                            {viewOptions.map(opt => (
                                <Tooltip content={opt.label} key={opt.value}>
                                    <button
                                        onClick={() => setViewMode(opt.value)}
                                        className={`px-2 py-1 text-xs font-semibold rounded ${viewMode === opt.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background'}`}
                                    >
                                        {opt.label}
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-grow flex justify-center px-0 md:px-4 order-1 md:order-2 w-full md:w-auto">
              {isLoading ? loadingIndicator : headerMetrics}
            </div>
            <div className="self-start mt-1.5 flex items-center gap-1 order-3">
                {responseHistory.length > 1 && (
                    <Button onClick={() => setIsDiffModalOpen(true)} size="sm" variant="secondary" className="h-8">
                        <History className="h-4 w-4 mr-2" />
                        Compare
                    </Button>
                )}
                {response && response.status > 0 && (
                  <ResponseControls 
                    onCopy={handleCopy} 
                    onExport={handleExport} 
                    onAiInsights={() => setIsAiInsightsModalOpen(true)} 
                    onGenerateTests={onGenerateTests}
                    isGeneratingTests={isGeneratingTests}
                  />
                )}
            </div>
        </div>
        <div className="flex-grow overflow-y-auto max-h-[500px]">
             {renderContent()}
        </div>
        {isDiffModalOpen && currentLog && (
            <ResponseDiffModal 
                currentResponse={currentLog.response}
                history={responseHistory}
                onClose={() => setIsDiffModalOpen(false)}
            />
        )}
        {isAiInsightsModalOpen && responseBodyString && (
            <AiResponseInsightsModal
                show={isAiInsightsModalOpen}
                onClose={() => setIsAiInsightsModalOpen(false)}
                responseBody={responseBodyString}
            />
        )}
    </div>
  );
};