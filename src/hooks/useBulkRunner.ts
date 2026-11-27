import { useCallback, useRef } from 'react';
import { ApiRequest, ApiResponse, BulkResult, BulkRunLog, BulkSettings, FinalApiRequest } from '../types';
import { useBulk } from '../context/BulkContext';
import { useLog } from '../context/LogContext';

export type ExecuteFn = (request: ApiRequest, row: Record<string, string>) => Promise<{ request: FinalApiRequest; response: ApiResponse }>;

interface RunSnapshot {
  request: ApiRequest;
  data: Record<string, string>[];
  settings: BulkSettings;
  startedAt: string;
}

const EMPTY_RESPONSE: ApiResponse = { status: 0, statusText: '', headers: {}, body: null, duration: 0 };

/**
 * Executes the bulk dataset with a worker pool.
 *
 * - Configuration (request template, data, settings) is frozen when a run starts.
 * - Pause lets in-flight requests finish and stops picking up new rows; Resume
 *   restarts the pool on whatever is still queued.
 * - Stop invalidates the run: late responses are discarded and queued rows are
 *   marked as cancelled.
 */
export const useBulkRunner = (execute: ExecuteFn) => {
  const { bulkData, bulkRequest, bulkSettings, setBulkResults, setBulkRunState } = useBulk();
  const { setLogs } = useLog();

  const runIdRef = useRef(0);
  const queueRef = useRef<number[]>([]);
  const pausedRef = useRef(false);
  const activeWorkersRef = useRef(0);
  const snapshotRef = useRef<RunSnapshot | null>(null);
  const resultsRef = useRef<BulkResult[]>([]);
  const executeRef = useRef(execute);
  executeRef.current = execute;

  const commit = useCallback(
    (updater: (prev: BulkResult[]) => BulkResult[]) => {
      resultsRef.current = updater(resultsRef.current);
      setBulkResults(resultsRef.current);
    },
    [setBulkResults]
  );

  const writeLog = useCallback(() => {
    const snap = snapshotRef.current;
    if (!snap) return;
    const results = resultsRef.current;
    if (!results.some((r) => r.status === 'success' || r.status === 'error')) return;
    const log: BulkRunLog = {
      id: Date.now(),
      mode: 'bulk',
      requestTemplate: snap.request,
      data: snap.data,
      settings: snap.settings,
      results,
      timestamp: snap.startedAt,
    };
    setLogs((prev) => [log, ...prev.slice(0, 99)]);
  }, [setLogs]);

  const finishIfIdle = useCallback(
    (runId: number) => {
      if (runId !== runIdRef.current || activeWorkersRef.current > 0) return;
      if (pausedRef.current && queueRef.current.length > 0) {
        setBulkRunState('paused');
        return;
      }
      if (queueRef.current.length === 0) {
        setBulkRunState('finished');
        writeLog();
      }
    },
    [setBulkRunState, writeLog]
  );

  const spawnWorkers = useCallback(
    (runId: number) => {
      const snap = snapshotRef.current;
      if (!snap) return;
      const worker = async () => {
        activeWorkersRef.current += 1;
        try {
          while (runId === runIdRef.current && !pausedRef.current && queueRef.current.length > 0) {
            const index = queueRef.current.shift()!;
            const row = snap.data[index];
            commit((prev) => prev.map((r, i) => (i === index ? { ...r, status: 'running' } : r)));
            let outcome: { request: FinalApiRequest; response: ApiResponse };
            try {
              outcome = await executeRef.current(snap.request, row);
            } catch (e) {
              outcome = {
                request: {} as FinalApiRequest,
                response: { ...EMPTY_RESPONSE, statusText: 'Error', body: e instanceof Error ? e.message : String(e) },
              };
            }
            if (runId !== runIdRef.current) return;
            const ok = outcome.response.status >= 200 && outcome.response.status < 300;
            commit((prev) =>
              prev.map((r, i) => (i === index ? { ...r, request: outcome.request, response: outcome.response, status: ok ? 'success' : 'error' } : r))
            );
            if (snap.settings.delay > 0 && queueRef.current.length > 0) {
              await new Promise((res) => setTimeout(res, snap.settings.delay));
            }
          }
        } finally {
          activeWorkersRef.current -= 1;
          finishIfIdle(runId);
        }
      };
      const count = Math.max(1, Math.min(snap.settings.concurrency || 1, queueRef.current.length));
      for (let i = 0; i < count; i++) void worker();
    },
    [commit, finishIfIdle]
  );

  const start = useCallback(() => {
    if (bulkData.length === 0) return;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    pausedRef.current = false;
    activeWorkersRef.current = 0;
    snapshotRef.current = {
      request: bulkRequest,
      data: bulkData,
      settings: bulkSettings,
      startedAt: new Date().toISOString(),
    };
    queueRef.current = bulkData.map((_, i) => i);
    commit(() =>
      bulkData.map((data, i) => ({
        id: i + 1,
        data,
        request: {} as FinalApiRequest,
        response: EMPTY_RESPONSE,
        status: 'pending',
      }))
    );
    setBulkRunState('running');
    spawnWorkers(runId);
  }, [bulkData, bulkRequest, bulkSettings, commit, setBulkRunState, spawnWorkers]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setBulkRunState('paused');
  }, [setBulkRunState]);

  const resume = useCallback(() => {
    if (!snapshotRef.current) return;
    pausedRef.current = false;
    setBulkRunState('running');
    // Workers that were still draining their last request keep going; top up the pool.
    const missing = Math.max(0, snapshotRef.current.settings.concurrency - activeWorkersRef.current);
    if (missing > 0 && queueRef.current.length > 0) {
      const snap = snapshotRef.current;
      snapshotRef.current = { ...snap, settings: { ...snap.settings, concurrency: missing } };
      spawnWorkers(runIdRef.current);
      snapshotRef.current = snap;
    } else {
      finishIfIdle(runIdRef.current);
    }
  }, [setBulkRunState, spawnWorkers, finishIfIdle]);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    pausedRef.current = false;
    queueRef.current = [];
    activeWorkersRef.current = 0;
    commit((prev) => prev.map((r) => (r.status === 'pending' || r.status === 'running' ? { ...r, status: 'cancelled' } : r)));
    setBulkRunState('stopped');
    writeLog();
  }, [commit, setBulkRunState, writeLog]);

  /** Seed the runner with results restored from history so Summary/Results render. */
  const restore = useCallback(
    (results: BulkResult[]) => {
      runIdRef.current += 1;
      queueRef.current = [];
      resultsRef.current = results;
      setBulkResults(results);
    },
    [setBulkResults]
  );

  return { start, pause, resume, stop, restore };
};
