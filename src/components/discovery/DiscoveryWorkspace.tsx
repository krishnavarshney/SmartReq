import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FolderPlus,
  Globe,
  KeyRound,
  Play,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  TriangleAlert,
  Wand2,
} from 'lucide-react';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { useDiscovery, DiscoveryRun } from '../../context/DiscoveryContext';
import { useToast } from '../../context/ToastContext';
import { useApp } from '../../context/AppContext';
import { useTabs } from '../../context/TabsContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useApiKey } from '../../hooks/useApiKey';
import { getMethodClass, getStatusTone } from '../../utils/http-ui';
import { createDefaultRequest } from '../../utils/collection';
import { MAX_DISCOVERY_REQUESTS, DiscoveryLogEntry, resourceOf } from '../../utils/discovery';
import { Collection, DiscoveredEndpoint, Folder, RequestItem } from '../../types';

const sectionLabel = 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground';

const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};

const formatElapsed = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

const preview = (body: unknown): string => {
  if (body === undefined || body === null || body === '') return '';
  const text = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
};

const requestFor = (ep: DiscoveredEndpoint) => {
  const request = createDefaultRequest();
  request.method = ep.method;
  request.url = ep.url;
  try {
    const u = new URL(ep.url);
    const params = [...u.searchParams.entries()].map(([key, value], i) => ({ id: Date.now() + i, key, value, enabled: true, encode: true }));
    if (params.length) request.queryParams = [...params, { id: Date.now() + params.length, key: '', value: '', enabled: true, encode: true }];
  } catch {
    /* keep defaults */
  }
  return request;
};

const nameFor = (url: string) => {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    const last = segs[segs.length - 1];
    if (!last) return u.host;
    // "/users/2" reads better as "users/2" than as "2".
    return /^[\d-]+$|^[0-9a-f-]{8,}$/i.test(last) && segs.length > 1 ? `${segs[segs.length - 2]}/${last}` : last;
  } catch {
    return url;
  }
};

/* ------------------------------------------------------------------ */
/* Intro / no key                                                      */
/* ------------------------------------------------------------------ */

const HowItWorks: React.FC = () => (
  <ol className="grid w-full max-w-2xl gap-2 px-4 sm:grid-cols-3">
    {[
      { icon: <Globe />, title: 'Crawl', text: 'Sends GET requests from your base URL, on the same host only. Nothing is ever written.' },
      { icon: <Sparkles />, title: 'Follow links', text: 'Gemini reads each response and suggests more paths to try, up to ' + MAX_DISCOVERY_REQUESTS + ' requests.' },
      { icon: <Wand2 />, title: 'Describe', text: 'Drafts an OpenAPI spec and lets you save every endpoint to a collection.' },
    ].map((s) => (
      <li key={s.title} className="rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-muted-foreground">
          {s.icon}
          {s.title}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{s.text}</p>
      </li>
    ))}
  </ol>
);

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

const EndpointRow: React.FC<{ ep: DiscoveredEndpoint; onOpen: () => void }> = ({ ep, onOpen }) => {
  const [open, setOpen] = useState(false);
  const res = ep.response;
  const body = preview(res?.body);
  return (
    <li className="border-t border-border first:border-t-0">
      <div className="group flex h-9 items-center gap-2 pl-1.5 pr-1.5 hover:bg-accent/50">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded text-left focus-ring"
        >
          <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className={`w-10 flex-shrink-0 font-mono text-[11px] font-semibold ${getMethodClass(ep.method)}`}>{ep.method}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={ep.url}>
            {pathOf(ep.url)}
          </span>
        </button>
        {res && (
          <>
            <Badge tone={getStatusTone(res.status)}>{res.status}</Badge>
            <span className="hidden w-14 text-right font-mono text-xs tabular-nums text-muted-foreground sm:inline">{res.duration} ms</span>
          </>
        )}
        <Tooltip content="Open in Request tab" side="left">
          <IconButton size="sm" aria-label={`Open ${pathOf(ep.url)} in Request tab`} onClick={onOpen}>
            <ExternalLink className="h-3.5 w-3.5" />
          </IconButton>
        </Tooltip>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-3 py-2">
          {ep.status === 'error' && res && (
            <p className="mb-2 text-xs text-warning-text">
              {res.status === 401 || res.status === 403
                ? 'This endpoint exists but needs authentication.'
                : `This endpoint answered ${res.status} ${res.statusText}.`}
            </p>
          )}
          {res?.headers['content-type'] && <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">{res.headers['content-type']}</p>}
          {body ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-foreground">{body}</pre>
          ) : (
            <p className="text-xs text-muted-foreground">Empty body</p>
          )}
        </div>
      )}
    </li>
  );
};

