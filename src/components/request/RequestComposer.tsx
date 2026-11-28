import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ApiRequest, TestResult, KeyValueItem } from '../../types';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { QueryParamsPanel } from './tabs/QueryParamsPanel';
import { HeadersPanel } from './tabs/HeadersPanel';
import { AuthorizationPanel } from './tabs/AuthorizationPanel';
import { BodyBuilder } from './BodyBuilder';
import { RequestSettingsPanel } from './tabs/RequestSettingsPanel';
import { ScriptEditorPanel } from './tabs/ScriptEditorPanel';
import { BodyBuilderPanel } from './tabs/BodyBuilderPanel';
import { IconButton } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { Code2 } from '../icons';
import { CodeSnippetModal } from '../modals/CodeSnippetModal';
import { PathVariablesPanel } from './tabs/PathVariablesPanel';
import { extractPathVariableNames, extractVariableNames } from '../../utils/http-data';
import { getBodyError } from '../../context/TabsContext';
import { buildFinalRequest } from '../../api';

interface RequestComposerProps {
  request: ApiRequest;
  onRequestChange: (request: ApiRequest) => void;
  onBodyValidationChange: (isInvalid: boolean) => void;
  onGenerateBulkData: (data: Record<string, any>[]) => void;
  /** @deprecated Saving lives in the request bar now; kept for compatibility. */
  onSave?: () => void;
  testResults?: TestResult[];
  /** Bulk data rows; the first row resolves `{{variables}}` in previews. */
  data?: Record<string, string>[];
  globals: KeyValueItem[];
  /** Externally requested tab (e.g. "Tests" after generating tests). Reset via onTabChange(null). */
  activeTab?: string | null;
  onTabChange?: (tab: string | null) => void;
  /** Show the "Code" snippet button at the end of the tab strip (default true). */
  showCodeAction?: boolean;
}

/** Tab values are stable identifiers (other code selects them by name); labels are what's shown. */
const TAB_LABELS: Record<string, string> = {
  Params: 'Params',
  'Path Variables': 'Path',
  Authorization: 'Auth',
  Headers: 'Headers',
  Body: 'Body',
  'Body Builder': 'Body Builder',
  'Pre-request Script': 'Scripts',
  Tests: 'Tests',
  Settings: 'Settings',
};

const Dot: React.FC<{ tone?: 'primary' | 'destructive' }> = ({ tone = 'primary' }) => (
  <span aria-hidden="true" className={`block h-1.5 w-1.5 rounded-full ${tone === 'destructive' ? 'bg-destructive' : 'bg-primary'}`} />
);

