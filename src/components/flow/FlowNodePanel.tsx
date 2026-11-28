import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, ExternalLink, Link2, PanelRightClose, Plus, Trash2, TriangleAlert, Unlink, Copy, Check } from 'lucide-react';
import { ApiRequest, FlowNode, HttpMethod, KeyValueItem, VariableExtraction } from '../../types';
import { RequestComposer } from '../request/RequestComposer';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { EmptyState } from '../ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { getMethodClass, getStatusTone } from '../../utils/http-ui';
import { useUrlSync } from '../../hooks/useUrlSync';
import { StepRun, parseBody } from './flowRunner';
import { StepView } from './FlowBuilder';
import { formatBytes, formatMs, sectionLabel, stepStatusLabel } from './flowUi';

export type InspectorTab = 'request' | 'extract' | 'result';

export interface AvailableVariable {
  name: string;
  stepIndex: number;
  value?: string;
}

interface FlowNodePanelProps {
  flowId: string;
  node: FlowNode;
  index: number;
  step: StepView;
  stepRun?: StepRun;
  availableVariables: AvailableVariable[];
  globals: KeyValueItem[];
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onNodeChange: (nodeId: string, updates: Partial<FlowNode>) => void;
  onRequestChange: (request: ApiRequest) => void;
  onDetach: () => void;
  onOpenInRequestTab: () => void;
  onRemove: () => void;
  onClose: () => void;
  /** 'back' for the full-screen mobile inspector. */
  closeStyle?: 'panel' | 'back';
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const CopyChip: React.FC<{ text: string; label?: React.ReactNode }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        });
      }}
      aria-label={`Copy ${text}`}
      className="inline-flex max-w-full items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-accent focus-ring"
    >
      <span className="truncate">{label ?? text}</span>
      {copied ? <Check className="h-3 w-3 flex-shrink-0 text-success-text" /> : <Copy className="h-3 w-3 flex-shrink-0 text-muted-foreground" />}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/* Request tab                                                         */
/* ------------------------------------------------------------------ */

