import React from 'react';
import { Monitor, Server, Play } from 'lucide-react';
import { getMethodClass, getStatusTextClass } from '../../utils/http-ui';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { FlowRun } from './flowRunner';
import { StepView } from './FlowBuilder';
import { displayPath, formatMs, hostOf, stepStatusLabel } from './flowUi';

interface SequenceDiagramProps {
  steps: StepView[];
  run?: FlowRun;
  selectedNodeId: string | null;
  onSelectStep: (nodeId: string) => void;
  onRun: () => void;
  canRun: boolean;
}

const ROW = 76;
const COL_MIN = 190;

/** Client-to-server sequence of the last run: one request/response pair per step. */
export const SequenceDiagram: React.FC<SequenceDiagramProps> = ({ steps, run, selectedNodeId, onSelectStep, onRun, canRun }) => {
  if (!run) {
    return (
      <EmptyState
        icon={<Play />}
        title="No run yet"
        message="Run the flow to draw each request and response between your client and the servers it calls."
      >
        <Button onClick={onRun} disabled={!canRun}>
          <Play className="h-4 w-4" /> Run flow
        </Button>
      </EmptyState>
    );
  }

  const runByNode = new Map(run.steps.map((s) => [s.nodeId, s]));
  const rows = steps.map((step, index) => {
    const stepRun = runByNode.get(step.node.id);
    const url = stepRun?.request?.url ?? step.request?.url ?? '';
    return { step, index, stepRun, url, host: url ? hostOf(url) : 'unknown' };
  });
  const hosts = Array.from(new Set(rows.map((r) => r.host)));
  const participants = ['Client', ...hosts];
  const n = participants.length;
  const center = (i: number) => ((i + 0.5) / n) * 100;

  return (
    <div className="h-full overflow-auto">
      <div className="p-3 sm:p-4">
        <div
          className="relative mx-auto rounded-lg border border-border bg-card"
          style={{ minWidth: n * COL_MIN, maxWidth: Math.max(n * 320, 640) }}
        >
          {/* Participants */}
          <div className="sticky top-0 z-10 grid border-b border-border bg-card/95 py-2.5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {participants.map((p, i) => (
              <div key={p} className="flex justify-center px-2">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground">
                  {i === 0 ? <Monitor className="h-3.5 w-3.5 text-muted-foreground" /> : <Server className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="truncate font-mono">{p}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="relative" style={{ height: rows.length * ROW + 16 }}>
            {/* Lifelines */}
            {participants.map((p, i) => (
              <div key={p} aria-hidden className="absolute bottom-0 top-0 border-l border-dashed border-border" style={{ left: `${center(i)}%` }} />
            ))}

            {rows.map(({ step, index, stepRun, url, host }) => {
              const target = participants.indexOf(host);
              const left = center(0);
              const width = center(target) - left;
              const status = stepRun?.status ?? 'pending';
              const ran = !!stepRun?.response;
              const muted = status === 'pending' || status === 'skipped' || status === 'cancelled';
              const method = step.request?.method ?? stepRun?.request?.method ?? 'GET';
              const res = stepRun?.response;
              const selected = selectedNodeId === step.node.id;
              const label = `Step ${index + 1}: ${method} ${displayPath(url)}, ${
                res ? `${res.status || 'no response'} in ${formatMs(stepRun?.duration)}` : stepStatusLabel(status)
              }`;
              return (
                <button
                  key={step.node.id}
                  type="button"
                  onClick={() => onSelectStep(step.node.id)}
                  aria-label={label}
                  aria-current={selected ? 'true' : undefined}
                  className={`absolute inset-x-0 block text-left focus-ring ${selected ? 'bg-primary/[0.06]' : 'hover:bg-accent/50'} ${muted ? 'opacity-55' : ''}`}
                  style={{ top: 8 + index * ROW, height: ROW }}
                >
                  {/* Request arrow */}
                  <span className="absolute" style={{ left: `${left}%`, width: `${width}%`, top: 10 }}>
                    <span className="flex items-center justify-center gap-1.5 px-2 font-mono text-[11px] leading-4">
                      <span className="tabular-nums text-muted-foreground">{index + 1}.</span>
                      <span className={`font-semibold ${getMethodClass(method)}`}>{method}</span>
                      <span className="truncate text-foreground">{displayPath(url) || '/'}</span>
                    </span>
                    <span className={`relative mt-1 block border-t ${muted ? 'border-dashed border-muted-foreground/60' : 'border-foreground/70'}`}>
                      <span
                        aria-hidden
                        className={`absolute -right-px -top-[4.5px] h-0 w-0 border-y-[4px] border-l-[7px] border-y-transparent ${muted ? 'border-l-muted-foreground/60' : 'border-l-foreground/70'}`}
                      />
                    </span>
                  </span>

                  {/* Response arrow */}
                  <span className="absolute" style={{ left: `${left}%`, width: `${width}%`, top: 44 }}>
                    {status === 'running' ? (
                      <span className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                        <Spinner className="h-3 w-3" /> waiting for response
                      </span>
                    ) : (
                      <>
                        <span
                          className={`relative block border-t border-dashed ${
                            ran ? (res!.status ? 'border-foreground/50' : 'border-destructive/70') : 'border-muted-foreground/40'
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`absolute -left-px -top-[4.5px] h-0 w-0 border-y-[4px] border-r-[7px] border-y-transparent ${
                              ran ? (res!.status ? 'border-r-foreground/50' : 'border-r-destructive/70') : 'border-r-muted-foreground/40'
                            }`}
                          />
                        </span>
                        <span className="mt-1 flex items-center justify-center gap-1.5 px-2 font-mono text-[11px] leading-4">
                          {res ? (
                            <>
                              <span className={`font-semibold ${getStatusTextClass(res.status)}`}>{res.status || 'ERR'}</span>
                              <span className="truncate text-muted-foreground">{res.status ? res.statusText : res.statusText || 'Network error'}</span>
                              <span className="tabular-nums text-muted-foreground">· {formatMs(stepRun?.duration)}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{stepRun?.error ?? stepStatusLabel(status)}</span>
                          )}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