export const RequestComposer: React.FC<RequestComposerProps> = ({
  request,
  onRequestChange,
  onBodyValidationChange,
  onGenerateBulkData,
  testResults,
  data,
  globals,
  activeTab: requestedTab,
  onTabChange,
  showCodeAction = true,
}) => {
  const [activeTab, setActiveTab] = useState('Params');
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);

  const hasPathTab = useMemo(
    () => extractPathVariableNames(request.url).length > 0 || extractVariableNames(request.url.split('?')[0]).length > 0,
    [request.url]
  );

  const tabs = useMemo(
    () => ['Params', ...(hasPathTab ? ['Path Variables'] : []), 'Authorization', 'Headers', 'Body', 'Body Builder', 'Pre-request Script', 'Tests', 'Settings'],
    [hasPathTab]
  );

  // Honour an externally requested tab once, then hand control back.
  useEffect(() => {
    if (!requestedTab) return;
    if (TAB_LABELS[requestedTab]) setActiveTab(requestedTab);
    onTabChange?.(null);
  }, [requestedTab, onTabChange]);

  const current = tabs.includes(activeTab) ? activeTab : 'Params';

  const bodyError = getBodyError(request.body);
  useEffect(() => {
    onBodyValidationChange(bodyError !== null);
  }, [bodyError, onBodyValidationChange]);

  const variables = useMemo(() => {
    if (!data?.[0]) return globals;
    return [...globals, ...Object.entries(data[0]).map(([key, value], i) => ({ id: -100 - i, key, value: String(value), enabled: true }))];
  }, [globals, data]);

  const autoHeaders = useMemo(() => {
    try {
      return buildFinalRequest(request, data?.[0] ?? {}, globals, { runScripts: false }).headers.filter((h) => h.id < 0);
    } catch {
      return [];
    }
  }, [request, data, globals]);

  const update = useCallback((patch: Partial<ApiRequest>) => onRequestChange({ ...request, ...patch }), [onRequestChange, request]);
  const noop = useCallback(() => {}, []);

  const badge = (tab: string): React.ReactNode => {
    switch (tab) {
      case 'Params':
        return request.queryParams.filter((p) => p.enabled && p.key).length;
      case 'Path Variables':
        return (request.pathVariables?.length ?? 0) + extractVariableNames(request.url.split('?')[0]).length;
      case 'Headers':
        return request.headers.filter((h) => h.enabled && h.key).length;
      case 'Authorization':
        return request.auth.type !== 'none' ? <Dot /> : undefined;
      case 'Body':
        if (bodyError) return <Dot tone="destructive" />;
        return request.body.type !== 'none' ? <Dot /> : undefined;
      case 'Pre-request Script':
        return request.preRequestScript?.trim() ? <Dot /> : undefined;
      case 'Tests': {
        if (testResults && testResults.length > 0) {
          const passed = testResults.filter((r) => r.passed).length;
          return <span className={`tabular-nums ${passed === testResults.length ? 'text-success-text' : 'text-destructive-text'}`}>{passed}/{testResults.length}</span>;
        }
        return request.testScript?.trim() ? <Dot /> : undefined;
      }
      default:
        return undefined;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs value={current} onValueChange={setActiveTab} className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 flex-shrink-0 items-end gap-1 border-b border-border pl-1 pr-2">
          <TabsList className="no-scrollbar h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden !border-b-0" aria-label="Request settings">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} badge={badge(tab)} title={tab === 'Pre-request Script' ? 'Pre-request script' : undefined}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>
          {showCodeAction && (
            <div className="flex h-full items-center">
              <Tooltip content="Generate code snippet">
                <IconButton size="sm" onClick={() => setIsCodeModalOpen(true)} disabled={!request.url.trim()} aria-label="Generate code snippet">
                  <Code2 className="h-4 w-4" />
                </IconButton>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <TabsContent value="Params">
            <QueryParamsPanel params={request.queryParams} onParamsChange={(queryParams) => update({ queryParams })} variables={variables} />
          </TabsContent>
          {hasPathTab && (
            <TabsContent value="Path Variables">
              <PathVariablesPanel
                url={request.url}
                data={data?.[0]}
                globals={globals}
                pathVariables={request.pathVariables}
                onPathVariablesChange={(pathVariables) => update({ pathVariables })}
              />
            </TabsContent>
          )}
          <TabsContent value="Authorization">
            <AuthorizationPanel auth={request.auth} onAuthChange={(auth) => update({ auth })} variables={variables} />
          </TabsContent>
          <TabsContent value="Headers">
            <HeadersPanel
              headers={request.headers}
              onHeadersChange={(headers) => update({ headers })}
              method={request.method}
              bodyType={request.body.type}
              autoHeaders={autoHeaders}
              variables={variables}
            />
          </TabsContent>
          <TabsContent value="Body">
            <BodyBuilder body={request.body} onBodyChange={(body) => update({ body })} onValidationChange={noop} method={request.method} variables={variables} />
          </TabsContent>
          <TabsContent value="Body Builder">
            <BodyBuilderPanel request={request} onRequestChange={onRequestChange} onGenerateBulkData={onGenerateBulkData} />
          </TabsContent>
          <TabsContent value="Pre-request Script">
            <ScriptEditorPanel script={request.preRequestScript || ''} onScriptChange={(preRequestScript) => update({ preRequestScript })} type="pre-request" />
          </TabsContent>
          <TabsContent value="Tests">
            <ScriptEditorPanel script={request.testScript || ''} onScriptChange={(testScript) => update({ testScript })} type="test" testResults={testResults} />
          </TabsContent>
          <TabsContent value="Settings">
            <RequestSettingsPanel settings={request.settings} onSettingsChange={(settings) => update({ settings })} />
          </TabsContent>
        </div>
      </Tabs>
      {isCodeModalOpen && <CodeSnippetModal request={request} onClose={() => setIsCodeModalOpen(false)} globals={variables} />}
    </div>
  );
};
