import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { ChevronsDownUp, ChevronsUpDown, GitCompareArrows, Regex, SendHorizontal } from 'lucide-react';
import { SingleRequestLog } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { Badge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tooltip, Kbd } from '../ui/Tooltip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from '../ui/DropdownMenu';
import { Download, Search, WrapText, ChevronUp, ChevronDown, Copy, Check, X, Sparkles, TestTube2, Timer, Database, FileText, Table as TableIcon } from '../icons';
import { useToast } from '../../context/ToastContext';
import { getStatusTone } from '../../utils/http-ui';
import { formatBytes, formatDuration } from '../../utils/formatters';
import { exportDataAsCsv, exportDataAsXls } from '../../utils/export';
import { useDebounce } from '../../hooks/useDebounce';
import { CodeView, FoldCommand, SearchResults } from './CodeView';
import { TableView, describeTableData } from './TableView';
import { Breadcrumbs } from './Breadcrumbs';
import { HtmlPreview } from './HtmlPreview';
import { ImagePreview } from './ImagePreview';
import { HeadersPanel } from './HeadersPanel';
import { CookiesPanel } from './CookiesPanel';
import { TestResultsPanel } from './TestResultsPanel';
import { WaterfallPanel } from './WaterfallPanel';
import { VisualizationPanel, findVisualizableData } from './VisualizationPanel';
import { TimeMetrics } from './TimeMetrics';
import { SizeMetrics } from './SizeMetrics';
import { MetricPopover } from './MetricPopover';
import { ResponsePanelSkeleton } from './ResponsePanelSkeleton';
import { ResponseErrorView } from './ResponseErrorView';
import { ResponseDiffModal } from '../modals/ResponseDiffModal';
import { AiResponseInsightsModal } from '../modals/AiResponseInsightsModal';
import {
  BodyKind,
  buildJsonLines,
  buildTextLines,
  dataUrlToBlob,
  describeContentType,
  detectBody,
  downloadBlob,
  getContentType,
  hasTiming,
  statusLabel,
  suggestFilename,
} from './utils';

interface ResponsePanelProps {
  currentLog: SingleRequestLog | null;
  isLoading: boolean;
  responseHistory: SingleRequestLog[];
  onGenerateTests: () => void;
  isGeneratingTests: boolean;
}

type Format = 'pretty' | 'raw' | 'table' | 'source' | 'preview' | 'image';

const FORMAT_LABEL: Record<Format, string> = {
  pretty: 'Pretty',
  raw: 'Raw',
  table: 'Table',
  source: 'Source',
  preview: 'Preview',
  image: 'Image',
};

const FORMATS: Record<BodyKind, Format[]> = {
  json: ['pretty', 'raw', 'table'],
  html: ['source', 'preview'],
  xml: ['source'],
  csv: ['table', 'raw'],
  image: ['image'],
  text: ['raw'],
  empty: [],
};

const TEXT_FORMATS: Format[] = ['pretty', 'raw', 'source'];
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Track an element's width so the panel can adapt to its own size, not the viewport's. */
const useWidth = (ref: React.RefObject<HTMLElement | null>) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
};

const ToolbarButton: React.FC<{
  label: string;
  onClick: () => void;
  pressed?: boolean;
  shortcut?: string;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, pressed, shortcut, disabled, children }) => (
  <Tooltip content={label} shortcut={shortcut}>
    <IconButton
      size="sm"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      className={`[&_svg]:h-3.5 [&_svg]:w-3.5 ${pressed ? '!bg-accent !text-foreground' : ''}`}
    >
      {children}
    </IconButton>
  </Tooltip>
);

