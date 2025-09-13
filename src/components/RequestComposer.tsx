import React, { useState, useMemo, useEffect } from 'react';
import { ApiRequest, TestResult, KeyValueItem } from '../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/Tabs';
import { QueryParamsPanel } from './tabs/QueryParamsPanel';
import { HeadersPanel } from './tabs/HeadersPanel';
import { AuthorizationPanel } from './tabs/AuthorizationPanel';
import { BodyBuilder } from './BodyBuilder';
import { RequestSettingsPanel } from './tabs/RequestSettingsPanel';
import { ScriptEditorPanel } from './tabs/ScriptEditorPanel';
import { BodyBuilderPanel } from './tabs/BodyBuilderPanel';
import { Button } from './ui/Button';
import { Code2, Save } from './icons';
import { CodeSnippetModal } from './modals/CodeSnippetModal';
import { PathVariablesPanel } from './request/tabs/PathVariablesPanel';
import { Tooltip } from './ui/Tooltip';
import { useMediaQuery } from '../hooks/useMediaQuery';

interface RequestComposerProps {
  request: ApiRequest;
  onRequestChange: (request: ApiRequest) => void;
  onBodyValidationChange: (isInvalid: boolean) => void;
  onGenerateBulkData: (data: Record<string, any>[]) => void;
  onSave: () => void;
  testResults?: TestResult[];
  data?: Record<string, string>[];
  globals: KeyValueItem[];
  activeTab?: string | null;
  onTabChange?: (tab: string | null) => void;
}

