import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { FilePlus, FolderPlus, Import, LayoutHorizontal, LayoutVertical, Settings, FileText, History, Globe } from './components/icons';
import { Monitor, Moon, Sun, PanelLeft } from 'lucide-react';
import {
  LogEntry,
  ApiResponse,
  SingleRequestLog,
  RequestItem,
  Collection,
  ApiRequest,
  KeyValueItem,
  FinalApiRequest,
  RequestNode,
  Tab,
} from './types';
import { SettingsModal } from './components/modals/SettingsModal';
import { ToastContainer } from './components/ToastContainer';
import { useToast } from './context/ToastContext';
import { Header, MODES, MOD_KEY } from './components/Header';
import { BulkWorkspace } from './components/bulk/BulkWorkspace';
import { Sidebar } from './components/sidebar/Sidebar';
import { buildFinalRequest, realApiCall } from './api';
import { SaveRequestModal } from './components/modals/SaveRequestModal';
import { useUrlSync } from './hooks/useUrlSync';
import { WelcomeScreen } from './components/WelcomeScreen';
import { runTestScript } from './utils/scripting';
import { SingleRequestView } from './components/request/SingleRequestView';
import { AppMode, useApp } from './context/AppContext';
import { useWorkspace } from './context/WorkspaceContext';
import { useTabs } from './context/TabsContext';
import { useLog } from './context/LogContext';
import { useBulk } from './context/BulkContext';
import { useTheme } from './context/ThemeContext';
import { createDefaultRequest, addNode as addNodeUtil } from './utils/collection';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { FlowWorkspace } from './components/flow/FlowWorkspace';
import { DiscoveryWorkspace } from './components/discovery/DiscoveryWorkspace';
import { getApiKey } from './utils/apiKey';
import { DiscoveryProvider } from './context/DiscoveryContext';
import { CommandPalette, CommandItem } from './components/ui/CommandPalette';
import { useBulkRunner } from './hooks/useBulkRunner';

// Heavy parsers (OpenAPI, curl/tree-sitter) only load when the import dialog opens.
const ImportModal = lazy(() => import('./components/modals/ImportModal').then((m) => ({ default: m.ImportModal })));

const byteLength = (s: string) => new TextEncoder().encode(s).length;

const collectRequests = (nodes: RequestNode[], path: string[] = []): { item: RequestItem; path: string }[] =>
  nodes.flatMap((n) =>
    n.type === 'request' ? [{ item: n, path: path.join(' / ') }] : collectRequests(n.children, [...path, n.name])
  );

