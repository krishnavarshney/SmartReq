import React, { useMemo, useEffect, useCallback } from 'react';
import { Resizable } from 're-resizable';
import { ApiRequest, SingleRequestLog } from '../../types';
import { HorizontalResizableHandle } from '../ui/HorizontalResizableHandle';
import { VerticalResizableHandle } from '../ui/VerticalResizableHandle';
import { CornerResizableHandle } from '../ui/CornerResizableHandle';
import { RequestTabs } from './RequestTabs';
import { RequestPanel } from './RequestPanel';
import { RequestComposer } from './RequestComposer';
import { ResponsePanel } from '../response/ResponsePanel';
import { useApp } from '../../context/AppContext';
import { useTabs } from '../../context/TabsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useLog } from '../../context/LogContext';
import { buildFinalRequest } from '../../api';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface SingleRequestViewProps {
  handleNewRequest: () => void;
  handleRequestUpdate: (updates: Partial<ApiRequest>) => void;
  handleSingleSend: () => void;
  isLoading: boolean;
  handleGenerateBulkData: (data: Record<string, any>[]) => void;
  handleSaveRequest: () => void;
  onGenerateTests: () => Promise<void>;
  isGeneratingTests: boolean;
  composerActiveTab: string | null;
  setComposerActiveTab: (tab: string | null) => void;
}

export const SingleRequestView: React.FC<SingleRequestViewProps> = ({
  handleNewRequest,
  handleRequestUpdate,
  handleSingleSend,
  isLoading,
  handleGenerateBulkData,
  handleSaveRequest,
  onGenerateTests,
  isGeneratingTests,
  composerActiveTab,
  setComposerActiveTab,
}) => {
  const { layout } = useApp();
  const { activeTab, activeRequest, updateTab, isBodyInvalid, setIsBodyInvalid } = useTabs();
  const { globals, findNode, activeEnvironmentId, environments } = useWorkspace();
  const { logs } = useLog();

  useEffect(() => {}, [layout]);

  const activeEnvironmentVariables = useMemo(() => {
    const activeEnv = environments.find(e => e.id === activeEnvironmentId);
    return activeEnv ? activeEnv.variables : [];
  }, [environments, activeEnvironmentId]);

  const allVariables = useMemo(() => [...globals, ...activeEnvironmentVariables], [globals, activeEnvironmentVariables]);

  const activeLogForResponsePanel = useMemo<SingleRequestLog | null>(() => {
    if (!activeTab?.latestResponse || !activeRequest) return null;
    
    const log = logs.find(l => l.mode === 'single' && l.response === activeTab.latestResponse) as SingleRequestLog | undefined;
    if (log) return log;

    return {
      id: 0,
      mode: 'single',
      request: buildFinalRequest(activeRequest, {}, allVariables),
      originalRequest: activeRequest,
      response: activeTab.latestResponse,
      timestamp: new Date().toISOString(),
    }
  }, [activeTab, activeRequest, logs, allVariables]);
  
  const responseHistoryForActiveRequest = useMemo(() => {
    if (!activeTab?.originalRequestId) return activeTab?.latestResponse ? [activeLogForResponsePanel!] : [];
    const node = findNode(activeTab.originalRequestId);
    if (node?.type === 'request') return node.responses || [];
    return [];
  }, [findNode, activeTab?.originalRequestId, activeTab?.latestResponse, activeLogForResponsePanel]);

  const handleGenerateTestsAndSwitchTab = useCallback(async () => {
    await onGenerateTests();
  }, [onGenerateTests]);
  
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <div className={`flex-grow flex gap-4 ${isMobile || layout === 'vertical' ? 'flex-col' : 'flex-row'}`}>
      <Resizable 
        style={{ viewTransitionName: 'request-panel' }}
        className="flex flex-col overflow-hidden border border-border h-full rounded-lg bg-card shadow-popover"
        defaultSize={{
          width: isMobile ? '100%' : (layout === 'horizontal' ? '50%' : '100%'),
          height: isMobile ? 'auto' : (layout === 'vertical' ? '50%' : '100%'),
        }}
        minHeight={isMobile ? 'auto' : 200}
        minWidth={isMobile ? 'auto' : 260}
        enable={{
          right: !isMobile && layout === 'horizontal',
          bottom: !isMobile && layout === 'vertical',
          bottomRight: !isMobile && layout !== 'vertical',
        }}
        handleComponent={{ 
          bottom: <HorizontalResizableHandle />, 
          right: <VerticalResizableHandle />,
          bottomRight: <CornerResizableHandle />
        }}
      >
        <div className="h-full w-full flex flex-col rounded-lg overflow-hidden bg-card">
          <RequestTabs 
            onNewTab={handleNewRequest}
          />
          {activeTab && activeRequest ? (
            <>
              <RequestPanel
                method={activeRequest.method}
                onMethodChange={method => handleRequestUpdate({ method })}
                url={activeRequest.url}
                onUrlChange={url => handleRequestUpdate({ url })}
                onSend={handleSingleSend}
                isLoading={isLoading}
                isBodyInvalid={isBodyInvalid}
                globals={allVariables}
              />
              <div className="flex-grow overflow-y-auto max-h-full">
                <RequestComposer 
                  request={activeRequest} 
                  onRequestChange={req => updateTab(activeTab.id, { request: req, isDirty: true })} 
                  onBodyValidationChange={setIsBodyInvalid}
                  onGenerateBulkData={handleGenerateBulkData}
                  onSave={handleSaveRequest}
                  testResults={activeTab.latestResponse?.testResults}
                  globals={allVariables}
                  activeTab={composerActiveTab}
                  onTabChange={setComposerActiveTab}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Open a request from the sidebar or create a new one.</p>
            </div>
          )}
        </div>
      </Resizable>
      <div className="flex-grow flex flex-col overflow-y-auto h-full rounded-lg bg-card border border-border shadow-popover" style={{ viewTransitionName: 'response-panel' }}>
        <ResponsePanel 
          currentLog={activeLogForResponsePanel} 
          isLoading={isLoading} 
          responseHistory={responseHistoryForActiveRequest}
          onGenerateTests={handleGenerateTestsAndSwitchTab}
          isGeneratingTests={isGeneratingTests}
        />
      </div>
    </div>
  );
};