const StepRequestEditor: React.FC<{
  request: ApiRequest;
  onChange: (request: ApiRequest) => void;
  globals: KeyValueItem[];
  dataVariables: Record<string, string>;
}> = ({ request, onChange, globals, dataVariables }) => {
  const requestRef = React.useRef(request);
  requestRef.current = request;
  const update = useCallback((updates: Partial<ApiRequest>) => onChange({ ...requestRef.current, ...updates }), [onChange]);
  useUrlSync(request, update);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 p-3">
        <Select value={request.method} onValueChange={(v) => update({ method: v as HttpMethod })}>
          <SelectTrigger aria-label="HTTP method" className={`w-[92px] flex-shrink-0 font-mono text-xs font-semibold ${getMethodClass(request.method)}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                <span className={`font-mono text-xs font-semibold ${getMethodClass(m)}`}>{m}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Request URL"
          value={request.url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="https://api.example.com/users/{{userId}}"
          className="font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <div className="min-h-[420px] flex-1 border-t border-border">
        <RequestComposer
          request={request}
          onRequestChange={onChange}
          onBodyValidationChange={() => {}}
          onGenerateBulkData={() => {}}
          onSave={() => {}}
          globals={globals}
          data={Object.keys(dataVariables).length ? [dataVariables] : undefined}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Extract tab                                                         */
/* ------------------------------------------------------------------ */

const ExtractEditor: React.FC<{
  node: FlowNode;
  index: number;
  stepRun?: StepRun;
  availableVariables: AvailableVariable[];
  onChange: (extractions: VariableExtraction[]) => void;
}> = ({ node, index, stepRun, availableVariables, onChange }) => {
  const update = (id: string, patch: Partial<VariableExtraction>) =>
    onChange(node.extractions.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const add = () => onChange([...node.extractions, { id: uuidv4(), name: '', source: 'BODY_JSON', path: '' }]);
  const remove = (id: string) => onChange(node.extractions.filter((e) => e.id !== id));
  const names = node.extractions.map((e) => e.name.trim()).filter(Boolean);
  const duplicates = new Set(names.filter((n, i) => names.indexOf(n) !== i));

  return (
    <div className="space-y-5 p-3">
      <section>
        <h4 className={sectionLabel}>Extract from this response</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Save values from step {index + 1}'s response as variables. Later steps use them as{' '}
          <code className="font-mono text-foreground">{'{{name}}'}</code>.
        </p>
        <div className="mt-3 space-y-2">
          {node.extractions.map((ex) => {
            const value = stepRun?.extracted[ex.name.trim()];
            const ranWithout = stepRun?.response && ex.name.trim() && value === undefined;
            return (
              <div key={ex.id} className="rounded-md border border-border bg-background p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    size="sm"
                    aria-label="Variable name"
                    value={ex.name}
                    onChange={(e) => update(ex.id, { name: e.target.value.replace(/[\s{}]/g, '') })}
                    placeholder="userId"
                    invalid={duplicates.has(ex.name.trim())}
                    className="!w-[7.5rem] font-mono"
                    spellCheck={false}
                  />
                  <Select value={ex.source} onValueChange={(v) => update(ex.id, { source: v as VariableExtraction['source'] })}>
                    <SelectTrigger aria-label="Extract from" className="!h-7 w-[92px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BODY_JSON">Body</SelectItem>
                      <SelectItem value="HEADER">Header</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="min-w-[8rem] flex-1">
                    <Input
                      size="sm"
                      aria-label={ex.source === 'HEADER' ? 'Header name' : 'JSON path'}
                      value={ex.path}
                      onChange={(e) => update(ex.id, { path: e.target.value })}
                      placeholder={ex.source === 'HEADER' ? 'etag' : 'data.items[0].id'}
                      className="font-mono"
                      spellCheck={false}
                    />
                  </div>
                  <IconButton size="sm" aria-label={`Remove ${ex.name || 'variable'}`} onClick={() => remove(ex.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
                {(value !== undefined || ranWithout || duplicates.has(ex.name.trim())) && (
                  <p className="mt-1.5 truncate px-0.5 font-mono text-[11px]">
                    {duplicates.has(ex.name.trim()) ? (
                      <span className="text-destructive-text">Another variable has this name; the later one wins.</span>
                    ) : value !== undefined ? (
                      <span className="text-muted-foreground">
                        Last run: <span className="text-foreground">{value}</span>
                      </span>
                    ) : (
                      <span className="text-warning-text">Last run found nothing here</span>
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Button size="sm" variant="secondary" className="mt-2" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Add variable
        </Button>
      </section>

      <section>
        <h4 className={sectionLabel}>Available in this step</h4>
        {availableVariables.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {index === 0 ? 'This is the first step, so there is nothing to reference yet.' : 'Earlier steps do not extract any variables yet.'}
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {availableVariables.map((v) => (
              <li key={`${v.stepIndex}-${v.name}`} className="flex min-w-0 items-center gap-2 text-xs">
                <CopyChip text={`{{${v.name}}}`} />
                <span className="flex-shrink-0 text-muted-foreground">from step {v.stepIndex + 1}</span>
                {v.value !== undefined && <span className="truncate font-mono text-muted-foreground">= {v.value}</span>}
              </li>
            ))}
          </ul>
        )}
        {index > 0 && (
          <div className="mt-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <p>Or reference any earlier response directly:</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <CopyChip text={`{{steps.${index}.body.id}}`} />
              <CopyChip text={`{{steps.${index}.headers.content-type}}`} />
              <CopyChip text={`{{steps.${index}.status}}`} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Result tab                                                          */
/* ------------------------------------------------------------------ */

const prettyBody = (body: unknown): string => {
  const parsed = parseBody(body);
  if (typeof parsed === 'string') return parsed;
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(parsed);
  }
};

const HeaderTable: React.FC<{ rows: [string, string][] }> = ({ rows }) =>
  rows.length === 0 ? (
    <p className="px-2 py-1.5 text-xs text-muted-foreground">No headers</p>
  ) : (
    <table className="w-full table-fixed text-xs">
      <tbody>
        {rows.map(([k, v], i) => (
          <tr key={`${k}-${i}`} className="border-t border-border first:border-t-0">
            <td className="w-[38%] truncate px-2 py-1 align-top font-mono text-muted-foreground" title={k}>
              {k}
            </td>
            <td className="break-all px-2 py-1 font-mono text-foreground">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

const Disclosure: React.FC<{ title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen }) => (
  <details open={defaultOpen} className="group rounded-md border border-border bg-background">
    <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 px-2 text-xs font-medium text-foreground focus-ring [&::-webkit-details-marker]:hidden">
      <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
      {title}
    </summary>
    <div className="border-t border-border">{children}</div>
  </details>
);

const StepResult: React.FC<{ stepRun?: StepRun; index: number }> = ({ stepRun, index }) => {
  if (!stepRun || stepRun.status === 'pending') {
    return (
      <EmptyState
        compact
        title="Not run yet"
        message={stepRun ? 'Waiting for earlier steps to finish.' : "Run the flow to see this step's final request and response."}
      />
    );
  }
  if (stepRun.status === 'running') {
    return <EmptyState compact title="Running…" message="Waiting for the response." />;
  }
  if (stepRun.status === 'skipped' || stepRun.status === 'cancelled') {
    return (
      <EmptyState
        compact
        title={stepStatusLabel(stepRun.status)}
        message={stepRun.status === 'skipped' ? 'The run stopped before reaching this step.' : 'The run was stopped while this step was in flight.'}
      />
    );
  }
  const { request, response } = stepRun;
  const tests = response?.testResults ?? [];
  const extracted = Object.entries(stepRun.extracted);
  return (
    <div className="space-y-4 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={stepRun.status === 'passed' ? 'success' : 'error'} dot>
          Step {index + 1} {stepStatusLabel(stepRun.status).toLowerCase()}
        </Badge>
        {response && (
          <>
            <Badge tone={getStatusTone(response.status)}>
              {response.status || 'ERR'} {response.statusText}
            </Badge>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatMs(response.duration)}</span>
            {response.size && <span className="font-mono text-xs tabular-nums text-muted-foreground">{formatBytes(response.size.total)}</span>}
          </>
        )}
      </div>
      {stepRun.error && <p className="rounded-md bg-destructive-bg px-2.5 py-2 text-xs text-destructive-text">{stepRun.error}</p>}
      {stepRun.warnings.length > 0 && (
        <ul className="space-y-1 rounded-md bg-warning-bg px-2.5 py-2 text-xs text-warning-text">
          {stepRun.warnings.map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <TriangleAlert className="mt-px h-3.5 w-3.5 flex-shrink-0" />
              <span className="break-words">{w}</span>
            </li>
          ))}
        </ul>
      )}

      {extracted.length > 0 && (
        <section>
          <h4 className={sectionLabel}>Extracted</h4>
          <div className="mt-1.5 overflow-hidden rounded-md border border-border bg-background">
            <HeaderTable rows={extracted} />
          </div>
        </section>
      )}

      {tests.length > 0 && (
        <section>
          <h4 className={sectionLabel}>
            Tests · {tests.filter((t) => t.passed).length}/{tests.length} passed
          </h4>
          <ul className="mt-1.5 space-y-1">
            {tests.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Badge tone={t.passed ? 'success' : 'error'}>{t.passed ? 'PASS' : 'FAIL'}</Badge>
                <span className="min-w-0 break-words text-foreground">
                  {t.name}
                  {t.error && <span className="block text-muted-foreground">{t.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {request && (
        <section className="space-y-1.5">
          <h4 className={sectionLabel}>Request sent</h4>
          <p className="break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
            <span className={`mr-2 font-semibold ${getMethodClass(request.method)}`}>{request.method}</span>
            <span className="text-foreground">{request.url}</span>
          </p>
          <Disclosure title={`Headers (${request.headers.filter((h) => h.enabled && h.key).length})`}>
            <HeaderTable rows={request.headers.filter((h) => h.enabled && h.key).map((h) => [h.key, h.value])} />
          </Disclosure>
          {typeof request.body === 'string' && request.body && (
            <Disclosure title="Body">
              <pre className="max-h-60 overflow-auto p-2 font-mono text-xs text-foreground">{prettyBody(request.body)}</pre>
            </Disclosure>
          )}
          {request.body instanceof FormData && <p className="text-xs text-muted-foreground">Body: multipart form data</p>}
        </section>
      )}

      {response && (
        <section className="space-y-1.5">
          <h4 className={sectionLabel}>Response</h4>
          <Disclosure title={`Headers (${Object.keys(response.headers).length})`}>
            <HeaderTable rows={Object.entries(response.headers)} />
          </Disclosure>
          <div className="rounded-md border border-border bg-background">
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words p-2 font-mono text-xs text-foreground">
              {prettyBody(response.body) || <span className="text-muted-foreground">Empty body</span>}
            </pre>
          </div>
        </section>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export const FlowNodePanel: React.FC<FlowNodePanelProps> = ({
  node,
  index,
  step,
  stepRun,
  availableVariables,
  globals,
  tab,
  onTabChange,
  onNodeChange,
  onRequestChange,
  onDetach,
  onOpenInRequestTab,
  onRemove,
  onClose,
  closeStyle = 'panel',
}) => {
  const [name, setName] = useState(step.name);
  useEffect(() => {
    setName(step.name);
  }, [step.name]);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) setName(step.name);
    else if (trimmed !== step.name) onNodeChange(node.id, { name: trimmed });
  };

  const dataVariables = Object.fromEntries(availableVariables.map((v) => [v.name, v.value ?? '']));
  const extractCount = node.extractions.filter((e) => e.name.trim()).length;
  const resultBadge =
    stepRun && stepRun.status !== 'pending' ? (
      <span
        aria-label={stepStatusLabel(stepRun.status)}
        className={`h-1.5 w-1.5 rounded-full ${
          stepRun.status === 'passed' ? 'bg-success' : stepRun.status === 'failed' ? 'bg-destructive' : stepRun.status === 'running' ? 'bg-primary' : 'bg-muted-foreground'
        }`}
      />
    ) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border px-2">
        {closeStyle === 'back' && (
          <IconButton size="sm" aria-label="Back to steps" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </IconButton>
        )}
        <span className="flex-shrink-0 pl-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Step {index + 1}</span>
        {step.linked ? (
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground" title={step.name}>
            {step.name}
          </span>
        ) : (
          <input
            aria-label="Step name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') {
                setName(step.name);
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-[13px] font-medium text-foreground hover:border-input focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/25"
          />
        )}
        {closeStyle === 'panel' && (
          <Tooltip content="Close inspector" side="left">
            <IconButton size="sm" aria-label="Close inspector" onClick={onClose}>
              <PanelRightClose className="h-4 w-4" />
            </IconButton>
          </Tooltip>
        )}
      </div>

      {!step.request ? (
        <EmptyState
          icon={<TriangleAlert />}
          title="Saved request was deleted"
          message={`This step pointed at "${node.name}", which no longer exists in your collections.`}
        >
          <Button variant="destructive" size="sm" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" /> Remove step
          </Button>
        </EmptyState>
      ) : (
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as InspectorTab)} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="flex-shrink-0 overflow-x-auto px-2">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="extract" badge={extractCount || undefined}>
              Variables
            </TabsTrigger>
            <TabsTrigger value="result" badge={resultBadge}>
              Result
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1 overflow-auto">
            <TabsContent value="request" className="flex min-h-full flex-col">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {step.linked ? (
                  <>
                    <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="min-w-0 flex-1">Linked to a saved request. Edits here update it everywhere.</span>
                    <span className="flex gap-1">
                      <Button size="xs" variant="ghost" onClick={onOpenInRequestTab}>
                        <ExternalLink /> Open
                      </Button>
                      <Button size="xs" variant="ghost" onClick={onDetach}>
                        <Unlink /> Unlink
                      </Button>
                    </span>
                  </>
                ) : (
                  <span>This request belongs to the flow only.</span>
                )}
              </div>
              <StepRequestEditor request={step.request} onChange={onRequestChange} globals={globals} dataVariables={dataVariables} />
            </TabsContent>
            <TabsContent value="extract">
              <ExtractEditor
                node={node}
                index={index}
                stepRun={stepRun}
                availableVariables={availableVariables}
                onChange={(extractions) => onNodeChange(node.id, { extractions })}
              />
            </TabsContent>
            <TabsContent value="result">
              <StepResult stepRun={stepRun} index={index} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
};