const AppContent: React.FC = () => {
  const {
    mode,
    setMode,
    layout,
    setLayout,
    isSettingsOpen,
    setIsSettingsOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    revealSidebarPanel,
    isImportModalOpen,
    setIsImportModalOpen,
    setIsOnboardingOpen,
    hasOnboarded,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isMobile,
  } = useApp();
  const { setTheme } = useTheme();
  const { workspace, setWorkspace, globals, handleCreateCollection, handleImportCollection, addNode, updateNode, findNode, activeEnvironmentId } =
    useWorkspace();
  const { tabs, setTabs, openTab, updateTab, activeTab, activeRequest, saveRequestState, setSaveRequestState, setActiveTabId, isBodyInvalid } =
    useTabs();
  const { setLogs } = useLog();
  const { bulkData, setBulkData, bulkResults, setBulkResults, bulkRunState, setBulkRunState, bulkSettings, setBulkSettings, bulkRequest, setBulkRequest } =
    useBulk();
  const { addToast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [composerActiveTab, setComposerActiveTab] = useState<string | null>(null);

  const handleRequestUpdate = useCallback(
    (updates: Partial<ApiRequest>, options?: { silent?: boolean }) => {
      if (activeTab && activeRequest) {
        updateTab(activeTab.id, { request: { ...activeRequest, ...updates }, isDirty: options?.silent ? activeTab.isDirty : true });
      }
    },
    [activeTab, activeRequest, updateTab]
  );

  useUrlSync(activeRequest, handleRequestUpdate);

  // First-run onboarding
  useEffect(() => {
    if (hasOnboarded) return;
    const timer = setTimeout(() => setIsOnboardingOpen(true), 600);
    return () => clearTimeout(timer);
  }, [hasOnboarded, setIsOnboardingOpen]);

  const allVariables: KeyValueItem[] = useMemo(() => {
    const activeEnv = workspace.environments.find((e) => e.id === activeEnvironmentId);
    return [...globals, ...(activeEnv ? activeEnv.variables : [])];
  }, [workspace.environments, activeEnvironmentId, globals]);

  /** Build, send and test one request. Pure: no logging or UI state. */
  const executeRequest = useCallback(
    async (
      requestToSend: ApiRequest,
      dataForRow: Record<string, string> = {},
      signal?: AbortSignal
    ): Promise<{ request: FinalApiRequest; response: ApiResponse }> => {
      const finalRequest = buildFinalRequest(requestToSend, dataForRow, allVariables);
      let response = await realApiCall(finalRequest, { signal });

      if (requestToSend.testScript) {
        const scriptEnv = allVariables.reduce(
          (acc, v) => {
            if (v.enabled && v.key) acc[v.key] = v.value;
            return acc;
          },
          {} as Record<string, string>
        );
        const testResults = runTestScript(requestToSend.testScript, response, { ...scriptEnv, ...dataForRow });
        response = { ...response, testResults };
      }

      const headerBytes = byteLength(
        finalRequest.headers
          .filter((h) => h.enabled)
          .map((h) => `${h.key}: ${h.value}`)
          .join('\n')
      );
      const bodyBytes = typeof finalRequest.body === 'string' ? byteLength(finalRequest.body) : 0;
      finalRequest.size = { headers: headerBytes, body: bodyBytes, total: headerBytes + bodyBytes };
      return { request: finalRequest, response };
    },
    [allVariables]
  );

  const sendControllerRef = useRef<AbortController | null>(null);
  const handleCancelRequest = useCallback(() => sendControllerRef.current?.abort(), []);

  const handleSingleSend = useCallback(async () => {
    if (!activeRequest || !activeTab || isLoading) return;
    if (!activeRequest.url.trim()) {
      addToast('Enter a URL before sending.', 'info');
      return;
    }
    if (isBodyInvalid) {
      addToast('Request body is invalid JSON. Fix it before sending.', 'error');
      return;
    }
    const tabId = activeTab.id;
    const originalRequestId = activeTab.originalRequestId;
    setIsLoading(true);
    const controller = new AbortController();
    sendControllerRef.current = controller;
    try {
      const { request, response } = await executeRequest(activeRequest, {}, controller.signal);
      const newLog: SingleRequestLog = {
        id: Date.now(),
        mode: 'single',
        requestId: originalRequestId,
        originalRequest: activeRequest,
        request,
        response,
        timestamp: new Date().toISOString(),
      };
      setLogs((prev) => [newLog, ...prev.slice(0, 99)]);
      if (originalRequestId) {
        updateNode(originalRequestId, (node) =>
          node.type === 'request' ? { ...node, responses: [newLog, ...(node.responses || []).slice(0, 19)] } : node
        );
      }
      // Name untitled tabs after the URL on first send, not on every keystroke
      // (typing "http://l" used to rename the tab "l" permanently).
      const updates: Partial<Tab> = { latestResponse: response };
      if (activeTab.name === 'New Request' && !originalRequestId) {
        try {
          const url = new URL(request.url);
          const name = url.pathname.split('/').filter(Boolean).pop() || url.hostname.replace(/^www\./, '');
          if (name) updates.name = name;
        } catch {
          /* leave the default name */
        }
      }
      updateTab(tabId, updates);
    } finally {
      if (sendControllerRef.current === controller) sendControllerRef.current = null;
      setIsLoading(false);
    }
  }, [activeRequest, activeTab, isLoading, isBodyInvalid, executeRequest, setLogs, updateNode, updateTab, addToast]);

  const bulkRunner = useBulkRunner(executeRequest);

  const handleTestSend = useCallback(async () => {
    if (bulkData.length === 0) {
      addToast('Add data rows first, then send a test request with row 1.', 'info');
      return;
    }
    setIsTestSending(true);
    try {
      const { response } = await executeRequest(bulkRequest, bulkData[0]);
      const ok = response.status >= 200 && response.status < 300;
      addToast(`Row 1 test: ${response.status || 'Failed'} ${response.statusText}`, ok ? 'success' : 'error');
    } finally {
      setIsTestSending(false);
    }
  }, [bulkData, bulkRequest, executeRequest, addToast]);

  const handleSaveRequest = useCallback(() => {
    if (!activeTab) return;
    if (activeTab.originalRequestId && findNode(activeTab.originalRequestId)) {
      if (!activeTab.isDirty) return;
      updateNode(activeTab.originalRequestId, (node) =>
        node.type === 'request' ? { ...node, request: activeTab.request, name: activeTab.name } : node
      );
      updateTab(activeTab.id, { isDirty: false });
      addToast('Request saved', 'success');
    } else {
      setSaveRequestState({ isOpen: true, tabId: activeTab.id });
    }
  }, [activeTab, findNode, updateNode, updateTab, addToast, setSaveRequestState]);

  const handleSaveAsRequest = useCallback(
    (name: string, parentId: string) => {
      if (!saveRequestState.tabId) return;
      const tabToSave = tabs.find((t) => t.id === saveRequestState.tabId);
      if (!tabToSave) return;
      const newRequestItem: RequestItem = { id: uuidv4(), type: 'request', name, request: tabToSave.request, responses: [] };
      addNode(newRequestItem, parentId);
      updateTab(saveRequestState.tabId, { isDirty: false, name, originalRequestId: newRequestItem.id });
      setSaveRequestState({ isOpen: false, tabId: null });
      addToast('Request saved', 'success');
    },
    [addNode, tabs, updateTab, saveRequestState.tabId, setSaveRequestState, addToast]
  );

  const handleNewRequest = useCallback(() => {
    let parentId: string | undefined;
    let currentWorkspace = workspace;
    const selectedNode = selectedNodeId ? findNode(selectedNodeId) : null;
    if (selectedNode && selectedNode.type !== 'request') {
      parentId = selectedNode.id;
    } else if (workspace.collections.length > 0) {
      parentId = workspace.collections[0].id;
    } else {
      const newCollection: Collection = { id: uuidv4(), type: 'collection', name: 'My Collection', children: [] };
      currentWorkspace = { ...workspace, collections: [newCollection] };
      parentId = newCollection.id;
    }
    const newRequestItem: RequestItem = { id: uuidv4(), type: 'request', name: 'New Request', request: createDefaultRequest(), responses: [] };
    setWorkspace(addNodeUtil(currentWorkspace, newRequestItem, parentId));
    openTab(newRequestItem, 'New Request');
    setMode('single');
  }, [workspace, selectedNodeId, findNode, setWorkspace, openTab, setMode]);

  const handleGenerateBulkData = useCallback(
    (data: Record<string, unknown>[]) => {
      const stringData = data.map((row) =>
        Object.entries(row).reduce(
          (acc, [key, value]) => {
            acc[key] = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
            return acc;
          },
          {} as Record<string, string>
        )
      );
      setBulkData(stringData);
      setMode('bulk');
      addToast(`Generated ${data.length} rows for Bulk mode`, 'success');
    },
    [setBulkData, setMode, addToast]
  );

  const handleLogClick = useCallback(
    (log: LogEntry) => {
      if (log.mode === 'single') {
        const { originalRequest, response, requestId } = log;
        const newTab = {
          id: uuidv4(),
          name: originalRequest.url.split('?')[0].split('/').filter(Boolean).pop() || 'Request from history',
          request: structuredClone(originalRequest),
          isDirty: false,
          originalRequestId: requestId,
          latestResponse: response,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setMode('single');
      } else {
        bulkRunner.stop();
        setBulkRequest(log.requestTemplate);
        setBulkData(log.data);
        setBulkSettings(log.settings);
        bulkRunner.restore(log.results);
        setBulkRunState('finished');
        setMode('bulk');
      }
      if (isMobile) setIsSidebarOpen(false);
    },
    [setTabs, setActiveTabId, setMode, setBulkRequest, setBulkData, setBulkSettings, setBulkRunState, bulkRunner, isMobile, setIsSidebarOpen]
  );

  const handleClearCache = useCallback(() => {
    try {
      window.localStorage.clear();
      addToast('All local data cleared. Reloading…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      addToast('Could not clear local data.', 'error');
    }
  }, [addToast]);

  const handleGenerateTests = useCallback(async () => {
    if (!activeTab?.latestResponse) return;
    const apiKey = getApiKey();
    if (!apiKey) {
      addToast('Add a Gemini API key in Settings to generate tests.', 'error');
      setIsSettingsOpen(true);
      return;
    }
    setIsGeneratingTests(true);
    const tabId = activeTab.id;
    const response = activeTab.latestResponse;
    const bodyString = typeof response.body === 'string' ? response.body : JSON.stringify(response.body, null, 2);
    const prompt = `You are an expert JavaScript developer writing test scripts for an API client. The test environment provides a 'pm' object.
- 'const response = pm.response.json()' gets the JSON body.
- 'pm.test("Test Name", () => { pm.expect(value).to.eql(expected); })' defines a test.
- Common assertions: '.to.eql()', '.to.have.property()', '.to.be.a()', '.to.include()'.
- 'pm.response.to.have.status(200)' checks the status code.
- 'pm.response.to.have.header("Content-Type")' checks for a header.

Based on this API response:
- Status: ${response.status} ${response.statusText}
- Headers: ${JSON.stringify(response.headers, null, 2)}
- Body (first 1000 chars): ${bodyString.substring(0, 1000)}

Write a comprehensive test suite. Include tests for status code, important headers like Content-Type, and key properties in the body. Check for data types and non-null values where appropriate.
Respond ONLY with the raw JavaScript code. Do not include markdown fences or any explanatory text.`;
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      const generated = (result.text ?? '').replace(/^```(?:javascript|js)?\s*|```\s*$/g, '').trim();
      if (!generated) throw new Error('Empty response');
      // Merge into the tab's latest state: the user may have edited the request
      // while Gemini was answering, and the closure's activeRequest is stale.
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          const current = t.request.testScript || '';
          const testScript = current ? `${current}\n\n// AI generated tests\n${generated}` : generated;
          return { ...t, request: { ...t.request, testScript }, isDirty: true };
        })
      );
      setComposerActiveTab('Tests');
      addToast('Tests generated', 'success');
    } catch (e) {
      addToast(`Test generation failed${e instanceof Error && e.message ? `: ${e.message}` : ''}`, 'error');
    } finally {
      setIsGeneratingTests(false);
    }
  }, [activeTab?.latestResponse, activeTab?.id, setTabs, addToast, setIsSettingsOpen]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((v) => !v);
      } else if (key === 'b') {
        event.preventDefault();
        setIsSidebarOpen((v) => !v);
      } else if (key === 's' && mode === 'single') {
        event.preventDefault();
        handleSaveRequest();
      } else if (key === 'enter' && mode === 'single') {
        event.preventDefault();
        void handleSingleSend();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, handleSaveRequest, handleSingleSend, setIsCommandPaletteOpen, setIsSidebarOpen]);

  const paletteItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      { id: 'new-request', title: 'New request', group: 'Actions', icon: <FilePlus />, action: handleNewRequest },
      { id: 'new-collection', title: 'New collection', group: 'Actions', icon: <FolderPlus />, action: handleCreateCollection },
      { id: 'import', title: 'Import collection…', group: 'Actions', icon: <Import />, keywords: 'openapi swagger postman curl', action: () => setIsImportModalOpen(true) },
      ...MODES.map((m) => ({
        id: `mode-${m.value}`,
        title: `Go to ${m.label}`,
        group: 'Navigate',
        icon: m.icon,
        action: () => setMode(m.value as AppMode),
      })),
      { id: 'history', title: 'Show history', group: 'Navigate', icon: <History />, action: () => revealSidebarPanel('history') },
      { id: 'environments', title: 'Manage environments', group: 'Navigate', icon: <Globe />, keywords: 'variables', action: () => revealSidebarPanel('environment') },
      { id: 'toggle-sidebar', title: isSidebarOpen ? 'Hide sidebar' : 'Show sidebar', group: 'View', icon: <PanelLeft />, shortcut: `${MOD_KEY} B`, action: () => setIsSidebarOpen((p) => !p) },
      {
        id: 'layout',
        title: layout === 'horizontal' ? 'Layout: stack response below' : 'Layout: response beside request',
        group: 'View',
        icon: layout === 'horizontal' ? <LayoutVertical /> : <LayoutHorizontal />,
        action: () => setLayout(layout === 'horizontal' ? 'vertical' : 'horizontal'),
      },
      { id: 'theme-light', title: 'Theme: Light', group: 'View', icon: <Sun />, action: () => setTheme('light') },
      { id: 'theme-dark', title: 'Theme: Dark', group: 'View', icon: <Moon />, action: () => setTheme('dark') },
      { id: 'theme-system', title: 'Theme: System', group: 'View', icon: <Monitor />, action: () => setTheme('system') },
      { id: 'settings', title: 'Open settings', group: 'App', icon: <Settings />, action: () => setIsSettingsOpen(true) },
    ];
    workspace.collections.forEach((c) => {
      collectRequests(c.children, [c.name]).forEach(({ item, path }) => {
        items.push({
          id: `req-${item.id}`,
          title: item.name,
          group: 'Requests',
          icon: <FileText />,
          keywords: `${path} ${item.request.method} ${item.request.url}`,
          action: () => {
            openTab(item, item.name);
            setMode('single');
          },
        });
      });
    });
    return items;
  }, [
    handleNewRequest,
    handleCreateCollection,
    setIsImportModalOpen,
    setMode,
    revealSidebarPanel,
    isSidebarOpen,
    setIsSidebarOpen,
    layout,
    setLayout,
    setTheme,
    setIsSettingsOpen,
    workspace.collections,
    openTab,
  ]);

  const showWelcomeScreen = workspace.collections.length === 0 && tabs.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <Header />

      <div className="relative flex min-h-0 flex-1">
        <Sidebar onLogClick={handleLogClick} openRequestInTab={openTab} selectedNodeId={selectedNodeId} setSelectedNodeId={setSelectedNodeId} />

        {/* Mobile drawer backdrop */}
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden ${isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
          onClick={() => setIsSidebarOpen(false)}
        />

        {/*
          Layout contract for workspaces: each mode renders into a box that exactly
          fills the remaining viewport. Workspace roots must be h-full and own their
          own scrolling. Modes stay mounted so in-progress state survives switching.
        */}
        <main id="main" className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <section aria-label="Request" hidden={mode !== 'single'} className="absolute inset-0">
            {showWelcomeScreen ? (
              <WelcomeScreen
                onCreateRequest={handleNewRequest}
                onCreateCollection={handleCreateCollection}
                onImport={() => setIsImportModalOpen(true)}
              />
            ) : (
              <SingleRequestView
                handleNewRequest={handleNewRequest}
                handleRequestUpdate={handleRequestUpdate}
                handleSingleSend={handleSingleSend}
                handleCancelRequest={handleCancelRequest}
                isLoading={isLoading}
                handleGenerateBulkData={handleGenerateBulkData}
                handleSaveRequest={handleSaveRequest}
                onGenerateTests={handleGenerateTests}
                isGeneratingTests={isGeneratingTests}
                composerActiveTab={composerActiveTab}
                setComposerActiveTab={setComposerActiveTab}
              />
            )}
          </section>
          <section aria-label="Bulk" hidden={mode !== 'bulk'} className="absolute inset-0">
            <BulkWorkspace
              request={bulkRequest}
              onRequestChange={setBulkRequest}
              data={bulkData}
              onDataChange={setBulkData}
              results={bulkResults}
              runState={bulkRunState}
              onRun={bulkRunner.start}
              onPause={bulkRunner.pause}
              onResume={bulkRunner.resume}
              onStop={bulkRunner.stop}
              onTestSend={handleTestSend}
              isTestSending={isTestSending}
              settings={bulkSettings}
              onSettingsChange={setBulkSettings}
              onGenerateBulkData={handleGenerateBulkData}
              globals={allVariables}
            />
          </section>
          <section aria-label="Flow" hidden={mode !== 'flow'} className="absolute inset-0">
            <FlowWorkspace />
          </section>
          <section aria-label="Discovery" hidden={mode !== 'discovery'} className="absolute inset-0">
            <DiscoveryWorkspace />
          </section>
        </main>
      </div>

      {saveRequestState.isOpen && (
        <SaveRequestModal onClose={() => setSaveRequestState({ isOpen: false, tabId: null })} onSave={handleSaveAsRequest} />
      )}
      {isImportModalOpen && (
        <Suspense fallback={null}>
          <ImportModal onImport={handleImportCollection} />
        </Suspense>
      )}
      <OnboardingModal />
      <SettingsModal show={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onClearCache={handleClearCache} />
      <CommandPalette open={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} items={paletteItems} />
      <ToastContainer />
    </div>
  );
};

const App: React.FC = () => (
  <DiscoveryProvider>
    <AppContent />
  </DiscoveryProvider>
);

export default App;
