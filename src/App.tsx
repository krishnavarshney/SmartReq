import React, { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { LogEntry, FinalApiRequest, ApiResponse, SingleRequestLog, BulkRunLog, RequestItem, Collection, ApiRequest, BulkResult, BulkRunState, KeyValueItem, FlowRunResult, DiscoverySession } from './types';
import { SettingsModal } from './components/modals/SettingsModal';
import { ToastContainer } from './components/ToastContainer';
import { useToast } from './context/ToastContext';
import { Header } from './components/Header';
import { HeaderKPIs } from './components/HeaderKPIs';
import { BulkWorkspace } from './components/bulk/BulkWorkspace';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './components/sidebar/Sidebar';
import { buildFinalRequest, realApiCall } from './api';
import { SaveRequestModal } from './components/modals/SaveRequestModal';
import { useUrlSync } from './hooks/useUrlSync';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ImportModal } from './components/modals/ImportModal';
import { runTestScript } from './utils/scripting';
import { SingleRequestView } from './components/request/SingleRequestView';
import { Tabs, TabsList, TabsTrigger } from './components/ui/Tabs';
import { useApp } from './context/AppContext';
import { useWorkspace } from './context/WorkspaceContext';
import { useTabs } from './context/TabsContext';
import { useLog } from './context/LogContext';
import { useBulk } from './context/BulkContext';
import { createDefaultRequest, addNode as addNodeUtil } from './utils/collection';
import { OnboardingModal } from './components/modals/OnboardingModal';
import { FlowWorkspace } from './components/flow/FlowWorkspace';
import { DiscoveryWorkspace } from './components/discovery/DiscoveryWorkspace';
import { GoogleGenAI } from '@google/genai';
import { startDiscovery } from './utils/discovery';
import { interpolateString } from './utils/interpolation';
import { DiscoveryProvider } from './context/DiscoveryContext';

