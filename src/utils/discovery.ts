import { GoogleGenAI, Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse, DiscoveredEndpoint } from '../types';
import { realApiCall } from '../api';
import { getApiKey } from './apiKey';

/** Hard cap on requests per crawl, so a link-rich API can't make discovery run forever. */
export const MAX_DISCOVERY_REQUESTS = 40;
const MODEL = 'gemini-2.5-flash';
const MAX_BODY_FOR_AI = 12000;

export type DiscoveryLogLevel = 'info' | 'ok' | 'warn' | 'error' | 'ai';

export interface DiscoveryLogEntry {
  time: number;
  level: DiscoveryLogLevel;
  message: string;
}

export interface DiscoveryProgress {
  requested: number;
  queued: number;
  limit: number;
}

export interface DiscoveryUpdate {
  log?: DiscoveryLogEntry[];
  endpoints?: DiscoveredEndpoint[];
  progress?: DiscoveryProgress;
}

const entry = (level: DiscoveryLogLevel, message: string): DiscoveryLogEntry => ({ time: Date.now(), level, message });

/* ------------------------------------------------------------------ */
/* URL helpers (pure, tested)                                          */
/* ------------------------------------------------------------------ */

/** Validate and normalise what the user typed. Adds https:// when no scheme is given. */
export const normalizeBaseUrl = (input: string): { url: string } | { error: string } => {
  const raw = input.trim();
  if (!raw) return { error: 'Enter the base URL of the API to explore.' };
  if (/\s/.test(raw)) return { error: 'That is not a valid URL. URLs cannot contain spaces.' };
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  // Local dev servers rarely speak TLS; everything else defaults to https.
  const withScheme = hasScheme ? raw : /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(raw) ? `http://${raw}` : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    return { error: 'That is not a valid URL.' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'Only http:// and https:// URLs can be explored.' };
  if (!u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost' && !/^\[.*\]$/.test(u.hostname))) {
    return { error: 'Include a full host name, for example api.example.com.' };
  }
  u.hash = '';
  return { url: u.toString() };
};

/** Canonical key for de-duplicating URLs: no hash, no trailing slash (except root). */
export const canonicalUrl = (url: string): string => {
  const u = new URL(url);
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
};

const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|ico|css|js|mjs|map|woff2?|ttf|eot|pdf|zip|mp4|mp3)$/i;

/**
 * Resolve a link found in a response against the URL it came from.
 * Returns null for other origins, non-http schemes, templates and static assets.
 */
export const resolveLink = (link: string, fromUrl: string): string | null => {
  const l = link.trim();
  if (!l || l.length > 2048 || /[{}<>\s]/.test(l) || /^(mailto|javascript|data|tel):/i.test(l)) return null;
  let u: URL;
  try {
    u = new URL(l, fromUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.origin !== new URL(fromUrl).origin) return null;
  if (ASSET_EXT.test(u.pathname)) return null;
  return canonicalUrl(u.toString());
};

/** Cheap, deterministic pass: string values in JSON / href attributes in HTML that look like paths on the same origin. */
export const findLinksLocally = (body: unknown, fromUrl: string): string[] => {
  const found = new Set<string>();
  const consider = (s: string) => {
    if (!/^(\/|https?:\/\/)/i.test(s)) return;
    const r = resolveLink(s, fromUrl);
    if (r) found.add(r);
  };
  const walk = (v: unknown, depth: number) => {
    if (depth > 8) return;
    if (typeof v === 'string') consider(v);
    else if (Array.isArray(v)) v.slice(0, 200).forEach((x) => walk(x, depth + 1));
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => walk(x, depth + 1));
  };
  if (typeof body === 'string') {
    for (const m of body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) consider(m[1]);
  } else {
    walk(body, 0);
  }
  return [...found];
};

/** First path segment, used to group endpoints by resource ("/users/1/posts" -> "users"). */
export const resourceOf = (url: string): string => {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
    return seg ? decodeURIComponent(seg) : '/';
  } catch {
    return '/';
  }
};

