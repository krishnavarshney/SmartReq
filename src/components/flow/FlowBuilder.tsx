import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CopyPlus, Ellipsis, FolderInput, GripVertical, Link2, Plus, Route, Trash2, TriangleAlert } from 'lucide-react';
import { ApiRequest, Flow, FlowNode } from '../../types';
import { Button, IconButton } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { getMethodClass, getMethodShort, getStatusTone } from '../../utils/http-ui';
import { FlowRun } from './flowRunner';
import { StepMarker, formatMs } from './flowUi';

export interface StepView {
  node: FlowNode;
  /** The request the step will send, or null if its saved request was deleted. */
  request: ApiRequest | null;
  name: string;
  linked: boolean;
}

interface FlowBuilderProps {
  flow: Flow;
  steps: StepView[];
  run?: FlowRun;
  selectedNodeId: string | null;
  onNodeSelect: (id: string) => void;
  onAddSaved: () => void;
  onAddBlank: () => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}

const SyntaxHint: React.FC = () => (
  <div className="mx-auto mt-2 w-full max-w-md rounded-lg border border-border bg-card p-3 text-left text-xs text-muted-foreground">
    <p className="mb-2 text-[11px] font-medium uppercase tracking-wide">Passing data between steps</p>
    <ul className="space-y-1.5">
      <li>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">{'{{userId}}'}</code> a variable extracted from an earlier step
      </li>
      <li>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">{'{{steps.1.body.id}}'}</code> a field from step 1's JSON response
      </li>
      <li>
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">{'{{steps.1.headers.etag}}'}</code> a response header
      </li>
    </ul>
  </div>
);

export const FlowBuilder: React.FC<FlowBuilderProps> = ({
  flow,
  steps,
  run,
  selectedNodeId,
  onNodeSelect,
  onAddSaved,
  onAddBlank,
  onMove,
  onDuplicate,
  onRemove,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  if (flow.nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center overflow-auto py-8">
        <EmptyState
          className="!h-auto"
          icon={<Route />}
          title="Add the first step"
          message="Steps run top to bottom. Add requests you've saved in a collection, or start a blank request that lives only in this flow."
        >
          <Button onClick={onAddSaved}>
            <FolderInput className="h-4 w-4" /> Add saved request
          </Button>
          <Button variant="secondary" onClick={onAddBlank}>
            <Plus className="h-4 w-4" /> Blank request
          </Button>
        </EmptyState>
        <div className="w-full px-4">
          <SyntaxHint />
        </div>
      </div>
    );
  }

  const runByNode = new Map(run?.steps.map((s) => [s.nodeId, s]) ?? []);

  return (
    <div className="h-full overflow-auto">
      <ol className="mx-auto w-full max-w-3xl p-3 sm:p-4" aria-label={`Steps in ${flow.name}`}>
        {steps.map((step, index) => {
          const { node, request } = step;
          const stepRun = runByNode.get(node.id);
          const selected = selectedNodeId === node.id;
          const method = request?.method;
          const extracted = stepRun?.extracted ?? {};
          const isDropTarget = overIndex === index && dragIndex !== null && dragIndex !== index;
          return (
            <li
              key={node.id}
              className="relative"
              onDragOver={(e) => {
                if (dragIndex === null) return;
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
            >
              {index > 0 && <div aria-hidden className="ml-[23px] h-3 w-px bg-border sm:ml-[27px]" />}
              <div
                className={`group relative flex items-start gap-2 rounded-lg border bg-card p-2.5 transition-colors sm:p-3 ${
                  selected ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border hover:border-input'
                } ${isDropTarget ? (dragIndex! > index ? 'shadow-[0_-2px_0_0_hsl(var(--primary))]' : 'shadow-[0_2px_0_0_hsl(var(--primary))]') : ''} ${
                  dragIndex === index ? 'opacity-50' : ''
                }`}
              >
                <StepMarker index={index} status={stepRun?.status} className="mt-0.5" />
                <button
                  type="button"
                  onClick={() => onNodeSelect(node.id)}
                  aria-current={selected ? 'true' : undefined}
                  className="min-w-0 flex-1 rounded text-left focus-ring after:absolute after:inset-0 after:content-['']"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {method && <span className={`w-9 flex-shrink-0 font-mono text-[11px] font-semibold ${getMethodClass(method)}`}>{getMethodShort(method)}</span>}
                    <span className="truncate text-[13px] font-medium text-foreground">{step.name}</span>
                    {step.linked && (
                      <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-label="Linked to a saved request" />
                    )}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                    {request ? request.url || 'No URL yet' : 'Saved request was deleted'}
                  </span>
                  {node.extractions.some((e) => e.name.trim()) && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {node.extractions
                        .filter((e) => e.name.trim())
                        .map((e) => (
                          <span key={e.id} className="inline-flex max-w-full items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            <span className="text-foreground">{e.name}</span>
                            {extracted[e.name] !== undefined ? (
                              <span className="truncate">= {extracted[e.name].length > 32 ? `${extracted[e.name].slice(0, 32)}…` : extracted[e.name]}</span>
                            ) : (
                              <span className="truncate">← {e.source === 'HEADER' ? `header ${e.path}` : e.path || '$'}</span>
                            )}
                          </span>
                        ))}
                    </span>
                  )}
                  {stepRun?.status === 'failed' && stepRun.error && (
                    <span className="mt-1.5 block text-xs text-destructive-text">{stepRun.error}</span>
                  )}
                  {!request && !stepRun && (
                    <span className="mt-1.5 flex items-center gap-1 text-xs text-warning-text">
                      <TriangleAlert className="h-3.5 w-3.5" /> Remove this step or point it at another request.
                    </span>
                  )}
                  {stepRun && stepRun.warnings.length > 0 && stepRun.status !== 'failed' && (
                    <span className="mt-1.5 flex items-center gap-1 text-xs text-warning-text">
                      <TriangleAlert className="h-3.5 w-3.5" /> {stepRun.warnings.length === 1 ? stepRun.warnings[0] : `${stepRun.warnings.length} warnings`}
                    </span>
                  )}
                </button>
                <div className="relative z-10 flex flex-shrink-0 items-center gap-1">
                  {stepRun?.response && (
                    <span className="flex items-center gap-1.5">
                      <Badge tone={getStatusTone(stepRun.response.status)}>{stepRun.response.status || 'ERR'}</Badge>
                      <span className="hidden w-14 text-right font-mono text-xs tabular-nums text-muted-foreground sm:inline">{formatMs(stepRun.duration)}</span>
                    </span>
                  )}
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(index);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', node.id);
                    }}
                    onDragEnd={() => {
                      setDragIndex(null);
                      setOverIndex(null);
                    }}
                    title="Drag to reorder"
                    className="hidden h-7 w-5 cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton size="sm" aria-label={`Actions for step ${index + 1}`}>
                        <Ellipsis className="h-4 w-4" />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => onMove(index, index - 1)} disabled={index === 0}>
                        <ArrowUp /> Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onMove(index, index + 1)} disabled={index === steps.length - 1}>
                        <ArrowDown /> Move down
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(node.id)}>
                        <CopyPlus /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onClick={() => onRemove(node.id)}>
                        <Trash2 /> Remove step
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </li>
          );
        })}
        <li className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[38px]">
          <Button size="sm" variant="secondary" onClick={onAddSaved}>
            <FolderInput className="h-3.5 w-3.5" /> Add saved request
          </Button>
          <Button size="sm" variant="ghost" onClick={onAddBlank}>
            <Plus className="h-3.5 w-3.5" /> Blank request
          </Button>
        </li>
      </ol>
    </div>
  );
};


