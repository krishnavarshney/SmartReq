import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Resizable } from 're-resizable';
import { usePersistentState } from '../../hooks/usePersistentState';
import {
  CopyPlus,
  Ellipsis,
  Eraser,
  ListOrdered,
  PanelRightOpen,
  Pencil,
  Play,
  Plus,
  Square,
  Trash2,
  Workflow,
  Variable,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useTabs } from '../../context/TabsContext';
import { useApp } from '../../context/AppContext';
import { ApiRequest, Flow, FlowNode, RequestItem } from '../../types';
import { createDefaultRequest } from '../../utils/collection';
import { Button, IconButton } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmDialog } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { Tooltip } from '../ui/Tooltip';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { SelectRequestModal } from '../modals/SelectRequestModal';
import { FlowBuilder, StepView } from './FlowBuilder';
import { AvailableVariable, FlowNodePanel, InspectorTab } from './FlowNodePanel';
import { SequenceDiagram } from './SequenceDiagram';
import { useFlowRunner } from './useFlowRunner';
import { FlowRun } from './flowRunner';
import { formatMs, summarizeRun } from './flowUi';

const useMatchMedia = (query: string) => {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
};

const uniqueName = (base: string, taken: string[]) => {
  if (!taken.includes(base)) return base;
  let i = 2;
  while (taken.includes(`${base} ${i}`)) i++;
  return `${base} ${i}`;
};

const cloneNode = (node: FlowNode): FlowNode => ({
  ...node,
  id: uuidv4(),
  extractions: node.extractions.map((e) => ({ ...e, id: uuidv4() })),
  request: node.request ? structuredClone(node.request) : undefined,
});

/* ------------------------------------------------------------------ */
/* Flow list                                                           */
/* ------------------------------------------------------------------ */