const EndpointList: React.FC<{ session: DiscoveryRun; onOpen: (ep: DiscoveredEndpoint) => void; onSaveCollection: () => void }> = ({
  session,
  onOpen,
  onSaveCollection,
}) => {
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const map = new Map<string, DiscoveredEndpoint[]>();
    session.endpoints
      .filter((ep) => !q || ep.url.toLowerCase().includes(q))
      .forEach((ep) => {
        const key = resourceOf(ep.url);
        map.set(key, [...(map.get(key) ?? []), ep]);
      });
    return [...map.entries()].map(([k, eps]) => [k, [...eps].sort((a, b) => pathOf(a.url).localeCompare(pathOf(b.url)))] as const);
  }, [session.endpoints, filter]);

  if (session.endpoints.length === 0) {
    if (session.status === 'running') {
      return (
        <EmptyState compact icon={<Spinner className="h-4 w-4" />} title="Looking for endpoints…" message="Endpoints appear here as soon as they answer." />
      );
    }
    return (
      <EmptyState
        compact
        icon={<Search />}
        title="No endpoints found"
        message={
          session.status === 'error'
            ? 'Fix the problem above, then press Restart.'
            : "Nothing under that URL answered. Try the API's root or a known path such as /api or /v1, and check the log for details."
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="min-w-[10rem] max-w-xs flex-1">
          <Input size="sm" icon={<Search />} placeholder="Filter paths" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter endpoints" />
        </div>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={onSaveCollection} disabled={session.status === 'running'}>
          <FolderPlus className="h-3.5 w-3.5" /> Save as collection
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {groups.length === 0 && <EmptyState compact message={`No paths match "${filter}".`} />}
        <div className="space-y-3">
          {groups.map(([resource, eps]) => (
            <section key={resource} aria-label={`${resource} endpoints`}>
              <h3 className={`${sectionLabel} mb-1.5 flex items-center gap-2 px-1`}>
                <span className="font-mono normal-case tracking-normal text-foreground">{resource === '/' ? '/' : `/${resource}`}</span>
                <span className="tabular-nums">{eps.length}</span>
              </h3>
              <ul className="overflow-hidden rounded-lg border border-border bg-card">
                {eps.map((ep) => (
                  <EndpointRow key={ep.id} ep={ep} onOpen={() => onOpen(ep)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Log + spec                                                          */
/* ------------------------------------------------------------------ */

const LEVEL_CLASS: Record<DiscoveryLogEntry['level'], string> = {
  info: 'text-muted-foreground',
  ok: 'text-success-text',
  warn: 'text-warning-text',
  error: 'text-destructive-text',
  ai: 'text-primary',
};

const LogView: React.FC<{ log: DiscoveryLogEntry[] }> = ({ log }) => {
  const endRef = React.useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [log.length]);
  return (
    <ol className="h-full overflow-auto p-3 font-mono text-xs leading-5" aria-label="Discovery log">
      {log.map((l, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex-shrink-0 tabular-nums text-muted-foreground/70">{new Date(l.time).toLocaleTimeString([], { hour12: false })}</span>
          <span className={`w-6 flex-shrink-0 uppercase ${LEVEL_CLASS[l.level]}`}>{l.level === 'info' ? '' : l.level}</span>
          <span className="min-w-0 break-words text-foreground">{l.message}</span>
        </li>
      ))}
      <li ref={endRef} aria-hidden />
    </ol>
  );
};

const SpecView: React.FC<{ session: DiscoveryRun; onGenerate: () => void }> = ({ session, onGenerate }) => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  if (session.specStatus === 'generating') {
    return <EmptyState compact icon={<Spinner className="h-4 w-4" />} title="Drafting the spec…" message="Gemini is describing the endpoints it saw." />;
  }
  if (session.spec) {
    const download = () => {
      const blob = new Blob([session.spec!], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openapi-${nameFor(session.baseUrl)}.yaml`;
      a.click();
      URL.revokeObjectURL(url);
    };
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">AI draft from observed responses. Review before relying on it.</span>
          <div className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                void navigator.clipboard.writeText(session.spec!).then(
                  () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1200);
                  },
                  () => addToast('Could not copy to the clipboard.', 'error')
                );
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" variant="ghost" onClick={download}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            <Button size="sm" variant="ghost" onClick={onGenerate} disabled={session.status === 'running'}>
              <RotateCcw className="h-3.5 w-3.5" /> Regenerate
            </Button>
          </div>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs text-foreground">{session.spec}</pre>
      </div>
    );
  }
  if (session.specStatus === 'error') {
    return (
      <EmptyState compact icon={<TriangleAlert />} title="Couldn't draft the spec" message={session.specError ?? 'Something went wrong.'}>
        <Button size="sm" variant="secondary" onClick={onGenerate}>
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </Button>
      </EmptyState>
    );
  }
  if (session.status === 'running') {
    return <EmptyState compact icon={<Wand2 />} title="Spec comes after the crawl" message="An OpenAPI draft is generated once discovery finishes." />;
  }
  if (session.endpoints.length === 0) {
    return <EmptyState compact icon={<Wand2 />} title="Nothing to describe" message="Discovery didn't find any endpoints to put in a spec." />;
  }
  return (
    <EmptyState compact icon={<Wand2 />} title="No spec yet" message="Draft an OpenAPI spec from the endpoints found so far.">
      <Button size="sm" onClick={onGenerate}>
        <Wand2 className="h-3.5 w-3.5" /> Generate spec
      </Button>
    </EmptyState>
  );
};

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export const DiscoveryWorkspace: React.FC = () => {
  const { addToast } = useToast();
  const { session, start, stop, generateSpec } = useDiscovery();
  const { setIsSettingsOpen, setMode } = useApp();
  const { setTabs, setActiveTabId } = useTabs();
  const { handleImportCollection } = useWorkspace();
  const apiKey = useApiKey();
  const [baseUrl, setBaseUrl] = useState(session?.baseUrl || '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [tab, setTab] = useState('endpoints');
  const [now, setNow] = useState(Date.now());

  const running = session?.status === 'running';

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const handleStart = async () => {
    if (!apiKey) {
      setIsSettingsOpen(true);
      return;
    }
    setUrlError(null);
    setTab('endpoints');
    const error = await start(baseUrl);
    if (error) setUrlError(error);
  };

  const openEndpoint = (ep: DiscoveredEndpoint) => {
    const id = uuidv4();
    setTabs((prev) => [...prev, { id, name: nameFor(ep.url), request: requestFor(ep), isDirty: true, latestResponse: ep.response }]);
    setActiveTabId(id);
    setMode('single');
  };

  const saveCollection = () => {
    if (!session) return;
    const host = (() => {
      try {
        return new URL(session.baseUrl).host;
      } catch {
        return session.baseUrl;
      }
    })();
    const byResource = new Map<string, RequestItem[]>();
    session.endpoints.forEach((ep) => {
      const item: RequestItem = { id: uuidv4(), type: 'request', name: `${ep.method} ${pathOf(ep.url)}`, request: requestFor(ep), responses: [] };
      const key = resourceOf(ep.url);
      byResource.set(key, [...(byResource.get(key) ?? []), item]);
    });
    const children = [...byResource.entries()].flatMap(([resource, items]): (Folder | RequestItem)[] =>
      byResource.size > 1 && resource !== '/' ? [{ id: uuidv4(), type: 'folder', name: resource, children: items }] : items
    );
    const collection: Collection = { id: uuidv4(), type: 'collection', name: `Discovered · ${host}`, children };
    handleImportCollection(collection);
    addToast(`Saved ${session.endpoints.length} requests to "${collection.name}"`, 'success');
  };

  const progressPct = session ? Math.min(100, Math.round((session.progress.requested / session.progress.limit) * 100)) : 0;

  let body: React.ReactNode;
  if (!session) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-2 overflow-auto py-8">
        {apiKey ? (
          <EmptyState
            className="!h-auto"
            icon={<Radar />}
            title="Map an API from its base URL"
            message="Enter where the API lives and press Start. Discovery follows the links in each response to find endpoints you didn't know about."
          />
        ) : (
          <EmptyState
            className="!h-auto"
            icon={<KeyRound />}
            title="Discovery needs a Gemini API key"
            message="It uses Gemini to spot links to other endpoints in each response. Your key is stored only in this browser and sent only to Google."
          >
            <Button onClick={() => setIsSettingsOpen(true)}>
              <KeyRound className="h-4 w-4" /> Add API key
            </Button>
            <Button variant="ghost" onClick={() => window.open('https://aistudio.google.com/apikey', '_blank', 'noopener,noreferrer')}>
              Get a free key <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </EmptyState>
        )}
        <HowItWorks />
      </div>
    );
  } else {
    const elapsed = (session.finishedAt ?? now) - session.startedAt;
    body = (
      <div className="flex h-full min-h-0 flex-col">
        {/* Status strip */}
        <div className="flex-shrink-0 border-b border-border bg-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs" aria-live="polite">
            {running ? (
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Spinner className="h-3.5 w-3.5 text-primary" /> Discovering
              </span>
            ) : session.status === 'finished' ? (
              <span className="flex items-center gap-1.5 font-medium text-success-text">
                <ShieldCheck className="h-3.5 w-3.5" /> Finished
              </span>
            ) : session.status === 'stopped' ? (
              <span className="font-medium text-foreground">Stopped</span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-destructive-text">
                <TriangleAlert className="h-3.5 w-3.5" /> Failed
              </span>
            )}
            <span className="min-w-0 truncate font-mono text-muted-foreground">{session.baseUrl}</span>
            <span className="ml-auto flex flex-shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
              <span>
                <span className="text-foreground">{session.endpoints.length}</span> found
              </span>
              <span>
                {session.progress.requested}/{session.progress.limit} requests
              </span>
              <span className="font-mono">{formatElapsed(elapsed)}</span>
            </span>
          </div>
          {running && (
            <div className="h-0.5 w-full bg-muted" role="progressbar" aria-label="Requests used" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.max(progressPct, 3)}%` }} />
            </div>
          )}
          {session.status === 'error' && session.error && (
            <div className="flex items-start gap-2 border-t border-border bg-destructive-bg px-3 py-2 text-xs text-destructive-text">
              <TriangleAlert className="mt-px h-3.5 w-3.5 flex-shrink-0" />
              <span className="min-w-0 flex-1">{session.error}</span>
              {/api key/i.test(session.error) && (
                <Button size="xs" variant="ghost" onClick={() => setIsSettingsOpen(true)}>
                  Open Settings
                </Button>
              )}
            </div>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="flex-shrink-0 overflow-x-auto bg-card px-2">
            <TabsTrigger value="endpoints" badge={session.endpoints.length}>
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="log" badge={session.log.length}>
              Log
            </TabsTrigger>
            <TabsTrigger
              value="spec"
              badge={session.specStatus === 'generating' ? <Spinner className="h-3 w-3" /> : session.spec ? <Check className="h-3 w-3 text-success-text" /> : undefined}
            >
              OpenAPI spec
            </TabsTrigger>
          </TabsList>
          <div className="min-h-0 flex-1">
            <TabsContent value="endpoints">
              <EndpointList session={session} onOpen={openEndpoint} onSaveCollection={saveCollection} />
            </TabsContent>
            <TabsContent value="log">
              <LogView log={session.log} />
            </TabsContent>
            <TabsContent value="spec">
              <SpecView session={session} onGenerate={() => void generateSpec()} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <form
        className="flex-shrink-0 border-b border-border bg-card px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) void handleStart();
        }}
        noValidate
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Input
              icon={<Globe />}
              aria-label="Base URL"
              placeholder="https://api.example.com"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              disabled={running}
              invalid={!!urlError}
              aria-describedby={urlError ? 'discovery-url-error' : 'discovery-url-hint'}
              className="font-mono"
              spellCheck={false}
              autoComplete="url"
              inputMode="url"
            />
          </div>
          {running ? (
            // Keyed apart from Start: if React reused one <button>, the instant re-render after
            // aborting would flip it to type="submit" mid-click and restart the crawl.
            <Button
              key="stop"
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.preventDefault();
                stop();
              }}
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          ) : (
            <Button key="start" type="submit" disabled={!baseUrl.trim() && !!apiKey}>
              <Play className="h-3.5 w-3.5" /> {session ? 'Restart' : 'Start'}
            </Button>
          )}
        </div>
        {urlError ? (
          <p id="discovery-url-error" role="alert" className="mt-1.5 text-xs text-destructive-text">
            {urlError}
          </p>
        ) : (
          <p id="discovery-url-hint" className="mt-1.5 hidden text-xs text-muted-foreground sm:block">
            GET requests only, same host, up to {MAX_DISCOVERY_REQUESTS} requests. The API must allow browser requests (CORS).
          </p>
        )}
      </form>
      <div className="min-h-0 flex-1">{body}</div>
    </div>
  );
};