const AppContent: React.FC = () => {
  const { layout, setLayout, isSettingsOpen, setIsSettingsOpen, isSidebarOpen, setIsSidebarOpen, isImportModalOpen, setIsImportModalOpen, isOnboardingOpen, setIsOnboardingOpen, hasOnboarded } = useApp();
  const { workspace, setWorkspace, globals, handleCreateCollection, handleImportCollection, addNode, updateNode, findNode, activeEnvironmentId } = useWorkspace();
  const { tabs, setTabs, openTab, updateTab, activeTab, activeRequest, closeTab, saveRequestState, setSaveRequestState, activeTabId, setActiveTabId, setIsBodyInvalid, isBodyInvalid } = useTabs();
  const { logs, setLogs } = useLog();
  const { bulkData, setBulkData, bulkResults, setBulkResults, bulkRunState, setBulkRunState, bulkSettings, setBulkSettings, bulkRequest, setBulkRequest, bulkRunControllerRef, isPausedRef } = useBulk();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [mode, setMode] = React.useState<'single' | 'bulk' | 'flow' | 'discovery'>('single');
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);

  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [composerActiveTab, setComposerActiveTab] = useState<string | null>(null);
  
  const discoveryAbortController = useRef<AbortController | null>(null);

  const { addToast } = useToast();
  
  const handleRequestUpdate = useCallback((updates: Partial<ApiRequest>) => {
    if (activeTab && activeRequest) {
      updateTab(activeTab.id, { 
        request: { ...activeRequest, ...updates },
        isDirty: true 
      });
    }
  }, [activeTab, activeRequest, updateTab]);
  
  useUrlSync(activeRequest, handleRequestUpdate);

  // Onboarding logic
  useEffect(() => {
    if (!hasOnboarded) {
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 1000); // Small delay to let the app load
      return () => clearTimeout(timer);
    }
  }, [hasOnboarded, setIsOnboardingOpen]);

  // Tab auto-naming logic
  useEffect(() => {
    if (activeTab && activeTab.name === 'New Request' && activeRequest?.url) {
      try {
        const url = new URL(activeRequest.url);
        // Get the last non-empty path segment, or the hostname
        const pathSegments = url.pathname.split('/').filter(Boolean);
        const newName = pathSegments.pop() || url.hostname.replace('www.', '');
        if (newName && newName !== activeTab.name) {
          updateTab(activeTab.id, { name: newName, isRenaming: true });
        }
      } catch (e) {
        // Invalid URL, do nothing
      }
    }
  }, [activeRequest?.url, activeTab, activeTabId, updateTab]);

  const activeEnvironmentVariables = useMemo(() => {
    const activeEnv = workspace.environments.find(e => e.id === activeEnvironmentId);
    return activeEnv ? activeEnv.variables : [];
  }, [workspace.environments, activeEnvironmentId]);

  const allVariables: KeyValueItem[] = useMemo(() => [...globals, ...activeEnvironmentVariables], [globals, activeEnvironmentVariables]);

  const handleSend = useCallback(async (requestToSend: ApiRequest, dataForRow: Record<string, string> = {}): Promise<{ success: boolean, response: ApiResponse }> => {
    if (mode === 'single') setIsLoading(true);
    
    const finalRequest = buildFinalRequest(requestToSend, dataForRow, allVariables);
    
    let apiResponse = await realApiCall(finalRequest);
    
    if (requestToSend.testScript) {
        const scriptEnv = allVariables.reduce((acc, v) => {
          if (v.enabled && v.key) acc[v.key] = v.value;
          return acc;
        }, {} as Record<string, string>);

        const testResults = runTestScript(requestToSend.testScript, apiResponse, { ...scriptEnv, ...dataForRow });
        apiResponse = { ...apiResponse, testResults };
    }

    const requestHeadersString = finalRequest.headers
        .filter(h => h.enabled)
        .map(h => `${h.key}: ${h.value}`).join('\n');
    const requestBodySize = typeof finalRequest.body === 'string' ? new TextEncoder().encode(finalRequest.body).length : 0;
    const headerBytes = new TextEncoder().encode(requestHeadersString).length;
    finalRequest.size = {
        headers: headerBytes,
        body: requestBodySize,
        total: headerBytes + requestBodySize
    };

    if (mode === 'single' && activeTab) {
        const newLog: SingleRequestLog = {
            id: Date.now(),
            mode: 'single',
            requestId: activeTab.originalRequestId,
            originalRequest: requestToSend,
            request: finalRequest,
            response: apiResponse,
            timestamp: new Date().toISOString(),
        };
        setLogs(prev => [newLog, ...prev.slice(0, 99)]);
        
        if (activeTab.originalRequestId) {
          updateNode(activeTab.originalRequestId, (node) => {
            if (node.type === 'request') {
              node.responses = [newLog, ...(node.responses || []).slice(0, 19)];
            }
            return node;
          });
        }
        
        updateTab(activeTab.id, { latestResponse: apiResponse });
    }
    
    const isSuccess = apiResponse.status >= 200 && apiResponse.status < 300;
    return { success: isSuccess, response: apiResponse };

  }, [mode, allVariables, activeTab, setLogs, updateTab, updateNode]);

  const handleSingleSend = () => {
    if (!activeRequest) return;
    if (isBodyInvalid) {
      addToast('Request body is invalid JSON. Please fix it before sending.', 'error');
      return;
    }
    handleSend(activeRequest, {}).finally(() => setIsLoading(false));
  };

  const handleTestSend = useCallback(() => {
    if (bulkData.length > 0) {
        setIsLoading(true);
        handleSend(bulkRequest, bulkData[0]).then(({ response }) => {
            addToast(`Test request sent: ${response.status} ${response.statusText}`, response.status >= 200 && response.status < 300 ? 'success' : 'error');
        }).finally(() => setIsLoading(false));
    } else {
        addToast('No data available to send a test request.', 'info');
    }
  }, [bulkData, bulkRequest, handleSend, addToast]);
  
  const handleSaveRequest = useCallback(() => {
    if (!activeTab || !activeTab.isDirty) return;
    
    if (activeTab.originalRequestId) {
      updateNode(activeTab.originalRequestId, (node) => {
        if (node.type === 'request') {
          node.request = activeTab.request;
          node.name = activeTab.name;
        }
        return node;
      });
      updateTab(activeTab.id, { isDirty: false });
      addToast('Request saved!', 'success');
    } else {
      setSaveRequestState({ isOpen: true, tabId: activeTab.id });
    }
  }, [activeTab, updateNode, updateTab, addToast, setSaveRequestState]);
  
  const handleSaveAsRequest = useCallback((name: string, parentId: string) => {
    if (!saveRequestState.tabId) return;
    const tabToSave = tabs.find(t => t.id === saveRequestState.tabId);
    if (!tabToSave) return;
    
    const newRequestItem: RequestItem = {
      id: uuidv4(),
      type: 'request',
      name: name,
      request: tabToSave.request,
      responses: [],
    };
    
    addNode(newRequestItem, parentId);
    
    updateTab(saveRequestState.tabId, { 
      isDirty: false, 
      name: name, 
      originalRequestId: newRequestItem.id 
    });
    
    setSaveRequestState({ isOpen: false, tabId: null });
    addToast('Request saved!', 'success');
  }, [addNode, tabs, updateTab, saveRequestState.tabId, setSaveRequestState, addToast]);

  const handleNewRequest = useCallback(() => {
    let parentId: string | undefined = undefined;
    let currentWorkspace = workspace;
    
    const selectedNode = selectedNodeId ? findNode(selectedNodeId) : null;
    if (selectedNode && selectedNode.type !== 'request') {
        parentId = selectedNode.id;
    } else if (workspace.collections.length > 0) {
        parentId = workspace.collections[0].id;
    } else {
        const newCollection: Collection = {
            id: uuidv4(),
            type: 'collection',
            name: 'My Collection',
            children: [],
        };
        currentWorkspace = { ...workspace, collections: [newCollection] };
        setWorkspace(currentWorkspace);
        parentId = newCollection.id;
    }
    
    const newRequestItem: RequestItem = {
      id: uuidv4(),
      type: 'request',
      name: 'New Request',
      request: createDefaultRequest(),
      responses: [],
    };

    const updatedWorkspace = addNodeUtil(currentWorkspace, newRequestItem, parentId);
    setWorkspace(updatedWorkspace);
    
    openTab(newRequestItem, 'New Request');
  }, [workspace, selectedNodeId, findNode, setWorkspace, openTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            if (activeTab?.isDirty) {
                handleSaveRequest();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab, handleSaveRequest]);

  const runBulkRequests = useCallback(async (controller: AbortController) => {
    setBulkRunState('running');
    const initialResults: BulkResult[] = bulkData.map((data, i) => ({
      id: i + 1, data, request: {} as FinalApiRequest, response: {} as ApiResponse, status: 'pending'
    }));
    setBulkResults(initialResults);

    const queue = [...initialResults];
    const worker = async () => {
      while (queue.length > 0) {
        if (controller.signal.aborted) {
          break;
        }
        if (isPausedRef.current) {
          setBulkRunState('paused');
          break;
        }
        const item = queue.shift();
        if (!item) continue;
        
        const { success, response } = await handleSend(bulkRequest, item.data);
        const finalRequest = buildFinalRequest(bulkRequest, item.data, allVariables);
        
        setBulkResults(prev => prev.map(r => r.id === item.id ? { ...item, request: finalRequest, response, status: success ? 'success' : 'error' } : r));
        if (bulkSettings.delay > 0) await new Promise(r => setTimeout(r, bulkSettings.delay));
      }
    };
    await Promise.all(Array(bulkSettings.concurrency).fill(0).map(worker));
    if (!controller.signal.aborted && !isPausedRef.current) setBulkRunState('finished');
  }, [bulkData, bulkRequest, allVariables, handleSend, bulkSettings.concurrency, bulkSettings.delay, setBulkRunState, setBulkResults, isPausedRef]);

  const prevRunStateRef = useRef<BulkRunState | undefined>(undefined);
  useEffect(() => {
    if (prevRunStateRef.current !== 'finished' && bulkRunState === 'finished') {
       const newLog: BulkRunLog = {
         id: Date.now(),
         mode: 'bulk',
         requestTemplate: bulkRequest,
         data: bulkData,
         settings: bulkSettings,
         results: bulkResults,
         timestamp: new Date().toISOString()
       };
       setLogs(prev => [newLog, ...prev.slice(0, 99)]);
    }
    prevRunStateRef.current = bulkRunState;
  }, [bulkRunState, bulkRequest, bulkData, bulkSettings, bulkResults, setLogs]);


  const handleBulkRun = useCallback(() => {
    isPausedRef.current = false;
    const controller = new AbortController();
    bulkRunControllerRef.current = controller;
    runBulkRequests(controller);
  }, [runBulkRequests, isPausedRef, bulkRunControllerRef]);

  const handleBulkPause = () => { isPausedRef.current = true; };
  const handleBulkResume = () => { isPausedRef.current = false; setBulkRunState('running'); };
  const handleBulkStop = () => {
    isPausedRef.current = false;
    bulkRunControllerRef.current?.abort();
    setBulkRunState('stopped');
  };
  
  const handleGenerateBulkData = (data: Record<string, any>[]) => {
    const stringData = data.map(row =>
      Object.entries(row).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return acc;
      }, {} as Record<string, string>)
    );
    setBulkData(stringData);
    setMode('bulk');
    addToast(`Generated ${data.length} data rows for bulk execution.`, 'success');
  };

  const handleLogClick = useCallback((log: LogEntry) => {
    if (log.mode === 'single') {
        const { originalRequest, response, requestId } = log;
        const newTab = {
            id: uuidv4(),
            name: originalRequest.url.split('?')[0].split('/').pop() || 'Request from Log',
            request: JSON.parse(JSON.stringify(originalRequest)), // Deep clone
            isDirty: false,
            originalRequestId: requestId,
            latestResponse: response,
        };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        setMode('single');
        addToast('Loaded request from history', 'info');
    } else { // bulk
        setMode('bulk');
        setBulkRequest(log.requestTemplate);
        setBulkData(log.data);
        setBulkResults(log.results);
        setBulkSettings(log.settings);
        setBulkRunState('finished');
        addToast('Loaded bulk run from history', 'info');
    }
  }, [setTabs, setActiveTabId, setMode, addToast, setBulkRequest, setBulkData, setBulkResults, setBulkSettings, setBulkRunState]);

  const handleClearCache = useCallback(() => {
    // Replace browser confirm with modal-based confirmation handled in SettingsModal footer
    try {
      window.localStorage.clear();
      addToast('Cache cleared successfully. Reloading...', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      addToast('Failed to clear cache.', 'error');
      console.error('Failed to clear cache', error);
    }
  }, [addToast]);

  const handleGenerateTests = useCallback(async () => {
    if (!activeTab?.latestResponse) return;
    if (!(import.meta as any).env.VITE_GEMINI_API_KEY) {
      addToast('Gemini API key is not configured. Set VITE_GEMINI_API_KEY in your .env.', 'error');
      return;
    }

    setIsGeneratingTests(true);
    
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
Respond ONLY with the raw JavaScript code block. Do not include markdown fences like '''javascript or any other explanatory text.`;

    try {
        const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY });
        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const generatedScript = geminiResponse.text.trim();
        if (activeRequest) {
            const currentScript = activeRequest.testScript || '';
            const newScript = currentScript ? `${currentScript}\n\n// AI Generated Tests\n${generatedScript}` : generatedScript;
            handleRequestUpdate({ testScript: newScript });
            setComposerActiveTab('Tests'); // Switch to tests tab
            addToast('AI tests generated successfully!', 'success');
        }
    } catch (e) {
        console.error("AI test generation failed:", e);
        addToast('Failed to generate tests.', 'error');
    } finally {
        setIsGeneratingTests(false);
    }
  }, [activeTab?.latestResponse, activeRequest, addToast, handleRequestUpdate, setComposerActiveTab]);
  
  const showWelcomeScreen = workspace.collections.length === 0 && tabs.length === 0;

  return (
    <div className="flex flex-col h-screen font-sans antialiased text-foreground isolate">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
            onLogClick={handleLogClick}
            openRequestInTab={openTab}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
        />

        <div className="flex-1 flex flex-col relative">
          <div 
            className={`
              fixed inset-0 bg-background/80 z-30 md:hidden 
              transition-opacity duration-300 ease-in-out
              ${isSidebarOpen ? 'opacity-100 backdrop-blur-sm' : 'opacity-0 pointer-events-none'}
            `}
            onClick={() => setIsSidebarOpen(false)} 
          />
          <main className="flex-1 flex flex-col p-4 md:p-6 gap-6 animate-fade-in">
            <div className="flex-shrink-0 sticky top-0 z-10 bg-background/70 backdrop-blur-md border-b border-border">
                <div className="flex items-center justify-between gap-3">
                  <Tabs value={mode} onValueChange={(value) => setMode(value as any)} className="flex-1">
                      <TabsList className="flex w-full gap-1 overflow-x-auto md:grid md:grid-cols-4">
                          <TabsTrigger value="single">Single Request</TabsTrigger>
                          <TabsTrigger value="bulk">Bulk Mode</TabsTrigger>
                          <TabsTrigger value="flow">Flow</TabsTrigger>
                          <TabsTrigger value="discovery">Discovery</TabsTrigger>
                      </TabsList>
                  </Tabs>
                  {/* Layout toggle */}
                  <div className="hidden md:flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Layout</span>
                    <div className="inline-flex rounded-md border border-border p-0.5 bg-card">
                      <button
                        aria-label="Horizontal layout"
                        className={`px-2 py-1 text-xs rounded ${layout === 'horizontal' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background'}`}
                        onClick={() => setLayout('horizontal')}
                      >
                        Horizontal
                      </button>
                      <button
                        aria-label="Vertical layout"
                        className={`px-2 py-1 text-xs rounded ${layout === 'vertical' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-background'}`}
                        onClick={() => setLayout('vertical')}
                      >
                        Vertical
                      </button>
                    </div>
                  </div>
                </div>
                <div className="py-3">
                  <HeaderKPIs />
                </div>
            </div>

            <div className={`${mode === 'single' ? 'opacity-100' : ''}`} hidden={mode !== 'single'}>
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
                  isLoading={isLoading}
                  handleGenerateBulkData={handleGenerateBulkData}
                  handleSaveRequest={handleSaveRequest}
                  onGenerateTests={handleGenerateTests}
                  isGeneratingTests={isGeneratingTests}
                  composerActiveTab={composerActiveTab}
                  setComposerActiveTab={setComposerActiveTab}
                />
              )}
            </div>
            <div className={`${mode === 'bulk' ? 'opacity-100' : ''}`} hidden={mode !== 'bulk'}>
              <BulkWorkspace
                request={bulkRequest}
                onRequestChange={setBulkRequest}
                isBodyInvalid={false} // Managed within bulk mode context
                onBodyValidationChange={setIsBodyInvalid}
                data={bulkData}
                onDataChange={setBulkData}
                results={bulkResults}
                runState={bulkRunState}
                onRun={handleBulkRun}
                onPause={handleBulkPause}
                onResume={handleBulkResume}
                onStop={handleBulkStop}
                onTestSend={handleTestSend}
                settings={bulkSettings}
                onSettingsChange={setBulkSettings}
                onGenerateBulkData={handleGenerateBulkData}
                globals={allVariables}
              />
            </div>
            <div className={`${mode === 'flow' ? 'opacity-100' : ''}`} hidden={mode !== 'flow'}>
              <FlowWorkspace />
            </div>
            <div className={`${mode === 'discovery' ? 'opacity-100' : ''}`} hidden={mode !== 'discovery'}>
              <DiscoveryWorkspace />
            </div>
          </main>
        </div>
      </div>
      
      {saveRequestState.isOpen && (
        <SaveRequestModal
          onClose={() => setSaveRequestState({ isOpen: false, tabId: null })}
          onSave={handleSaveAsRequest}
        />
      )}
      
      {isImportModalOpen && (
          <ImportModal 
              onImport={handleImportCollection}
          />
      )}

      <OnboardingModal />

      <SettingsModal 
        show={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onClearCache={handleClearCache}
      />
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
