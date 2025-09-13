import React, { useState, useMemo, useEffect } from 'react';
import { ApiRequest, TestResult, KeyValueItem } from '../../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { QueryParamsPanel } from './tabs/QueryParamsPanel';
import { HeadersPanel } from './tabs/HeadersPanel';
import { AuthorizationPanel } from './tabs/AuthorizationPanel';
import { BodyBuilder } from './BodyBuilder';
import { RequestSettingsPanel } from './tabs/RequestSettingsPanel';
import { ScriptEditorPanel } from './tabs/ScriptEditorPanel';
import { BodyBuilderPanel } from './tabs/BodyBuilderPanel';
import { Button } from '../ui/Button';
import { Code2, Save } from '../icons';
import { CodeSnippetModal } from '../modals/CodeSnippetModal';
import { PathVariablesPanel } from './tabs/PathVariablesPanel';

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
  const pathVariables = useMemo(() => {
    const regex = /\{\{(\w+)\}\}/g;
    const urlPath = request.url.split('?')[0];
    const matches = urlPath.match(regex) || [];
    return [...new Set(matches.map(v => v.replace(/{{|}}/g, '')))];
  }, [request.url]);

  const defaultTab = pathVariables.length > 0 ? 'Path Variables' : 'Params';
  const [internalActiveTab, setInternalActiveTab] = useState(defaultTab);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isBodyInvalidLocal, setIsBodyInvalidLocal] = useState(false);

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
               if (isBodyInvalidLocal) {
                 return (
                   <span className="text-destructive-text">invalid</span>
                 );
               }
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

  const onBodyValidationChangeWrapped = (isInvalid: boolean) => {
    setIsBodyInvalidLocal(isInvalid);
    onBodyValidationChange(isInvalid);
  };

  const resolvedUrl = useMemo(() => {
    try {
      const hasProtocol = /^https?:\/\//i.test(request.url);
      const url = new URL(hasProtocol ? request.url : `http://placeholder${request.url.startsWith('/') ? '' : '/'}${request.url}`);
      const base = hasProtocol ? `${url.protocol}//${url.host}${url.pathname}` : url.pathname;
      const params = new URLSearchParams(url.search);
      request.queryParams.filter(p => p.enabled && p.key).forEach(p => params.set(p.key, p.value));
      const qs = params.toString();
      return { text: `${base}${qs ? `?${qs}` : ''}`, valid: true };
    } catch {
      return { text: request.url || '', valid: false };
    }
  }, [request.url, request.queryParams]);

  const isCodeButtonDisabled = useMemo(() => {
    // Check if URL is empty
    if (!request.url || request.url.trim() === '') {
      return true;
    }

    // Check if body is empty based on its type
    switch (request.body.type) {
      case 'none':
        return true;
      case 'json':
        return !request.body.jsonBody || request.body.jsonBody.trim() === '';
      case 'form-data':
        return !request.body.formData || request.body.formData.length === 0 || request.body.formData.every(item => !item.key && !item.value);
      case 'x-www-form-urlencoded':
        return !request.body.urlEncoded || request.body.urlEncoded.length === 0 || request.body.urlEncoded.every(item => !item.key && !item.value);
      default:
        return false; // Should not happen if all types are covered
    }
  }, [request.url, request.body]);

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col md:flex-row" orientation="vertical">
        <TabsList className="flex-shrink-0 md:flex-col md:items-start p-2 md:p-4 md:space-y-1 md:w-48 md:border-r border-border flex-nowrap overflow-x-auto w-full gap-1 md:gap-0">
          {TABS.map(tab => (
            <TabsTrigger key={tab} value={tab} badge={getTabBadge(tab)}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <div className="flex-grow flex flex-col overflow-auto h-full">
          <div className="flex items-center justify-between gap-3 p-3 md:p-4 border-b border-border flex-shrink-0">
            <div className={`hidden sm:flex items-center px-2 py-1.5 rounded-md text-xs border ${resolvedUrl.valid ? 'border-border text-muted-foreground bg-background/60' : 'border-destructive text-destructive-foreground bg-destructive/10'}`} title={resolvedUrl.valid ? 'Resolved URL preview' : 'Invalid URL'}>
              <span className="truncate max-w-[520px]">{resolvedUrl.text || 'Enter a valid URL'}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setIsCodeModalOpen(true)} disabled={isCodeButtonDisabled}>
                <Code2 className="h-4 w-4 mr-2" /> Code
            </Button>
            <Button variant="secondary" size="sm" onClick={onSave}>
                <Save className="h-4 w-4 mr-2" /> Save
            </Button>
          </div>
          
          <div className="overflow-auto flex-grow p-3 md:p-4">
            <TabsContent value="Params" className="h-full">
              <QueryParamsPanel params={request.queryParams} onParamsChange={p => onRequestChange({ ...request, queryParams: p })} />
            </TabsContent>
            {pathVariables.length > 0 && (
                 <TabsContent value="Path Variables" className="h-full">
                    <PathVariablesPanel url={request.url} data={data?.[0]} globals={globals} />
                </TabsContent>
            )}
            <TabsContent value="Authorization" className="h-full">
              <AuthorizationPanel auth={request.auth} onAuthChange={a => onRequestChange({ ...request, auth: a })} />
            </TabsContent>
            <TabsContent value="Headers" className="h-full">
              <HeadersPanel 
                headers={request.headers} 
                onHeadersChange={h => onRequestChange({ ...request, headers: h })}
                method={request.method}
                bodyType={request.body.type}
              />
            </TabsContent>
            <TabsContent value="Body" className="h-full">
              <BodyBuilder body={request.body} onBodyChange={b => onRequestChange({ ...request, body: b })} onValidationChange={onBodyValidationChangeWrapped} />
            </TabsContent>
            <TabsContent value="Body Builder" className="h-full">
              <BodyBuilderPanel 
                request={request}
                onRequestChange={onRequestChange}
                onGenerateBulkData={onGenerateBulkData}
              />
            </TabsContent>
            <TabsContent value="Pre-request Script" className="h-full">
              <ScriptEditorPanel script={request.preRequestScript || ''} onScriptChange={s => onRequestChange({ ...request, preRequestScript: s })} type="pre-request" />
            </TabsContent>
            <TabsContent value="Tests" className="h-full">
              <ScriptEditorPanel script={request.testScript || ''} onScriptChange={s => onRequestChange({ ...request, testScript: s })} type="test" />
            </TabsContent>
            <TabsContent value="Settings" className="h-full">
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