/* ------------------------------------------------------------------ */
/* Abort plumbing                                                      */
/* ------------------------------------------------------------------ */

export const abortError = () => new DOMException('Discovery stopped', 'AbortError');
export const isAbortError = (e: unknown) => e instanceof DOMException ? e.name === 'AbortError' : (e as { name?: string })?.name === 'AbortError';

/** Reject as soon as `signal` aborts, even if `promise` can't be cancelled. */
const abortable = <T,>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      }
    );
  });
};

/** Errors that will fail every subsequent AI call too (bad key, no quota). */
const isFatalAiError = (e: unknown): boolean => {
  const status = (e as { status?: number })?.status;
  const msg = e instanceof Error ? e.message : String(e);
  return status === 401 || status === 403 || status === 429 || /api key|permission|quota|RESOURCE_EXHAUSTED|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg);
};

const aiErrorMessage = (e: unknown): string => {
  const msg = e instanceof Error ? e.message : String(e);
  if (/api key not valid|API_KEY_INVALID/i.test(msg)) return 'Gemini rejected the API key. Check it in Settings.';
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return 'Gemini quota exceeded. Try again later.';
  // SDK errors embed the raw JSON body; keep the message readable.
  const m = /"message"\s*:\s*"([^"]+)"/.exec(msg);
  return m ? m[1] : msg.slice(0, 200);
};

/* ------------------------------------------------------------------ */
/* AI calls                                                            */
/* ------------------------------------------------------------------ */

const createClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Add a Gemini API key in Settings to use Discovery.');
  return new GoogleGenAI({ apiKey });
};

async function extractLinksWithAi(ai: GoogleGenAI, body: string, fromUrl: string, signal: AbortSignal): Promise<string[]> {
  const response = await abortable(
    ai.models.generateContent({
      model: MODEL,
      contents:
        `This is the response body from GET ${fromUrl}. List strings in it that look like API endpoint paths or URLs on the same API ` +
        `(for example "/users/123" or "/products?page=2"). Ignore images, stylesheets, scripts and links to other websites. ` +
        `Return a JSON array of strings, or [] if there are none.\n\n\`\`\`\n${body}\n\`\`\``,
      config: {
        responseMimeType: 'application/json',
        responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } },
        abortSignal: signal,
      },
    }),
    signal
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse((response.text ?? '').trim() || '[]');
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter((l): l is string => typeof l === 'string') : [];
}

const snippet = (r?: ApiResponse): string => {
  if (!r) return '';
  const s = typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2) ?? '';
  return s.slice(0, 600);
};

/** Draft an OpenAPI 3 document (YAML) from what the crawl found. */
export async function generateOpenApiSpec(endpoints: DiscoveredEndpoint[], baseUrl: string, signal: AbortSignal): Promise<string> {
  const ai = createClient();
  const simplified = endpoints.map((ep) => {
    const u = new URL(ep.url);
    return {
      method: ep.method,
      path: u.pathname,
      query: u.search || undefined,
      status: ep.response?.status,
      content_type: ep.response?.headers['content-type'],
      body_snippet: snippet(ep.response),
    };
  });
  try {
    const response = await abortable(
      ai.models.generateContent({
        model: MODEL,
        contents:
          `Write a concise OpenAPI 3.0 specification in YAML for the API at ${new URL(baseUrl).origin}, based only on these observed GET requests ` +
          `and example responses. Turn concrete ids into path parameters (/users/123 -> /users/{id}), infer response schemas from the bodies, ` +
          `and do not invent endpoints that are not listed. Respond with YAML only.\n\n\`\`\`json\n${JSON.stringify(simplified, null, 2)}\n\`\`\``,
        config: { abortSignal: signal },
      }),
      signal
    );
    const yaml = (response.text ?? '').replace(/^\s*```(?:ya?ml)?\s*/i, '').replace(/```\s*$/, '').trim();
    if (!yaml) throw new Error('Gemini returned an empty specification.');
    return yaml;
  } catch (e) {
    if (isAbortError(e) || signal.aborted) throw abortError();
    throw new Error(aiErrorMessage(e));
  }
}

