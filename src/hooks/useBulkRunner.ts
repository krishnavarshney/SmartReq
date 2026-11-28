import { useCallback, useEffect, useRef } from 'react';
import { ApiRequest, ApiResponse, BulkResult, BulkRunLog, BulkSettings, FinalApiRequest } from '../types';
import { useBulk } from '../context/BulkContext';
import { useLog } from '../context/LogContext';

export type ExecuteFn = (
  request: ApiRequest,
  row: Record<string, string>,
  signal?: AbortSignal
) => Promise<{ request: FinalApiRequest; response: ApiResponse }>;

export interface BulkStartOptions {
  /** Only (re)run these row indices; other rows keep their previous result. */
  rows?: number[];
}

interface RunContext {
  id: number;
  request: ApiRequest;
  data: Record<string, string>[];
  settings: BulkSettings;
  startedAt: string;
  queue: number[];
  active: number;
  logged: boolean;
  /** Aborted on Stop so in-flight requests are cancelled, not just ignored. */
  controller: AbortController;
}

const EMPTY_RESPONSE: ApiResponse = { status: 0, statusText: '', headers: {}, body: null, duration: 0 };
/** Results are committed to React state at most this often while a run is busy. */
const FLUSH_MS = 60;

const clampConcurrency = (n: number) => Math.max(1, Math.min(50, Math.floor(n) || 1));

/**
 * Executes the bulk dataset with a worker pool.
 *
 * - Configuration (request template, data, settings) is frozen when a run starts.
 * - Every run owns its own context (queue, active-worker count), so a run that was
 *   stopped can never disturb the bookkeeping of the run that replaced it.
 * - Pause lets in-flight requests finish and stops picking up new rows; Resume
 *   tops the pool back up to the configured concurrency.
 * - Stop invalidates the run: late responses are discarded and queued or in-flight
 *   rows are marked as cancelled.
 * - Row updates are batched (FLUSH_MS) so large, fast runs do not re-render per row.
 */
