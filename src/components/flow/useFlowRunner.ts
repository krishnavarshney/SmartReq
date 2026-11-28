import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ApiRequest, Flow, FlowNode, KeyValueItem } from '../../types';
import {
  FlowRun,
  StepRun,
  buildStepData,
  executeStep,
  extractVariables,
  findUnresolved,
  getFailureReason,
} from './flowRunner';

export type RequestResolver = (node: FlowNode) => ApiRequest | null;

/**
 * Runs flows step by step. Results are kept in memory per flow (responses can be
 * large, so they are not persisted) and survive mode switches because the Flow
 * workspace stays mounted.
 */
export const useFlowRunner = (env: KeyValueItem[], resolveRequest: RequestResolver) => {
  const [runs, setRuns] = useState<Record<string, FlowRun>>({});
  const controllers = useRef<Record<string, AbortController>>({});
  const envRef = useRef(env);
  envRef.current = env;
  const resolveRef = useRef(resolveRequest);
  resolveRef.current = resolveRequest;

  useEffect(() => {
    const all = controllers.current;
    return () => Object.values(all).forEach((c) => c.abort());
  }, []);

  const patchStep = useCallback((flowId: string, runId: string, index: number, patch: Partial<StepRun>) => {
    setRuns((prev) => {
      const run = prev[flowId];
      if (!run || run.id !== runId) return prev;
      const steps = run.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...prev, [flowId]: { ...run, steps } };
    });
  }, []);

  const patchRun = useCallback((flowId: string, runId: string, patch: Partial<FlowRun>) => {
    setRuns((prev) => {
      const run = prev[flowId];
      if (!run || run.id !== runId) return prev;
      return { ...prev, [flowId]: { ...run, ...patch } };
    });
  }, []);

  const run = useCallback(
    async (flow: Flow) => {
      if (flow.nodes.length === 0) return;
      controllers.current[flow.id]?.abort();
      const controller = new AbortController();
      controllers.current[flow.id] = controller;
      const runId = uuidv4();
      const stopOnFailure = flow.stopOnFailure !== false;
      const nodes = flow.nodes;

      const initial: FlowRun = {
        id: runId,
        flowId: flow.id,
        status: 'running',
        startedAt: Date.now(),
        steps: nodes.map((n) => ({ nodeId: n.id, status: 'pending', extracted: {}, warnings: [] })),
        variables: {},
      };
      setRuns((prev) => ({ ...prev, [flow.id]: initial }));

      const done: StepRun[] = [];
      let variables: Record<string, string> = {};
      let anyFailed = false;
      let halted: 'stopped' | 'failed' | null = null;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (controller.signal.aborted) {
          halted = 'stopped';
          break;
        }
        const request = resolveRef.current(node);
        if (!request) {
          const step: StepRun = {
            nodeId: node.id,
            status: 'failed',
            extracted: {},
            warnings: [],
            error: 'The saved request this step points to no longer exists.',
          };
          done.push(step);
          patchStep(flow.id, runId, i, step);
          anyFailed = true;
          if (stopOnFailure) {
            halted = 'failed';
            break;
          }
          continue;
        }
        if (!request.url.trim()) {
          const step: StepRun = { nodeId: node.id, status: 'failed', extracted: {}, warnings: [], error: 'This step has no URL.' };
          done.push(step);
          patchStep(flow.id, runId, i, step);
          anyFailed = true;
          if (stopOnFailure) {
            halted = 'failed';
            break;
          }
          continue;
        }

        const { data, warnings } = buildStepData(request, done, variables);
        const startedAt = Date.now();
        patchStep(flow.id, runId, i, { status: 'running', startedAt });

        try {
          const result = await executeStep(request, data, envRef.current, controller.signal);
          const unresolved = findUnresolved(result.request);
          const stepWarnings = [...warnings, ...unresolved.map((u) => `{{${u}}} is not defined, so it was sent literally`)];
          const extraction = extractVariables(node.extractions, result.response);
          stepWarnings.push(...extraction.warnings);
          variables = { ...variables, ...extraction.values };
          const failure = result.request.preRequestError
            ? `Pre-request script failed: ${result.request.preRequestError}`
            : getFailureReason(result.response);
          const step: StepRun = {
            nodeId: node.id,
            status: failure ? 'failed' : 'passed',
            startedAt,
            duration: result.response.duration,
            request: result.request,
            response: result.response,
            extracted: extraction.values,
            warnings: stepWarnings,
            error: failure ?? undefined,
          };
          done.push(step);
          patchStep(flow.id, runId, i, step);
          patchRun(flow.id, runId, { variables });
          if (failure) {
            anyFailed = true;
            if (stopOnFailure) {
              halted = 'failed';
              break;
            }
          }
        } catch (e) {
          if (controller.signal.aborted) {
            patchStep(flow.id, runId, i, { status: 'cancelled', duration: Date.now() - startedAt, warnings });
            halted = 'stopped';
            break;
          }
          const step: StepRun = {
            nodeId: node.id,
            status: 'failed',
            startedAt,
            duration: Date.now() - startedAt,
            extracted: {},
            warnings,
            error: e instanceof Error ? e.message : 'Unexpected error while running this step',
          };
          done.push(step);
          patchStep(flow.id, runId, i, step);
          anyFailed = true;
          if (stopOnFailure) {
            halted = 'failed';
            break;
          }
        }
      }

      // Everything after a halt is marked skipped.
      setRuns((prev) => {
        const current = prev[flow.id];
        if (!current || current.id !== runId) return prev;
        const steps = current.steps.map((s) => (s.status === 'pending' || s.status === 'running' ? { ...s, status: 'skipped' as const } : s));
        const status = halted === 'stopped' ? 'stopped' : anyFailed ? 'failed' : 'passed';
        return { ...prev, [flow.id]: { ...current, steps, status, finishedAt: Date.now(), variables } };
      });
      if (controllers.current[flow.id] === controller) delete controllers.current[flow.id];
    },
    [patchStep, patchRun]
  );

  const stop = useCallback((flowId: string) => {
    controllers.current[flowId]?.abort();
  }, []);

  const clear = useCallback((flowId: string) => {
    controllers.current[flowId]?.abort();
    setRuns((prev) => {
      const next = { ...prev };
      delete next[flowId];
      return next;
    });
  }, []);

  return { runs, run, stop, clear };
};
