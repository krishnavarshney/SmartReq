import React, { createContext, useState, useContext, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveredEndpoint } from '../types';
import {
  DiscoveryLogEntry,
  DiscoveryProgress,
  MAX_DISCOVERY_REQUESTS,
  generateOpenApiSpec,
  isAbortError,
  normalizeBaseUrl,
  startDiscovery,
} from '../utils/discovery';
import { getApiKey } from '../utils/apiKey';

export type DiscoveryStatus = 'running' | 'finished' | 'stopped' | 'error';
export type SpecStatus = 'idle' | 'generating' | 'done' | 'error';

export interface DiscoveryRun {
  id: string;
  baseUrl: string;
  status: DiscoveryStatus;
  endpoints: DiscoveredEndpoint[];
  log: DiscoveryLogEntry[];
  progress: DiscoveryProgress;
  /** Why the crawl failed (status === 'error'). */
  error?: string;
  startedAt: number;
  finishedAt?: number;
  spec?: string;
  specStatus: SpecStatus;
  specError?: string;
}

interface DiscoveryContextType {
  session: DiscoveryRun | null;
  /** Start a crawl. Resolves when it ends; returns a validation error message instead of starting if the URL is bad. */
  start: (baseUrl: string) => Promise<string | null>;
  stop: () => void;
  /** (Re)generate the OpenAPI draft from the current endpoints. */
  generateSpec: () => Promise<void>;
  reset: () => void;
}

const DiscoveryContext = createContext<DiscoveryContextType | undefined>(undefined);

const logEntry = (level: DiscoveryLogEntry['level'], message: string): DiscoveryLogEntry => ({ time: Date.now(), level, message });

export const DiscoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<DiscoveryRun | null>(null);
  const crawlController = useRef<AbortController | null>(null);
  const specController = useRef<AbortController | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(
    () => () => {
      crawlController.current?.abort();
      specController.current?.abort();
    },
    []
  );

  const patch = useCallback((id: string, fn: (s: DiscoveryRun) => DiscoveryRun) => {
    setSession((s) => (s && s.id === id ? fn(s) : s));
  }, []);

  const runSpec = useCallback(
    async (id: string, endpoints: DiscoveredEndpoint[], baseUrl: string) => {
      specController.current?.abort();
      const controller = new AbortController();
      specController.current = controller;
      patch(id, (s) => ({ ...s, specStatus: 'generating', specError: undefined, log: [...s.log, logEntry('ai', 'Drafting an OpenAPI spec from the discovered endpoints…')] }));
      try {
        const spec = await generateOpenApiSpec(endpoints, baseUrl, controller.signal);
        patch(id, (s) => ({ ...s, spec, specStatus: 'done', log: [...s.log, logEntry('ok', 'OpenAPI spec drafted.')] }));
      } catch (e) {
        if (isAbortError(e)) {
          patch(id, (s) => ({ ...s, specStatus: s.spec ? 'done' : 'idle' }));
          return;
        }
        const message = e instanceof Error ? e.message : 'Spec generation failed.';
        patch(id, (s) => ({ ...s, specStatus: 'error', specError: message, log: [...s.log, logEntry('error', `Spec generation failed: ${message}`)] }));
      } finally {
        if (specController.current === controller) specController.current = null;
      }
    },
    [patch]
  );

  const start = useCallback(
    async (input: string): Promise<string | null> => {
      const normalized = normalizeBaseUrl(input);
      if ('error' in normalized) return normalized.error;
      if (!getApiKey()) return 'Add a Gemini API key in Settings to use Discovery.';

      crawlController.current?.abort();
      specController.current?.abort();
      const controller = new AbortController();
      crawlController.current = controller;
      const id = uuidv4();
      const baseUrl = normalized.url;
      setSession({
        id,
        baseUrl,
        status: 'running',
        endpoints: [],
        log: [logEntry('info', `Starting discovery at ${baseUrl}`)],
        progress: { requested: 0, queued: 1, limit: MAX_DISCOVERY_REQUESTS },
        startedAt: Date.now(),
        specStatus: 'idle',
      });

      let endpoints: DiscoveredEndpoint[] = [];
      try {
        for await (const update of startDiscovery(baseUrl, controller.signal)) {
          if (update.endpoints) endpoints = update.endpoints;
          patch(id, (s) => ({
            ...s,
            endpoints: update.endpoints ?? s.endpoints,
            progress: update.progress ?? s.progress,
            log: update.log ? [...s.log, ...update.log] : s.log,
          }));
        }
        const found = endpoints.length;
        patch(id, (s) => ({
          ...s,
          status: 'finished',
          finishedAt: Date.now(),
          log: [...s.log, logEntry('ok', `Finished: ${found} ${found === 1 ? 'endpoint' : 'endpoints'} found.`)],
        }));
        if (found > 0) await runSpec(id, endpoints, baseUrl);
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          patch(id, (s) => ({ ...s, status: 'stopped', finishedAt: Date.now(), log: [...s.log, logEntry('warn', 'Stopped by you.')] }));
        } else {
          const message = error instanceof Error ? error.message : 'Discovery failed.';
          patch(id, (s) => ({ ...s, status: 'error', error: message, finishedAt: Date.now(), log: [...s.log, logEntry('error', message)] }));
        }
      } finally {
        if (crawlController.current === controller) crawlController.current = null;
      }
      return null;
    },
    [patch, runSpec]
  );

  const stop = useCallback(() => {
    crawlController.current?.abort();
    specController.current?.abort();
  }, []);

  const generateSpec = useCallback(async () => {
    const s = sessionRef.current;
    if (!s || s.endpoints.length === 0 || s.status === 'running') return;
    await runSpec(s.id, s.endpoints, s.baseUrl);
  }, [runSpec]);

  const reset = useCallback(() => {
    crawlController.current?.abort();
    specController.current?.abort();
    setSession(null);
  }, []);

  return <DiscoveryContext.Provider value={{ session, start, stop, generateSpec, reset }}>{children}</DiscoveryContext.Provider>;
};

export const useDiscovery = () => {
  const context = useContext(DiscoveryContext);
  if (context === undefined) {
    throw new Error('useDiscovery must be used within a DiscoveryProvider');
  }
  return context;
};