export const ResponsePanel: React.FC<ResponsePanelProps> = ({ currentLog, isLoading, responseHistory, onGenerateTests, isGeneratingTests }) => {
  const { addToast } = useToast();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useWidth(rootRef);
  const compact = width > 0 && width < 480;

  const response = currentLog?.response;
  const contentType = getContentType(response?.headers);
  const detected = useMemo(() => detectBody(response?.body, contentType), [response?.body, contentType]);
  const kind = detected.kind;
  const formats = FORMATS[kind];

  const [activeTab, setActiveTab] = useState('body');
  const [format, setFormat] = useState<Format>(formats[0] ?? 'raw');
  const [wrap, setWrap] = useState(true);
  const [dataPath, setDataPath] = useState<string[]>([]);
  const [foldCommand, setFoldCommand] = useState<FoldCommand | undefined>();
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Find bar
  const [findOpen, setFindOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 150);
  const [isRegex, setIsRegex] = useState(false);
  const [results, setResults] = useState<SearchResults>({ count: 0, error: null });
  const [activeMatch, setActiveMatch] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Loading timer
  const [startedAt, setStartedAt] = useState<number | undefined>();
  useEffect(() => {
    if (isLoading) setStartedAt(Date.now());
  }, [isLoading]);

  // Reset per-response view state; keep the chosen format when the kind is unchanged.
  const prevKind = useRef<BodyKind | null>(null);
  useEffect(() => {
    if (prevKind.current !== kind || !formats.includes(format)) setFormat(formats[0] ?? 'raw');
    prevKind.current = kind;
    setDataPath([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const isTextFormat = TEXT_FORMATS.includes(format) && kind !== 'empty' && kind !== 'image';

  const lines = useMemo(() => {
    if (!isTextFormat) return [];
    if (format === 'pretty' && kind === 'json') return buildJsonLines(detected.json);
    if (format === 'source' && (kind === 'html' || kind === 'xml')) return buildTextLines(detected.text, 'markup');
    return buildTextLines(detected.text);
  }, [detected, format, kind, isTextFormat]);

  const tableRoot = useMemo(() => {
    if (kind === 'json') return detected.json;
    if (kind === 'csv') {
      const parsed = Papa.parse<Record<string, unknown>>(detected.text.trim(), { header: true, skipEmptyLines: true, dynamicTyping: true });
      return parsed.data;
    }
    return null;
  }, [detected, kind]);

  const tableData = useMemo(() => {
    let cur: any = tableRoot;
    for (const seg of dataPath) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = cur[seg];
    }
    return cur;
  }, [tableRoot, dataPath]);

  const visualizable = useMemo(() => kind === 'json' && findVisualizableData(detected.json).length > 0, [kind, detected]);

  useEffect(() => {
    if (activeTab === 'visualize' && !visualizable) setActiveTab('body');
  }, [activeTab, visualizable]);

  const onSearchResults = useCallback((r: SearchResults) => {
    setResults(r);
    setActiveMatch(r.count > 0 ? 0 : -1);
  }, []);

  const openFind = useCallback(() => {
    setFindOpen(true);
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }, []);

  const closeFind = () => {
    setFindOpen(false);
    setSearchTerm('');
  };

  const step = (dir: 1 | -1) => {
    if (results.count === 0) return;
    setActiveMatch((i) => (i + dir + results.count) % results.count);
  };

  const onRootKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && activeTab === 'body' && isTextFormat) {
      e.preventDefault();
      openFind();
    }
  };

  const bodyText = useCallback((): string => {
    if (kind === 'json' && (format === 'pretty' || format === 'table')) {
      try {
        return JSON.stringify(format === 'table' ? tableData : detected.json, null, 2) ?? '';
      } catch {
        return detected.text;
      }
    }
    return detected.text;
  }, [kind, format, detected, tableData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(bodyText()).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      },
      () => addToast('Could not copy to the clipboard.', 'error')
    );
  };

  const filename = suggestFilename(currentLog?.request?.url, kind, contentType);

  const handleDownload = () => {
    if (!response) return;
    if (kind === 'image') {
      downloadBlob(dataUrlToBlob(detected.text), filename);
      return;
    }
    const mime = contentType.split(';')[0] || (kind === 'json' ? 'application/json' : 'text/plain');
    downloadBlob(new Blob([kind === 'json' && format !== 'raw' ? JSON.stringify(detected.json, null, 2) : detected.text], { type: `${mime};charset=utf-8` }), filename);
  };

  const handleExport = (type: 'csv' | 'xls') => {
    if (tableData === undefined || tableData === null) {
      addToast('There is no table data to export.', 'error');
      return;
    }
    const base = filename.replace(/\.[^.]+$/, '') + (dataPath.length ? `-${dataPath.join('.')}` : '');
    try {
      if (type === 'csv') exportDataAsCsv(tableData, `${base}.csv`);
      else exportDataAsXls(tableData, `${base}.xls`);
    } catch (e: any) {
      addToast(`Export failed: ${e.message}`, 'error');
    }
  };

  const otherHistory = useMemo(
    () => (currentLog ? responseHistory.filter((h) => h && h.response && h.response !== currentLog.response && h.id !== currentLog.id) : []),
    [responseHistory, currentLog]
  );

  // ---------------------------------------------------------------------------
  // States without a response

  const shell = (children: React.ReactNode) => (
    <div ref={rootRef} className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card" onKeyDown={onRootKeyDown}>
      {children}
    </div>
  );

  if (isLoading) {
    return shell(
      <>
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/15" aria-hidden="true">
          <div className="h-full w-1/3 animate-shimmer bg-primary" />
        </div>
        <ResponsePanelSkeleton startedAt={startedAt} />
      </>
    );
  }

  if (!response || !currentLog) {
    return shell(
      <>
        <div className="flex h-10 flex-shrink-0 items-center border-b border-border px-3">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Response</span>
        </div>
        <EmptyState
          icon={<SendHorizontal />}
          title="No response yet"
          message="Enter a URL and send the request. The status, body, headers and timing will appear here."
        >
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Send with <Kbd>{isMac ? '⌘' : 'Ctrl'}</Kbd>
            <Kbd>Enter</Kbd>
          </span>
        </EmptyState>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Status bar

  const isNetworkError = response.status === 0;
  const tone = getStatusTone(response.status);
  const testResults = response.testResults || [];
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.length - passed;
  const headerCount = Object.keys(response.headers || {}).length;
  const receivedAt = currentLog.timestamp ? new Date(currentLog.timestamp) : null;

  const statusBar = (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-border pl-3 pr-1.5">
      <Badge tone={tone} className="mr-1.5 !h-6 !px-2 !text-xs" title={receivedAt ? `Received ${receivedAt.toLocaleString()}` : undefined}>
        {statusLabel(response.status, response.statusText)}
      </Badge>
      <MetricPopover label={`Response time ${formatDuration(response.duration)}. Show timing details`} content={<TimeMetrics timing={response.timing} total={response.duration} />}>
        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-mono text-foreground">{formatDuration(response.duration)}</span>
      </MetricPopover>
      {!isNetworkError && (
        <MetricPopover
          label={`Response size ${formatBytes(response.size?.total || 0)}. Show size details`}
          content={<SizeMetrics requestSize={currentLog.request?.size} responseSize={response.size} />}
        >
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-mono text-foreground">{formatBytes(response.size?.total || 0)}</span>
        </MetricPopover>
      )}
      <span className="flex-1" />
      {otherHistory.length > 0 && (
        <Tooltip content={`Compare with ${otherHistory.length} previous response${otherHistory.length === 1 ? '' : 's'}`}>
          {compact ? (
            <IconButton size="sm" aria-label="Compare with previous responses" onClick={() => setIsDiffOpen(true)}>
              <GitCompareArrows className="h-3.5 w-3.5" />
            </IconButton>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setIsDiffOpen(true)}>
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare
            </Button>
          )}
        </Tooltip>
      )}
      {!isNetworkError && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" aria-label="AI actions" className={compact ? '!px-2' : ''}>
              {isGeneratingTests ? null : <Sparkles className="h-3.5 w-3.5" />}
              {isGeneratingTests ? <span className="text-xs">Generating…</span> : !compact && 'AI'}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60">
            <DropdownMenuLabel>AI assist</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setIsInsightsOpen(true)} disabled={kind === 'empty' || kind === 'image'}>
              <Sparkles />
              Explain this response
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGenerateTests} disabled={isGeneratingTests}>
              <TestTube2 />
              Generate tests from response
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  const modals = (
    <>
      {isDiffOpen && <ResponseDiffModal currentResponse={response} currentLogId={currentLog.id} currentTimestamp={currentLog.timestamp} history={otherHistory} onClose={() => setIsDiffOpen(false)} />}
      {isInsightsOpen && (
        <AiResponseInsightsModal
          show={isInsightsOpen}
          onClose={() => setIsInsightsOpen(false)}
          responseBody={detected.text}
          status={response.status}
          contentType={contentType}
        />
      )}
    </>
  );

  if (isNetworkError) {
    return shell(
      <>
        {statusBar}
        <ResponseErrorView response={response} request={currentLog.request} />
        {modals}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Body

  const showFind = findOpen && isTextFormat;
  const typeLabel = describeContentType(contentType, kind);

  const bodyToolbar = kind !== 'empty' && (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-border px-2">
      {formats.length > 1 ? (
        <SegmentedControl
          size="sm"
          aria-label="Body format"
          value={format}
          onChange={(v) => setFormat(v as Format)}
          options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] }))}
        />
      ) : null}
      {(!compact || formats.length <= 1) && (
        <span className="ml-1.5 truncate font-mono text-[11px] text-muted-foreground" title={contentType || undefined}>
          {typeLabel}
        </span>
      )}
      <span className="flex-1" />
      {format === 'pretty' && kind === 'json' && !compact && (
        <>
          <ToolbarButton label="Expand all" onClick={() => setFoldCommand({ type: 'expand', nonce: Date.now() })}>
            <ChevronsUpDown />
          </ToolbarButton>
          <ToolbarButton label="Collapse all" onClick={() => setFoldCommand({ type: 'collapse', nonce: Date.now() })}>
            <ChevronsDownUp />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
        </>
      )}
      {isTextFormat && (
        <>
          <ToolbarButton label="Search body" shortcut={`${isMac ? '⌘' : 'Ctrl'} F`} pressed={showFind} onClick={() => (showFind ? closeFind() : openFind())}>
            <Search />
          </ToolbarButton>
          <ToolbarButton label={wrap ? 'Disable line wrap' : 'Wrap long lines'} pressed={wrap} onClick={() => setWrap((w) => !w)}>
            <WrapText />
          </ToolbarButton>
        </>
      )}
      {format === 'table' && (
        <DropdownMenu>
          <Tooltip content="Export table">
            <DropdownMenuTrigger asChild>
              <IconButton size="sm" aria-label="Export table" className="[&_svg]:h-3.5 [&_svg]:w-3.5" disabled={tableData === undefined}>
                <TableIcon />
              </IconButton>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent className="w-52">
            <DropdownMenuLabel>Export {dataPath.length ? 'this level' : 'table'}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              <FileText />
              CSV (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('xls')}>
              <TableIcon />
              Excel (.xls)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {kind !== 'image' && (
        <ToolbarButton label={copied ? 'Copied' : format === 'table' && dataPath.length ? 'Copy this level as JSON' : 'Copy body'} onClick={handleCopy}>
          {copied ? <Check /> : <Copy />}
        </ToolbarButton>
      )}
      <ToolbarButton label={`Download ${filename}`} onClick={handleDownload}>
        <Download />
      </ToolbarButton>
    </div>
  );

  const findBar = showFind && (
    <div className="flex h-10 flex-shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-2">
      <div className="relative min-w-0 flex-1">
        <Input
          ref={searchInputRef}
          size="sm"
          icon={<Search />}
          placeholder={isRegex ? 'Regular expression' : 'Find in body'}
          aria-label="Find in body"
          value={searchTerm}
          invalid={!!results.error}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              closeFind();
            }
          }}
          className="!pr-24 font-mono"
        />
        {debouncedSearch && (
          <span
            className={`pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] tabular-nums ${
              results.error || results.count === 0 ? 'text-destructive-text' : 'text-muted-foreground'
            }`}
            aria-live="polite"
          >
            {results.error ? 'Invalid' : results.count === 0 ? 'No results' : `${activeMatch + 1} of ${results.count}${results.capped ? '+' : ''}`}
          </span>
        )}
      </div>
      <ToolbarButton label="Use regular expression" pressed={isRegex} onClick={() => setIsRegex((r) => !r)}>
        <Regex />
      </ToolbarButton>
      <ToolbarButton label="Previous match" shortcut="⇧ Enter" disabled={results.count === 0} onClick={() => step(-1)}>
        <ChevronUp />
      </ToolbarButton>
      <ToolbarButton label="Next match" shortcut="Enter" disabled={results.count === 0} onClick={() => step(1)}>
        <ChevronDown />
      </ToolbarButton>
      <ToolbarButton label="Close search" shortcut="Esc" onClick={closeFind}>
        <X />
      </ToolbarButton>
    </div>
  );

  const renderBody = () => {
    if (kind === 'empty') {
      return (
        <EmptyState
          compact
          icon={<FileText />}
          title="Empty body"
          message={response.status === 204 || response.status === 304 ? `${statusLabel(response.status, response.statusText)} responses carry no body.` : 'The server returned no content.'}
        />
      );
    }
    if (format === 'image') return <ImagePreview src={detected.text} contentType={contentType} size={response.size?.body} />;
    if (format === 'preview') return <HtmlPreview html={detected.text} baseUrl={currentLog.request?.url} />;
    if (format === 'table') {
      const shape = describeTableData(tableData);
      return (
        <div className="flex h-full min-h-0 flex-col">
          {(kind === 'json' || shape) && (
            <Breadcrumbs
              path={dataPath}
              onPathClick={(i) => setDataPath((p) => p.slice(0, i + 1))}
              onRootClick={() => setDataPath([])}
              trailing={shape}
            />
          )}
          <div className="min-h-0 flex-1">
            <TableView data={tableData} onDrillDown={kind === 'json' ? (segs) => setDataPath((p) => [...p, ...segs]) : undefined} />
          </div>
        </div>
      );
    }
    return (
      <CodeView
        lines={lines}
        wrap={wrap}
        foldable={format === 'pretty' && kind === 'json'}
        searchTerm={showFind ? debouncedSearch : ''}
        isRegex={isRegex}
        activeMatchIndex={activeMatch}
        onSearchResults={onSearchResults}
        foldCommand={foldCommand}
        ariaLabel={`Response body, ${FORMAT_LABEL[format]}`}
      />
    );
  };

  const testsBadge =
    testResults.length > 0 ? (
      <span className={`tabular-nums ${failed ? 'text-destructive-text' : 'text-success-text'}`}>
        {passed}/{testResults.length}
      </span>
    ) : undefined;

  return shell(
    <>
      {statusBar}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <div className="no-scrollbar flex-shrink-0 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_hsl(var(--border))]">
          <TabsList aria-label="Response sections" className="!border-b-0 px-1.5 [&>button]:!mb-0">
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers" badge={headerCount || undefined}>
              Headers
            </TabsTrigger>
            <TabsTrigger value="cookies" badge={response.cookies?.length || undefined}>
              Cookies
            </TabsTrigger>
            <TabsTrigger value="tests" badge={testsBadge}>
              Tests
            </TabsTrigger>
            <TabsTrigger value="timeline" title={hasTiming(response.timing) ? undefined : 'Timing breakdown unavailable for this response'}>
              Timeline
            </TabsTrigger>
            {visualizable && <TabsTrigger value="visualize">Visualize</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent value="body" className="flex min-h-0 flex-1 flex-col">
          {bodyToolbar}
          {findBar}
          <div className="min-h-0 flex-1">{renderBody()}</div>
        </TabsContent>
        <TabsContent value="headers" className="min-h-0 flex-1">
          <HeadersPanel headers={response.headers || {}} requestUrl={currentLog.request?.url} />
        </TabsContent>
        <TabsContent value="cookies" className="min-h-0 flex-1 overflow-auto">
          <CookiesPanel cookies={response.cookies || []} />
        </TabsContent>
        <TabsContent value="tests" className="min-h-0 flex-1">
          <TestResultsPanel results={testResults} onGenerateTests={onGenerateTests} isGeneratingTests={isGeneratingTests} />
        </TabsContent>
        <TabsContent value="timeline" className="min-h-0 flex-1 overflow-auto">
          <WaterfallPanel timing={response.timing} total={response.duration} />
        </TabsContent>
        {visualizable && (
          <TabsContent value="visualize" className="min-h-0 flex-1">
            <VisualizationPanel data={detected.json} />
          </TabsContent>
        )}
      </Tabs>
      {modals}
    </>
  );
};
