import { useEffect, useRef, useState } from 'react';
import { BulkRunState } from '../../types';

export interface RunClock {
  /** False until a run has been started in this session (e.g. results restored from history). */
  available: boolean;
  /** Active run time with pauses excluded. */
  elapsedMs: number;
  /** Settled requests per second for the current run. */
  rps: number;
  /** Estimated time remaining, null when unknown. */
  etaMs: number | null;
}

/**
 * Tracks wall-clock timing for bulk runs from run-state transitions:
 * idle/finished/stopped -> running starts a new run, paused -> running resumes.
 */
export const useRunClock = (runState: BulkRunState, settled: number, remaining: number): RunClock => {
  const prevState = useRef<BulkRunState>(runState);
  const activeSince = useRef<number | null>(null);
  const accumulated = useRef(0);
  const baseline = useRef(0);
  const [available, setAvailable] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const settledRef = useRef(settled);
  settledRef.current = settled;

  useEffect(() => {
    const prev = prevState.current;
    prevState.current = runState;
    const t = Date.now();
    if (runState === 'running') {
      if (prev !== 'paused') {
        accumulated.current = 0;
        baseline.current = settledRef.current;
        setAvailable(true);
      }
      if (activeSince.current === null) activeSince.current = t;
    } else if (activeSince.current !== null) {
      accumulated.current += t - activeSince.current;
      activeSince.current = null;
    }
    setNow(t);
  }, [runState]);

  useEffect(() => {
    if (runState !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [runState]);

  const elapsedMs = accumulated.current + (activeSince.current !== null ? Math.max(0, now - activeSince.current) : 0);
  const done = Math.max(0, settled - baseline.current);
  const rps = elapsedMs > 250 ? done / (elapsedMs / 1000) : 0;
  const etaMs = rps > 0 && remaining > 0 ? (remaining / rps) * 1000 : remaining === 0 ? 0 : null;
  return { available, elapsedMs, rps, etaMs };
};