const RunDot: React.FC<{ run?: FlowRun }> = ({ run }) => {
  if (!run) return null;
  const cls = run.status === 'running' ? 'bg-primary animate-pulse' : run.status === 'passed' ? 'bg-success' : run.status === 'failed' ? 'bg-destructive' : 'bg-muted-foreground';
  const label = run.status === 'running' ? 'Running' : run.status === 'passed' ? 'Last run passed' : run.status === 'failed' ? 'Last run failed' : 'Last run stopped';
  return <span role="img" aria-label={label} title={label} className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${cls}`} />;
};

interface FlowActionsProps {
  flow: Flow;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClearResults?: () => void;
  triggerClassName?: string;
}

const FlowActions: React.FC<FlowActionsProps> = ({ flow, onRename, onDuplicate, onDelete, onClearResults, triggerClassName = '' }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <IconButton size="sm" aria-label={`Actions for ${flow.name}`} className={triggerClassName}>
        <Ellipsis className="h-4 w-4" />
      </IconButton>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={onRename}>
        <Pencil /> Rename
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onDuplicate}>
        <CopyPlus /> Duplicate
      </DropdownMenuItem>
      {onClearResults && (
        <DropdownMenuItem onClick={onClearResults}>
          <Eraser /> Clear results
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem destructive onClick={onDelete}>
        <Trash2 /> Delete flow
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const RenameInput: React.FC<{ initial: string; onCommit: (name: string) => void; onCancel: () => void; className?: string }> = ({
  initial,
  onCommit,
  onCancel,
  className = '',
}) => {
  const [value, setValue] = useState(initial);
  return (
    <input
      autoFocus
      aria-label="Flow name"
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => (value.trim() ? onCommit(value.trim()) : onCancel())}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      className={`h-7 min-w-0 rounded-md border border-ring bg-background px-1.5 text-[13px] text-foreground outline-none ring-2 ring-ring/25 ${className}`}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export const FlowWorkspace: React.FC = () => {
  const { flows, workspace, setWorkspace, handleUpdateFlow, findNode, updateNode, globals, activeEnvironmentId } = useWorkspace();
  const { openTab } = useTabs();
  const { setMode, isMobile } = useApp();
  const wide = useMatchMedia('(min-width: 1280px)');

  const [activeFlowId, setActiveFlowId] = useState<string | null>(flows[0]?.id ?? null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorWidth, setInspectorWidth] = usePersistentState('flowInspectorWidth_v1', 480);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('request');
  const [view, setView] = useState<'steps' | 'sequence'>('steps');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Flow | null>(null);

  const activeFlow = flows.find((f) => f.id === activeFlowId) ?? flows[0];

  useEffect(() => {
    if (activeFlow && activeFlow.id !== activeFlowId) setActiveFlowId(activeFlow.id);
  }, [activeFlow, activeFlowId]);

  const env = useMemo(() => {
    const activeEnv = workspace.environments.find((e) => e.id === activeEnvironmentId);
    return [...globals, ...(activeEnv ? activeEnv.variables : [])];
  }, [workspace.environments, activeEnvironmentId, globals]);

  const resolveSaved = useCallback(
    (node: FlowNode): RequestItem | null => {
      if (!node.requestId) return null;
      const found = findNode(node.requestId);
      return found && found.type === 'request' ? found : null;
    },
    [findNode]
  );

  const resolveRequest = useCallback(
    (node: FlowNode): ApiRequest | null => (node.requestId ? resolveSaved(node)?.request ?? null : node.request ?? null),
    [resolveSaved]
  );

  const { runs, run, stop, clear } = useFlowRunner(env, resolveRequest);

  const steps: StepView[] = useMemo(
    () =>
      (activeFlow?.nodes ?? []).map((node) => {
        const saved = resolveSaved(node);
        return { node, request: node.requestId ? saved?.request ?? null : node.request ?? null, name: saved?.name ?? node.name, linked: !!node.requestId };
      }),
    [activeFlow, resolveSaved]
  );

  const activeRun = activeFlow ? runs[activeFlow.id] : undefined;
  const isRunning = activeRun?.status === 'running';
  const summary = summarizeRun(activeRun);
  const selectedIndex = steps.findIndex((s) => s.node.id === selectedNodeId);
  const selectedStep = selectedIndex >= 0 ? steps[selectedIndex] : undefined;

  /* ---------------- flow mutations ---------------- */

  const mutateFlow = useCallback(
    (flowId: string, fn: (flow: Flow) => Flow) => {
      setWorkspace((ws) => ({ ...ws, flows: (ws.flows || []).map((f) => (f.id === flowId ? fn(f) : f)) }));
    },
    [setWorkspace]
  );

  const createFlow = () => {
    const flow: Flow = { id: uuidv4(), name: uniqueName('Untitled flow', flows.map((f) => f.name)), nodes: [], stopOnFailure: true };
    setWorkspace((ws) => ({ ...ws, flows: [...(ws.flows || []), flow] }));
    setActiveFlowId(flow.id);
    setSelectedNodeId(null);
    setRenamingId(flow.id);
  };

  const duplicateFlow = (flow: Flow) => {
    const copy: Flow = { ...flow, id: uuidv4(), name: uniqueName(`${flow.name} copy`, flows.map((f) => f.name)), nodes: flow.nodes.map(cloneNode) };
    setWorkspace((ws) => {
      const list = ws.flows || [];
      const idx = list.findIndex((f) => f.id === flow.id);
      return { ...ws, flows: [...list.slice(0, idx + 1), copy, ...list.slice(idx + 1)] };
    });
    setActiveFlowId(copy.id);
    setSelectedNodeId(null);
  };

  const deleteFlow = (flow: Flow) => {
    clear(flow.id);
    const idx = flows.findIndex((f) => f.id === flow.id);
    const next = flows[idx + 1] ?? flows[idx - 1];
    setWorkspace((ws) => ({ ...ws, flows: (ws.flows || []).filter((f) => f.id !== flow.id) }));
    setActiveFlowId(next?.id ?? null);
    setSelectedNodeId(null);
  };

  const renameFlow = (flowId: string, name: string) => {
    handleUpdateFlow(flowId, { name });
    setRenamingId(null);
  };

  const selectStep = (nodeId: string, tab?: InspectorTab) => {
    setSelectedNodeId(nodeId);
    setInspectorOpen(true);
    if (tab) setInspectorTab(tab);
  };

  const addSavedSteps = (items: { id: string; name: string }[]) => {
    if (!activeFlow) return;
    const nodes: FlowNode[] = items.map((i) => ({ id: uuidv4(), requestId: i.id, name: i.name, extractions: [] }));
    mutateFlow(activeFlow.id, (f) => ({ ...f, nodes: [...f.nodes, ...nodes] }));
    if (nodes.length) selectStep(nodes[0].id, 'request');
  };

  const addBlankStep = () => {
    if (!activeFlow) return;
    const node: FlowNode = { id: uuidv4(), requestId: '', name: `Step ${activeFlow.nodes.length + 1}`, extractions: [], request: createDefaultRequest() };
    mutateFlow(activeFlow.id, (f) => ({ ...f, nodes: [...f.nodes, node] }));
    selectStep(node.id, 'request');
  };

  const moveStep = (from: number, to: number) => {
    if (!activeFlow) return;
    mutateFlow(activeFlow.id, (f) => {
      if (to < 0 || to >= f.nodes.length) return f;
      const nodes = [...f.nodes];
      const [moved] = nodes.splice(from, 1);
      nodes.splice(to, 0, moved);
      return { ...f, nodes };
    });
  };

  const duplicateStep = (nodeId: string) => {
    if (!activeFlow) return;
    mutateFlow(activeFlow.id, (f) => {
      const idx = f.nodes.findIndex((n) => n.id === nodeId);
      if (idx < 0) return f;
      const nodes = [...f.nodes];
      nodes.splice(idx + 1, 0, cloneNode(f.nodes[idx]));
      return { ...f, nodes };
    });
  };

  const removeStep = (nodeId: string) => {
    if (!activeFlow) return;
    mutateFlow(activeFlow.id, (f) => ({ ...f, nodes: f.nodes.filter((n) => n.id !== nodeId) }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const changeNode = (nodeId: string, updates: Partial<FlowNode>) => {
    if (!activeFlow) return;
    mutateFlow(activeFlow.id, (f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)) }));
  };

  const changeStepRequest = (step: StepView, request: ApiRequest) => {
    if (step.linked) {
      updateNode(step.node.requestId, (n) => (n.type === 'request' ? { ...n, request } : n));
    } else {
      changeNode(step.node.id, { request });
    }
  };

  const detachStep = (step: StepView) => {
    if (!step.request) return;
    changeNode(step.node.id, { requestId: '', name: step.name, request: structuredClone(step.request) });
  };

  const openInRequestTab = (step: StepView) => {
    const saved = resolveSaved(step.node);
    if (!saved) return;
    openTab(saved, saved.name);
    setMode('single');
  };

  const runFlow = () => {
    if (!activeFlow || activeFlow.nodes.length === 0) return;
    void run(activeFlow);
  };

  // Keep the inspector focused on something useful after a failing run.
  useEffect(() => {
    if (!activeRun || activeRun.status !== 'failed') return;
    const failed = activeRun.steps.find((s) => s.status === 'failed');
    if (failed && !selectedNodeId) {
      setSelectedNodeId(failed.nodeId);
      setInspectorTab('result');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun?.status]);

  const availableVariables: AvailableVariable[] = useMemo(() => {
    if (selectedIndex < 0) return [];
    const out: AvailableVariable[] = [];
    steps.slice(0, selectedIndex).forEach((s, i) => {
      const stepRun = activeRun?.steps.find((r) => r.nodeId === s.node.id);
      s.node.extractions.forEach((e) => {
        const name = e.name.trim();
        if (!name) return;
        const existing = out.findIndex((v) => v.name === name);
        const entry = { name, stepIndex: i, value: stepRun?.extracted[name] };
        if (existing >= 0) out[existing] = entry;
        else out.push(entry);
      });
    });
    return out;
  }, [steps, selectedIndex, activeRun]);

  /* ---------------- render ---------------- */

  const flowList = (
    <aside aria-label="Flows" className="flex w-60 flex-shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border pl-3 pr-1.5">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Flows</h2>
        <Tooltip content="New flow" side="bottom">
          <IconButton size="sm" aria-label="New flow" onClick={createFlow}>
            <Plus className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {flows.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No flows yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {flows.map((flow) => {
              const active = flow.id === activeFlow?.id;
              return (
                <li key={flow.id} className="group relative">
                  {renamingId === flow.id ? (
                    <div className="flex h-8 items-center px-1">
                      <RenameInput initial={flow.name} onCommit={(n) => renameFlow(flow.id, n)} onCancel={() => setRenamingId(null)} className="w-full" />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFlowId(flow.id);
                          setSelectedNodeId(null);
                        }}
                        onDoubleClick={() => setRenamingId(flow.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`flex h-8 w-full items-center gap-2 rounded-md pl-2 pr-9 text-left text-[13px] focus-ring ${
                          active ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                        }`}
                      >
                        <Workflow className={`h-3.5 w-3.5 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
                        <span className="min-w-0 flex-1 truncate">{flow.name}</span>
                        <RunDot run={runs[flow.id]} />
                        <span className="text-[11px] tabular-nums text-muted-foreground group-hover:hidden group-focus-within:hidden">{flow.nodes.length}</span>
                      </button>
                      <div className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                        <FlowActions
                          flow={flow}
                          onRename={() => setRenamingId(flow.id)}
                          onDuplicate={() => duplicateFlow(flow)}
                          onDelete={() => setConfirmDelete(flow)}
                          triggerClassName="!h-7 !w-7"
                        />
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );

  const inspector =
    activeFlow && selectedStep ? (
      <FlowNodePanel
        key={selectedStep.node.id}
        flowId={activeFlow.id}
        node={selectedStep.node}
        index={selectedIndex}
        step={selectedStep}
        stepRun={activeRun?.steps.find((s) => s.nodeId === selectedStep.node.id)}
        availableVariables={availableVariables}
        globals={env}
        tab={inspectorTab}
        onTabChange={setInspectorTab}
        onNodeChange={changeNode}
        onRequestChange={(req) => changeStepRequest(selectedStep, req)}
        onDetach={() => detachStep(selectedStep)}
        onOpenInRequestTab={() => openInRequestTab(selectedStep)}
        onRemove={() => removeStep(selectedStep.node.id)}
        onClose={() => (wide ? setInspectorOpen(false) : setSelectedNodeId(null))}
        closeStyle={isMobile ? 'back' : 'panel'}
      />
    ) : null;

  let center: React.ReactNode;
  if (!activeFlow) {
    center = (
      <div className="flex h-full flex-col items-center justify-center overflow-auto py-8">
        <EmptyState
          className="!h-auto"
          icon={<Workflow />}
          title="Chain requests into a flow"
          message="A flow runs requests in order and passes data between them, like logging in and then using the token to fetch a profile."
        >
          <Button onClick={createFlow}>
            <Plus className="h-4 w-4" /> New flow
          </Button>
        </EmptyState>
        <ol className="grid w-full max-w-2xl gap-2 px-4 sm:grid-cols-3">
          {[
            { icon: <ListOrdered />, title: 'Add steps', text: 'Use requests saved in your collections, or blank ones.' },
            { icon: <Variable />, title: 'Pass values', text: 'Extract fields as {{variables}} or reference {{steps.1.body.id}}.' },
            { icon: <Play />, title: 'Run and inspect', text: "See each step's status, timing, request and response." },
          ].map((s, i) => (
            <li key={s.title} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                {s.title}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    );
  } else {
    center = (
      <div className="flex h-full min-h-0 flex-col">
        {/* Title row */}
        <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border bg-card px-2 sm:px-3">
          {isMobile && renamingId === activeFlow.id ? (
            <RenameInput initial={activeFlow.name} onCommit={(n) => renameFlow(activeFlow.id, n)} onCancel={() => setRenamingId(null)} className="w-full max-w-[220px]" />
          ) : isMobile ? (
            <>
              <div className="min-w-0 flex-1">
                <Select
                  value={activeFlow.id}
                  onValueChange={(id) => {
                    setActiveFlowId(id);
                    setSelectedNodeId(null);
                  }}
                >
                  <SelectTrigger aria-label="Choose flow" className="w-full max-w-[220px] border-transparent font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {flows.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <IconButton size="sm" aria-label="New flow" onClick={createFlow}>
                <Plus className="h-4 w-4" />
              </IconButton>
            </>
          ) : (
            <h2 className="min-w-0 truncate text-[13px] font-semibold text-foreground">
              <button type="button" onDoubleClick={() => setRenamingId(activeFlow.id)} className="max-w-full truncate rounded px-1 focus-ring" title="Double-click to rename">
                {activeFlow.name}
              </button>
            </h2>
          )}
          {!isMobile && (
            <span className="flex-shrink-0 text-xs text-muted-foreground">
              {activeFlow.nodes.length} {activeFlow.nodes.length === 1 ? 'step' : 'steps'}
            </span>
          )}
          <div className="ml-auto flex flex-shrink-0 items-center gap-1.5">
            <FlowActions
              flow={activeFlow}
              onRename={() => setRenamingId(activeFlow.id)}
              onDuplicate={() => duplicateFlow(activeFlow)}
              onDelete={() => setConfirmDelete(activeFlow)}
              onClearResults={activeRun && !isRunning ? () => clear(activeFlow.id) : undefined}
            />
            {wide && !inspectorOpen && selectedStep && (
              <Tooltip content="Open inspector" side="bottom">
                <IconButton size="sm" aria-label="Open inspector" onClick={() => setInspectorOpen(true)}>
                  <PanelRightOpen className="h-4 w-4" />
                </IconButton>
              </Tooltip>
            )}
            {isRunning ? (
              <Button size="sm" variant="secondary" onClick={() => stop(activeFlow.id)}>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={runFlow} disabled={activeFlow.nodes.length === 0}>
                <Play className="h-3.5 w-3.5" /> Run
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex min-h-10 flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-card px-2 py-1.5 sm:px-3">
          <SegmentedControl
            size="sm"
            aria-label="View"
            value={view}
            onChange={(v) => setView(v as 'steps' | 'sequence')}
            options={[
              { value: 'steps', label: 'Steps' },
              { value: 'sequence', label: 'Sequence' },
            ]}
          />
          <div className="min-w-0 flex-1 truncate text-xs" aria-live="polite">
            {summary && activeRun && (
              <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-muted-foreground">
                {isRunning ? (
                  <span className="text-foreground">
                    Running {Math.min(summary.done + 1, summary.count)}/{summary.count}
                  </span>
                ) : (
                  <span
                    className={`font-medium ${
                      activeRun.status === 'passed' ? 'text-success-text' : activeRun.status === 'failed' ? 'text-destructive-text' : 'text-foreground'
                    }`}
                  >
                    {activeRun.status === 'passed' ? 'Passed' : activeRun.status === 'failed' ? 'Failed' : 'Stopped'}
                  </span>
                )}
                <span className="tabular-nums" title={`${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`}>
                  {summary.passed}/{summary.count}<span className="hidden sm:inline"> passed</span>
                </span>
                {summary.total > 0 && <span className="font-mono tabular-nums">{formatMs(summary.total)}</span>}
              </span>
            )}
          </div>
          <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch
              size="sm"
              checked={activeFlow.stopOnFailure !== false}
              onCheckedChange={(checked) => handleUpdateFlow(activeFlow.id, { stopOnFailure: checked })}
              aria-label="Stop on first failure"
            />
            Stop on failure
          </label>
        </div>

        <div className="min-h-0 flex-1 bg-background">
          {view === 'steps' ? (
            <FlowBuilder
              flow={activeFlow}
              steps={steps}
              run={activeRun}
              selectedNodeId={selectedNodeId}
              onNodeSelect={(id) => selectStep(id)}
              onAddSaved={() => setIsPickerOpen(true)}
              onAddBlank={addBlankStep}
              onMove={moveStep}
              onDuplicate={duplicateStep}
              onRemove={removeStep}
            />
          ) : (
            <SequenceDiagram
              steps={steps}
              run={activeRun}
              selectedNodeId={selectedNodeId}
              onSelectStep={(id) => selectStep(id, 'result')}
              onRun={runFlow}
              canRun={activeFlow.nodes.length > 0 && !isRunning}
            />
          )}
        </div>
      </div>
    );
  }

  const showDockedInspector = wide && inspectorOpen && !!inspector;
  const showOverlayInspector = !wide && !!inspector;

  return (
    <div className="flex h-full min-h-0">
      {!isMobile && flowList}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {center}
        {showOverlayInspector && (
          <>
            {!isMobile && <div aria-hidden className="absolute inset-0 z-10 bg-black/20 animate-fade-in" onClick={() => setSelectedNodeId(null)} />}
            <div
              role="dialog"
              aria-label="Step inspector"
              className={`absolute inset-y-0 right-0 z-20 flex flex-col border-l border-border shadow-popover animate-fade-in ${isMobile ? 'left-0 border-l-0' : 'w-[min(460px,100%)]'}`}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !e.defaultPrevented) setSelectedNodeId(null);
              }}
            >
              {inspector}
            </div>
          </>
        )}
      </div>
      {showDockedInspector && (
        <Resizable
          as="aside"
          aria-label="Step inspector"
          size={{ width: inspectorWidth, height: '100%' }}
          onResizeStop={(_e, _dir, ref) => setInspectorWidth(ref.offsetWidth)}
          minWidth={380}
          maxWidth="60%"
          enable={{ left: true }}
          handleStyles={{ left: { width: 8, left: -4, zIndex: 20 } }}
          handleClasses={{ left: 'transition-colors hover:bg-primary/40 active:bg-primary/60' }}
          className="flex flex-shrink-0 flex-col border-l border-border"
        >
          {inspector}
        </Resizable>
      )}

      {isPickerOpen && <SelectRequestModal onClose={() => setIsPickerOpen(false)} onSelect={(i) => addSavedSteps([i])} onSelectMany={addSavedSteps} />}
      <ConfirmDialog
        show={!!confirmDelete}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        description="The flow and its steps will be removed. Saved requests it uses are not affected."
        confirmLabel="Delete flow"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) deleteFlow(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
};