export const useBulkRunner = (execute: ExecuteFn) => {
  const { bulkData, bulkRequest, bulkSettings, setBulkResults, setBulkRunState } = useBulk();
  const { setLogs } = useLog();

  const runRef = useRef<RunContext | null>(null);
  const runCounterRef = useRef(0);
  const pausedRef = useRef(false);
  const resultsRef = useRef<BulkResult[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const executeRef = useRef(execute);
  executeRef.current = execute;

  const flush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setBulkResults(resultsRef.current);
  }, [setBulkResults]);

  const commit = useCallback(
    (updater: (prev: BulkResult[]) => BulkResult[], immediate = false) => {
      resultsRef.current = updater(resultsRef.current);
      if (immediate) {
        flush();
      } else if (flushTimerRef.current === null) {
        flushTimerRef.current = window.setTimeout(flush, FLUSH_MS);
      }
    },
    [flush]
  );

  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) window.clearTimeout(flushTimerRef.current);
    },
    []
  );

  const isCurrent = (run: RunContext) => runRef.current === run;

  const writeLog = useCallback(
    (run: RunContext) => {
      if (run.logged) return;
      const results = resultsRef.current;
      if (!results.some((r) => r.status === 'success' || r.status === 'error')) return;
      run.logged = true;
      const log: BulkRunLog = {
        id: Date.now(),
        mode: 'bulk',
        requestTemplate: run.request,
        data: run.data,
        settings: run.settings,
        results,
        timestamp: run.startedAt,
      };
      setLogs((prev) => [log, ...prev.slice(0, 99)]);
    },
    [setLogs]
  );

  const finishIfIdle = useCallback(
    (run: RunContext) => {
      if (!isCurrent(run) || run.active > 0) return;
      if (pausedRef.current && run.queue.length > 0) {
        flush();
        setBulkRunState('paused');
        return;
      }
      if (run.queue.length === 0) {
        flush();
        setBulkRunState('finished');
        writeLog(run);
      }
    },
    [flush, setBulkRunState, writeLog]
  );

  const spawnWorkers = useCallback(
    (run: RunContext, count: number) => {
      const worker = async () => {
        run.active += 1;
        try {
          while (isCurrent(run) && !pausedRef.current && run.queue.length > 0) {
            const index = run.queue.shift()!;
            const row = run.data[index];
            commit((prev) => prev.map((r, i) => (i === index ? { ...r, status: 'running' } : r)));
            let outcome: { request: FinalApiRequest; response: ApiResponse };
            try {
              outcome = await executeRef.current(run.request, row, run.controller.signal);
            } catch (e) {
              outcome = {
                request: {} as FinalApiRequest,
                response: { ...EMPTY_RESPONSE, statusText: 'Error', body: e instanceof Error ? e.message : String(e) },
              };
            }
            if (!isCurrent(run)) return;
            const ok = outcome.response.status >= 200 && outcome.response.status < 300;
            commit((prev) =>
              prev.map((r, i) => (i === index ? { ...r, request: outcome.request, response: outcome.response, status: ok ? 'success' : 'error' } : r))
            );
            if (run.settings.delay > 0 && run.queue.length > 0 && !pausedRef.current) {
              await new Promise((res) => setTimeout(res, run.settings.delay));
            }
          }
        } finally {
          run.active -= 1;
          finishIfIdle(run);
        }
      };
      const n = Math.max(0, Math.min(count, run.queue.length));
      for (let i = 0; i < n; i++) void worker();
      if (n === 0) finishIfIdle(run);
    },
    [commit, finishIfIdle]
  );

  const start = useCallback(
    (options?: BulkStartOptions | unknown) => {
      if (bulkData.length === 0) return;
      // onRun may be wired straight to onClick; ignore anything that is not our options bag.
      const rows =
        options && typeof options === 'object' && Array.isArray((options as BulkStartOptions).rows)
          ? (options as BulkStartOptions).rows!.filter((i) => i >= 0 && i < bulkData.length)
          : null;
      const partial = !!rows && rows.length > 0 && resultsRef.current.length === bulkData.length;

      const run: RunContext = {
        id: ++runCounterRef.current,
        request: bulkRequest,
        data: bulkData,
        settings: { concurrency: clampConcurrency(bulkSettings.concurrency), delay: Math.max(0, bulkSettings.delay || 0) },
        startedAt: new Date().toISOString(),
        queue: partial ? [...rows!] : bulkData.map((_, i) => i),
        active: 0,
        logged: false,
        controller: new AbortController(),
      };
      runRef.current = run;
      pausedRef.current = false;

      if (partial) {
        const retry = new Set(rows!);
        commit(
          (prev) =>
            prev.map((r, i) =>
              retry.has(i) ? { ...r, data: bulkData[i], request: {} as FinalApiRequest, response: EMPTY_RESPONSE, status: 'pending' } : r
            ),
          true
        );
      } else {
        commit(
          () =>
            bulkData.map((data, i) => ({
              id: i + 1,
              data,
              request: {} as FinalApiRequest,
              response: EMPTY_RESPONSE,
              status: 'pending',
            })),
          true
        );
      }
      setBulkRunState('running');
      spawnWorkers(run, run.settings.concurrency);
    },
    [bulkData, bulkRequest, bulkSettings, commit, setBulkRunState, spawnWorkers]
  );

  const pause = useCallback(() => {
    const run = runRef.current;
    if (!run || (run.queue.length === 0 && run.active === 0)) return;
    pausedRef.current = true;
    flush();
    setBulkRunState('paused');
  }, [flush, setBulkRunState]);

  const resume = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    pausedRef.current = false;
    setBulkRunState('running');
    // Workers that were still draining their last request keep going; top up the pool.
    const missing = Math.max(0, run.settings.concurrency - run.active);
    if (missing > 0 && run.queue.length > 0) spawnWorkers(run, missing);
    else finishIfIdle(run);
  }, [setBulkRunState, spawnWorkers, finishIfIdle]);

  const stop = useCallback(() => {
    const run = runRef.current;
    runRef.current = null;
    pausedRef.current = false;
    if (run) {
      run.queue = [];
      run.controller.abort();
    }
    commit((prev) => prev.map((r) => (r.status === 'pending' || r.status === 'running' ? { ...r, status: 'cancelled' } : r)), true);
    setBulkRunState((prev) => (prev === 'running' || prev === 'paused' ? 'stopped' : prev));
    if (run) writeLog(run);
  }, [commit, setBulkRunState, writeLog]);

  /** Seed the runner with results restored from history so Summary/Results render. */
  const restore = useCallback(
    (results: BulkResult[]) => {
      runRef.current?.controller.abort();
      runRef.current = null;
      pausedRef.current = false;
      resultsRef.current = results;
      flush();
    },
    [flush]
  );

  return { start, pause, resume, stop, restore };
};