export const RequestComposer: React.FC<RequestComposerProps> = ({ 
    request, 
    onRequestChange, 
    onBodyValidationChange, 
    onGenerateBulkData, 
    onSave, 
    testResults, 
    data, 
    globals,
    activeTab: activeTabProp,
    onTabChange
}) => {
  const isMobile = useMediaQuery('(max-width: 768px)');

  const pathVariables = useMemo(() => {
    const regex = /\{\{(\w+)\}\}/g;
    const urlPath = request.url.split('?')[0];
    const matches = urlPath.match(regex) || [];
    return [...new Set(matches.map(v => v.replace(/{{|}}/g, '')))]
  }, [request.url]);

  const defaultTab = pathVariables.length > 0 ? 'Path Variables' : 'Params';
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  useEffect(() => {
    setInternalActiveTab(defaultTab);
  }, [defaultTab]);
  
  const activeTab = activeTabProp !== undefined ? activeTabProp ?? internalActiveTab : internalActiveTab;
  const setActiveTab = onTabChange ?? setInternalActiveTab;
  
  useEffect(() => {
    if (activeTabProp) {
        setInternalActiveTab(activeTabProp);
        if (onTabChange) {
            onTabChange(null); // Reset the controlled prop
        }
    }
  }, [activeTabProp, onTabChange]);
  
  const TABS = ['Params', ...(pathVariables.length > 0 ? ['Path Variables'] : []), 'Authorization', 'Headers', 'Body', 'Body Builder', 'Pre-request Script', 'Tests', 'Settings'];

  const getTabBadge = (tab: string): string | number | React.ReactNode => {
      switch (tab) {
          case 'Params':
              return request.queryParams.filter(p => p.enabled && p.key).length;
          case 'Path Variables':
              return pathVariables.length;
          case 'Headers':
              return request.headers.filter(h => h.enabled && h.key).length;
          case 'Authorization':
              return request.auth.type !== 'none' ? request.auth.type : 0;
          case 'Body':
               return request.body.type !== 'none' ? request.body.type : 0;
          case 'Tests':
                if (!testResults) return 0;
                const passed = testResults.filter(r => r.passed).length;
                const total = testResults.length;
                if (total === 0) return 0;
                const allPassed = passed === total;
                return (
                    <span className={allPassed ? 'text-success-text' : 'text-destructive-text'}>
                        {passed}/{total}
                    </span>
                );
          default:
              return 0;
      }
  }

  const orientation = isMobile ? 'horizontal' : 'vertical';

  return (
    <div className={`flex ${isMobile ? 'flex-col' : 'h-full'}`}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className={`w-full ${isMobile ? 'flex flex-col' : 'h-full flex flex-row'}`} orientation={orientation as any}>
        <TabsList className={`${isMobile ? 'flex-row overflow-x-auto no-scrollbar p-2 gap-1' : 'flex-shrink-0 flex-col items-stretch p-2 md:p-3 space-y-1 w-40 md:w-52 overflow-y-auto border-r border-border bg-card'}`}>
          {TABS.map(tab => (
            <TabsTrigger key={tab} value={tab} badge={getTabBadge(tab)}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <div className="flex-grow flex flex-col overflow-hidden">
          <div className={`flex items-center justify-end gap-2 ${isMobile ? 'p-2' : 'p-2 md:p-3'} border-b border-border bg-card/80 sticky top-0 z-[1]`}>
            <Tooltip content="View generated code snippets for this request">
              <Button variant="secondary" size="sm" onClick={() => setIsCodeModalOpen(true)} aria-label="Open code snippets">
                <Code2 className="h-4 w-4 mr-2" /> Code
              </Button>
            </Tooltip>
            <Tooltip content="Save this request (Ctrl/Cmd+S)">
              <Button variant="secondary" size="sm" onClick={onSave} aria-label="Save request">
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
            </Tooltip>
          </div>
          
          <div className={`overflow-auto flex-grow ${isMobile ? 'p-2' : 'p-2 md:p-3'}`}>
            <TabsContent value="Params" className={activeTab === 'Params' ? 'opacity-100' : ''}>
              <QueryParamsPanel params={request.queryParams} onParamsChange={p => onRequestChange({ ...request, queryParams: p })} />
            </TabsContent>
            {pathVariables.length > 0 && (
                 <TabsContent value="Path Variables" className={activeTab === 'Path Variables' ? 'opacity-100' : ''}>
                    <PathVariablesPanel url={request.url} data={data?.[0]} globals={globals} />
                </TabsContent>
            )}
            <TabsContent value="Authorization" className={activeTab === 'Authorization' ? 'opacity-100' : ''}>
              <AuthorizationPanel auth={request.auth} onAuthChange={a => onRequestChange({ ...request, auth: a })} />
            </TabsContent>
            <TabsContent value="Headers" className={activeTab === 'Headers' ? 'opacity-100' : ''}>
              <HeadersPanel 
                headers={request.headers} 
                onHeadersChange={h => onRequestChange({ ...request, headers: h })}
                method={request.method}
                bodyType={request.body.type}
              />
            </TabsContent>
            <TabsContent value="Body" className={activeTab === 'Body' ? 'opacity-100' : ''} key="body-tab-content">
              <BodyBuilder body={request.body} onBodyChange={b => onRequestChange({ ...request, body: b })} onValidationChange={onBodyValidationChange} />
            </TabsContent>
            <TabsContent value="Body Builder" className={activeTab === 'Body Builder' ? 'opacity-100' : ''}>
              <BodyBuilderPanel 
                request={request}
                onRequestChange={onRequestChange}
                onGenerateBulkData={onGenerateBulkData}
              />
            </TabsContent>
            <TabsContent value="Pre-request Script" className={activeTab === 'Pre-request Script' ? 'opacity-100' : ''} key="pre-request-script-tab-content">
              <ScriptEditorPanel script={request.preRequestScript || ''} onScriptChange={s => onRequestChange({ ...request, preRequestScript: s })} type="pre-request" />
            </TabsContent>
            <TabsContent value="Tests" className={activeTab === 'Tests' ? 'opacity-100' : ''} key="tests-tab-content">
              <ScriptEditorPanel script={request.testScript || ''} onScriptChange={s => onRequestChange({ ...request, testScript: s })} type="test" />
            </TabsContent>
            <TabsContent value="Settings" className={activeTab === 'Settings' ? 'opacity-100' : ''}>
              <RequestSettingsPanel settings={request.settings} onSettingsChange={s => onRequestChange({ ...request, settings: s })} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
      {isCodeModalOpen && (
        <CodeSnippetModal 
            request={request} 
            onClose={() => setIsCodeModalOpen(false)} 
            globals={globals}
        />
      )}
    </div>
  );
};