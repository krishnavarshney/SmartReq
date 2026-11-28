import React, { useMemo, useCallback, useState } from 'react';
import { ApiRequest, SingleRequestLog } from '../../types';
import { RequestTabs } from './RequestTabs';
import { RequestPanel } from './RequestPanel';
import { RequestComposer } from './RequestComposer';
import { SplitPane } from './SplitPane';
import { ResponsePanel } from '../response/ResponsePanel';
import { useApp } from '../../context/AppContext';
import { useTabs } from '../../context/TabsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useLog } from '../../context/LogContext';
import { useToast } from '../../context/ToastContext';
import { buildFinalRequest } from '../../api';
import { Button, IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { Code2, Save, FilePlus } from '../icons';
import { CodeSnippetModal } from '../modals/CodeSnippetModal';
import { MOD_KEY } from '../Header';

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
  /** Optional: abort the in-flight request. When given, Send turns into Cancel while loading. */
  handleCancelRequest?: () => void;
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
  handleCancelRequest,
}) => {
  const { layout, isMobile } = useApp();
  const { activeTab, activeRequest, updateTab, isBodyInvalid } = useTabs();
  const { globals, findNode, activeEnvironmentId, environments } = useWorkspace();
  const { logs } = useLog();
  const { addToast } = useToast();
  const [isCodeOpen, setIsCodeOpen] = useState(false);

  const allVariables = useMemo(() => {
    const activeEnv = environments.find((e) => e.id === activeEnvironmentId);
    return [...globals, ...(activeEnv ? activeEnv.variables : [])];
  }, [globals, environments, activeEnvironmentId]);

  const activeLogForResponsePanel = useMemo<SingleRequestLog | null>(() => {
    if (!activeTab?.latestResponse || !activeRequest) return null;
    const log = logs.find((l) => l.mode === 'single' && l.response === activeTab.latestResponse) as SingleRequestLog | undefined;
    if (log) return log;
    return {
      id: 0,
      mode: 'single',
      request: buildFinalRequest(activeRequest, {}, allVariables, { runScripts: false }),
      originalRequest: activeRequest,
      response: activeTab.latestResponse,
      timestamp: new Date().toISOString(),
    };
  }, [activeTab, activeRequest, logs, allVariables]);

  const responseHistory = useMemo(() => {
    if (!activeTab?.originalRequestId) return activeLogForResponsePanel ? [activeLogForResponsePanel] : [];
    const node = findNode(activeTab.originalRequestId);
    return node?.type === 'request' ? node.responses || [] : [];
  }, [findNode, activeTab?.originalRequestId, activeLogForResponsePanel]);

  const handlePasteCurl = useCallback(
    async (command: string) => {
      try {
        const { parseCurl } = await import('../../utils/curl');
        const parsed = parseCurl(command);
        handleRequestUpdate(parsed);
        addToast('Imported cURL command', 'success');
        return true;
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'Could not parse that cURL command', 'error');
        return false;
      }
    },
    [handleRequestUpdate, addToast]
  );

  const onComposerChange = useCallback(
    (req: ApiRequest) => {
      if (activeTab) updateTab(activeTab.id, { request: req, isDirty: true });
    },
    [activeTab, updateTab]
  );
  const noop = useCallback(() => {}, []);

  const stacked = isMobile || layout === 'vertical';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <RequestTabs onNewTab={handleNewRequest} />
      {activeTab && activeRequest ? (
        <>
          <div className="flex-shrink-0 border-b border-border bg-card px-3 py-2">
            <RequestPanel
              method={activeRequest.method}
              onMethodChange={(method) => handleRequestUpdate({ method })}
              url={activeRequest.url}
              onUrlChange={(url) => handleRequestUpdate({ url })}
              onSend={handleSingleSend}
              onCancel={handleCancelRequest}
              isLoading={isLoading}
              isBodyInvalid={isBodyInvalid}
              globals={allVariables}
              onPasteCurl={handlePasteCurl}
              actions={
                <>
                  <Tooltip content="Save" shortcut={`${MOD_KEY} S`} side="bottom">
                    <Button variant="secondary" onClick={handleSaveRequest} className="h-9 px-2.5" aria-label="Save request">
                      <Save className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">Save</span>
                    </Button>
                  </Tooltip>
                  <Tooltip content="Generate code snippet" side="bottom">
                    <IconButton variant="ghost" className="!h-9 !w-9 hidden md:inline-flex" onClick={() => setIsCodeOpen(true)} disabled={!activeRequest.url.trim()} aria-label="Generate code snippet">
                      <Code2 className="h-4 w-4" />
                    </IconButton>
                  </Tooltip>
                </>
              }
            />
          </div>
          <SplitPane
            key={stacked ? 'v' : 'h'}
            direction={stacked ? 'vertical' : 'horizontal'}
            storageKey="singleRequestSplit_v1"
            minSize={stacked ? 160 : 300}
            aria-label="Resize request and response panes"
            first={
              <section aria-label="Request details" className="flex h-full min-h-0 flex-col bg-card">
                <RequestComposer
                  request={activeRequest}
                  onRequestChange={onComposerChange}
                  onBodyValidationChange={noop}
                  onGenerateBulkData={handleGenerateBulkData}
                  testResults={activeTab.latestResponse?.testResults}
                  globals={allVariables}
                  activeTab={composerActiveTab}
                  onTabChange={setComposerActiveTab}
                  showCodeAction={isMobile}
                />
              </section>
            }
            second={
              <section aria-label="Response" className="flex h-full min-h-0 flex-col bg-card">
                <ResponsePanel
                  currentLog={activeLogForResponsePanel}
                  isLoading={isLoading}
                  responseHistory={responseHistory}
                  onGenerateTests={onGenerateTests}
                  isGeneratingTests={isGeneratingTests}
                />
              </section>
            }
          />
          {isCodeOpen && <CodeSnippetModal request={activeRequest} globals={allVariables} onClose={() => setIsCodeOpen(false)} />}
        </>
      ) : (
        <EmptyState
          icon={<FilePlus />}
          title="No request open"
          message="Open a request from the sidebar, or start a new one."
          className="bg-card"
        >
          <Button onClick={handleNewRequest}>
            <FilePlus className="h-3.5 w-3.5" /> New request
          </Button>
        </EmptyState>
      )}
    </div>
  );
};