/* ------------------------------------------------------------------ */
/* Crawl                                                               */
/* ------------------------------------------------------------------ */

/**
 * Breadth-first crawl of an API, starting at `baseUrl`. Sends GET requests only, stays on the
 * same origin and stops after `maxRequests`. Each response is scanned for links locally and
 * with Gemini. Throws an AbortError when `signal` aborts.
 */
export async function* startDiscovery(
  baseUrl: string,
  signal: AbortSignal,
  maxRequests: number = MAX_DISCOVERY_REQUESTS
): AsyncGenerator<DiscoveryUpdate> {
  const ai = createClient();
  const start = canonicalUrl(baseUrl);
  const queue: string[] = [start];
  const seen = new Set<string>([start]);
  let endpoints: DiscoveredEndpoint[] = [];
  let requested = 0;
  let aiFailures = 0;

  const progress = (): DiscoveryProgress => ({ requested, queued: queue.length, limit: maxRequests });

  while (queue.length > 0 && requested < maxRequests) {
    if (signal.aborted) throw abortError();
    const url = queue.shift()!;
    const path = new URL(url).pathname + new URL(url).search;
    requested++;
    yield { log: [entry('info', `GET ${path}`)], progress: progress() };

    const response = await abortable(
      realApiCall({
        method: 'GET',
        url,
        headers: [{ id: 1, key: 'Accept', value: 'application/json, text/html;q=0.8, */*;q=0.5', enabled: true }],
        body: undefined,
        settings: { followRedirects: true, sslVerification: true },
      }, { signal }),
      signal
    );

    if (!response.status) {
      if (requested === 1) {
        throw new Error(
          `Couldn't reach ${url}. The server may be down, or it doesn't allow requests from a browser (CORS). Discovery runs in your browser, so the API must send Access-Control-Allow-Origin.`
        );
      }
      yield { log: [entry('error', `${path}: ${response.statusText} (no response)`)], progress: progress() };
      continue;
    }

    const exists = response.status !== 404 && response.status !== 410;
    if (exists) {
      const ok = response.status >= 200 && response.status < 400;
      endpoints = [...endpoints, { id: uuidv4(), method: 'GET', url, status: ok ? 'tested' : 'error', response }];
      yield {
        log: [entry(ok ? 'ok' : 'warn', `${response.status} ${response.statusText} ${path} · ${response.duration} ms`)],
        endpoints,
        progress: progress(),
      };
    } else {
      yield { log: [entry('warn', `${response.status} ${path} (not found, skipped)`)], progress: progress() };
    }
    if (!(response.status >= 200 && response.status < 300)) continue;

    const enqueue = (links: string[]): number => {
      let added = 0;
      for (const link of links) {
        const r = resolveLink(link, url);
        if (r && !seen.has(r)) {
          seen.add(r);
          queue.push(r);
          added++;
        }
      }
      return added;
    };

    const local = enqueue(findLinksLocally(response.body, url));

    const bodyString = typeof response.body === 'string' ? response.body : JSON.stringify(response.body);
    let aiAdded = 0;
    if (bodyString && bodyString.length > 2) {
      try {
        const links = await extractLinksWithAi(ai, bodyString.slice(0, MAX_BODY_FOR_AI), url, signal);
        aiAdded = enqueue(links);
      } catch (e) {
        if (isAbortError(e) || signal.aborted) throw abortError();
        aiFailures++;
        if (isFatalAiError(e) || aiFailures >= 3) throw new Error(aiErrorMessage(e));
        yield { log: [entry('warn', `Gemini could not analyse ${path}: ${aiErrorMessage(e)}`)] };
      }
    }
    if (local + aiAdded > 0) {
      yield { log: [entry('ai', `Found ${local + aiAdded} new ${local + aiAdded === 1 ? 'path' : 'paths'} in ${path}`)], progress: progress() };
    }
  }

  if (queue.length > 0) {
    yield { log: [entry('warn', `Stopped at the ${maxRequests}-request limit with ${queue.length} paths left unvisited.`)], progress: progress() };
  }
}
